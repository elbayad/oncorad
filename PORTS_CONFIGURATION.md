# 🔌 Configuration des Ports

## 📋 Ports configurés

### Développement local
- **Frontend (Vite)** : `5175`
- **Backend (Express)** : `3001`

### Production
- **Backend (Express)** : `8789`
- **Reverse Proxy (Traefik)** : `80` (HTTP) et `443` (HTTPS)

---

## 🔧 Fichiers modifiés

### 1. `vite.config.ts`
```typescript
port: parseInt(env.PORT) || 5175  // Frontend port
```

### 2. `ecosystem.config.cjs`
```javascript
env: {
  NODE_ENV: 'production',
  PORT: 8789,  // Backend port en production
}
```

### 3. `README.md`
- Frontend : http://localhost:5175
- Backend : http://localhost:3001

### 4. `server/config.example.env`
```env
CORS_ORIGIN=http://localhost:5175
```

### 5. Documentation
- `DATABASE_MIGRATION.md` : Port 5175
- `LOGO_SETUP.md` : Port 5175

---

## 🚀 Utilisation

### Développement local

```bash
# Frontend sur port 5175
npm run dev

# Backend sur port 3001
npm run server:dev
```

### Production

```bash
# Backend sur port 8789
npm run pm2:start

# Accessible via Traefik sur HTTPS
https://oncorad.ishubai.online
```

---

## ✅ Vérification

Tous les ports ont été mis à jour :
- ✅ Frontend : 5173 → 5175
- ✅ Backend : 8787 → 8789 (production)
- ✅ Documentation : mis à jour partout

La configuration est maintenant cohérente ! 🎉

