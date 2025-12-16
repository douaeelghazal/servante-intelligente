import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ✅ Tableau de bord général - Vue d'ensemble
export const getDashboardOverview = async (req: Request, res: Response) => {
  try {
    // Total des outils
    const totalTools = await prisma.tool.findMany();
    const totalCount = totalTools.length;
    const totalQuantity = totalTools.reduce((sum, tool) => sum + tool.totalQuantity, 0);

    // Outils disponibles
    const availableQuantity = totalTools.reduce((sum, tool) => sum + tool.availableQuantity, 0);

    // Outils empruntés
    const borrowedQuantity = totalTools.reduce((sum, tool) => sum + tool.borrowedQuantity, 0);

    // Utilisateurs actifs ce mois
    const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
    const activeUsers = await prisma.user.findMany({
      where: {
        borrows: {
          some: {
            borrowDate: {
              gte: thirtyDaysAgo
            }
          }
        }
      }
    });

    // Taux de disponibilité
    const availabilityRate = totalQuantity > 0 ? Math.round((availableQuantity / totalQuantity) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalTools: totalCount,
        totalQuantity,
        availableQuantity,
        borrowedQuantity,
        activeUsers: activeUsers.length,
        availabilityRate
      }
    });
  } catch (error) {
    console.error('❌ Erreur getDashboardOverview:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ✅ Analyses outils - Détails d'utilisation
export const getToolsAnalytics = async (req: Request, res: Response) => {
  try {
    // Tous les outils
    const tools = await prisma.tool.findMany();
    const totalQuantity = tools.reduce((sum, tool) => sum + tool.totalQuantity, 0);
    const borrowedQuantity = tools.reduce((sum, tool) => sum + tool.borrowedQuantity, 0);

    // Taux d'utilisation global
    const utilizationRate = totalQuantity > 0 ? Math.round((borrowedQuantity / totalQuantity) * 100) : 0;

    // Durée moyenne d'emprunt
    const completedBorrows = await prisma.borrow.findMany({
      where: {
        status: 'RETURNED',
        returnDate: { not: null }
      }
    });

    let averageBorrowDays = 0;
    if (completedBorrows.length > 0) {
      const totalDays = completedBorrows.reduce((sum, borrow) => {
        if (borrow.returnDate) {
          const days = Math.ceil(
            (borrow.returnDate.getTime() - borrow.borrowDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + days;
        }
        return sum;
      }, 0);
      averageBorrowDays = totalDays / completedBorrows.length;
    }

    // Outils nécessitant maintenance (empruntés depuis longtemps)
    const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
    const toolsNeedingMaintenance = await prisma.borrow.findMany({
      where: {
        status: 'ACTIVE',
        borrowDate: {
          lt: thirtyDaysAgo
        }
      },
      include: {
        tool: true
      }
    });

    // Distribution par catégorie
    const byCategory = await prisma.tool.groupBy({
      by: ['category'],
      _sum: {
        borrowedQuantity: true,
        totalQuantity: true,
        availableQuantity: true
      }
    });

    res.json({
      success: true,
      data: {
        utilizationRate,
        averageBorrowDays: averageBorrowDays.toFixed(1),
        toolsNeedingMaintenance: toolsNeedingMaintenance.length,
        byCategory: byCategory.map(cat => ({
          name: cat.category,
          total: cat._sum.totalQuantity || 0,
          borrowed: cat._sum.borrowedQuantity || 0,
          available: cat._sum.availableQuantity || 0
        }))
      }
    });
  } catch (error) {
    console.error('❌ Erreur getToolsAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ✅ Analyses utilisateurs
export const getUsersAnalytics = async (req: Request, res: Response) => {
  try {
    // Total utilisateurs
    const totalUsers = await prisma.user.count();

    // Utilisateurs actifs (derniers 30 jours)
    const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
    const activeUsers = await prisma.user.findMany({
      where: {
        borrows: {
          some: {
            borrowDate: {
              gte: thirtyDaysAgo
            }
          }
        }
      }
    });

    // Taux de retour à temps
    const completedBorrows = await prisma.borrow.findMany({
      where: {
        status: 'RETURNED',
        returnDate: { not: null }
      }
    });

    let onTimeReturnRate = 0;
    if (completedBorrows.length > 0) {
      const onTimeReturns = completedBorrows.filter(borrow => {
        if (borrow.returnDate && borrow.dueDate) {
          return borrow.returnDate <= borrow.dueDate;
        }
        return false;
      });
      onTimeReturnRate = Math.round((onTimeReturns.length / completedBorrows.length) * 100);
    }

    // Segmentation par rôle
    const byRole = await prisma.user.groupBy({
      by: ['role'],
      _count: true
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers: activeUsers.length,
        onTimeReturnRate,
        byRole: byRole.map(role => ({
          name: role.role,
          count: role._count
        }))
      }
    });
  } catch (error) {
    console.error('❌ Erreur getUsersAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ✅ Tendance des emprunts (6 derniers mois)
export const getBorrowsTrend = async (req: Request, res: Response) => {
  try {
    const months = [];
    const today = new Date();

    // Récupérer les 6 derniers mois
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date);
      const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const borrows = await prisma.borrow.count({
        where: {
          borrowDate: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const returns = await prisma.borrow.count({
        where: {
          returnDate: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      months.push({
        month: monthLabel,
        borrows,
        returns
      });
    }

    res.json({
      success: true,
      data: months
    });
  } catch (error) {
    console.error('❌ Erreur getBorrowsTrend:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ✅ Alertes de stock
export const getStockAlerts = async (req: Request, res: Response) => {
  try {
    const tools = await prisma.tool.findMany({
      where: {
        availableQuantity: {
          lte: 2 // Alerte si 2 ou moins disponibles
        }
      },
      select: {
        id: true,
        name: true,
        category: true,
        availableQuantity: true,
        totalQuantity: true
      }
    });

    res.json({
      success: true,
      alerts: tools.length,
      data: tools
    });
  } catch (error) {
    console.error('❌ Erreur getStockAlerts:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ✅ Vue d'ensemble inventaire
export const getInventoryOverview = async (req: Request, res: Response) => {
  try {
    const tools = await prisma.tool.findMany();

    const totalStock = tools.reduce((sum, tool) => sum + tool.totalQuantity, 0);
    const availableStock = tools.reduce((sum, tool) => sum + tool.availableQuantity, 0);
    const borrowedStock = tools.reduce((sum, tool) => sum + tool.borrowedQuantity, 0);

    const availabilityRate = totalStock > 0 ? Math.round((availableStock / totalStock) * 100) : 0;

    // Stock par catégorie
    const byCategory = await prisma.tool.groupBy({
      by: ['category'],
      _sum: {
        totalQuantity: true,
        borrowedQuantity: true,
        availableQuantity: true
      }
    });

    res.json({
      success: true,
      data: {
        totalStock,
        availableStock,
        borrowedStock,
        availabilityRate,
        byCategory: byCategory.map(cat => ({
          name: cat.category,
          total: cat._sum.totalQuantity || 0,
          borrowed: cat._sum.borrowedQuantity || 0,
          available: cat._sum.availableQuantity || 0
        }))
      }
    });
  } catch (error) {
    console.error('❌ Erreur getInventoryOverview:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};
