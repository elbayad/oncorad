import express from 'express';
import pool from '../../core/config/database.js';
import Episode from './episode.model.js';
import authController from '../auth/auth.controller.js';

const router = express.Router();

// GET /api/episodes/:id/context
// Aggregates all data related to an episode:
// - Episode details
// - Admission (if exists)
// - DossierPatient (Ambulance, if exists)
// - RTLS Assignment & Status
router.get('/:id/context', authController.verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Fetch Episode
        const episode = await Episode.findById(id);
        if (!episode) {
            return res.status(404).json({ success: false, message: 'Episode not found' });
        }

        // 2. Parallel Fetch of related data
        const [admissionRes, dossierRes, assignmentRes] = await Promise.all([
            pool.query('SELECT * FROM admissions WHERE episode_id = $1 ORDER BY created_at DESC LIMIT 1', [id]),
            pool.query('SELECT * FROM v_dossier_patient WHERE episode_id = $1 ORDER BY date_creation DESC LIMIT 1', [id]),
            pool.query(`
                SELECT ra.*, r.room_number as last_room_name, f.name as last_floor_name
                FROM rtls_assignments ra
                LEFT JOIN assets a ON ra.asset_id = a.id
                LEFT JOIN rooms r ON a.last_room_id = r.id
                LEFT JOIN floors f ON r.floor_id = f.id
                WHERE ra.episode_id = $1 AND ra.ended_at IS NULL
            `, [id])
        ]);

        const admission = admissionRes.rows[0] || null;
        const dossier = dossierRes.rows[0] || null;
        const assignment = assignmentRes.rows[0] || null;

        // 3. Construct Aggregate Object
        // Schema compliant mapping
        const patientData = {
            // Priority Logic:
            // 1. Admission: Has explicit Nom/Prenom
            // 2. Dossier/Ambulance: Has 'identifiant_patient' which acts as Name provided by paramedics
            nom: admission?.nom || dossier?.identifiant_patient || 'Inconnu',
            prenom: admission?.prenom || '',
            sexe: admission?.sexe || dossier?.sexe || '?',
            age: admission?.date_naissance ? calculateAge(admission.date_naissance) : (dossier?.age || null),
            dob: admission?.date_naissance || null,
            // ID Display: Admission Dossier Number OR Ambulance ID/Name
            id_patient: admission?.numero_dossier || dossier?.identifiant_patient || null,
            // Considered identified if we have a name from either source
            is_identified: !!(admission?.nom || dossier?.identifiant_patient)
        };

        const clinicalData = {
            // Reason comes from Dossier (Admission doesn't have motif_admission)
            reason: dossier?.symptomes_principaux || 'Non spécifié',
            vitals: {
                hr: dossier?.frequence_cardiaque,
                bp_sys: dossier?.pression_arterielle_systolique,
                bp_dia: dossier?.pression_arterielle_diastolique,
                spo2: dossier?.saturation_o2,
                gcs: dossier?.score_gcs,
                temp: dossier?.temperature,
                last_updated: dossier?.date_creation // Timestamp of dossier
            },
            allergies: parseList(dossier?.allergies),
            medications: parseList(dossier?.medicaments_administres),
            procedures: parseList(dossier?.gestes_effectues),
            risks: parseList(dossier?.antecedents_majeurs)
        };

        const admissionContext = admission ? {
            room: admission.numero_chambre,
            floor: admission.etage,
            doctor: admission.medecin_traitant
        } : null;

        // 4. Determine Global Alert Level
        let alertLevel = 'safe';
        const alertList = [];

        // Rule: Unidentified Patient -> Critical
        if (!patientData.is_identified) {
            alertLevel = 'critical';
            alertList.push('PATIENT NON IDENTIFIÉ');
        }

        // Rule: Allergies -> Critical
        if (clinicalData.allergies.length > 0 && clinicalData.allergies[0] !== 'Aucune') {
            alertLevel = 'critical';
            alertList.push('ALLERGIES: ' + clinicalData.allergies.join(', '));
        }

        // Rule: RTLS Lost -> Critical (mock logic, needs real RTLS status check)
        if (!assignment) {
            // alertLevel = 'critical'; 
            // alertList.push('RTLS NON ASSIGNÉ');
        }

        const response = {
            id: episode.id,
            context: episode.context,
            status: episode.status,
            rtls_status: assignment ? 'connected' : 'lost',
            patient: patientData,
            alerts: {
                level: alertLevel,
                list: alertList.length > 0 ? alertList : ['RAS']
            },
            clinical: clinicalData,
            admission: admissionContext,
            realtime: assignment ? {
                room: assignment.last_room_name,
                floor: assignment.last_floor_name
            } : null,
            intervention: {
                title: episode.intervention_title,
                time: episode.intervention_time,
                protocol_available: episode.protocol_op,
                dicom_available: episode.dicom_link,
                consent: episode.consent_received
            }
        };

        res.json({ success: true, data: response });
    } catch (error) {
        console.error('Get episode context error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});


// GET /api/episodes/current/room/:roomName
// Finds the active episode associated with an asset currently in the specified room (zone).
router.get('/current/room/:roomName', authController.verifyToken, async (req, res) => {
    try {
        const { roomName } = req.params;

        // 1. Find assets that were LAST STABLE in this room
        // We join with the rooms table to match roomName (e.g. 'Bloc1') to last_room_id
        const assetsInRoom = await pool.query(
            `SELECT a.id 
             FROM assets a
             JOIN rooms r ON a.last_room_id = r.id
             WHERE r.room_number = $1
               AND a.last_seen > NOW() - INTERVAL '5 minutes' 
             LIMIT 5`,
            [roomName]
        );

        if (assetsInRoom.rows.length === 0) {
            // Fallback for non-room zones or legacy mapping
            const legacyCheck = await pool.query(
                `SELECT id FROM assets 
                 WHERE (zone = $1 OR last_pos = $1) 
                   AND last_seen > NOW() - INTERVAL '5 minutes' 
                 LIMIT 5`,
                [roomName]
            );

            if (legacyCheck.rows.length === 0) {
                return res.json({ success: true, data: null, message: 'No assets found in room' });
            }
            assetsInRoom.rows = legacyCheck.rows;
        }

        // 2. Check each asset for an ACTIVE EPISODE
        let foundEpisode = null;
        for (const asset of assetsInRoom.rows) {
            const episode = await Episode.findActiveByAsset(asset.id);
            if (episode) {
                foundEpisode = episode;
                break; // Found the patient!
            }
        }

        if (foundEpisode) {
            // Redirect to context endpoint or return simplified data?
            // Let's return the ID so frontend can fetch full context.
            return res.json({ success: true, data: { episodeId: foundEpisode.id } });
        }

        res.json({ success: true, data: null, message: 'No active episode found in room' });

    } catch (error) {
        console.error('Get current episode in room error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Helper: Calculate Age
function calculateAge(dobStr) {
    if (!dobStr) return null;
    const dob = new Date(dobStr);
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
}

// Helper: Parse List (handles comma separated strings or arrays)
function parseList(input) {
    if (!input) return [];
    if (Array.isArray(input)) return input;
    if (typeof input === 'string') return input.split(',').map(s => s.trim()).filter(s => s);
    return [];
}

export default router;
