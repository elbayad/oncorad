/**
 * Configuration et utilitaires pour le module MQTT
 */

import { MQTT_TOPICS } from './index.js';

// Configuration par environnement
export const MQTT_CONFIGS = {
  development: {
    url: 'mqtt://localhost:1883',
    clientId: 'machwatt-dev',
    keepalive: 60,
    reconnectPeriod: 5000
  },
  production: {
    url: 'mqtt://tanger.geodaki.com:1883',
    clientId: 'machwatt-prod',
    keepalive: 60,
    reconnectPeriod: 5000
  },
  test: {
    url: 'mqtt://test-broker:1883',
    clientId: 'machwatt-test',
    keepalive: 30,
    reconnectPeriod: 1000
  }
};

// Mapping des topics vers leurs descriptions
export const TOPIC_DESCRIPTIONS = {
  [MQTT_TOPICS.ENERGIE4]: 'Compteurs énergétiques (V4)',
  [MQTT_TOPICS.AIR]: 'Capteurs de qualité d\'air',
  [MQTT_TOPICS.RTLS]: 'Système de localisation en temps réel',
  [MQTT_TOPICS.O2]: 'Capteurs d\'oxygène'
};

// Validation des topics
export function isValidTopic(topic) {
  return Object.values(MQTT_TOPICS).includes(topic);
}

// Obtenir la configuration selon l'environnement
export function getConfig(env = 'production') {
  return MQTT_CONFIGS[env];
}

// Obtenir la description d'un topic
export function getTopicDescription(topic) {
  return TOPIC_DESCRIPTIONS[topic] || 'Topic inconnu';
}

// Formater les données pour l'affichage
export function formatSensorData(data, topic) {
  switch (topic) {
    case MQTT_TOPICS.ENERGIE4:
      return `Energie4: ${data.puissanceTotale || 0} kW, Fréquence: ${data.frequence || 0} Hz`;

    case MQTT_TOPICS.AIR:
      return `Air: ${data.temperature || 0}°C, CO2: ${data.co2 || 0} ppm`;

    case MQTT_TOPICS.RTLS:
      return `Position: (${data.x || 0}, ${data.y || 0}, ${data.z || 0})`;

    case MQTT_TOPICS.O2:
      return `O2: ${data.o2Level || 0}%, Temp: ${data.temperature || 0}°C`;

    default:
      return 'Données non formatées';
  }
}

// Constantes utiles
export const MQTT_CONSTANTS = {
  DEFAULT_QOS: 1,
  DEFAULT_KEEPALIVE: 60,
  DEFAULT_RECONNECT_PERIOD: 5000,
  MAX_RECONNECT_ATTEMPTS: 10,
  CONNECT_TIMEOUT: 30000
};

// Types d'événements MQTT
export const MQTT_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  RECONNECT: 'reconnect',
  ERROR: 'error',
  MESSAGE: 'message',
  CLOSE: 'close',
  OFFLINE: 'offline'
};
