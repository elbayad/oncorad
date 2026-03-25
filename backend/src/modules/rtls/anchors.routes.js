import express from 'express';
import Anchor from './anchor.model.js';
import authController from '../auth/auth.controller.js';

const router = express.Router();

// Get all anchors
router.get('/', async (req, res) => {
    try {
        const anchors = await Anchor.getAll();
        res.json({
            success: true,
            data: anchors
        });
    } catch (error) {
        console.error('Get anchors error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des ancres'
        });
    }
});

// Update anchor
router.put('/:id', authController.verifyToken, async (req, res) => {
    try {
        const anchor = await Anchor.update(req.params.id, req.body);
        res.json({ success: true, data: anchor });
    } catch (error) {
        console.error('Update anchor error:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la modification de l\'ancre' });
    }
});

export default router;
