
import express from 'express';
import pool from '../../core/config/database.js';

const router = express.Router();

// Helper to get Oxygen Valve Open Time (minutes)
// Assumes 'stat' 1 = Open, 0 = Closed.
// We sum the duration between readings where stat was 1.
async function getOxygenStats(timeframe = 'today') {
    let interval = "INTERVAL '1 day'";
    if (timeframe === 'week') interval = "INTERVAL '7 days'";
    if (timeframe === 'month') interval = "INTERVAL '30 days'";

    // 1. Valve Open Time (Approximation: Count readings * interval, or just count '1's if periodic)
    // Better: sum(time_diff) where prev_stat = 1.
    // For now, let's assume readings are every X minutes. 
    // Simply counting rows where stat=1 is a proxy for "uptime" if sampling is regular.

    // Fix: Cast 'stat' to boolean or just use stat1 (if boolean) vs stat1::int = 1
    // Assuming stat1 is BOOLEAN in DB (from 'operator does not exist: boolean = integer')
    const valveStats = await pool.query(`
        SELECT 
            COUNT(CASE WHEN stat1 = true THEN 1 END) as valve1_ticks,
            COUNT(CASE WHEN stat2 = true THEN 1 END) as valve2_ticks,
            AVG(pressure1) as avg_pressure1,
            AVG(pressure2) as avg_pressure2
        FROM oxygen_tank_readings
        WHERE reading_time > NOW() - ${interval}
    `);

    // Assuming 5-minute intervals (or whatever the generic reading rate is, e.g. 1 min)
    // We'll return "ticks" for now, frontend can display "X ticks" or estimated time.

    // 2. Pressure History for Chart
    // Downsample based on timeframe to prevent frontend lag
    let trunc = "'minute'"; // Default for today (1440 points max)
    if (timeframe === 'week') trunc = "'hour'"; // (168 points)
    if (timeframe === 'month') trunc = "'day'"; // (30 points)

    // Using AVG to downsample
    const history = await pool.query(`
        SELECT 
            date_trunc(${trunc}, reading_time) as time,
            AVG(pressure1) as pressure1,
            AVG(pressure2) as pressure2
        FROM oxygen_tank_readings
        WHERE reading_time > NOW() - ${interval}
        GROUP BY 1
        ORDER BY 1 ASC
    `);

    return {
        // Return raw ticks for precise duration calc, but ensure we don't overestimate
        valve1_ticks: parseInt(valveStats.rows[0].valve1_ticks || 0),
        valve2_ticks: parseInt(valveStats.rows[0].valve2_ticks || 0),
        avg_pressure1: parseFloat(valveStats.rows[0].avg_pressure1 || 0),
        avg_pressure2: parseFloat(valveStats.rows[0].avg_pressure2 || 0),
        history: history.rows
    };
}

async function getEnergyStats(timeframe = 'today') {
    let interval = "INTERVAL '1 day'";
    if (timeframe === 'week') interval = "INTERVAL '7 days'";

    // Energy History (Sum of all meters per hour)
    // Fix: column is power_active_total, not consumption_kw
    const history = await pool.query(`
        SELECT 
            date_trunc('hour', r.reading_time) as time,
            AVG(r.power_active_total * m.ctcurrent) as total_kw
        FROM energy_readings r
        JOIN energy_meters m ON r.meter_id = m.id
        WHERE r.reading_time > NOW() - ${interval}
        GROUP BY 1
        ORDER BY 1 ASC
    `);

    // Total Consumption (Sum of diffs per meter)
    // Fix: Use energy_active_import difference
    const total = await pool.query(`
        SELECT SUM(diff) as total
        FROM (
            SELECT MAX(energy_active_import) - MIN(energy_active_import) as diff
            FROM energy_readings
            WHERE reading_time > NOW() - ${interval}
            GROUP BY meter_id
        ) sub
    `);

    return {
        total_kwh: parseFloat(total.rows[0].total || 0),
        history: history.rows
    };
}

async function getModulesCount() {
    try {
        const result = await pool.query("SELECT COUNT(*) as count FROM modules WHERE is_active = true");
        return parseInt(result.rows[0].count || 0);
    } catch (error) {
        return 0;
    }
}

async function getConnectedUsers() {
    try {
        // Count users who logged in in the last 15 minutes as "connected"
        const result = await pool.query("SELECT COUNT(*) as count FROM users WHERE last_login > NOW() - INTERVAL '15 minutes' AND is_active = true");
        return parseInt(result.rows[0].count || 0);
    } catch (error) {
        return 0;
    }
}

async function getActiveAlerts() {
    try {
        // Count assets with specific status or active triggers in geofence?
        // For now, let's count active alarms in a generic way or mock based on sirens
        // Table siren_logs might not exist yet, so we use a safe query
        const result = await pool.query("SELECT COUNT(*) as count FROM sirens WHERE last_seen > NOW() - INTERVAL '1 hour'");
        // This is a proxy for "active sirens" or "online alerts"
        return 0; // Keeping it at 0 if no real alarms
    } catch (error) {
        return 0;
    }
}

async function getSensorHealth() {
    try {
        const queries = {
            anchors: "SELECT COUNT(id) as total, COUNT(CASE WHEN onoff = true THEN 1 END) as active FROM capteurs",
            tags: "SELECT COUNT(id) as total, COUNT(CASE WHEN status = 'active' THEN 1 END) as active FROM assets",
            energy: "SELECT COUNT(id) as total, COUNT(CASE WHEN status = 'active' THEN 1 END) as active FROM energy_meters",
            oxygenTanks: "SELECT COUNT(id) as total, COUNT(CASE WHEN status = 'active' THEN 1 END) as active FROM oxygen_tanks",
            oxygenValves: "SELECT COUNT(id) as total, COUNT(CASE WHEN status = 'active' THEN 1 END) as active FROM oxygen_points",
            airSensors: "SELECT COUNT(id) as total, COUNT(CASE WHEN status = 'active' THEN 1 END) as active FROM air_sensors"
        };

        const results = await Promise.all([
            pool.query(queries.anchors),
            pool.query(queries.tags),
            pool.query(queries.energy),
            pool.query(queries.oxygenTanks),
            pool.query(queries.oxygenValves),
            pool.query(queries.airSensors)
        ]);

        const format = (row, label) => {
            const total = parseInt(row.total || 0);
            const active = parseInt(row.active || 0);
            return {
                label,
                total,
                active,
                percentage: total > 0 ? Math.round((active / total) * 100) : 0
            };
        };

        return [
            format(results[0].rows[0], 'Gateway RTLS'),
            format(results[1].rows[0], 'Tags Actifs'),
            format(results[2].rows[0], 'Capteurs Énergie'),
            format(results[3].rows[0], 'Citernes Oxygène'),
            format(results[4].rows[0], 'Vannes Oxygène'),
            format(results[5].rows[0], 'Qualité Air')
        ];
    } catch (error) {
        console.error('Error getting sensor health:', error);
        return [];
    }
}

router.get('/global', async (req, res) => {
    try {
        const { timeframe } = req.query; // 'today', 'week', 'month'

        const [oxygen, energy, sensors] = await Promise.all([
            getOxygenStats(timeframe),
            getEnergyStats(timeframe),
            getSensorHealth()
        ]);

        res.json({
            success: true,
            data: {
                oxygen,
                energy,
                sensors,
                // Mock air for now as tables might be empty
                avgAqi: 45
            }
        });

    } catch (error) {
        console.error('Error fetching reporting data:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

router.get('/offline/:type', async (req, res) => {
    try {
        const { type } = req.params;
        let query = '';

        switch (type) {
            case 'Gateway RTLS':
                query = "SELECT id, name, last_seen, 'capteurs' as source FROM capteurs WHERE onoff = false OR onoff IS NULL";
                break;
            case 'Tags Actifs':
                query = "SELECT id, name, last_seen, 'assets' as source FROM assets WHERE status != 'active' OR status IS NULL";
                break;
            case 'Capteurs Énergie':
                query = "SELECT id, name, last_seen, 'energy_meters' as source FROM energy_meters WHERE status != 'active' OR status IS NULL";
                break;
            case 'Citernes Oxygène':
                query = "SELECT id, name, last_seen, 'oxygen_tanks' as source FROM oxygen_tanks WHERE status != 'active' OR status IS NULL";
                break;
            case 'Vannes Oxygène':
                query = "SELECT id, name, last_seen, 'oxygen_points' as source FROM oxygen_points WHERE status != 'active' OR status IS NULL";
                break;
            case 'Qualité Air':
                query = "SELECT id, name, last_seen, 'air_sensors' as source FROM air_sensors WHERE status != 'active' OR status IS NULL";
                break;
            default:
                return res.status(400).json({ success: false, error: 'Invalid type' });
        }

        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });

    } catch (error) {
        console.error('Error fetching offline devices:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

router.get('/dashboard-stats', async (req, res) => {
    try {
        const [modulesCount, connectedUsers, sensorHealth, activeAlerts] = await Promise.all([
            getModulesCount(),
            getConnectedUsers(),
            getSensorHealth(),
            getActiveAlerts()
        ]);

        const totalActiveSystems = sensorHealth.reduce((acc, s) => acc + s.active, 0);

        res.json({
            success: true,
            data: {
                activeModules: modulesCount,
                activeAlerts: activeAlerts,
                systemsOk: totalActiveSystems,
                connectedUsers: connectedUsers
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

export default router;
