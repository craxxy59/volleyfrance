/**
 * VolleyFrance — Vite (dev) or static (prod) + same-origin API bridge.
 * We don't reverse-proxy blindly: we fetch upstream with retries + short cache
 * so intermittent Vercel 404 / cold starts don't break the UI.
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

const FFVB_UPSTREAM = 'https://volley-ball.vercel.app/api'
const FFVOLLEY_UPSTREAM = 'https://api.my.ffvolley.org'

/** @type {Map<string, { exp: number, status: number, body: string, ctype: string }>} */
const cache = new Map()
const INFLIGHT = new Map()

function cacheKey(url) {
  return url
}

function getCached(key) {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() > hit.exp) {
    cache.delete(key)
    return null
  }
  return hit
}

function setCache(key, status, body, ctype, ttlMs) {
  // Don't cache errors for long
  const ttl = status >= 200 && status < 300 ? ttlMs : Math.min(ttlMs, 8_000)
  if (status >= 500) return // don't cache hard failures
  cache.set(key, { exp: Date.now() + ttl, status, body, ctype })
  // Bound cache size
  if (cache.size > 200) {
    const first = cache.keys().next().value
    cache.delete(first)
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Fetch upstream with retries. Treat HTML / Vercel NOT_FOUND JSON as retryable.
 */
async function fetchUpstream(url, { retries = 3, timeoutMs = 20_000 } = {}) {
  let lastErr = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'VolleyFrance/1.0',
        },
      })
      const ctype = res.headers.get('content-type') || 'application/json'
      const body = await res.text()

      // Vercel platform 404 (cold route / miss)
      const isVercelNotFound =
        res.status === 404 &&
        (/NOT_FOUND/i.test(body) || /page could not be found/i.test(body))

      // HTML error page instead of JSON
      const looksHtml = /^\s*</.test(body) || /text\/html/i.test(ctype)

      if ((isVercelNotFound || (res.status >= 500) || looksHtml) && attempt < retries) {
        lastErr = new Error(`upstream ${res.status} attempt ${attempt + 1}`)
        clearTimeout(t)
        await sleep(250 * (attempt + 1) + Math.random() * 200)
        continue
      }

      clearTimeout(t)
      return { status: res.status, body, ctype }
    } catch (err) {
      clearTimeout(t)
      lastErr = err
      if (attempt < retries) {
        await sleep(300 * (attempt + 1))
        continue
      }
    }
  }
  throw lastErr || new Error('upstream failed')
}

/** Deduplicate parallel identical requests */
async function fetchDeduped(url, opts) {
  const key = cacheKey(url)
  const cached = getCached(key)
  if (cached) return cached

  if (INFLIGHT.has(key)) return INFLIGHT.get(key)

  const p = (async () => {
    try {
      const result = await fetchUpstream(url, opts)
      // TTL: stats short, big lists medium
      const ttl =
        /\/matches/.test(url) ? 45_000 :
        /\/clubs|livescore/.test(url) ? 120_000 :
        /\/stats|\/entities|\/poules/.test(url) ? 90_000 :
        60_000
      setCache(key, result.status, result.body, result.ctype, ttl)
      return result
    } finally {
      INFLIGHT.delete(key)
    }
  })()

  INFLIGHT.set(key, p)
  return p
}

function sendUpstream(res, result) {
  res.status(result.status)
  res.setHeader('Content-Type', result.ctype.includes('json') ? 'application/json; charset=utf-8' : result.ctype)
  res.setHeader('X-VolleyFrance-Cache', getCached(cacheKey('x')) ? 'hit' : 'miss')
  res.setHeader('Cache-Control', 'public, max-age=15')
  res.send(result.body)
}

async function main() {
  const app = express()

  // Don't let stale connections hang forever
  app.use((req, res, next) => {
    res.setHeader('X-VolleyFrance', '1')
    next()
  })

  app.get('/__health', (_req, res) => {
    res.json({
      ok: true,
      service: 'volleyfrance-bridge',
      cacheEntries: cache.size,
      upstream: { ffvb: FFVB_UPSTREAM, ffvolley: FFVOLLEY_UPSTREAM },
    })
  })

  // ─── FFVB results bridge: /ffvb-api/* → volley-ball.vercel.app/api/* ───
  app.use('/ffvb-api', async (req, res) => {
    try {
      // req.url includes query string, path relative to mount
      const suffix = req.url || '/'
      const target = `${FFVB_UPSTREAM}${suffix.startsWith('/') ? suffix : `/${suffix}`}`
      const result = await fetchDeduped(target, { retries: 4, timeoutMs: 25_000 })

      res.status(result.status)
      res.setHeader(
        'Content-Type',
        result.ctype.includes('json') ? 'application/json; charset=utf-8' : result.ctype,
      )
      res.setHeader('Cache-Control', 'no-store')
      // Help debug intermittent issues
      res.setHeader('X-VF-Upstream', target.replace('https://', ''))
      res.send(result.body)
    } catch (err) {
      console.error('[ffvb-api]', req.url, err?.message || err)
      res.status(502).json({
        error: 'API résultats indisponible',
        detail: String(err?.message || err),
        path: req.url,
      })
    }
  })

  // ─── FFVolley official: prefer bridge with cache for heavy endpoints ───
  // clubs + livescore list are large — cache them
  app.get('/ffvolley-api/v3/clubs', async (_req, res) => {
    try {
      const result = await fetchDeduped(`${FFVOLLEY_UPSTREAM}/v3/clubs`, {
        retries: 3,
        timeoutMs: 60_000,
      })
      res.status(result.status)
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'public, max-age=60')
      res.send(result.body)
    } catch (err) {
      console.error('[clubs]', err?.message || err)
      res.status(502).json({ error: 'Clubs indisponibles', detail: String(err?.message || err) })
    }
  })

  app.get('/ffvolley-api/v3/livescore/matches', async (_req, res) => {
    try {
      const result = await fetchDeduped(`${FFVOLLEY_UPSTREAM}/v3/livescore/matches`, {
        retries: 2,
        timeoutMs: 60_000,
      })
      res.status(result.status)
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'public, max-age=30')
      res.send(result.body)
    } catch (err) {
      console.error('[livescore]', err?.message || err)
      res.status(502).json({ error: 'Livescore indisponible', detail: String(err?.message || err) })
    }
  })

  // Remaining FFVolley paths (match detail, events…) via classic proxy
  app.use(
    '/ffvolley-api',
    createProxyMiddleware({
      target: FFVOLLEY_UPSTREAM,
      changeOrigin: true,
      secure: true,
      // Express strips /ffvolley-api → path is /v3/...
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
    app.use(express.static(dist, { index: false, maxAge: '1h' }))
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
        // Prevent Vite from swallowing /ffvb-api if something reorders middleware
        hmr: { server: undefined },
      },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`\n🏐 VolleyFrance ready → http://${HOST}:${PORT}`)
    console.log(`   Bridge: /ffvb-api/*  → ${FFVB_UPSTREAM}/*  (retry + cache)`)
    console.log(`           /ffvolley-api/* → ${FFVOLLEY_UPSTREAM}/*\n`)
  })

  server.keepAliveTimeout = 65_000
  server.headersTimeout = 70_000
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
