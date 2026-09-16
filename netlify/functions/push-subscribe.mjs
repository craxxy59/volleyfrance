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
    const subscription = body.subscription
    if (!subscription?.endpoint) {
      return json(400, { error: 'subscription.endpoint required' })
    }

    const teams = Array.isArray(body.teams)
      ? body.teams.map((t) => String(t).trim()).filter(Boolean).slice(0, 30)
      : []
    const prefs = {
      onFinished: body.prefs?.onFinished !== false,
      onUpcoming: body.prefs?.onUpcoming !== false,
      upcomingMinutes: Number(body.prefs?.upcomingMinutes) || 60,
    }

    const store = await getSubsStore()
    const key = subKey(subscription.endpoint)
    const existing = (await store.get(key, { type: 'json' }).catch(() => null)) || {}

    const record = {
      subscription,
      teams,
      prefs,
      updatedAt: new Date().toISOString(),
      seen: existing.seen && typeof existing.seen === 'object' ? existing.seen : {},
    }
    await store.setJSON(key, record)

    // index of keys
    const index = (await store.get('__index', { type: 'json' }).catch(() => null)) || { keys: [] }
    if (!index.keys.includes(key)) {
      index.keys = [...index.keys, key].slice(-2000)
      await store.setJSON('__index', index)
    }

    return json(200, { ok: true, teams: teams.length })
  } catch (err) {
    return json(500, { error: String(err?.message || err) })
  }
}
