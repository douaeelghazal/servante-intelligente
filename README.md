# Servante Intelligente - Smart Toolbox Management System

Un système de gestion intelligente d'outils pour les écoles et institutions, permettant le suivi en temps réel des emprunts d'outils avec badge RFID.

## 🎯 Fonctionnalités

- ✅ Gestion des emprunts d'outils par badge RFID
- ✅ Tableau de bord administrateur avec statistiques dynamiques
- ✅ Gestion des utilisateurs (étudiants, professeurs, techniciens)
- ✅ Suivi des retards et alertes
- ✅ Historique complet des emprunts
- ✅ Gestion de l'inventaire par catégorie
- ✅ Support multilingue (FR/EN)

## 🛠️ Stack Technologique

### Backend
- **Node.js** avec Express
- **TypeScript**
- **PostgreSQL** avec Prisma ORM
- **JWT** pour l'authentification

### Frontend
- **React 18** avec TypeScript
- **Vite** pour le build
- **Tailwind CSS** pour le styling
- **Recharts** pour les graphiques
- **i18next** pour les traductions
- **Lucide React** pour les icônes

## 📋 Structure du Projet

```
Servente intelligente/
├── servante-backend/          # API Node.js/Express
│   ├── src/
│   │   ├── controllers/        # Logique métier
│   │   ├── routes/             # Routes API
│   │   ├── middleware/         # Middlewares Express
│   │   └── server.ts           # Point d'entrée
│   ├── prisma/
│   │   ├── schema.prisma       # Modèle de données
│   │   └── seed.ts             # Données de test
│   └── package.json
│
└── servante frontend/          # Application React
    ├── src/
    │   ├── components/         # Composants réutilisables
    │   ├── services/           # Appels API
    │   ├── App.tsx             # Composant principal
    │   └── main.tsx            # Point d'entrée
    └── package.json
```

## 🚀 Installation

### Prérequis
- Node.js >= 18.0
- PostgreSQL >= 12
- npm ou yarn

### Backend

```bash
cd servante-backend
npm install
cp .env.example .env  # Configurez votre DATABASE_URL
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed   # Charger les données de test
npm run dev
```

Le serveur démarre sur `http://localhost:3000`

### Frontend

```bash
cd "servante frontend"
npm install
npm run dev
```

L'application démarre sur `http://localhost:5173`

## 📚 API Endpoints

### Authentification
- `POST /api/auth/admin-login` - Connexion administrateur
- `POST /api/auth/badge-scan` - Scan badge RFID

### Outils
- `GET /api/tools` - Lister tous les outils
- `POST /api/tools` - Créer un outil
- `PUT /api/tools/:id` - Modifier un outil
- `DELETE /api/tools/:id` - Supprimer un outil

### Emprunts
- `GET /api/borrows` - Lister tous les emprunts
- `POST /api/borrows` - Créer un emprunt
- `PUT /api/borrows/:id/return` - Retourner un outil

### Utilisateurs
- `GET /api/users` - Lister tous les utilisateurs
- `POST /api/users` - Créer un utilisateur
- `PUT /api/users/:id` - Modifier un utilisateur
- `DELETE /api/users/:id` - Supprimer un utilisateur

## 🗄️ Modèle de Données

### User
- id (UUID)
- fullName (String)
- email (String, unique)
- badgeId (String, unique)
- role (STUDENT | PROFESSOR | TECHNICIAN | ADMIN)
- password (String)
- createdAt (DateTime)

### Tool
- id (UUID)
- name (String)
- category (String)
- imageUrl (String)
- totalQuantity (Int)
- availableQuantity (Int)
- borrowedQuantity (Int)
- size (String?)
- drawer (String?)

### Borrow
- id (UUID)
- userId (FK)
- toolId (FK)
- borrowDate (DateTime)
- dueDate (DateTime)
- returnDate (DateTime?)
- status (ACTIVE | RETURNED | OVERDUE)

## 🔑 Variables d'Environnement

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/servante_db
PORT=3000
NODE_ENV=development
JWT_SECRET=votre_secret_jwt
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3000
```

## 📝 Scripts Disponibles

### Backend
```bash
npm run dev              # Démarrer en mode développement
npm run build            # Compiler TypeScript
npm run start            # Démarrer le serveur compilé
npm run prisma:migrate   # Exécuter les migrations
npm run prisma:seed      # Charger les données de test
npm run prisma:studio    # Ouvrir Prisma Studio
```

### Frontend
```bash
npm run dev              # Démarrer le serveur de dev
npm run build            # Compiler pour production
npm run preview          # Prévisualiser la build
npm run lint             # Vérifier le linting
```

## 👥 Utilisateurs de Test

Les données de test incluent:
- Ahmed Benali (Étudiant)
- Fatima Zahra (Étudiant)
- Youssef Alami (Étudiant)
- Sara Bennani (Étudiant)
- Karim Mansouri (Professeur)
- Leila Berrada (Technicienne)

## 📄 License

MIT

## 👨‍💻 Auteur

EMINES Engineering School
