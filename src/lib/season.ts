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

function seasonStartYear(label: string): number | null {
  const m = label.match(/^(\d{4})\s*\//)
  return m ? Number(m[1]) : null
}

/**
 * Label affiché dans l’UI = **saison calendaire courante** (juil→juin).
 *
 * L’API résultats peut encore servir l’ancienne saison quelques semaines :
 * on n’affiche plus bêtement "2025/2026" si on est déjà en 2026/2027.
 * Si tu passes un override API plus récent ou égal, on le garde.
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
      // Only trust API if same season or newer than calendar
      if (apiStart != null && apiStart >= calStart) return best
    }
  }
  return calendar
}
