import { Pool } from 'pg';
import './env.js'; // Ensure env is loaded first

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'iot_clinic_db',
  user: process.env.DB_USER || 'clinic_admin',
  password: process.env.DB_PASSWORD || 'clinic123',
  max: 50, // Increased from 15 to handle RTLS load
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased from 5s to 10s for resilience
  // S'assurer que le schéma public est dans le search_path
  options: '-c search_path=public'
});

// Test connection et définir search_path pour chaque connexion
pool.on('connect', async (client) => {
  console.log(`✅ Connected to PostgreSQL at ${process.env.DB_HOST || 'localhost'} as ${process.env.DB_USER || 'clinic_admin'}`);
  // S'assurer que le search_path est défini
  try {
    await client.query('SET search_path TO public, pg_catalog');
  } catch (err) {
    console.warn('⚠️ Could not set search_path:', err.message);
  }
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

export default pool;