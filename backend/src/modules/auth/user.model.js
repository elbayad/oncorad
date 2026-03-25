import pool from '../../core/config/database.js';
import bcrypt from 'bcryptjs';

class User {
  static async findByEmail(email) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error finding user: ${error.message}`);
    }
  }

  static async findById(id) {
    try {
      // Handle mock admin/dev user
      if (id === '1' || id === '59c2caf0-a109-4be4-98c3-4e617753bc9a') {
        return {
          id: '59c2caf0-a109-4be4-98c3-4e617753bc9a',
          email: 'admin@clinic.com',
          name: 'Administrateur Système',
          role: 'admin',
          is_active: true
        };
      }

      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1 AND is_active = true',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error finding user by ID: ${error.message}`);
    }
  }

  static async create(userData) {
    const { email, password, name, role, floor_access = 0 } = userData;

    try {
      const hashedPassword = await bcrypt.hash(password, 12);

      const result = await pool.query(
        `INSERT INTO users (email, password_hash, name, role, floor_access) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, email, name, role, floor_access, created_at`,
        [email, hashedPassword, name, role, floor_access]
      );

      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  static async update(id, userData) {
    const { name, role, floor_access, is_active } = userData;

    try {
      const result = await pool.query(
        `UPDATE users 
         SET name = $2, role = $3, floor_access = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 
         RETURNING id, email, name, role, floor_access, is_active`,
        [id, name, role, floor_access, is_active]
      );

      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      await pool.query('UPDATE users SET is_active = false WHERE id = $1', [id]);
      return true;
    } catch (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  }

  static async getAll() {
    try {
      const result = await pool.query(
        `SELECT u.id, u.email, u.name, u.role, u.floor_access, u.is_active, u.last_login, u.created_at,
                COALESCE(array_agg(um.module_id) FILTER (WHERE um.module_id IS NOT NULL), '{}') as modules
         FROM users u
         LEFT JOIN user_modules um ON u.id = um.user_id
         GROUP BY u.id
         ORDER BY u.created_at DESC`
      );

      const users = result.rows;

      // Add mock admin if not in DB and we are in dev/mock mode
      if (!users.find(u => u.email === 'admin@clinic.com')) {
        users.push({
          id: '59c2caf0-a109-4be4-98c3-4e617753bc9a',
          email: 'admin@clinic.com',
          name: 'Administrateur Système',
          role: 'admin',
          floor_access: 0,
          is_active: true,
          last_login: new Date(),
          created_at: new Date(),
          modules: ['admin', 'ambutrack', 'floortrace', 'admission', 'energypulse', 'airguard', 'oxyflow', 'dossier-patient', 'reporting']
        });
      }

      return users;
    } catch (error) {
      throw new Error(`Error getting users: ${error.message}`);
    }
  }

  static async getUserModules(userId) {
    try {
      // Handle mock admin/dev user
      if (userId === '1' || userId === '59c2caf0-a109-4be4-98c3-4e617753bc9a') {
        return [
          { id: 'admin', name: 'Administration' },
          { id: 'ambutrack', name: 'Ambulances' },
          { id: 'floortrace', name: 'Géolocalisation' },
          { id: 'admission', name: 'Admission' },
          { id: 'energypulse', name: 'Surveillance Énergétique' },
          { id: 'airguard', name: "Qualité de l'Air" },
          { id: 'oxyflow', name: 'Surveillance Oxygène' },
          { id: 'dossier-patient', name: 'Dossier Patient' },
          { id: 'reporting', name: 'Reporting Global' }
        ];
      }

      const result = await pool.query(
        `SELECT m.id, m.name, m.description, m.icon, m.color
         FROM modules m
         JOIN user_modules um ON m.id = um.module_id
         WHERE um.user_id = $1 AND m.is_active = true`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting user modules: ${error.message}`);
    }
  }

  static async updateLastLogin(id) {
    try {
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async updatePassword(id, password) {
    try {
      // Handle mock admin/dev user
      if (id === '1' || id === '59c2caf0-a109-4be4-98c3-4e617753bc9a') {
        return true;
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      await pool.query(
        'UPDATE users SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id, hashedPassword]
      );
      return true;
    } catch (error) {
      throw new Error(`Error updating password: ${error.message}`);
    }
  }
}

export default User;