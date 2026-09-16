/**
 * Dev / preview server with same-origin API proxies.
 * Express strips the mount prefix, so incoming path is already "/stats"
 * when mounted at "/ffvb-api" — we must prepend "/api".
 */
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { createServer as createViteServer } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 5173)
const HOST = process.env.HOST || '0.0.0.0'
const isProd = process.env.NODE_ENV === 'production'

async function main() {
  const app = express()

  app.get('/__health', (_req, res) => {
    res.json({ ok: true, service: 'volleyfrance-proxy' })
  })

  // /ffvb-api/stats  →  https://volley-ball.vercel.app/api/stats
  app.use(
    '/ffvb-api',
    createProxyMiddleware({
      target: 'https://volley-ball.vercel.app',
      changeOrigin: true,
      secure: true,
      // Express already stripped "/ffvb-api", path is e.g. "/stats"
      pathRewrite: (p) => `/api${p.startsWith('/') ? p : `/${p}`}`,
      on: {
        proxyReq(proxyReq) {
          proxyReq.setHeader('Accept', 'application/json')
        },
        error(err, _req, res) {
          console.error('[ffvb-api]', err.message)
          if (res && !res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Proxy FFVB indisponible', detail: err.message }))
          }
        },
      },
    }),
  )

  // /ffvolley-api/v3/clubs  →  https://api.my.ffvolley.org/v3/clubs
  app.use(
    '/ffvolley-api',
    createProxyMiddleware({
      target: 'https://api.my.ffvolley.org',
      changeOrigin: true,
      secure: true,
      // path already stripped to /v3/clubs — keep as-is
      on: {
        error(err, _req, res) {
          console.error('[ffvolley-api]', err.message)
          if (res && !res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Proxy FFVolley indisponible', detail: err.message }))
          }
        },
      },
    }),
  )

  if (isProd) {
    const dist = path.join(__dirname, 'dist')
    if (!fs.existsSync(dist)) {
      console.error('dist/ missing — run npm run build first')
      process.exit(1)
    }
    app.use(express.static(dist))
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith('/ffvb-api') || req.path.startsWith('/ffvolley-api')) return next()
      res.sendFile(path.join(dist, 'index.html'))
    })
  } else {
    const vite = await createViteServer({
      root: __dirname,
      server: {
        middlewareMode: true,
        allowedHosts: true,
        host: HOST,
      },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  }

  app.listen(PORT, HOST, () => {
    console.log(`\n🏐 VolleyFrance ready → http://${HOST}:${PORT}`)
    console.log(`   Proxies: /ffvb-api → volley-ball.vercel.app/api`)
    console.log(`            /ffvolley-api → api.my.ffvolley.org\n`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
