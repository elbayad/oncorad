import mqtt from 'mqtt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Configuration
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MQTT_URL = process.env.MQTT_URL || 'mqtt://10.0.0.2:1883';
const PROFILE_FILE = path.join(__dirname, '../data/room-profiles.json');

/**
 * RoomProfilerAgent
 * 
 * Goal: Find the "Typical RSSI Vector" (signature) for each room.
 * This helps the RTLS service move beyond "center-of-room" placement
 * by knowing which anchors should lead the signal in a given room.
 */
class RoomProfilerAgent {
    constructor() {
        this.client = null;
        this.isCalibrating = false;
        this.currentRoom = null;
        this.currentTargetTag = null;
        this.samples = [];
        this.profiles = this.loadProfiles();
    }

    loadProfiles() {
        if (fs.existsSync(PROFILE_FILE)) {
            try {
                return JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
            } catch (e) {
                console.error('[PROFILER] Error loading profiles:', e.message);
            }
        }
        return {};
    }

    saveProfiles() {
        const dir = path.dirname(PROFILE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(PROFILE_FILE, JSON.stringify(this.profiles, null, 2));
    }

    start(tagMac, roomId) {
        if (this.isCalibrating) {
            return;
        }

        this.currentTargetTag = tagMac.toLowerCase();
        this.currentRoom = roomId;
        this.samples = [];
        this.isCalibrating = true;

    }

    stop() {
        if (!this.isCalibrating) return;
        this.isCalibrating = false;

        const signature = this.computeSignature(this.samples);
        if (signature) {
            this.profiles[this.currentRoom] = {
                roomId: this.currentRoom,
                tagMac: this.currentTargetTag,
                updatedAt: new Date().toISOString(),
                sampleCount: this.samples.length,
                signature
            };
            this.saveProfiles();
        } else {
        }
    }

    computeSignature(samples) {
        if (samples.length === 0) return null;

        const anchorStats = {}; // anchorMac -> [rssi values]

        // Group by anchor
        samples.forEach(vec => {
            for (const [mac, rssi] of Object.entries(vec)) {
                if (!anchorStats[mac]) anchorStats[mac] = [];
                anchorStats[mac].push(rssi);
            }
        });

        // Compute Mean and StdDev per anchor
        const signature = {};
        for (const [mac, rssis] of Object.entries(anchorStats)) {
            // Filter: only keep anchors seen in more than 50% of samples
            if (rssis.length < samples.length * 0.5) continue;

            const sum = rssis.reduce((a, b) => a + b, 0);
            const mean = sum / rssis.length;
            const variance = rssis.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rssis.length;

            signature[mac] = {
                mean: Number(mean.toFixed(2)),
                stdDev: Number(Math.sqrt(variance).toFixed(2)),
                hitRate: Number((rssis.length / samples.length).toFixed(2))
            };
        }

        // Identify "Primary Anchor" (Strongest Mean)
        let primary = null;
        let bestRssi = -999;
        for (const [mac, stats] of Object.entries(signature)) {
            if (stats.mean > bestRssi) {
                bestRssi = stats.mean;
                primary = mac;
            }
        }
        signature._primary = primary;

        return signature;
    }

    ingestVector(tagMac, vector) {
        if (!this.isCalibrating || tagMac.toLowerCase() !== this.currentTargetTag) return;
        this.samples.push(vector);
        if (this.samples.length % 10 === 0) {
        }
    }
}

export default RoomProfilerAgent;
