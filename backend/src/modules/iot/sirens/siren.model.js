
import pool from '../../../core/config/database.js';

class Siren {
    static async getAll() {
        try {
            const result = await pool.query('SELECT * FROM siren ORDER BY id ASC');
            return result.rows;
        } catch (error) {
            throw new Error(`Error getting sirens: ${error.message}`);
        }
    }

    static async getById(id) {
        try {
            const result = await pool.query('SELECT * FROM siren WHERE id = $1', [id]);
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error getting siren by id: ${error.message}`);
        }
    }

    static async create(data) {
        const { mac, name, designation, geofence, output_channel } = data;
        try {
            const result = await pool.query(
                'INSERT INTO siren (mac, name, designation, geofence, output_channel, floor_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [mac, name, designation, geofence, output_channel || 'state1', data.floor_id]
            );
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error creating siren: ${error.message}`);
        }
    }

    static async update(id, data) {
        const { mac, name, designation, geofence, output_channel, floor_id } = data;
        try {
            const result = await pool.query(
                'UPDATE siren SET mac = $1, name = $2, designation = $3, geofence = $4, output_channel = $5, floor_id = $6 WHERE id = $7 RETURNING *',
                [mac, name, designation, geofence, output_channel, floor_id, id]
            );
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error updating siren: ${error.message}`);
        }
    }

    static async delete(id) {
        try {
            await pool.query('DELETE FROM siren WHERE id = $1', [id]);
            return true;
        } catch (error) {
            throw new Error(`Error deleting siren: ${error.message}`);
        }
    }
}

export default Siren;
