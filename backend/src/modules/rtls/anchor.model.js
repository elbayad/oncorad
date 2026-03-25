import pool from '../../core/config/database.js';

class Anchor {
    static async getAll() {
        try {
            // Map capteurs columns to Anchor model expected fields
            const result = await pool.query(
                `SELECT id as mac, name, floor_id, coordinates_x as x, coordinates_y as y, 
                        CASE WHEN status = 'active' THEN true ELSE false END as is_active,
                        last_seen, lastcompt, nbsec, onoff, door_room_id
                 FROM capteurs 
                 WHERE status = 'active' 
                 ORDER BY id`
            );
            return result.rows;
        } catch (error) {
            throw new Error(`Error getting anchors from capteurs: ${error.message}`);
        }
    }

    static async getById(id) {
        try {
            // In capteurs, id IS the mac address
            const result = await pool.query(
                `SELECT id as mac, name, floor_id, coordinates_x as x, coordinates_y as y,
                        CASE WHEN status = 'active' THEN true ELSE false END as is_active,
                        last_seen, lastcompt, nbsec, onoff, door_room_id
                 FROM capteurs 
                 WHERE id = $1 AND status = 'active'`,
                [id]
            );
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error getting anchor: ${error.message}`);
        }
    }

    // ... (getByMac, create, update methods also ideally need update but skipping for brevity if not strictly used in loop)

    static async updateStatus(mac, lastSeen, lastCompt, nbSec = null, onOff = false) {
        const query = `
        UPDATE public.capteurs 
        SET 
            nbsec = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(last_seen, CURRENT_TIMESTAMP)))::int,
            onoff = (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(last_seen, CURRENT_TIMESTAMP))) <= 120),
            last_seen = CURRENT_TIMESTAMP,
            lastcompt = $2
        WHERE id = $1
      `;
        try {
            await pool.query(query, [mac, lastCompt]);
            return true;
        } catch (err) {
            console.error(`Error updating anchor status ${mac}:`, err);
            return false;
        }
    }

    static async getByMac(mac) {
        try {
            // In capteurs, id IS the mac address
            const result = await pool.query(
                `SELECT id as mac, name, floor_id, coordinates_x as x, coordinates_y as y,
                        CASE WHEN status = 'active' THEN true ELSE false END as is_active,
                        last_seen, door_room_id
                 FROM capteurs 
                 WHERE LOWER(id) = LOWER($1) AND status = 'active'`,
                [mac]
            );
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error getting anchor by MAC: ${error.message}`);
        }
    }

    static async create(anchor) {
        try {
            // Helper to create in capteurs (assuming type_id 'Moko' for anchors)
            const { mac, name, floor_id, x, y, is_active = true, door_room_id = null } = anchor;
            const status = is_active ? 'active' : 'inactive';

            const result = await pool.query(
                `INSERT INTO capteurs (id, name, floor_id, coordinates_x, coordinates_y, status, type_id, door_room_id, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, 'Moko', $7, NOW(), NOW())
                 RETURNING id as mac, name, floor_id, coordinates_x as x, coordinates_y as y, door_room_id`,
                [mac, name, floor_id, x, y, status, door_room_id]
            );
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error creating anchor in capteurs: ${error.message}`);
        }
    }

    static async update(id, anchor) {
        try {
            const { mac, name, floor_id, x, y, is_active, door_room_id } = anchor;
            // Note: id argument is the current MAC (PK)

            let updateFields = ['name = $2', 'floor_id = $3', 'coordinates_x = $4', 'coordinates_y = $5', 'updated_at = NOW()'];
            const params = [id, name, floor_id, x, y];
            let paramIdx = 6;

            if (is_active !== undefined) {
                params.push(is_active ? 'active' : 'inactive');
                updateFields.push(`status = $${paramIdx}`);
                paramIdx++;
            }

            if (door_room_id !== undefined) {
                params.push(door_room_id);
                updateFields.push(`door_room_id = $${paramIdx}`);
                paramIdx++;
            }

            const result = await pool.query(
                `UPDATE capteurs 
                 SET ${updateFields.join(', ')}
                 WHERE id = $1 
                 RETURNING id as mac, name, floor_id, coordinates_x as x, coordinates_y as y, door_room_id`,
                params
            );
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error updating anchor in capteurs: ${error.message}`);
        }
    }

    static async delete(id) {
        try {
            await pool.query('DELETE FROM capteurs WHERE id = $1', [id]);
            return true;
        } catch (error) {
            throw new Error(`Error deleting anchor from capteurs: ${error.message}`);
        }
    }

    static async markInactiveAnchors(thresholdSeconds = 120) {
        try {
            const result = await pool.query(
                `UPDATE capteurs 
                 SET onoff = false 
                 WHERE last_seen < NOW() - make_interval(secs => $1) 
                   AND onoff != false
                 RETURNING id`,
                [thresholdSeconds]
            );
            return result.rows;
        } catch (error) {
            console.error(`Error marking inactive anchors: ${error.message}`);
            return [];
        }
    }
}

export default Anchor;
