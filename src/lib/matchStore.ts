import type { LiveMatch, Match } from '../types'

const KEY = 'volleyfrance.match.v1'
const LIVE_KEY = 'volleyfrance.live.v1'

export function cacheMatch(match: Match) {
  try {
    const all = readAll(KEY)
    all[match.match_id] = match
    // keep last 80
    const ids = Object.keys(all)
    if (ids.length > 80) {
      ids.slice(0, ids.length - 80).forEach((id) => delete all[id])
    }
    sessionStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* ignore quota */
  }
}

export function getCachedMatch(id: string): Match | null {
  try {
    return readAll<Match>(KEY)[id] || null
  } catch {
    return null
  }
}

export function cacheLiveMatch(match: LiveMatch) {
  try {
    const all = readAll(LIVE_KEY)
    all[match.match_id] = match
    sessionStorage.setItem(LIVE_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

export function getCachedLiveMatch(id: string): LiveMatch | null {
  try {
    return readAll<LiveMatch>(LIVE_KEY)[id] || null
  } catch {
    return null
  }
}

function readAll<T>(key: string): Record<string, T> {
  const raw = sessionStorage.getItem(key)
  if (!raw) return {}
  const parsed = JSON.parse(raw)
  return parsed && typeof parsed === 'object' ? parsed : {}
}

/** Normalize API status into UI buckets */
export type MatchBucket = 'live' | 'upcoming' | 'past' | 'all'

export function matchBucket(status: string | undefined | null): MatchBucket {
  const s = (status || '').toLowerCase()
  if (['live', 'running', 'in_progress', 'inprogress', 'ongoing', 'started'].includes(s)) {
    return 'live'
  }
  if (['scheduled', 'prematch', 'upcoming', 'not_started', 'ns'].includes(s)) {
    return 'upcoming'
  }
  if (['completed', 'finished', 'played', 'ended', 'forfeit'].includes(s)) {
    return 'past'
  }
  return 'past'
}

export function isMatchPlayed(m: Pick<Match, 'status' | 'score_home' | 'score_away'>): boolean {
  if (matchBucket(m.status) === 'past') return true
  if (m.score_home != null && m.score_away != null && matchBucket(m.status) !== 'upcoming') return true
  return false
}

export function displayScores(m: Match): {
  home: string | number
  away: string | number
  showScore: boolean
} {
  const bucket = matchBucket(m.status)

  // Upcoming / scheduled: never show score (API sometimes ships placeholder 0:25 sets)
  if (bucket === 'upcoming' || m.status === 'scheduled') {
    return { home: '–', away: '–', showScore: false }
  }

  if (m.score_home == null && m.score_away == null) {
    return { home: '–', away: '–', showScore: false }
  }

  return {
    home: m.score_home ?? '–',
    away: m.score_away ?? '–',
    showScore: true,
  }
}
