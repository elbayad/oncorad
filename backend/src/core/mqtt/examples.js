/**
 * Exemple d'utilisation du module MQTT
 */

import { MqttModule, MQTT_TOPICS, getMqttModule } from './index.js';
import { getConfig, formatSensorData } from './config.js';

// Exemple 1: Utilisation basique
async function exempleBasique() {

  const mqtt = new MqttModule({
    url: 'mqtt://tanger.geodaki.com:1883',
    clientId: 'exemple-basique'
  });

  // Écouter les événements
  mqtt.on('connected', () => {
  });

  mqtt.on('message', (topic, data) => {
  });

  mqtt.on('error', (error) => {
    console.error('❌ Erreur MQTT:', error);
  });

  try {
    // Connexion
    await mqtt.connect();

    // Abonnement aux topics
    await mqtt.subscribe(MQTT_TOPICS.ENERGIE4);

    // Attendre 30 secondes
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Déconnexion
    await mqtt.disconnect();

  } catch (error) {
    console.error('Erreur:', error);
  }
}

// Exemple 2: Utilisation avec singleton
async function exempleSingleton() {

  const mqtt = getMqttModule({
    url: 'mqtt://tanger.geodaki.com:1883',
    clientId: 'exemple-singleton'
  });

  mqtt.on('message', (topic, data) => {
  });

  try {
    await mqtt.connect();
    await mqtt.subscribe(MQTT_TOPICS.AIR);
    await mqtt.subscribe(MQTT_TOPICS.RTLS);

    // Attendre 20 secondes
    await new Promise(resolve => setTimeout(resolve, 20000));

  } catch (error) {
    console.error('Erreur:', error);
  }
}

// Exemple 3: Gestion multi-topics
async function exempleMultiTopics() {

  const mqtt = new MqttModule(getConfig('production'));

  // Compteurs par topic
  const counters = {
    [MQTT_TOPICS.ENERGIE4]: 0,
    [MQTT_TOPICS.AIR]: 0,
    [MQTT_TOPICS.RTLS]: 0,
    [MQTT_TOPICS.O2]: 0
  };

  mqtt.on('message', (topic, data) => {
    counters[topic]++;
  });

  try {
    await mqtt.connect();

    // S'abonner à tous les topics
    for (const topic of Object.values(MQTT_TOPICS)) {
      await mqtt.subscribe(topic);
    }

    // Attendre 60 secondes
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Afficher les statistiques
    for (const [topic, count] of Object.entries(counters)) {
    }

  } catch (error) {
    console.error('Erreur:', error);
  }
}

// Exemple 4: Publication de messages
async function exemplePublication() {

  const mqtt = new MqttModule({
    url: 'mqtt://tanger.geodaki.com:1883',
    clientId: 'exemple-publisher'
  });

  try {
    await mqtt.connect();

    // Publier des messages de test
    const testData = {
      timestamp: new Date().toISOString(),
      deviceId: 'test-device-001',
      temperature: 25.5,
      humidity: 60.2
    };

    await mqtt.publish(MQTT_TOPICS.AIR, testData);

    // Attendre 5 secondes
    await new Promise(resolve => setTimeout(resolve, 5000));

  } catch (error) {
    console.error('Erreur:', error);
  }
}

// Exemple 5: Gestion d'erreurs et reconnexion
async function exempleGestionErreurs() {

  const mqtt = new MqttModule({
    url: 'mqtt://broker-inexistant:1883', // URL incorrecte pour tester
    clientId: 'exemple-erreurs',
    maxReconnectAttempts: 3
  });

  mqtt.on('error', (error) => {
    console.error('❌ Erreur MQTT:', error.message);
  });

  mqtt.on('reconnecting', () => {
  });

  try {
    await mqtt.connect();
  } catch (error) {
  }
}

// Fonction principale
async function main() {

  try {
    await exempleBasique();

    await exempleSingleton();

    await exempleMultiTopics();

    await exemplePublication();

    await exempleGestionErreurs();

  } catch (error) {
    console.error('Erreur générale:', error);
  }

  process.exit(0);
}

// Exécuter si ce fichier est lancé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
