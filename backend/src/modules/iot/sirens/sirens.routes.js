
import express from 'express';
import Siren from './siren.model.js';
import authController from '../../auth/auth.controller.js';

const router = express.Router();

// Get all sirens
router.get('/', authController.verifyToken, async (req, res) => {
    try {
        const sirens = await Siren.getAll();
        res.json({ success: true, data: sirens });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Public List (for Siren Control Page)
router.get('/public', async (req, res) => {
    try {
        const sirens = await Siren.getAll();
        res.json({ success: true, data: sirens });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create siren
router.post('/', authController.verifyToken, async (req, res) => {
    try {
        const siren = await Siren.create(req.body);
        res.status(201).json({ success: true, data: siren });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update siren
router.put('/:id', authController.verifyToken, async (req, res) => {
    try {
        const siren = await Siren.update(req.params.id, req.body);
        res.json({ success: true, data: siren });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete siren
router.delete('/:id', authController.verifyToken, async (req, res) => {
    try {
        await Siren.delete(req.params.id);
        res.json({ success: true, message: 'Siren deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Manual Command
import geofenceService from '../../rtls/geofence.service.js';

router.post('/:id/command', async (req, res) => {
    try {
        const { id } = req.params;
        const { state } = req.body; // 'ON' or 'OFF'

        const siren = await Siren.getById(id);
        if (!siren) {
            return res.status(404).json({ success: false, message: 'Siren not found' });
        }

        const channel = siren.output_channel || 'state1'; // Default

        const success = await geofenceService.setManualState(siren.mac, channel, state);

        if (success) {
            res.json({ success: true, message: `Command ${state} sent to ${siren.name}` });
        } else {
            res.status(500).json({ success: false, message: 'Failed to send command' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
