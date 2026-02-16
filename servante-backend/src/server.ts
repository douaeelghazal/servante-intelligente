import express, { Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

// Importer les routes existantes
import authRoutes from "./routes/authRoutes";
import toolsRoutes from "./routes/toolsRoutes";
import borrowsRoutes from "./routes/borrowsRoutes";
import usersRoutes from "./routes/usersRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import hardwareRoutes from "./routes/hardwareRoutes";
import categoriesRoutes from "./routes/categoriesRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";

// ✨ NOUVEAU: Importer les routes chatbot
import chatbotRoutes from "./routes/chatbotRoutes";

// Importer les middlewares
import { errorHandler, notFound } from "./middleware/errorHandler";

// ✨ NOUVEAU: Importer le service ChromaDB
import { chromaService } from "./services/chatbot/chromaService";

const prisma = new PrismaClient();
const app: Application = express();

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// ROUTES
// ============================================

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Serveur opérationnel",
    timestamp: new Date().toISOString()
  });
});

// Routes API existantes
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/borrows", borrowsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/hardware", hardwareRoutes);
app.use("/api/analytics", analyticsRoutes);

// ✨ NOUVEAU: Routes chatbot
app.use("/api/chatbot", chatbotRoutes);

// ============================================
// GESTION DES ERREURS
// ============================================

app.use(notFound);
app.use(errorHandler);

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Tester la connexion à PostgreSQL
    await prisma.$connect();
    console.log("✅ Connexion à PostgreSQL réussie");

    // ✨ NOUVEAU: Initialiser ChromaDB
    try {
      await chromaService.initialize();
      console.log("✅ ChromaDB initialisé avec succès");
    } catch (chromaError) {
      console.error("⚠️  Avertissement: ChromaDB n a pas pu être initialisé:", chromaError);
      console.log("⚠️  Le serveur continuera sans le chatbot");
      console.log("💡 Assurez-vous que ChromaDB est démarré: docker start chromadb");
    }

    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
      console.log(`📍 Environnement: ${process.env.NODE_ENV || "development"}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🤖 Chatbot API: http://localhost:${PORT}/api/chatbot/health`);
    });
  } catch (error) {
    console.error("❌ Erreur lors du démarrage du serveur:", error);
    process.exit(1);
  }
};

const gracefulShutdown = async () => {
  console.log("\n⏳ Arrêt du serveur en cours...");
  
  try {
    await prisma.$disconnect();
    console.log("✅ Déconnexion de la base de données réussie");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erreur lors de la déconnexion:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

startServer();

export default app;
