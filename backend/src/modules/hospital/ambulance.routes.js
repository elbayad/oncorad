import express from 'express';
import Ambulance from './ambulance.model.js';
import authController from '../auth/auth.controller.js';

const router = express.Router();

// Get all ambulances
router.get('/', authController.verifyToken, async (req, res) => {
  try {
    const ambulances = await Ambulance.getAll();

    // Debug: vérifier le nombre d'ambulances et imei_tablette
    // console.log(`✅ Nombre d'ambulances récupérées: ${ambulances ? ambulances.length : 0}`);

    // if (ambulances && ambulances.length > 0) {
    //   console.log('Première ambulance du serveur:', ambulances[0]);
    //   console.log('Champs disponibles dans la première ambulance:', Object.keys(ambulances[0]));
    //   console.log('imei_tablette value:', ambulances[0].imei_tablette);

    //   // Afficher toutes les ambulances
    //   ambulances.forEach((amb, index) => {
    //     console.log(`Ambulance ${index + 1}:`, {
    //       id: amb.id,
    //       call_sign: amb.call_sign,
    //       status: amb.status,
    //       imei_tablette: amb.imei_tablette
    //     });
    //   });
    // } else {
    //   console.warn('⚠️ Aucune ambulance trouvée dans la base de données');
    // }

    res.json({
      success: true,
      data: ambulances || []
    });
  } catch (error) {
    console.error('❌ Get ambulances error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des ambulances',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Create ambulance
router.post('/', authController.verifyToken, async (req, res) => {
  try {
    const ambulance = await Ambulance.create(req.body);
    res.status(201).json({ success: true, data: ambulance });
  } catch (error) {
    console.error('Create ambulance error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de l\'ambulance' });
  }
});

// Update ambulance (general)
router.put('/:id', authController.verifyToken, async (req, res) => {
  try {
    const ambulance = await Ambulance.update(req.params.id, req.body);
    if (!ambulance) return res.status(404).json({ success: false, message: 'Ambulance non trouvée' });
    res.json({ success: true, data: ambulance });
  } catch (error) {
    console.error('Update ambulance error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour de l\'ambulance' });
  }
});

// Delete ambulance
router.delete('/:id', authController.verifyToken, async (req, res) => {
  try {
    await Ambulance.delete(req.params.id);
    res.json({ success: true, message: 'Ambulance supprimée' });
  } catch (error) {
    console.error('Delete ambulance error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression de l\'ambulance' });
  }
});

// Update ambulance location
router.put('/:id/location', authController.verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng, address } = req.body;

    const ambulance = await Ambulance.updateLocation(id, lat, lng, address);
    if (!ambulance) {
      return res.status(404).json({
        success: false,
        message: 'Ambulance non trouvée'
      });
    }

    res.json({
      success: true,
      data: ambulance
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la position'
    });
  }
});

// Update ambulance status
router.put('/:id/status', authController.verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const ambulance = await Ambulance.updateStatus(id, status);
    if (!ambulance) {
      return res.status(404).json({
        success: false,
        message: 'Ambulance non trouvée'
      });
    }

    res.json({
      success: true,
      data: ambulance
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut'
    });
  }
});

// Get ambulance missions
router.get('/:id/missions', authController.verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const missions = await Ambulance.getMissions(id);

    res.json({
      success: true,
      data: missions
    });
  } catch (error) {
    console.error('Get missions error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des missions'
    });
  }
});

// Create mission
router.post('/missions', authController.verifyToken, async (req, res) => {
  try {
    const mission = await Ambulance.createMission(req.body);

    res.status(201).json({
      success: true,
      data: mission
    });
  } catch (error) {
    console.error('Create mission error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la mission'
    });
  }
});

export default router;