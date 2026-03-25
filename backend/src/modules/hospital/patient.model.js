import pool from '../../core/config/database.js';

function assertRange(name, value, min, max, required = true) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error(`${name} est requis`);
    return;
  }
  // Convertir en nombre si c'est une chaîne
  const numValue = typeof value === 'string' ? Number(value) : value;
  if (typeof numValue !== 'number' || isNaN(numValue)) {
    if (required) throw new Error(`${name} doit être un nombre valide`);
    return;
  }
  if (numValue < min || numValue > max) {
    throw new Error(`${name} hors bornes (${min}–${max})`);
  }
}

class DossierPatient {
  static normalizePayload(payload) {
    const {
      pression_arterielle,
      glycémie_capillaire,
      unite_glycemie,
      ecg_realise,
      heure_ecg,
      episode_id,
      heure_appel,
      depart_base,
      arrivee_site,
      depart_site,
      arrivee_clinique,
      ...rest
    } = payload;

    // TA "120/75" -> systolique/diastolique
    let pression_arterielle_systolique;
    let pression_arterielle_diastolique;
    if (pression_arterielle && typeof pression_arterielle === 'string' && pression_arterielle.trim() && pression_arterielle.includes('/')) {
      const parts = pression_arterielle.split('/');
      if (parts.length === 2) {
        pression_arterielle_systolique = Number(parts[0].trim());
        pression_arterielle_diastolique = Number(parts[1].trim());
        if (isNaN(pression_arterielle_systolique) || isNaN(pression_arterielle_diastolique)) {
          throw new Error('Format de pression artérielle invalide (attendu: "120/75")');
        }
      }
    }

    // Si pression_arterielle n'est pas fournie ou invalide, les valeurs restent undefined
    // et seront rejetées par la validation

    // Convertir les chaînes numériques en nombres (si non vides)
    const convertToNumber = (val, allowEmpty = false) => {
      if (val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) {
        return allowEmpty ? null : undefined;
      }
      if (typeof val === 'number') {
        return val;
      }
      const num = typeof val === 'string' ? Number(val.trim()) : Number(val);
      return isNaN(num) ? (allowEmpty ? null : undefined) : num;
    };

    const glycemie = convertToNumber(glycémie_capillaire, true);

    return {
      ...rest,
      temperature: convertToNumber(rest.temperature, true),
      score_gcs: convertToNumber(rest.score_gcs),
      douleur: convertToNumber(rest.douleur, true),
      glycémie_capillaire: glycemie,
      unite_glycemie: glycemie === null ? null : (unite_glycemie || null),
      ecg_realise: ecg_realise === true || ecg_realise === 'true' || ecg_realise === 1 ? true : (ecg_realise === false || ecg_realise === 'false' || ecg_realise === 0 ? false : null),
      heure_ecg: heure_ecg || null,
      episode_id: episode_id || null,
      heure_appel: heure_appel || null,
      depart_base: depart_base || null,
      arrivee_site: arrivee_site || null,
      depart_site: depart_site || null,
      arrivee_clinique: arrivee_clinique || null,
    };
  }

  static validate(payload) {
    assertRange('Âge', payload.age, 0, 120, false);
    if (payload.sexe && !['M', 'F', 'Autre', 'NC'].includes(payload.sexe)) {
      throw new Error('Sexe invalide (M/F/Autre/NC)');
    }
    assertRange('TA systolique', payload.pression_arterielle_systolique, 80, 250, false);
    assertRange('TA diastolique', payload.pression_arterielle_diastolique, 40, 150, false);
    assertRange('Fréquence cardiaque', payload.frequence_cardiaque, 30, 220, false);
    assertRange('Saturation O2', payload.saturation_o2, 50, 100, false);
    assertRange('Fréquence respiratoire', payload.frequence_respiratoire, 6, 40, false);
    assertRange('Température', payload.temperature, 32.0, 42.0, false);
    assertRange('Score GCS', payload.score_gcs, 3, 15, false);
    assertRange('Douleur', payload.douleur, 0, 10, false);

    if ((payload['glycémie_capillaire'] ?? null) !== null) {
      if (payload.unite_glycemie && !['mg/dL', 'mmol/L'].includes(payload.unite_glycemie)) {
        throw new Error("Unité glycémie invalide (mg/dL ou mmol/L)");
      }
      const value = Number(payload['glycémie_capillaire']);
      if (payload.unite_glycemie === 'mg/dL') {
        if (value < 45 || value > 540) throw new Error('Glycémie mg/dL hors bornes (45–540)');
      } else if (payload.unite_glycemie === 'mmol/L') {
        if (value < 2.5 || value > 30.0) throw new Error('Glycémie mmol/L hors bornes (2.5–30.0)');
      }
    }

    if (payload.ecg_realise === true && !payload.heure_ecg) {
      throw new Error("Heure ECG requise si ECG réalisé");
    }

    // Plus de champs de texte obligatoires pour permettre une saisie partielle flexible
  }

  static async create(dossier) {
    const data = this.normalizePayload(dossier);
    this.validate(data);

    // Trouver l'admission liée par l'identifiant patient et optionnellement l'épisode
    let admission_id = null;
    if (data.identifiant_patient) {
      const admissionResult = await pool.query(
        `SELECT id FROM public.admissions 
         WHERE numero_dossier = $1 
         ORDER BY (episode_id = $2) DESC, date_admission DESC 
         LIMIT 1`,
        [data.identifiant_patient, data.episode_id || -1]
      );
      admission_id = admissionResult.rows[0]?.id || null;
    }

    const query = `
      INSERT INTO public.dossier_patient (
        pression_arterielle_systolique, pression_arterielle_diastolique,
        frequence_cardiaque, saturation_o2, frequence_respiratoire, temperature,
        score_gcs, douleur, glycémie_capillaire, unite_glycemie,
        ecg_realise, heure_ecg,
        symptomes_principaux, allergies, antecedents_majeurs, gestes_effectues, medicaments_administres,
        voie_veineuse, evolution_douleur,
        localisation_prise_en_charge, heure_appel,
        depart_base, arrivee_site, depart_site, arrivee_clinique,
        observations_libres, episode_id, admission_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
      ) RETURNING *
    `;

    // S'assurer que toutes les valeurs undefined sont converties en null pour PostgreSQL
    const safeValue = (val) => (val === undefined ? null : val);

    const values = [
      safeValue(data.pression_arterielle_systolique),
      safeValue(data.pression_arterielle_diastolique),
      safeValue(data.frequence_cardiaque),
      safeValue(data.saturation_o2),
      safeValue(data.frequence_respiratoire),
      safeValue(data.temperature),
      safeValue(data.score_gcs),
      safeValue(data.douleur),
      safeValue(data['glycémie_capillaire']),
      safeValue(data.unite_glycemie),
      safeValue(data.ecg_realise),
      safeValue(data.heure_ecg),
      safeValue(data.symptomes_principaux),
      safeValue(data.allergies),
      safeValue(data.antecedents_majeurs),
      safeValue(data.gestes_effectues),
      safeValue(data.medicaments_administres),
      safeValue(data.voie_veineuse),
      safeValue(data.evolution_douleur),
      safeValue(data.localisation_prise_en_charge),
      safeValue(data.heure_appel),
      safeValue(data.depart_base),
      safeValue(data.arrivee_site),
      safeValue(data.depart_site),
      safeValue(data.arrivee_clinique),
      safeValue(data.observations_libres),
      safeValue(data.episode_id),
      safeValue(admission_id),
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (dbError) {
      console.error('Database error in DossierPatient.create:', dbError);
      console.error('Query values:', JSON.stringify(values, null, 2));
      throw new Error(`Erreur base de données: ${dbError.message}${dbError.detail ? ' - ' + dbError.detail : ''}`);
    }
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM public.v_dossier_patient WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async list({ limit = 100, offset = 0, identifiant_patient = null } = {}) {
    let query = 'SELECT * FROM public.v_dossier_patient WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (identifiant_patient) {
      query += ` AND identifiant_patient ILIKE $${paramIndex}`;
      params.push(`%${identifiant_patient}%`);
      paramIndex++;
    }

    query += ' ORDER BY date_creation DESC';
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  static async findByIdentifiant(identifiant_patient) {
    const result = await pool.query(
      'SELECT * FROM public.v_dossier_patient WHERE identifiant_patient = $1 ORDER BY date_creation DESC LIMIT 1',
      [identifiant_patient]
    );
    return result.rows[0] || null;
  }

  static async delete(id) {
    const result = await pool.query('DELETE FROM public.dossier_patient WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  }
}

export default DossierPatient;



