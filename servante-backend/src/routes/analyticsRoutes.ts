import { Router } from 'express';
import {
  getDashboardOverview,
  getToolsAnalytics,
  getUsersAnalytics,
  getBorrowsTrend,
  getStockAlerts,
  getInventoryOverview
} from '../controllers/analyticsController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Routes protégées par authentification
router.get('/dashboard/overview', authMiddleware, getDashboardOverview);
router.get('/tools', authMiddleware, getToolsAnalytics);
router.get('/users', authMiddleware, getUsersAnalytics);
router.get('/borrows/trend', authMiddleware, getBorrowsTrend);
router.get('/stock/alerts', authMiddleware, getStockAlerts);
router.get('/inventory/overview', authMiddleware, getInventoryOverview);

export default router;
