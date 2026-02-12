import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

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
        password: true,
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

    // Convertir le role en majuscules (student -> STUDENT, professor -> PROFESSOR, etc.)
    const roleMap: { [key: string]: string } = {
      'student': 'STUDENT',
      'professor': 'PROFESSOR',
      'technician': 'TECHNICIAN',
      'admin': 'ADMIN'
    };
    const normalizedRole = roleMap[(role || 'student').toLowerCase()] || 'STUDENT';

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        badgeId,
        role: normalizedRole,
        password: password || null
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        badgeId: true,
        role: true,
        password: true
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
    let { fullName, email, badgeId, role, password } = req.body;

    console.log('🔧 UPDATE USER REQUEST:');
    console.log('  ID:', id);
    console.log('  Body:', { fullName, email, badgeId, role, password: password ? '***' : undefined });

    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      console.log('❌ Utilisateur non trouvé:', id);
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    console.log('✅ Utilisateur trouvé:', user.fullName);

    // Vérifier si l'email existe déjà (si on change l'email)
    if (email !== undefined && email !== user.email) {
      console.log('🔍 Vérification email:', email);
      const existingEmail = await prisma.user.findUnique({
        where: { email }
      });
      if (existingEmail) {
        console.log('❌ Email déjà utilisé:', email);
        return res.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé'
        });
      }
    }

    // Vérifier si le badge existe déjà (si on change le badge)
    if (badgeId !== undefined && badgeId !== user.badgeId) {
      console.log('🔍 Vérification badge:', badgeId);
      const existingBadge = await prisma.user.findUnique({
        where: { badgeId }
      });
      if (existingBadge) {
        console.log('❌ Badge déjà utilisé:', badgeId);
        return res.status(400).json({
          success: false,
          message: 'Ce badge est déjà utilisé'
        });
      }
    }

    // Construire l'objet data avec uniquement les champs fournis
    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (badgeId !== undefined) updateData.badgeId = badgeId;
    if (password !== undefined) updateData.password = password || null;
    if (role !== undefined) {
      // Convertir le role en majuscules (student -> STUDENT, professor -> PROFESSOR, etc.)
      const roleMap: { [key: string]: string } = {
        'student': 'STUDENT',
        'professor': 'PROFESSOR',
        'technician': 'TECHNICIAN',
        'admin': 'ADMIN'
      };
      updateData.role = roleMap[role.toLowerCase()] || role;
      console.log('🔄 Role converti:', role, '->', updateData.role);
    }

    console.log('📤 Données à mettre à jour:', updateData);

    // Mettre à jour
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        badgeId: true,
        role: true,
        password: true
      }
    });

    console.log('✅ Utilisateur mis à jour:', updatedUser);

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

    // ✅ VALIDATION STRICTE
    if (!id || id.trim() === '') {
      console.error('❌ ID utilisateur invalide:', id);
      return res.status(400).json({
        success: false,
        message: 'ID utilisateur invalide'
      });
    }

    console.log('🗑️ Suppression de l\'utilisateur:', id);

    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      console.log('❌ Utilisateur non trouvé:', id);
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    console.log('✅ Utilisateur trouvé:', user.fullName);

    // Vérifier s'il a des emprunts actifs
    const activeBorrows = await prisma.borrow.findMany({
      where: {
        userId: id,
        status: 'ACTIVE'
      }
    });

    console.log('📊 Emprunts actifs:', activeBorrows.length);

    // ⚠️ NE PAS REJETER LA SUPPRESSION - Supprimer les emprunts aussi
    // Supprimer TOUS les emprunts associés à cet utilisateur
    console.log('🧹 Suppression des emprunts liés...');
    const deletedBorrows = await prisma.borrow.deleteMany({
      where: { userId: id }
    });
    console.log('✅ Emprunts supprimés:', deletedBorrows.count);

    // Supprimer l'utilisateur
    console.log('🗑️ Suppression de l\'utilisateur...');
    await prisma.user.delete({
      where: { id }
    });

    console.log('✅ Utilisateur supprimé avec succès:', id);

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