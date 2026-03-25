import express from 'express';
import authController from './auth.controller.js';

const router = express.Router();

router.post('/login', authController.login);
router.get('/profile', authController.verifyToken, authController.getProfile);

export default router;