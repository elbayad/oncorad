import express from 'express';
import Tuning from './tuning.model.js';
import rtlsService from './rtls.service.js';

const router = express.Router();

// Get tuning for a floor
router.get('/:floorId', async (req, res) => {
    try {
        const tuning = await Tuning.getAnchorTuning(req.params.floorId);
        res.json({ success: true, data: tuning });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Upsert tuning
router.post('/upsert', async (req, res) => {
    try {
        const result = await Tuning.upsertAnchorTuning(req.body);

        // Hot-reload tuning in rtlsService
        if (rtlsService.loadSemanticTuning) {
            await rtlsService.loadSemanticTuning();
        }

        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
