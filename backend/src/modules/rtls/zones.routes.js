import express from 'express';
import Zone from './zone.model.js';

const router = express.Router();

// Get all zones
router.get('/', async (req, res) => {
    try {
        const zones = await Zone.getAll();
        res.json({ success: true, data: zones });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});



// Create zone
router.post('/', async (req, res) => {
    try {
        const zone = await Zone.create(req.body);
        res.json({ success: true, data: zone });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur création zone' });
    }
});

// Update zone
router.put('/:id', async (req, res) => {
    try {
        const zone = await Zone.update(req.params.id, req.body);
        res.json({ success: true, data: zone });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur mise à jour zone' });
    }
});

// Delete zone
router.delete('/:id', async (req, res) => {
    try {
        await Zone.delete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur suppression zone' });
    }
});

export default router;
