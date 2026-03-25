import express from 'express';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import DossierPatient from './patient.model.js';
import Asset from '../hospital/asset.model.js';
import Episode from './episode.model.js';
import RtlsAssignment from '../rtls/rtls-assignment.model.js';
import authController from '../auth/auth.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

router.get('/', authController.verifyToken, async (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const offset = Number(req.query.offset || 0);
    const identifiant_patient = req.query.identifiant_patient || null;
    const rows = await DossierPatient.list({ limit, offset, identifiant_patient });
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('List dossiers error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/search/:identifiant', authController.verifyToken, async (req, res) => {
  try {
    const dossier = await DossierPatient.findByIdentifiant(req.params.identifiant);
    if (!dossier) {
      return res.status(404).json({ success: false, message: 'Dossier introuvable' });
    }
    res.json({ success: true, data: dossier });
  } catch (error) {
    console.error('Search dossier error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', authController.verifyToken, async (req, res) => {
  try {
    const row = await DossierPatient.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Dossier introuvable' });
    res.json({ success: true, data: row });
  } catch (error) {
    console.error('Get dossier error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', authController.verifyToken, async (req, res) => {
  try {
    const success = await DossierPatient.delete(req.params.id);
    if (!success) return res.status(404).json({ success: false, message: 'Dossier introuvable' });
    res.json({ success: true, message: 'Dossier supprimé' });
  } catch (error) {
    console.error('Delete dossier error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/discharge', authController.verifyToken, async (req, res) => {
  try {
    const dossier = await DossierPatient.findById(req.params.id);
    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier not found' });

    if (dossier.episode_id) {
      await Episode.close(dossier.episode_id);
    }

    if (dossier.mac_rtls) {
      await RtlsAssignment.end(dossier.mac_rtls);
    }

    res.json({ success: true, message: 'Patient discharged, episode closed' });
  } catch (error) {
    console.error('Discharge dossier error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


router.post('/', authController.verifyToken, async (req, res) => {
  try {
    // 0. Sync Asset FIRST (Prevent FK Violation)
    if (req.body.mac_rtls) {
      await Asset.upsertFromMac(req.body.mac_rtls, req.body.identifiant_patient, 1);
    }

    let episodeId = null;

    // Episode Logic
    if (req.body.mac_rtls) {
      const activeEpisode = await Episode.findActiveByAsset(req.body.mac_rtls);

      if (activeEpisode) {
        episodeId = activeEpisode.id;
      } else {
        const newEpisode = await Episode.create({ context: 'ambulance' });
        episodeId = newEpisode.id;
        await RtlsAssignment.create({
          assetId: req.body.mac_rtls,
          episodeId: newEpisode.id
        });
      }
    } else {
      const newEpisode = await Episode.create({ context: 'ambulance' });
      episodeId = newEpisode.id;
    }

    const dossierData = { ...req.body, episode_id: episodeId };
    const created = await DossierPatient.create(dossierData);

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Create dossier error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    // Distinguer les erreurs de validation (400) des erreurs serveur (500)
    if (error.message && (
      error.message.includes('est requis') ||
      error.message.includes('hors bornes') ||
      error.message.includes('invalide') ||
      error.message.includes('Format') ||
      error.message.includes('doit être un nombre')
    )) {
      res.status(400).json({ success: false, message: error.message });
    } else {
      // En développement, envoyer plus de détails sur l'erreur
      const errorMessage = process.env.NODE_ENV === 'production'
        ? 'Erreur serveur lors de la création du dossier'
        : (error.message || 'Erreur serveur lors de la création du dossier');
      res.status(500).json({
        success: false,
        message: errorMessage,
        ...(process.env.NODE_ENV !== 'production' && { details: error.stack })
      });
    }
  }
});

function buildPdf(dossier) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: 'Rapport Intervention - Dossier Patient',
      Author: 'Oncorad Group',
      Subject: 'Rapport médical intervention ambulance'
    }
  });

  // Couleurs
  const colors = {
    primary: '#1e40af',      // Bleu foncé
    secondary: '#3b82f6',    // Bleu
    accent: '#ef4444',       // Rouge pour alertes
    success: '#10b981',      // Vert
    gray: '#6b7280',         // Gris
    lightGray: '#f3f4f6',    // Gris clair
    dark: '#111827'          // Noir foncé
  };

  // Fonction helper pour les sections
  function addSection(title, y) {
    doc.fillColor(colors.primary)
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(title, 50, y);

    // Ligne de séparation
    doc.strokeColor(colors.primary)
      .lineWidth(2)
      .moveTo(50, y + 20)
      .lineTo(545, y + 20)
      .stroke();

    return y + 35;
  }

  function addField(label, value, x, y, width = 240) {
    doc.fillColor(colors.gray)
      .fontSize(9)
      .font('Helvetica')
      .text(label, x, y);

    doc.fillColor(colors.dark)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(value || '-', x, y + 12, { width });

    return y + 28;
  }

  let y = 50;

  // En-tête avec logo - taille réduite en gardant les proportions (400x117 pixels → 200x58)
  const logoWidth = 200; // 50% de la taille originale (400px)
  const logoHeight = 58; // Proportionnel: 117 * (200/400) = 58.5, arrondi à 58

  try {
    const logoPath = join(__dirname, '../../public/logo.png');
    const logo = readFileSync(logoPath);
    // Réduire à 50% de la taille originale tout en gardant les proportions exactes
    doc.image(logo, 50, y, { width: logoWidth, height: logoHeight });
  } catch (err) {
    console.warn('Logo non trouvé, continuant sans logo');
  }

  // Titre et informations de l'établissement - positionné à droite du logo
  // Le logo fait 200px de large et contient déjà "ONCORAD GROUP", donc on commence le texte à 270px
  const textX = 270;

  // Pas besoin de répéter "Oncorad Group" car c'est déjà dans le logo
  doc.fillColor(colors.gray)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('Rapport Intervention - Dossier Patient', textX, y + 20);

  doc.fillColor(colors.gray)
    .fontSize(8)
    .font('Helvetica')
    .text(`Généré le ${new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, textX, y + 40);

  // Positionner le contenu suivant après le logo (qui fait 117px de haut)
  y = Math.max(150, y + logoHeight + 20);

  // Section: Identité Patient
  y = addSection('IDENTITÉ PATIENT', y);
  const yId1 = y;
  y = addField('Identifiant patient', dossier.identifiant_patient || '-', 50, y, 240);
  y = addField('Âge', `${dossier.age} ans`, 300, yId1, 245);
  const yId2 = Math.max(y, yId1 + 28);
  y = addField('Sexe', dossier.sexe, 50, yId2, 240);
  y = addField('Date de création', new Date(dossier.date_creation).toLocaleString('fr-FR'), 300, yId2, 245);
  y = Math.max(y, yId2 + 28) + 10;

  // Section: Constantes Vitales
  y = addSection('CONSTANTES VITALES', y);

  // Première ligne de constantes
  const yVitals1 = y;
  y = addField('Pression artérielle', dossier.pression_arterielle || '-', 50, y, 150);
  y = addField('Fréquence cardiaque', `${dossier.frequence_cardiaque} bpm`, 220, yVitals1, 150);
  y = addField('SpO₂', `${dossier.saturation_o2}%`, 390, yVitals1, 150);
  const yVitals2 = Math.max(y, yVitals1 + 28) + 5;

  // Deuxième ligne
  y = addField('Fréquence respiratoire', `${dossier.frequence_respiratoire}/min`, 50, yVitals2, 150);
  y = addField('Température', dossier.temperature ? `${dossier.temperature} °C` : '-', 220, yVitals2, 150);
  y = addField('Score GCS', `${dossier.score_gcs}/15`, 390, yVitals2, 150);
  const yVitals3 = Math.max(y, yVitals2 + 28) + 5;

  // Troisième ligne
  y = addField('Douleur', dossier.douleur ? `${dossier.douleur}/10` : '-', 50, yVitals3, 150);
  y = addField('Glycémie', dossier['glycémie_capillaire'] ? `${dossier['glycémie_capillaire']} ${dossier.unite_glycemie || ''}` : '-', 220, yVitals3, 150);
  y = addField('ECG', dossier.ecg_realise ? `Oui${dossier.heure_ecg ? ' à ' + dossier.heure_ecg : ''}` : 'Non', 390, yVitals3, 150);
  y = Math.max(y, yVitals3 + 28) + 10;

  // Section: Évaluation Clinique
  y = addSection('ÉVALUATION CLINIQUE', y);
  y = addField('Symptômes principaux', dossier.symptomes_principaux || '-', 50, y, 495);
  y += 5;
  y = addField('Allergies', dossier.allergies || '-', 50, y, 495);
  y += 5;
  y = addField('Antécédents majeurs', dossier.antecedents_majeurs || '-', 50, y, 495);
  y += 10;

  // Section: Soins et Traitements
  y = addSection('SOINS ET TRAITEMENTS', y);
  y = addField('Gestes effectués', dossier.gestes_effectues || '-', 50, y, 495);
  y += 5;
  y = addField('Médicaments administrés', dossier.medicaments_administres || '-', 50, y, 495);
  y += 5;
  const ySoins1 = y;
  y = addField('Voie veineuse', dossier.voie_veineuse || '-', 50, y, 240);
  y = addField('Évolution douleur', dossier.evolution_douleur || '-', 300, ySoins1, 245);
  y = Math.max(y, ySoins1 + 28) + 10;

  // Section: Horodatage et Logistique
  y = addSection('HORODATAGE ET LOGISTIQUE', y);
  y = addField('Localisation prise en charge', dossier.localisation_prise_en_charge || '-', 50, y, 495);
  y += 5;

  // Horodatage en deux colonnes
  const yTime1 = y;
  y = addField('Heure appel', dossier.heure_appel || '-', 50, y, 240);
  y = addField('Départ base', dossier.depart_base || '-', 300, yTime1, 245);
  const yTime2 = Math.max(y, yTime1 + 28) + 5;

  y = addField('Arrivée site', dossier.arrivee_site || '-', 50, yTime2, 240);
  y = addField('Départ site', dossier.depart_site || '-', 300, yTime2, 245);
  const yTime3 = Math.max(y, yTime2 + 28) + 5;

  y = addField('Arrivée clinique', dossier.arrivee_clinique || '-', 50, yTime3, 240);
  y = addField('MAC RTLS', dossier.mac_rtls || '-', 300, yTime3, 245);
  y = Math.max(y, yTime3 + 28) + 10;

  // Section: Observations
  if (dossier.observations_libres) {
    y = addSection('OBSERVATIONS', y);
    doc.fillColor(colors.dark)
      .fontSize(10)
      .font('Helvetica')
      .text(dossier.observations_libres, 50, y, {
        width: 495,
        align: 'left'
      });
    y += doc.heightOfString(dossier.observations_libres, { width: 495 }) + 20;
  }

  // Pied de page
  const pageHeight = doc.page.height;
  doc.fillColor(colors.gray)
    .fontSize(8)
    .font('Helvetica')
    .text(
      'Document confidentiel - Oncorad Group - Ce document est un document médical à usage professionnel',
      50,
      pageHeight - 50,
      { align: 'center', width: 495 }
    );

  doc.end();
  return doc;
}

async function sendMailWithPdf(buffer, subject) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || 'no-reply@example.com',
    to: process.env.MAIL_TO || 'admin@example.com',
    subject,
    text: 'Rapport intervention PDF en pièce jointe.',
    attachments: [{ filename: 'rapport_intervention.pdf', content: buffer }],
  });
  return info;
}

router.post('/:id/pdf', authController.verifyToken, async (req, res) => {
  try {
    const dossier = await DossierPatient.findById(req.params.id);
    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable' });

    const doc = buildPdf(dossier);
    const chunks = [];
    doc.on('data', (d) => chunks.push(d));
    doc.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      if (req.query.email === 'false') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="rapport_intervention.pdf"');
        return res.send(buffer);
      }
      await sendMailWithPdf(buffer, `Rapport Intervention - ${dossier.identifiant_patient || dossier.id}`);
      res.json({ success: true, message: 'PDF généré et envoyé par email' });
    });
  } catch (error) {
    console.error('PDF/email dossier error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;



