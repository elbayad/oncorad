import express from 'express';
import User from './user.model.js';
import Module from '../shared/module.model.js';
import authController from '../auth/auth.controller.js';

const router = express.Router();

// Middleware to verify admin role
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès administrateur requis'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur de vérification des permissions'
    });
  }
};

// Get all users (admin only)
router.get('/', authController.verifyToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.getAll();
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs'
    });
  }
});

// Create user (admin only)
router.post('/', authController.verifyToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role, floor_access, modules } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs obligatoires doivent être remplis'
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Un utilisateur avec cet email existe déjà'
      });
    }

    // Create user
    const newUser = await User.create({
      email,
      password,
      name,
      role,
      floor_access: floor_access || 0
    });

    // Grant modules if provided
    if (modules && modules.length > 0) {
      for (const moduleId of modules) {
        await Module.grantModuleToUser(newUser.id, moduleId, req.userId);
      }
    }

    res.status(201).json({
      success: true,
      data: newUser,
      message: 'Utilisateur créé avec succès'
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'utilisateur'
    });
  }
});

// Update user (admin only)
router.put('/:id', authController.verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, floor_access, is_active, modules } = req.body;

    const updatedUser = await User.update(id, {
      name,
      role,
      floor_access,
      is_active
    });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Update modules if provided
    if (modules !== undefined) {
      // Remove all current modules
      const currentModules = await User.getUserModules(id);
      for (const module of currentModules) {
        await Module.revokeModuleFromUser(id, module.id);
      }

      // Grant new modules
      for (const moduleId of modules) {
        await Module.grantModuleToUser(id, moduleId, req.userId);
      }
    }

    res.json({
      success: true,
      data: updatedUser,
      message: 'Utilisateur mis à jour avec succès'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'utilisateur'
    });
  }
});

// Delete user (admin only)
router.delete('/:id', authController.verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const success = await User.delete(id);
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Utilisateur supprimé avec succès'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'utilisateur'
    });
  }
});

// Get user modules
router.get('/:id/modules', authController.verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const modules = await User.getUserModules(id);

    res.json({
      success: true,
      data: modules
    });
  } catch (error) {
    console.error('Get user modules error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des modules'
    });
  }
});

// Reset user password (admin only)
router.patch('/:id/password', authController.verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    await User.updatePassword(id, password);

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation du mot de passe'
    });
  }
});

export default router;