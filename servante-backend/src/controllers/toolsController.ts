import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// @desc    Obtenir tous les outils
// @route   GET /api/tools
// @access  Public
export const getAllTools = async (req: Request, res: Response): Promise<void> => {
  try {
    const tools = await prisma.tool.findMany({
      include: {
        category: true,
        borrows: {
          where: {
            status: {
              in: ['ACTIVE', 'OVERDUE']
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Calculate quantities dynamically from actual borrows
    const toolsWithCorrectQuantities = tools.map(tool => {
      const activeBorrows = tool.borrows.length;
      const availableQuantity = Math.max(0, tool.totalQuantity - activeBorrows);
      
      return {
        ...tool,
        availableQuantity,
        borrowedQuantity: activeBorrows,
        borrows: undefined
      };
    });

    res.status(200).json({
      success: true,
      count: toolsWithCorrectQuantities.length,
      data: toolsWithCorrectQuantities
    });
  } catch (error) {
    console.error('❌ Erreur getAllTools:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Obtenir les outils disponibles
// @route   GET /api/tools/available
// @access  Public
export const getAvailableTools = async (req: Request, res: Response): Promise<void> => {
  try {
    const tools = await prisma.tool.findMany({
      include: {
        category: true,
        borrows: {
          where: {
            status: {
              in: ['ACTIVE', 'OVERDUE']
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Calculate quantities dynamically from actual borrows
    const toolsWithCorrectQuantities = tools.map(tool => {
      const activeBorrows = tool.borrows.length;
      const availableQuantity = Math.max(0, tool.totalQuantity - activeBorrows);
      
      return {
        ...tool,
        availableQuantity,
        borrowedQuantity: activeBorrows,
        borrows: undefined
      };
    });

    // Filter only tools with available quantity
    const availableTools = toolsWithCorrectQuantities.filter(t => t.availableQuantity > 0);

    res.json({
      success: true,
      count: availableTools.length,
      data: availableTools
    });
  } catch (error) {
    console.error('❌ Erreur getAvailableTools:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Obtenir un outil par ID
// @route   GET /api/tools/:id
// @access  Public
export const getToolById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const tool = await prisma.tool.findUnique({
      where: { id },
      include: {
        category: true,
        borrows: {
          where: { status: 'ACTIVE' },
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
                badgeId: true
              }
            }
          }
        }
      }
    });

    if (!tool) {
      res.status(404).json({
        success: false,
        message: 'Outil non trouvé'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: tool
    });
  } catch (error) {
    console.error('❌ Erreur getToolById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Créer un nouvel outil
// @route   POST /api/tools
// @access  Private (Admin)
export const createTool = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      category,
      imageUrl,
      totalQuantity,
      size,
      drawer
    } = req.body;

    // Validation
    if (!name || !category || !totalQuantity) {
      res.status(400).json({
        success: false,
        message: 'Nom, catégorie et quantité requis'
      });
      return;
    }

    const tool = await prisma.tool.create({
      data: {
        name,
        category,
        imageUrl: imageUrl || '/images/default-tool.jpg',
        totalQuantity: parseInt(totalQuantity),
        availableQuantity: parseInt(totalQuantity),
        borrowedQuantity: 0,
        size,
        drawer
      }
    });

    res.status(201).json({
      success: true,
      message: 'Outil créé avec succès',
      data: tool
    });
  } catch (error) {
    console.error('❌ Erreur createTool:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Mettre à jour un outil
// @route   PUT /api/tools/:id
// @access  Private (Admin)
export const updateTool = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      imageUrl,
      totalQuantity,
      size,
      drawer
    } = req.body;

    // Vérifier si l'outil existe
    const existingTool = await prisma.tool.findUnique({
      where: { id }
    });

    if (!existingTool) {
      res.status(404).json({
        success: false,
        message: 'Outil non trouvé'
      });
      return;
    }

    // Construire l'objet data avec uniquement les champs fournis
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (size !== undefined) updateData.size = size;
    if (drawer !== undefined) updateData.drawer = drawer;

    // Calculer la nouvelle quantité disponible si totalQuantity change
    if (totalQuantity !== undefined) {
      const newTotalQuantity = parseInt(totalQuantity);
      const quantityDiff = newTotalQuantity - existingTool.totalQuantity;
      updateData.totalQuantity = newTotalQuantity;
      updateData.availableQuantity = Math.max(0, existingTool.availableQuantity + quantityDiff);
    }

    // Mettre à jour
    const tool = await prisma.tool.update({
      where: { id },
      data: updateData
    });

    res.status(200).json({
      success: true,
      message: 'Outil mis à jour avec succès',
      data: tool
    });
  } catch (error) {
    console.error('❌ Erreur updateTool:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Supprimer un outil
// @route   DELETE /api/tools/:id
// @access  Private (Admin)
export const deleteTool = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // ✅ VALIDATION STRICTE - Vérifier que l'ID n'est pas vide
    if (!id || id.trim() === '') {
      console.error('❌ ID invalide pour supprimer un outil:', id);
      res.status(400).json({
        success: false,
        message: 'ID d\'outil invalide'
      });
      return;
    }

    console.log('🗑️ Suppression de l\'outil:', id);

    // Vérifier si l'outil existe
    const tool = await prisma.tool.findUnique({
      where: { id }
    });

    if (!tool) {
      console.log('❌ Outil non trouvé:', id);
      res.status(404).json({
        success: false,
        message: 'Outil non trouvé'
      });
      return;
    }

    console.log('✅ Outil trouvé:', tool.name);

    // Vérifier s'il y a des emprunts actifs
    const activeBorrows = await prisma.borrow.findMany({
      where: {
        toolId: id,
        status: 'ACTIVE'
      }
    });

    console.log('📊 Emprunts actifs:', activeBorrows.length);

    if (activeBorrows.length > 0) {
      res.status(400).json({
        success: false,
        message: `Impossible de supprimer: ${activeBorrows.length} emprunt(s) actif(s)`
      });
      return;
    }

    // Supprimer tous les emprunts liés (RETURNED et OVERDUE)
    console.log('🧹 Suppression des emprunts liés...');
    const deletedBorrows = await prisma.borrow.deleteMany({
      where: { toolId: id }
    });
    console.log('✅ Emprunts supprimés:', deletedBorrows.count);

    // Ensuite supprimer l'outil
    console.log('🗑️ Suppression de l\'outil...');
    await prisma.tool.delete({
      where: { id }
    });

    console.log('✅ Outil supprimé avec succès:', id);

    res.status(200).json({
      success: true,
      message: 'Outil supprimé avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur deleteTool:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Obtenir les statistiques des outils
// @route   GET /api/tools/stats
// @access  Private (Admin)
export const getToolsStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalTools = await prisma.tool.count();
    const availableTools = await prisma.tool.count({
      where: { availableQuantity: { gt: 0 } }
    });
    
    const tools = await prisma.tool.findMany();
    const totalQuantity = tools.reduce((sum, tool) => sum + tool.totalQuantity, 0);
    const borrowedQuantity = tools.reduce((sum, tool) => sum + tool.borrowedQuantity, 0);
    
    // Stats par catégorie
    const categoryStats = await prisma.tool.groupBy({
      by: ['category'],
      _count: { id: true },
      _sum: { totalQuantity: true, borrowedQuantity: true }
    });

    res.status(200).json({
      success: true,
      data: {
        totalTools,
        availableTools,
        totalQuantity,
        borrowedQuantity,
        availabilityRate: totalQuantity > 0 ? ((totalQuantity - borrowedQuantity) / totalQuantity * 100).toFixed(1) : 0,
        categoryStats
      }
    });
  } catch (error) {
    console.error('❌ Erreur getToolsStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};