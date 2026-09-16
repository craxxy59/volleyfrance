/**
 * Catch-all: /api/ffvb/*  (and rewritten /ffvb-api/*)
 * → départements : scrape ffvbbeach.org
 * → sinon : https://volley-ball.vercel.app/api/*
 */
import { handleDeptApi } from '../../../shared/ffvbDept.mjs'

const UPSTREAM = 'https://volley-ball.vercel.app/api'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchUpstream(url, retries = 4) {
  let lastErr
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'VolleyFrance/1.0' },
      })
      const body = await res.text()
      const bad =
        (res.status === 404 && /NOT_FOUND|page could not be found/i.test(body)) ||
        res.status >= 500 ||
        /^\s*</.test(body)

      if (bad && i < retries) {
        lastErr = new Error(`upstream ${res.status}`)
        await sleep(250 * (i + 1))
        continue
      }
      return {
        status: res.status,
        body,
        ctype: res.headers.get('content-type') || 'application/json',
      }
    } catch (e) {
      lastErr = e
      if (i < retries) await sleep(300 * (i + 1))
    }
  }
  throw lastErr || new Error('upstream failed')
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const parts = [].concat(req.query.path || [])
    const sub = parts.map((p) => String(p).split('/').map(encodeURIComponent).join('/')).join('/')
    const q = {}
    for (const [k, v] of Object.entries(req.query)) {
      if (k === 'path') continue
      if (Array.isArray(v)) q[k] = v[0]
      else if (v != null) q[k] = String(v)
    }

    const dept = await handleDeptApi(sub, q)
    if (dept) {
      res.statusCode = dept.status
      res.setHeader('Content-Type', dept.ctype)
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
      res.setHeader('X-VF-Source', 'ffvbbeach-dept')
      return res.end(dept.body)
    }

    const qsObj = new URLSearchParams()
    for (const [k, v] of Object.entries(q)) qsObj.set(k, v)
    const qs = qsObj.toString()
    const target = `${UPSTREAM}/${sub}${qs ? `?${qs}` : ''}`

    const result = await fetchUpstream(target)
    res.statusCode = result.status
    res.setHeader(
      'Content-Type',
      result.ctype.includes('json') ? 'application/json; charset=utf-8' : result.ctype,
    )
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120')
    res.setHeader('X-VF-Upstream', target.replace('https://', ''))
    return res.end(result.body)
  } catch (err) {
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({
        error: 'API résultats indisponible',
        detail: String(err?.message || err),
      }),
    )
  }
}
