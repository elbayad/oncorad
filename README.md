# IoT Clinic Management System

Un système de gestion IoT complet pour cliniques médicales avec 7 modules spécialisés.

## 🏥 Modules Disponibles

- **AmbuTrack** - Dispatch & Géolocalisation des ambulances
- **FloorTrace** - RTLS Multi-étages (localisation temps réel)
- **BlocView** - Dossiers Bloc Opératoire
- **BinSense** - Gestion intelligente des déchets médicaux
- **EnergyPulse** - Monitoring énergétique par étage
- **AirGuard** - Surveillance qualité air + Delta-Guard
- **OxyFlow** - Suivi réseau oxygène médical

## 🚀 Démarrage Rapide

### Installation
```bash
# Cloner le projet
git clone <votre-repo>
cd iot-clinic-management

# Installer les dépendances
npm install
```

### Configuration Base de Données
```bash
# Créer la base PostgreSQL
npm run setup:db
```

### Lancement
```bash
# Mode développement (backend + frontend)
npm run dev:full

# Ou séparément
npm run server:dev  # Backend sur :3001
npm run dev         # Frontend sur :5175
```

## 📋 Comptes de Test

- **Admin** : `admin@clinic.com` / `password123`
- **Infirmière** : `nurse@clinic.com` / `password123`
- **Maintenance** : `maintenance@clinic.com` / `password123`

## 📚 Documentation

- [Guide de Déploiement](DEPLOYMENT.md) - Instructions complètes
- [Structure Base de Données](database/README.md) - Schéma et données

## 🛠 Technologies

- **Frontend** : React 18, TypeScript, Tailwind CSS, Vite
- **Backend** : Node.js, Express, PostgreSQL
- **Auth** : JWT, bcrypt
- **Icons** : Lucide React

## 📱 Fonctionnalités

- ✅ Authentification sécurisée
- ✅ Gestion des rôles et permissions
- ✅ Interface responsive (mobile/desktop)
- ✅ Mode sombre/clair
- ✅ 7 modules IoT spécialisés
- ✅ Tableau de bord temps réel
- ✅ Système d'alertes
- ✅ Historique et logs

## 🔧 Scripts Disponibles

```bash
npm run dev          # Frontend développement
npm run server:dev   # Backend développement  
npm run dev:full     # Backend + Frontend
npm run build        # Build production
npm run setup:db     # Setup base de données
```

## 📊 Architecture

```
iot-clinic-management/
├── src/                 # Frontend React
├── server/             # Backend API
├── database/           # Scripts SQL et migrations
├── mqtt/              # Module MQTT
└── docs/              # Documentation
```

## 🌐 URLs

- Frontend : http://localhost:5175
- Backend API : http://localhost:3001/api
- Health Check : http://localhost:3001/api/health

## 📄 Licence

MIT License - Voir [LICENSE](LICENSE) pour plus de détails.