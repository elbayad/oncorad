import express from 'express';
import Module from '../shared/module.model.js';
import authController from '../auth/auth.controller.js';

const router = express.Router();

// Get all modules
router.get('/', authController.verifyToken, async (req, res) => {
  try {
    const modules = await Module.getAll();
    res.json({
      success: true,
      data: modules
    });
  } catch (error) {
    console.error('Get modules error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des modules'
    });
  }
});

export default router;