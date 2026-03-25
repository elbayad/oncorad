import './core/config/env.js'; // MUST BE FIRST
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './core/config/database.js';

// Force restart 2

// Modules Imports
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/auth/user.routes.js';
import moduleRoutes from './modules/shared/module.routes.js';
import ambulanceRoutes from './modules/hospital/ambulance.routes.js';
// mqttRoutes 
import mqttRoutes from './modules/shared/mqtt.routes.js';
import dossierPatientRoutes from './modules/hospital/patient.routes.js';
import mapLinesRoutes from './modules/rtls/map-lines.routes.js';
import floorDataRoutes from './modules/rtls/floor-data.routes.js';

import floorRoutes from './modules/rtls/floors.routes.js';
import roomRoutes from './modules/rtls/rooms.routes.js';
import zoneRoutes from './modules/rtls/zones.routes.js';
import anchorRoutes from './modules/rtls/anchors.routes.js';
import Anchor from './modules/rtls/anchor.model.js';
import calibrationRoutes from './modules/shared/calibration.routes.js';
import assetRoutes from './modules/hospital/asset.routes.js';
import oxygenPointsRoutes from './modules/iot/oxygen/oxygen.routes.js';
import energyMetersRoutes from './modules/iot/energy/energy.routes.js';
import airSensorsRoutes from './modules/iot/air/air.routes.js';
import admissionRoutes from './modules/hospital/admission.routes.js';
import episodeRoutes from './modules/hospital/episode.routes.js';
import rtlsProfilerRoutes from './modules/rtls/rtls-profiler.routes.js';
import tuningRoutes from './modules/rtls/tuning.routes.js';
// mqttService
import mqttService from './modules/shared/mqtt-service.js';
import oxygenTanksRoutes from './modules/iot/oxygen/oxygen-tanks.routes.js';
import sirenRoutes from './modules/iot/sirens/sirens.routes.js';
import reportingRoutes from './modules/shared/reporting.routes.js';
import energySettingsRoutes from './modules/iot/energy/energy-settings.routes.js';

// Decoupled Services (Auto-initialize on import)
import './modules/iot/energy/energy.service.js';
import './modules/iot/air/air.service.js';
import './modules/iot/oxygen/oxygen.service.js';
// Models
import EnergyMeter from './modules/iot/energy/energy.model.js';
import OxygenTank from './modules/iot/oxygen/oxygen-tank.model.js';
import OxygenPoint from './modules/iot/oxygen/oxygen.model.js';
import AirSensor from './modules/iot/air/air.model.js';
// Service
import './modules/rtls/geofence.service.js';

const app = express();

// Configuration __dirname pour ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware CORS
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:5175', 'http://localhost:5176'];

app.use(cors({
  origin: (origin, callback) => {
    // 1. Toujours autoriser localhost/127.0.0.1 pour le développement (même en production)
    if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }

    // 2. Autoriser les origines configurées (Postman, mobile apps, etc.)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Sinon bloqué
    console.warn(`🚫 CORS bloqué pour origine: ${origin}`);
    console.warn(`✅ Origines autorisées:`, allowedOrigins);
    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath, {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));
  console.log('📦 Serving static files from:', distPath);
}

// Serve public folder (for calibration agent and other tools)
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/api/mqtt', mqttRoutes);
app.use('/api/dossiers', dossierPatientRoutes);
app.use('/api/map-lines', mapLinesRoutes);
app.use('/api/floordata', floorDataRoutes);

app.use('/api/floors', floorRoutes);
app.use('/api/rooms', roomRoutes);

// Public room centroids for RTLS map overlay (no auth)
app.get('/api/room-centroids', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, room_number AS name, floor_id, anchor_x, anchor_y
             FROM rooms WHERE is_active = true AND anchor_x IS NOT NULL AND anchor_y IS NOT NULL`
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Public inventory for the new inventory page
app.get('/api/public/inventory', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, floor_id, created_at, room, category 
       FROM assets 
       WHERE status = 'active'
       ORDER BY name ASC`
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Advanced filters metadata
app.get('/api/public/filters', async (req, res) => {
  try {
    const categories = await pool.query(`SELECT DISTINCT category FROM assets WHERE category IS NOT NULL ORDER BY category`);
    const floorRooms = await pool.query(`SELECT DISTINCT floor_id, room FROM assets WHERE room IS NOT NULL AND room != '' ORDER BY room`);

    res.json({
      success: true,
      data: {
        categories: categories.rows.map(r => r.category),
        floorRooms: floorRooms.rows
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Public floors for filtering
app.get('/api/public/floors', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name FROM floors ORDER BY id ASC`
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
app.use('/api/zones', zoneRoutes);
app.use('/api/anchors', anchorRoutes);
app.use('/api/calibration', calibrationRoutes);
app.use('/api/assets', assetRoutes);
console.log('🔵 REGISTERING OXYGEN ROUTES');
app.use('/api/oxygen', oxygenPointsRoutes);
app.use('/api/oxygen-tanks', oxygenTanksRoutes);
app.use('/api/sirens', sirenRoutes);
app.use('/api/energy', energyMetersRoutes);
app.use('/api/energy/settings', energySettingsRoutes);
app.use('/api/air', airSensorsRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/episodes', episodeRoutes);
app.use('/api/reporting', reportingRoutes);
app.use('/api/tuning', tuningRoutes);
app.use('/api/rtls-profiler', rtlsProfilerRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Clinic API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Erreur serveur interne'
  });
});

// Serve React app in production (fallback for SPA)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
} else {
  // 404 handler for development
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route non trouvée'
    });
  });
}

const PORT = process.env.PORT || 8789;

// Global Error Handlers
process.on('uncaughtException', (err) => {
  console.error('🔥 CRITICAL: Uncaught Exception:', err);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialisation du serveur avec MQTT
async function startServer() {
  try {
    // Initialiser le service MQTT
    await mqttService.initialize();

    // Démarrer le serveur Express
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server actually running on:`, server.address());
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔌 MQTT Status: ${mqttService.isConnected() ? '✅ Connecté' : '❌ Déconnecté'}`);

      // Start Cleanup Jobs (every 60s) for Energy & Oxygen
      setInterval(async () => {
        try {
          // 1. Energy Meters
          const energyUpdated = await EnergyMeter.markInactiveMeters(5);
          if (energyUpdated.length > 0) {
            console.log(`[Energy] Marked ${energyUpdated.length} meters as offline.`);
          }

          // 2. Oxygen Tanks
          const oxygenTanksUpdated = await OxygenTank.markInactiveTanks(5);
          if (oxygenTanksUpdated.length > 0) {
            console.log(`[Oxygen] Marked ${oxygenTanksUpdated.length} tanks as offline.`);
          }

          // 3. Oxygen Points (Valves)
          const oxygenPointsUpdated = await OxygenPoint.markInactivePoints(5);
          if (oxygenPointsUpdated.length > 0) {
            console.log(`[Oxygen] Marked ${oxygenPointsUpdated.length} points as offline.`);
          }

          // 4. Air Sensors
          const airSensorsUpdated = await AirSensor.markInactiveSensors(5);
          if (airSensorsUpdated.length > 0) {
            console.log(`[Air] Marked ${airSensorsUpdated.length} sensors as offline.`);
          }

          // 5. Anchors (Gateways)
          const anchorsUpdated = await Anchor.markInactiveAnchors(120); // 120s timeout
          if (anchorsUpdated.length > 0) {
            console.log(`[Anchors] Marked ${anchorsUpdated.length} gateways as offline.`);
          }
        } catch (err) {
          console.error('[Cleanup] Error:', err);
        }
      }, 60000);
    });

    // Initialiser WebSocket Server
    const wss = new WebSocketServer({ server, path: '/api/ws' });

    wss.on('connection', (ws) => {
      const clientId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      // console.log(`[WS] Client connecté: ${clientId}`);

      // Ajouter le subscriber au service MQTT
      mqttService.addSubscriber(clientId, ws);

      ws.on('close', () => {
        // console.log(`[WS] Client déconnecté: ${clientId}`);
        mqttService.removeSubscriber(clientId);
      });

      ws.on('error', (err) => {
        console.error(`[WS] Erreur client ${clientId}:`, err);
        mqttService.removeSubscriber(clientId);
      });
    });

    console.log('[WS] WebSocket Server initialized');
  } catch (error) {
    console.error('❌ Erreur au démarrage du serveur:', error);
    process.exit(1);
  }
}

// Gestion de l'arrêt propre
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM reçu, arrêt du serveur...');
  await mqttService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT reçu, arrêt du serveur...');
  await mqttService.disconnect();
  process.exit(0);
});

// Démarrer le serveur
console.log('🔄 Server is starting...');
startServer();

export default app;