# 🎨 Charte Graphique - ONCORAD GROUP

## 📋 Vue d'ensemble

La charte graphique a été améliorée pour s'harmoniser avec le logo ONCORAD GROUP, en utilisant les couleurs **bleu vif** et **jaune-vert** présentes dans le logo.

## 🎨 Palette de couleurs

### Couleurs principales (inspirées du logo)
- **Bleu vif** : `#0080FF` (bleu des pétales)
- **Jaune-vert citron** : `#BFFC00` (couleur du pétale en haut à gauche)

### Couleurs de l'interface

#### Mode clair
- **Fond principal** : Dégradé subtil de blanc à gris pâle puis bleu clair
  - `from-white via-gray-50 to-blue-50`
- **Cartes** : Blanc avec transparence (90%)
- **Bordures** : Gris clair (`border-gray-200`)
- **Texte** : Gris foncé (`text-gray-700`)

#### Mode sombre
- **Fond principal** : Dégradé de noir profond à gris foncé
  - `from-gray-950 via-gray-900 to-gray-800`
- **Cartes** : Gris très foncé avec transparence
- **Bordures** : Gris foncé (`border-gray-800`)
- **Texte** : Gris clair (`text-gray-300`)

## 🖼️ Logo

### Dimensions
- **Largeur** : 400px
- **Hauteur** : 117px (ratio adapté au logo ONCORAD)

### Style
- Ombre portée subtile (`drop-shadow-lg`)
- Pas de conteneur avec couleur de fond
- Affichage direct sur le fond

## 📐 Composants

### Formulaire de connexion

#### Conteneur
- Fond : Blanc à 90% de transparence (mode clair) / Gris à 90% (mode sombre)
- Border-radius : `rounded-2xl` (16px)
- Ombres : `shadow-2xl` (ombre prononcée)
- Padding : `p-8` (32px)
- Bordure : 1px gris clair/foncé

#### Champs de saisie
- Border : 2px (`border-2`)
- Border-radius : `rounded-xl` (12px)
- Padding : `px-4 py-3`
- Focus ring : Bleu 600 (`focus:ring-blue-600`)
- Transition : `transition-all duration-200`

#### Bouton "Se connecter"
- Fond : Dégradé bleu (`from-blue-600 to-blue-700`)
- Hover : `from-blue-700 to-blue-800`
- Border-radius : `rounded-xl`
- Font : `font-semibold`
- Ombre : `shadow-lg`

### Section comptes démo
- Fond : `bg-gray-50` (clair) / `bg-gray-900/60` (sombre)
- Border : `border-gray-200` / `border-gray-800`
- Border-radius : `rounded-xl`
- Padding : `p-5`
- Ombre : `shadow-lg`

## 📱 Responsive

Tous les composants sont responsive :
- Le logo s'adapte automatiquement (max 400px)
- Les champs de saisie sont pleine largeur
- Le formulaire s'adapte aux petits écrans

## 🌗 Mode sombre/clair

La page supporte les deux modes avec une transition fluide :
- Bouton toggle en haut à droite
- Changement de couleurs automatique
- Transitions de 200ms pour un effet fluide

## ✨ Animations

- Transitions : `duration-200` (0.2s)
- Hover effects sur les boutons
- Focus ring sur les inputs
- Spinner lors du chargement

## 🎯 Principe de design

1. **Simplicité** : Interface épurée et moderne
2. **Cohérence** : Utilisation cohérente des couleurs du logo
3. **Lisibilité** : Contraste élevé pour une excellente lisibilité
4. **Modernité** : Effets de transparence (backdrop-blur)
5. **Professionnalisme** : Design sobre et élégant

## 🔄 Changements apportés

### Avant
- Fond : Bleu-violet dégradé
- Logo : Icône avec gradient bleu-violet
- Bouton : Gradient bleu-violet
- Style général : Plus coloré

### Après (Compatible ONCORAD)
- Fond : Blanc-gris-bleu pâle (plus professionnel)
- Logo : Logo ONCORAD original
- Bouton : Bleu uni (cohérent avec le logo)
- Style général : Plus sobre et professionnel
- Bordures : Plus prononcées (border-2)
- Arrondis : Plus marqués (rounded-xl au lieu de rounded-lg)
- Ombres : Plus prononcées

## 📝 Utilisation

Cette charte s'applique à :
- Page de login (`LoginPage.tsx`)
- Future extension possible sur d'autres pages
- Thème global de l'application

## 🎨 Classes Tailwind utilisées

### Fond
```css
bg-gradient-to-br from-white via-gray-50 to-blue-50
```

### Logo
```css
w-[400px] h-[117px]
drop-shadow-lg
```

### Formulaire
```css
bg-white/90 dark:bg-gray-900/90
backdrop-blur-md
rounded-2xl
shadow-2xl
```

### Inputs
```css
px-4 py-3
border-2
rounded-xl
focus:ring-blue-600
```

### Bouton
```css
bg-gradient-to-r from-blue-600 to-blue-700
rounded-xl
font-semibold
shadow-lg
```

