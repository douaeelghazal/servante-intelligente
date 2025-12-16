import express from 'express';
import { badgeScan, adminLogin, getMe } from '../controllers/authController';

const router = express.Router();

// Connexion avec badge RFID
router.post('/badge-scan', badgeScan);

// Connexion admin
router.post('/admin-login', adminLogin);

// Obtenir l'utilisateur connecté
router.get('/me', getMe);

export default router;