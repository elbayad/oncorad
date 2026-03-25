
import express from 'express';
import OxygenTank from './oxygen-tank.model.js';
import OxygenTankReading from './oxygen-tank-reading.model.js';

const router = express.Router();

// Get all oxygen tanks with their latest reading
router.get('/', async (req, res) => {
    try {
        const tanks = await OxygenTank.getAll();
        const result = [];

        for (const tank of tanks) {
            const reading = await OxygenTankReading.getLatest(tank.id);

            let status = 'offline'; // Default to offline
            let latest_reading = null;

            if (reading) {
                const now = new Date();
                const readingTime = new Date(reading.reading_time);
                const diffMs = now - readingTime;
                const oneMinuteMs = 60 * 1000;

                if (diffMs <= oneMinuteMs) {
                    status = 'active';
                }
                latest_reading = reading;
            }

            result.push({
                ...tank,
                status: status, // Override DB status with calculated status
                latest_reading: latest_reading
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching oxygen tanks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get history for a specific tank
router.get('/:id/history', async (req, res) => {
    try {
        const { id } = req.params;
        const { start, end } = req.query;

        // Default range: last 24h if not provided
        const startTime = start ? new Date(start) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const endTime = end ? new Date(end) : new Date();

        const history = await OxygenTankReading.getHistory(id, startTime, endTime);
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('Error fetching tank history:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
