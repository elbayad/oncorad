import pool from '../../core/config/database.js';

class RtlsAssignment {
    static async create({ assetId, episodeId }) {
        // Ensure no other active assignment exists for this asset
        await this.end(assetId);

        const result = await pool.query(
            `INSERT INTO rtls_assignments (asset_id, episode_id, started_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       RETURNING *`,
            [assetId, episodeId]
        );
        return result.rows[0];
    }

    static async end(assetId) {
        const result = await pool.query(
            `UPDATE rtls_assignments 
       SET ended_at = CURRENT_TIMESTAMP
       WHERE asset_id = $1 AND ended_at IS NULL
       RETURNING *`,
            [assetId]
        );
        return result.rows[0];
    }

    static async findActive(assetId) {
        const result = await pool.query(
            `SELECT * FROM rtls_assignments 
       WHERE asset_id = $1 AND ended_at IS NULL`,
            [assetId]
        );
        return result.rows[0];
    }
}

export default RtlsAssignment;
