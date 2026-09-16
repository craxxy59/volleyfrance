import { cors, getSubsStore, json, subKey } from './_shared.mjs'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors() }
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'POST only' })
  }
  try {
    const body = JSON.parse(event.body || '{}')
    const endpoint = body.endpoint
    if (!endpoint) return json(400, { error: 'endpoint required' })
    const store = await getSubsStore()
    const key = subKey(endpoint)
    await store.delete(key)
    const index = (await store.get('__index', { type: 'json' }).catch(() => null)) || { keys: [] }
    index.keys = (index.keys || []).filter((k) => k !== key)
    await store.setJSON('__index', index)
    return json(200, { ok: true })
  } catch (err) {
    return json(500, { error: String(err?.message || err) })
  }
}
