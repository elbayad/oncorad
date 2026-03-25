import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import rtlsService from './rtls.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const DATA_FILE = path.join(__dirname, '../data/map-lines.json');

// GET all lines
router.get('/', (req, res) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            res.json({ success: true, data: JSON.parse(data) });
        } else {
            res.json({ success: true, data: {} });
        }
    } catch (error) {
        console.error('[MapLines] Error reading file:', error);
        res.status(500).json({ success: false, message: 'Error reading map lines' });
    }
});

// SAVE lines for a floor
router.post('/', (req, res) => {
    try {
        const { floorId, lines } = req.body;

        if (!floorId || !Array.isArray(lines)) {
            return res.status(400).json({ success: false, message: 'Invalid payload' });
        }

        let currentData = {};
        if (fs.existsSync(DATA_FILE)) {
            try {
                currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            } catch (e) {
                console.warn('[MapLines] Corrupt file, creating new one.');
            }
        }

        // Update floor data
        // Normalize key to string
        currentData[String(floorId)] = lines;

        // Write back
        fs.writeFileSync(DATA_FILE, JSON.stringify(currentData, null, 2));

        // Reload in RTLS Service
        rtlsService.reloadMapLines();

        res.json({ success: true, message: 'Map lines saved' });

    } catch (error) {
        console.error('[MapLines] Error writing file:', error);
        res.status(500).json({ success: false, message: 'Error saving map lines' });
    }
});

export default router;
