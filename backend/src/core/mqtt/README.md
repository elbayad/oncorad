# Module MQTT MACHWATT

Module MQTT réutilisable pour MACHWATT et autres applications IoT.

## 🚀 Installation

```bash
cd mqtt
npm install
```

## 📋 Topics supportés

- `topic/energie` - Capteurs énergétiques monophasés
- `topic/energie3` - Capteurs énergétiques triphasés  
- `topic/air` - Capteurs de qualité d'air
- `topic/rtls` - Système de localisation en temps réel
- `topic/o2` - Capteurs d'oxygène

## 🔧 Utilisation

### Import basique

```javascript
import { MqttModule, MQTT_TOPICS } from './index.js';

const mqtt = new MqttModule({
  url: 'mqtt://tanger.geodaki.com:1883',
  clientId: 'mon-app'
});

// Écouter les messages
mqtt.on('message', (topic, data) => {
  console.log(`Message reçu sur ${topic}:`, data);
});

// Connexion et abonnement
await mqtt.connect();
await mqtt.subscribe(MQTT_TOPICS.ENERGIE);
```

### Utilisation avec singleton

```javascript
import { getMqttModule } from './index.js';

const mqtt = getMqttModule();
await mqtt.connect();
await mqtt.subscribe(MQTT_TOPICS.ENERGIE3);
```

### Gestion multi-topics

```javascript
import { MQTT_TOPICS } from './index.js';

// S'abonner à tous les topics
for (const topic of Object.values(MQTT_TOPICS)) {
  await mqtt.subscribe(topic);
}
```

## 📊 Format des données

### ENERGIE (topic/energie)
```javascript
{
  deviceId: "78:42:1c:8d:8a:14",
  mac: "78:42:1c:8d:8a:14",
  data: {
    tension: 230,      // V
    courant: 5.5,      // A
    puissance: 1265,   // W
    energie: 100,      // kWh
    wifi: -45,         // dBm
    temperature: 25    // °C
  }
}
```

### ENERGIE3 (topic/energie3)
```javascript
{
  deviceId: "25101509130001",
  mac: "25101509130001", 
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
  }
}
```

### AIR (topic/air)
```javascript
{
  deviceId: "air-sensor-001",
  data: {
    temperature: 25.5,  // °C
    humidity: 60.2,     // %
    pressure: 1013.25,  // hPa
    co2: 400,           // ppm
    pm25: 15,           // μg/m³
    pm10: 25            // μg/m³
  }
}
```

### RTLS (topic/rtls)
```javascript
{
  deviceId: "rtls-tag-001",
  data: {
    x: 10.5,        // m
    y: 20.3,        // m
    z: 1.8,         // m
    accuracy: 0.5,  // m
    battery: 85     // %
  }
}
```

### O2 (topic/o2)
```javascript
{
  deviceId: "o2-sensor-001",
  data: {
    o2Level: 20.9,     // %
    temperature: 25,   // °C
    pressure: 1013,    // hPa
    battery: 90        // %
  }
}
```

## 🎯 Événements

```javascript
mqtt.on('connected', () => {
  console.log('Connecté au broker MQTT');
});

mqtt.on('disconnected', () => {
  console.log('Déconnecté du broker');
});

mqtt.on('message', (topic, data) => {
  console.log(`Message reçu: ${topic}`, data);
});

mqtt.on('error', (error) => {
  console.error('Erreur MQTT:', error);
});

mqtt.on('reconnecting', () => {
  console.log('Tentative de reconnexion...');
});
```

## 🔧 Configuration

### Environnements

```javascript
import { getConfig } from './config.js';

// Configuration développement
const devConfig = getConfig('development');

// Configuration production  
const prodConfig = getConfig('production');

// Configuration test
const testConfig = getConfig('test');
```

### Options personnalisées

```javascript
const mqtt = new MqttModule({
  url: 'mqtt://mon-broker:1883',
  clientId: 'mon-client-unique',
  keepalive: 60,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
  clean: true,
  qos: 1
});
```

## 📝 Scripts

```bash
# Démarrer le module
npm start

# Mode développement avec watch
npm run dev

# Exécuter les tests
npm test

# Exécuter les exemples
node examples.js
```

## 🧪 Tests

```bash
npm test
```

Les tests couvrent :
- Création du module
- Validation des topics
- Formatage des données
- Gestion des événements
- Parsing des données

## 📚 Exemples

Voir `examples.js` pour des exemples complets d'utilisation :
- Utilisation basique
- Pattern singleton
- Gestion multi-topics
- Publication de messages
- Gestion d'erreurs

## 🔗 Intégration

### Dans MACHWATT

```javascript
// server/index.js
import { getMqttModule, MQTT_TOPICS } from './mqtt/index.js';

const mqtt = getMqttModule();
await mqtt.connect();
await mqtt.subscribe(MQTT_TOPICS.ENERGIE);
await mqtt.subscribe(MQTT_TOPICS.ENERGIE3);

mqtt.on('message', (topic, data) => {
  // Traitement des données...
});
```

### Dans d'autres applications

```javascript
// mon-app.js
import { MqttModule, MQTT_TOPICS } from './mqtt/index.js';

const mqtt = new MqttModule({
  clientId: 'mon-app-unique'
});

await mqtt.connect();
await mqtt.subscribe(MQTT_TOPICS.AIR);
await mqtt.subscribe(MQTT_TOPICS.RTLS);
```

## 🚀 Déploiement

Le module peut être utilisé dans plusieurs applications simultanément :

1. **MACHWATT** - Monitoring énergétique
2. **SiloSense** - Surveillance des silos  
3. **AirMonitor** - Qualité de l'air
4. **RTLS** - Localisation temps réel
5. **O2Monitor** - Surveillance oxygène

Chaque application utilise son propre `clientId` pour éviter les conflits.

## 📄 Licence

MIT
