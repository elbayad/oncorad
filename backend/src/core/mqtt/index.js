import mqtt from 'mqtt';
import { EventEmitter } from 'events';

// Types des topics supportés
export const MQTT_TOPICS = {
  AIR: 'air/topic',
  RTLS: 'rtls/topic',
  O2: 'o2/topic',
  ENERGIE4: 'energie4/topic',
  OXYGEN_TANK: 'oxygentank/topic',
  ALARM: 'alarm/sub/topic'
};

// Configuration par défaut
const DEFAULT_CONFIG = {
  url: 'mqtt://tanger.geodaki.com:1883',
  clientId: 'machwatt-module',
  keepalive: 60,
  reconnectPeriod: 5000,
  connectTimeout: 30 * 1000,
  clean: true,
  qos: 1
};

export class MqttModule extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = null;
    this.subscribedTopics = new Set();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  /**
   * Connexion au broker MQTT
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.client = mqtt.connect(this.config.url, {
          clientId: this.config.clientId,
          keepalive: this.config.keepalive,
          reconnectPeriod: this.config.reconnectPeriod,
          connectTimeout: this.config.connectTimeout,
          clean: this.config.clean,
          qos: this.config.qos
        });

        this.client.on('connect', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        });

        this.client.on('disconnect', () => {
          this.isConnected = false;
          this.emit('disconnected');
        });

        this.client.on('reconnect', () => {
          this.reconnectAttempts++;
          this.emit('reconnecting');

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[MQTT] Nombre maximum de tentatives de reconnexion atteint');
            this.emit('error', new Error('Max reconnection attempts reached'));
          }
        });

        this.client.on('error', (error) => {
          console.error('[MQTT] Erreur:', error);
          this.emit('error', error);
          reject(error);
        });

        this.client.on('message', (topic, payload) => {
          this.handleMessage(topic, payload);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Déconnexion du broker MQTT
   */
  async disconnect() {
    if (this.client) {
      return new Promise((resolve) => {
        this.client.once('close', () => {
          this.client = null;
          this.isConnected = false;
          this.subscribedTopics.clear();
          resolve();
        });
        this.client.end();
      });
    }
  }

  /**
   * Abonnement à un topic
   */
  async subscribe(topic) {
    if (!this.client || !this.isConnected) {
      throw new Error('Client MQTT non connecté');
    }

    if (this.subscribedTopics.has(topic)) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, { qos: this.config.qos }, (err) => {
        if (err) {
          reject(err);
        } else {
          this.subscribedTopics.add(topic);
          resolve();
        }
      });
    });
  }

  /**
   * Désabonnement d'un topic
   */
  async unsubscribe(topic) {
    if (!this.client || !this.isConnected) {
      return;
    }

    if (!this.subscribedTopics.has(topic)) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.client.unsubscribe(topic, (err) => {
        if (err) {
          reject(err);
        } else {
          this.subscribedTopics.delete(topic);
          resolve();
        }
      });
    });
  }

  /**
   * Publication d'un message
   */
  async publish(topic, message) {
    if (!this.client || !this.isConnected) {
      throw new Error('Client MQTT non connecté');
    }

    const payload = typeof message === 'string' ? message : JSON.stringify(message);

    return new Promise((resolve, reject) => {
      this.client.publish(topic, payload, { qos: this.config.qos }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  handleMessage(topic, payload) {
    try {
      const text = payload.toString();
      let rawData;

      try {
        // Handle prefixes like "Goodbye!" by finding the first '{'
        const jsonStart = text.indexOf('{');
        if (jsonStart === -1) {
          console.error(`[MQTT] Message non-JSON reçu sur ${topic}:`, text);
          return;
        }
        const jsonText = text.substring(jsonStart);
        rawData = JSON.parse(jsonText);
      } catch (e) {
        console.error(`[MQTT] Erreur parsing JSON pour ${topic}:`, e, "Texte:", text);
        if (Buffer.isBuffer(payload)) {
          console.error(`[MQTT] HEX payload:`, payload.toString('hex'));
        }
        return;
      }

      const sensorData = this.parseSensorData(topic, rawData);
      if (sensorData) {
        this.emit('message', topic, sensorData);
      }

    } catch (error) {
      console.error(`[MQTT] Erreur traitement message ${topic}:`, error);
    }
  }

  /**
   * Parsing des données de capteur selon le topic
   */
  parseSensorData(topic, rawData) {
    const timestamp = new Date().toISOString();
    let deviceId = '';
    let mac = '';
    let data = {};

    // Pattern matching for topics (RTLS often uses subtopics for gateways)
    if (topic === MQTT_TOPICS.RTLS || topic.startsWith('rtls/')) {
      data = this.parseRtlsData(rawData);
      deviceId = data.deviceId || 'rtls-sensor';
      return { topic: MQTT_TOPICS.RTLS, timestamp, deviceId, mac: mac || null, data, raw: rawData };
    }

    switch (topic) {
      case MQTT_TOPICS.AIR:
        data = this.parseAirData(rawData);
        deviceId = data.deviceId || 'air-sensor';
        break;

      case MQTT_TOPICS.O2:
        data = this.parseO2Data(rawData);
        deviceId = data.deviceId || 'o2-sensor';
        break;

      case MQTT_TOPICS.ENERGIE4:
        return this.parseEnergie4Data(rawData); // Returns an array of objects directly

      case MQTT_TOPICS.OXYGEN_TANK:
        data = this.parseOxygenTankData(rawData);
        deviceId = data.mac || 'oxygen-tank';
        mac = data.mac;
        break;

      case MQTT_TOPICS.ALARM:
        // ALARM payload: {"mac":"...","state1":"...","state2":"..."}
        data = rawData;
        deviceId = rawData.mac || 'siren-alarm';
        mac = rawData.mac;
        break;

      default:
        console.warn(`[MQTT] Topic non supporté: ${topic}`);
        return null;
    }

    if (!deviceId) {
      console.warn(`[MQTT] Device ID non trouvé pour ${topic}`);
      return null;
    }

    return {
      topic,
      timestamp,
      deviceId: deviceId || null,
      mac: mac || null,
      data: data || {},
      raw: rawData
    };
  }



  /**
   * Parsing des données AIR
   */
  parseAirData(rawData) {
    return {
      temperature: rawData.temperature,
      humidity: rawData.humidity,
      pressure: rawData.pressure,
      co2: rawData.co2,
      pm1: rawData['pm1.0'] || rawData.pm1,
      pm25: rawData.pm25,
      pm10: rawData.pm10,
      tvoc: rawData.tvoc,
      smoke: rawData.smoke,
      human: rawData.human,
      deviceId: rawData.deviceid || rawData.deviceId || rawData.mac
    };
  }

  /**
   * Parsing des données RTLS
   */
  parseRtlsData(rawData) {
    return {
      x: rawData.x,
      y: rawData.y,
      z: rawData.z,
      accuracy: rawData.accuracy,
      battery: rawData.battery,
      deviceId: rawData.deviceId || rawData.tagId,
      // Carrier fields for Oxygen/Technical alarms
      payload: rawData.payload,
      data: rawData.data,
      // Keeping original raw just in case
      raw: rawData
    };
  }


  /**
   * Parsing des données O2
   */
  parseO2Data(rawData) {
    return {
      o2Level: rawData.o2Level,
      temperature: rawData.temperature,
      pressure: rawData.pressure,
      battery: rawData.battery,
      deviceId: rawData.deviceId || rawData.sensorId
    };
  }

  /**
   * Parsing des données Oxygen Tank
   */
  parseOxygenTankData(rawData) {
    // {"mac":"C6:94:29:A0:ED:30","stat1":true,"pressure1":2.53,"stat2":true,"pressure2":5.42}
    return {
      mac: rawData.mac,
      stat1: rawData.stat1,
      pressure1: rawData.pressure1,
      stat2: rawData.stat2,
      pressure2: rawData.pressure2,
      deviceId: rawData.mac
    };
  }

  /**
   * Parsing des données ENERGIE4
   */
  parseEnergie4Data(rawData) {
    const timestamp = rawData?.time || new Date().toISOString();
    const meters = rawData?.meter || [];
    const results = [];

    // Format attendu:
    // rawData = { timestamp:..., topic:..., payload: { saleid, gateid, type, time, meter: [ { id, name, values: {...} } ] } }

    if (!Array.isArray(meters)) return null;

    for (const meter of meters) {
      const deviceId = meter.name;
      const val = meter.values || {};

      // Mapping simplifié pour correspondre à notre modèle de données
      const data = {
        tensionA: Number(val.Ua) || 0,
        tensionB: Number(val.Ub) || 0,
        tensionC: Number(val.Uc) || 0,
        tensionAB: Number(val.Uab) || 0,
        tensionBC: Number(val.Ubc) || 0,
        tensionCA: Number(val.Uca) || 0,

        // Currents
        courantA: Number(val.Ia) || 0,
        courantB: Number(val.Ib) || 0,
        courantC: Number(val.Ic) || 0,
        courantN: Number(val.I0) || 0,

        // Active Power
        puissanceA: Number(val.Pa) || 0,
        puissanceB: Number(val.Pb) || 0,
        puissanceC: Number(val.Pc) || 0,
        puissanceTotale: Number(val.P) || 0,

        // Reactive Power (kVAR)
        puissanceReactiveA: Number(val.Qa) || 0,
        puissanceReactiveB: Number(val.Qb) || 0,
        puissanceReactiveC: Number(val.Qc) || 0,
        puissanceReactiveTotale: Number(val.Q) || 0,

        // Apparent Power (kVA)
        puissanceApparenteA: Number(val.Sa) || 0,
        puissanceApparenteB: Number(val.Sb) || 0,
        puissanceApparenteC: Number(val.Sc) || 0,
        puissanceApparenteTotale: Number(val.S) || 0,

        // Energy (kWh/kVARh)
        energieActiveImport: Number(val.EPI) || 0,
        energieActiveExport: Number(val.EPE) || 0,
        energieReactiveInductive: Number(val.EQL) || 0,
        energieReactiveCapacitive: Number(val.EQC) || 0,

        frequence: Number(val.Fr) || 0,

        // Power Factors
        facteurPuissanceA: Number(val.Pfa) || 0,
        facteurPuissanceB: Number(val.Pfb) || 0,
        facteurPuissanceC: Number(val.Pfc) || 0,
        facteurPuissanceTotal: Number(val.Pf) || 0
      };

      results.push({
        topic: MQTT_TOPICS.ENERGIE4,
        timestamp,
        deviceId,
        mac: deviceId, // Use name as mac/identifier
        data,
        raw: meter
      });
    }

    return results;
  }

  /**
   * Getters
   */
  get connected() {
    return this.isConnected;
  }

  get topics() {
    return Array.from(this.subscribedTopics);
  }

  get clientId() {
    return this.config.clientId;
  }
}

// Instance singleton par défaut
let defaultInstance = null;

/**
 * Obtenir l'instance par défaut du module MQTT
 */
export function getMqttModule(config) {
  if (!defaultInstance) {
    defaultInstance = new MqttModule(config);
  }
  return defaultInstance;
}

/**
 * Créer une nouvelle instance du module MQTT
 */
export function createMqttModule(config) {
  return new MqttModule(config);
}

export default MqttModule;
