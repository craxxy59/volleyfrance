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
https://TON-APP.vercel.app/ffvb-api/departments?ligue=LIFL
https://TON-APP.vercel.app/ffvb-api/poules?codent=PTFL59
```

> Les compétitions **départementales** (codent `PT…`, ex. Nord `PTFL59`) sont scrapées en direct depuis le site officiel `ffvbbeach.org` (fichier `shared/ffvbDept.mjs`).
---

## B. Netlify (recommandé pour Android + notifications)

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
https://TON-SITE.netlify.app/ffvb-api/departments?ligue=LIFL
https://TON-SITE.netlify.app/ffvb-api/poules?codent=PTFL59
```
→ JSON attendu (pas une 404 HTML).

Les **départementales** passent par la même function `ffvb` + scrape `shared/ffvbDept.mjs` (site officiel FFVB).
### 5. Notifications Android (Web Push)
Génère des clés VAPID (une fois) :

```bash
npx web-push generate-vapid-keys
```

Dans Netlify → **Site configuration → Environment variables**, ajoute :

| Variable | Valeur |
|----------|--------|
| `VAPID_PUBLIC_KEY` | clé publique |
| `VAPID_PRIVATE_KEY` | clé privée |
| `VAPID_SUBJECT` | `mailto:ton@email.fr` |

Redéploie le site.

Le cron `push-dispatch` tourne **toutes les 10 min** (`netlify.toml`) et envoie une notif quand une équipe suivie a un **nouveau résultat**.

Sur le téléphone :
1. Chrome → ouvrir le site Netlify  
2. **Installer l’app** (Ajouter à l’écran d’accueil)  
3. Dans l’app : **Suivi → Activer les notifications**  
4. Autoriser Chrome / Android  

### Fichiers Netlify
| Fichier | Rôle |
|---------|------|
| `netlify.toml` | build + redirects + cron push |
| `netlify/functions/ffvb.mjs` | bridge résultats FFVB |
| `netlify/functions/ffvolley.mjs` | bridge clubs / livescore |
| `netlify/functions/push-*.mjs` | subscribe / dispatch Web Push |
| `netlify/functions/vapid-public-key.mjs` | expose la clé publique |

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
