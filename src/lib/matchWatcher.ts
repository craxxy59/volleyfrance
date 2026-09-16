import { fetchTeamMatches } from './api'
import { matchBucket } from './matchStore'
import {
  followedTeamNames,
  getNotifPrefs,
  markMatchSeen,
  matchFingerprint,
  showLocalNotification,
  wasMatchSeen,
} from './notifications'
import type { Match } from '../types'

function parseKickoff(m: Match): Date | null {
  const d = m.date?.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (!d) {
    const iso = Date.parse(m.date || '')
    return Number.isNaN(iso) ? null : new Date(iso)
  }
  const time = (m.time || '12:00').padStart(5, '0')
  const dt = new Date(`20${d[3]}-${d[2]}-${d[1]}T${time}:00`)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function scoreLabel(m: Match) {
  if (m.score_home == null || m.score_away == null) return ''
  return `${m.score_home}–${m.score_away}`
}

function teamInvolved(m: Match, team: string) {
  const t = team.toUpperCase()
  return m.team_home?.toUpperCase() === t || m.team_away?.toUpperCase() === t
}

/**
 * Poll followed teams and fire local notifications.
 * Strategy:
 *  - First time we see a match → track only (no spam of old results)
 *  - When a tracked upcoming/live match becomes past with a score → notify finish
 *  - Upcoming within window → one reminder
 *  - Live first sighting after tracking as upcoming → notify live
 */
export async function runMatchWatchCycle(): Promise<number> {
  const prefs = getNotifPrefs()
  if (!prefs.enabled) return 0

  const teams = followedTeamNames()
  if (!teams.length) return 0

  let fired = 0
  const now = Date.now()
  const slice = teams.slice(0, 10)

  for (const team of slice) {
    let matches: Match[] = []
    try {
      matches = await fetchTeamMatches(team, { limit: 25 })
    } catch {
      continue
    }

    for (const m of matches) {
      if (!teamInvolved(m, team)) continue

      const bucket = matchBucket(m.status)
      const fp = matchFingerprint(m)
      const trackKey = `track:${m.match_id}`
      const stateKey = `st:${m.match_id}`
      const prevState = (() => {
        try {
          const raw = localStorage.getItem('volleyfrance.notif.seen.v1')
          const map = raw ? JSON.parse(raw) : {}
          return map[stateKey] as string | undefined
        } catch {
          return undefined
        }
      })()
      const known = wasMatchSeen(trackKey, '1')

      // Always mark as known after first observation
      markMatchSeen(trackKey, '1')
      markMatchSeen(stateKey, fp)

      // Finished: only if we already knew the match AND state changed to past
      if (prefs.onFinished && bucket === 'past' && m.score_home != null && m.score_away != null) {
        const finKey = `fin:${m.match_id}`
        if (!wasMatchSeen(finKey, fp)) {
          markMatchSeen(finKey, fp)
          const prevBucket = prevState ? matchBucket(prevState.split(':')[0]) : null
          // Notify if previously seen as non-past, or first cycle after enable on very fresh match (< 36h)
          const kick = parseKickoff(m)
          const fresh =
            kick != null && now - kick.getTime() >= 0 && now - kick.getTime() < 36 * 3600 * 1000
          const transitioned = known && prevBucket != null && prevBucket !== 'past'
          if (transitioned || (known && fresh && prevBucket !== 'past')) {
            const home = m.team_home?.toUpperCase() === team.toUpperCase()
            const won = home
              ? (m.score_home ?? 0) > (m.score_away ?? 0)
              : (m.score_away ?? 0) > (m.score_home ?? 0)
            const ok = await showLocalNotification({
              title: `${won ? 'Victoire' : 'Défaite'} · ${team}`,
              body: `${m.team_home} ${scoreLabel(m)} ${m.team_away}${
                m.sets_detail ? ` · ${m.sets_detail}` : ''
              }`,
              url: `/match/${encodeURIComponent(m.match_id)}`,
              tag: `fin-${m.match_id}`,
            })
            if (ok) fired++
          }
        }
      }

      // Upcoming reminder
      if (prefs.onUpcoming && bucket === 'upcoming') {
        const kick = parseKickoff(m)
        if (kick) {
          const mins = (kick.getTime() - now) / 60000
          const window = prefs.upcomingMinutes || 60
          if (mins > 0 && mins <= window) {
            const upKey = `up:${m.match_id}:${window}`
            if (!wasMatchSeen(upKey, '1')) {
              markMatchSeen(upKey, '1')
              const ok = await showLocalNotification({
                title: `Bientôt · ${team}`,
                body: `${m.team_home} vs ${m.team_away} · dans ~${Math.max(1, Math.round(mins))} min`,
                url: `/match/${encodeURIComponent(m.match_id)}`,
                tag: `up-${m.match_id}`,
              })
              if (ok) fired++
            }
          }
        }
      }

      // Live
      if (bucket === 'live') {
        const liveKey = `live:${m.match_id}`
        if (!wasMatchSeen(liveKey, '1')) {
          markMatchSeen(liveKey, '1')
          const ok = await showLocalNotification({
            title: `En cours · ${team}`,
            body: `${m.team_home} vs ${m.team_away}`,
            url: `/match/${encodeURIComponent(m.match_id)}`,
            tag: `live-${m.match_id}`,
          })
          if (ok) fired++
        }
      }
    }
  }

  return fired
}

let timer: number | null = null

export function startMatchWatcher(intervalMs = 90_000) {
  stopMatchWatcher()
  window.setTimeout(() => {
    runMatchWatchCycle().catch(() => null)
  }, 5000)
  timer = window.setInterval(() => {
    runMatchWatchCycle().catch(() => null)
  }, intervalMs)
  document.addEventListener('visibilitychange', onVis)
}

function onVis() {
  if (document.visibilityState === 'visible' && getNotifPrefs().enabled) {
    runMatchWatchCycle().catch(() => null)
  }
}

export function stopMatchWatcher() {
  if (timer != null) {
    clearInterval(timer)
    timer = null
  }
  document.removeEventListener('visibilitychange', onVis)
}
