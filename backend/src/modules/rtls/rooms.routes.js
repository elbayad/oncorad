import express from 'express';
import Room from './room.model.js';
import authController from '../auth/auth.controller.js';

const router = express.Router();

// Get all rooms
router.get('/', authController.verifyToken, async (req, res) => {
    try {
        const { floorId } = req.query;
        const rooms = await Room.getAll(floorId ? parseInt(floorId) : null);
        res.json({
            success: true,
            data: rooms
        });
    } catch (error) {
        console.error('Get rooms error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des chambres'
        });
    }
});

// Create room
router.post('/', authController.verifyToken, async (req, res) => {
    try {
        const room = await Room.create(req.body);
        res.status(201).json({ success: true, data: room });
    } catch (error) {
        console.error('Create room error:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la création de la chambre' });
    }
});

// Update room
router.put('/:id', authController.verifyToken, async (req, res) => {
    try {
        const room = await Room.update(req.params.id, req.body);
        res.json({ success: true, data: room });
    } catch (error) {
        console.error('Update room error:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la modification de la chambre' });
    }
});

// Delete room
router.delete('/:id', authController.verifyToken, async (req, res) => {
    try {
        await Room.delete(req.params.id);
        res.json({ success: true, message: 'Chambre supprimée' });
    } catch (error) {
        console.error('Delete room error:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la suppression de la chambre' });
    }
});

export default router;
