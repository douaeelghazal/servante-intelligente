import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// IN-MEMORY QUEUE (temporaire, pour tests)
// En production: utiliser une table Prisma
// ============================================

interface HardwareCommand {
  id: string;
  type: 'OPEN' | 'CLOSE';
  drawer: 'x' | 'y' | 'z' | 'a';
  status: 'PENDING' | 'SENT' | 'DONE' | 'FAILED';
  createdAt: Date;
  ack?: {
    result: string;
    message: string;
    at: Date;
  };
}

const commands: HardwareCommand[] = [];

// ============================================
// ENDPOINT 1: Créer une nouvelle commande
// POST /api/hardware/commands
// Body: { type: "OPEN"|"CLOSE", drawer: "x"|"y"|"z"|"a" }
// ============================================
export const createCommand = (req: Request, res: Response): void => {
  try {
    const { type, drawer } = req.body;

    if (!type || !drawer) {
      res.status(400).json({
        success: false,
        message: 'type et drawer requis'
      });
      return;
    }

    if (!['OPEN', 'CLOSE'].includes(type)) {
      res.status(400).json({
        success: false,
        message: 'type doit être OPEN ou CLOSE'
      });
      return;
    }

    if (!['x', 'y', 'z', 'a'].includes(drawer)) {
      res.status(400).json({
        success: false,
        message: 'drawer doit être x, y, z ou a'
      });
      return;
    }

    const id = `cmd-${Date.now()}`;
    const command: HardwareCommand = {
      id,
      type,
      drawer,
      status: 'PENDING',
      createdAt: new Date()
    };

    commands.push(command);

    console.log(`✅ Commande créée: ${id} (${type} ${drawer})`);

    res.status(201).json({
      success: true,
      id,
      message: `Commande ${type} ${drawer} créée`
    });
  } catch (error) {
    console.error('Erreur createCommand:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ============================================
// ENDPOINT 2: Récupérer les commandes en attente
// GET /api/hardware/commands?pending=true
// Utilisé par le script pont série (Arduino polle cet endpoint)
// ============================================
export const getCommands = (req: Request, res: Response): void => {
  try {
    const pending = req.query.pending === 'true';

    let result = commands;
    if (pending) {
      result = commands.filter(c => c.status === 'PENDING');
    }

    console.log(`📋 Récupération commandes (pending=${pending}): ${result.length} trouvées`);

    res.json({
      success: true,
      count: result.length,
      commands: result
    });
  } catch (error) {
    console.error('Erreur getCommands:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ============================================
// ENDPOINT 3: Envoyer un ACK quand le tiroir est ouvert/fermé
// PUT /api/hardware/commands/:id/ack
// Body: { result: "OPENED"|"CLOSED"|"FAILED", message: "texte optionnel" }
// ============================================
export const sendAck = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { result, message = '' } = req.body;

    const cmd = commands.find(c => c.id === id);

    if (!cmd) {
      res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
      return;
    }

    // Mettre à jour la commande
    cmd.status = result === 'FAILED' ? 'FAILED' : 'DONE';
    cmd.ack = {
      result,
      message,
      at: new Date()
    };

    console.log(`✅ ACK reçu: ${id} → ${result}`);

    // TODO: Mettre à jour la DB Prisma (HardwareEvent, Borrow state)
    // TODO: Notifier le frontend via WebSocket

    res.json({
      success: true,
      command: cmd,
      message: `ACK enregistré: ${result}`
    });
  } catch (error) {
    console.error('Erreur sendAck:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ============================================
// ENDPOINT 4: Recevoir les lectures RFID depuis le pont série
// POST /api/hardware/rfid
// Body: { uid: "0A1B2C3D" }
// ============================================
export const receiveRFID = async (req: Request, res: Response): Promise<void> => {
  try {
    const { uid } = req.body;

    if (!uid) {
      res.status(400).json({
        success: false,
        message: 'uid requis'
      });
      return;
    }

    console.log(`🏷️  RFID reçu: ${uid}`);

    // Protection anti-bruteforce: vérifier les tentatives récentes
    const recentAttempts = await prisma.rFIDAttempt.count({
      where: {
        ipAddress: req.ip || 'unknown',
        timestamp: {
          gte: new Date(Date.now() - 60000) // Dernière minute
        }
      }
    });

    if (recentAttempts >= 10) {
      console.log(`⚠️  Trop de tentatives depuis ${req.ip}`);

      await prisma.rFIDAttempt.create({
        data: {
          uid: uid.toUpperCase(),
          ipAddress: req.ip || 'unknown',
          success: false,
          userId: null
        }
      });

      res.status(429).json({
        success: false,
        message: 'Trop de tentatives. Attendez 1 minute.'
      });
      return;
    }

    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { badgeId: uid.toUpperCase() }
    });

    // Logger la tentative dans la base de données
    await prisma.rFIDAttempt.create({
      data: {
        uid: uid.toUpperCase(),
        ipAddress: req.ip || 'unknown',
        success: !!user,
        userId: user?.id || null
      }
    });

    if (!user) {
      console.log(`❌ Badge inconnu: ${uid}`);

      res.status(401).json({
        success: false,
        uid,
        authorized: false,
        message: 'Badge non autorisé'
      });
      return;
    }

    // Générer un token JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: user.id },
      String(process.env.JWT_SECRET || 'default_secret'),
      { expiresIn: String(process.env.JWT_EXPIRES_IN || '7d') }
    );

    console.log(`✅ Badge autorisé: ${uid} → ${user.fullName}`);

    res.json({
      success: true,
      authorized: true,
      uid,
      message: 'Accès autorisé',
      user: {
        id: user.id,
        badgeId: user.badgeId,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Erreur receiveRFID:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ============================================
// ENDPOINTS BADGE SCAN (pour interface admin)
// ============================================

// Store pour les scans en attente
const pendingScans: Map<string, { uid: string; timestamp: Date }> = new Map();

/**
 * Initier un scan de badge depuis l'interface admin
 * POST /api/hardware/badge-scan/start
 */
export const startBadgeScan = (req: Request, res: Response): void => {
  try {
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    pendingScans.set(scanId, { uid: '', timestamp: new Date() });

    // Nettoyer les anciens scans (> 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    for (const [id, scan] of pendingScans.entries()) {
      if (scan.timestamp < fiveMinutesAgo) {
        pendingScans.delete(id);
      }
    }

    console.log(`📋 Nouveau scan admin initié: ${scanId}`);

    res.json({
      success: true,
      scanId,
      message: 'Scan en attente. Approchez le badge du lecteur RFID.'
    });
  } catch (error) {
    console.error('Erreur startBadgeScan:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/**
 * Vérifier le résultat d'un scan
 * GET /api/hardware/badge-scan/:scanId
 */
export const checkBadgeScan = (req: Request, res: Response): void => {
  try {
    const { scanId } = req.params;
    const scan = pendingScans.get(scanId);

    if (!scan) {
      res.status(404).json({ success: false, message: 'Scan non trouvé ou expiré' });
      return;
    }

    if (scan.uid) {
      console.log(`✅ UID capturé pour scan admin ${scanId}: ${scan.uid}`);
      pendingScans.delete(scanId);
      res.json({ success: true, uid: scan.uid, message: 'Badge détecté avec succès' });
    } else {
      res.json({ success: true, uid: null, message: 'En attente du badge...' });
    }
  } catch (error) {
    console.error('Erreur checkBadgeScan:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/**
 * Annuler un scan en cours
 * DELETE /api/hardware/badge-scan/:scanId
 */
export const cancelBadgeScan = (req: Request, res: Response): void => {
  try {
    const { scanId } = req.params;
    if (pendingScans.has(scanId)) {
      pendingScans.delete(scanId);
      console.log(`❌ Scan admin annulé: ${scanId}`);
    }
    res.json({ success: true, message: 'Scan annulé' });
  } catch (error) {
    console.error('Erreur cancelBadgeScan:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Modifier la fonction receiveRFID pour gérer aussi les scans admin
const originalReceiveRFID = receiveRFID;

// Fonction wrapper qui gère à la fois l'auth et les scans admin
export const receiveRFIDHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { uid } = req.body;

    if (!uid) {
      res.status(400).json({ success: false, message: 'uid requis' });
      return;
    }

    // Vérifier s'il y a un scan admin en attente
    const waitingScan = Array.from(pendingScans.entries()).find(
      ([_, scan]) => !scan.uid
    );

    if (waitingScan) {
      const [scanId, scan] = waitingScan;
      scan.uid = uid.toUpperCase();
      console.log(`📋 UID capturé pour scan admin: ${scanId} → ${uid.toUpperCase()}`);
    }

    // Continuer avec l'authentification normale
    await receiveRFID(req, res);

  } catch (error) {
    console.error('Erreur receiveRFIDHandler:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ============================================
// ROUTE SETUP
// ============================================
import express from 'express';
const router = express.Router();

router.post('/commands', createCommand);
router.get('/commands', getCommands);
router.put('/commands/:id/ack', sendAck);
router.post('/rfid', receiveRFIDHandler);

// Routes pour le scan de badge admin
router.post('/badge-scan/start', startBadgeScan);
router.get('/badge-scan/:scanId', checkBadgeScan);
router.delete('/badge-scan/:scanId', cancelBadgeScan);

export default router;

