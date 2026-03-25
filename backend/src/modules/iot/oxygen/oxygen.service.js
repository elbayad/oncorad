import OxygenPoint from './oxygen.model.js';
import OxygenReading from './oxygen-reading.model.js';
import OxygenTank from './oxygen-tank.model.js';
import OxygenTankReading from './oxygen-tank-reading.model.js';
import mqttService from '../../shared/mqtt-service.js';

/**
 * OxygenService handles business logic for medical gas monitoring.
 * It processes both dedicated tank messages and RTLS-embedded valve data.
 */
class OxygenService {
    constructor() {
        this.setupListeners();
    }

    setupListeners() {
        // 1. Oxygen Tank messages
        mqttService.on('oxygen_tank', async (payload) => {
            try {
                const tanks = await OxygenTank.findAllByMac(payload.mac);
                if (tanks && tanks.length > 0) {
                    for (const tank of tanks) {
                        await OxygenTankReading.addReading(tank.id, payload.data);
                        await OxygenTank.updateLastSeen(tank.id);
                    }
                }
            } catch (err) {
                console.error(`[OxygenService] Error saving tank reading for ${payload.mac}:`, err.message);
            }
        });

        // 2. Oxygen Valve data embedded in RTLS packets
        mqttService.on('rtls_payload', async ({ gatewayMac, data }) => {
            try {
                if (!Array.isArray(data)) return;
                const packet = data.find(d => d.type === 'other');
                if (!packet || !packet.raw_data) return;

                const deviceMac = packet.mac || gatewayMac;
                const raw = packet.raw_data;
                const header = '071601ea';
                const index = raw.indexOf(header);

                if (index === -1) return;

                const dataHex = raw.substring(index + header.length, index + header.length + 8);
                const LOCATION_MAP = { 0: 'Green/White', 1: 'Green', 2: 'Blue/White', 3: 'Blue' };

                for (let i = 0; i < 4; i++) {
                    const byteVal = parseInt(dataHex.substring(i * 2, i * 2 + 2), 16);
                    const status = byteVal === 1;
                    const locationName = LOCATION_MAP[i];

                    const point = await OxygenPoint.findByMacAndLocation(deviceMac, locationName);
                    if (point) {
                        await OxygenReading.addReading(point.id, { status });
                        await OxygenPoint.updateLastSeen(point.id);
                    }
                }
            } catch (err) {
                console.error(`[OxygenService] Error processing RTLS-embedded oxygen:`, err.message);
            }
        });
    }
}

export default new OxygenService();
