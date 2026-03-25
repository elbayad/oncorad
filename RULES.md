# OncoRad – Règles de Développement & Conformité ISO

Ce document définit les règles de conception, de développement et de validation de l’application **OncoRad**, destinée à un environnement hospitalier critique. Il est structuré pour être **directement exploitable lors d’un audit qualité, ISO ou réglementaire (CE / hôpital)**.

---

## 1. Principes Clés UX/UI (Audit Ready)

### 👁️ Lisibilité Immédiate (≤ 3 secondes)
**Objectif clinique :** permettre une compréhension instantanée de l’état du système.

- Toute information critique doit être compréhensible en moins de 3 secondes.
- Utilisation de polices larges, contrastées et non décoratives.
- Aucune animation ou décoration ne doit détourner l’attention des données vitales.

📌 *Justification ISO : réduction du risque d’erreur humaine liée à la lecture tardive ou incorrecte.*

---

### 🧠 Zéro Surcharge Cognitive
**Règle fondamentale : Un écran = une mission clinique.**

- Séparation stricte entre :
  - Données de surveillance temps réel
  - Paramétrage / configuration
- Utilisation de cartes (Cards) standardisées et réutilisables.
- Limitation volontaire du nombre d’éléments visibles simultanément.

📌 *Justification ISO : diminution de la charge mentale et prévention des erreurs d’usage.*

---

### ⚠️ Hiérarchisation Visuelle des Risques

L’interface doit refléter le niveau de danger réel.

Ordre d’affichage obligatoire :
1. **Alertes critiques** (toujours visibles, non masquables)
2. Avertissements
3. État normal

- Une alerte critique doit rompre l’harmonie visuelle (couleur, animation contrôlée).
- Aucune alerte critique ne peut être masquée par un filtre ou une action utilisateur.

📌 *Justification ISO : conformité aux exigences des systèmes d’alarme médicale.*

---

### 📱 Responsive Design Contextuel

L’interface doit s’adapter au contexte clinique :

- **PC mural (salle de contrôle)** :
  - Vue dense, multi-colonnes (≥ 4)
  - Supervision globale

- **Tablette (visite clinique)** :
  - Interface tactile
  - Boutons larges
  - 2 à 3 colonnes

- **Mobile (astreinte)** :
  - Vue empilée
  - Actions critiques uniquement

📌 *Les fonctions critiques doivent rester accessibles quel que soit le support.*

---

### 🕒 Traçabilité & Horodatage

- Chaque donnée affichée doit être horodatée.
- Formats autorisés :
  - `MAJ : HH:MM:SS`
  - `Dernière lecture : JJ/MM/AAAA HH:MM`
- L’identifiant de l’équipement (Device ID) doit être visible ou accessible.

📌 *Justification ISO : traçabilité complète des données et événements cliniques.*

---

## 2. Codes Couleurs Normalisés (Santé)

| État | Couleur Tailwind | Signification | Usage |
|---|---|---|---|
| **NORMAL** | `text-emerald-700` / `bg-emerald-100` | Fonctionnement sûr | Valeurs dans la norme |
| **ATTENTION** | `text-amber-700` / `bg-amber-100` | Pré-alarme | Valeurs proches seuil |
| **CRITIQUE** | `text-red-700` / `bg-red-100` | Danger immédiat | Dépassement seuil |
| **NEUTRE** | `text-blue-600` / `bg-blue-50` | Informatif | Statistiques |
| **INACTIF** | `text-gray-500` / `bg-gray-100` | Hors service | Appareil déconnecté |

📌 **Règle absolue** : la couleur ne doit jamais être l’unique vecteur d’information.
Chaque état critique doit être accompagné d’un **texte explicite et/ou icône**.

---

## 3. Implémentation Technique

### 🧩 Composants
- Utilisation exclusive de composants standardisés validés.
- Réutilisation prioritaire pour garantir cohérence et validation continue.

### 🌙 Dark Mode
- Support natif du mode sombre.
- Respect des contrastes WCAG AA en clair et sombre.

### 🖼️ Iconographie
- Bibliothèque unique : `lucide-react`.
- Toute icône critique doit être accompagnée d’un libellé texte.

---

## 4. Sécurité d’Usage & Prévention des Erreurs

- Confirmation obligatoire pour toute action critique.
- Désactivation des actions dangereuses hors contexte.
- Journalisation des actions critiques utilisateur.

📌 *Justification ISO : maîtrise du risque d’erreur humaine.*

---

## 5. Terminologie & Données Médicales

- Terminologie claire, non ambiguë.
- Pas d’abréviation non standardisée.
- Unité toujours affichée avec la valeur.

---

## 6. Mapping Normatif ISO (Synthèse Audit)

| Règle OncoRad | Norme ISO / IEC associée |
|---|---|
| Lisibilité immédiate | ISO 9241-110 |
| Zéro surcharge cognitive | IEC 62366-1 |
| Hiérarchisation des alertes | IEC 60601-1-8 |
| Réduction des risques | ISO 14971 |
| Traçabilité des données | ISO 13485 |
| Responsive contextuel | ISO 9241-210 |
| Accessibilité | ISO 9241-171 / WCAG |

---

## 7. Positionnement Réglementaire

Ce document contribue directement à :
- Dossier de conformité logicielle
- Analyse de risques (ISO 14971)
- Dossier CE logiciel médical (classe dépendante de l’usage)
- Validation par établissement hospitalier

---

**Statut : Document de référence – Obligatoire pour tout développement OncoRad**
