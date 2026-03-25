import express from 'express';
import Floor from './floor.model.js';
import authController from '../auth/auth.controller.js';

const router = express.Router();

// Get all floors
router.get('/', async (req, res) => {
  try {
    const floors = await Floor.getAll();
    res.json({
      success: true,
      data: floors
    });
  } catch (error) {
    console.error('Get floors error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des étages'
    });
  }
});

// Get floor by id
router.get('/:id', authController.verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const floor = await Floor.getById(id);
    if (!floor) {
      return res.status(404).json({
        success: false,
        message: 'Étage non trouvé'
      });
    }
    res.json({
      success: true,
      data: floor
    });
  } catch (error) {
    console.error('Get floor error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'étage'
    });
  }
});

// Create floor
router.post('/', authController.verifyToken, async (req, res) => {
  try {
    const floor = await Floor.create(req.body);
    res.status(201).json({ success: true, data: floor });
  } catch (error) {
    console.error('Create floor error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de l\'étage' });
  }
});

// Update floor
router.put('/:id', authController.verifyToken, async (req, res) => {
  try {
    const floor = await Floor.update(req.params.id, req.body);
    res.json({ success: true, data: floor });
  } catch (error) {
    console.error('Update floor error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la modification de l\'étage' });
  }
});

// Delete floor
router.delete('/:id', authController.verifyToken, async (req, res) => {
  try {
    await Floor.delete(req.params.id);
    res.json({ success: true, message: 'Étage supprimé' });
  } catch (error) {
    console.error('Delete floor error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression de l\'étage' });
  }
});

export default router;
