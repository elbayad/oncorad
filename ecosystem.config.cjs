/**
 * PM2 Configuration pour IoT Clinic (Oncorad)
 * Gestion du Backend API et du Frontend de Développement LAN
 */

const dotenv = require('dotenv');
const path = require('path');

// Chargement des variables d'environnement depuis le fichier .env à la racine
dotenv.config();

module.exports = {
  apps: [
    // 1. BACKEND API
    {
      name: 'iot-clinic-backend',
      script: 'app.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork', // Conformément à la contrainte
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 8789,
        CORS_ORIGIN: "http://192.168.100.5,http://192.168.100.5:5175,http://localhost:5175,http://127.0.0.1:5175,http://localhost:8789,https://app.iotoncorad.com"
      },
      // Gestion des logs
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      merge_logs: true,
      time: true
    },

    // 2. FRONTEND VITE (Mode DEV pour accès LAN)
    {
      name: 'iot-clinic-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork', // Pas de cluster pour le frontend
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development'
      },
      // Gestion des logs
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
