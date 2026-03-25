import pool from '../../core/config/database.js';

class Tuning {
    static async getAnchorTuning(floorId) {
        const sql = `
            SELECT * FROM rtls_room_anchor_tuning 
            WHERE floor_id = $1 AND enabled = TRUE
        `;
        const res = await pool.query(sql, [floorId]);
        return res.rows;
    }

    static async upsertAnchorTuning(data) {
        const {
            floor_id, room_id, anchor_mac,
            proximity_bonus = 0, score_bonus = 0,
            ownership_bonus = 0, primary_bonus = 0,
            bleed_penalty = 0, force_mapped_room = false
        } = data;

        const sql = `
            INSERT INTO rtls_room_anchor_tuning 
            (floor_id, room_id, anchor_mac, proximity_bonus, score_bonus, ownership_bonus, primary_bonus, bleed_penalty, force_mapped_room, enabled, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW())
            ON CONFLICT (floor_id, room_id, anchor_mac) 
            DO UPDATE SET 
                proximity_bonus = EXCLUDED.proximity_bonus,
                score_bonus = EXCLUDED.score_bonus,
                ownership_bonus = EXCLUDED.ownership_bonus,
                primary_bonus = EXCLUDED.primary_bonus,
                bleed_penalty = EXCLUDED.bleed_penalty,
                force_mapped_room = EXCLUDED.force_mapped_room,
                updated_at = NOW()
            RETURNING *
        `;
        const res = await pool.query(sql, [
            floor_id, room_id, anchor_mac.toLowerCase(),
            proximity_bonus, score_bonus, ownership_bonus, primary_bonus, bleed_penalty, force_mapped_room
        ]);
        return res.rows[0];
    }
}

export default Tuning;
