import express from 'express';
import EnergySettings from './energy-settings.model.js';
import authController from '../../auth/auth.controller.js';

const router = express.Router();

router.get('/', authController.verifyToken, async (req, res) => {
    try {
        const settings = await EnergySettings.getSettings();
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/', authController.verifyToken, async (req, res) => {
    try {
        const settings = await EnergySettings.updateSettings(req.body);
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
