/**
 * Tests unitaires pour le module MQTT
 */

import { MqttModule, MQTT_TOPICS, createMqttModule } from './index.js';
import { isValidTopic, getTopicDescription, formatSensorData } from './config.js';

// Mock du client MQTT pour les tests
class MockMqttClient {
  constructor() {
    this.connected = false;
    this.subscribedTopics = new Set();
    this.eventHandlers = new Map();
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  emit(event, ...args) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(...args));
  }

  async connectAsync() {
    this.connected = true;
    setTimeout(() => this.emit('connect'), 100);
  }

  async subscribeAsync(topic, options) {
    this.subscribedTopics.add(topic);
    return Promise.resolve();
  }

  async unsubscribeAsync(topic) {
    this.subscribedTopics.delete(topic);
    return Promise.resolve();
  }

  async publishAsync(topic, message, options) {
    return Promise.resolve();
  }

  async endAsync() {
    this.connected = false;
    return Promise.resolve();
  }
}

// Tests
async function testMqttModuleCreation() {

  const mqtt = new MqttModule({
    url: 'mqtt://test:1883',
    clientId: 'test-client'
  });

  console.assert(mqtt.clientId === 'test-client', 'Client ID incorrect');
  console.assert(!mqtt.connected, 'Module ne devrait pas être connecté');
  console.assert(mqtt.topics.length === 0, 'Aucun topic ne devrait être abonné');

}

async function testTopicValidation() {

  console.assert(isValidTopic(MQTT_TOPICS.ENERGIE4), 'topic/energie4 devrait être valide');
  console.assert(isValidTopic('topic/air'), 'topic/air devrait être valide');
  console.assert(isValidTopic('topic/rtls'), 'topic/rtls devrait être valide');
  console.assert(isValidTopic('topic/o2'), 'topic/o2 devrait être valide');
  console.assert(!isValidTopic('topic/invalid'), 'topic/invalid ne devrait pas être valide');

}

async function testTopicDescriptions() {

  const description = getTopicDescription('topic/air');
  console.assert(description.includes('Qualité'), 'Description incorrecte pour air');

  const description4 = getTopicDescription(MQTT_TOPICS.ENERGIE4);
  console.assert(description4, 'Description manquante pour energie4');

}

async function testDataFormatting() {

  const airData = { temperature: 25, co2: 400 };
  const airFormatted = formatSensorData(airData, 'topic/air');
  console.assert(airFormatted.includes('25°C'), 'Formatage température incorrect');
  console.assert(airFormatted.includes('400 ppm'), 'Formatage CO2 incorrect');

}

async function testSingleton() {

  const mqtt1 = createMqttModule({ clientId: 'singleton-test-1' });
  const mqtt2 = createMqttModule({ clientId: 'singleton-test-2' });

  console.assert(mqtt1 !== mqtt2, 'Les instances ne devraient pas être identiques');
  console.assert(mqtt1.clientId === 'singleton-test-1', 'Client ID 1 incorrect');
  console.assert(mqtt2.clientId === 'singleton-test-2', 'Client ID 2 incorrect');

}

async function testEventHandling() {

  const mqtt = new MqttModule({ clientId: 'event-test' });
  let connectedCalled = false;
  let messageCalled = false;

  mqtt.on('connected', () => {
    connectedCalled = true;
  });

  mqtt.on('message', () => {
    messageCalled = true;
  });

  // Simuler les événements
  mqtt.emit('connected');
  mqtt.emit('message', MQTT_TOPICS.ENERGIE4, { deviceId: 'test', data: {} });

  console.assert(connectedCalled, 'Événement connected non déclenché');
  console.assert(messageCalled, 'Événement message non déclenché');

}

async function testDataParsing() {

  const mqtt = new MqttModule({ clientId: 'parsing-test' });

  // Test données ENERGIE4 (Nouveau format)
  const energie4Raw = {
    time: new Date().toISOString(),
    meter: [{
      name: 'meter-01',
      values: {
        Ua: 230.5,
        P: 15.2
      }
    }]
  };

  // Simuler le parsing interne (méthode privée, donc on teste via les événements)
  let parsedData = null;
  mqtt.on('message', (topic, data) => {
    parsedData = data;
  });

  // Simuler la réception d'un message
  mqtt.handleMessage(MQTT_TOPICS.ENERGIE4, JSON.stringify(energie4Raw));

  console.assert(parsedData !== null, 'Données non parsées');
  console.assert(parsedData.deviceId === 'meter-01', 'Device ID incorrect');
  console.assert(parsedData.data.tensionA === 230.5, 'Tension incorrecte (230.5V)');
  console.assert(parsedData.data.puissanceTotale === 15.2, 'Puissance incorrecte (15.2kW)');

}

async function runAllTests() {

  try {
    await testMqttModuleCreation();
    await testTopicValidation();
    await testTopicDescriptions();
    await testDataFormatting();
    await testSingleton();
    await testEventHandling();
    await testDataParsing();


  } catch (error) {
    console.error('❌ Test échoué:', error);
    process.exit(1);
  }
}

// Exécuter les tests si ce fichier est lancé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}
