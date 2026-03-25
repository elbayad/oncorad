
import turf from '@turf/boolean-point-in-polygon';
import { point, polygon } from '@turf/helpers';
import Siren from '../iot/sirens/siren.model.js';
import rtlsService from './rtls.service.js';
import mqttService from '../shared/mqtt-service.js';

class GeofenceService {
    constructor() {
        this.sirens = [];
        this.lastStates = {}; // { mac: { state1: 'OFF', state2: 'OFF' } }
        this.init();
    }

    async init() {
        await this.loadSirens();

        // Listen to RTLS position updates
        rtlsService.on('position', (data) => this.handlePositionUpdate(data));

        // Refresh sirens periodically (e.g., every minute) to pick up new configs
        setInterval(() => this.loadSirens(), 60000);
    }

    async loadSirens() {
        try {
            this.sirens = await Siren.getAll();
            // Pre-process geofences: Convert string format "((x1,y1),...)" to Turf Polygons
            this.sirens.forEach(s => {
                if (s.geofence) {
                    s.polygon = this.parseGeofence(s.geofence);
                }
            });
        } catch (e) {
            console.error('[Geofence] Failed to load sirens:', e.message);
        }
    }

    parseGeofence(geoString) {
        try {
            // Format: ((x1,y1),(x2,y2)...)
            // Extract numbers pairs
            const matches = geoString.match(/(\d+(\.\d+)?)/g);
            if (!matches || matches.length < 6) return null; // Need at least 3 points (6 coords)

            const coords = [];
            for (let i = 0; i < matches.length; i += 2) {
                const x = parseFloat(matches[i]);
                const y = parseFloat(matches[i + 1]);
                coords.push([x, y]);
            }

            // Close the polygon if not closed
            if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                coords.push(coords[0]);
            }

            return polygon([coords]);
        } catch (e) {
            console.error('[Geofence] Error parsing polygon:', e.message);
            return null;
        }
    }

    handlePositionUpdate(tagData) {
        // tagData: { id: 'mac', x, y, type_id, ... }
        if (!tagData || !tagData.x || !tagData.y) return;

        // Restriction: Only 'equipment' tags trigger the siren
        if (tagData.type_id !== 'equipment') {
            // console.log(`[Geofence] Ignoring non-equipment tag: ${tagData.id} (${tagData.type_id})`);
            return;
        }

        // DEBUG: Sample 1% of updates to avoid spam, or log specific tag
        // console.log(`[Geofence] Pos: ${tagData.id} (${tagData.x}, ${tagData.y}) Floor: ${tagData.floor}`);

        const pt = point([tagData.x, tagData.y]);

        // Group sirens by MAC to determine combined state
        const sirenStates = {}; // { sirenMac: { state1: false, state2: false } }
        let debugInside = false;

        this.sirens.forEach(s => {
            if (!s.polygon) return;

            // Floor Sync
            // Loose comparison for IDs
            if (String(s.floor_id) != String(tagData.floor)) {
                // console.log(`[Geofence] Skip ${s.name} (Floor ${s.floor_id} != ${tagData.floor})`);
                return;
            }

            const isInside = turf(pt, s.polygon);
            if (isInside) {
                debugInside = true;
                if (!sirenStates[s.mac]) sirenStates[s.mac] = { state1: false, state2: false };

                const channel = s.output_channel || 'state1';
                if (channel === 'state1') sirenStates[s.mac].state1 = true;
                if (channel === 'state2') sirenStates[s.mac].state2 = true;
            }
        });

        this.updateGlobalSirenState(tagData.id, sirenStates);
    }

    // Track which tags are activating which siren channels
    // activeActivations = { sirenMac: { state1: Set(tagMacs), state2: Set(tagMacs) } }
    activeActivations = {};

    updateGlobalSirenState(tagMac, currentTagActivations) {
        let changed = false;

        // 1. Clear this tag's previous activations from global state
        for (const mac in this.activeActivations) {
            if (this.activeActivations[mac].state1.has(tagMac)) {
                this.activeActivations[mac].state1.delete(tagMac);
                changed = true; // Potentially changed to OFF
            }
            if (this.activeActivations[mac].state2.has(tagMac)) {
                this.activeActivations[mac].state2.delete(tagMac);
                changed = true;
            }
        }

        // 2. Add current activations
        for (const [sirenMac, states] of Object.entries(currentTagActivations)) {
            if (!this.activeActivations[sirenMac]) {
                this.activeActivations[sirenMac] = { state1: new Set(), state2: new Set() };
            }
            if (states.state1) {
                this.activeActivations[sirenMac].state1.add(tagMac);
                changed = true;
            }
            if (states.state2) {
                this.activeActivations[sirenMac].state2.add(tagMac);
                changed = true;
            }
        }

        // 3. Re-evaluate and Publish for all affected sirens (or all sirens to be safe?)
        // To be safe and handle "OFF" transitions, if changed, we iterate all known sirens (from DB list)
        if (changed) {
            const uniqueMacs = [...new Set(this.sirens.map(s => s.mac))];
            uniqueMacs.forEach(mac => this.publishSirenState(mac));
        }
    }

    publishSirenState(mac) {
        const acts = this.activeActivations[mac] || { state1: new Set(), state2: new Set() };
        const state1 = acts.state1.size > 0 ? 'ON' : 'OFF';
        const state2 = acts.state2.size > 0 ? 'ON' : 'OFF';

        // Check if changed from last sent
        if (!this.lastStates[mac]) this.lastStates[mac] = { state1: 'UNKNOWN', state2: 'UNKNOWN' };

        if (this.lastStates[mac].state1 !== state1 || this.lastStates[mac].state2 !== state2) {
            // State Changed
            const payload = {
                mac: mac,
                state1: state1,
                state2: state2
            };
            mqttService.publish('alarm/sub/topic', JSON.stringify(payload));

            this.lastStates[mac] = { state1, state2 };
        }
    }
    /**
     * Manual override for siren state
     * @param {string} mac 
     * @param {string} channel 'state1' or 'state2'
     * @param {string} state 'ON' or 'OFF'
     */
    async setManualState(mac, channel, state) {
        if (!this.lastStates[mac]) {
            this.lastStates[mac] = { state1: 'OFF', state2: 'OFF' };
        }

        // Update local state
        this.lastStates[mac][channel] = state;

        // Construct payload with BOTH states to be safe
        const payload = {
            mac: mac,
            state1: this.lastStates[mac].state1,
            state2: this.lastStates[mac].state2
        };


        try {
            await mqttService.publish('alarm/sub/topic', JSON.stringify(payload));
            return true;
        } catch (error) {
            console.error('[Geofence] Failed to publish manual command:', error);
            return false;
        }
    }
}

const geofenceService = new GeofenceService();
export default geofenceService;
