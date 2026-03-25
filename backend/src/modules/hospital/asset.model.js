import pool from '../../core/config/database.js';

class Asset {
  static async getById(id) {
    try {
      const result = await pool.query(
        `SELECT a.*, at.name as type_name, at.icon, at.color, at.id_categorie as id_categorie, ac.categorie as category_name, f.name as floor_name
         FROM assets a
         LEFT JOIN asset_types at ON a.type_id::text = at.id::text
         LEFT JOIN asset_categories ac ON at.id_categorie = ac.id
         LEFT JOIN floors f ON a.floor_id = f.id
         WHERE a.id = $1`,
        [id]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error getting asset by ID: ${error.message}`);
    }
  }

  static async getAll(floorId = null, typeId = null) {
    try {
      let query = `
        SELECT a.*, at.name as type_name, at.icon, at.color, at.id_categorie as id_categorie, ac.categorie as category_name, f.name as floor_name
        FROM assets a
        LEFT JOIN asset_types at ON a.type_id::text = at.id::text
        LEFT JOIN asset_categories ac ON at.id_categorie = ac.id
        LEFT JOIN floors f ON a.floor_id = f.id
        WHERE 1=1
      `;
      const params = [];

      if (floorId) {
        params.push(floorId);
        query += ` AND a.floor_id = $${params.length}`;
      }

      if (typeId) {
        params.push(typeId);
        if (isNaN(typeId)) {
          query += ` AND (LOWER(a.type_id::text) = LOWER($${params.length}) OR LOWER(at.name) = LOWER($${params.length}))`;
        } else {
          query += ` AND (a.type_id::text = $${params.length}::text OR LOWER(at.name) = LOWER($${params.length}::text))`;
        }
      }

      query += ' ORDER BY a.name';

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting assets: ${error.message}`);
    }
  }

  static async updateLocation(id, floorId, zone, x, y, lastRoomId = null, shouldLogHistory = true, lastPos = null) {
    try {
      const result = await pool.query(
        `UPDATE assets 
         SET floor_id = $2, zone = $3, last_pos = $7, coordinates_x = $4, coordinates_y = $5, 
             last_room_id = $6, status = 'active',
             last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 
         RETURNING *`,
        [id, floorId, zone, x, y, lastRoomId, lastPos]
      );

      // Add to tracking history ONLY if asset was found and updated AND history logging is enabled
      if (result.rowCount > 0 && result.rows.length > 0 && shouldLogHistory) {
        await pool.query(
          `INSERT INTO asset_tracking_history (asset_id, floor_id, zone, coordinates_x, coordinates_y)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, floorId, zone, x, y]
        );
      }

      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error updating asset location: ${error.message}`);
    }
  }

  static async getTrackingHistory(assetId, start = null, end = null, limit = 1000) {
    try {
      let query = `
        SELECT ath.*, f.name as floor_name
        FROM asset_tracking_history ath
        LEFT JOIN floors f ON ath.floor_id = f.id
        WHERE ath.asset_id = $1
      `;
      const params = [assetId];

      if (start) {
        params.push(start);
        query += ` AND ath.timestamp >= $${params.length}`;
      }

      if (end) {
        params.push(end);
        query += ` AND ath.timestamp <= $${params.length}`;
      }

      query += ` ORDER BY ath.timestamp ASC`; // Chronological order for replay

      // Only apply limit if no date range is specified, to avoid cutting off replay
      if (!start && !end) {
        params.push(limit);
        query += ` LIMIT $${params.length}`;
      }

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting tracking history: ${error.message}`);
    }
  }

  static async getZoneMovementHistory(assetId, start, end) {
    try {
      const query = `
        WITH SpatialHistory AS (
          -- Associer chaque point à une zone réelle via ST_Within
          SELECT 
            ath.timestamp,
            ath.coordinates_x,
            ath.coordinates_y,
            z.name as zone_name
          FROM asset_tracking_history ath
          JOIN zones z ON ST_Within(
            ST_SetSRID(ST_Point(ath.coordinates_x, ath.coordinates_y), ST_SRID(z.polygon)), 
            z.polygon
          )
          WHERE ath.asset_id = $1 
            AND ath.timestamp >= $2 
            AND ath.timestamp <= $3
            AND ath.floor_id = z.floor_id
        ),
        OrderedHistory AS (
          SELECT 
            zone_name as zone,
            timestamp,
            coordinates_x,
            coordinates_y,
            LAG(zone_name) OVER (ORDER BY timestamp) as prev_zone
          FROM SpatialHistory
        ),
        ZoneChanges AS (
          SELECT 
            zone,
            timestamp as entry_time,
            coordinates_x,
            coordinates_y,
            CASE WHEN zone IS DISTINCT FROM prev_zone THEN 1 ELSE 0 END as is_new_zone
          FROM OrderedHistory
        ),
        GroupedZones AS (
          SELECT 
            zone,
            entry_time,
            coordinates_x,
            coordinates_y,
            SUM(is_new_zone) OVER (ORDER BY entry_time) as zone_group
          FROM ZoneChanges
        )
        SELECT 
          zone,
          GREATEST(MIN(entry_time), $2::timestamp) as entry_time,
          LEAST(LEAD(MIN(entry_time)) OVER (ORDER BY MIN(entry_time)), $3::timestamp) as exit_time,
          (ARRAY_AGG(coordinates_x ORDER BY entry_time))[1] as entry_x,
          (ARRAY_AGG(coordinates_y ORDER BY entry_time))[1] as entry_y
        FROM GroupedZones
        GROUP BY zone_group, zone
        ORDER BY entry_time DESC
      `;
      const result = await pool.query(query, [assetId, start, end]);

      const rows = result.rows.map((row) => ({
        zone: row.zone,
        entry_time: row.entry_time,
        exit_time: row.exit_time || end,
        coordinates: {
          x: row.entry_x,
          y: row.entry_y
        }
      }));

      return rows;
    } catch (error) {
      throw new Error(`Error getting spatial zone movement history: ${error.message}`);
    }
  }

  static async updateBatteryLevel(id, batteryLevel) {
    try {
      const result = await pool.query(
        `UPDATE assets 
         SET battery_level = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 
         RETURNING *`,
        [id, batteryLevel]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating battery level: ${error.message}`);
    }
  }

  static async searchByName(query) {
    try {
      const result = await pool.query(
        `SELECT a.*, at.name as type_name, at.icon, at.color, at.id_categorie as id_categorie, ac.categorie as category_name, f.name as floor_name, f.id as floor_id
         FROM assets a
         LEFT JOIN asset_types at ON a.type_id::text = at.id::text
         LEFT JOIN asset_categories ac ON at.id_categorie = ac.id
         LEFT JOIN floors f ON a.floor_id = f.id
         WHERE LOWER(a.name) LIKE LOWER($1) OR LOWER(a.id) LIKE LOWER($1)
         ORDER BY a.name
         LIMIT 10`,
        [`%${query}%`]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error searching assets: ${error.message}`);
    }
  }
  static async create(asset) {
    try {
      const { id, name, type_id, category = 'person', floor_id = 1, status = 'active', room = null } = asset;

      // If ID is provided (e.g. MAC address), use it. Otherwise generate random.
      let finalId = id;
      if (!finalId) {
        // Fallback to random hex
        const rnd = await pool.query("SELECT encode(gen_random_bytes(6), 'hex') as val");
        finalId = rnd.rows[0].val;
      }

      const result = await pool.query(
        `INSERT INTO assets (id, name, type_id, category, floor_id, status, room, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [finalId, name, type_id, category, floor_id, status, room]
      );
      return result.rows[0];
    } catch (error) {
      // Fallback for ID generation if gen_random_bytes not available (older PG) or just standard UUID
      try {
        const result = await pool.query(
          `INSERT INTO assets (name, type_id, category, floor_id, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING *`,
          [name, type_id, category, floor_id, status]
        );
        return result.rows[0];
      } catch (e) {
        throw new Error(`Error creating asset: ${error.message}`);
      }
    }
  }

  static async updateDetails(id, asset) {
    try {
      const { name, type_id, category, floor_id, status, room } = asset;
      const result = await pool.query(
        `UPDATE assets 
         SET name = $2, type_id = $3, category = $4, floor_id = $5, status = $6, room = $7, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 
         RETURNING *`,
        [id, name, type_id, category, floor_id, status, room]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating asset details: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      await pool.query('DELETE FROM assets WHERE id = $1', [id]);
      return true;
    } catch (error) {
      throw new Error(`Error deleting asset: ${error.message}`);
    }
  }

  static async markInactiveAssets(thresholdSeconds = 300) {
    try {
      // Set status to 'offline' if last_seen is older than threshold AND status is not already offline
      const result = await pool.query(
        `UPDATE assets 
         SET status = 'offline' 
         WHERE last_seen < NOW() - make_interval(secs => $1) 
           AND status != 'offline'
         RETURNING *`,
        [thresholdSeconds]
      );
      return result.rows;
    } catch (error) {
      console.error(`Error marking inactive assets: ${error.message}`);
      return [];
    }
  }
  static async upsertFromMac(mac, name, floorId = 1) {
    if (!mac) return null;

    try {
      // Clean MAC address
      const assetId = mac.trim();

      // Check if exists
      const existing = await pool.query('SELECT * FROM assets WHERE id = $1', [assetId]);

      if (existing.rows.length > 0) {
        // Update existing
        const result = await pool.query(
          `UPDATE assets 
           SET name = $2, type_id = 4, category = 2, floor_id = $3, status = 'active', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 
           RETURNING *`,
          [assetId, name, floorId]
        );
        return result.rows[0];
      } else {
        // Create new
        const result = await pool.query(
          `INSERT INTO assets (id, name, type_id, category, floor_id, status, created_at, updated_at)
           VALUES ($1, $2, 4, 2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING *`,
          [assetId, name, floorId]
        );
        return result.rows[0];
      }
    } catch (error) {
      console.error(`Error upserting asset from MAC: ${error.message}`);
      // Don't throw, just log/return null to avoid blocking main flow
      return null;
    }
  }
  static async getTypes() {
    try {
      const result = await pool.query(`
        SELECT at.*, ac.categorie as category_name 
        FROM asset_types at
        LEFT JOIN asset_categories ac ON at.id_categorie = ac.id
        ORDER BY at.name
      `);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting asset types: ${error.message}`);
    }
  }

  static async createType(type) {
    try {
      const { id, name, description, icon, color, id_categorie } = type;
      const result = await pool.query(
        `INSERT INTO asset_types (id, name, description, icon, color, id_categorie)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, name, description, icon, color, id_categorie]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating asset type: ${error.message}`);
    }
  }

  static async updateType(id, type) {
    try {
      const { name, description, icon, color, id_categorie } = type;
      const result = await pool.query(
        `UPDATE asset_types 
         SET name = $2, description = $3, icon = $4, color = $5, id_categorie = $6
         WHERE id = $1 
         RETURNING *`,
        [id, name, description, icon, color, id_categorie]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating asset type: ${error.message}`);
    }
  }

  static async deleteType(id) {
    try {
      await pool.query('DELETE FROM asset_types WHERE id = $1', [id]);
      return true;
    } catch (error) {
      throw new Error(`Error deleting asset type: ${error.message}`);
    }
  }

  static async getCategories() {
    try {
      const result = await pool.query('SELECT * FROM asset_categories ORDER BY categorie');
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting asset categories: ${error.message}`);
    }
  }

  static async createCategory(category) {
    try {
      const { categorie } = category;
      const result = await pool.query(
        'INSERT INTO asset_categories (categorie) VALUES ($1) RETURNING *',
        [categorie]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating asset category: ${error.message}`);
    }
  }

  static async updateCategory(id, category) {
    try {
      const { categorie } = category;
      const result = await pool.query(
        'UPDATE asset_categories SET categorie = $2 WHERE id = $1 RETURNING *',
        [id, categorie]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating asset category: ${error.message}`);
    }
  }

  static async deleteCategory(id) {
    try {
      await pool.query('DELETE FROM asset_categories WHERE id = $1', [id]);
      return true;
    } catch (error) {
      throw new Error(`Error deleting asset category: ${error.message}`);
    }
  }
}


export default Asset;