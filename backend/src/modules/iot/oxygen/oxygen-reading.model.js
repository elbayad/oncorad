
import pool from '../../../core/config/database.js';

class OxygenReading {
    static async addReading(pointId, readingData) {
        const { status } = readingData;

        // Status: true for ON, false for OFF in the user request context
        // The reading table has 'status' as boolean.

        try {
            const result = await pool.query(
                `INSERT INTO public.oxygen_readings (
          point_id, status
        ) VALUES ($1, $2)
        RETURNING *`,
                [pointId, status]
            );
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error adding oxygen reading: ${error.message}`);
        }
    }

    static async getLatest(pointId) {
        try {
            const result = await pool.query(
                `SELECT * FROM public.oxygen_readings 
         WHERE point_id = $1 
         ORDER BY reading_time DESC 
         LIMIT 1`,
                [pointId]
            );
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error getting latest oxygen reading: ${error.message}`);
        }
    }
}

export default OxygenReading;
