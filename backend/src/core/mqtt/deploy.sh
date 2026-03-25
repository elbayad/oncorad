#!/bin/bash

# Script de déploiement pour le module MQTT MACHWATT

echo "🚀 Déploiement du module MQTT MACHWATT"
echo ""

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non trouvé. Veuillez installer Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js $NODE_VERSION détecté"

# Vérifier npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm non trouvé"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm $NPM_VERSION détecté"

# Installer les dépendances
echo ""
echo "📦 Installation des dépendances..."
if npm install; then
    echo "✅ Dépendances installées"
else
    echo "❌ Erreur installation dépendances"
    exit 1
fi

# Créer le fichier .env s'il n'existe pas
if [ ! -f .env ]; then
    echo ""
    echo "📝 Création du fichier .env..."
    cat > .env << EOF
# Configuration MQTT
MQTT_URL=mqtt://tanger.geodaki.com:1883
MQTT_CLIENT_ID=machwatt-module
MQTT_KEEPALIVE=60
MQTT_RECONNECT_PERIOD=5000
MQTT_CONNECT_TIMEOUT=30000
MQTT_QOS=1
MQTT_CLEAN=true
MQTT_LOG_LEVEL=info
MQTT_LOG_MESSAGES=false
EOF
    echo "✅ Fichier .env créé"
else
    echo "✅ Fichier .env existant"
fi

# Exécuter les tests
echo ""
echo "🧪 Exécution des tests..."
if npm test; then
    echo "✅ Tous les tests sont passés"
else
    echo "❌ Tests échoués"
    exit 1
fi

# Test de connectivité MQTT (optionnel)
echo ""
echo "🔌 Test de connectivité MQTT..."
if timeout 10s node -e "
import('./index.js').then(m => {
  const client = new m.MqttModule();
  client.connect().then(() => {
    console.log('✅ Connexion MQTT réussie');
    process.exit(0);
  }).catch(e => {
    console.error('❌ Connexion MQTT échouée:', e.message);
    process.exit(1);
  });
}).catch(e => {
  console.error('❌ Erreur import:', e.message);
  process.exit(1);
});
" 2>/dev/null; then
    echo "✅ Connexion MQTT réussie"
else
    echo "⚠️  Test de connectivité MQTT ignoré (timeout ou broker indisponible)"
fi

echo ""
echo "🎉 Déploiement terminé avec succès !"
echo ""
echo "📋 Prochaines étapes:"
echo "   1. Configurer les variables d'environnement dans .env"
echo "   2. Tester avec: npm start"
echo "   3. Intégrer dans vos applications"
echo "   4. Voir examples.js pour des exemples d'utilisation"
