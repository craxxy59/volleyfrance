# VolleyFrance

PWA dark-sport pour suivre le **volley français** : clubs FFVolley, compétitions nationales / régionales / départementales, scores, poules et classements.

## Stack

- React + TypeScript + Vite
- PWA (vite-plugin-pwa)
- Données live :
  - `api.my.ffvolley.org` — clubs & livescore
  - `volley-ball.vercel.app/api` — résultats / poules / classements (agrégat FFVB saison)

## Dev

```bash
npm install
npm run dev
```

L’app écoute sur `0.0.0.0:5173` via `server.mjs` (Vite + proxies same-origin) :

- `/ffvb-api/*` → `https://volley-ball.vercel.app/api/*`
- `/ffvolley-api/*` → `https://api.my.ffvolley.org/*`

> Les APIs externes n’envoient pas de CORS ouverts : le proxy same-origin est **obligatoire**.

```bash
npm run build && npm start   # prod locale
```


## Features

- Accueil avec stats saison + raccourcis HDF
- Compétitions nationales (Élite, N2, N3) groupées
- Ligues régionales (18) + poules + matchs + classements
- Filtres Féminin / Masculin
- Annuaire ~700 clubs (dept, pratiques, contact)
- Favoris équipes / clubs / poules (localStorage)
- Installable en PWA
