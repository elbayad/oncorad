import express from 'express';
import rtlsService from './rtls.service.js';

const router = express.Router();

/**
 * @route   POST /api/rtls-profiler/start
 * @desc    Start profiling a room for a specific tag
 * @access  Public (should be protected in prod)
 */
router.post('/start', (req, res) => {
    const { tagMac, roomId } = req.body;

    if (!tagMac || !roomId) {
        return res.status(400).json({ success: false, message: 'tagMac and roomId are required' });
    }

    if (!rtlsService.roomProfiler) {
        return res.status(500).json({ success: false, message: 'Room Profiler not initialized' });
    }

    rtlsService.roomProfiler.start(tagMac, roomId);
    res.json({ success: true, message: `Started profiling ${tagMac} in room ${roomId}` });
});

/**
 * @route   POST /api/rtls-profiler/stop
 * @desc    Stop profiling and save signature
 */
router.post('/stop', (req, res) => {
    if (!rtlsService.roomProfiler) {
        return res.status(500).json({ success: false, message: 'Room Profiler not initialized' });
    }

    rtlsService.roomProfiler.stop();
    res.json({ success: true, message: 'Profiling stopped and saved.' });
});

/**
 * @route   GET /api/rtls-profiler/profiles
 * @desc    Get all learned room profiles
 */
router.get('/profiles', (req, res) => {
    if (!rtlsService.roomProfiler) {
        return res.status(500).json({ success: false, message: 'Room Profiler not initialized' });
    }

    res.json({ success: true, data: rtlsService.roomProfiler.profiles });
});

/**
 * @route   POST /api/rtls-profiler/snap-to-room
 * @desc    Manual trigger to snap all assets to their assigned rooms
 */
router.post('/snap-to-room', async (req, res) => {
    try {
        await rtlsService.snapToRoom();
        res.json({ success: true, message: 'Snap to room operation completed successfully.' });
    } catch (error) {
        console.error('[RTLS] Error in manual snap-to-room:', error.message);
        res.status(500).json({ success: false, message: 'Snap to room failed' });
    }
});

export default router;
