
import express from 'express';
import EnergyMeter from './energy.model.js';
import authController from '../../auth/auth.controller.js';
import PDFDocument from 'pdfkit';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

router.get('/', authController.verifyToken, async (req, res) => {
    try {
        const { floorId, showInactive } = req.query;
        const meters = await EnergyMeter.getAll(
            floorId ? parseInt(floorId) : null,
            showInactive === 'true'
        );
        res.json({ success: true, data: meters });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/history', authController.verifyToken, async (req, res) => {
    try {
        const { timeframe } = req.query;
        const history = await EnergyMeter.getGlobalHistory(timeframe);
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('Error fetching energy history:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/history-range', authController.verifyToken, async (req, res) => {
    try {
        const { type, id, startDate, endDate } = req.query;
        if (!type || !id || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Missing parameters' });
        }
        const history = await EnergyMeter.getHistoryRange(type, id, startDate, endDate);
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('Error fetching history range:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/report/pdf', authController.verifyToken, async (req, res) => {
    try {
        const meters = await EnergyMeter.getAll();

        const total_kw = meters.reduce((sum, m) => sum + (Number(m.consumption_kw) || 0), 0);
        const total_kwh_day = meters.reduce((sum, m) => sum + (Number(m.kwh_today) || 0), 0);
        const total_kwh_month = meters.reduce((sum, m) => sum + (Number(m.kwh_month) || 0), 0);
        const offline_count = meters.filter(m => m.current_status === 'CRITIQUE').length;

        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="rapport_energie_oncorad.pdf"');
        doc.pipe(res);

        const colors = {
            primary: '#1e40af',
            secondary: '#3b82f6',
            gray: '#6b7280',
            dark: '#111827',
            light: '#f3f4f6'
        };

        // Header
        try {
            const logoPath = join(__dirname, '../../public/logo.png');
            doc.image(logoPath, 50, 45, { width: 150 });
        } catch (e) { }

        doc.fillColor(colors.primary)
            .fontSize(20)
            .font('Helvetica-Bold')
            .text('Rapport Performance Énergétique', 220, 50);

        doc.fillColor(colors.gray)
            .fontSize(10)
            .font('Helvetica')
            .text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 220, 75);

        doc.moveTo(50, 110).lineTo(545, 110).strokeColor(colors.light).stroke();

        // Section 1: Résumé
        let y = 140;
        doc.fillColor(colors.primary).fontSize(14).font('Helvetica-Bold').text('1. RÉSUMÉ EXÉCUTIF', 50, y);
        y += 30;

        const stats = [
            { label: 'Charge Totale', value: `${total_kw.toFixed(2)} kW` },
            { label: 'Consommation Jour', value: `${total_kwh_day.toFixed(2)} kWh` },
            { label: 'Consommation Mois', value: `${total_kwh_month.toFixed(2)} kWh` },
            { label: 'Santé du Parc', value: `${meters.length - offline_count}/${meters.length} Actifs` }
        ];

        stats.forEach(s => {
            doc.fillColor(colors.gray).fontSize(10).font('Helvetica').text(s.label, 50, y);
            doc.fillColor(colors.dark).fontSize(12).font('Helvetica-Bold').text(s.value, 200, y);
            y += 25;
        });

        y += 20;

        // Section 2: Analyse par Étage
        doc.fillColor(colors.primary).fontSize(14).font('Helvetica-Bold').text('2. RÉPARTITION PAR ÉTAGE', 50, y);
        y += 30;

        const floorMap = {};
        meters.forEach(m => {
            const f = m.floor_name || `Étage ${m.floor_id}`;
            floorMap[f] = (floorMap[f] || 0) + (Number(m.consumption_kw) || 0);
        });

        Object.entries(floorMap).forEach(([floor, kw]) => {
            doc.fillColor(colors.gray).fontSize(10).font('Helvetica').text(floor, 50, y);
            doc.fillColor(colors.dark).fontSize(12).font('Helvetica-Bold').text(`${kw.toFixed(2)} kW`, 200, y);

            // Tiny bar chart representation
            const barWidth = Math.min(kw * 20, 200);
            doc.rect(320, y - 2, barWidth, 10).fill(colors.secondary);

            y += 25;
        });

        y += 30;

        // Section 3: Recommandations
        doc.fillColor(colors.primary).fontSize(14).font('Helvetica-Bold').text('3. RECOMMANDATIONS', 50, y);
        y += 30;

        const recs = [
            "Vérifier la connectivité des 9 compteurs signalés hors-ligne.",
            "Surveiller la charge sur l'Étage 1 (consommation majoritaire).",
            "Évaluer l'installation de batteries de condensateurs pour optimiser le PF."
        ];

        recs.forEach(r => {
            doc.fillColor(colors.dark).fontSize(10).font('Helvetica').text(`• ${r}`, 50, y, { width: 480 });
            y += 20;
        });

        // Footer
        doc.fillColor(colors.gray)
            .fontSize(8)
            .text('Document confidentiel - Oncorad Group - IoT EnergyPulse™', 50, 780, { align: 'center', width: 495 });

        doc.end();

    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/', authController.verifyToken, async (req, res) => {
    try {
        const meter = await EnergyMeter.create(req.body);
        res.status(201).json({ success: true, data: meter });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/:id', authController.verifyToken, async (req, res) => {
    try {
        const meter = await EnergyMeter.update(req.params.id, req.body);
        res.json({ success: true, data: meter });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/:id', authController.verifyToken, async (req, res) => {
    try {
        await EnergyMeter.delete(req.params.id);
        res.json({ success: true, message: 'Energy meter deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
