-- DDL: Table dossier_patient
-- Crée la table si elle n'existe pas, avec contraintes métier et champ heure_appel

CREATE SCHEMA IF NOT EXISTS public;

CREATE TABLE IF NOT EXISTS public.dossier_patient (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifiant_patient TEXT,
    date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_modification TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Données patient
    age INTEGER NOT NULL CHECK (age BETWEEN 0 AND 120),
    sexe TEXT NOT NULL CHECK (sexe IN ('M','F','Autre','NC')),

    -- Constantes vitales
    pression_arterielle_systolique INTEGER NOT NULL CHECK (pression_arterielle_systolique BETWEEN 80 AND 250),
    pression_arterielle_diastolique INTEGER NOT NULL CHECK (pression_arterielle_diastolique BETWEEN 40 AND 150),
    frequence_cardiaque INTEGER NOT NULL CHECK (frequence_cardiaque BETWEEN 30 AND 220),
    saturation_o2 INTEGER NOT NULL CHECK (saturation_o2 BETWEEN 50 AND 100),
    frequence_respiratoire INTEGER NOT NULL CHECK (frequence_respiratoire BETWEEN 6 AND 40),
    temperature NUMERIC(4,1) CHECK (temperature BETWEEN 32.0 AND 42.0),
    score_gcs INTEGER NOT NULL CHECK (score_gcs BETWEEN 3 AND 15),
    douleur INTEGER CHECK (douleur BETWEEN 0 AND 10),

    glycémie_capillaire NUMERIC(6,1),
    unite_glycemie TEXT CHECK (unite_glycemie IN ('mg/dL','mmol/L')),

    -- ECG
    ecg_realise BOOLEAN,
    heure_ecg TIME,

    -- Champs cliniques
    symptomes_principaux TEXT NOT NULL,
    allergies TEXT NOT NULL,
    antecedents_majeurs TEXT NOT NULL,
    gestes_effectues TEXT NOT NULL,
    medicaments_administres TEXT NOT NULL,
    voie_veineuse TEXT,
    evolution_douleur TEXT,

    -- Localisation / logistique
    localisation_prise_en_charge TEXT NOT NULL,
    heure_appel TIME,
    depart_base TIME NOT NULL,
    arrivee_site TIME NOT NULL,
    depart_site TIME NOT NULL,
    arrivee_clinique TIME NOT NULL,

    observations_libres TEXT,
    mac_rtls TEXT,

    -- Garde-fous
    CHECK (
      (glycémie_capillaire IS NULL AND unite_glycemie IS NULL)
      OR (glycémie_capillaire IS NOT NULL AND unite_glycemie IS NOT NULL)
    ),
    CHECK (
      (ecg_realise IS NULL AND heure_ecg IS NULL)
      OR (ecg_realise IS NOT NULL AND (ecg_realise = FALSE OR (ecg_realise = TRUE AND heure_ecg IS NOT NULL)))
    )
);

-- Vue de compatibilité si la requête SELECT originale attend un champ pression_arterielle combiné
-- Fournit un champ formaté "TA sys/dia" tout en conservant les colonnes normalisées
CREATE OR REPLACE VIEW public.v_dossier_patient AS
SELECT
  id,
  identifiant_patient,
  date_creation,
  date_modification,
  age,
  sexe,
  (pression_arterielle_systolique || '/' || pression_arterielle_diastolique) AS pression_arterielle,
  frequence_cardiaque,
  saturation_o2,
  frequence_respiratoire,
  temperature,
  score_gcs,
  douleur,
  glycémie_capillaire,
  unite_glycemie,
  ecg_realise,
  heure_ecg,
  symptomes_principaux,
  allergies,
  antecedents_majeurs,
  gestes_effectues,
  medicaments_administres,
  voie_veineuse,
  evolution_douleur,
  localisation_prise_en_charge,
  heure_appel,
  depart_base,
  arrivee_site,
  depart_site,
  arrivee_clinique,
  observations_libres,
  mac_rtls
FROM public.dossier_patient;

-- Trigger de mise à jour de date_modification
CREATE OR REPLACE FUNCTION public.set_date_modification()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_modification := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dossier_patient_set_updated_at ON public.dossier_patient;
CREATE TRIGGER dossier_patient_set_updated_at
BEFORE UPDATE ON public.dossier_patient
FOR EACH ROW
EXECUTE FUNCTION public.set_date_modification();



