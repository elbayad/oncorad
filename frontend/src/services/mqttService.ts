
import { EventEmitter } from 'events';

class MqttService extends EventEmitter {
    private ws: WebSocket | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    public isConnected = false;

    constructor() {
        super();
        this.connect();
    }

    private connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:8789/api/ws`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            this.isConnected = true;
            this.emit('connected');
        };

        this.ws.onclose = () => {
            this.isConnected = false;
            this.scheduleReconnect();
        };

        this.ws.onerror = (err) => {
            console.error('[MQTT Service] Error', err);
            this.ws?.close();
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'mqtt_message') {
                    // Emit specific event for the topic
                    // Passing (topic, data) to listeners
                    this.emit(message.topic, message.topic, message.data);

                    // Also emit generic 'message'
                    this.emit('message', message.topic, message.data);
                }
            } catch (e) {
                console.error('[MQTT Service] Parse error', e);
            }
        };
    }

    private scheduleReconnect() {
        if (this.reconnectTimeout) return;
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
        }, 5000);
    }

    // Aliases for compatibility
    public subscribe(topic: string, callback: (topic: string, data: any) => void) {
        this.on(topic, callback);
    }

    public unsubscribe(topic: string, callback: (...args: any[]) => void) {
        this.off(topic, callback);
    }
}

const mqttService = new MqttService();
export default mqttService;
