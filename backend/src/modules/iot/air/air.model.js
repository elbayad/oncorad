import pool from '../../../core/config/database.js';

class AirSensor {
  static async getAll(floorId = null) {
    try {
      let query = `
        SELECT as_table.*, f.name as floor_name,
               aqr.temperature_celsius, aqr.humidity_percent,
               aqr.pm1_ugm3, aqr.pm25_ugm3, aqr.pm10_ugm3,
               aqr.tvoc_ugm3, aqr.smoke, aqr.presence,
               aqr.reading_time,
               as_table.status as connection_status,
               as_table.temp_min_warning, as_table.temp_max_warning,
               as_table.temp_min_critical, as_table.temp_max_critical,
               as_table.hum_min_warning, as_table.hum_max_warning,
               as_table.hum_min_critical, as_table.hum_max_critical,
               as_table.pm25_warning, as_table.pm25_critical,
               as_table.tvoc_warning, as_table.tvoc_critical,
               as_table.co2_warning, as_table.co2_critical
        FROM air_sensors as_table
        LEFT JOIN floors f ON as_table.floor_id = f.id
        LEFT JOIN LATERAL (
          SELECT * FROM air_quality_readings 
          WHERE sensor_id = as_table.id 
          ORDER BY reading_time DESC 
          LIMIT 1
        ) aqr ON true
        WHERE as_table.is_active = true
      `;
      const params = [];

      if (floorId) {
        query += ' AND as_table.floor_id = $1';
        params.push(floorId);
      }

      query += ' ORDER BY as_table.floor_id, as_table.zone';

      const result = await pool.query(query, params);

      // Dynamic Status Calculation (Hospital thresholds)
      return result.rows.map(sensor => {
        let status = 'OK';
        const temp = Number(sensor.temperature_celsius);
        const hum = Number(sensor.humidity_percent);
        const pm25 = Number(sensor.pm25_ugm3);
        const tvoc = Number(sensor.tvoc_ugm3);

        const tMinC = Number(sensor.temp_min_critical || 15);
        const tMaxC = Number(sensor.temp_max_critical || 32);
        const hMinC = Number(sensor.hum_min_critical || 20);
        const hMaxC = Number(sensor.hum_max_critical || 80);
        const p25C = Number(sensor.pm25_critical || 75);
        const tvocC = Number(sensor.tvoc_critical || 1500);

        const tMinW = Number(sensor.temp_min_warning || 18);
        const tMaxW = Number(sensor.temp_max_warning || 26);
        const hMinW = Number(sensor.hum_min_warning || 30);
        const hMaxW = Number(sensor.hum_max_warning || 60);
        const p25W = Number(sensor.pm25_warning || 35);
        const tvocW = Number(sensor.tvoc_warning || 500);

        if (
          (sensor.reading_time && (temp < tMinC || temp > tMaxC)) ||
          (sensor.reading_time && (hum < hMinC || hum > hMaxC)) ||
          (pm25 > p25C) ||
          (tvoc > tvocC) ||
          (Number(sensor.smoke) === 1)
        ) {
          status = 'CRITIQUE';
        } else if (
          (sensor.reading_time && (temp < tMinW || temp > tMaxW)) ||
          (sensor.reading_time && (hum < hMinW || hum > hMaxW)) ||
          (pm25 > p25W) ||
          (tvoc > tvocW)
        ) {
          status = 'A_SURVEILLER';
        }

        return { ...sensor, current_status: sensor.reading_time ? status : null };
      });
    } catch (error) {
      throw new Error(`Error getting air sensors: ${error.message}`);
    }
  }

  static async addReading(sensorId, rawData) {
    try {
      // 1. Get last known reading for Step C (Persistence)
      const lastReadingQuery = `
        SELECT * FROM air_quality_readings 
        WHERE sensor_id = $1 
        ORDER BY reading_time DESC LIMIT 1
      `;
      const lastReadingResult = await pool.query(lastReadingQuery, [sensorId]);
      const last = lastReadingResult.rows[0] || {};

      // Update sensor activity status
      await pool.query(
        `UPDATE public.air_sensors 
         SET last_seen = CURRENT_TIMESTAMP, status = 'active' 
         WHERE id = $1`,
        [sensorId]
      );

      // Cleaning Function
      const clean = (val, lastVal, min, max) => {
        const fallback = (lastVal !== undefined && lastVal !== null) ? lastVal : null;
        // Step A & B
        if (val === "#" || val === null || val === undefined || isNaN(val)) return fallback;
        const num = Number(val);
        if (num < min || num > max) return fallback;
        return num;
      };

      // Apply cleaning strategy
      const temperature = clean(rawData.temperature, last.temperature_celsius, -40, 100);
      const humidity = clean(rawData.humidity, last.humidity_percent, 0, 100);
      const tvoc = clean(rawData.tvoc, last.tvoc_ugm3, 0, 10000);
      const pm1 = clean(rawData.pm1, last.pm1_ugm3, 0, 1000);
      const pm25 = clean(rawData.pm25, last.pm25_ugm3, 0, 1000);
      const pm10 = clean(rawData.pm10, last.pm10_ugm3, 0, 1000);
      const smoke = clean(rawData.smoke, last.smoke, 0, 1);
      const presence = clean(rawData.human, last.presence, 0, 1);

      const result = await pool.query(
        `INSERT INTO air_quality_readings (
          sensor_id, temperature_celsius, humidity_percent,
          pm1_ugm3, pm25_ugm3, pm10_ugm3, tvoc_ugm3,
          smoke, presence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          sensorId, temperature, humidity,
          pm1, pm25, pm10, tvoc,
          smoke, presence
        ]
      );

      // console.log(`[AirSensor] Insertion réussie pour ${sensorId} (PM2.5: ${pm25})`);
      return result.rows[0];
    } catch (error) {
      console.error(`[AirSensor] Erreur insertion pour ${sensorId}:`, error.message);
      throw error;
    }
  }

  static async getReadingHistory(sensorId, timeframe = 'today') {
    let interval = '1 day';
    let group = 'hour';

    switch (timeframe) {
      case 'week': interval = '7 days'; group = 'day'; break;
      case 'month': interval = '30 days'; group = 'day'; break;
      case 'year': interval = '1 year'; group = 'month'; break;
      default: interval = '1 day'; group = 'hour';
    }

    try {
      const query = `
        SELECT 
          date_trunc($1, reading_time) as time,
          AVG(temperature_celsius) as avg_temp,
          AVG(humidity_percent) as avg_hum,
          AVG(pm25_ugm3) as avg_pm25,
          AVG(tvoc_ugm3) as avg_tvoc
        FROM air_quality_readings 
        WHERE sensor_id = $2 AND reading_time >= NOW() - CAST($3 AS interval)
        GROUP BY 1
        ORDER BY 1 ASC
      `;
      const result = await pool.query(query, [group, sensorId, interval]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting air quality history: ${error.message}`);
    }
  }

  static async getAlerts() {
    try {
      const result = await pool.query(
        `SELECT aqa.*, as_table.name as sensor_name, as_table.zone, f.name as floor_name
         FROM air_quality_alerts aqa
         JOIN air_sensors as_table ON aqa.sensor_id = as_table.id
         LEFT JOIN floors f ON as_table.floor_id = f.id
         WHERE aqa.is_resolved = false
         ORDER BY aqa.severity DESC, aqa.created_at DESC`
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting air quality alerts: ${error.message}`);
    }
  }

  static async create(data) {
    const {
      id, name, floor_id, zone, is_active,
      temp_min_warning = 18.0, temp_max_warning = 26.0, temp_min_critical = 15.0, temp_max_critical = 32.0,
      hum_min_warning = 30.0, hum_max_warning = 60.0, hum_min_critical = 20.0, hum_max_critical = 80.0,
      pm25_warning = 35.0, pm25_critical = 75.0,
      tvoc_warning = 500.0, tvoc_critical = 1500.0,
      co2_warning = 1000.0, co2_critical = 2000.0
    } = data;
    try {
      const result = await pool.query(
        `INSERT INTO public.air_sensors (
          id, name, floor_id, zone, is_active, created_at,
          temp_min_warning, temp_max_warning, temp_min_critical, temp_max_critical,
          hum_min_warning, hum_max_warning, hum_min_critical, hum_max_critical,
          pm25_warning, pm25_critical, tvoc_warning, tvoc_critical, co2_warning, co2_critical
        )
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         RETURNING *`,
        [
          id, name, floor_id, zone, is_active,
          temp_min_warning, temp_max_warning, temp_min_critical, temp_max_critical,
          hum_min_warning, hum_max_warning, hum_min_critical, hum_max_critical,
          pm25_warning, pm25_critical, tvoc_warning, tvoc_critical, co2_warning, co2_critical
        ]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating air sensor: ${error.message}`);
    }
  }

  static async update(id, data) {
    const {
      name, floor_id, zone, is_active,
      temp_min_warning, temp_max_warning, temp_min_critical, temp_max_critical,
      hum_min_warning, hum_max_warning, hum_min_critical, hum_max_critical,
      pm25_warning, pm25_critical, tvoc_warning, tvoc_critical, co2_warning, co2_critical
    } = data;
    try {
      const result = await pool.query(
        `UPDATE public.air_sensors
         SET name = $2, floor_id = $3, zone = $4, is_active = $5,
             temp_min_warning = COALESCE($6, temp_min_warning),
             temp_max_warning = COALESCE($7, temp_max_warning),
             temp_min_critical = COALESCE($8, temp_min_critical),
             temp_max_critical = COALESCE($9, temp_max_critical),
             hum_min_warning = COALESCE($10, hum_min_warning),
             hum_max_warning = COALESCE($11, hum_max_warning),
             hum_min_critical = COALESCE($12, hum_min_critical),
             hum_max_critical = COALESCE($13, hum_max_critical),
             pm25_warning = COALESCE($14, pm25_warning),
             pm25_critical = COALESCE($15, pm25_critical),
             tvoc_warning = COALESCE($16, tvoc_warning),
             tvoc_critical = COALESCE($17, tvoc_critical),
             co2_warning = COALESCE($18, co2_warning),
             co2_critical = COALESCE($19, co2_critical)
         WHERE id = $1
         RETURNING *`,
        [
          id, name, floor_id, zone, is_active,
          temp_min_warning, temp_max_warning, temp_min_critical, temp_max_critical,
          hum_min_warning, hum_max_warning, hum_min_critical, hum_max_critical,
          pm25_warning, pm25_critical, tvoc_warning, tvoc_critical, co2_warning, co2_critical
        ]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating air sensor: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      await pool.query('DELETE FROM public.air_sensors WHERE id = $1', [id]);
      return true;
    } catch (error) {
      throw new Error(`Error deleting air sensor: ${error.message}`);
    }
  }
  static async markInactiveSensors(thresholdMinutes = 5) {
    try {
      const result = await pool.query(
        `UPDATE public.air_sensors 
         SET status = 'offline' 
         WHERE last_seen < NOW() - make_interval(mins => $1) 
           AND status != 'offline'
         RETURNING *`,
        [thresholdMinutes]
      );
      return result.rows;
    } catch (error) {
      console.error(`Error marking inactive air sensors: ${error.message}`);
      return [];
    }
  }
}

export default AirSensor;