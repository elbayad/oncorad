# Intégration MQTT - IoT Clinic Management

## 📋 Résumé de l'intégration

Le module MQTT a été intégré avec succès dans le projet IoT Clinic Management. Le système peut maintenant se connecter au serveur MQTT et recevoir des données en temps réel.

## 🎯 Ce qui a été fait

### 1. Module MQTT
Le dossier `mqtt/` contient un module complet et réutilisable qui :
- ✅ Se connecte au broker MQTT (tanger.geodaki.com:1883)
- ✅ Écoute les topics : `energie`, `energie3`, `air`, `rtls`, `o2`
- ✅ Parse et structure les données selon le type de capteur
- ✅ Gère la reconnexion automatique
- ✅ Émet des événements pour la connexion, messages, erreurs

### 2. Service MQTT dans le serveur
Un service MQTT a été créé dans `server/services/mqttService.js` qui :
- ✅ Intègre le module MQTT dans le serveur Express
- ✅ Initialise la connexion au démarrage du serveur
- ✅ Stocke l'historique des messages (100 derniers)
- ✅ Fournit des méthodes pour accéder aux données
- ✅ Gère les subscribers WebSocket (prévu pour temps réel)

### 3. API REST MQTT
Des routes API ont été ajoutées dans `server/routes/mqtt.js` :
- ✅ `GET /api/mqtt/stats` - Statistiques MQTT
- ✅ `GET /api/mqtt/history` - Historique des messages
- ✅ `GET /api/mqtt/status` - État de la connexion
- ✅ `POST /api/mqtt/reconnect` - Forcer la reconnexion
- ✅ `GET /api/mqtt/devices` - Liste des devices actifs

### 4. Intégration dans app.js
Le serveur Express :
- ✅ Initialise automatiquement le service MQTT au démarrage
- ✅ Se connecte au broker MQTT
- ✅ S'abonne à tous les topics configurés
- ✅ Gère l'arrêt propre du service MQTT

### 5. Corrections techniques
- ✅ Correction des méthodes async dans le module MQTT (mqtt@5 compatible)
- ✅ Remplacement de `endAsync()`, `subscribeAsync()`, `publishAsync()` par les bonnes méthodes
- ✅ Ajout de la dépendance `mqtt` dans le package.json du serveur

## 🚀 Utilisation

### Démarrer le serveur

```bash
# Dans le serveur
cd server
npm run dev

# Ou depuis la racine
npm run server:dev
```

Le serveur va :
1. Se connecter au broker MQTT
2. S'abonner aux topics configurés
3. Démarrer sur le port 3001

### Tester l'intégration

**1. Vérifier le statut MQTT :**
```bash
curl http://localhost:3001/api/mqtt/status
```

**2. Voir les statistiques :**
```bash
curl http://localhost:3001/api/mqtt/stats
```

**3. Voir l'historique :**
```bash
curl http://localhost:3001/api/mqtt/history
```

**4. Voir les devices actifs :**
```bash
curl http://localhost:3001/api/mqtt/devices
```

### Configuration

Les variables d'environnement MQTT sont définies dans le fichier `server/config.example.env` :

```env
MQTT_URL=mqtt://tanger.geodaki.com:1883
MQTT_CLIENT_ID=iot-clinic-server
MQTT_KEEPALIVE=60
MQTT_RECONNECT_PERIOD=5000
MQTT_CONNECT_TIMEOUT=30000
MQTT_QOS=1
MQTT_CLEAN=true
```

Créez un fichier `.env` dans le dossier `server/` avec ces valeurs.

## 📊 Format des données

### Exemple pour topic/energie :
```json
{
  "topic": "topic/energie",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "deviceId": "78:42:1c:8d:8a:14",
  "mac": "78:42:1c:8d:8a:14",
  "data": {
    "tension": 230,
    "courant": 5.5,
    "puissance": 1265,
    "energie": 100,
    "wifi": -45,
    "temperature": 25
  },
  "receivedAt": "2025-01-15T10:30:00.500Z"
}
```

### Exemple pour topic/air :
```json
{
  "topic": "topic/air",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "deviceId": "air-sensor-001",
  "data": {
    "temperature": 25.5,
    "humidity": 60.2,
    "pressure": 1013.25,
    "co2": 400,
    "pm25": 15,
    "pm10": 25
  },
  "receivedAt": "2025-01-15T10:30:00.500Z"
}
```

## 🔌 Topics supportés

| Topic | Description | Exemple de données |
|-------|-------------|-------------------|
| `topic/energie` | Capteurs énergétiques monophasés | tension, courant, puissance, energie |
| `topic/energie3` | Capteurs énergétiques triphasés | tensionA/B/C, courantA/B/C, puissanceTotale |
| `topic/air` | Qualité d'air | temperature, humidity, co2, pm25, pm10 |
| `topic/rtls` | Localisation temps réel | x, y, z, accuracy, battery |
| `topic/o2` | Capteurs d'oxygène | o2Level, temperature, pressure, battery |

## 📁 Structure des fichiers

```
projet/
├── mqtt/
│   ├── index.js          # Module MQTT principal
│   ├── config.js         # Configuration MQTT
│   ├── package.json      # Dépendances MQTT
│   ├── README.md         # Documentation MQTT
│   └── examples.js       # Exemples d'utilisation
├── server/
│   ├── services/
│   │   ├── mqttService.js    # Service MQTT (nouveau)
│   │   └── README.md         # Documentation service
│   ├── routes/
│   │   └── mqtt.js          # Routes API MQTT (nouveau)
│   ├── app.js               # Serveur Express (modifié)
│   └── package.json         # Dépendances serveur (modifié)
└── MQTT_INTEGRATION.md      # Ce fichier
```

## 🎯 Prochaines étapes possibles

### Fonctionnalités à ajouter :
- [ ] Support WebSocket pour le temps réel côté frontend
- [ ] Persistance des données en base PostgreSQL
- [ ] Système d'alertes basé sur les seuils
- [ ] Dashboards temps réel par module
- [ ] Export des données (CSV, JSON, PDF)
- [ ] Synchronisation automatique avec la base de données

### Pour le frontend :
- [ ] Créer un contexte React pour MQTT
- [ ] Implémenter les hooks personnalisés (useMqtt, useSensorData)
- [ ] Ajouter des composants temps réel dans les modules
- [ ] Intégrer les graphiques temps réel (Chart.js, Recharts)

## 🐛 Dépannage

### Le serveur ne se connecte pas au broker MQTT

1. Vérifier que le broker est accessible :
```bash
ping tanger.geodaki.com
```

2. Vérifier les variables d'environnement :
```bash
cat server/.env
```

3. Voir les logs du serveur :
```bash
npm run server:dev
```

### Pas de messages reçus

1. Vérifier que le serveur MQTT est bien en cours d'exécution
2. Vérifier les logs du service MQTT
3. Tester avec le module MQTT directement :
```bash
cd mqtt
npm install
npm start
```

### Erreurs de compilation

Si vous rencontrez des erreurs TypeScript dans le module MQTT :
```bash
cd mqtt
npm install
```

## 📝 Documentation supplémentaire

- Voir `mqtt/README.md` pour la documentation complète du module MQTT
- Voir `server/services/README.md` pour la documentation du service MQTT
- Voir `mqtt/examples.js` pour des exemples d'utilisation

## ✅ Test de l'intégration

Pour tester que tout fonctionne :

```bash
# 1. Installer les dépendances
cd server
npm install

# 2. Démarrer le serveur
npm run dev

# 3. Dans un autre terminal, tester l'API
curl http://localhost:3001/api/mqtt/status
curl http://localhost:3001/api/mqtt/stats
```

Si vous voyez `"connected": true` dans la réponse, l'intégration fonctionne ! 🎉

## 📄 License

MIT

