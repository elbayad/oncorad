-- Migration pour lier dossier_patient à admissions et supprimer les doublons
BEGIN;

-- 1. Ajouter la colonne de liaison admission_id si elle n'existe pas
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dossier_patient' AND column_name='admission_id') THEN
        ALTER TABLE public.dossier_patient ADD COLUMN admission_id INTEGER REFERENCES public.admissions(id);
    END IF;
END $$;

-- 2. Tenter de lier les dossiers existants aux admissions
UPDATE public.dossier_patient dp
SET admission_id = a.id
FROM public.admissions a
WHERE dp.identifiant_patient = a.numero_dossier 
  AND (dp.episode_id = a.episode_id OR dp.episode_id IS NULL);

UPDATE public.dossier_patient dp
SET admission_id = (
    SELECT a.id 
    FROM public.admissions a 
    WHERE a.numero_dossier = dp.identifiant_patient 
    ORDER BY a.date_admission DESC 
    LIMIT 1
)
WHERE dp.admission_id IS NULL 
  AND EXISTS (SELECT 1 FROM public.admissions WHERE numero_dossier = dp.identifiant_patient);

-- 3. Supprimer les colonnes redondantes de dossier_patient
ALTER TABLE public.dossier_patient 
DROP COLUMN IF EXISTS identifiant_patient,
DROP COLUMN IF EXISTS date_creation,
DROP COLUMN IF EXISTS date_modification,
DROP COLUMN IF EXISTS age,
DROP COLUMN IF EXISTS sexe,
DROP COLUMN IF EXISTS mac_rtls;

-- 4. Mettre à jour la vue public.v_dossier_patient
CREATE OR REPLACE VIEW public.v_dossier_patient AS
SELECT
    dp.id,
    a.numero_dossier AS identifiant_patient,
    a.created_at AS date_creation,
    a.updated_at AS date_modification,
    CASE 
        WHEN a.date_naissance IS NOT NULL THEN (EXTRACT(YEAR FROM AGE(a.date_naissance)))::INTEGER
        ELSE NULL 
    END AS age,
    a.sexe,
    (dp.pression_arterielle_systolique || '/' || dp.pression_arterielle_diastolique) AS pression_arterielle,
    dp.frequence_cardiaque,
    dp.saturation_o2,
    dp.frequence_respiratoire,
    dp.temperature,
    dp.score_gcs,
    dp.douleur,
    dp.glycémie_capillaire,
    dp.unite_glycemie,
    dp.ecg_realise,
    dp.heure_ecg,
    dp.symptomes_principaux,
    dp.allergies,
    dp.antecedents_majeurs,
    dp.gestes_effectues,
    dp.medicaments_administres,
    dp.voie_veineuse,
    dp.evolution_douleur,
    dp.localisation_prise_en_charge,
    dp.heure_appel,
    dp.depart_base,
    dp.arrivee_site,
    dp.depart_site,
    dp.arrivee_clinique,
    dp.observations_libres,
    a.mac_rtls,
    dp.episode_id,
    dp.admission_id,
    a.nom AS patient_nom,
    a.prenom AS patient_prenom
FROM public.dossier_patient dp
LEFT JOIN public.admissions a ON dp.admission_id = a.id;

COMMIT;
