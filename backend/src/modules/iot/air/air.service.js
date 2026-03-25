import AirSensor from './air.model.js';
import mqttService from '../../shared/mqtt-service.js';

/**
 * AirService handles business logic for air quality monitoring
 * and listens to MQTT events.
 */
class AirService {
    constructor() {
        this.setupListeners();
    }

    setupListeners() {
        mqttService.on('air', async (payload) => {
            try {
                if (payload.deviceId && payload.data) {
                    await AirSensor.addReading(payload.deviceId, payload.data);
                }
            } catch (err) {
                console.error(`[AirService] Error saving reading for ${payload.deviceId}:`, err.message);
            }
        });
    }
}

export default new AirService();
