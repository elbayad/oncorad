/**
 * Routes MQTT pour l'API
 */

import express from 'express';
import mqttService from './mqtt-service.js';

const router = express.Router();

/**
 * GET /api/mqtt/stats
 * Obtenir les statistiques MQTT
 */
router.get('/stats', (req, res) => {
  try {
    const stats = mqttService.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des stats MQTT'
    });
  }
});

/**
 * GET /api/mqtt/history
 * Obtenir l'historique des messages
 */
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const topic = req.query.topic;
    const deviceId = req.query.deviceId;

    let history;

    if (topic) {
      history = mqttService.getHistoryByTopic(topic, limit);
    } else if (deviceId) {
      history = mqttService.getHistoryByDevice(deviceId, limit);
    } else {
      history = mqttService.getHistory(limit);
    }

    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique'
    });
  }
});

/**
 * GET /api/mqtt/status
 * Obtenir l'état de connexion MQTT
 */
router.get('/status', (req, res) => {
  try {
    const isConnected = mqttService.isConnected();
    
    res.json({
      success: true,
      data: {
        connected: isConnected,
        message: isConnected 
          ? 'Connecté au broker MQTT' 
          : 'Non connecté au broker MQTT'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du statut'
    });
  }
});

/**
 * POST /api/mqtt/reconnect
 * Forcer la reconnexion au broker MQTT
 */
router.post('/reconnect', async (req, res) => {
  try {
    await mqttService.disconnect();
    await mqttService.initialize();

    res.json({
      success: true,
      message: 'Reconnexion au broker MQTT effectuée'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la reconnexion au broker MQTT'
    });
  }
});

/**
 * GET /api/mqtt/devices
 * Obtenir la liste des devices actifs
 */
router.get('/devices', (req, res) => {
  try {
    const stats = mqttService.getStats();
    
    res.json({
      success: true,
      data: {
        devices: stats.devices,
        count: stats.devicesCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des devices'
    });
  }
});

export default router;

