# Guide de Déploiement - IoT Clinic Management System

## Prérequis

### Logiciels requis
- **Node.js** 18+ et npm
- **PostgreSQL** 14+
- **Git** (optionnel)

### Vérification des prérequis
```bash
node --version  # Doit être 18+
npm --version
psql --version  # Doit être 14+
```

## Installation et Configuration

### 1. Installation des dépendances

```bash
# Installer les dépendances du projet principal
npm install

# Installer les dépendances du serveur
cd server
npm install
cd ..
```

### 2. Configuration de la base de données

#### A. Créer la base de données
```bash
# Se connecter à PostgreSQL en tant que superutilisateur
sudo -u postgres psql

# Ou sur Windows/Mac
psql -U postgres -h localhost
```

#### B. Exécuter le script de setup
```bash
# Depuis la racine du projet
psql -U postgres -h localhost -f database/setup_local.sql
```

#### C. Vérifier l'installation
```bash
# Se connecter à la nouvelle base
psql -U clinic_admin -d iot_clinic_db -h localhost

# Lister les tables
\dt

# Vérifier les utilisateurs
SELECT email, name, role FROM users;
```

### 3. Configuration des variables d'environnement

Le fichier `.env` est déjà configuré avec les valeurs par défaut. Modifiez-le si nécessaire :

```bash
# Éditer le fichier .env
nano .env
```

**Variables importantes :**
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` : Configuration PostgreSQL
- `JWT_SECRET` : Clé secrète pour les tokens JWT (changez en production !)
- `PORT` : Port du serveur backend (3001 par défaut)
- `CORS_ORIGIN` : URL du frontend autorisée

## Déploiement

### Mode Développement

#### Option 1 : Démarrage séparé
```bash
# Terminal 1 - Backend
npm run server:dev

# Terminal 2 - Frontend  
npm run dev
```

#### Option 2 : Démarrage simultané
```bash
# Démarre backend et frontend ensemble
npm run dev:full
```

### Mode Production

#### 1. Build du frontend
```bash
npm run build
```

#### 2. Démarrage du serveur
```bash
# Production
NODE_ENV=production npm run server

# Ou avec PM2 (recommandé)
npm install -g pm2
pm2 start server/app.js --name "iot-clinic-api"
pm2 startup
pm2 save
```

#### 3. Servir le frontend
```bash
# Avec un serveur web (nginx, apache) ou
npm run preview
```

## Configuration Nginx (Optionnel)

```nginx
server {
    listen 80;
    server_name votre-domaine.com;
    
    # Frontend
    location / {
        root /chemin/vers/votre/projet/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # API Backend
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Comptes par Défaut

### Utilisateurs de test
- **Administrateur** : `admin@clinic.com` / `password123`
- **Infirmière** : `nurse@clinic.com` / `password123`  
- **Maintenance** : `maintenance@clinic.com` / `password123`

### Base de données
- **Utilisateur** : `clinic_admin`
- **Mot de passe** : `clinic123`
- **Base** : `iot_clinic_db`

## URLs d'accès

- **Frontend** : http://localhost:5173
- **Backend API** : http://localhost:3001/api
- **Health Check** : http://localhost:3001/api/health

## Dépannage

### Problèmes courants

#### 1. Erreur de connexion à la base
```bash
# Vérifier que PostgreSQL fonctionne
sudo systemctl status postgresql

# Redémarrer si nécessaire
sudo systemctl restart postgresql
```

#### 2. Port déjà utilisé
```bash
# Trouver le processus utilisant le port
lsof -i :3001
lsof -i :5173

# Tuer le processus
kill -9 PID
```

#### 3. Problèmes de permissions
```bash
# Donner les permissions à l'utilisateur PostgreSQL
sudo -u postgres createuser --interactive clinic_admin
```

#### 4. Erreurs de modules manquants
```bash
# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install

# Pour le serveur
cd server
rm -rf node_modules package-lock.json  
npm install
```

## Maintenance

### Sauvegarde de la base
```bash
pg_dump -U clinic_admin -h localhost iot_clinic_db > backup_$(date +%Y%m%d).sql
```

### Restauration
```bash
psql -U clinic_admin -h localhost iot_clinic_db < backup_20250902.sql
```

### Logs
```bash
# Logs PM2
pm2 logs iot-clinic-api

# Logs système
tail -f /var/log/postgresql/postgresql-14-main.log
```

## Sécurité

### Recommandations pour la production

1. **Changer les mots de passe par défaut**
2. **Utiliser HTTPS** (certificat SSL)
3. **Configurer un firewall**
4. **Mettre à jour régulièrement** les dépendances
5. **Sauvegardes automatiques** de la base de données
6. **Monitoring** avec PM2 ou équivalent

### Variables d'environnement sensibles
```bash
# Générer une nouvelle clé JWT
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Support

Pour toute question ou problème :
1. Vérifiez les logs d'erreur
2. Consultez la documentation PostgreSQL
3. Vérifiez la configuration réseau/firewall
4. Testez les connexions individuellement (DB, API, Frontend)