
import express from 'express';
import Admission from '../hospital/admission.model.js';
import Asset from '../hospital/asset.model.js';
import Episode from './episode.model.js';
import RtlsAssignment from '../rtls/rtls-assignment.model.js';
import authController from '../auth/auth.controller.js';

const router = express.Router();

router.get('/', authController.verifyToken, async (req, res) => {
    try {
        const limit = Number(req.query.limit || 10);
        const offset = Number(req.query.offset || 0);
        const search = req.query.search || null;

        const [data, total] = await Promise.all([
            Admission.list({ limit, offset, search }),
            Admission.count({ search })
        ]);

        res.json({ success: true, data, total });
    } catch (error) {
        // console.error('List admissions error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/', authController.verifyToken, async (req, res) => {
    try {
        // 0. Sync Asset FIRST to avoid FK violation
        if (req.body.mac_rtls) {
            const fullName = `${req.body.nom} ${req.body.prenom}`.trim();
            await Asset.upsertFromMac(req.body.mac_rtls, fullName, req.body.etage || 1);
        }

        let episodeId = null;

        // Episode Logic:
        // 1. If MAC provided, look for active episode
        if (req.body.mac_rtls) {
            const activeEpisode = await Episode.findActiveByAsset(req.body.mac_rtls);

            if (activeEpisode) {
                // Reuse existing active episode
                episodeId = activeEpisode.id;
            } else {
                // Create new Episode and Assignment
                const newEpisode = await Episode.create({ context: 'admission' });
                episodeId = newEpisode.id;
                await RtlsAssignment.create({
                    assetId: req.body.mac_rtls,
                    episodeId: newEpisode.id
                });
            }
        } else {
            // No MAC provided (fallback? or just create episode without assignment?)
            // Requirement says: "Lors de la première saisie... Créer un épisode"
            // If no MAC, we can still create an episode, but can't assign RTLS yet.
            const newEpisode = await Episode.create({ context: 'admission' });
            episodeId = newEpisode.id;
        }

        const admissionData = { ...req.body, episode_id: episodeId };
        const created = await Admission.create(admissionData);

        res.status(201).json({ success: true, data: created });
    } catch (error) {
        console.error('Create admission error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/:id', authController.verifyToken, async (req, res) => {
    try {
        const updated = await Admission.update(req.params.id, req.body);
        if (!updated) return res.status(404).json({ success: false, message: 'Admission not found' });

        // Sync Asset if MAC provided
        if (req.body.mac_rtls) {
            const fullName = `${req.body.nom} ${req.body.prenom}`.trim();
            await Asset.upsertFromMac(req.body.mac_rtls, fullName, req.body.etage || 1);
        }

        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Update admission error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/:id', authController.verifyToken, async (req, res) => {
    try {
        const success = await Admission.delete(req.params.id);
        if (!success) return res.status(404).json({ success: false, message: 'Admission not found' });
        res.json({ success: true, message: 'Admission deleted' });
    } catch (error) {
        console.error('Delete admission error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
