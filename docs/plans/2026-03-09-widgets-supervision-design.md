# Design Doc : Système de Widgets de Supervision à l'Étage

Ce document détaille la conception d'un système de widgets modulaires pour simplifier la supervision en temps réel des vannes d'oxygène et de l'occupation des chambres.

## 1. Objectifs
- Fournir une vue d'ensemble rapide et "coup d'œil" pour le personnel soignant à l'étage.
- Réduire la complexité visuelle en extrayant uniquement les données critiques.
- Permettre une supervision proactive (détection d'anomalies immédiate).

## 2. Architecture des Widgets
Les widgets seront des composants React autonomes, conçus pour être intégrés dans une grille (`WidgetGrid`) ou un tableau de bord personnalisé.

### Types de Widgets proposés :
1. **Widget O2 (Vannes)**
   - **Contenu** : Nom de la vanne, Statut (Ouvert/Fermé), Durée d'ouverture actuelle, Alerte si ouvert > seuil (ex: 4h).
   - **Interaction** : Clic pour ouvrir le modal d'historique détaillé.
2. **Widget Occupation (Chambres)**
   - **Contenu** : Numéro de chambre, État (Occupée/Libre), Nom du patient (si occupée), Temps depuis admission.
   - **Source** : Jointure entre les tables `rooms`, `admissions` et `episodes`.
3. **Widget Alertes Critiques**
   - **Contenu** : Liste priorisée des "points chauds" (Fuites O2, Chambre abandonnée, etc.).

## 3. Architecture Technique

### Backend (API)
- **Nouveau Endpoint** : `GET /api/supervision/widgets`
  - Retourne un résumé agrégé par étage :
    - Liste des vannes actives/ouvertes.
    - Taux d'occupation des chambres.
    - Alertes actives.

### Frontend
- **Bibliothèque de composants** : `src/components/widgets/`
  - `ValveWidget.tsx`
  - `OccupancyWidget.tsx`
  - `AlertWidget.tsx`
- **Nouvelle Page** : `SupervisionView.tsx` 
  - Propose une vue par étage avec une grille de widgets auto-actualisée.

## 4. Design Visuel
- **Style** : Cards compactes, bordures colorées selon le niveau d'urgence (Vert = OK, Orange = Attention, Rouge = Critique).
- **Responsive** : Passage d'une grille multi-colonnes à une liste verticale sur mobile.

## 5. Prochaines Étapes (après approbation)
1. Implémenter le contrôleur backend `SupervisionController`.
2. Créer les composants UI `BaseWidget` et ses déclinaisons.
3. Intégrer la page de supervision dans la navigation principale.
