import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const HARDWARE_API = process.env.HARDWARE_API || 'http://localhost:3000/api/hardware';

// Helper: Calculer la date limite (7 jours par défaut)
const calculateDueDate = (borrowDate: Date, daysToAdd: number = 7): Date => {
  const dueDate = new Date(borrowDate);
  dueDate.setDate(dueDate.getDate() + daysToAdd);
  return dueDate;
};

// Helper: Calculer le statut de retard
const calculateLateStatus = (dueDate: Date, returnDate?: Date) => {
  const now = new Date();
  const due = new Date(dueDate);
  
  if (returnDate) {
    const returned = new Date(returnDate);
    const wasLate = returned > due;
    const daysLate = wasLate 
      ? Math.ceil((returned.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    return { isLate: wasLate, daysLate, status: wasLate ? 'OVERDUE' : 'RETURNED' };
  }
  
  const isOverdue = now > due;
  const daysLate = isOverdue 
    ? Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  return { isLate: isOverdue, daysLate, status: isOverdue ? 'OVERDUE' : 'ACTIVE' };
};

// @desc    Créer un nouvel emprunt
// @route   POST /api/borrows
// @access  Public
export const createBorrow = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, toolId, daysToReturn = 7 } = req.body;

    if (!userId || !toolId) {
      res.status(400).json({
        success: false,
        message: 'userId et toolId requis'
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
      return;
    }

    const tool = await prisma.tool.findUnique({
      where: { id: toolId }
    });

    if (!tool) {
      res.status(404).json({
        success: false,
        message: 'Outil non trouvé'
      });
      return;
    }

    if (tool.availableQuantity <= 0) {
      res.status(400).json({
        success: false,
        message: 'Outil non disponible'
      });
      return;
    }

    const borrowDate = new Date();
    const dueDate = calculateDueDate(borrowDate, daysToReturn);

    const borrow = await prisma.borrow.create({
      data: {
        userId,
        toolId,
        borrowDate,
        dueDate,
        status: 'ACTIVE'
      },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            badgeId: true
          }
        },
        tool: true
      }
    });

    await prisma.tool.update({
      where: { id: toolId },
      data: {
        availableQuantity: { decrement: 1 },
        borrowedQuantity: { increment: 1 }
      }
    });

    // 🔧 DÉCLENCHER LE MOTEUR SI LE TIROIR EST DÉFINI
    if (tool.drawer) {
      try {
        console.log(`🤖 Ouverture du tiroir ${tool.drawer} pour l'outil: ${tool.name}`);
        await axios.post(`${HARDWARE_API}/commands`, {
          type: 'OPEN',
          drawer: tool.drawer.toLowerCase()
        });
      } catch (motorError) {
        console.error(`⚠️ Erreur lors de l'ouverture du tiroir: ${tool.drawer}`, motorError);
        // Ne pas échouer l'emprunt si le moteur échoue
      }
    }

    res.status(201).json({
      success: true,
      message: 'Emprunt créé avec succès',
      data: borrow
    });
  } catch (error) {
    console.error('Erreur createBorrow:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Retourner un outil
// @route   PUT /api/borrows/:id/return
// @access  Public
export const returnBorrow = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const borrow = await prisma.borrow.findUnique({
      where: { id },
      include: { tool: true, user: true }
    });

    if (!borrow) {
      res.status(404).json({
        success: false,
        message: 'Emprunt non trouvé'
      });
      return;
    }

    if (borrow.status === 'RETURNED') {
      res.status(400).json({
        success: false,
        message: 'Outil déjà retourné'
      });
      return;
    }

    const returnDate = new Date();
    const lateStatus = calculateLateStatus(borrow.dueDate, returnDate);

    const updatedBorrow = await prisma.borrow.update({
      where: { id },
      data: {
        returnDate,
        status: lateStatus.status as any
      },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            badgeId: true
          }
        },
        tool: true
      }
    });

    await prisma.tool.update({
      where: { id: borrow.toolId },
      data: {
        availableQuantity: { increment: 1 },
        borrowedQuantity: { decrement: 1 }
      }
    });

    res.status(200).json({
      success: true,
      message: lateStatus.isLate 
        ? `Outil retourné avec ${lateStatus.daysLate} jour(s) de retard`
        : 'Outil retourné à temps',
      data: updatedBorrow
    });
  } catch (error) {
    console.error('Erreur returnBorrow:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Obtenir tous les emprunts (avec filtres)
// @route   GET /api/borrows
// @access  Private (Admin)
export const getAllBorrows = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, userId, toolId, startDate, endDate } = req.query;

    const where: any = {};

    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (toolId) where.toolId = toolId;
    
    if (startDate || endDate) {
      where.borrowDate = {};
      if (startDate) where.borrowDate.gte = new Date(startDate as string);
      if (endDate) where.borrowDate.lte = new Date(endDate as string);
    }

    const borrows = await prisma.borrow.findMany({
      where,
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            badgeId: true,
            role: true
          }
        },
        tool: {
          select: {
            name: true,
            category: true,
            drawer: true
          }
        }
      },
      orderBy: { borrowDate: 'desc' }
    });

    const formattedBorrows = borrows.map(borrow => ({
      id: borrow.id,
      toolId: borrow.toolId,
      toolName: borrow.tool.name,
      borrowDate: borrow.borrowDate,
      returnDate: borrow.returnDate,
      dueDate: borrow.dueDate,
      status: borrow.status.toLowerCase(),
      userName: borrow.user.fullName,
      userEmail: borrow.user.email,
      drawer: borrow.tool.drawer
    }));

    res.status(200).json({
      success: true,
      count: formattedBorrows.length,
      data: formattedBorrows
    });
  } catch (error) {
    console.error('Erreur getAllBorrows:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Obtenir un emprunt par ID
// @route   GET /api/borrows/:id
// @access  Public
export const getBorrowById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const borrow = await prisma.borrow.findUnique({
      where: { id },
      include: {
        user: true,
        tool: true
      }
    });

    if (!borrow) {
      res.status(404).json({
        success: false,
        message: 'Emprunt non trouvé'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: borrow
    });
  } catch (error) {
    console.error('Erreur getBorrowById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Obtenir les emprunts d'un utilisateur
// @route   GET /api/borrows/user/:userId
// @access  Public
export const getBorrowsByUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const borrows = await prisma.borrow.findMany({
      where: { userId },
      include: {
        tool: {
          select: {
            name: true,
            category: true,
            drawer: true,
            imageUrl: true
          }
        }
      },
      orderBy: { borrowDate: 'desc' }
    });

    res.status(200).json({
      success: true,
      count: borrows.length,
      data: borrows
    });
  } catch (error) {
    console.error('Erreur getBorrowsByUser:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Mettre à jour les statuts des emprunts (cron job)
// @route   PUT /api/borrows/update-statuses
// @access  Private (Admin)
export const updateBorrowStatuses = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();

    const activeBorrows = await prisma.borrow.findMany({
      where: { status: 'ACTIVE' }
    });

    let updatedCount = 0;

    for (const borrow of activeBorrows) {
      const lateStatus = calculateLateStatus(borrow.dueDate);
      
      if (lateStatus.status === 'OVERDUE' && borrow.status !== 'OVERDUE') {
        await prisma.borrow.update({
          where: { id: borrow.id },
          data: {
            status: 'OVERDUE'
          }
        });
        updatedCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `${updatedCount} emprunt(s) mis à jour`,
      data: { updatedCount }
    });
  } catch (error) {
    console.error('Erreur updateBorrowStatuses:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Obtenir les statistiques des emprunts
// @route   GET /api/borrows/stats
// @access  Private (Admin)
export const getBorrowsStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalBorrows = await prisma.borrow.count();
    const activeBorrows = await prisma.borrow.count({ where: { status: 'ACTIVE' } });
    const overdueBorrows = await prisma.borrow.count({ where: { status: 'OVERDUE' } });
    const returnedBorrows = await prisma.borrow.count({ where: { status: 'RETURNED' } });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyBorrows = await prisma.borrow.groupBy({
      by: ['borrowDate'],
      where: {
        borrowDate: { gte: sixMonthsAgo }
      },
      _count: { id: true }
    });

    const completedBorrows = await prisma.borrow.findMany({
      where: { 
        status: { in: ['RETURNED', 'OVERDUE'] }, 
        returnDate: { not: null } 
      }
    });

    const onTimeReturns = completedBorrows.filter(b => {
      if (!b.returnDate) return false;
      return new Date(b.returnDate) <= new Date(b.dueDate);
    }).length;
    
    const onTimeRate = completedBorrows.length > 0 
      ? ((onTimeReturns / completedBorrows.length) * 100).toFixed(1)
      : 100;

    res.status(200).json({
      success: true,
      data: {
        totalBorrows,
        activeBorrows,
        overdueBorrows,
        returnedBorrows,
        onTimeRate,
        monthlyBorrows
      }
    });
  } catch (error) {
    console.error('Erreur getBorrowsStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Marquer un emprunt comme retourné (ADMIN)
// @route   POST /api/borrows/:id/mark-returned
// @access  Private (Admin)
export const markAsReturned = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const borrow = await prisma.borrow.findUnique({
      where: { id },
      include: { 
        tool: true,
        user: {
          select: {
            fullName: true,
            email: true
          }
        }
      }
    });

    if (!borrow) {
      res.status(404).json({
        success: false,
        message: 'Emprunt non trouvé'
      });
      return;
    }

    if (borrow.status === 'RETURNED') {
      res.status(400).json({
        success: false,
        message: 'Cet emprunt est déjà retourné'
      });
      return;
    }

    const updatedBorrow = await prisma.borrow.update({
      where: { id },
      data: {
        status: 'RETURNED',
        returnDate: new Date()
      },
      include: {
        tool: true,
        user: {
          select: {
            fullName: true,
            email: true
          }
        }
      }
    });

    await prisma.tool.update({
      where: { id: borrow.toolId },
      data: {
        availableQuantity: {
          increment: 1
        },
        borrowedQuantity: {
          decrement: 1
        }
      }
    });

    res.json({
      success: true,
      message: `${borrow.tool.name} marqué comme retourné`,
      data: updatedBorrow
    });
  } catch (error) {
    console.error('❌ Erreur markAsReturned:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};