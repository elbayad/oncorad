import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const FLOORS_DATA_DIR = path.join(__dirname, '../data/floors');

// Ensure directory exists
if (!fs.existsSync(FLOORS_DATA_DIR)) {
    fs.mkdirSync(FLOORS_DATA_DIR, { recursive: true });
}

// Helper to get file path
const getFilePath = (floorId, type) => {
    // Sanitize floorId and type to prevent directory traversal
    const safeFloorId = String(floorId).replace(/[^a-zA-Z0-9_-]/g, '');
    const safeType = String(type).replace(/[^a-zA-Z0-9_-]/g, '');

    // Validate type
    const validTypes = ['rooms', 'corridors', 'gateways', 'graph', 'doors'];
    if (!validTypes.includes(safeType)) return null;

    const floorDir = path.join(FLOORS_DATA_DIR, safeFloorId);
    if (!fs.existsSync(floorDir)) {
        fs.mkdirSync(floorDir, { recursive: true });
    }

    return path.join(floorDir, `${safeType}.geojson`);
};

// GET data
router.get('/:floorId/:type', (req, res) => {
    try {
        const { floorId, type } = req.params;
        const filePath = getFilePath(floorId, type);

        if (!filePath) {
            return res.status(400).json({ success: false, message: 'Invalid type or floor ID' });
        }

        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json({ success: true, data: JSON.parse(data) });
        } else {
            // Return empty FeatureCollection if file doesn't exist
            res.json({ success: true, data: { type: 'FeatureCollection', features: [] } });
        }
    } catch (error) {
        console.error(`[FloorData] Error reading ${req.params.type} for floor ${req.params.floorId}:`, error);
        res.status(500).json({ success: false, message: 'Error reading data' });
    }
});

// SAVE data
router.post('/:floorId/:type', (req, res) => {
    try {
        const { floorId, type } = req.params;
        const geoJsonData = req.body;

        const filePath = getFilePath(floorId, type);

        if (!filePath) {
            return res.status(400).json({ success: false, message: 'Invalid type or floor ID' });
        }

        // Basic validation: must be an object
        if (!geoJsonData || typeof geoJsonData !== 'object') {
            return res.status(400).json({ success: false, message: 'Invalid GeoJSON data' });
        }

        fs.writeFileSync(filePath, JSON.stringify(geoJsonData, null, 2));

        res.json({ success: true, message: 'Data saved successfully' });

    } catch (error) {
        console.error(`[FloorData] Error saving ${req.params.type} for floor ${req.params.floorId}:`, error);
        res.status(500).json({ success: false, message: 'Error saving data' });
    }
});

export default router;
