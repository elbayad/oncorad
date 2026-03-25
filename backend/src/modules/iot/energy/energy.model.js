import pool from '../../../core/config/database.js';

class EnergyMeter {
  static async getAll(floorId = null, includeInactive = false) {
    try {
      const query = `
        WITH latest AS (
          SELECT DISTINCT ON (r.meter_id)
            r.meter_id,
            r.reading_time,
            r.power_active_total,
            r.energy_active_import,
            r.voltage_a, r.voltage_b, r.voltage_c,
            r.frequency,
            r.power_factor_total,
            r.status
          FROM energy_readings r
          ORDER BY r.meter_id, r.reading_time DESC
        ),
        day_start AS (
          SELECT DISTINCT ON (r.meter_id)
            r.meter_id,
            r.energy_active_import AS e_day_start
          FROM energy_readings r
          ORDER BY r.meter_id, ABS(EXTRACT(EPOCH FROM (r.reading_time - date_trunc('day', now())))) ASC
        ),
        week_start AS (
          SELECT DISTINCT ON (r.meter_id)
            r.meter_id,
            r.energy_active_import AS e_week_start
          FROM energy_readings r
          ORDER BY r.meter_id, ABS(EXTRACT(EPOCH FROM (r.reading_time - date_trunc('week', now())))) ASC
        ),
        month_start AS (
          SELECT DISTINCT ON (r.meter_id)
            r.meter_id,
            r.energy_active_import AS e_month_start
          FROM energy_readings r
          ORDER BY r.meter_id, ABS(EXTRACT(EPOCH FROM (r.reading_time - date_trunc('month', now())))) ASC
        ),
        year_start AS (
          SELECT DISTINCT ON (r.meter_id)
            r.meter_id,
            r.energy_active_import AS e_year_start
          FROM energy_readings r
          ORDER BY r.meter_id, ABS(EXTRACT(EPOCH FROM (r.reading_time - date_trunc('year', now())))) ASC
        )
        SELECT
          m.id,
          m.name,
          m.designation,
          m.is_active,
          m.max_capacity_kw,
          m.meter_type,
          m.installation_date,
          m.last_maintenance,
          m.floor_id,
          f.name as floor_name,
          m.zone,
          m.device,
          m.channel,
          m.cable,
          m.ctcurrent,
          l.reading_time,
          -- Hypothetical scaling: raw power * CT ratio
          COALESCE(l.power_active_total * m.ctcurrent, 0) AS consumption_kw,
          (l.energy_active_import - COALESCE(ds.e_day_start, l.energy_active_import)) AS kwh_today,
          (l.energy_active_import - COALESCE(ws.e_week_start, l.energy_active_import)) AS kwh_week,
          (l.energy_active_import - COALESCE(ms.e_month_start, l.energy_active_import)) AS kwh_month,
          (l.energy_active_import - COALESCE(ys.e_year_start, l.energy_active_import)) AS kwh_year,
          l.power_factor_total AS pf,
          l.frequency,
          l.voltage_a, l.voltage_b, l.voltage_c,
          l.status as raw_status,
          
          -- minutes depuis dernière MAJ
          EXTRACT(EPOCH FROM (now() - l.reading_time))/60.0 AS minutes_since_last,
          
          -- statut card calculated
          CASE
            WHEN l.reading_time IS NULL THEN 'CRITIQUE'
            WHEN (now() - l.reading_time) > interval '10 minutes' THEN 'CRITIQUE'
            WHEN l.status IS NOT NULL AND l.status <> 'normal' THEN 'CRITIQUE'
            WHEN (
              CASE 
                WHEN (COALESCE(l.voltage_a,0) + COALESCE(l.voltage_b,0) + COALESCE(l.voltage_c,0)) = 0 THEN 0
                ELSE (
                  GREATEST(
                    ABS(l.voltage_a - (l.voltage_a + l.voltage_b + l.voltage_c) / 3.0),
                    ABS(l.voltage_b - (l.voltage_a + l.voltage_b + l.voltage_c) / 3.0),
                    ABS(l.voltage_c - (l.voltage_a + l.voltage_b + l.voltage_c) / 3.0)
                  ) / ((l.voltage_a + l.voltage_b + l.voltage_c) / 3.0) * 100.0
                )
              END
            ) > 5.0 THEN 'A_SURVEILLER'
            WHEN l.frequency NOT BETWEEN 49.5 AND 50.5 THEN 'A_SURVEILLER'
            ELSE 'OK'
          END AS current_status

        FROM energy_meters m
        LEFT JOIN floors f ON m.floor_id = f.id
        LEFT JOIN latest l ON l.meter_id = m.id
        LEFT JOIN day_start ds ON ds.meter_id = m.id
        LEFT JOIN week_start ws ON ws.meter_id = m.id
        LEFT JOIN month_start ms ON ms.meter_id = m.id
        LEFT JOIN year_start ys ON ys.meter_id = m.id
        WHERE 1=1
        ${!includeInactive ? 'AND m.is_active = true' : ''}
        ${floorId ? 'AND m.floor_id = $1' : ''}
        ORDER BY m.floor_id, m.name
      `;

      const params = floorId ? [floorId] : [];

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting energy meters: ${error.message}`);
    }
  }

  static async addReading(meterId, readingData) {
    const {
      voltage_a, voltage_b, voltage_c, voltage_ab, voltage_bc, voltage_ca,
      current_a, current_b, current_c, current_n,
      frequency,
      power_active_a, power_active_b, power_active_c, power_active_total,
      power_reactive_a, power_reactive_b, power_reactive_c, power_reactive_total,
      power_apparent_a, power_apparent_b, power_apparent_c, power_apparent_total,
      power_factor_a, power_factor_b, power_factor_c, power_factor_total,
      energy_active_import, energy_active_export, energy_reactive_inductive, energy_reactive_capacitive,
      temperature_celsius
    } = readingData;

    try {
      // 1. Check if meter exists (Auto-provisioning FORBIDDEN by user)
      const meter = await pool.query('SELECT id, max_capacity_kw FROM energy_meters WHERE id = $1', [meterId]);

      if (meter.rows.length === 0) {
        // console.warn(`[EnergyMeter] Meter ${meterId} unknown. Skipping reading.`);
        return null;
      }

      // Update meter status to 'active' and last_seen
      await pool.query(
        `UPDATE energy_meters 
           SET status = 'active', last_seen = CURRENT_TIMESTAMP 
           WHERE id = $1`,
        [meterId]
      );

      // 2. Determine reading status (load based)
      let readingStatus = 'normal';
      if (meter.rows[0] && meter.rows[0].max_capacity_kw > 0) {
        const capacity = meter.rows[0].max_capacity_kw;
        const usage_percent = (power_active_total / capacity) * 100;
        if (usage_percent >= 90) readingStatus = 'critical';
        else if (usage_percent >= 75) readingStatus = 'high';
      }

      const result = await pool.query(
        `INSERT INTO energy_readings (
           meter_id, reading_time,
           voltage_a, voltage_b, voltage_c, voltage_ab, voltage_bc, voltage_ca,
           current_a, current_b, current_c, current_n,
           frequency,
           power_active_a, power_active_b, power_active_c, power_active_total,
           power_reactive_a, power_reactive_b, power_reactive_c, power_reactive_total,
           power_apparent_a, power_apparent_b, power_apparent_c, power_apparent_total,
           power_factor_a, power_factor_b, power_factor_c, power_factor_total,
           energy_active_import, energy_active_export, energy_reactive_inductive, energy_reactive_capacitive,
           status, temperature_celsius
         )
         VALUES (
           $1, CURRENT_TIMESTAMP,
           $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11,
           $12,
           $13, $14, $15, $16,
           $17, $18, $19, $20,
           $21, $22, $23, $24,
           $25, $26, $27, $28,
           $29, $30, $31, $32,
           $33, $34
         )
         RETURNING *`,
        [
          meterId,
          voltage_a, voltage_b, voltage_c, voltage_ab, voltage_bc, voltage_ca,
          current_a, current_b, current_c, current_n,
          frequency,
          power_active_a, power_active_b, power_active_c, power_active_total,
          power_reactive_a, power_reactive_b, power_reactive_c, power_reactive_total,
          power_apparent_a, power_apparent_b, power_apparent_c, power_apparent_total,
          power_factor_a, power_factor_b, power_factor_c, power_factor_total,
          energy_active_import, energy_active_export, energy_reactive_inductive, energy_reactive_capacitive,
          readingStatus, temperature_celsius || 0
        ]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error adding energy reading:', error);
      // Don't throw to avoid crashing MQTT loop, just log
      return null;
    }
  }

  static async getReadingHistory(meterId, hours = 24) {
    try {
      const result = await pool.query(
        `SELECT * FROM energy_readings 
         WHERE meter_id = $1 AND reading_time >= NOW() - INTERVAL '${hours} hours'
         ORDER BY reading_time DESC`,
        [meterId]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting reading history: ${error.message}`);
    }
  }

  static async markInactiveMeters(thresholdMinutes = 5) {
    try {
      const result = await pool.query(
        `UPDATE energy_meters 
         SET status = 'offline' 
         WHERE last_seen < NOW() - make_interval(mins => $1) 
           AND status != 'offline'
         RETURNING *`,
        [thresholdMinutes]
      );
      return result.rows;
    } catch (error) {
      console.error(`Error marking inactive meters: ${error.message}`);
      return [];
    }
  }

  static async getAlerts() {
    try {
      const result = await pool.query(
        `SELECT ea.*, em.name as meter_name, f.name as floor_name
         FROM energy_alerts ea
         JOIN energy_meters em ON ea.meter_id = em.id
         LEFT JOIN floors f ON em.floor_id = f.id
         WHERE ea.is_resolved = false
         ORDER BY ea.severity DESC, ea.created_at DESC`
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting energy alerts: ${error.message}`);
    }
  }
  static async create(data) {
    const {
      name, designation, floor_id, meter_type, max_capacity_kw, zone, is_active,
      device, channel, cable, ctcurrent, installation_date, last_maintenance
    } = data;
    try {
      const result = await pool.query(
        `INSERT INTO public.energy_meters (
           name, designation, floor_id, meter_type, max_capacity_kw, zone, is_active,
           device, channel, cable, ctcurrent, installation_date, last_maintenance,
           created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          name, designation, floor_id, meter_type, max_capacity_kw, zone, is_active,
          device, channel, cable, ctcurrent,
          installation_date || null,
          last_maintenance || null
        ]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating energy meter: ${error.message}`);
    }
  }

  static async update(id, data) {
    const {
      name, designation, floor_id, meter_type, max_capacity_kw, zone, is_active,
      device, channel, cable, ctcurrent, installation_date, last_maintenance
    } = data;
    try {
      const result = await pool.query(
        `UPDATE public.energy_meters
         SET name = $2, designation = $3, floor_id = $4, meter_type = $5, max_capacity_kw = $6, zone = $7, is_active = $8,
             device = $9, channel = $10, cable = $11, ctcurrent = $12, 
             installation_date = $13, last_maintenance = $14
         WHERE id = $1
         RETURNING *`,
        [
          id, name, designation, floor_id, meter_type, max_capacity_kw, zone, is_active,
          device, channel, cable, ctcurrent,
          installation_date || null,
          last_maintenance || null
        ]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating energy meter: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      await pool.query('DELETE FROM public.energy_meters WHERE id = $1', [id]);
      return true;
    } catch (error) {
      throw new Error(`Error deleting energy meter: ${error.message}`);
    }
  }

  static async getConsumptionRange(type, id, startDate, endDate) {
    try {
      let filter = '';
      const params = [startDate, endDate];

      if (type === 'device') {
        filter = 'AND m.id = $3';
        params.push(id);
      } else if (type === 'floor') {
        filter = 'AND m.floor_id = $3';
        params.push(id);
      } else if (type === 'zone') {
        filter = 'AND m.zone = $3';
        params.push(id);
      }

      const query = `
        SELECT SUM(diff) as total_kwh
        FROM (
          SELECT 
            (MAX(r.energy_active_import) - MIN(r.energy_active_import)) * m.ctcurrent as diff
          FROM energy_readings r
          JOIN energy_meters m ON r.meter_id = m.id
          WHERE r.reading_time::date >= $1::date AND r.reading_time::date <= $2::date
          ${filter}
          GROUP BY r.meter_id, m.ctcurrent
        ) sub
      `;

      const result = await pool.query(query, params);
      return parseFloat(result.rows[0].total_kwh || 0);
    } catch (error) {
      throw new Error(`Error getting consumption range: ${error.message}`);
    }
  }

  static async getHistoryRange(type, id, startDate, endDate) {
    try {
      let filter = '';
      const params = [startDate, endDate];

      if (type === 'device') {
        filter = 'AND m.id = $3';
        params.push(id);
      } else if (type === 'floor') {
        filter = 'AND m.floor_id = $3';
        params.push(id);
      } else if (type === 'zone') {
        filter = 'AND m.zone = $3';
        params.push(id);
      }

      const query = `
        WITH per_meter_avg AS (
          SELECT 
            date_trunc('hour', r.reading_time) as bucket,
            r.meter_id,
            AVG(r.power_active_total * m.ctcurrent) as avg_p
          FROM energy_readings r
          JOIN energy_meters m ON r.meter_id = m.id
          WHERE r.reading_time::date >= $1::date AND r.reading_time::date <= $2::date
          ${filter}
          GROUP BY 1, 2
        )
        SELECT 
          bucket as time,
          SUM(avg_p) as total_kw
        FROM per_meter_avg
        GROUP BY 1
        ORDER BY 1 ASC
      `;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting history range: ${error.message}`);
    }
  }

  static async getGlobalHistory(timeframe = 'today') {
    let interval = '1 day';
    let group = 'hour';

    switch (timeframe) {
      case 'week':
        interval = '7 days';
        group = 'day';
        break;
      case 'month':
        interval = '30 days';
        group = 'day';
        break;
      case 'year':
        interval = '1 year';
        group = 'month';
        break;
      default:
        interval = '1 day';
        group = 'hour';
    }

    try {
      const query = `
        WITH per_meter_avg AS (
          SELECT 
            date_trunc($1, r.reading_time) as bucket,
            r.meter_id,
            AVG(r.power_active_total * m.ctcurrent) as avg_p
          FROM energy_readings r
          JOIN energy_meters m ON r.meter_id = m.id
          WHERE r.reading_time >= NOW() - CAST($2 AS interval)
          GROUP BY 1, 2
        )
        SELECT 
          bucket as time,
          SUM(avg_p) as total_kw
        FROM per_meter_avg
        GROUP BY 1
        ORDER BY 1 ASC
      `;
      const result = await pool.query(query, [group, interval]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting global history: ${error.message}`);
    }
  }
}

export default EnergyMeter;