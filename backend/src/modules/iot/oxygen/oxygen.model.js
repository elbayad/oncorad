
import pool from '../../../core/config/database.js';
import { randomUUID } from 'crypto';

class OxygenPoint {
  static async getAll(floorId = null) {
    try {
      let query = `
        SELECT op.*, f.name as floor_name,
               oxr.reading_time,
               oxr.status as current_status,
               oxr.leak_detected,
               oxr.pressure_bar,
               oxr.flow_lpm,
               op.mac,
               op.status as connection_status,
               op.last_seen,
               EXISTS (
                 SELECT 1 FROM public.assets a
                 WHERE (a.last_room_id = op.room_id OR a.room = op.name)
                   AND a.type_id = 'patient'
                   AND a.status = 'active'
                   AND a.last_seen >= NOW() - INTERVAL '30 minutes'
               ) as has_patient
        FROM public.oxygen_points op
        LEFT JOIN public.floors f ON op.floor_id = f.id
        LEFT JOIN LATERAL (
          SELECT * FROM public.oxygen_readings 
          WHERE point_id = op.id 
          ORDER BY reading_time DESC 
          LIMIT 1
        ) oxr ON true
        WHERE op.is_active = true
      `;
      const params = [];

      if (floorId) {
        query += ' AND op.floor_id = $1';
        params.push(floorId);
      }

      query += ' ORDER BY op.floor_id, op.location';

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting oxygen points: ${error.message}`);
    }
  }



  static async findByMac(mac) {
    try {
      const result = await pool.query(
        `SELECT * FROM public.oxygen_points 
         WHERE mac = $1 AND is_active = true`,
        [mac]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error finding point by MAC: ${error.message}`);
    }
  }

  static async findByMacAndLocation(mac, location) {
    try {
      const result = await pool.query(
        `SELECT * FROM public.oxygen_points 
         WHERE mac = $1 AND TRIM(location) = $2 AND is_active = true`,
        [mac, location]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error finding point by MAC and Location: ${error.message}`);
    }
  }

  static async create(data) {
    const {
      name, floor_id, location, is_active,
      mac, point_type, zone, room_id,
      installation_date, last_maintenance, next_maintenance
    } = data;
    const id = randomUUID();
    try {
      const result = await pool.query(
        `INSERT INTO public.oxygen_points (
           id, name, floor_id, location, zone, is_active, created_at,
           mac, point_type, room_id, installation_date, last_maintenance, next_maintenance
         )
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          id, name, floor_id, location, zone || 'Default Zone', is_active,
          mac, point_type || 'outlet', room_id,
          installation_date || null, last_maintenance || null, next_maintenance || null
        ]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating oxygen point: ${error.message}`);
    }
  }

  static async addReading(pointId, readingData) {
    // Deprecated: Use OxygenReading.create instead, but keeping for compatibility if needed
    // or we can redirect to the new model or keep logic here.
    // Given the task, I will keep logic here for now but update to match table structure
    const {
      pressure_bar, flow_lpm, purity_percent,
      temperature_celsius, leak_detected, status
    } = readingData;

    try {
      const result = await pool.query(
        `INSERT INTO public.oxygen_readings (
          point_id, pressure_bar, flow_lpm, purity_percent,
          temperature_celsius, status, leak_detected
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [pointId, pressure_bar, flow_lpm, purity_percent,
          temperature_celsius, status, leak_detected]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error adding oxygen reading: ${error.message}`);
    }
  }

  static async getReadingHistory(pointId, hours = 24) {
    try {
      const result = await pool.query(
        `SELECT * FROM public.oxygen_readings 
         WHERE point_id = $1 AND reading_time >= NOW() - INTERVAL '${hours} hours'
         ORDER BY reading_time DESC`,
        [pointId]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting oxygen reading history: ${error.message}`);
    }
  }

  static async getMaintenanceSchedule() {
    try {
      const result = await pool.query(
        `SELECT om.*, op.name as point_name, op.location, f.name as floor_name,
                u.name as technician_name
         FROM public.oxygen_maintenance om
         JOIN public.oxygen_points op ON om.point_id = op.id
         LEFT JOIN public.floors f ON op.floor_id = f.id
         LEFT JOIN public.users u ON om.technician_id = u.id
         WHERE om.status IN ('scheduled', 'in-progress')
         ORDER BY om.scheduled_date`
      );
      return result.rows;
    } catch (error) {
      // Return empty if table doesn't exist yet (it wasn't in the prompt to create maintenance table)
      return [];
    }
  }

  static async scheduleMaintenance(pointId, maintenanceData) {
    const { maintenance_type, technician_id, scheduled_date, notes } = maintenanceData;

    try {
      const result = await pool.query(
        `INSERT INTO public.oxygen_maintenance (point_id, maintenance_type, technician_id, scheduled_date, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [pointId, maintenance_type, technician_id, scheduled_date, notes]
      );
      return result.rows[0];
    } catch (error) {
      // Table might not exist
      console.error("Maintenance table missing?", error);
      throw error;
    }
  }


  static async update(id, data) {
    const {
      name, floor_id, location, is_active, mac, room_id,
      zone, point_type, installation_date, last_maintenance, next_maintenance
    } = data;
    try {
      const result = await pool.query(
        `UPDATE public.oxygen_points 
         SET name = $2, floor_id = $3, location = $4, is_active = $5,
             mac = COALESCE($6, mac), room_id = $7, 
             zone = $8, point_type = $9,
             installation_date = $10, last_maintenance = $11, next_maintenance = $12
         WHERE id = $1
         RETURNING *`,
        [
          id, name, floor_id, location, is_active, mac, room_id,
          zone, point_type,
          installation_date || null, last_maintenance || null, next_maintenance || null
        ]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating oxygen point: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      await pool.query('DELETE FROM public.oxygen_points WHERE id = $1', [id]);
      return true;
    } catch (error) {
      throw new Error(`Error deleting oxygen point: ${error.message}`);
    }
  }
  static async getDailyStats() {
    try {
      // Calculate total open duration for today using LEAD window function
      // Assumes state holds until next reading or NOW()
      // We cap the duration of a single reading to 1 hour to prevent dead sensors from counting as open forever
      const query = `
        WITH OrderedReadings AS (
            SELECT 
                point_id, 
                status, 
                reading_time,
                LEAD(reading_time, 1, NOW()) OVER (PARTITION BY point_id ORDER BY reading_time) as next_time
            FROM public.oxygen_readings
            WHERE reading_time >= CURRENT_DATE
        ),
        Durations AS (
            SELECT 
                EXTRACT(EPOCH FROM (LEAST(next_time, reading_time + INTERVAL '1 hour') - reading_time)) as duration_seconds
            FROM OrderedReadings
            WHERE status = true
        )
        SELECT 
            COALESCE(SUM(duration_seconds), 0) as total_seconds_today
        FROM Durations
      `;

      const result = await pool.query(query);
      const totalSeconds = parseFloat(result.rows[0].total_seconds_today);

      return {
        totalDurationMs: totalSeconds * 1000
      };
    } catch (error) {
      throw new Error(`Error calculating daily stats: ${error.message}`);
    }
  }

  static async getValveHistory(pointId, start, end) {
    try {
      const query = `
        WITH SegmentDates AS (
          SELECT generate_series(DATE($2), DATE($3), '1 day')::DATE as day
        ),
        InitialState AS (
          SELECT status, CAST($2 AS TIMESTAMP) as reading_time
          FROM public.oxygen_readings
          WHERE point_id = $1 AND reading_time < $2
          ORDER BY reading_time DESC
          LIMIT 1
        ),
        RangeReadings AS (
          SELECT status, reading_time
          FROM public.oxygen_readings
          WHERE point_id = $1 AND reading_time >= $2 AND reading_time <= $3
        ),
        AllRelevantReadings AS (
          SELECT status, reading_time FROM InitialState
          UNION ALL
          SELECT status, reading_time FROM RangeReadings
        ),
        Segments AS (
          SELECT 
            status,
            reading_time as seg_start,
            LEAD(reading_time, 1, CAST($3 AS TIMESTAMP)) OVER (ORDER BY reading_time) as seg_end
          FROM AllRelevantReadings
        )
        SELECT 
            d.day,
            COALESCE(SUM(
                EXTRACT(EPOCH FROM (
                    LEAST(s.seg_end, d.day + INTERVAL '1 day') - 
                    GREATEST(s.seg_start, d.day)
                ))
            ), 0) as total_seconds
        FROM SegmentDates d
        CROSS JOIN Segments s
        WHERE s.status = true
          AND s.seg_start < d.day + INTERVAL '1 day'
          AND s.seg_end > d.day
        GROUP BY d.day
        ORDER BY d.day DESC
      `;

      const result = await pool.query(query, [pointId, start, end]);
      return result.rows.map(row => ({
        day: row.day,
        totalSeconds: parseFloat(row.total_seconds)
      }));
    } catch (error) {
      throw new Error(`Error calculating valve history: ${error.message}`);
    }
  }

  static async updateLastSeen(id) {
    try {
      await pool.query(
        `UPDATE public.oxygen_points 
         SET last_seen = CURRENT_TIMESTAMP, status = 'active'
         WHERE id = $1`,
        [id]
      );
    } catch (error) {
      console.error(`Error updating oxygen point last seen: ${error.message}`);
    }
  }

  static async markInactivePoints(thresholdMinutes = 5) {
    try {
      const result = await pool.query(
        `UPDATE public.oxygen_points 
         SET status = 'offline' 
         WHERE last_seen < NOW() - make_interval(mins => $1) 
           AND status != 'offline'
         RETURNING *`,
        [thresholdMinutes]
      );
      return result.rows;
    } catch (error) {
      console.error(`Error marking inactive oxygen points: ${error.message}`);
      return [];
    }
  }
}

export default OxygenPoint;