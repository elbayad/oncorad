# Procédure de Suivi de Position Tag Temps Réel

Ce document détaille le flux de données depuis l'émission du signal jusqu'à son affichage sur l'interface utilisateur.

## 1. Acquisition et Réception des Données (Backend)
Tout commence par les capteurs physiques (ancres) installés dans le bâtiment.

- **Émission BLE** : Le tag émet un signal Bluetooth Low Energy (BLE).
- **Réception par les Ancres** : Les ancres (gateways) à proximité captent ce signal et mesurent sa puissance (RSSI).
- **Envoi MQTT** : Les ancres envoient ces données au serveur via le protocole MQTT.
- **Ingestion Serveur** (`server.js` / `mqttService.js`) :
    - Le serveur écoute sur le topic MQTT (défini dans `MQTT_TOPIC`).
    - La fonction reçoit chaque message JSON.
    - **Filtrage** : Elle vérifie si le tag est autorisé, si le message est valide et si l'ancre est connue.

## 2. Traitement et Calcul de la Position (Backend)
Pour éviter que la position ne saute à cause du bruit radio, le serveur regroupe les trames. Service principal : `rtlsService.js`.

- **Fenêtrage (Bucketing)** :
    - Les mesures RSSI sont accumulées dans une "fenêtre" de temps (`BUCKET_MS`, ex: 1200ms).
    - Pour chaque ancre, le serveur calcule la médiane des RSSI reçus durant cette fenêtre.

- **Détermination de l'Étage (`flushBucket`)** :
    - Déclenchée une fois la fenêtre pleine ou le temps écoulé.
    - **Algorithme** : Comparaison du "vecteur RSSI" avec une base de données de calibration (Radio Map).
    - **Hystérésis** : Le tag ne change d'étage que si le signal du nouvel étage est nettement meilleur (`FLOOR_MARGIN`) et si le dernier changement ne date pas de moins de `FLOOR_LOCK_SEC` secondes.
    - **Fallback** : Si aucune calibration n'existe, l'étage est déterminé par l'ancre qui capte le signal le plus fort ("Best Anchor").

- **Calcul des Coordonnées (X, Y)** :
    - **Spécification Visée** :
        - *Fingerprinting (kNN)* : Moyenne pondérée des k points de calibration les plus proches.
        - *Trilatération (Refine)* : Calcul géométrique basé sur la distance estimée.
        - *Fusion Hybride* : Mélange pondéré (`HYBRID_MIX`) entre Fingerprinting et Trilatération.
    - **Implémentation Actuelle (WCL)** :
        - Utilise le *Weighted Centroid Localization* pondéré par le signal RSSI au carré.

- **Lissage (Smoothing)** :
    - La position brute peut être lissée avec la position précédente via une moyenne exponentielle (EMA) pour la fluidité.

## 3. Transmission Temps Réel (WebSocket)
Une fois la position (X, Y) et l'étage calculés :

- **Émission Socket.IO** : Le serveur envoie un événement nommé `point` (ou `rtls/position` via MQTT wrapper) à tous les clients connectés.
- **Payload** : `{ tag, floor, x, y, battery_mV, ... }`.

## 4. Affichage sur l'Interface (`index.html` / Frontend)
Le navigateur reçoit ces données et met à jour l'interface.

- **Connexion** : Établissement d'une connexion WebSocket permanente.
- **Réception** : Écoute de l'événement.
- **Mise à jour Visuelle** :
    - **Position** : Si le tag est sur l'étage affiché, son marqueur est déplacé.
    - **Métadonnées** : Batterie et autres infos mises à jour.
    - **Tracking** : Centrage automatique de la carte si le mode "Suivre" est actif.
