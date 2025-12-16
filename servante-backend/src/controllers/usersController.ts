import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ✅ Récupérer tous les utilisateurs
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        badgeId: true,
        role: true,
        createdAt: true
      },
      orderBy: { fullName: 'asc' }
    });

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('❌ Erreur getAllUsers:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ✅ Créer un utilisateur
export const createUser = async (req: Request, res: Response) => {
  try {
    const { fullName, email, badgeId, role, password } = req.body;

    // Vérifier si l'email existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    // Vérifier si le badge existe déjà
    const existingBadge = await prisma.user.findUnique({
      where: { badgeId }
    });

    if (existingBadge) {
      return res.status(400).json({
        success: false,
        message: 'Ce badge est déjà utilisé'
      });
    }

    // Hasher le mot de passe si fourni
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        badgeId,
        role: role || 'student',
        password: hashedPassword
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        badgeId: true,
        role: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: user
    });
  } catch (error) {
    console.error('❌ Erreur createUser:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création'
    });
  }
};

// ✅ Modifier un utilisateur
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, email, badgeId, role } = req.body;

    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Mettre à jour
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        fullName,
        email,
        badgeId,
        role
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        badgeId: true,
        role: true
      }
    });

    res.json({
      success: true,
      message: 'Utilisateur modifié avec succès',
      data: updatedUser
    });
  } catch (error) {
    console.error('❌ Erreur updateUser:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification'
    });
  }
};

// ✅ Supprimer un utilisateur
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Vérifier s'il a des emprunts actifs
    const activeBorrows = await prisma.borrow.findMany({
      where: {
        userId: id,
        status: 'ACTIVE'
      }
    });

    if (activeBorrows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer: ${activeBorrows.length} emprunt(s) actif(s)`
      });
    }

    // Supprimer l'utilisateur
    await prisma.user.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Utilisateur supprimé avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur deleteUser:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression'
    });
  }
};