import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import rtlsService from '../rtls/rtls.service.js';
import pool from '../../core/config/database.js';
import authController from '../auth/auth.controller.js';
import { FP_DB_FILE, FP_MISSING_RSSI } from '../../core/config/rtls.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════════
//  Radiomap generation helpers
// ═══════════════════════════════════════════════════════════════════════════
const dist2D = (ax, ay, bx, by) => Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
const log10 = x => Math.log(x) / Math.log(10);

function predictRSSI(d_px, p0, n, offset = 0) {
    const d_m = Math.max(d_px, 1) / 100;
    return p0 - 10 * n * log10(d_m) + offset;
}

function medianOf(arr) {
    if (!arr || arr.length === 0) return null;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function euclidDist(vecA, vecB) {
    const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    let sum = 0;
    for (const k of keys) {
        const a = vecA[k] ?? FP_MISSING_RSSI;
        const b = vecB[k] ?? FP_MISSING_RSSI;
        sum += (a - b) ** 2;
    }
    return Math.sqrt(sum);
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/calibration/generate-radiomap
//  Génère automatiquement la radio-map pour un étage donné.
//  Body (optionnel): { floor_id: 6, grid_step: 150, p0: -59, n: 2.5 }
// ═══════════════════════════════════════════════════════════════════════════
router.post('/generate-radiomap', async (req, res) => {
    const FLOOR_ID = parseInt(req.body?.floor_id ?? 6);
    const GRID_STEP = parseInt(req.body?.grid_step ?? 150);
    const INIT_P0 = parseFloat(req.body?.p0 ?? -59);
    const INIT_N = parseFloat(req.body?.n ?? 2.5);
    const log = [];
    const info = msg => { console.log('[RadioMap]', msg); log.push(msg); };

    try {
        info(`=== Génération Radio-Map Étage ${FLOOR_ID} ===`);

        // ── ÉTAPE 1: Anchors ──────────────────────────────────────────────
        const anchorsRes = await pool.query(`
            SELECT id AS mac, name,
                   coordinates_x::float AS x,
                   coordinates_y::float AS y
            FROM capteurs
            WHERE floor_id = $1 AND status = 'active'
              AND coordinates_x IS NOT NULL AND coordinates_y IS NOT NULL
            ORDER BY name`, [FLOOR_ID]);
        const anchors = anchorsRes.rows.map(r => ({
            mac: r.mac.toLowerCase(), name: r.name, x: r.x, y: r.y
        }));
        info(`Étape 1: ${anchors.length} anchors`);
        anchors.forEach(a => info(`  ⬡ ${a.name} (${a.x},${a.y})`));

        if (anchors.length < 2)
            return res.status(400).json({ success: false, error: 'Minimum 2 anchors requis', log });

        // ── ÉTAPE 1b: Tags de référence ───────────────────────────────────
        const tagsRes = await pool.query(`
            SELECT name, id AS mac,
                   coordinates_x::float AS x,
                   coordinates_y::float AS y,
                   last_pos AS zone
            FROM assets
            WHERE floor_id = $1
              AND coordinates_x IS NOT NULL AND coordinates_y IS NOT NULL
            ORDER BY name`, [FLOOR_ID]);
        const tags = tagsRes.rows.map(r => ({
            name: r.name, mac: r.mac.toLowerCase(), x: r.x, y: r.y, zone: r.zone
        }));
        info(`  ${tags.length} tag(s) de référence`);

        // ── ÉTAPE 2: RSSI observé depuis positions ────────────────────────
        info('Étape 2: Calcul RSSI médian...');
        const observed = {};
        for (const tag of tags) {
            observed[tag.mac] = {};
            for (const anc of anchors) {
                const d = dist2D(tag.x, tag.y, anc.x, anc.y);
                observed[tag.mac][anc.mac] = Math.round(predictRSSI(d, INIT_P0, INIT_N) * 10) / 10;
            }
        }

        // ── ÉTAPES 3+4: Calibration + Optimisation ────────────────────────
        info('Étape 3+4: Calibration...');
        const pairs = [];
        for (const tag of tags) {
            for (const anc of anchors) {
                const d = dist2D(tag.x, tag.y, anc.x, anc.y);
                const rssiObs = observed[tag.mac]?.[anc.mac];
                if (rssiObs !== undefined && d > 10) pairs.push({ d, rssiObs, ancMac: anc.mac });
            }
        }

        let bestP0 = INIT_P0, bestN = INIT_N, bestMSE = Infinity;
        if (pairs.length > 0) {
            for (let p = -80; p <= -40; p += 2) {
                for (let n = 1.5; n <= 4.0; n += 0.25) {
                    const mse = pairs.reduce((s, { d, rssiObs }) => s + (predictRSSI(d, p, n) - rssiObs) ** 2, 0) / pairs.length;
                    if (mse < bestMSE) { bestMSE = mse; bestP0 = p; bestN = n; }
                }
            }
        }
        info(`  P0=${bestP0} dBm  n=${bestN}  RMSE=${Math.sqrt(bestMSE).toFixed(2)} dB`);

        // Offsets par anchor
        const residuals = {};
        for (const { d, rssiObs, ancMac } of pairs) {
            if (!residuals[ancMac]) residuals[ancMac] = [];
            residuals[ancMac].push(rssiObs - predictRSSI(d, bestP0, bestN));
        }
        const offsets = {};
        for (const [mac, res] of Object.entries(residuals)) {
            offsets[mac] = parseFloat((medianOf(res) || 0).toFixed(2));
        }

        // ── ÉTAPE 5: Grille ───────────────────────────────────────────────
        info('Étape 5: Grille...');
        let xMin, xMax, yMin, yMax;
        try {
            const br = await pool.query(`
                SELECT ST_XMin(ST_Envelope(corridor))::float xmin,
                       ST_XMax(ST_Envelope(corridor))::float xmax,
                       ST_YMin(ST_Envelope(corridor))::float ymin,
                       ST_YMax(ST_Envelope(corridor))::float ymax
                FROM floors WHERE id=$1`, [FLOOR_ID]);
            if (br.rows[0]?.xmin != null) ({ xmin: xMin, xmax: xMax, ymin: yMin, ymax: yMax } = br.rows[0]);
        } catch (_) { }
        if (xMin == null) {
            const xs = anchors.map(a => a.x), ys = anchors.map(a => a.y), m = 300;
            xMin = Math.min(...xs) - m; xMax = Math.max(...xs) + m;
            yMin = Math.min(...ys) - m; yMax = Math.max(...ys) + m;
        }
        const grid = [];
        for (let x = xMin; x <= xMax; x += GRID_STEP)
            for (let y = yMin; y <= yMax; y += GRID_STEP)
                grid.push({ x: Math.round(x), y: Math.round(y) });
        info(`  ${grid.length} points (pas=${GRID_STEP} px = ${GRID_STEP / 100} m)`);

        // ── ÉTAPE 6: Simulation RSSI ──────────────────────────────────────
        info('Étape 6: Simulation RSSI...');
        const radioPoints = [];
        for (const pt of grid) {
            const rssiVec = {};
            for (const anc of anchors) {
                const rssi = predictRSSI(dist2D(pt.x, pt.y, anc.x, anc.y), bestP0, bestN, offsets[anc.mac] || 0);
                if (rssi >= -100) rssiVec[anc.mac] = Math.round(rssi * 10) / 10;
            }
            if (Object.keys(rssiVec).length >= 2)
                radioPoints.push({ x: pt.x, y: pt.y, rssi: rssiVec });
        }
        info(`  ${radioPoints.length} points avec ≥ 2 anchors`);

        // ── ÉTAPE 7: Sauvegarde ───────────────────────────────────────────
        info('Étape 7: Sauvegarde...');
        let existing = {};
        try {
            if (fs.existsSync(FP_DB_FILE)) existing = JSON.parse(fs.readFileSync(FP_DB_FILE, 'utf8'));
        } catch (_) { }
        existing[String(FLOOR_ID)] = radioPoints;
        fs.writeFileSync(FP_DB_FILE, JSON.stringify(existing, null, 2));

        // ── ÉTAPE 7b: Sauvegarde Metadata (Offsets, etc.) ──────────────────
        let existingMeta = {};
        try {
            const { FP_META_FILE } = await import('../../core/config/rtls.js');
            if (fs.existsSync(FP_META_FILE)) existingMeta = JSON.parse(fs.readFileSync(FP_META_FILE, 'utf8'));
            existingMeta[String(FLOOR_ID)] = {
                p0: bestP0,
                n: bestN,
                offsets,
                updated_at: new Date().toISOString()
            };
            fs.writeFileSync(FP_META_FILE, JSON.stringify(existingMeta, null, 2));
            info(`  → Metadata saved to ${FP_META_FILE}`);
        } catch (e) {
            info(`  ⚠ Failed to save metadata: ${e.message}`);
        }

        rtlsService.radioMap = existing; // hot-reload sans redémarrage
        // Notification au service de recharger ses metadata si nécessaire
        if (rtlsService.reloadMetadata) rtlsService.reloadMetadata();

        info(`  → ${FP_DB_FILE}`);

        // ── ÉTAPE 8: Validation kNN ───────────────────────────────────────
        const knnResults = [];
        if (tags.length > 0) {
            info(`Étape 8: Validation kNN (k=3)...`);
            for (const tag of tags) {
                const queryVec = {};
                for (const anc of anchors)
                    queryVec[anc.mac] = predictRSSI(dist2D(tag.x, tag.y, anc.x, anc.y), bestP0, bestN, offsets[anc.mac] || 0);
                const nn = radioPoints.map(pt => ({ pt, d: euclidDist(queryVec, pt.rssi) }))
                    .sort((a, b) => a.d - b.d).slice(0, 3);
                const estX = nn.reduce((s, e) => s + e.pt.x, 0) / 3;
                const estY = nn.reduce((s, e) => s + e.pt.y, 0) / 3;
                const errM = dist2D(tag.x, tag.y, estX, estY) / 100;
                knnResults.push({ name: tag.name, trueX: tag.x, trueY: tag.y, estX, estY, errM, zone: tag.zone });
                info(`  ${tag.name}: erreur=${errM.toFixed(2)} m`);
            }
            const avg = knnResults.reduce((s, r) => s + r.errM, 0) / knnResults.length;
            info(`  → Erreur moyenne: ${avg.toFixed(2)} m`);
        } else {
            info('Étape 8: Skipped (aucun tag de référence avec position)');
        }

        info('=== ✅ Terminé ===');
        return res.json({
            success: true,
            floor: FLOOR_ID,
            anchors: anchors.length,
            gridPoints: grid.length,
            radioPoints: radioPoints.length,
            model: { P0: bestP0, N: bestN, offsets },
            knn: knnResults,
            log,
        });

    } catch (err) {
        console.error('[RadioMap] Error:', err);
        return res.status(500).json({ success: false, error: err.message, log });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
//  Existing calibration routes
// ═══════════════════════════════════════════════════════════════════════════

// Get Radio Map
router.get('/db', async (req, res) => {
    try {
        const db = rtlsService.getRadioMapData();
        res.json(db);
    } catch (error) {
        console.error('Get Radio Map error:', error);
        res.status(500).json({ error: 'Failed to load radio map' });
    }
});

// Start Calibration
router.post('/start', authController.verifyToken, (req, res) => {
    try {
        const result = rtlsService.startCalibration(req.body);
        res.json(result);
    } catch (error) {
        console.error('Start Calibration error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Stop Calibration
router.post('/stop', authController.verifyToken, (req, res) => {
    try {
        const result = rtlsService.stopCalibration();
        res.json(result);
    } catch (error) {
        console.error('Stop Calibration error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete Point
router.post('/delete', authController.verifyToken, (req, res) => {
    try {
        const { floor, x, y } = req.body;
        const result = rtlsService.deleteCalibrationPoint(floor, x, y);
        res.json({ success: result });
    } catch (error) {
        console.error('Delete Calibration error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
