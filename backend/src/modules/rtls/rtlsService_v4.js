import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import {
    BUCKET_MS,
    FLOOR_LOCK_SEC,
    FLOOR_MARGIN,
    FP_DB_FILE,
    USE_FINGERPRINT,
    FP_K,
    FP_DIST,
    FP_MISSING_RSSI,
    DEFAULT_FLOOR_KEY,
    HYBRID_MIX,
    EMA_ALPHA,
    MIN_MOVE_CM,
    SNAP_CFG,
    MAP_LINES,
    ROOM_LOCK_EXIT,
    ROOM_LOCK_LOST_EXIT,
    ROOM_LOCK_ENTER,
    FLOOR6_ROOM_ANCHORS,
    CORRIDOR_MAX_JUMP_CM,
    // ── Stability Agent constants ──
    MIN_RSSI,
    WCL_EXP,
    DELTA_ENTER,
    ENTER_RSSI,
    EXIT_RSSI,
    EXIT_MARGIN,
    ENTER_CYCLES,
    EXIT_CYCLES,
    FLOOR_HYST_DB,
    FLOOR_STABLE_CYCLES,
    FLOOR_LOCK_MS,
    ROOM_CONF_THRESHOLD,
    ROOM_LOCK_WINDOW,
    ROOM_LOCK_CONF,
    MA_WINDOW,
    FP_META_FILE,
    RSSI_EMA_ALPHA,
    BUCKET_MS_FAST,
    VAR_THRESHOLD,
    FLOOR_SCORE_SCALE,
    TX_POWER_DBM_DEFAULT,
    PATH_LOSS_N,
    HYBRID_CONF_THRESHOLD,
    HYBRID_MIN_ANCHORS
} from '../../core/config/rtls.js';
import Anchor from './anchor.model.js';
import Asset from '../hospital/asset.model.js';
import pool from '../../core/config/database.js';
import turf from '@turf/boolean-point-in-polygon';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import { point, polygon as turfPolygon, multiLineString, multiPolygon } from '@turf/helpers';

// ── Debug flag ──
const DEBUG = process.env.RTLS_DEBUG === '1';
const dbg = (...args) => { if (DEBUG) console.log('[RTLS:DBG]', ...args); };

// ── V3: radiomap disabled on purpose ──
const saveRadioMapToDisk = () => {
};

// ═══════════════════════════════════════════════════════════════════════════
// RtlsService — Hospital-Grade Stability Refactoring
// ═══════════════════════════════════════════════════════════════════════════
class RtlsService extends EventEmitter {
    constructor() {
        super();
        this.buckets = new Map(); // tagMac → { timer, rssiMap: { anchorMac: [rssi…] } }
        this.tagState = new Map(); // tagMac → state object
        this.rssiHistory = new Map(); // tagMac → [ vector, vector, … ] (MA_WINDOW)
        this.radioMap = {}; // V3: radiomap intentionally disabled
        this.anchors = new Map(); // anchorMac → anchor row
        this.rooms = [];        // room + zone objects
        this.anchorRoomMap = new Map();   // anchorMac → closest room object
        this.roomGates = new Map(); // roomId → { positive: [{mac,weight}], negative: [{mac,weight}] }
        this.floorGeometries = new Map(); // floorId → { corridor, trajet }
        this.calibrationMetadata = new Map(); // floorId → { p0, n, offsets }
        this.emaRssi = new Map(); // tagMac → { anchorMac: val }
        this.lastBucketTimes = new Map(); // tagMac → timestamp

        // Load data
        this.loadAnchors();
        this.loadRooms().then(() => {
            this.buildAnchorRoomMap();
            this.loadRoomGateAnchors();
        });
        this.loadMetadata();

        // Bind methods
        this.processPacket = this.processPacket.bind(this);

        // Cleanup + refresh
        this.startCleanupJob();

        // Calibration State
        this.calibrationSession = null;

        // Dynamic Map Lines
        this.dynamicMapLines = {};
        this.loadMapLinesFromDisk();
    }

    // ─── Map Lines ────────────────────────────────────────────────────────
    loadMapLinesFromDisk() {
        try {
            const file = path.join(path.dirname(FP_DB_FILE), 'map-lines.json');
            if (fs.existsSync(file)) {
                this.dynamicMapLines = JSON.parse(fs.readFileSync(file, 'utf8'));
            }
        } catch (e) {
            console.error('[RTLS] Error loading map-lines.json:', e.message);
        }
    }

    reloadMapLines() {
        this.loadMapLinesFromDisk();
    }

    loadMetadata() {
        try {
            if (fs.existsSync(FP_META_FILE)) {
                const meta = JSON.parse(fs.readFileSync(FP_META_FILE, 'utf8'));
                this.calibrationMetadata.clear();
                for (const [floor, data] of Object.entries(meta)) {
                    this.calibrationMetadata.set(String(floor), data);
                }
            }
        } catch (e) {
            console.error('[RTLS] Error loading metadata:', e.message);
        }
    }

    reloadMetadata() {
        this.loadMetadata();
    }

    // ─── Cleanup Job ──────────────────────────────────────────────────────
    startCleanupJob() {
        setInterval(async () => {
            try {
                const updatedAssets = await Asset.markInactiveAssets(60);
                if (updatedAssets.length > 0) {
                    updatedAssets.forEach(a => {
                        this.tagState.delete(a.id);
                        this.rssiHistory.delete(a.id);
                    });
                }
            } catch (err) {
                console.error('[RTLS] Cleanup error:', err);
            }
        }, 10000);

        setInterval(() => this.persistAnchorActivity(), 60000);
        setInterval(() => this.loadRooms().then(() => {
            this.buildAnchorRoomMap();
            this.loadRoomGateAnchors();
        }), 60000);
    }

    // ─── Load Anchors ─────────────────────────────────────────────────────
    async loadAnchors() {
        try {
            const anchors = await Anchor.getAll();
            this.anchors.clear();
            anchors.forEach(a => {
                a.x = parseFloat(a.x);
                a.y = parseFloat(a.y);
                a.z = parseFloat(a.z || 0);
                this.anchors.set(a.mac.toLowerCase(), a);
            });
        } catch (e) {
            console.error('[RTLS] Error loading anchors:', e);
        }
    }

    // ─── Load Rooms + Zones + Floor Geometries ────────────────────────────
    async loadRooms() {
        try {
            const roomsRes = await pool.query(
                `SELECT id, room_number as name, floor_id,
                        ST_AsGeoJSON(polygon) as polygon_json, anchor_x, anchor_y
                 FROM rooms WHERE is_active = true`
            );
            const rooms = roomsRes.rows.map(r => ({
                ...r,
                type: 'room',
                polygon: r.polygon_json ? JSON.parse(r.polygon_json) : null
            }));

            const zonesRes = await pool.query("SELECT id, name, floor_id, polygon FROM zones WHERE polygon IS NOT NULL");
            const zones = zonesRes.rows.map(z => ({ ...z, type: 'zone' }));

            this.rooms = [...rooms, ...zones].map(r => {
                let poly = null;
                if (r.polygon) {
                    poly = this.parseGeofence(r.polygon);
                }
                return { ...r, polygonGeo: poly };
            });

            // Rooms have priority over Zones
            this.rooms.sort((a, b) => {
                if (a.type === b.type) return 0;
                return a.type === 'room' ? -1 : 1;
            });

            // Fetch floor geometries (corridor + trajet)
            const floorsRes = await pool.query("SELECT id, ST_AsGeoJSON(corridor) as corridor, ST_AsGeoJSON(trajet) as trajet FROM floors WHERE is_active = true");
            this.floorGeometries = new Map();
            floorsRes.rows.forEach(f => {
                this.floorGeometries.set(String(f.id), {
                    corridor: f.corridor ? JSON.parse(f.corridor) : null,
                    trajet: f.trajet ? JSON.parse(f.trajet) : null
                });
            });

        } catch (e) {
            console.error('[RTLS] Error loading rooms/zones:', e.message);
        }
    }

    // ─── Load room_gate_anchors from DB ───────────────────────────────────
    async loadRoomGateAnchors() {
        try {
            const res = await pool.query(
                `SELECT room_id, capteur_mac, capteur_seq, role, weight
                 FROM room_gate_anchors
                 ORDER BY room_id, role`
            );
            this.roomGates.clear();
            for (const row of res.rows) {
                const rid = row.room_id;
                if (!this.roomGates.has(rid)) {
                    this.roomGates.set(rid, { positive: [], negative: [], neutral: [] });
                }
                const entry = { mac: row.capteur_mac.toLowerCase(), seq: row.capteur_seq, weight: row.weight ?? 1.0 };
                const gate = this.roomGates.get(rid);
                if (row.role === 'positive') gate.positive.push(entry);
                else if (row.role === 'negative') gate.negative.push(entry);
                else gate.neutral.push(entry);
            }
        } catch (e) {
            console.error('[RTLS] Error loading room_gate_anchors:', e.message);
        }
    }

    // ─── Build anchor→room map ────────────────────────────────────────────
    buildAnchorRoomMap() {
        this.anchorRoomMap.clear();
        const roomsOnly = this.rooms.filter(r => r.type === 'room' && r.anchor_x != null && r.anchor_y != null);

        // (A) Floor 6 — explicit primary anchors
        const primaryByName = {};
        for (const [roomName, anchorName] of Object.entries(FLOOR6_ROOM_ANCHORS)) {
            primaryByName[anchorName] = roomName;
        }

        const primaryAnchors = [];
        for (const [mac, anchor] of this.anchors) {
            if (String(anchor.floor_id) !== '6') continue;
            if (!primaryByName[anchor.name]) continue;
            const roomObj = roomsOnly.find(r => r.name === primaryByName[anchor.name] && String(r.floor_id) === '6');
            if (roomObj) {
                this.anchorRoomMap.set(mac, roomObj);
                primaryAnchors.push({ mac, anchor, roomObj });
            }
        }

        // Map remaining floor-6 anchors to room only if geometrically inside
        const pt = point([0, 0]);
        for (const [mac, anchor] of this.anchors) {
            if (String(anchor.floor_id) !== '6') continue;
            if (this.anchorRoomMap.has(mac)) continue;

            pt.geometry.coordinates = [anchor.x, anchor.y];
            let matchingRoom = null;
            for (const room of roomsOnly) {
                if (String(room.floor_id) === '6' && room.polygonGeo && turf(pt, room.polygonGeo)) {
                    matchingRoom = room;
                    break;
                }
            }
            if (matchingRoom) {
                this.anchorRoomMap.set(mac, matchingRoom);
            }
            // else: corridor / transition anchor — don't map to any room
        }

        // (B) Other floors — geometric check then nearest centroid
        for (const [mac, anchor] of this.anchors) {
            if (String(anchor.floor_id) === '6') continue;

            let foundRoom = null;
            const pt2 = point([anchor.x, anchor.y]);
            for (const room of roomsOnly) {
                if (String(room.floor_id) !== String(anchor.floor_id)) continue;
                if (room.polygonGeo && turf(pt2, room.polygonGeo)) {
                    foundRoom = room;
                    break;
                }
            }

            if (foundRoom) {
                this.anchorRoomMap.set(mac, foundRoom);
                continue;
            }

            let bestRoom = null;
            let bestDist = Infinity;
            for (const room of roomsOnly) {
                if (String(room.floor_id) !== String(anchor.floor_id)) continue;
                const dx = parseFloat(room.anchor_x) - anchor.x;
                const dy = parseFloat(room.anchor_y) - anchor.y;
                const dist = dx * dx + dy * dy;
                if (dist < bestDist) {
                    bestDist = dist;
                    bestRoom = room;
                }
            }
            if (bestRoom) {
                this.anchorRoomMap.set(mac, bestRoom);
            }
        }

        // Log floor-6 mapping
        const f6Entries = [];
        for (const [mac, room] of this.anchorRoomMap) {
            const a = this.anchors.get(mac);
            if (a && String(a.floor_id) === '6') {
                const isPrimary = primaryByName[a.name] ? '★' : ' ';
                f6Entries.push(`${isPrimary} ${a.name} → ${room.name}`);
            }
        }
    }

    // ─── Geofence parser (WKT + legacy) ───────────────────────────────────
    parseGeofence(geo) {
        try {
            if (!geo) return null;

            // Handle GeoJSON object directly (from ST_AsGeoJSON + JSON.parse)
            if (typeof geo === 'object') {
                if (geo.type === 'Polygon') {
                    return turfPolygon(geo.coordinates);
                } else if (geo.type === 'MultiPolygon') {
                    return multiPolygon(geo.coordinates);
                }
                return null;
            }

            const geoString = String(geo);
            const coords = [];

            if (geoString.startsWith('MULTIPOLYGON')) {
                // Simplified multi-to-single (takes first polygon) or use MultiPolygon
                const matches = geoString.match(/(-?\d+(\.\d+)?)/g);
                if (!matches || matches.length < 6) return null;
                for (let i = 0; i < matches.length; i += 2) {
                    coords.push([parseFloat(matches[i]), parseFloat(matches[i + 1])]);
                }
                // (This is a naive fallback if parsing as Turf object fails)
            } else if (geoString.startsWith('POLYGON')) {
                const inner = geoString.replace(/^POLYGON\(\(/, '').replace(/\)\)$/, '');
                const pairs = inner.split(',').map(s => s.trim().split(/\s+/));
                for (const [xStr, yStr] of pairs) {
                    coords.push([parseFloat(xStr), parseFloat(yStr)]);
                }
            } else {
                const matches = geoString.match(/(-?\d+(\.\d+)?)/g);
                if (!matches || matches.length < 6) return null;
                for (let i = 0; i < matches.length; i += 2) {
                    coords.push([parseFloat(matches[i]), parseFloat(matches[i + 1])]);
                }
            }

            if (coords.length < 3) return null;
            if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                coords.push(coords[0]);
            }
            return turfPolygon([coords]);
        } catch (e) {
            console.error('[RTLS] parseGeofence failed:', e.message, geo);
            return null;
        }
    }

    // ─── Anchor Activity ──────────────────────────────────────────────────
    async updateAnchorActivity(mac, deviceTimestamp = null) {
        const macLower = mac.toLowerCase();
        const anchor = this.anchors.get(macLower);
        if (anchor) {
            const now = new Date();
            anchor.last_seen = now;
            if (deviceTimestamp !== null) anchor.lastcompt = deviceTimestamp;
            if (deviceTimestamp !== null) {
                try {
                    await Anchor.updateStatus(macLower, now, deviceTimestamp);
                } catch (e) {
                    console.error(`[RTLS] Failed to save anchor heartbeat ${mac}:`, e.message);
                }
            }
        }
    }

    async persistAnchorActivity() {
        const now = Date.now();
        for (const [mac, anchor] of this.anchors) {
            if (anchor.last_seen && (now - anchor.last_seen.getTime() < 120000)) {
                try {
                    await Anchor.updateStatus(mac.toLowerCase(), anchor.last_seen, anchor.lastcompt || 0);
                } catch (e) {
                    console.error(`[RTLS] Background sync failed for ${mac}:`, e.message);
                }
            }
        }
    }

    // ─── Radio Map ────────────────────────────────────────────────────────
    loadRadioMap() {
        try {
            if (fs.existsSync(FP_DB_FILE)) {
                return JSON.parse(fs.readFileSync(FP_DB_FILE, 'utf8'));
            }
        } catch (e) {
            console.error('[RTLS] Failed to load radio map:', e.message);
        }
        return {};
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PACKET ENTRY POINT
    // ═══════════════════════════════════════════════════════════════════════
    processPacket(packet) {
        const tagMac = packet.mac?.toLowerCase();
        const anchorMac = packet.gatewayMac?.toLowerCase() || packet.device_info?.mac?.toLowerCase();
        const rssi = packet.rssi;

        if (!tagMac || !anchorMac || rssi === undefined || rssi === null) return;

        this.updateAnchorActivity(anchorMac);

        if (!this.buckets.has(tagMac)) {
            const currentBucketMs = this.getAdaptiveBucketMs(tagMac, anchorMac, rssi);
            this.buckets.set(tagMac, {
                rssiMap: {},
                timer: setTimeout(() => this.flushBucket(tagMac), currentBucketMs),
                startTime: Date.now()
            });
        }

        const bucket = this.buckets.get(tagMac);
        if (!bucket.rssiMap[anchorMac]) bucket.rssiMap[anchorMac] = [];
        bucket.rssiMap[anchorMac].push(rssi);

        if (this.calibrationSession && this.calibrationSession.mac === tagMac) {
            this.handleCalibrationPacket(tagMac, anchorMac, rssi);
        }
    }

    getAdaptiveBucketMs(tagMac, anchorMac, rssi) {
        // Simple logic: if rssi variance in previous state was high, or if we detect fast changes
        const state = this.tagState.get(tagMac);
        if (!state) return BUCKET_MS;

        // If tag is moving (speed > threshold) or if signal is noisy
        if (state.isMoving || (state.lastVariance && state.lastVariance > VAR_THRESHOLD)) {
            return BUCKET_MS_FAST;
        }
        return BUCKET_MS;
    }

    handleCalibrationPacket(tagMac, anchorMac, rssi) {
        if (!this.calibrationSession.data[anchorMac]) {
            this.calibrationSession.data[anchorMac] = [];
        }
        this.calibrationSession.data[anchorMac].push(rssi);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  BUCKET FLUSH → PIPELINE
    // ═══════════════════════════════════════════════════════════════════════
    flushBucket(tagMac) {
        if (!this.buckets.has(tagMac)) return;
        const bucket = this.buckets.get(tagMac);
        this.buckets.delete(tagMac);

        const state = this.tagState.get(tagMac) || {};
        const floor = String(state.floor || DEFAULT_FLOOR_KEY);
        const meta = this.calibrationMetadata.get(floor);

        // 1. Aggregate & Normalize
        const vector = {};
        let totalVar = 0;
        let anchorCount = 0;

        for (const [anchor, rssis] of Object.entries(bucket.rssiMap)) {
            const med = this.getMedian(rssis);
            const ancMeta = meta?.offsets?.[anchor] || 0;

            // RSSI Normalization: Correct for gateway gain/loss
            let corrected = med - ancMeta;

            // Quality Control: Reduce weight if sample count is low
            if (rssis.length < 2) {
                corrected -= 3; // Penalty for low confidence
            }

            vector[anchor] = corrected;

            // Compute variance for adaptive bucket next time
            if (rssis.length > 1) {
                const mean = rssis.reduce((a, b) => a + b, 0) / rssis.length;
                const variance = rssis.reduce((a, b) => a + (b - mean) ** 2, 0) / rssis.length;
                totalVar += variance;
                anchorCount++;
            }
        }

        if (anchorCount > 0) {
            state.lastVariance = totalVar / anchorCount;
        }

        // 2. EMA Filter (Signal Layer) - Reduces latency compared to MA
        const filteredVector = this.applyRssiEma(tagMac, vector);

        // 3. Floor Detection (Score-based)
        const detectedFloor = this.determineFloorByScore(tagMac, filteredVector);

        // 4. Update state with filtered vector
        this.updateTagState(tagMac, detectedFloor, filteredVector);
    }

    applyRssiEma(tagMac, vector) {
        if (!this.emaRssi.has(tagMac)) {
            this.emaRssi.set(tagMac, {});
        }
        const ema = this.emaRssi.get(tagMac);
        const filtered = {};

        // Strategy change: forget missing anchors quickly so old rooms do not keep biasing the decision
        for (const [mac, raw] of Object.entries(vector)) {
            const prev = ema[mac];
            if (prev !== undefined) {
                ema[mac] = RSSI_EMA_ALPHA * raw + (1 - RSSI_EMA_ALPHA) * prev;
            } else {
                ema[mac] = raw;
            }
            filtered[mac] = ema[mac];
        }

        for (const mac of Object.keys(ema)) {
            if (vector[mac] === undefined) {
                delete ema[mac];
            }
        }

        return filtered;
    }

    getMedian(values) {
        if (values.length === 0) return FP_MISSING_RSSI;
        values.sort((a, b) => a - b);
        const mid = Math.floor(values.length / 2);
        return values[mid];
    }

    /**
     * Moyenne mobile glissante sur MA_WINDOW fenêtres.
     * Pour chaque ancre, on moyenne les RSSI des N derniers vectors.
     */
    applyMovingAverage(tagMac, vector) {
        if (!this.rssiHistory.has(tagMac)) {
            this.rssiHistory.set(tagMac, []);
        }
        const history = this.rssiHistory.get(tagMac);
        history.push(vector);
        if (history.length > MA_WINDOW) history.shift();

        // Average per anchor across the window
        const summed = {};
        const counts = {};
        for (const vec of history) {
            for (const [mac, rssi] of Object.entries(vec)) {
                summed[mac] = (summed[mac] || 0) + rssi;
                counts[mac] = (counts[mac] || 0) + 1;
            }
        }
        const averaged = {};
        for (const mac of Object.keys(summed)) {
            averaged[mac] = summed[mac] / counts[mac];
        }
        return averaged;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  1) FLOOR DETERMINATION — Score-based (Quick Win)
    // ═══════════════════════════════════════════════════════════════════════
    determineFloorByScore(tagMac, vector) {
        // Calculate scores for each floor where we have anchors
        const floorScores = new Map();

        for (const [mac, rssi] of Object.entries(vector)) {
            const anchor = this.anchors.get(mac.toLowerCase());
            if (!anchor) continue;

            const floorId = String(anchor.floor_id);
            if (!floorScores.has(floorId)) floorScores.set(floorId, 0);

            // Weight = exp(rssi / scale)
            // Using a scale like 10 allows strong signals to dominate
            const weight = Math.exp(rssi / FLOOR_SCORE_SCALE);
            floorScores.set(floorId, floorScores.get(floorId) + weight);
        }

        if (floorScores.size === 0) return String(DEFAULT_FLOOR_KEY);

        // Find floor with highest score
        let bestFloor = String(DEFAULT_FLOOR_KEY);
        let maxScore = -1;
        for (const [fId, score] of floorScores.entries()) {
            if (score > maxScore) {
                maxScore = score;
                bestFloor = fId;
            }
        }

        // State management & Hysteresis
        let state = this.tagState.get(tagMac);
        if (!state) return bestFloor;

        const currentFloor = String(state.floor);
        if (bestFloor === currentFloor) {
            state._floorCandidate = null;
            state._floorStableCount = 0;
            return currentFloor;
        }

        // Hysteresis: Candidate score must be significantly better
        const currentScore = floorScores.get(currentFloor) || 0;
        const ratio = maxScore / (currentScore || 1e-9);

        // Ratio threshold (e.g., 2.0 means candidate must be twice as strong in score space)
        const SCORE_RATIO_THRESH = 1.5;

        dbg(`[FLOOR:SCORE] tag=${tagMac.slice(-4)} current=${currentFloor}(${currentScore.toFixed(2)}) candidate=${bestFloor}(${maxScore.toFixed(2)}) ratio=${ratio.toFixed(2)}`);

        if (ratio < SCORE_RATIO_THRESH) {
            state._floorCandidate = null;
            state._floorStableCount = 0;
            return currentFloor;
        }

        // Stable cycles
        if (state._floorCandidate !== bestFloor) {
            state._floorCandidate = bestFloor;
            state._floorStableCount = 1;
            return currentFloor;
        }

        state._floorStableCount++;
        if (state._floorStableCount < FLOOR_STABLE_CYCLES) return currentFloor;

        // Adaptive Floor Lock
        const timeSinceLastChange = Date.now() - (state.lastFloorChange || 0);
        const dynamicLockMs = state.isMoving ? FLOOR_LOCK_MS / 2 : FLOOR_LOCK_MS; // 5s if moving, 10s if static

        if (timeSinceLastChange < dynamicLockMs) {
            return currentFloor;
        }

        // Accepted
        state.lastFloorChange = Date.now();
        state._floorCandidate = null;
        state._floorStableCount = 0;
        return bestFloor;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  2) WCL — Floor-filtered, MIN_RSSI, WCL_EXP
    // ═══════════════════════════════════════════════════════════════════════
    calculateWCLPosition(vector, floor) {
        let sumWeight = 0;
        let sumWeightedX = 0;
        let sumWeightedY = 0;
        let anchorCount = 0;

        // Get floor parameters (P0, N) if available
        const meta = this.calibrationMetadata.get(floor);
        const P0 = meta?.p0 || TX_POWER_DBM_DEFAULT;
        const N = meta?.n || PATH_LOSS_N;

        for (const [mac, rssi] of Object.entries(vector)) {
            if (rssi < MIN_RSSI) continue;

            const anchor = this.anchors.get(mac.toLowerCase());
            if (!anchor || anchor.x == null || anchor.y == null) continue;

            // STRICT FLOOR FILTER
            if (String(anchor.floor_id) !== String(floor)) continue;

            // RSSI -> Distance conversion (Quick Win)
            // Weight = 1 / d^2
            const d_m = Math.pow(10, (P0 - rssi) / (10 * N));
            const weight = 1 / (d_m * d_m);

            sumWeight += weight;
            sumWeightedX += weight * parseFloat(anchor.x);
            sumWeightedY += weight * parseFloat(anchor.y);
            anchorCount++;
        }

        // < 2 valid anchors → unreliable
        if (anchorCount < 2 || sumWeight === 0) return null;

        return {
            x: sumWeightedX / sumWeight,
            y: sumWeightedY / sumWeight,
            anchorCount
        };
    }

    filterVectorByFloor(vector, floor) {
        const floorVector = {};
        for (const [mac, rssi] of Object.entries(vector)) {
            const anchor = this.anchors.get(mac.toLowerCase());
            if (anchor && String(anchor.floor_id) === String(floor)) {
                floorVector[mac] = rssi;
            }
        }
        return floorVector;
    }
    // ═══════════════════════════════════════════════════════════════════════
    //  3) COMPUTE RAW POSITION (V3 = WCL only, NO radiomap / NO fingerprint)
    // ═══════════════════════════════════════════════════════════════════════
    computeRawPosition(floor, vector) {
        const floorVector = this.filterVectorByFloor(vector, floor);
        const anchorCount = Object.keys(floorVector).length;
        if (anchorCount === 0) return null;

        const wclPos = this.calculateWCLPosition(vector, floor);
        if (!wclPos) return null;

        return {
            x: wclPos.x,
            y: wclPos.y,
            anchorCount: wclPos.anchorCount || anchorCount,
            method: 'wcl_only_v3'
        };
    }

    calculateFingerprintPosition() {
        return null;
    }

    euclideanDistance(vecA, vecB) {
        const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
        let sumSq = 0;
        for (const key of keys) {
            const v1 = vecA[key] !== undefined ? vecA[key] : FP_MISSING_RSSI;
            const v2 = vecB[key] !== undefined ? vecB[key] : FP_MISSING_RSSI;
            sumSq += (v1 - v2) ** 2;
        }
        return Math.sqrt(sumSq);
    }

    calculateFloorScore() {
        return 9999;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  4) DOOR GATING SCHMITT — Using room_gate_anchors (positive/negative)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Schmitt-trigger door gating for each candidate room.
     * Uses weighted mean of positive (inside) vs negative (outside) anchors.
     *
     * ENTER: S_room > ENTER_RSSI AND delta ≥ DELTA_ENTER, stable ENTER_CYCLES
     * EXIT:  S_room < EXIT_RSSI OR S_out > S_room + EXIT_MARGIN, stable EXIT_CYCLES
     *
     * Returns: { action:'enter'|'exit', room } or null
     */
    doorGatingSchmitt(state, floor, vector) {
        if (this.roomGates.size === 0) return null;

        const floorRooms = this.rooms.filter(r =>
            r.type === 'room' && String(r.floor_id) === String(floor) && this.roomGates.has(r.id)
        );

        // Initialise per-tag schmitt state
        if (!state._schmitt) state._schmitt = {};

        let bestCandidate = null;

        for (const room of floorRooms) {
            const gate = this.roomGates.get(room.id);
            if (!gate) continue;

            // Weighted mean of positive anchors
            const sRoom = this._weightedMeanRSSI(gate.positive, vector);
            // Weighted mean of negative anchors
            const sOut = this._weightedMeanRSSI(gate.negative, vector);

            if (sRoom === null) continue; // no data from positive anchors

            const delta = sRoom - (sOut ?? -100);

            // Get or create schmitt counter for this room
            const rid = String(room.id);
            if (!state._schmitt[rid]) {
                state._schmitt[rid] = { enterCount: 0, exitCount: 0 };
            }
            const sc = state._schmitt[rid];

            dbg(`[SCHMITT] room=${room.name} S_room=${sRoom?.toFixed(1)} S_out=${sOut?.toFixed(1)} ` +
                `delta=${delta.toFixed(1)} enterCnt=${sc.enterCount} exitCnt=${sc.exitCount}`);

            // ── ENTER logic ──
            if (!state.roomLock || state.roomLock.roomId !== room.id) {
                if (sRoom >= ENTER_RSSI && delta >= DELTA_ENTER) {
                    sc.enterCount++;
                    sc.exitCount = 0;
                    if (sc.enterCount >= ENTER_CYCLES) {
                        bestCandidate = { action: 'enter', room };
                        sc.enterCount = 0;
                    }
                } else {
                    // sc.enterCount = Math.max(0, sc.enterCount - 1); // Decay removed for stability
                }
            }

            // ── EXIT logic (only if we're locked IN this room) ──
            if (state.roomLock && state.roomLock.roomId === room.id) {
                const shouldExit = (sRoom <= EXIT_RSSI) ||
                    (sOut !== null && sOut >= sRoom + EXIT_MARGIN);
                if (shouldExit) {
                    sc.exitCount++;
                    sc.enterCount = 0;
                    if (sc.exitCount >= EXIT_CYCLES) {
                        bestCandidate = { action: 'exit', room };
                        sc.exitCount = 0;
                    }
                } else {
                    // sc.exitCount = Math.max(0, sc.exitCount - 1); // Decay removed for stability
                }
            }
        }

        return bestCandidate;
    }

    /**
     * Weighted mean RSSI for a list of gate anchors present in the vector.
     * Returns null if no anchors found.
     */
    _weightedMeanRSSI(anchors, vector) {
        let sumW = 0, sumRW = 0;
        for (const { mac, weight } of anchors) {
            const rssi = vector[mac] ?? vector[mac.toUpperCase()];
            if (rssi !== undefined) {
                sumW += weight;
                sumRW += rssi * weight;
            }
        }
        return sumW > 0 ? sumRW / sumW : null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  5) ROOM CONFIDENCE — Aligned with WCL_EXP
    // ═══════════════════════════════════════════════════════════════════════
    roomConfidence(room, vector, floor) {
        let totalWeight = 0;
        let roomWeight = 0;

        for (const [mac, rssi] of Object.entries(vector)) {
            if (rssi < MIN_RSSI) continue;
            const anchor = this.anchors.get(mac.toLowerCase());
            if (!anchor || String(anchor.floor_id) !== String(floor)) continue;

            const w = Math.pow(Math.max(0, rssi - MIN_RSSI), WCL_EXP);
            totalWeight += w;

            const anchorRoom = this.anchorRoomMap.get(mac.toLowerCase());
            if (anchorRoom && anchorRoom.id === room.id) {
                roomWeight += w;
            }
        }

        return totalWeight === 0 ? 0 : roomWeight / totalWeight;
    }


    // ═══════════════════════════════════════════════════════════════════════
    //  5b) SEMANTIC ROOM EVIDENCE / STATE MACHINE
    // ═══════════════════════════════════════════════════════════════════════
    getRoomCentroid(room) {
        return {
            x: parseFloat(room.centroid_x ?? room.anchor_x ?? 0),
            y: parseFloat(room.centroid_y ?? room.anchor_y ?? 0)
        };
    }

    scoreRoomsByRadio(floor, vector) {
        const candidates = [];
        const floorRooms = this.rooms.filter(r => r.type === 'room' && String(r.floor_id) === String(floor));

        for (const room of floorRooms) {
            const conf = this.roomConfidence(room, vector, floor);
            const gate = this.roomGates.get(room.id);
            const sRoom = gate ? this._weightedMeanRSSI(gate.positive, vector) : null;
            const sOut = gate ? this._weightedMeanRSSI(gate.negative, vector) : null;
            const delta = sRoom === null ? -999 : sRoom - (sOut ?? -100);
            const gateNorm = sRoom === null ? 0 : Math.max(0, Math.min(1, (delta + 8) / 24));
            const rssiNorm = sRoom === null ? 0 : Math.max(0, Math.min(1, (sRoom + 95) / 25));
            const outPenalty = sOut === null ? 0 : Math.max(0, Math.min(1, (sOut - sRoom + 12) / 18));
            const score = 0.50 * conf + 0.25 * gateNorm + 0.15 * rssiNorm - 0.10 * outPenalty;

            candidates.push({
                room,
                score: Math.max(0, Math.min(1, score)),
                conf,
                sRoom,
                sOut,
                delta,
                gateNorm,
                rssiNorm,
                outPenalty
            });
        }

        candidates.sort((a, b) => b.score - a.score);
        return candidates;
    }

    getSemanticZoneEvidence(floor, vector, state) {
        const ranked = this.scoreRoomsByRadio(floor, vector);
        const best = ranked[0] || null;
        const second = ranked[1] || null;
        const corridorScore = this._estimateCorridorScore(floor, vector, best);

        const margin = best ? (best.score - (second?.score ?? 0)) : 0;
        const top2Ratio = best ? (best.score / Math.max(0.01, second?.score ?? 0.01)) : 0;
        const ambiguousTop2 = !!best && !!second && margin < 0.12;
        const enterEvidence = best
            ? (0.50 * best.score) +
            (0.25 * Math.max(0, Math.min(1, margin / 0.30))) +
            (0.15 * Math.max(0, Math.min(1, (top2Ratio - 1) / 0.80))) +
            (0.10 * (best.sRoom !== null && best.sRoom >= ENTER_RSSI ? 1 : 0))
            : 0;

        let exitEvidence = corridorScore;
        if (state.semantic?.mode === 'IN_ROOM' && state.semantic.roomId) {
            const current = ranked.find(x => x.room.id === state.semantic.roomId);
            if (current) {
                const weakCurrent = current.score < 0.26 ? 1 : 0;
                const weakSignal = current.sRoom !== null && current.sRoom <= EXIT_RSSI ? 1 : 0;
                const outsideDominant = current.sOut !== null && current.sOut >= current.sRoom + EXIT_MARGIN ? 1 : 0;
                const challenger = best && best.room.id !== current.room.id && margin >= 0.18 && best.score >= current.score + 0.12 ? 1 : 0;
                exitEvidence = 0.35 * corridorScore + 0.20 * weakCurrent + 0.15 * weakSignal + 0.15 * outsideDominant + 0.15 * challenger;
            }
        }

        return {
            ranked,
            best,
            second,
            margin,
            top2Ratio,
            ambiguousTop2,
            corridorScore,
            enterEvidence,
            exitEvidence
        };
    }

    _estimateCorridorScore(floor, vector, bestCandidate) {
        let totalWeight = 0;
        let corridorWeight = 0;

        for (const [mac, rssi] of Object.entries(vector)) {
            if (rssi < MIN_RSSI) continue;
            const anchor = this.anchors.get(mac.toLowerCase());
            if (!anchor || String(anchor.floor_id) !== String(floor)) continue;
            const w = Math.pow(Math.max(0, rssi - MIN_RSSI), WCL_EXP);
            totalWeight += w;
            if (!this.anchorRoomMap.get(mac.toLowerCase())) {
                corridorWeight += w;
            }
        }

        let base = totalWeight > 0 ? corridorWeight / totalWeight : 0;
        if (bestCandidate) {
            base = Math.max(0, base - bestCandidate.score * 0.35);
        }
        return Math.max(0, Math.min(1, base));
    }

    determineSemanticState(tagMac, floor, rawPos, vector, state) {
        const evidence = this.getSemanticZoneEvidence(floor, vector, state);
        const now = Date.now();
        const previous = state.semantic || { mode: 'UNKNOWN', roomId: null, since: now, confidence: 0 };
        const next = {
            mode: previous.mode,
            roomId: previous.roomId,
            since: previous.since,
            confidence: previous.confidence || 0,
            candidateRoomId: previous.candidateRoomId || null,
            candidateCount: previous.candidateCount || 0,
            exitCount: previous.exitCount || 0,
            lastStableRoomId: previous.lastStableRoomId || previous.roomId || null,
            switchBlockUntil: previous.switchBlockUntil || 0,
            evidence,
            reason: 'hold'
        };

        const ENTER_EVIDENCE_MIN = 0.56;
        const ENTER_MARGIN_MIN = 0.14;
        const ENTER_SCORE_MIN = 0.44;
        const CANDIDATE_ENTER_CYCLES = Math.max(ENTER_CYCLES + 1, 4);
        const EXIT_EVIDENCE_MIN = 0.78;
        const EXIT_CONFIRM_CYCLES = Math.max(EXIT_CYCLES, 8);
        const SWITCH_COOLDOWN_MS = 15000;
        const CROSS_ROOM_MARGIN_MIN = 0.24;
        const CROSS_ROOM_ENTER_EVIDENCE = 0.72;

        const best = evidence.best;
        const bestRoomId = best?.room?.id ?? null;
        const strongEnter =
            !!best &&
            best.score >= ENTER_SCORE_MIN &&
            evidence.enterEvidence >= ENTER_EVIDENCE_MIN &&
            evidence.margin >= ENTER_MARGIN_MIN &&
            !evidence.ambiguousTop2;

        const tryingOtherThanLastStable =
            !!bestRoomId &&
            !!next.lastStableRoomId &&
            bestRoomId !== next.lastStableRoomId;

        const blockedCrossRoomEnter =
            tryingOtherThanLastStable &&
            now < next.switchBlockUntil &&
            !(evidence.enterEvidence >= CROSS_ROOM_ENTER_EVIDENCE && evidence.margin >= CROSS_ROOM_MARGIN_MIN);

        if (previous.mode === 'IN_ROOM' && previous.roomId) {
            const current = evidence.ranked.find(x => x.room.id === previous.roomId);
            if (current) {
                next.confidence = Math.max(0.40, Math.min(0.99, 0.88 * previous.confidence + 0.12 * current.score));
            } else {
                next.confidence = Math.max(0.30, previous.confidence * 0.94);
            }

            if (evidence.exitEvidence >= EXIT_EVIDENCE_MIN) {
                next.mode = 'EXIT_CANDIDATE';
                next.roomId = previous.roomId;
                next.exitCount = (previous.exitCount || 0) + 1;
                next.reason = 'exit_candidate';
                return next;
            }

            next.mode = 'IN_ROOM';
            next.roomId = previous.roomId;
            next.lastStableRoomId = previous.roomId;
            next.exitCount = 0;
            next.candidateRoomId = null;
            next.candidateCount = 0;
            next.reason = bestRoomId && bestRoomId !== previous.roomId ? 'hold_vs_competitor' : 'stay_in_room';
            return next;
        }

        if (previous.mode === 'EXIT_CANDIDATE' && previous.roomId) {
            if (evidence.exitEvidence >= EXIT_EVIDENCE_MIN) {
                next.exitCount = (previous.exitCount || 0) + 1;
                if (next.exitCount >= EXIT_CONFIRM_CYCLES) {
                    next.mode = 'CORRIDOR';
                    next.roomId = null;
                    next.confidence = Math.max(0.40, evidence.corridorScore);
                    next.lastStableRoomId = previous.roomId;
                    next.switchBlockUntil = now + SWITCH_COOLDOWN_MS;
                    next.candidateRoomId = null;
                    next.candidateCount = 0;
                    next.reason = 'exit_confirmed';
                    return next;
                }
                next.mode = 'EXIT_CANDIDATE';
                next.reason = 'exit_wait';
                return next;
            }

            next.mode = 'IN_ROOM';
            next.roomId = previous.roomId;
            next.lastStableRoomId = previous.roomId;
            next.exitCount = 0;
            next.reason = 'exit_cancelled';
            return next;
        }

        if (strongEnter && bestRoomId && !blockedCrossRoomEnter) {
            if (previous.candidateRoomId === bestRoomId) {
                next.candidateCount = (previous.candidateCount || 0) + 1;
            } else {
                next.candidateRoomId = bestRoomId;
                next.candidateCount = 1;
            }

            if (next.candidateCount >= CANDIDATE_ENTER_CYCLES) {
                next.mode = 'IN_ROOM';
                next.roomId = bestRoomId;
                next.since = now;
                next.confidence = best.score;
                next.exitCount = 0;
                next.lastStableRoomId = bestRoomId;
                next.reason = next.switchBlockUntil > now ? 'reenter_or_strong_switch' : 'enter_confirmed';
                return next;
            }

            next.mode = 'ROOM_CANDIDATE';
            next.roomId = null;
            next.reason = 'candidate_room';
            return next;
        }

        next.candidateRoomId = null;
        next.candidateCount = 0;
        next.exitCount = 0;
        next.confidence = Math.max(0.2, evidence.corridorScore);

        if (blockedCrossRoomEnter) {
            next.mode = evidence.corridorScore >= 0.40 ? 'CORRIDOR' : 'UNKNOWN';
            next.roomId = null;
            next.reason = 'switch_blocked';
            return next;
        }

        next.mode = evidence.corridorScore >= 0.40 ? 'CORRIDOR' : 'UNKNOWN';
        next.roomId = null;
        next.reason = evidence.ambiguousTop2 ? 'ambiguous_top2' : (next.mode === 'CORRIDOR' ? 'corridor_score' : 'unknown_hold');
        return next;
    }

    renderSemanticPosition(floor, rawPos, semantic, previousPos) {
        if (semantic.mode === 'IN_ROOM' || semantic.mode === 'EXIT_CANDIDATE') {
            const room = this.rooms.find(r => r.id === semantic.roomId);
            if (room) {
                return {
                    pos: this.getRoomCentroid(room),
                    displayName: room.name,
                    zoneType: 'room',
                    room,
                    method: semantic.reason
                };
            }
        }

        if (semantic.mode === 'ROOM_CANDIDATE') {
            return {
                pos: this.applySmoothing(rawPos, previousPos),
                displayName: semantic.candidateRoomId ? `candidate:${semantic.candidateRoomId}` : 'candidate',
                zoneType: 'candidate',
                room: null,
                method: semantic.reason
            };
        }

        if (semantic.mode === 'CORRIDOR') {
            return {
                pos: this.snapToCorridor(rawPos, floor),
                displayName: 'circulation',
                zoneType: 'corridor',
                room: null,
                method: semantic.reason
            };
        }

        return {
            pos: this.applySmoothing(rawPos, previousPos),
            displayName: 'default',
            zoneType: 'unknown',
            room: null,
            method: semantic.reason
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  6) CORRIDOR HELPERS
    // ═══════════════════════════════════════════════════════════════════════
    isInsideCorridor(floor, pos) {
        const floorGeo = this.floorGeometries?.get(String(floor));
        if (!floorGeo?.corridor) return false;
        try {
            const pt = point([pos.x, pos.y]);
            const corridorPoly = floorGeo.corridor.type === 'MultiPolygon'
                ? multiPolygon(floorGeo.corridor.coordinates)
                : turfPolygon(floorGeo.corridor.coordinates);
            return turf(pt, corridorPoly);
        } catch (e) {
            return false;
        }
    }

    projectToTrajet(floor, pos) {
        const floorGeo = this.floorGeometries?.get(String(floor));
        if (!floorGeo?.trajet) return pos;
        try {
            const pt = point([pos.x, pos.y]);
            const trajetLine = floorGeo.trajet.type === 'MultiLineString'
                ? multiLineString(floorGeo.trajet.coordinates)
                : (floorGeo.trajet.type === 'LineString'
                    ? floorGeo.trajet
                    : null);

            if (!trajetLine) return pos;

            const snapped = nearestPointOnLine(trajetLine, pt);
            const projection = {
                x: snapped.geometry.coordinates[0],
                y: snapped.geometry.coordinates[1]
            };

            // Progressive Snap (Quick Win): position = lerp(raw, projection, alpha)
            const alpha = SNAP_CFG.lerp || 0.3;
            return {
                x: pos.x * (1 - alpha) + projection.x * alpha,
                y: pos.y * (1 - alpha) + projection.y * alpha
            };
        } catch (e) {
            console.error('[RTLS] projectToTrajet error:', e.message);
            return pos;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  7) DETERMINE ZONE — Strict priority order
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Priority:
     *  1. Door Gating Schmitt (enter/exit via room_gate_anchors)
     *  2. Room Polygon (point-in-polygon) + confidence validation near doors
     *  3. Corridor Polygon + hysteresis
     *  4. Fallback: maintain lock OR RSSI differential
     */
    determineZone(tagMac, floor, rawPos, vector, state) {
        const pt = point([rawPos.x, rawPos.y]);

        if (String(floor) === '6') {
            const f6Rooms = this.rooms.filter(r => String(r.floor_id) === '6');
            dbg(`[ZONE:F6] tag=${tagMac.slice(-4)} pos=(${rawPos.x.toFixed(0)},${rawPos.y.toFixed(0)}) ` +
                `roomsCount=${f6Rooms.length} rooms: ${f6Rooms.map(r => `${r.name}(id:${r.id},poly:${!!r.polygonGeo})`).join(', ')}`);
        }

        // ── 1. DOOR GATING SCHMITT ──
        const doorResult = this.doorGatingSchmitt(state, floor, vector);
        if (doorResult) {
            if (doorResult.action === 'enter') {
                dbg(`[ZONE] SCHMITT ENTER → ${doorResult.room.name}`);
                return {
                    type: 'room', room: doorResult.room,
                    confidence: 'high', snapCentroid: true,
                    method: 'schmitt_enter', displayName: doorResult.room.name
                };
            } else if (doorResult.action === 'exit') {
                dbg(`[ZONE] SCHMITT EXIT ← ${doorResult.room.name}`);
                return {
                    type: 'corridor', room: null,
                    confidence: 'high', snapCentroid: false,
                    method: 'schmitt_exit', displayName: 'circulation'
                };
            }
        }

        // ── 2. ROOM POLYGON ──
        let polygonRoom = null;
        for (const room of this.rooms) {
            if (room.type === 'room' && room.polygonGeo && String(room.floor_id) === String(floor)) {
                if (turf(pt, room.polygonGeo)) {
                    polygonRoom = room;
                    break;
                } else if (String(floor) === '6' && tagMac.includes('1e21')) { // Debug tag Bloc2
                    // dbg(`[ZONE:F6] No poly match for ${room.name} (${room.polygon})`);
                }
            }
        }

        if (polygonRoom) {
            // Anti-Bleed: if locked in a different room, validate with confidence
            if (state.roomLock && state.roomLock.roomId !== polygonRoom.id) {
                const conf = this.roomConfidence(polygonRoom, vector, floor);
                if (conf < ROOM_CONF_THRESHOLD) {
                    // Keep existing room lock — the geometry jump is likely noise
                    const lockedRoom = this.rooms.find(r => r.id === state.roomLock.roomId);
                    if (lockedRoom) {
                        dbg(`[ZONE] Anti-bleed: polygon=${polygonRoom.name} conf=${conf.toFixed(2)} < ${ROOM_CONF_THRESHOLD} → keep ${lockedRoom.name}`);
                        return {
                            type: 'room', room: lockedRoom,
                            confidence: 'high', snapCentroid: true,
                            method: 'anti_bleed_lock', displayName: lockedRoom.name
                        };
                    }
                }
            }

            const conf = this.roomConfidence(polygonRoom, vector, floor);
            dbg(`[ZONE] Polygon → ${polygonRoom.name} conf=${conf.toFixed(2)}`);
            return {
                type: 'room', room: polygonRoom,
                confidence: conf >= ROOM_CONF_THRESHOLD ? 'high' : 'medium',
                snapCentroid: true,
                method: 'polygon', displayName: polygonRoom.name
            };
        }

        // ── 3. CORRIDOR POLYGON + HYSTERESIS ──
        if (this.isInsideCorridor(floor, rawPos)) {
            // Hysteresis: if locked in a room, check if we should stay
            if (state.roomLock) {
                const lockedRoom = this.rooms.find(r => r.id === state.roomLock.roomId);
                const conf = lockedRoom ? this.roomConfidence(lockedRoom, vector, floor) : 0;
                if (conf > ROOM_CONF_THRESHOLD && lockedRoom) {
                    dbg(`[ZONE] Corridor hysteresis: conf=${conf.toFixed(2)} > ${ROOM_CONF_THRESHOLD} → keep ${lockedRoom.name}`);
                    return {
                        type: 'room', room: lockedRoom,
                        confidence: 'medium', snapCentroid: true,
                        method: 'corridor_hysteresis', displayName: lockedRoom.name
                    };
                }
            }
            return {
                type: 'corridor', room: null,
                confidence: 'high', snapCentroid: false,
                method: 'corridor_polygon', displayName: 'circulation'
            };
        }

        // ── 4. FALLBACK ──
        // A. Maintain lock if still active
        if (state.roomLock) {
            const lockedRoom = this.rooms.find(r => r.id === state.roomLock.roomId);
            if (lockedRoom) {
                dbg(`[ZONE] Fallback lock → ${lockedRoom.name}`);
                return {
                    type: 'room', room: lockedRoom,
                    confidence: 'low', snapCentroid: true,
                    method: 'lock_fallback', displayName: lockedRoom.name
                };
            }
        }

        // B. RSSI differential using room_gate_anchors
        const rssiRoom = this._fallbackRSSIDifferential(floor, vector);
        if (rssiRoom) {
            dbg(`[ZONE] RSSI fallback → ${rssiRoom.room.name} conf=${rssiRoom.confidence.toFixed(2)}`);
            return {
                type: 'room', room: rssiRoom.room,
                confidence: 'low', snapCentroid: false,
                method: 'rssi_fallback', displayName: rssiRoom.room.name
            };
        }

        return { type: 'unknown', room: null, confidence: 'none', snapCentroid: false, method: 'none', displayName: 'default' };
    }

    /**
     * Fallback: find room with the best RSSI differential from room_gate_anchors.
     */
    _fallbackRSSIDifferential(floor, vector) {
        let bestRoom = null;
        let bestDelta = -Infinity;

        const floorRooms = this.rooms.filter(r => r.type === 'room' && String(r.floor_id) === String(floor));

        for (const room of floorRooms) {
            const gate = this.roomGates.get(room.id);
            if (!gate) continue;

            const sRoom = this._weightedMeanRSSI(gate.positive, vector);
            const sOut = this._weightedMeanRSSI(gate.negative, vector);
            if (sRoom === null) continue;

            const delta = sRoom - (sOut ?? -100);
            if (sRoom > EXIT_RSSI && delta > bestDelta) {
                bestDelta = delta;
                bestRoom = room;
            }
        }

        if (bestRoom && bestDelta > 0) {
            return { room: bestRoom, confidence: Math.min(1, bestDelta / 20) };
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  8) SMOOTHING / SNAPPING HELPERS
    // ═══════════════════════════════════════════════════════════════════════
    applySmoothing(newPos, oldPos) {
        if (!oldPos || (oldPos.x === 0 && oldPos.y === 0)) return newPos;
        return {
            x: oldPos.x * (1 - EMA_ALPHA) + newPos.x * EMA_ALPHA,
            y: oldPos.y * (1 - EMA_ALPHA) + newPos.y * EMA_ALPHA
        };
    }

    snapToCorridor(pos, floorId) {
        // Only snap if the point is INSIDE the corridor polygon
        if (!this.isInsideCorridor(floorId, pos)) return pos;
        return this.projectToTrajet(floorId, pos);
    }

    getClosestPointOnSegment(p, a, b) {
        const atob = { x: b.x - a.x, y: b.y - a.y };
        const atop = { x: p.x - a.x, y: p.y - a.y };
        const lenSq = atob.x * atob.x + atob.y * atob.y;
        if (lenSq === 0) return a;
        let dot = atop.x * atob.x + atop.y * atob.y;
        let t = Math.min(1, Math.max(0, dot / lenSq));
        return { x: a.x + atob.x * t, y: a.y + atob.y * t };
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  9) UPDATE TAG STATE — Main pipeline
    // ═══════════════════════════════════════════════════════════════════════
    async updateTagState(tagMac, floor, vector) {
        let savedAsset = null;

        let state = this.tagState.get(tagMac);
        if (!state) {
            state = {
                floor,
                lastFloorChange: Date.now(),
                position: { x: 0, y: 0 },
                lastUpdate: Date.now(),
                roomLock: null,
                lastZone: null,
                _zoneHistory: [],
                _flipCount: 0,
                _flipTimestamps: [],
                _schmitt: {},
                _floorCandidate: null,
                _floorStableCount: 0,
                semantic: {
                    mode: 'UNKNOWN',
                    roomId: null,
                    since: Date.now(),
                    confidence: 0,
                    candidateRoomId: null,
                    candidateCount: 0,
                    exitCount: 0,
                    reason: 'init',
                    lastStableRoomId: null,
                    switchBlockUntil: 0
                }
            };
            this.tagState.set(tagMac, state);
        } else if (String(state.floor) !== String(floor)) {
            state.floor = floor;
            state.lastFloorChange = Date.now();
            state.roomLock = null;
            state._zoneHistory = [];
            state._schmitt = {};
            state.semantic = {
                mode: 'UNKNOWN',
                roomId: null,
                since: Date.now(),
                confidence: 0,
                candidateRoomId: null,
                candidateCount: 0,
                exitCount: 0,
                reason: 'floor_reset'
            };
        }

        try {
            const rawPos = this.computeRawPosition(floor, vector);
            if (!rawPos) return;

            if (state.position && state.position.x !== 0) {
                const dist_cm = Math.sqrt((rawPos.x - state.position.x) ** 2 + (rawPos.y - state.position.y) ** 2);
                const dt_s = (Date.now() - state.lastUpdate) / 1000;
                const METRIC_SPEED_LIMIT = 500;
                if (dist_cm > METRIC_SPEED_LIMIT * Math.max(dt_s, 1)) {
                    dbg(`[PIPELINE] RAW jump detected: dist=${dist_cm.toFixed(0)}cm in ${dt_s.toFixed(1)}s`);
                }
                state.isMoving = dist_cm > MIN_MOVE_CM;
            }

            const semantic = this.determineSemanticState(tagMac, floor, rawPos, vector, state);
            state.semantic = semantic;

            if (semantic.mode === 'IN_ROOM' || semantic.mode === 'EXIT_CANDIDATE') {
                state.roomLock = { roomId: semantic.roomId, since: semantic.since || Date.now() };
            } else {
                state.roomLock = null;
            }

            const rendered = this.renderSemanticPosition(floor, rawPos, semantic, state.position);
            let finalPos = rendered.pos;
            let detectedZoneName = rendered.displayName;
            let zoneType = rendered.zoneType;

            if (!Number.isFinite(finalPos.x) || !Number.isFinite(finalPos.y)) return;

            finalPos = {
                x: Math.round(finalPos.x),
                y: Math.round(finalPos.y)
            };

            const trackedZone = rendered.room ? { type: rendered.zoneType, room: rendered.room } : { type: rendered.zoneType, room: null };
            this._trackFlips(state, trackedZone);

            state.position = finalPos;
            state.lastUpdate = Date.now();
            state.lastZone = zoneType;

            dbg(`[PIPELINE:SEM] tag=${tagMac.slice(-4)} floor=${floor} semantic=${semantic.mode} ` +
                `room=${semantic.roomId || '-'} cand=${semantic.candidateRoomId || '-'} reason=${semantic.reason} conf=${(semantic.confidence || 0).toFixed(2)} ` +
                `enter=${(semantic.evidence?.enterEvidence || 0).toFixed(2)} exit=${(semantic.evidence?.exitEvidence || 0).toFixed(2)} ` +
                `margin=${(semantic.evidence?.margin || 0).toFixed(2)} ratio=${(semantic.evidence?.top2Ratio || 0).toFixed(2)} ` +
                `corr=${(semantic.evidence?.corridorScore || 0).toFixed(2)} pos=(${finalPos.x},${finalPos.y}) flips/min=${this._getFlipsPerMin(state)}`);

            savedAsset = await Asset.updateLocation(
                tagMac,
                floor,
                detectedZoneName,
                finalPos.x,
                finalPos.y,
                semantic.lastStableRoomId || null
            );
        } catch (error) {
            console.error(`[RTLS] updateTagState error for ${tagMac}:`, error.message);
            return;
        }

        if (savedAsset) {
            this.emit('position', {
                id: tagMac,
                floor,
                x: state.position.x,
                y: state.position.y,
                zone: state.lastZone,
                semanticMode: state.semantic?.mode,
                semanticReason: state.semantic?.reason,
                type_id: savedAsset.type_id,
                timestamp: new Date().toISOString(),
                known: true
            });
        }
    }

    // ─── Room Lock Window (ROOM_LOCK_WINDOW consecutive same-room ticks) ──
    _updateRoomLockWindow(state, zoneResult, vector) {
        if (zoneResult.type === 'room' && zoneResult.room) {
            state._zoneHistory.push(zoneResult.room.id);
            if (state._zoneHistory.length > ROOM_LOCK_WINDOW) {
                state._zoneHistory.shift();
            }

            // A. Immediate lock if confidence is high
            if (!state.roomLock && zoneResult.confidence === 'high') {
                const conf = this.roomConfidence(zoneResult.room, vector, String(state.floor));
                if (conf >= ROOM_LOCK_CONF) {
                    state.roomLock = { roomId: zoneResult.room.id, since: Date.now() };
                    state._zoneHistory = [zoneResult.room.id]; // reset history to focus on this room
                    dbg(`[LOCK] Room lock acquired IMMEDIATE: ${zoneResult.room.name} (conf=${conf.toFixed(2)})`);
                    return;
                }
            }

            // B. Window-based lock (last ROOM_LOCK_WINDOW detections are ALL the same room)
            if (state._zoneHistory.length === ROOM_LOCK_WINDOW) {
                const allSame = state._zoneHistory.every(id => id === zoneResult.room.id);
                if (allSame) {
                    const conf = this.roomConfidence(zoneResult.room, vector, String(state.floor));
                    if (!state.roomLock || state.roomLock.roomId !== zoneResult.room.id) {
                        state.roomLock = { roomId: zoneResult.room.id, since: Date.now() };
                        dbg(`[LOCK] Room lock acquired WINDOW: ${zoneResult.room.name} (conf=${conf.toFixed(2)})`);
                    }
                }
            }

            // C. Also: immediate lock if Schmitt enters
            if (zoneResult.method === 'schmitt_enter') {
                state.roomLock = { roomId: zoneResult.room.id, since: Date.now() };
                state._zoneHistory = [zoneResult.room.id]; // reset history
            }

        } else if (zoneResult.type === 'corridor' && zoneResult.method === 'schmitt_exit') {
            // Schmitt exit → clear lock
            state.roomLock = null;
            state._zoneHistory = [];
        }
        // Don't clear lock for other cases (corridor_hysteresis, fallback, unknown)
    }

    // ─── Flip counter (60s sliding window) ────────────────────────────────
    _trackFlips(state, zoneResult) {
        const currentZone = zoneResult.room ? String(zoneResult.room.id) : zoneResult.type;
        const prevZone = state._lastTrackedZone;

        if (prevZone && currentZone !== prevZone) {
            state._flipTimestamps.push(Date.now());
        }
        state._lastTrackedZone = currentZone;

        // Prune older than 60s
        const cutoff = Date.now() - 60000;
        state._flipTimestamps = (state._flipTimestamps || []).filter(t => t > cutoff);
    }

    _getFlipsPerMin(state) {
        const cutoff = Date.now() - 60000;
        return (state._flipTimestamps || []).filter(t => t > cutoff).length;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  LEGACY HELPERS (kept for backward compatibility)
    // ═══════════════════════════════════════════════════════════════════════
    getFloorOfAnchor(mac) {
        const a = this.anchors.get(mac.toLowerCase());
        return a ? a.floor_id : DEFAULT_FLOOR_KEY;
    }

    detectRoomByRSSI(floor, vector) {
        const roomScores = new Map();
        for (const [mac, rssi] of Object.entries(vector)) {
            if (rssi < MIN_RSSI) continue;
            const anchor = this.anchors.get(mac.toLowerCase());
            if (!anchor || String(anchor.floor_id) !== String(floor)) continue;
            const room = this.anchorRoomMap.get(mac.toLowerCase());
            if (room) {
                const w = Math.pow(Math.max(0, rssi - MIN_RSSI), WCL_EXP);
                const current = roomScores.get(room.id) || { room, score: 0, maxRssi: -100 };
                current.score += w;
                current.maxRssi = Math.max(current.maxRssi, rssi);
                roomScores.set(room.id, current);
            }
        }
        if (roomScores.size === 0) return null;
        const sorted = Array.from(roomScores.values()).sort((a, b) => b.score - a.score);
        const best = sorted[0];
        if (best.maxRssi > -80) {
            if (sorted.length > 1) {
                if (best.score > sorted[1].score * 1.5) return { room: best.room, confidence: 0.7 };
            } else {
                return { room: best.room, confidence: 0.6 };
            }
        }
        return null;
    }

    calculateRoomConfidence(room, vector) {
        return this.roomConfidence(room, vector, room.floor_id);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  CALIBRATION (unchanged)
    // ═══════════════════════════════════════════════════════════════════════
    startCalibration(params) {
        this.calibrationSession = {
            ...params,
            startTime: Date.now(),
            data: {}
        };
        return { success: true };
    }

    stopCalibration() {
        if (!this.calibrationSession) return { success: false, message: 'No session' };

        const vector = {};
        for (const [anchor, samples] of Object.entries(this.calibrationSession.data)) {
            if (samples.length > 0) {
                vector[anchor] = this.getMedian(samples);
            }
        }

        const floor = this.calibrationSession.floor;
        if (!this.radioMap[floor]) this.radioMap[floor] = [];

        const calPoint = {
            x: this.calibrationSession.x,
            y: this.calibrationSession.y,
            rssi: vector,
            timestamp: Date.now()
        };

        this.radioMap[floor].push(calPoint);
        saveRadioMapToDisk(this.radioMap);

        const result = { success: true, point: calPoint };
        this.calibrationSession = null;
        return result;
    }

    getRadioMapData() {
        return this.radioMap;
    }

    deleteCalibrationPoint(floor, x, y) {
        if (!this.radioMap[floor]) return false;
        const initialLen = this.radioMap[floor].length;
        this.radioMap[floor] = this.radioMap[floor].filter(p => {
            return Math.abs(p.x - x) > 1 || Math.abs(p.y - y) > 1;
        });
        if (this.radioMap[floor].length !== initialLen) {
            saveRadioMapToDisk(this.radioMap);
            return true;
        }
        return false;
    }
}

const rtlsService = new RtlsService();
export default rtlsService;
