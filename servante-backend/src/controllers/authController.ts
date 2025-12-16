import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Générer un JWT
const generateToken = (id: string): string => {
  return jwt.sign(
    { id }, 
    String(process.env.JWT_SECRET || 'default_secret'),
    { expiresIn: String(process.env.JWT_EXPIRES_IN || '7d') }
  );
};

// @desc    Connexion avec badge RFID
// @route   POST /api/auth/badge-scan
// @access  Public
export const badgeScan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { badgeId } = req.body;

    if (!badgeId) {
      res.status(400).json({
        success: false,
        message: 'Badge ID requis'
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { badgeId }
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Badge invalide'
      });
      return;
    }

    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: {
          id: user.id,
          badgeId: user.badgeId,
          fullName: user.fullName,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Erreur badge scan:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Connexion admin avec mot de passe
// @route   POST /api/auth/admin-login
// @access  Public
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body;

    if (!password) {
      res.status(400).json({
        success: false,
        message: 'Mot de passe requis'
      });
      return;
    }

    if (password !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({
        success: false,
        message: 'Mot de passe incorrect'
      });
      return;
    }

    let admin = await prisma.user.findUnique({
      where: { email: 'admin@emines.um6p.ma' }
    });

    if (!admin) {
      admin = await prisma.user.create({
        data: {
          badgeId: 'ADMIN_001',
          fullName: 'Administrateur',
          email: 'admin@emines.um6p.ma',
          role: 'ADMIN'
        }
      });
    }

    const token = generateToken(admin.id);

    res.json({
      success: true,
      message: 'Connexion admin réussie',
      data: {
        user: admin,
        token
      }
    });
  } catch (error) {
    console.error('Erreur admin login:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Obtenir l'utilisateur connecté
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: (req as any).user.id },
      select: {
        id: true,
        badgeId: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Erreur getMe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};
