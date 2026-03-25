
import pool from '../../../core/config/database.js';

class OxygenTankReading {
    static async addReading(tankId, data) {
        const { pressure1, stat1, pressure2, stat2 } = data;
        try {
            const result = await pool.query(
                `INSERT INTO public.oxygen_tank_readings 
         (tank_id, pressure1, stat1, pressure2, stat2) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
                [tankId, pressure1, stat1, pressure2, stat2]
            );
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error adding oxygen tank reading: ${error.message}`);
        }
    }

    static async getLatest(tankId) {
        try {
            const result = await pool.query(
                `SELECT * FROM public.oxygen_tank_readings 
         WHERE tank_id = $1 
         ORDER BY reading_time DESC 
         LIMIT 1`,
                [tankId]
            );
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error getting latest oxygen tank reading: ${error.message}`);
        }
    }

    static async getHistory(tankId, start, end) {
        try {
            const result = await pool.query(
                `SELECT * FROM public.oxygen_tank_readings 
         WHERE tank_id = $1 
         AND reading_time BETWEEN $2 AND $3 
         ORDER BY reading_time ASC`,
                [tankId, start, end]
            );
            return result.rows;
        } catch (error) {
            throw new Error(`Error getting oxygen tank history: ${error.message}`);
        }
    }
}

export default OxygenTankReading;
