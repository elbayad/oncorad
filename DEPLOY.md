# Guide de Déploiement - IoT Clinic Management

Ce document détaille les étapes nécessaires pour déployer et maintenir l'application IoT Clinic sur un serveur Ubuntu en environnement local (LAN).

## 📋 Pré-requis

Avant de commencer, assurez-vous que les éléments suivants sont installés sur le serveur :

- **Node.js** (v18 ou supérieur)
- **npm** (v9 ou supérieur)
- **PM2** (`npm install -g pm2`)
- **PostgreSQL** (accessible sur 10.0.0.2:5432)
- **Serveur MQTT** (accessible sur 10.0.0.2:1883)

## 📂 Structure du Projet

```text
/var/www/oncorad/
├── server/             # Backend Node.js (API REST)
├── src/                # Source Frontend React
├── dist/               # Build Frontend (Production)
├── .env                # Variables d'environnement
└── ecosystem.config.cjs # Configuration PM2
```

## ⚙️ Configuration (.env)

Créez ou modifiez le fichier `.env` à la racine du projet (`/var/www/oncorad/.env`) :

```env
# --- BACKEND ---
PORT=8789
NODE_ENV=production

# Base de données (VM Data)
DB_HOST=10.0.0.2
DB_PORT=5432
DB_NAME=iot_clinic_db
DB_USER=postgres
DB_PASSWORD=Data@data#15963*

# MQTT (VM Data)
MQTT_URL=mqtt://10.0.0.2:1883

# Sécurité
JWT_SECRET=af7d01cf478f3b80c8454571ad4e0a30e9dead06d292c21b23495fc46df9077e
CORS_ORIGIN=http://192.168.100.5,http://192.168.100.5:5175

# --- FRONTEND ---
VITE_API_URL=http://192.168.100.5:8789/api
```

## 🚀 Démarrage de l'Application

### 1. Installation des dépendances

```bash
cd /var/www/oncorad
npm install
```

### 2. Démarrage avec PM2 (Recommandé)

Le fichier `ecosystem.config.cjs` permet de lancer le backend et le frontend simultanément.

```bash
# Lancer tous les services
pm2 start ecosystem.config.cjs

# Sauvegarder la liste des processus (pour redémarrage auto après reboot serveur)
pm2 save
```

### 3. Alternative : Production réelle (Nginx)

Pour de meilleures performances en production, il est conseillé de servir le frontend via Nginx plutôt que par Vite :

1.  Générez le build : `npm run build`
2.  Configurez un bloc serveur Nginx pour pointer vers `/var/www/oncorad/dist`.
3.  Lancer uniquement le backend avec PM2 : `pm2 start ecosystem.config.cjs --only iot-clinic-backend`.

## 📊 Gestion et Logs

Voici les commandes utiles pour la maintenance :

- **Voir le statut** : `pm2 status`
- **Logs en temps réel** : `pm2 logs`
- **Logs spécifiques au Backend** : `pm2 logs iot-clinic-backend`
- **Logs spécifiques au Frontend** : `pm2 logs iot-clinic-frontend`
- **Redémarrer tout** : `pm2 restart all`
- **Arrêter tout** : `pm2 stop all`

## 🛠️ Dépannage

- **Problème de connexion DB** : Vérifiez que l'IP `10.0.0.2` est accessible depuis la VM application et que PostgreSQL autorise les connexions distantes (`pg_hba.conf`).
- **Erreur CORS** : Assurez-vous que l'URL d'accès au frontend est bien listée dans `CORS_ORIGIN` du fichier `.env`.
- **Port déjà utilisé** : Utilisez `netstat -tulnp | grep 8789` pour voir quel processus utilise le port du backend.
