import pool from '../../core/config/database.js';

class Zone {
    static async migrate() {
        try {
            await pool.query(`
                ALTER TABLE zones 
                ADD COLUMN IF NOT EXISTS floor_id INTEGER REFERENCES floors(id),
                ADD COLUMN IF NOT EXISTS polygon TEXT;
            `);
        } catch (err) {
            console.error('[Zone Migration] Error:', err.message);
        }
    }

    static async getAll() {
        const result = await pool.query(
            `SELECT z.id, z.name, z.description, z.type, z.floor_id, 
                    ST_AsGeoJSON(z.polygon) as polygon_json,
                    z.created_at, z.updated_at,
                    f.name as floor_name, f.description as floor_description 
             FROM zones z
             LEFT JOIN floors f ON z.floor_id = f.id
             ORDER BY z.name`
        );
        return result.rows.map(row => ({
            ...row,
            polygon: row.polygon_json ? JSON.parse(row.polygon_json) : null
        }));
    }

    static async getById(id) {
        const result = await pool.query(
            `SELECT z.*, ST_AsGeoJSON(z.polygon) as polygon_json 
             FROM zones z WHERE z.id = $1`,
            [id]
        );
        if (result.rows[0]) {
            result.rows[0].polygon = result.rows[0].polygon_json ? JSON.parse(result.rows[0].polygon_json) : null;
        }
        return result.rows[0];
    }

    static async create(zone) {
        const { name, description, type, floor_id, polygon } = zone;
        const polygonJson = polygon ? (typeof polygon === 'string' ? polygon : JSON.stringify(polygon)) : null;
        const result = await pool.query(
            `INSERT INTO zones (name, description, type, floor_id, polygon)
             VALUES ($1, $2, $3, $4, CASE WHEN $5::text IS NULL THEN NULL ELSE ST_Multi(ST_GeomFromGeoJSON($5)) END)
             RETURNING *, ST_AsGeoJSON(polygon) as polygon_json`,
            [name, description, type || 'standard', floor_id, polygonJson]
        );
        if (result.rows[0]) {
            result.rows[0].polygon = result.rows[0].polygon_json ? JSON.parse(result.rows[0].polygon_json) : null;
        }
        return result.rows[0];
    }

    static async update(id, zone) {
        const { name, description, type, floor_id, polygon } = zone;
        const polygonJson = polygon ? (typeof polygon === 'string' ? polygon : JSON.stringify(polygon)) : null;
        const result = await pool.query(
            `UPDATE zones 
             SET name = $1, description = $2, type = $3, floor_id = $4, 
                 polygon = CASE WHEN $5::text IS NULL THEN polygon ELSE ST_Multi(ST_GeomFromGeoJSON($5)) END, 
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *, ST_AsGeoJSON(polygon) as polygon_json`,
            [name, description, type, floor_id, polygonJson, id]
        );
        if (result.rows[0]) {
            result.rows[0].polygon = result.rows[0].polygon_json ? JSON.parse(result.rows[0].polygon_json) : null;
        }
        return result.rows[0];
    }

    static async delete(id) {
        await pool.query('DELETE FROM zones WHERE id = $1', [id]);
        return true;
    }
}

export default Zone;
