
import express from 'express';
import AirSensor from './air.model.js';
import authController from '../../auth/auth.controller.js';

const router = express.Router();

router.get('/', authController.verifyToken, async (req, res) => {
    try {
        const { floorId } = req.query;
        const sensors = await AirSensor.getAll(floorId ? parseInt(floorId) : null);
        res.json({ success: true, data: sensors });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/', authController.verifyToken, async (req, res) => {
    try {
        const sensor = await AirSensor.create(req.body);
        res.status(201).json({ success: true, data: sensor });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/:id', authController.verifyToken, async (req, res) => {
    try {
        const sensor = await AirSensor.update(req.params.id, req.body);
        res.json({ success: true, data: sensor });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/:id', authController.verifyToken, async (req, res) => {
    try {
        await AirSensor.delete(req.params.id);
        res.json({ success: true, message: 'Air sensor deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
