/**
 * Scheduled / manual dispatcher:
 * - loads push subscriptions
 * - checks followed teams for newly finished matches
 * - sends web-push to Android devices
 *
 * Trigger: Netlify scheduled function every 10 minutes
 * or POST /.netlify/functions/push-dispatch
 */
import {
  UPSTREAM_FFVB,
  configureWebPush,
  cors,
  fetchJson,
  getSubsStore,
  json,
  webpush,
} from './_shared.mjs'

function fingerprint(m) {
  return `${m.status}:${m.score_home ?? 'x'}:${m.score_away ?? 'x'}`
}

function isPast(status) {
  const s = String(status || '').toLowerCase()
  return ['completed', 'finished', 'played', 'ended', 'forfeit'].includes(s)
}

function isUpcoming(status) {
  const s = String(status || '').toLowerCase()
  return ['scheduled', 'prematch', 'upcoming', 'not_started', 'ns'].includes(s)
}

function parseKickoff(m) {
  const d = String(m.date || '').match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (!d) return null
  const time = String(m.time || '12:00').padStart(5, '0')
  const dt = new Date(`20${d[3]}-${d[2]}-${d[1]}T${time}:00`)
  return Number.isNaN(dt.getTime()) ? null : dt
}

async function matchesForTeam(team) {
  const q = encodeURIComponent(team)
  const [nat, reg] = await Promise.all([
    fetchJson(`${UPSTREAM_FFVB}/nationals/matches?team=${q}&limit=20`).catch(() => ({
      matches: [],
    })),
    fetchJson(`${UPSTREAM_FFVB}/matches?team=${q}&limit=20`).catch(() => ({ matches: [] })),
  ])
  const seen = new Set()
  const all = []
  for (const m of [...(nat.matches || []), ...(reg.matches || [])]) {
    if (seen.has(m.match_id)) continue
    seen.add(m.match_id)
    all.push(m)
  }
  return all
}

async function processSub(record) {
  const teams = record.teams || []
  const prefs = record.prefs || { onFinished: true, onUpcoming: true, upcomingMinutes: 60 }
  const seen = record.seen || {}
  const notifications = []
  const now = Date.now()

  for (const team of teams.slice(0, 10)) {
    let matches = []
    try {
      matches = await matchesForTeam(team)
    } catch {
      continue
    }
    for (const m of matches) {
      const involves =
        String(m.team_home || '').toUpperCase() === team.toUpperCase() ||
        String(m.team_away || '').toUpperCase() === team.toUpperCase()
      if (!involves) continue

      const fp = fingerprint(m)

      if (prefs.onFinished !== false && isPast(m.status) && m.score_home != null) {
        const key = `fin:${m.match_id}`
        if (seen[key] !== fp) {
          const tracked = seen[`track:${m.match_id}`]
          seen[key] = fp
          seen[`track:${m.match_id}`] = '1'
          if (tracked) {
            const home = m.team_home === team
            const won = home
              ? Number(m.score_home) > Number(m.score_away)
              : Number(m.score_away) > Number(m.score_home)
            notifications.push({
              title: `${won ? 'Victoire' : 'Défaite'} · ${team}`,
              body: `${m.team_home} ${m.score_home}–${m.score_away} ${m.team_away}`,
              url: `/match/${encodeURIComponent(m.match_id)}`,
              tag: `fin-${m.match_id}`,
            })
          }
        }
      } else if (isUpcoming(m.status) || String(m.status).toLowerCase() === 'live') {
        seen[`track:${m.match_id}`] = '1'
      }

      if (prefs.onUpcoming !== false && isUpcoming(m.status)) {
        const kick = parseKickoff(m)
        if (kick) {
          const mins = (kick.getTime() - now) / 60000
          const window = Number(prefs.upcomingMinutes) || 60
          if (mins > 0 && mins <= window) {
            const key = `up:${m.match_id}:${window}`
            if (!seen[key]) {
              seen[key] = '1'
              notifications.push({
                title: `Bientôt · ${team}`,
                body: `${m.team_home} vs ${m.team_away} · ~${Math.round(mins)} min`,
                url: `/match/${encodeURIComponent(m.match_id)}`,
                tag: `up-${m.match_id}`,
              })
            }
          }
        }
      }
    }
  }

  // prune seen
  const keys = Object.keys(seen)
  if (keys.length > 300) {
    keys.slice(0, keys.length - 200).forEach((k) => delete seen[k])
  }

  return { notifications, seen }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors() }
  }

  if (!configureWebPush()) {
    return json(503, {
      error: 'VAPID manquant',
      hint: 'Configure VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY sur Netlify',
    })
  }

  try {
    const store = await getSubsStore()
    const index = (await store.get('__index', { type: 'json' }).catch(() => null)) || { keys: [] }
    const keys = index.keys || []
    let sent = 0
    let checked = 0
    let errors = 0

    for (const key of keys) {
      const record = await store.get(key, { type: 'json' }).catch(() => null)
      if (!record?.subscription?.endpoint) continue
      checked++

      let notifications = []
      try {
        const result = await processSub(record)
        notifications = result.notifications
        record.seen = result.seen
        record.updatedAt = new Date().toISOString()
        await store.setJSON(key, record)
      } catch {
        errors++
        continue
      }

      for (const n of notifications.slice(0, 5)) {
        try {
          await webpush.sendNotification(
            record.subscription,
            JSON.stringify({
              title: n.title,
              body: n.body,
              url: n.url,
              tag: n.tag,
            }),
          )
          sent++
        } catch (err) {
          // gone subscription
          const code = err?.statusCode
          if (code === 404 || code === 410) {
            await store.delete(key)
            index.keys = index.keys.filter((k) => k !== key)
            await store.setJSON('__index', index)
          } else {
            errors++
          }
        }
      }
    }

    return json(200, { ok: true, checked, sent, errors, subs: keys.length })
  } catch (err) {
    return json(500, { error: String(err?.message || err) })
  }
}
