import pool from '../../core/config/database.js';

class Ambulance {
  static async getAll() {
    try {
      // console.log('🔍 Récupération des ambulances...');

      // DEBUG: Vérifier toutes les ambulances d'abord
      const debugResult = await pool.query(
        `SELECT id, call_sign, status, is_active FROM ambulances ORDER BY call_sign`
      );
      // console.log(`🔍 DEBUG: Total ambulances dans la base: ${debugResult.rows.length}`);
      // debugResult.rows.forEach(amb => {
      //   console.log(`  - ${amb.id} (${amb.call_sign}): status=${amb.status}, is_active=${amb.is_active}`);
      // });

      // Requête complète avec toutes les colonnes maintenant disponibles
      const result = await pool.query(
        `SELECT 
         a.id, 
         a.call_sign, 
         a.license_plate, 
         a.status,
         a.current_lat, 
         a.current_lng, 
         a.current_address,
         a.crew_capacity, 
         a.equipment_level,
         a.last_maintenance, 
         a.next_maintenance, 
         a.is_active,
         a.created_at, 
         a.updated_at,
         a.imei_tablette,
         a.imei_gps,
         a.last_latitude,
         a.last_longitude,
         a.last_datetime,
         a.acc,
         COALESCE(
           ARRAY_AGG(
             CASE WHEN u.name IS NOT NULL 
             THEN json_build_object('name', u.name, 'role', ac.role)
             ELSE NULL END
           ) FILTER (WHERE u.name IS NOT NULL),
           ARRAY[]::json[]
         ) as crew
         FROM ambulances a
         LEFT JOIN ambulance_crew ac ON a.id = ac.ambulance_id AND ac.is_active = true
         LEFT JOIN users u ON ac.user_id = u.id
         WHERE 1=1  -- DEBUG: Afficher toutes les ambulances temporairement
         GROUP BY 
           a.id, a.call_sign, a.license_plate, a.status,
           a.current_lat, a.current_lng, a.current_address,
           a.crew_capacity, a.equipment_level,
           a.last_maintenance, a.next_maintenance, a.is_active,
           a.created_at, a.updated_at,
           a.imei_tablette, a.imei_gps,
           a.last_latitude, a.last_longitude, a.last_datetime, a.acc
         ORDER BY a.call_sign`
      );

      // Debug: vérifier les données retournées
      // console.log(`📊 Requête SQL réussie. Nombre de lignes retournées: ${result.rows ? result.rows.length : 0}`);

      if (result.rows && result.rows.length > 0) {
        // console.log('Première ambulance du modèle:', result.rows[0]);
        // console.log('imei_tablette dans le modèle:', result.rows[0].imei_tablette);
        // console.log(`Toutes les ambulances:`, result.rows.map(r => ({ id: r.id, call_sign: r.call_sign, status: r.status })));
      } else {
        // console.warn('⚠️ La requête SQL a réussi mais aucune ambulance n\'a été retournée');
      }

      return result.rows || [];
    } catch (error) {
      console.error('❌ Erreur SQL dans Ambulance.getAll():', error);
      console.error('Stack trace:', error.stack);
      throw new Error(`Error getting ambulances: ${error.message}`);
    }
  }

  static async updateLocation(id, lat, lng, address) {
    try {
      const result = await pool.query(
        `UPDATE ambulances 
         SET current_lat = $2, current_lng = $3, current_address = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 
         RETURNING *`,
        [id, lat, lng, address]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating ambulance location: ${error.message}`);
    }
  }

  static async updateStatus(id, status) {
    try {
      const result = await pool.query(
        `UPDATE ambulances 
         SET status = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 
         RETURNING *`,
        [id, status]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating ambulance status: ${error.message}`);
    }
  }

  static async getMissions(ambulanceId) {
    try {
      const result = await pool.query(
        'SELECT * FROM missions WHERE ambulance_id = $1 ORDER BY created_at DESC',
        [ambulanceId]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting missions: ${error.message}`);
    }
  }

  static async createMission(missionData) {
    const {
      id, ambulance_id, type, priority, patient_id,
      pickup_lat, pickup_lng, pickup_address,
      destination_lat, destination_lng, destination_address,
      destination_floor, estimated_arrival
    } = missionData;

    try {
      const result = await pool.query(
        `INSERT INTO missions (
          id, ambulance_id, type, priority, patient_id,
          pickup_lat, pickup_lng, pickup_address,
          destination_lat, destination_lng, destination_address,
          destination_floor, estimated_arrival
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          id, ambulance_id, type, priority, patient_id,
          pickup_lat, pickup_lng, pickup_address,
          destination_lat, destination_lng, destination_address,
          destination_floor, estimated_arrival
        ]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating mission: ${error.message}`);
    }
  }

  static async create(data) {
    const {
      call_sign, license_plate, status = 'available',
      crew_capacity = 3, equipment_level = 'basic',
      imei_tablette, imei_gps, is_active = true
    } = data;

    const id = Date.now().toString(); // Generate simple string ID

    try {
      const result = await pool.query(
        `INSERT INTO public.ambulances (
          id, call_sign, license_plate, status,
          crew_capacity, equipment_level,
          imei_tablette, imei_gps, is_active,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [id, call_sign, license_plate, status, crew_capacity, equipment_level, imei_tablette, imei_gps, is_active]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating ambulance: ${error.message}`);
    }
  }

  static async update(id, data) {
    const {
      call_sign, license_plate, status,
      crew_capacity, equipment_level,
      imei_tablette, imei_gps, is_active
    } = data;

    try {
      const result = await pool.query(
        `UPDATE public.ambulances 
         SET call_sign = $2, license_plate = $3, status = $4,
             crew_capacity = $5, equipment_level = $6,
             imei_tablette = $7, imei_gps = $8, is_active = $9,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 
         RETURNING *`,
        [id, call_sign, license_plate, status, crew_capacity, equipment_level, imei_tablette, imei_gps, is_active]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating ambulance: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      await pool.query('DELETE FROM public.ambulances WHERE id = $1', [id]);
      return true;
    } catch (error) {
      throw new Error(`Error deleting ambulance: ${error.message}`);
    }
  }
}

export default Ambulance;