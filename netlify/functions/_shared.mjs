import webpush from 'web-push'
import { getStore } from '@netlify/blobs'

export const UPSTREAM_FFVB = 'https://volley-ball.vercel.app/api'

export function getVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || ''
  const privateKey = process.env.VAPID_PRIVATE_KEY || ''
  const subject = process.env.VAPID_SUBJECT || 'mailto:volleyfrance@example.com'
  return { publicKey, privateKey, subject }
}

export function configureWebPush() {
  const { publicKey, privateKey, subject } = getVapid()
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

export async function getSubsStore() {
  // Site-scoped blob store (requires Blobs on Netlify — enabled by default on modern sites)
  return getStore({ name: 'vf-push-subs', consistency: 'strong' })
}

export function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    ...extra,
  }
}

export function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(), ...headers },
    body: JSON.stringify(body),
  }
}

export async function fetchJson(url, retries = 3) {
  let lastErr
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'VolleyFrance-Notify/1.0' },
      })
      const text = await res.text()
      if (
        (res.status === 404 && /NOT_FOUND|page could not be found/i.test(text)) ||
        res.status >= 500
      ) {
        if (i < retries) {
          await new Promise((r) => setTimeout(r, 250 * (i + 1)))
          continue
        }
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return JSON.parse(text)
    } catch (e) {
      lastErr = e
      if (i < retries) await new Promise((r) => setTimeout(r, 300 * (i + 1)))
    }
  }
  throw lastErr
}

export function subKey(endpoint) {
  // safe blob key
  let h = 0
  for (let i = 0; i < endpoint.length; i++) h = (Math.imul(31, h) + endpoint.charCodeAt(i)) | 0
  return `sub_${Math.abs(h).toString(36)}_${endpoint.length}`
}

export { webpush }
