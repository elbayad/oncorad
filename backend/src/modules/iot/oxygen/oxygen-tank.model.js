
import pool from '../../../core/config/database.js';

class OxygenTank {
    static async findByMac(mac) {
        try {
            const result = await pool.query(
                'SELECT * FROM public.oxygen_tanks WHERE mac = $1',
                [mac]
            );
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error finding oxygen tank by MAC: ${error.message}`);
        }
    }

    static async findAllByMac(mac) {
        try {
            const result = await pool.query(
                'SELECT * FROM public.oxygen_tanks WHERE mac = $1',
                [mac]
            );
            return result.rows;
        } catch (error) {
            throw new Error(`Error finding oxygen tanks by MAC: ${error.message}`);
        }
    }

    static async getAll() {
        try {
            const result = await pool.query(
                'SELECT * FROM public.oxygen_tanks ORDER BY name'
            );
            return result.rows;
        } catch (error) {
            throw new Error(`Error getting oxygen tanks: ${error.message}`);
        }
    }

    static async updateLastSeen(id) {
        try {
            await pool.query(
                `UPDATE public.oxygen_tanks 
                 SET last_seen = CURRENT_TIMESTAMP, status = 'active' 
                 WHERE id = $1`,
                [id]
            );
        } catch (error) {
            console.error(`Error updating oxygen tank last seen: ${error.message}`);
        }
    }

    static async markInactiveTanks(thresholdMinutes = 5) {
        try {
            const result = await pool.query(
                `UPDATE public.oxygen_tanks 
                 SET status = 'offline' 
                 WHERE last_seen < NOW() - make_interval(mins => $1) 
                   AND status != 'offline'
                 RETURNING *`,
                [thresholdMinutes]
            );
            return result.rows;
        } catch (error) {
            console.error(`Error marking inactive oxygen tanks: ${error.message}`);
            return [];
        }
    }
}

export default OxygenTank;
