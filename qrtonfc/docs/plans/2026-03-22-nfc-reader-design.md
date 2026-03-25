# Conception du Lecteur NFC avec React et Node.js

## Objectif
Permettre la lecture d'un tag NFC depuis un lecteur matériel (ex: ACR122U) branché en USB et transférer automatiquement son identifiant (UID) dans une cellule d'un formulaire sur une application web React.

## Architecture Globale
L'application repose sur une architecture client/serveur asynchrone pour permettre une remontée d'informations en temps réel sans blocage de l'interface utilisateur.

- **Matériel** : Lecteur NFC USB compatible PC/SC (ex: ACR122U).
- **Backend (Node.js)** : Serveur local chargé d'interfacer avec le matériel USB et de pousser les données lues vers l'interface Web.
- **Frontend (React)** : Interface web affichant le formulaire cible et écoutant les événements provenant du serveur.

## Composants Principaux
1. **Serveur Node.js (`server.js`)**
   - Utilise la bibliothèque `nfc-pcsc` pour la détection et la lecture du lecteur.
   - Héberge un serveur WebSocket avec `socket.io` pour transmettre l'UID du tag lu.
2. **Application React (`App.jsx` ou `NfcForm.jsx`)**
   - Intègre un champ de formulaire (ex: un `<input type="text">`).
   - Utilise `socket.io-client` pour s'abonner aux événements du serveur.

## Flux de Données
1. L'application Node.js est lancée et se connecte au lecteur NFC USB.
2. L'application React est ouverte dans le navigateur et établit une connexion WebSocket avec Node.js.
3. Lorsqu'un utilisateur approche un tag NFC du lecteur, `nfc-pcsc` détecte le tag et lit son UID.
4. Node.js émet un événement `tag-read` avec l'UID via la connexion WebSocket.
5. React intercepte l'événement `tag-read`, extrait l'UID, et met à jour l'état (le *state*) lié à la cellule du formulaire, ce qui a pour effet de l'afficher instantanément.

## Gestion des Erreurs
- **Déconnexion Matérielle** : Si le lecteur est débranché, le serveur Node.js l'indique dans les logs et attend sa reconnexion pour réinitialiser le processus.
- **Connexion Perdue (Côté React)** : Une indication visuelle (comme une pastille rouge/verte) informera l'utilisateur si la liaison WebSocket est perdue pour éviter d'essayer de scanner dans le vide.

## Prochaines Étapes (Planification)
Création du projet (Backend et Frontend), installation des dépendances, et implémentation du code selon les deux composants décrits ci-dessus.
