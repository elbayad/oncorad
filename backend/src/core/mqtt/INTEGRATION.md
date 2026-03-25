# Module MQTT MACHWATT - Guide d'intégration

## 🎯 Vue d'ensemble

Le module MQTT MACHWATT est un module réutilisable qui permet de se connecter au broker MQTT et de traiter les données de différents types de capteurs. Il peut être utilisé par plusieurs applications simultanément.

## 📁 Structure du module

```
mqtt/
├── index.js              # Module principal
├── config.js             # Configuration et utilitaires
├── examples.js           # Exemples d'utilisation
├── test.js               # Tests unitaires
├── package.json          # Dépendances npm
├── README.md             # Documentation
├── config.env.example    # Exemple de configuration
├── deploy.js             # Script de déploiement Node.js
└── deploy.sh             # Script de déploiement Bash
```

## 🔌 Topics supportés

| Topic | Description | Format des données |
|-------|-------------|-------------------|
| `topic/energie` | Capteurs énergétiques monophasés | MAC, tension, courant, puissance, énergie |
| `topic/energie3` | Capteurs énergétiques triphasés | Device ID, tensions A/B/C, courants A/B/C, puissance totale |
| `topic/air` | Capteurs de qualité d'air | Température, humidité, CO2, PM2.5, PM10 |
| `topic/rtls` | Système de localisation temps réel | Position X/Y/Z, précision, batterie |
| `topic/o2` | Capteurs d'oxygène | Niveau O2, température, pression, batterie |

## 🚀 Installation

### 1. Cloner le module

```bash
# Dans votre projet
mkdir mqtt-module
cd mqtt-module

# Copier les fichiers du module
cp -r /path/to/machwatt/mqtt/* .
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configuration

```bash
# Copier l'exemple de configuration
cp config.env.example .env

# Modifier selon vos besoins
nano .env
```

## 🔧 Utilisation dans vos applications

### Application 1: MACHWATT (Énergie)

```javascript
// machwatt-server.js
import { getMqttModule, MQTT_TOPICS } from './mqtt/index.js';

const mqtt = getMqttModule({
  clientId: 'machwatt-prod',
  url: 'mqtt://tanger.geodaki.com:1883'
});

await mqtt.connect();

// S'abonner aux topics énergétiques
await mqtt.subscribe(MQTT_TOPICS.ENERGIE);
await mqtt.subscribe(MQTT_TOPICS.ENERGIE3);

mqtt.on('message', (topic, data) => {
  console.log(`[MACHWATT] ${topic}:`, data.deviceId, data.data);
  // Traitement des données énergétiques...
});
```

### Application 2: SiloSense (Air + RTLS)

```javascript
// silosense-server.js
import { createMqttModule, MQTT_TOPICS } from './mqtt/index.js';

const mqtt = createMqttModule({
  clientId: 'silosense-prod',
  url: 'mqtt://tanger.geodaki.com:1883'
});

await mqtt.connect();

// S'abonner aux topics air et RTLS
await mqtt.subscribe(MQTT_TOPICS.AIR);
await mqtt.subscribe(MQTT_TOPICS.RTLS);

mqtt.on('message', (topic, data) => {
  console.log(`[SiloSense] ${topic}:`, data.deviceId, data.data);
  // Traitement des données air et localisation...
});
```

### Application 3: AirMonitor (Air uniquement)

```javascript
// airmonitor-server.js
import { MqttModule, MQTT_TOPICS } from './mqtt/index.js';

const mqtt = new MqttModule({
  clientId: 'airmonitor-prod',
  url: 'mqtt://tanger.geodaki.com:1883'
});

await mqtt.connect();
await mqtt.subscribe(MQTT_TOPICS.AIR);

mqtt.on('message', (topic, data) => {
  console.log(`[AirMonitor] Air quality:`, data.data);
  // Traitement des données qualité d'air...
});
```

## 🔄 Gestion des événements

```javascript
mqtt.on('connected', () => {
  console.log('✅ Connecté au broker MQTT');
});

mqtt.on('disconnected', () => {
  console.log('❌ Déconnecté du broker MQTT');
});

mqtt.on('message', (topic, data) => {
  console.log(`📨 Message reçu sur ${topic}:`);
  console.log(`   Device: ${data.deviceId}`);
  console.log(`   Timestamp: ${data.timestamp}`);
  console.log(`   Données:`, data.data);
});

mqtt.on('error', (error) => {
  console.error('❌ Erreur MQTT:', error);
});

mqtt.on('reconnecting', () => {
  console.log('🔄 Tentative de reconnexion...');
});
```

## 📊 Format des données parsées

### ENERGIE (topic/energie)
```javascript
{
  topic: 'topic/energie',
  timestamp: '2025-01-28T10:30:00.000Z',
  deviceId: '78:42:1c:8d:8a:14',
  mac: '78:42:1c:8d:8a:14',
  data: {
    tension: 230,      // V
    courant: 5.5,      // A
    puissance: 1265,   // W
    energie: 100,      // kWh
    wifi: -45,         // dBm
    temperature: 25    // °C
  },
  raw: { /* données brutes */ }
}
```

### ENERGIE3 (topic/energie3)
```javascript
{
  topic: 'topic/energie3',
  timestamp: '2025-01-28T10:30:00.000Z',
  deviceId: '25101509130001',
  mac: '25101509130001',
  data: {
    tensionA: 230,     // V
    tensionB: 230,     // V
    tensionC: 230,     // V
    tensionAB: 400,    // V
    tensionBC: 400,    // V
    tensionCA: 400,    // V
    courantA: 5.5,     // A
    courantB: 5.5,     // A
    courantC: 5.5,     // A
    puissanceTotale: 3800,  // W
    energiePositive: 100,    // kWh
    energieNegative: 0.8,   // kWh
    frequence: 50,     // Hz
    wifi: -45,         // dBm
    temperatureA: 25,   // °C
    temperatureB: 25,  // °C
    temperatureC: 25,  // °C
    courantFuite: 0.01 // A
  },
  raw: { /* données brutes */ }
}
```

## 🛠️ Configuration avancée

### Variables d'environnement

```bash
# Broker MQTT
MQTT_URL=mqtt://tanger.geodaki.com:1883
MQTT_CLIENT_ID=machwatt-module
MQTT_KEEPALIVE=60
MQTT_RECONNECT_PERIOD=5000
MQTT_CONNECT_TIMEOUT=30000
MQTT_QOS=1
MQTT_CLEAN=true

# Logging
MQTT_LOG_LEVEL=info
MQTT_LOG_MESSAGES=false
```

### Configuration par environnement

```javascript
import { getConfig } from './mqtt/config.js';

// Développement
const devConfig = getConfig('development');

// Production
const prodConfig = getConfig('production');

// Test
const testConfig = getConfig('test');
```

## 🧪 Tests et validation

```bash
# Exécuter les tests
npm test

# Exécuter les exemples
node examples.js

# Test de connectivité
node -e "
import('./index.js').then(m => {
  const client = new m.MqttModule();
  client.connect().then(() => {
    console.log('✅ Connexion réussie');
    process.exit(0);
  }).catch(e => {
    console.error('❌ Connexion échouée:', e.message);
    process.exit(1);
  });
});
"
```

## 🔧 Intégration avec PM2

### ecosystem.config.cjs

```javascript
module.exports = {
  apps: [
    {
      name: 'machwatt-mqtt',
      script: 'mqtt/index.js',
      env: {
        NODE_ENV: 'production',
        MQTT_URL: 'mqtt://tanger.geodaki.com:1883',
        MQTT_CLIENT_ID: 'machwatt-prod',
        MQTT_TOPICS: 'topic/energie,topic/energie3'
      }
    }
  ]
};
```

## 📈 Monitoring et logs

```javascript
// Ajouter des métriques
let messageCount = 0;
let lastMessageTime = null;

mqtt.on('message', (topic, data) => {
  messageCount++;
  lastMessageTime = new Date();
  
  // Log des métriques
  if (messageCount % 100 === 0) {
    console.log(`📊 ${messageCount} messages reçus, dernier: ${lastMessageTime}`);
  }
});

// Health check
setInterval(() => {
  console.log(`💓 MQTT Status: ${mqtt.connected ? 'Connected' : 'Disconnected'}`);
  console.log(`📡 Topics: ${mqtt.topics.join(', ')}`);
}, 30000);
```

## 🚨 Gestion d'erreurs

```javascript
mqtt.on('error', (error) => {
  console.error('❌ Erreur MQTT:', error);
  
  // Envoyer une alerte
  sendAlert('MQTT Error', error.message);
});

mqtt.on('reconnecting', () => {
  console.log('🔄 Reconnexion en cours...');
  
  // Désactiver temporairement certaines fonctionnalités
  setMaintenanceMode(true);
});

mqtt.on('connected', () => {
  console.log('✅ Reconnexion réussie');
  
  // Réactiver les fonctionnalités
  setMaintenanceMode(false);
});
```

## 📋 Checklist de déploiement

- [ ] Module MQTT installé et configuré
- [ ] Variables d'environnement définies
- [ ] Tests passés avec succès
- [ ] Connectivité MQTT vérifiée
- [ ] Topics appropriés configurés
- [ ] Gestion d'erreurs implémentée
- [ ] Monitoring et logs configurés
- [ ] Documentation mise à jour

## 🔗 Liens utiles

- [Documentation MQTT.js](https://github.com/mqttjs/MQTT.js)
- [Guide MQTT](https://mqtt.org/mqtt-specification/)
- [Exemples d'utilisation](./examples.js)
- [Tests unitaires](./test.js)
