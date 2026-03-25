import { EventEmitter } from 'events';
import { getMqttModule, MQTT_TOPICS } from '../../core/mqtt/index.js';
import rtlsService from '../rtls/rtls.service.js';

/**
 * MqttService acts as a centralized Event Bus and WebSocket bridge.
 * Integrated with the new modular architecture.
 */
class MqttService extends EventEmitter {
  constructor() {
    super();
    this.mqtt = null;
    this.messageHistory = [];
    this.subscribers = new Map();
    this.maxHistory = 100;
    this.isConnecting = false;
    this.rtlsPositionBuffer = new Map();
    this.batchInterval = null;
  }

  async initialize() {
    if (this.isConnecting || (this.mqtt && this.mqtt.connected)) return;

    try {
      this.isConnecting = true;
      this.mqtt = getMqttModule({
        url: process.env.MQTT_URL || 'mqtt://tanger.geodaki.com:1883',
        clientId: process.env.MQTT_CLIENT_ID || 'iot-clinic-server'
      });

      this.setupEventListeners();

      rtlsService.on('position', (pos) => {
        this.rtlsPositionBuffer.set(pos.id, pos);
      });

      this.on('rtls_packet', (packet) => {
        rtlsService.processPacket(packet);
      });

      this.startBatchInterval();
      await this.mqtt.connect();
      await this.subscribeToTopics();

      this.isConnecting = false;
      console.log('✅ MQTT Event Bus initialized');
    } catch (error) {
      console.error('[MQTT] Initialization error:', error);
      this.isConnecting = false;
      throw error;
    }
  }

  setupEventListeners() {
    this.mqtt.on('message', async (topic, data) => {
      let payload = data;
      try {
        const str = data.toString();
        if (str.startsWith('{') || str.startsWith('[')) {
          payload = JSON.parse(str);
        }
      } catch (e) { /* keep as buffer if not JSON */ }

      // 1. Local history & WebSocket broadcast
      this.addToHistory(topic, payload);
      this.broadcastMessage(topic, payload);

      // 2. Domain Event Emission
      if (Array.isArray(payload)) {
        if (topic === MQTT_TOPICS.ENERGIE4) {
          payload.forEach(item => this.emit('energie4', item));
        }
      } else {
        if (topic === MQTT_TOPICS.AIR) this.emit('air', payload);
        if (topic === MQTT_TOPICS.OXYGEN_TANK) this.emit('oxygen_tank', payload);
        if (topic === MQTT_TOPICS.ALARM) this.emit('alarm', payload);

        if (topic === MQTT_TOPICS.RTLS) {
          const raw = payload.raw;
          this.emit('rtls_raw', raw);

          // Embedded data (Valves, etc.)
          this.emit('rtls_payload', {
            gatewayMac: raw.device_info?.mac,
            data: raw.data
          });

          // Precise RTLS packets
          if (raw.device_info && Array.isArray(raw.data)) {
            raw.data.forEach(item => {
              this.emit('rtls_packet', {
                mac: item.mac,
                rssi: item.rssi,
                gatewayMac: raw.device_info.mac,
                type: item.type,
                raw_data: item.raw_data
              });
            });
          }
        }
      }
    });

    this.mqtt.on('error', (err) => console.error('[MQTT] Broker error:', err));
  }

  async subscribeToTopics() {
    const topics = Object.values(MQTT_TOPICS);
    for (const topic of topics) {
      try {
        await this.mqtt.subscribe(topic);
      } catch (e) {
        console.error(`[MQTT] Subscribe error on ${topic}:`, e.message);
      }
    }
  }

  async publish(topic, message) {
    if (this.mqtt?.connected) {
      try {
        const msg = typeof message === 'string' ? message : JSON.stringify(message);
        await this.mqtt.publish(topic, msg);
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  addToHistory(topic, data) {
    this.messageHistory.unshift({
      topic,
      ...data,
      receivedAt: new Date().toISOString()
    });
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory = this.messageHistory.slice(0, this.maxHistory);
    }
  }

  broadcastMessage(topic, data) {
    const message = JSON.stringify({
      type: 'mqtt_message',
      topic,
      data,
      timestamp: new Date().toISOString()
    });

    this.subscribers.forEach((ws, clientId) => {
      try {
        ws.send(message);
      } catch (error) {
        this.subscribers.delete(clientId);
      }
    });
  }

  addSubscriber(clientId, ws) {
    this.subscribers.set(clientId, ws);
    ws.send(JSON.stringify({
      type: 'mqtt_history',
      data: this.messageHistory.slice(0, 10),
      timestamp: new Date().toISOString()
    }));
  }

  removeSubscriber(clientId) {
    this.subscribers.delete(clientId);
  }

  startBatchInterval() {
    if (this.batchInterval) return;
    this.batchInterval = setInterval(() => {
      if (this.rtlsPositionBuffer.size > 0) {
        const positions = Array.from(this.rtlsPositionBuffer.values());
        this.rtlsPositionBuffer.clear();
        this.broadcastMessage('rtls/positions_batch', {
          count: positions.length,
          positions: positions
        });
      }
    }, 1000);
  }

  isConnected() {
    return this.mqtt?.connected || false;
  }

  async disconnect() {
    if (this.batchInterval) clearInterval(this.batchInterval);
    if (this.mqtt) await this.mqtt.disconnect();
    this.subscribers.clear();
  }
}

export default new MqttService();
