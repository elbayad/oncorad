# 🖼️ Configuration du Logo

## 📍 Où placer votre logo

**1. Placez votre fichier `logo.png` dans le dossier :**
```
📁 E:\claude\clinique\public\
```

**2. Le fichier complet doit être accessible ici :**
```
📄 E:\claude\clinique\public\logo.png
```

## ✅ Ce qui a été fait

- ✅ Dossier `public/` créé à la racine du projet
- ✅ Page de login modifiée pour utiliser `/logo.png`
- ✅ Taille du logo ajustée (80x80px)

## 🚀 Utilisation

Une fois que vous avez placé `logo.png` dans le dossier `public/`, le logo s'affichera automatiquement sur la page de connexion.

### Afficher le logo :

Dans un projet Vite, les fichiers du dossier `public/` sont servis à la racine. Donc :
- Fichier physique : `public/logo.png`
- Chemin dans le code : `/logo.png`

## 🎨 Configuration actuelle

Le logo est configuré avec :
- **Taille** : 400x117 pixels (w-[400px] h-[117px])
- **Taille responsive** : S'adapte au contenu
- **Border** : Ombre portée (shadow-lg)
- **Alignement** : Centré

## 📝 Modifier la taille du logo

Si vous voulez ajuster la taille du logo, modifiez les classes Tailwind dans `src/pages/LoginPage.tsx` :

```tsx
// Logo plus petit (64x64)
<div className="inline-flex items-center justify-center w-16 h-16 mb-4 shadow-lg">

// Logo moyen (80x80) - ACTUEL
<div className="inline-flex items-center justify-center w-20 h-20 mb-4 shadow-lg">

// Logo plus grand (96x96)
<div className="inline-flex items-center justify-center w-24 h-24 mb-4 shadow-lg">
```

## 🔄 Structure du projet

```
E:\claude\clinique\
├── public\              ← Dossier pour fichiers statiques
│   └── logo.png        ← Placez votre logo ici
├── src\
│   ├── pages\
│   │   └── LoginPage.tsx  ← Page modifiée
│   └── ...
└── package.json
```

## ⚡ Test

1. Placez `logo.png` dans `public/logo.png`
2. Relancez le serveur de développement
3. Ouvrez http://localhost:5175
4. Le logo ONCORAD GROUP s'affichera sur la page de connexion

## 💡 Note

Les fichiers dans `public/` sont copiés tels quels lors du build final, donc votre logo sera inclus dans la version de production.

