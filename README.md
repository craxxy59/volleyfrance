# VolleyFrance

PWA dark-sport pour suivre le **volley français** : clubs FFVolley, compétitions nationales / régionales / départementales, scores, poules, classements, suivi d’équipes.

## Stack

- React + TypeScript + Vite + PWA
- Données live :
  - `api.my.ffvolley.org` — clubs & livescore
  - agrégat résultats FFVB — poules / scores / classements
- Proxy same-origin obligatoire (CORS) :
  - **Local** : `server.mjs` (`npm run dev`)
  - **Prod** : fonctions Vercel dans `api/` + `vercel.json`

## Dev local

```bash
npm install
npm run dev
```

→ http://localhost:5173  

- `/ffvb-api/*` → résultats  
- `/ffvolley-api/*` → clubs / live  

## Build

```bash
npm run build
npm start          # sert dist/ + proxies (Node)
```

## Publier pour tous les utilisateurs

Voir **[DEPLOY.md](./DEPLOY.md)** — en résumé :

**Vercel** *ou* **Netlify** (les deux sont configurés) :

1. Push le repo sur GitHub  
2. Importe sur [vercel.com](https://vercel.com) **et/ou** [netlify.com](https://app.netlify.com)  
3. Deploy → URL publique  
4. Partage le lien  

- Vercel : `vercel.json` + `api/`  
- Netlify : `netlify.toml` + `netlify/functions/`  

## Features

- Accueil stats + raccourcis HDF  
- Compétitions nationales & 18 ligues régionales  
- Filtres **À venir / En cours / Passés**  
- Fiche détail match (sets, arbitres, compos live)  
- Suivre une équipe + page équipe  
- Annuaire ~700 clubs  
- PWA installable  
