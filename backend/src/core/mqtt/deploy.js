/**
 * Script de déploiement pour le module MQTT
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';


// Vérifier Node.js
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
} catch (error) {
  console.error('❌ Node.js non trouvé. Veuillez installer Node.js 18+');
  process.exit(1);
}

// Vérifier npm
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
} catch (error) {
  console.error('❌ npm non trouvé');
  process.exit(1);
}

// Installer les dépendances
try {
  execSync('npm install', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Erreur installation dépendances:', error.message);
  process.exit(1);
}

// Créer le fichier .env s'il n'existe pas
const envPath = join(process.cwd(), '.env');
try {
  readFileSync(envPath, 'utf8');
} catch (error) {
  const envContent = `# Configuration MQTT
MQTT_URL=mqtt://tanger.geodaki.com:1883
MQTT_CLIENT_ID=machwatt-module
MQTT_KEEPALIVE=60
MQTT_RECONNECT_PERIOD=5000
MQTT_CONNECT_TIMEOUT=30000
MQTT_QOS=1
MQTT_CLEAN=true
MQTT_LOG_LEVEL=info
MQTT_LOG_MESSAGES=false
`;
  writeFileSync(envPath, envContent);
}

// Exécuter les tests
try {
  execSync('npm test', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Tests échoués:', error.message);
  process.exit(1);
}

// Vérifier la connectivité MQTT
try {
  execSync('timeout 10s node -e "import(\'./index.js\').then(m => { const client = new m.MqttModule(); client.connect().then(() => { console.log(\'✅ Connexion MQTT réussie\'); process.exit(0); }).catch(e => { console.error(\'❌ Connexion MQTT échouée:\', e.message); process.exit(1); }); })"', { stdio: 'inherit' });
} catch (error) {
}

