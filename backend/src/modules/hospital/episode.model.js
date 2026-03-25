import pool from '../../core/config/database.js';

class Episode {
    static async create({ context, status = 'active' }) {
        const result = await pool.query(
            `INSERT INTO episodes (context, status, started_at, created_at, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
            [context, status]
        );
        return result.rows[0];
    }

    static async close(id) {
        const result = await pool.query(
            `UPDATE episodes 
       SET status = 'closed', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
            [id]
        );
        return result.rows[0];
    }

    static async update(id, data) {
        const { intervention_title, intervention_time, protocol_op, dicom_link, consent_received } = data;
        const result = await pool.query(
            `UPDATE episodes 
       SET intervention_title = COALESCE($2, intervention_title),
           intervention_time  = COALESCE($3, intervention_time),
           protocol_op        = COALESCE($4, protocol_op),
           dicom_link         = COALESCE($5, dicom_link),
           consent_received   = COALESCE($6, consent_received),
           updated_at         = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
            [id, intervention_title, intervention_time, protocol_op, dicom_link, consent_received]
        );
        return result.rows[0];
    }

    static async findActiveByAsset(assetId) {
        const result = await pool.query(
            `SELECT e.* 
       FROM episodes e
       JOIN rtls_assignments ra ON e.id = ra.episode_id
       WHERE ra.asset_id = $1 
         AND ra.ended_at IS NULL
         AND e.status = 'active'
       LIMIT 1`,
            [assetId]
        );
        return result.rows[0];
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM episodes WHERE id = $1', [id]);
        return result.rows[0];
    }
}

export default Episode;
