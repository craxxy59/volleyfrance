/**
 * Saison sportive FFVB : 1er juillet N → 30 juin N+1.
 * Ex. le 16 septembre 2026 → "2026/2027"
 */

export function currentSeasonFull(now = new Date()): string {
  const y = now.getFullYear()
  const month = now.getMonth() + 1 // 1–12
  const start = month >= 7 ? y : y - 1
  return `${start}/${start + 1}`
}

/** Forme courte "2026/27" */
export function currentSeasonShort(full = currentSeasonFull()): string {
  const m = full.match(/^(\d{4})\s*\/\s*(\d{2,4})$/)
  if (!m) return full
  const end = m[2].length === 4 ? m[2].slice(2) : m[2]
  return `${m[1]}/${end}`
}

export function seasonStartYear(label: string): number | null {
  const m = String(label || '').match(/^(\d{4})\s*\//)
  return m ? Number(m[1]) : null
}

/** Normalise "2026/27", "2026-2027", "2026 / 2027" → "2026/2027" */
export function normalizeSeason(label?: string | null): string | null {
  if (!label) return null
  const m = String(label)
    .trim()
    .match(/^(\d{4})\s*[\/\-–]\s*(\d{2,4})$/)
  if (!m) return null
  const start = Number(m[1])
  let end = Number(m[2])
  if (m[2].length === 2) end = Math.floor(start / 100) * 100 + end
  if (end !== start + 1 && end !== start - 1999 && end !== (start % 100) + 1) {
    // still accept start/start+1 if end was 2-digit of next year
    if (m[2].length === 2 && end % 100 === (start + 1) % 100) {
      return `${start}/${start + 1}`
    }
  }
  return `${start}/${start + 1}`
}

/**
 * Liste de saisons sélectionnables (récentes → un peu dans le futur).
 * Inclut toujours la saison calendaire + celles vues dans l’API stats.
 */
export function listSelectableSeasons(opts?: {
  statsSeasons?: string[]
  now?: Date
  past?: number
  future?: number
}): string[] {
  const now = opts?.now || new Date()
  const cur = currentSeasonFull(now)
  const curStart = seasonStartYear(cur) ?? now.getFullYear()
  const past = opts?.past ?? 4
  const future = opts?.future ?? 1
  const set = new Set<string>()

  for (let i = -past; i <= future; i++) {
    const s = curStart + i
    set.add(`${s}/${s + 1}`)
  }
  for (const raw of opts?.statsSeasons || []) {
    const n = normalizeSeason(raw)
    if (n) set.add(n)
  }
  return [...set].sort((a, b) => (seasonStartYear(b) || 0) - (seasonStartYear(a) || 0))
}

/**
 * Label affiché dans l’UI = **saison calendaire courante** (juil→juin),
 * sauf si l’utilisateur a choisi une autre saison (géré hors de cette fn).
 */
export function resolveSeasonLabel(stats?: {
  matches_by_season?: Record<string, number>
} | null): string {
  const calendar = currentSeasonFull()
  const calStart = seasonStartYear(calendar) ?? 0

  const map = stats?.matches_by_season
  if (map && typeof map === 'object') {
    const keys = Object.keys(map)
    if (keys.length) {
      const best = keys.sort((a, b) => (map[b] || 0) - (map[a] || 0))[0]
      const apiStart = seasonStartYear(best)
      if (apiStart != null && apiStart >= calStart) return best
    }
  }
  return calendar
}

/** Saison FFVB d’une date (ISO ou JJ/MM/AA) */
export function seasonFromDate(date?: string | null): string | null {
  if (!date) return null
  // JJ/MM/AA or JJ/MM/AAAA
  let y: number | null = null
  let mo: number | null = null
  const fr = String(date).match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/)
  if (fr) {
    mo = Number(fr[2])
    y = fr[3].length === 2 ? 2000 + Number(fr[3]) : Number(fr[3])
  } else {
    const iso = String(date).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) {
      y = Number(iso[1])
      mo = Number(iso[2])
    } else {
      const d = new Date(date)
      if (!Number.isNaN(d.getTime())) {
        y = d.getFullYear()
        mo = d.getMonth() + 1
      }
    }
  }
  if (y == null || mo == null) return null
  const start = mo >= 7 ? y : y - 1
  return `${start}/${start + 1}`
}

/** Saison effective d’un match (champ API ou déduite de la date) */
export function matchSeason(m: {
  saison?: string | null
  date?: string | null
}): string | null {
  return normalizeSeason(m.saison) || seasonFromDate(m.date)
}

export function sameSeason(a?: string | null, b?: string | null): boolean {
  const na = normalizeSeason(a)
  const nb = normalizeSeason(b)
  if (!na || !nb) return false
  return na === nb
}

/** Filtre une liste d’objets ayant éventuellement `saison` / `date` */
export function filterBySeason<T extends { saison?: string | null; date?: string | null }>(
  items: T[],
  season: string | null | undefined,
): T[] {
  const target = normalizeSeason(season)
  if (!target) return items
  return items.filter((item) => {
    const s = matchSeason(item)
    // Si aucune info de saison : on garde (évite de vider l’UI live sans date)
    if (!s) return true
    return s === target
  })
}

export const SEASON_STORAGE_KEY = 'vf-season'
export const SEASON_EVENT = 'vf-season-change'
