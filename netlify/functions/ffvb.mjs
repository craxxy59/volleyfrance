/**
 * Netlify function for /ffvb-api/* (redirect rewrite)
 * → https://volley-ball.vercel.app/api/*
 */
const UPSTREAM = 'https://volley-ball.vercel.app/api'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
        statusCode: res.status,
        body,
        contentType: res.headers.get('content-type') || 'application/json',
      }
    } catch (e) {
      lastErr = e
      if (i < retries) await sleep(300 * (i + 1))
    }
  }
  throw lastErr || new Error('upstream failed')
}

function extractSubpath(event) {
  const rawPath = event.path || ''
  // Common rewrite shapes
  if (rawPath.includes('/ffvb-api/')) {
    return rawPath.split('/ffvb-api/')[1] || ''
  }
  const fn = '/.netlify/functions/ffvb'
  if (rawPath.includes(fn)) {
    let rest = rawPath.split(fn)[1] || ''
    if (rest.startsWith('/')) rest = rest.slice(1)
    return rest
  }
  // query fallback
  const qp = event.queryStringParameters || {}
  if (qp.path) return qp.path
  // rawUrl
  try {
    const u = new URL(event.rawUrl || '', 'http://localhost')
    if (u.pathname.includes('/ffvb-api/')) {
      return u.pathname.split('/ffvb-api/')[1] || ''
    }
  } catch {
    /* ignore */
  }
  return ''
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
      },
    }
  }

  try {
    const sub = extractSubpath(event)
    // Rebuild query without helper keys
    const params = new URLSearchParams()
    const qp = event.queryStringParameters || {}
    for (const [k, v] of Object.entries(qp)) {
      if (k === 'path') continue
      if (v != null) params.set(k, v)
    }
    // multi-value
    const multi = event.multiValueQueryStringParameters || {}
    for (const [k, arr] of Object.entries(multi)) {
      if (k === 'path') continue
      ;(arr || []).forEach((v) => params.append(k, v))
    }
    // Prefer rawQuery if present and clean
    let qs = ''
    if (event.rawQuery) {
      const raw = new URLSearchParams(event.rawQuery)
      raw.delete('path')
      const s = raw.toString()
      qs = s ? `?${s}` : ''
    } else {
      const s = params.toString()
      qs = s ? `?${s}` : ''
    }

    const target = `${UPSTREAM}/${sub}${qs}`
    const result = await fetchUpstream(target)
    return {
      statusCode: result.statusCode,
      headers: {
        'Content-Type': result.contentType.includes('json')
          ? 'application/json; charset=utf-8'
          : result.contentType,
        'Cache-Control': 'public, max-age=30',
        'Access-Control-Allow-Origin': '*',
        'X-VF-Upstream': target.replace('https://', ''),
      },
      body: result.body,
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'API résultats indisponible',
        detail: String(err?.message || err),
      }),
    }
  }
}
