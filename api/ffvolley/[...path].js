/**
 * Catch-all: /api/ffvolley/*  (and rewritten /ffvolley-api/*)
 * → https://api.my.ffvolley.org/*
 */
const UPSTREAM = 'https://api.my.ffvolley.org'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchUpstream(url, retries = 3) {
  let lastErr
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'VolleyFrance/1.0' },
      })
      const body = await res.text()
      if (
        ((res.status >= 500) || (res.status === 404 && /NOT_FOUND/i.test(body))) &&
        i < retries
      ) {
        await sleep(300 * (i + 1))
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
    // Don't encode slashes already split — path segments only
    const sub = parts.map((p) => String(p).split('/').map(encodeURIComponent).join('/')).join('/')
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(req.query)) {
      if (k === 'path') continue
      if (Array.isArray(v)) v.forEach((x) => q.append(k, x))
      else if (v != null) q.set(k, String(v))
    }
    const qs = q.toString()
    const target = `${UPSTREAM}/${sub}${qs ? `?${qs}` : ''}`

    const result = await fetchUpstream(target)
    res.statusCode = result.status
    res.setHeader(
      'Content-Type',
      result.ctype.includes('json') ? 'application/json; charset=utf-8' : result.ctype,
    )
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return res.end(result.body)
  } catch (err) {
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({
        error: 'API FFVolley indisponible',
        detail: String(err?.message || err),
      }),
    )
  }
}
