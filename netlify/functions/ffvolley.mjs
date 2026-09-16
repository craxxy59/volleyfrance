/**
 * Netlify function for /ffvolley-api/*
 * → https://api.my.ffvolley.org/*
 */
const UPSTREAM = 'https://api.my.ffvolley.org'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchUpstream(url, retries = 3) {
  let lastErr
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'VolleyFrance/1.0' },
      })
      const body = await res.text()
      if (
        (res.status >= 500 || (res.status === 404 && /NOT_FOUND/i.test(body))) &&
        i < retries
      ) {
        await sleep(300 * (i + 1))
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
  if (rawPath.includes('/ffvolley-api/')) {
    return rawPath.split('/ffvolley-api/')[1] || ''
  }
  const fn = '/.netlify/functions/ffvolley'
  if (rawPath.includes(fn)) {
    let rest = rawPath.split(fn)[1] || ''
    if (rest.startsWith('/')) rest = rest.slice(1)
    return rest
  }
  const qp = event.queryStringParameters || {}
  if (qp.path) return qp.path
  try {
    const u = new URL(event.rawUrl || '', 'http://localhost')
    if (u.pathname.includes('/ffvolley-api/')) {
      return u.pathname.split('/ffvolley-api/')[1] || ''
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
    let qs = ''
    if (event.rawQuery) {
      const raw = new URLSearchParams(event.rawQuery)
      raw.delete('path')
      const s = raw.toString()
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
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*',
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
        error: 'API FFVolley indisponible',
        detail: String(err?.message || err),
      }),
    }
  }
}
