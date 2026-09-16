/**
 * Vercel fallback store is ephemeral — prefer Netlify Blobs for durable push.
 * This endpoint acknowledges subscription for compatibility.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    res.statusCode = 405
    return res.end(JSON.stringify({ error: 'POST only' }))
  }
  // Vercel serverless is stateless without KV — return ok so client doesn't fail.
  // Background push is designed primarily for Netlify scheduled functions + Blobs.
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  return res.end(
    JSON.stringify({
      ok: true,
      note: 'Push durable recommandé sur Netlify (Blobs + cron). Alertes locales actives côté app.',
    }),
  )
}
