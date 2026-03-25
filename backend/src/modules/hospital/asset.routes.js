import express from 'express';
import Asset from '../hospital/asset.model.js';
import authController from '../auth/auth.controller.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Search assets by name
router.get('/types', authController.verifyToken, async (req, res) => {
  try {
    const types = await Asset.getTypes();
    res.json({ success: true, data: types });
  } catch (error) {
    console.error('Get asset types error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des types d\'assets' });
  }
});

router.post('/types', authController.verifyToken, async (req, res) => {
  try {
    const type = await Asset.createType(req.body);
    res.status(201).json({ success: true, data: type });
  } catch (error) {
    console.error('Create asset type error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création du type d\'asset' });
  }
});

router.put('/types/:id', authController.verifyToken, async (req, res) => {
  try {
    const type = await Asset.updateType(parseInt(req.params.id), req.body);
    res.json({ success: true, data: type });
  } catch (error) {
    console.error('Update asset type error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la modification du type d\'asset' });
  }
});

router.delete('/types/:id', authController.verifyToken, async (req, res) => {
  try {
    await Asset.deleteType(parseInt(req.params.id));
    res.json({ success: true, message: 'Type d\'asset supprimé' });
  } catch (error) {
    console.error('Delete asset type error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression du type d\'asset' });
  }
});

router.get('/categories', authController.verifyToken, async (req, res) => {
  try {
    const categories = await Asset.getCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get asset categories error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des catégories d\'assets' });
  }
});

router.post('/categories', authController.verifyToken, async (req, res) => {
  try {
    const category = await Asset.createCategory(req.body);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    console.error('Create asset category error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de la catégorie d\'asset' });
  }
});

router.put('/categories/:id', authController.verifyToken, async (req, res) => {
  try {
    const category = await Asset.updateCategory(req.params.id, req.body);
    res.json({ success: true, data: category });
  } catch (error) {
    console.error('Update asset category error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la modification de la catégorie d\'asset' });
  }
});

router.delete('/categories/:id', authController.verifyToken, async (req, res) => {
  try {
    await Asset.deleteCategory(req.params.id);
    res.json({ success: true, message: 'Catégorie d\'asset supprimée' });
  } catch (error) {
    console.error('Delete asset category error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression de la catégorie d\'asset' });
  }
});

router.get('/search', authController.verifyToken, async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Le nom de l\'asset est requis'
      });
    }

    const assets = await Asset.searchByName(name.trim());

    res.json({
      success: true,
      data: assets
    });
  } catch (error) {
    console.error('Search assets error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche d\'assets'
    });
  }
});

// Get all assets
router.get('/', authController.verifyToken, async (req, res) => {
  try {
    const { floorId, typeId } = req.query;
    // console.log('🔵 GET /api/assets - floorId:', floorId, 'typeId:', typeId);

    const assets = await Asset.getAll(
      floorId ? parseInt(floorId) : null,
      typeId
    );

    // console.log('✅ Assets récupérés de la base:', assets ? assets.length : 0);
    if (assets && assets.length > 0) {
      // console.log('✅ Premier asset:', {
      //   id: assets[0].id,
      //   name: assets[0].name,
      //   floor_id: assets[0].floor_id,
      //   coordinates_x: assets[0].coordinates_x,
      //   coordinates_y: assets[0].coordinates_y
      // });
    }

    res.json({
      success: true,
      data: assets || []
    });
  } catch (error) {
    console.error('❌ Get assets error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des assets',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get single asset by ID
router.get('/:id', authController.verifyToken, async (req, res) => {
  try {
    // console.log(`🔵 GET /api/assets/${req.params.id}`);
    const asset = await Asset.getById(req.params.id);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset non trouvé' });
    }
    res.json({ success: true, data: asset });
  } catch (error) {
    console.error('Get asset error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération de l\'asset' });
  }
});

// Create asset
router.post('/', authController.verifyToken, async (req, res) => {
  try {
    const asset = await Asset.create(req.body);
    res.status(201).json({ success: true, data: asset });
  } catch (error) {
    console.error('Create asset error:', error);
    if (error.code === '23505') { // unique_violation
      return res.status(409).json({ success: false, message: 'Cet ID existe déjà. Veuillez utiliser le mode édition ou attendre le chargement des données.' });
    }
    res.status(500).json({ success: false, message: 'Erreur lors de la création de l\'asset', error: error.message });
  }
});

// Update asset
router.put('/:id', authController.verifyToken, async (req, res) => {
  try {
    const asset = await Asset.updateDetails(req.params.id, req.body);
    res.json({ success: true, data: asset });
  } catch (error) {
    console.error('Update asset error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la modification de l\'asset' });
  }
});

// Delete asset
router.delete('/:id', authController.verifyToken, async (req, res) => {
  try {
    await Asset.delete(req.params.id);
    res.json({ success: true, message: 'Asset supprimé' });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression de l\'asset' });
  }
});

// Get asset history
router.get('/:id/history', authController.verifyToken, async (req, res) => {
  try {
    const { start, end, limit } = req.query;

    const history = await Asset.getTrackingHistory(
      req.params.id,
      start,
      end,
      limit ? parseInt(limit) : undefined
    );

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération de l\'historique' });
  }
});

// Get asset zone movement history
router.get('/:id/zone-history', authController.verifyToken, async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ success: false, message: 'Les paramètres start et end sont requis' });
    }

    const history = await Asset.getZoneMovementHistory(req.params.id, start, end);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Get zone history error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération de l\'historique des zones' });
  }
});

// Upload photo
router.post('/upload-photo', authController.verifyToken, async (req, res) => {
  try {
    const { id, image } = req.body;

    if (!id || !image) {
      return res.status(400).json({ success: false, message: 'ID et image requis' });
    }

    // Remove header if present (data:image/jpeg;base64,...)
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    // Construct path: server/routes/../../public/photos/ = root/public/photos/
    const photoDir = path.join(__dirname, '../../public/photos');

    // Ensure directory exists
    if (!fs.existsSync(photoDir)) {
      fs.mkdirSync(photoDir, { recursive: true });
    }

    const filePath = path.join(photoDir, `${id}.jpg`);

    await fs.promises.writeFile(filePath, base64Data, 'base64');


    res.json({ success: true, message: 'Photo uploadée avec succès', path: `/photos/${id}.jpg` });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'upload de la photo' });
  }
});

// Update asset location (including zone)
router.put('/:id/location', authController.verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { floor_id, zone, room, x, y, last_room_id } = req.body;

    const asset = await Asset.updateLocation(id, floor_id, zone, x || 0, y || 0, last_room_id || null);

    if (!asset) {
      // If asset not found or not updated
      return res.status(404).json({ success: false, message: 'Asset non trouvé' });
    }

    res.json({ success: true, data: asset });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour de la localisation' });
  }
});

export default router;
