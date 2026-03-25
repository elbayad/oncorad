import EnergyMeter from './energy.model.js';
import mqttService from '../../shared/mqtt-service.js';

/**
 * EnergyService handles business logic for energy monitoring
 * and listens to MQTT events.
 */
class EnergyService {
    constructor() {
        this.setupListeners();
    }

    setupListeners() {
        mqttService.on('energie4', async (item) => {
            try {
                const d = item.data;
                await EnergyMeter.addReading(item.mac, {
                    voltage_a: d.tensionA, voltage_b: d.tensionB, voltage_c: d.tensionC,
                    voltage_ab: d.tensionAB, voltage_bc: d.tensionBC, voltage_ca: d.tensionCA,
                    current_a: d.courantA, current_b: d.courantB, current_c: d.courantC, current_n: d.courantN,
                    frequency: d.frequence,
                    power_active_a: d.puissanceA, power_active_b: d.puissanceB, power_active_c: d.puissanceC,
                    power_active_total: d.puissanceTotale,
                    power_reactive_a: d.puissanceReactiveA, power_reactive_b: d.puissanceReactiveB, power_reactive_c: d.puissanceReactiveC,
                    power_reactive_total: d.puissanceReactiveTotale,
                    power_apparent_a: d.puissanceApparenteA, power_apparent_b: d.puissanceApparenteB, power_apparent_c: d.puissanceApparenteC,
                    power_apparent_total: d.puissanceApparenteTotale,
                    power_factor_a: d.facteurPuissanceA, power_factor_b: d.facteurPuissanceB, power_factor_c: d.facteurPuissanceC,
                    power_factor_total: d.facteurPuissanceTotal,
                    energy_active_import: d.energieActiveImport, energy_active_export: d.energieActiveExport,
                    energy_reactive_inductive: d.energieReactiveInductive, energy_reactive_capacitive: d.energieReactiveCapacitive,
                    temperature_celsius: 0
                });
            } catch (err) {
                console.error(`[EnergyService] Error saving reading for ${item.mac}:`, err.message);
            }
        });
    }
}

export default new EnergyService();
