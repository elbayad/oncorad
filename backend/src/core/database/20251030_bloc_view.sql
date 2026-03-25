-- DDL: Table bloc_view
-- Crée la table pour les dossiers patients dans le bloc opératoire

CREATE SCHEMA IF NOT EXISTS public;

CREATE TABLE IF NOT EXISTS public.bloc_view (
    id SERIAL PRIMARY KEY,
    date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_modification TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    derniere_mise_a_jour TIMESTAMPTZ,
    
    -- Identité patient
    nom_patient TEXT NOT NULL,
    prenom_patient TEXT NOT NULL,
    id_patient_mrn TEXT NOT NULL,
    date_naissance DATE NOT NULL,
    
    -- Intervention
    id_intervention TEXT NOT NULL,
    heure_prevue TIME NOT NULL,
    salle_prevue TEXT,
    salle_actuelle TEXT NOT NULL,
    
    -- Sécurité et alertes
    allergies_precautions TEXT,
    lecture_seule BOOLEAN NOT NULL DEFAULT FALSE,
    hors_ligne BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Documents et imagerie
    protocole_operatoire_url TEXT NOT NULL,
    documents_annexes TEXT,
    imagerie_dicom_url TEXT NOT NULL
);

-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_bloc_view_salle_actuelle ON public.bloc_view(salle_actuelle);
CREATE INDEX IF NOT EXISTS idx_bloc_view_heure_prevue ON public.bloc_view(heure_prevue);
CREATE INDEX IF NOT EXISTS idx_bloc_view_mrn ON public.bloc_view(id_patient_mrn);
CREATE INDEX IF NOT EXISTS idx_bloc_view_nom_prenom ON public.bloc_view(nom_patient, prenom_patient, date_naissance);

-- Trigger de mise à jour de date_modification
CREATE OR REPLACE FUNCTION public.set_bloc_view_date_modification()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_modification := NOW();
  NEW.derniere_mise_a_jour := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bloc_view_set_updated_at ON public.bloc_view;
CREATE TRIGGER bloc_view_set_updated_at
BEFORE UPDATE ON public.bloc_view
FOR EACH ROW
EXECUTE FUNCTION public.set_bloc_view_date_modification();

-- Données de test (optionnel)
INSERT INTO public.bloc_view (
    nom_patient, prenom_patient, id_patient_mrn, date_naissance,
    id_intervention, heure_prevue, salle_prevue, salle_actuelle,
    allergies_precautions, protocole_operatoire_url, imagerie_dicom_url,
    lecture_seule, hors_ligne
) VALUES
    ('Dupont', 'Jean', 'MRN001', '1980-05-15', 'INT001', '08:00', 'S1', 'S1', 'Pénicilline', 'https://example.com/protocole1.pdf', 'https://example.com/dicom1.dcm', FALSE, FALSE),
    ('Martin', 'Marie', 'MRN002', '1975-08-22', 'INT002', '09:30', 'S2', 'S2', NULL, 'https://example.com/protocole2.pdf', 'https://example.com/dicom2.dcm', FALSE, FALSE),
    ('Bernard', 'Pierre', 'MRN003', '1990-12-10', 'INT003', '10:15', 'S1', 'S1', 'Latex, Iode', 'https://example.com/protocole3.pdf', 'https://example.com/dicom3.dcm', TRUE, FALSE)
ON CONFLICT DO NOTHING;

