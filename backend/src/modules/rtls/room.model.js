import pool from '../../core/config/database.js';

/**
 * Convert the frontend polygon string "((x1,y1),(x2,y2),...)" 
 * to PostGIS WKT format "POLYGON((x1 y1, x2 y2, ..., x1 y1))"
 * Returns null if input is empty/invalid.
 */
function toWKTPolygon(polygonStr) {
    if (!polygonStr || polygonStr === '' || polygonStr === 'null') return null;

    try {
        // Extract all (x,y) pairs from "((x1,y1),(x2,y2),...)"
        const pairs = [];
        const regex = /\((\-?\d+(?:\.\d+)?),(\-?\d+(?:\.\d+)?)\)/g;
        let match;
        while ((match = regex.exec(polygonStr)) !== null) {
            pairs.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
        }

        if (pairs.length < 3) return null;

        // Close the polygon (first point = last point) if not already closed
        if (pairs[0].x !== pairs[pairs.length - 1].x || pairs[0].y !== pairs[pairs.length - 1].y) {
            pairs.push(pairs[0]);
        }

        const coords = pairs.map(p => `${p.x} ${p.y}`).join(', ');
        return `POLYGON((${coords}))`;
    } catch (e) {
        console.error('[Room] Failed to parse polygon string:', e.message);
        return null;
    }
}

/**
 * Convert a PostGIS WKT polygon "POLYGON((x1 y1, x2 y2, ...))" 
 * back to the frontend format "((x1,y1),(x2,y2),...)"
 */
function fromWKTPolygon(wkt) {
    if (!wkt) return null;
    try {
        // Extract content inside POLYGON((...))
        const inner = wkt.replace(/^POLYGON\(\(/, '').replace(/\)\)$/, '');
        const pairs = inner.split(',').map(s => {
            const [x, y] = s.trim().split(/\s+/);
            return `(${x},${y})`;
        });
        return `(${pairs.join(',')})`;
    } catch (e) {
        return null;
    }
}

class Room {
    static async getAll(floorId = null) {
        try {
            let query = `
        SELECT r.id, r.room_number, r.floor_id, r.type, r.is_active, 
               r.created_at, r.updated_at, r.anchor_x, r.anchor_y,
               ST_AsGeoJSON(r.polygon) as polygon_json,
               f.name as floor_name
        FROM public.rooms r
        JOIN public.floors f ON r.floor_id = f.id
        WHERE 1=1
      `;
            const params = [];

            if (floorId !== null) {
                query += ' AND r.floor_id = $1';
                params.push(floorId);
            }

            query += ' ORDER BY r.floor_id, r.room_number';

            const result = await pool.query(query, params);
            // Convert GeoJSON back to object
            result.rows = result.rows.map(row => ({
                ...row,
                polygon: row.polygon_json ? JSON.parse(row.polygon_json) : null
            }));
            return result.rows;
        } catch (error) {
            throw new Error(`Error getting rooms: ${error.message}`);
        }
    }

    static async getById(id) {
        try {
            const result = await pool.query(
                `SELECT r.id, r.room_number, r.floor_id, r.type, r.is_active, 
                        r.created_at, r.updated_at, r.anchor_x, r.anchor_y,
                        ST_AsGeoJSON(r.polygon) as polygon_json,
                        f.name as floor_name
         FROM public.rooms r
         JOIN public.floors f ON r.floor_id = f.id
         WHERE r.id = $1`,
                [id]
            );
            if (result.rows[0]) {
                result.rows[0].polygon = result.rows[0].polygon_json ? JSON.parse(result.rows[0].polygon_json) : null;
            }
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error getting room: ${error.message}`);
        }
    }

    static async create(room) {
        try {
            const { room_number, floor_id, type = 'standard', is_active = true, polygon = null } = room;

            let result;
            if (polygon) {
                const polygonJson = typeof polygon === 'string' ? polygon : JSON.stringify(polygon);
                result = await pool.query(
                    `INSERT INTO public.rooms (room_number, floor_id, type, is_active, polygon, 
                            anchor_x, anchor_y, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, ST_Multi(ST_GeomFromGeoJSON($5)), 
                            ST_X(ST_Centroid(ST_GeomFromGeoJSON($5))), 
                            ST_Y(ST_Centroid(ST_GeomFromGeoJSON($5))),
                            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                     RETURNING *, ST_AsGeoJSON(polygon) as polygon_json`,
                    [room_number, floor_id, type, is_active, polygonJson]
                );
                result.rows[0].polygon = result.rows[0].polygon_json ? JSON.parse(result.rows[0].polygon_json) : null;
            } else {
                result = await pool.query(
                    `INSERT INTO public.rooms (room_number, floor_id, type, is_active, polygon, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                     RETURNING *`,
                    [room_number, floor_id, type, is_active]
                );
            }
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error creating room: ${error.message}`);
        }
    }

    static async update(id, room) {
        try {
            const { room_number, floor_id, type, is_active, polygon } = room;

            let result;
            if (polygon) {
                const polygonJson = typeof polygon === 'string' ? polygon : JSON.stringify(polygon);
                result = await pool.query(
                    `UPDATE public.rooms 
                     SET room_number = COALESCE($2, room_number), 
                         floor_id = COALESCE($3, floor_id), 
                         type = COALESCE($4, type), 
                         is_active = COALESCE($5, is_active), 
                         polygon = ST_Multi(ST_GeomFromGeoJSON($6)),
                         anchor_x = ST_X(ST_Centroid(ST_GeomFromGeoJSON($6))),
                         anchor_y = ST_Y(ST_Centroid(ST_GeomFromGeoJSON($6))),
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1 
                     RETURNING *, ST_AsGeoJSON(polygon) as polygon_json`,
                    [id, room_number, floor_id, type, is_active, polygonJson]
                );
                result.rows[0].polygon = result.rows[0].polygon_json ? JSON.parse(result.rows[0].polygon_json) : null;
            } else {
                result = await pool.query(
                    `UPDATE public.rooms 
                     SET room_number = COALESCE($2, room_number), 
                         floor_id = COALESCE($3, floor_id), 
                         type = COALESCE($4, type), 
                         is_active = COALESCE($5, is_active), 
                         polygon = NULL,
                         anchor_x = NULL,
                         anchor_y = NULL,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1 
                     RETURNING *`,
                    [id, room_number, floor_id, type, is_active]
                );
            }
            return result.rows[0];
        } catch (error) {
            throw new Error(`Error updating room: ${error.message}`);
        }
    }

    static async delete(id) {
        try {
            await pool.query('DELETE FROM rooms WHERE id = $1', [id]);
            return true;
        } catch (error) {
            throw new Error(`Error deleting room: ${error.message}`);
        }
    }
}

export default Room;
