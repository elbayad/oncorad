# 🗄️ Migration PostgreSQL - Suppression Supabase

## ✅ Modifications effectuées

### 1. Suppression complète de Supabase
- ❌ **Dossier `supabase/` supprimé** définitivement
- ✅ **Migrations copiées** vers `database/`

### 2. Structure actuelle
```
E:\claude\clinique\
├── database/                   # Scripts et migrations PostgreSQL
│   ├── README.md               # Documentation complète
│   ├── setup_local.sql         # Script de setup
│   ├── 20250902142946_turquoise_castle.sql
│   └── 20250902150614_dawn_spire.sql
├── server/
│   ├── config/
│   │   └── database.js         # Configuration PostgreSQL uniquement
│   └── ...
└── ...
```

### 3. Fichiers modifiés
- ✅ `README.md` - Référence à supabase supprimée
- ✅ `database/README.md` - Documentation PostgreSQL complète

## 🎯 Configuration actuelle : PostgreSQL uniquement

### Connexion à la base de données

```javascript
// server/config/database.js
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'iot_clinic_db',
  user: process.env.DB_USER || 'clinic_admin',
  password: process.env.DB_PASSWORD || 'clinic123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

### Variables d'environnement

Créez un fichier `.env` dans le dossier `server/` :

```env
# Base de données PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iot_clinic_db
DB_USER=clinic_admin
DB_PASSWORD=clinic123

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5175

# JWT
JWT_SECRET=votre-secret-jwt
JWT_EXPIRES_IN=24h
```

## 🚀 Installation de la base de données

### 1. Installer PostgreSQL (si nécessaire)
```bash
# Sur Windows (avec Chocolatey)
choco install postgresql

# Sur Linux
sudo apt-get install postgresql
```

### 2. Créer la base de données
```bash
# Connectez-vous en tant que superuser
psql -U postgres -h localhost

# Créer la base
CREATE DATABASE iot_clinic_db;

# Créer l'utilisateur
CREATE USER clinic_admin WITH PASSWORD 'clinic123';

# Donner les permissions
GRANT ALL PRIVILEGES ON DATABASE iot_clinic_db TO clinic_admin;

# Se connecter à la nouvelle base
\c iot_clinic_db

# Exécuter le script de création
\i database/setup_local.sql
```

### 3. Vérifier l'installation
```bash
psql -U clinic_admin -d iot_clinic_db -h localhost

# Lister les tables
\dt

# Vérifier les utilisateurs
SELECT * FROM users;

# Vérifier les modules
SELECT * FROM modules;
```

## 📊 Base de données PostgreSQL

### Tables principales

#### Tables système
- `users` - Utilisateurs et authentification
- `modules` - Modules IoT disponibles
- `user_modules` - Permissions utilisateurs
- `floors` - Étages du bâtiment
- `activity_logs` - Logs d'activité
- `system_alerts` - Alertes système

#### AmbuTrack (Ambulances)
- `ambulances` - Flotte ambulances
- `ambulance_crew` - Équipages
- `missions` - Missions de transport

#### FloorTrace (RTLS)
- `assets` - Ressources trackables
- `asset_tracking_history` - Historique de localisation
- `asset_types` - Types d'assets

#### BlocView (Dossiers Bloc Opératoire)
- `bloc_view` - Dossiers patients bloc opératoire

#### BinSense (Déchets)
- `waste_bins` - Poubelles intelligentes
- `waste_types` - Types de déchets
- `collection_schedules` - Planning de collecte

#### EnergyPulse (Énergie)
- `energy_meters` - Compteurs énergétiques
- `energy_readings` - Mesures de consommation
- `energy_alerts` - Alertes énergétiques

#### AirGuard (Qualité d'air)
- `air_sensors` - Capteurs d'air
- `air_quality_readings` - Mesures qualité d'air
- `air_quality_alerts` - Alertes qualité d'air

#### OxyFlow (Oxygène)
- `oxygen_points` - Points de distribution oxygène
- `oxygen_readings` - Mesures oxygène
- `oxygen_maintenance` - Maintenance oxygène

### Utilisateurs par défaut

```
Admin:           admin@clinic.com / admin123
Infirmière:      nurse@clinic.com / password123
Maintenance:     maintenance@clinic.com / password123
```

## ✅ Avantages de PostgreSQL uniquement

1. **Contrôle total** : Base de données 100% sous votre contrôle
2. **Pas de dépendance externe** : Pas besoin de compte Supabase
3. **Performance** : Optimisations locales possibles
4. **Sécurité** : Données restent sur vos serveurs
5. **Coût** : Gratuit et open source
6. **Flexibilité** : Extensions PostgreSQL disponibles

## 🔄 Migration depuis Supabase (si applicable)

Si vous aviez des données sur Supabase :

1. **Exporter les données**
```bash
# Depuis Supabase Dashboard
pg_dump -h [host] -U [user] -d [database] > backup.sql
```

2. **Importer dans PostgreSQL local**
```bash
psql -U clinic_admin -d iot_clinic_db < backup.sql
```

## 🧪 Tests

```bash
# Démarrer le serveur
npm run server:dev

# Vérifier la connexion à la base
curl http://localhost:3001/api/health
```

## 📝 Notes importantes

- ✅ Le projet n'utilise **PLUS** Supabase
- ✅ PostgreSQL est configuré et utilisé partout
- ✅ Toutes les migrations sont dans `database/`
- ✅ La configuration est dans `server/config/database.js`
- ✅ La documentation est dans `database/README.md`

## 🎉 Résultat

Le projet utilise maintenant **100% PostgreSQL** sans aucune trace de Supabase !

