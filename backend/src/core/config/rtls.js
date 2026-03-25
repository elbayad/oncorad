import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========= CONFIG =========
// MQTT
const MQTT_URL = process.env.MQTT_URL || "mqtt://10.0.0.2:1883";
const MQTT_USER = process.env.MQTT_USER || "";
const MQTT_PASS = process.env.MQTT_PASS || "";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "rtls/topic";

// --- Multi-tags ---
// - TAG_MACS="mac1,mac2" pour limiter à une liste (insensible à la casse)
// - si TAG_MACS / TAG_MAC vides → on suit TOUS les tags
const TRACK_TAGS = (process.env.TAG_MACS || process.env.TAG_MAC || "")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const TRACK_ALL = TRACK_TAGS.length === 0;

// Postgres
const PG = {
    host: process.env.PGHOST || "10.0.0.2",
    port: +(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "Data@data#15963*",
    database: process.env.PGDATABASE || "iot_clinic_db",
};

// ---------- Localisation : Fingerprinting + Trilateration (hybride) ----------
const USE_FINGERPRINT = true;

// Fichier radio-map (persistant sur disque)
const FP_DB_FILE = path.join(__dirname, "../data/radio-map.json"); // Adjusted path to be outside config/

const FP_META_FILE = path.join(__dirname, "../data/calibration-metadata.json");

// kNN & distances
const FP_K = 5;              // k voisins (Quick Win: k=5)
const FP_DIST = "euclid_z";     // "cosine" | "euclid_z"
const FP_MISSING_RSSI = -100;           // si ancre absente

// Calibration (collecte)
const FP_AUTO_SAMPLES = 80;             // nb de fenêtres si on oublie /fp/stop
const FP_KEEP_RAW = true;           // stocker les RSSI bruts

// Hybride fingerprint → refine trilat
const HYBRID_REFINE = true;
const HYBRID_MIX = 0.35;           // pos = mix*refine + (1-mix)*fingerprint
const HYBRID_CONF_THRESHOLD = 0.8; // Seuil de confiance pour favoriser le fingerprint
const HYBRID_MIN_ANCHORS = 3;      // En dessous de ce nombre, on favorise le WCL

// Fenêtrage & robustesse (cm)
const BUCKET_MS = 600;
const BUCKET_MS_FAST = 300;     // Bucket réduit si mouvement ou variance élevée
const VAR_THRESHOLD = 15;        // Seuil de variance pour passer en mode FAST
const TIMEOUT_MS = 1800;
const MIN_ANCHORS_TRILAT = 2;           // raffinement 2–3 ancres OK
const MIN_D_CM = 10;          // clamp near-field
const EMA_ALPHA = 0.15;        // lissage position (optimisé StabilityAgent)
const RSSI_EMA_ALPHA = 0.4;    // Alpha pour le filtrage EMA des RSSI
const MIN_MOVE_CM = 120;       // Seuil statique: ignorer mouvements < 1.2m (erreur métrique BLE)
const RES_THRESH_CM = 120;         // résidu moyen max
const CLAMP_Y_MIN_CM = 0;

// Modèle RSSI→distance (trilat)
const PATH_LOSS_N = 3.0;
const TX_POWER_DBM_DEFAULT = -77;     // fallback global
// Fallback statique par MAC si DB vide (peut rester vide, DB prime si présente)
const TX_MAP = {
    "f8b3b7a8bae0": -77.0,
    "142b2fe8fcb4": -76.9,
    "142b2fe9b6c8": -93.3,
};

// Hystérésis de changement d’étage (fingerprint)
const FLOOR_LOCK_SEC = 5;    // verrou minimal avant rebascule
const FLOOR_MARGIN = 0.12; // il faut être ~12% "mieux" pour changer
const FLOOR_SCORE_SCALE = 10; // Echelle pour le scoring exponentiel

// Journalisation (NDJSON)
const LOG_CALC = true;
const LOG_FILE = path.join(__dirname, "../logs/calc-log.ndjson"); // Adjusted path

// Simulation (si pas de MQTT)
const FAKE_MODE = false; // true pour simuler sans MQTT

// Étage par défaut
const DEFAULT_FLOOR_KEY = 1;

// === TX @1m calibration ===
const TX_RADIUS_CM = 100;  // 1 m (info – utilisé côté front)
const TX_TOL_CM_DEFAULT = 20;   // tolérance de clic sur l’anneau 1 m
const TX_WINDOWS_DEFAULT = 20;   // nombre de fenêtres à collecter

// ---- Snap couloirs (map-matching) ----
const SNAP_CFG = {
    enable: (process.env.USE_SNAP_MAP ?? "true") === "true",
    blend: +(process.env.SNAP_BLEND ?? 0.50),
    radius_cm: +(process.env.SNAP_RADIUS_CM ?? 120),
    lerp: 0.3, // Quick win: progressive snap
};

// ---- Room Lock (stabilisation chambre) ----
const ROOM_LOCK_ENTER = +(process.env.ROOM_LOCK_ENTER ?? 3);   // 3 consecutive ticks in SAME room before locking
const ROOM_LOCK_EXIT = +(process.env.ROOM_LOCK_EXIT ?? 5);   // bucket ticks outside room before unlock
const ROOM_LOCK_LOST_EXIT = +(process.env.ROOM_LOCK_LOST_EXIT ?? 10); // longer grace if ALL door anchors lost

// ---- Floor 6 Primary Anchor → Room mapping ----
// Each room has a PRIMARY anchor; all other floor-6 anchors map to the nearest primary anchor's room (triangle)
const FLOOR6_ROOM_ANCHORS = {
    'Bloc1': '22',
    'Bloc2': '21',
    'Bloc3': '20',
    'Bloc4': '3',
    'Bloc5': '14',
    'Bloc6': '18',
    'Salle de Réveil': '4'
};

// ── Stability Agent Parameters (hospital-grade) ──
const MIN_RSSI = +(process.env.RTLS_MIN_RSSI ?? -88);
const WCL_EXP = +(process.env.RTLS_WCL_EXP ?? 4.0);
const DELTA_ENTER = +(process.env.RTLS_DELTA_ENTER ?? 5);
const ENTER_RSSI = +(process.env.RTLS_ENTER_RSSI ?? -75);
const EXIT_RSSI = +(process.env.RTLS_EXIT_RSSI ?? -81);
const EXIT_MARGIN = +(process.env.RTLS_EXIT_MARGIN ?? 2);
const ENTER_CYCLES = +(process.env.RTLS_ENTER_CYCLES ?? 4);
const EXIT_CYCLES = +(process.env.RTLS_EXIT_CYCLES ?? 8);
const FLOOR_HYST_DB = +(process.env.RTLS_FLOOR_HYST_DB ?? 6);
const FLOOR_STABLE_CYCLES = +(process.env.RTLS_FLOOR_STABLE_CYC ?? 3);
const FLOOR_LOCK_MS = +(process.env.RTLS_FLOOR_LOCK_MS ?? 10000);
const ROOM_CONF_THRESHOLD = +(process.env.RTLS_ROOM_CONF_THRESH ?? 0.3);
const ROOM_LOCK_WINDOW = +(process.env.RTLS_ROOM_LOCK_WINDOW ?? 5);
const ROOM_LOCK_CONF = +(process.env.RTLS_ROOM_LOCK_CONF ?? 0.55);

// ---- Moving Average (RSSI smoothing) ----
const MA_WINDOW = +(process.env.RTLS_MA_WINDOW ?? 4); // nombre de fenêtres pour la moyenne mobile

// ---- Corridor Jump Guard ----
const CORRIDOR_MAX_JUMP_CM = +(process.env.CORRIDOR_MAX_JUMP_CM ?? 200); // max snap jump per tick (2m/s)

// ⚠️ Exemple
const MAP_LINES = {
    F1: [
        [{ x: 100, y: 100 }, { x: 800, y: 100 }, { x: 1200, y: 100 }],
        [{ x: 400, y: 100 }, { x: 400, y: 600 }]
    ],
    // F2: [...]
};

const PORT = process.env.PORT || 8000;

// ---- Batterie : 0..3000 mV → 0..100 % (linéaire) ----
const BATTERY_EMPTY_MV = +(process.env.BATTERY_EMPTY_MV || 0);
const BATTERY_FULL_MV = +(process.env.BATTERY_FULL_MV || 3000);

// ---- Réseau ----
const NETWORK_SUBNET = process.env.NETWORK_SUBNET || "10.0.0";

export {
    MQTT_URL,
    MQTT_USER,
    MQTT_PASS,
    MQTT_TOPIC,
    TRACK_TAGS,
    TRACK_ALL,
    PG,
    USE_FINGERPRINT,
    FP_DB_FILE,
    FP_META_FILE,
    FP_K,
    FP_DIST,
    FP_MISSING_RSSI,
    FP_AUTO_SAMPLES,
    FP_KEEP_RAW,
    HYBRID_REFINE,
    HYBRID_MIX,
    HYBRID_CONF_THRESHOLD,
    HYBRID_MIN_ANCHORS,
    BUCKET_MS,
    BUCKET_MS_FAST,
    VAR_THRESHOLD,
    TIMEOUT_MS,
    MIN_ANCHORS_TRILAT,
    MIN_D_CM,
    EMA_ALPHA,
    RSSI_EMA_ALPHA,
    MIN_MOVE_CM,
    RES_THRESH_CM,
    CLAMP_Y_MIN_CM,
    PATH_LOSS_N,
    TX_POWER_DBM_DEFAULT,
    TX_MAP,
    FLOOR_LOCK_SEC,
    FLOOR_MARGIN,
    FLOOR_SCORE_SCALE,
    LOG_CALC,
    LOG_FILE,
    FAKE_MODE,
    DEFAULT_FLOOR_KEY,
    TX_RADIUS_CM,
    TX_TOL_CM_DEFAULT,
    TX_WINDOWS_DEFAULT,
    SNAP_CFG,
    MAP_LINES,
    ROOM_LOCK_ENTER,
    ROOM_LOCK_EXIT,
    ROOM_LOCK_LOST_EXIT,
    FLOOR6_ROOM_ANCHORS,
    CORRIDOR_MAX_JUMP_CM,
    PORT,
    BATTERY_EMPTY_MV,
    BATTERY_FULL_MV,
    NETWORK_SUBNET,
    // ── Stability Agent ──
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
    MA_WINDOW
};

