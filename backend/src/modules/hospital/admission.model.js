
import pool from '../../core/config/database.js';

class Admission {
    static async list({ limit = 100, offset = 0, search = null } = {}) {
        let query = `
            SELECT adm.*, a.last_seen as rtls_last_seen
            FROM admissions adm
            LEFT JOIN assets a ON REPLACE(LOWER(adm.mac_rtls), ':', '') = LOWER(a.id)
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (search) {
            query += ` AND (adm.nom ILIKE $${paramIndex} OR adm.prenom ILIKE $${paramIndex} OR adm.numero_chambre ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ' ORDER BY adm.date_admission DESC';
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        return result.rows;
    }

    static async count({ search = null } = {}) {
        let query = 'SELECT COUNT(*) FROM admissions WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (search) {
            query += ` AND (nom ILIKE $${paramIndex} OR prenom ILIKE $${paramIndex} OR numero_chambre ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        const result = await pool.query(query, params);
        return parseInt(result.rows[0].count);
    }

    static async create(data) {
        const {
            numero_dossier, nom, prenom, sexe, date_admission, etage,
            numero_chambre, medecin_traitant, mac_rtls, episode_id, date_naissance
        } = data;

        const result = await pool.query(
            `INSERT INTO admissions (
        numero_dossier, nom, prenom, sexe, date_admission, etage,
        numero_chambre, medecin_traitant, mac_rtls, episode_id, date_naissance
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
            [numero_dossier, nom, prenom, sexe, date_admission, etage, numero_chambre, medecin_traitant, mac_rtls, episode_id, date_naissance]
        );
        return result.rows[0];
    }

    static async update(id, data) {
        const {
            numero_dossier, nom, prenom, sexe, date_admission, etage,
            numero_chambre, medecin_traitant, mac_rtls, episode_id, date_naissance
        } = data;

        const result = await pool.query(
            `UPDATE admissions SET
        numero_dossier = $1, nom = $2, prenom = $3, sexe = $4, date_admission = $5,
        etage = $6, numero_chambre = $7, medecin_traitant = $8, mac_rtls = $9, episode_id = $11,
        date_naissance = $12, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *`,
            [numero_dossier, nom, prenom, sexe, date_admission, etage, numero_chambre, medecin_traitant, mac_rtls, id, episode_id, date_naissance]
        );
        return result.rows[0] || null;
    }

    static async delete(id) {
        const result = await pool.query('DELETE FROM admissions WHERE id = $1 RETURNING id', [id]);
        return result.rowCount > 0;
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM admissions WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async findByNumeroDossier(numero_dossier) {
        const result = await pool.query('SELECT * FROM admissions WHERE numero_dossier = $1', [numero_dossier]);
        return result.rows[0] || null;
    }
}

export default Admission;
