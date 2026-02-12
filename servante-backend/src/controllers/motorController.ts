import { Request, Response } from 'express';
import { motorService } from '../services/motorService';

/**
 * Open a specific drawer
 * POST /api/hardware/drawer/open
 * Body: { drawerNumber: "1" | "2" | "3" | "4" }
 */
export const openDrawer = async (req: Request, res: Response): Promise<void> => {
    try {
        const { drawerNumber } = req.body;

        if (!drawerNumber || !['1', '2', '3', '4'].includes(drawerNumber)) {
            res.status(400).json({
                success: false,
                message: 'drawerNumber doit être 1, 2, 3 ou 4',
            });
            return;
        }

        const status = motorService.getStatus();
        if (!status.connected) {
            res.status(503).json({
                success: false,
                message: 'Moteurs non connectés',
            });
            return;
        }

        const success = await motorService.openDrawer(drawerNumber);

        if (success) {
            res.json({
                success: true,
                message: `Tiroir ${drawerNumber} en cours d'ouverture`,
                drawerNumber,
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'ouverture du tiroir',
            });
        }
    } catch (error) {
        console.error('Erreur openDrawer:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
        });
    }
};

/**
 * Close a specific drawer
 * POST /api/hardware/drawer/close
 * Body: { drawerNumber: "1" | "2" | "3" | "4" }
 */
export const closeDrawer = async (req: Request, res: Response): Promise<void> => {
    try {
        const { drawerNumber } = req.body;

        if (!drawerNumber || !['1', '2', '3', '4'].includes(drawerNumber)) {
            res.status(400).json({
                success: false,
                message: 'drawerNumber doit être 1, 2, 3 ou 4',
            });
            return;
        }

        const status = motorService.getStatus();
        if (!status.connected) {
            res.status(503).json({
                success: false,
                message: 'Moteurs non connectés',
            });
            return;
        }

        const success = await motorService.closeDrawer(drawerNumber);

        if (success) {
            res.json({
                success: true,
                message: `Tiroir ${drawerNumber} en cours de fermeture`,
                drawerNumber,
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la fermeture du tiroir',
            });
        }
    } catch (error) {
        console.error('Erreur closeDrawer:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
        });
    }
};

/**
 * Emergency stop all motors
 * POST /api/hardware/motor/stop
 */
export const stopMotors = async (req: Request, res: Response): Promise<void> => {
    try {
        const success = await motorService.stopAll();

        if (success) {
            res.json({
                success: true,
                message: 'Arrêt d\'urgence envoyé',
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'arrêt',
            });
        }
    } catch (error) {
        console.error('Erreur stopMotors:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
        });
    }
};

/**
 * Get motor system status
 * GET /api/hardware/motor/status
 */
export const getMotorStatus = (req: Request, res: Response): void => {
    try {
        const status = motorService.getStatus();
        res.json({
            success: true,
            data: status,
        });
    } catch (error) {
        console.error('Erreur getMotorStatus:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
        });
    }
};
