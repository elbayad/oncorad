import pool from '../../core/config/database.js';

class Module {
  static async getAll() {
    try {
      const result = await pool.query(
        'SELECT * FROM modules WHERE is_active = true ORDER BY name'
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting modules: ${error.message}`);
    }
  }

  static async grantModuleToUser(userId, moduleId, grantedBy) {
    try {
      const result = await pool.query(
        `INSERT INTO user_modules (user_id, module_id, granted_by) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (user_id, module_id) DO NOTHING
         RETURNING *`,
        [userId, moduleId, grantedBy]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error granting module: ${error.message}`);
    }
  }

  static async revokeModuleFromUser(userId, moduleId) {
    try {
      await pool.query(
        'DELETE FROM user_modules WHERE user_id = $1 AND module_id = $2',
        [userId, moduleId]
      );
      return true;
    } catch (error) {
      throw new Error(`Error revoking module: ${error.message}`);
    }
  }

  static async getUserPermissions(userId) {
    try {
      const result = await pool.query(
        `SELECT 
          u.id as user_id,
          u.name as user_name,
          u.email,
          u.role,
          u.floor_access,
          m.id as module_id,
          m.name as module_name,
          um.granted_at
         FROM users u
         LEFT JOIN user_modules um ON u.id = um.user_id
         LEFT JOIN modules m ON um.module_id = m.id
         WHERE u.id = $1 AND u.is_active = true`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting user permissions: ${error.message}`);
    }
  }
}

export default Module;