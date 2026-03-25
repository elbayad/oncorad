import pool from '../../core/config/database.js';

class Floor {
  static async getAll() {
    try {
      const result = await pool.query(
        'SELECT id, name, description, plan, ST_AsGeoJSON(corridor) as corridor, ST_AsGeoJSON(trajet) as trajet, is_active FROM floors WHERE is_active = true ORDER BY id'
      );
      return result.rows.map(row => ({
        ...row,
        corridor: row.corridor ? JSON.parse(row.corridor) : null,
        trajet: row.trajet ? JSON.parse(row.trajet) : null
      }));
    } catch (error) {
      throw new Error(`Error getting floors: ${error.message}`);
    }
  }

  static async getById(id) {
    try {
      const result = await pool.query(
        'SELECT id, name, description, plan, ST_AsGeoJSON(corridor) as corridor, ST_AsGeoJSON(trajet) as trajet, is_active FROM floors WHERE id = $1 AND is_active = true',
        [id]
      );
      if (result.rows[0]) {
        result.rows[0].corridor = result.rows[0].corridor ? JSON.parse(result.rows[0].corridor) : null;
        result.rows[0].trajet = result.rows[0].trajet ? JSON.parse(result.rows[0].trajet) : null;
      }
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error getting floor: ${error.message}`);
    }
  }
  static async create(floor) {
    try {
      const { name, description, plan, corridor, trajet, is_active = true } = floor;
      const result = await pool.query(
        `INSERT INTO floors (name, description, plan, corridor, trajet, is_active)
         VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4), ST_GeomFromGeoJSON($5), $6)
         RETURNING id, name, description, plan, ST_AsGeoJSON(corridor) as corridor, ST_AsGeoJSON(trajet) as trajet, is_active`,
        [name, description, plan, corridor ? JSON.stringify(corridor) : null, trajet ? JSON.stringify(trajet) : null, is_active]
      );
      if (result.rows[0]) {
        result.rows[0].corridor = result.rows[0].corridor ? JSON.parse(result.rows[0].corridor) : null;
        result.rows[0].trajet = result.rows[0].trajet ? JSON.parse(result.rows[0].trajet) : null;
      }
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating floor: ${error.message}`);
    }
  }

  static async update(id, floor) {
    try {
      const { name, description, plan, corridor, trajet, is_active } = floor;
      const result = await pool.query(
        `UPDATE floors 
         SET name = $2, description = $3, plan = $4, 
             corridor = CASE WHEN $5::text IS NULL THEN corridor ELSE ST_GeomFromGeoJSON($5) END,
             trajet = CASE WHEN $6::text IS NULL THEN trajet ELSE ST_GeomFromGeoJSON($6) END,
             is_active = $7
         WHERE id = $1 
         RETURNING id, name, description, plan, ST_AsGeoJSON(corridor) as corridor, ST_AsGeoJSON(trajet) as trajet, is_active`,
        [id, name, description, plan, corridor ? JSON.stringify(corridor) : null, trajet ? JSON.stringify(trajet) : null, is_active]
      );
      if (result.rows[0]) {
        result.rows[0].corridor = result.rows[0].corridor ? JSON.parse(result.rows[0].corridor) : null;
        result.rows[0].trajet = result.rows[0].trajet ? JSON.parse(result.rows[0].trajet) : null;
      }
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating floor: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      // Logic deletion primarily, or checking if it has child items before hard delete
      // Assuming soft delete via is_active = false for safety, or hard delete if requested.
      // Let's implement hard delete but database constraints (rooms FK) will block if not empty,
      // unless we cascade or clear rooms. The implementation plan suggested manage Delete.
      await pool.query('DELETE FROM floors WHERE id = $1', [id]);
      return true;
    } catch (error) {
      throw new Error(`Error deleting floor: ${error.message}`);
    }
  }
}

export default Floor;
