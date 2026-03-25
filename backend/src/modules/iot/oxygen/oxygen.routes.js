
import express from 'express';
import OxygenPoint from './oxygen.model.js';
import authController from '../../auth/auth.controller.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { floorId } = req.query;
        const points = await OxygenPoint.getAll(floorId ? parseInt(floorId) : null);
        res.json({ success: true, data: points });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/stats', authController.verifyToken, async (req, res) => {
    try {
        const stats = await OxygenPoint.getDailyStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/:id/history', authController.verifyToken, async (req, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) {
            return res.status(400).json({ success: false, message: 'Missing start or end parameters' });
        }
        const history = await OxygenPoint.getValveHistory(req.params.id, start, end);
        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/', authController.verifyToken, async (req, res) => {
    try {
        const point = await OxygenPoint.create(req.body);
        res.status(201).json({ success: true, data: point });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/:id', authController.verifyToken, async (req, res) => {
    try {
        const point = await OxygenPoint.update(req.params.id, req.body);
        res.json({ success: true, data: point });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/:id', authController.verifyToken, async (req, res) => {
    try {
        await OxygenPoint.delete(req.params.id);
        res.json({ success: true, message: 'Oxygen point deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
