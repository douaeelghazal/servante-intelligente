import express from 'express';
import {
  getAllTools,
  getAvailableTools,
  getToolById,
  createTool,
  updateTool,
  deleteTool,
  getToolsStats
} from '../controllers/toolsController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// ============================================
// ROUTES PUBLIQUES (pas de protection)
// ============================================
router.get('/', getAllTools);
router.get('/available', getAvailableTools);
router.get('/:id', getToolById);

// ============================================
// ROUTES ADMIN (protégées)
// ============================================
router.post('/', protect, createTool);
router.put('/:id', protect, updateTool);
router.delete('/:id', protect, deleteTool);
router.get('/stats/overview', protect, getToolsStats);

export default router;