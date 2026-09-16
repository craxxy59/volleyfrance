# Publier VolleyFrance (Vercel **et** Netlify)

GitHub = code. Pour un lien public, déploie sur **Vercel** et/ou **Netlify**.  
Les deux sont préconfigurés (proxy API inclus).

---

## A. Vercel (déjà en place)

1. [vercel.com](https://vercel.com) → login GitHub  
2. **Add New Project** → ton repo  
3. Deploy (framework Vite, output `dist`)  
4. URL : `https://….vercel.app`

Fichiers : `vercel.json` + `api/ffvb/[...path].js` + `api/ffvolley/[...path].js`

Test :
```text
https://TON-APP.vercel.app/ffvb-api/stats
https://TON-APP.vercel.app/ffvolley-api/v3/clubs
```

---

## B. Netlify (nouveau)

### 1. Push le code
```bash
git add netlify.toml netlify/ api/ vercel.json src/ DEPLOY.md
git commit -m "Netlify functions + club teams matching"
git push origin main
```

### 2. Connecte le repo
1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Choisis GitHub → ton repo
3. Réglages (détectés via `netlify.toml`) :
   - Build command : `npm run build`
   - Publish directory : `dist`
   - Functions directory : `netlify/functions`
4. **Deploy site**

### 3. URL publique
```text
https://random-name.netlify.app
```
Tu peux la renommer : Site settings → Domain management.

### 4. Vérifie les APIs
```text
https://TON-SITE.netlify.app/ffvb-api/stats
https://TON-SITE.netlify.app/ffvolley-api/v3/clubs
```
→ JSON attendu (pas une 404 HTML).

### Fichiers Netlify
| Fichier | Rôle |
|---------|------|
| `netlify.toml` | build + redirects `/ffvb-api/*` et `/ffvolley-api/*` |
| `netlify/functions/ffvb.mjs` | bridge résultats FFVB |
| `netlify/functions/ffvolley.mjs` | bridge clubs / livescore |

---

## C. GitHub Pages
**Non recommandé** : pas de fonctions serverless → les appels API cassent.

---

## Après deploy
- Partage l’URL Vercel **ou** Netlify  
- Sur mobile : *Ajouter à l’écran d’accueil* (PWA)  
- Chaque `git push` sur `main` redéploie (si auto-deploy activé)

## Dépannage Netlify
| Problème | Fix |
|----------|-----|
| Function 404 | Vérifie que `netlify/functions/*.mjs` est bien pushé |
| `/ffvb-api/stats` HTML 404 | `netlify.toml` redirects `force = true` présents ? |
| Build fail | Regarde le log ; `NODE_VERSION=20` est déjà set |
| Cold start lent | 1er appel function ~1–2 s, normal en free tier |
