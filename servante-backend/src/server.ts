import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import rfidRoutes from './routes/rfid.js';
import { rfidService } from './services/rfidService.js';
import { motorService } from './services/motorService.js';

// Charger les variables d'environnement
dotenv.config();

// Importer les routes
import authRoutes from './routes/authRoutes';
import toolsRoutes from './routes/toolsRoutes';
import borrowsRoutes from './routes/borrowsRoutes';
import usersRoutes from './routes/usersRoutes';
import uploadRoutes from './routes/uploadRoutes';
import hardwareRoutes from './routes/hardwareRoutes';
import categoriesRoutes from './routes/categoriesRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import chatbotRoutes from './routes/chatbotRoutes';

// Importer le service ChromaDB
import { chromaService } from './services/chatbot/chromaService';

// Importer les middlewares
import { errorHandler, notFound } from './middleware/errorHandler';

// Initialiser Prisma
const prisma = new PrismaClient();

// Initialiser Express
const app: Application = express();

// ============================================
// MIDDLEWARE
// ============================================

// CORS - Autoriser les requêtes du frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Parser le body JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger les requêtes (en développement)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// ROUTES
// ============================================

// Route de santé (health check)
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Serveur opérationnel',
    timestamp: new Date().toISOString()
  });
});

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/borrows', borrowsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/hardware', hardwareRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/api/chatbot', chatbotRoutes);

// ============================================
// GESTION DES ERREURS
// ============================================

// Route non trouvée
app.use(notFound);

// Gestionnaire d'erreurs global
app.use(errorHandler);

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================

const PORT = process.env.PORT || 5000;

// Fonction pour démarrer le serveur
async function startServer() {
  try {
    // Tester la connexion à la base de données
    await prisma.$connect();
    console.log('✅ Connexion à PostgreSQL réussie');

    // Initialiser le service moteur (qui contient aussi le RFID maintenant)
    try {
      await motorService.initialize();
      const motorStatus = motorService.getStatus();
      if (motorStatus.connected) {
        console.log(`✅ Arduino complet connecté sur ${motorStatus.port} (RFID + Moteurs)`);

        // Initialiser le service RFID sur le même port
        try {
          const connected = await rfidService.initialize();
          if (connected) {
            console.log(`✅ Lecteur RFID initialisé sur le même port`);
          }
        } catch (error) {
          console.log('⚠️ Erreur initialisation RFID:', error);
        }
      } else {
        console.log('⚠️ Arduino non trouvé. Le serveur démarre sans matériel.');
      }
    } catch (error) {
      console.log('⚠️ Impossible d\'initialiser l\'Arduino:', error);
      console.log('   Le serveur démarre sans matériel. Branchez l\'Arduino et redémarrez.');
    }

    // Initialiser ChromaDB
    try {
      await chromaService.initialize();
      console.log('✅ ChromaDB initialisé avec succès');
    } catch (chromaError) {
      console.error('⚠️  Avertissement: ChromaDB n a pas pu être initialisé:', chromaError);
      console.log('⚠️  Le serveur continuera sans le chatbot');
      console.log('💡 Assurez-vous que ChromaDB est démarré: docker start chromadb');
    }

    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
      console.log(`📍 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🤖 Chatbot API: http://localhost:${PORT}/api/chatbot/health`);
    });
  } catch (error) {
    console.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

// Gestion de l'arrêt gracieux
const gracefulShutdown = async () => {
  console.log('\n⏳ Arrêt du serveur en cours...');

  try {
    // Fermer le service RFID
    await rfidService.close();
    console.log('✅ Service RFID fermé');

    // Fermer le service moteur
    await motorService.close();
    console.log('✅ Service moteur fermé');

    // Déconnecter la base de données
    await prisma.$disconnect();
    console.log('✅ Déconnexion de la base de données réussie');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la déconnexion:', error);
    process.exit(1);
  }
};

// Écouter les signaux d'arrêt
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Démarrer le serveur
startServer();

export default app;