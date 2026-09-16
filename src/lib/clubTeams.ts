import type { Club, Match } from '../types'
import { fetchMatches, fetchNationalMatches, searchTeams } from './api'

/** Words that appear in many club legal names — never use alone for matching */
const STOP = new Set(
  [
    'UNION',
    'SPORTIVE',
    'SPORTIF',
    'SPORTIFS',
    'SPORTIVES',
    'ASSOCIATION',
    'ASSOC',
    'ASSO',
    'CLUB',
    'VOLLEY',
    'VOLLEYBALL',
    'BALL',
    'OMNISPORTS',
    'OMNISPORT',
    'ENTENTE',
    'STADE',
    'RACING',
    'ATHLETIC',
    'ATHLETIQUE',
    'SECTION',
    'COMITE',
    'COMITÉ',
    'SOCIETE',
    'SOCIÉTÉ',
    'FRANCAISE',
    'FRANÇAISE',
    'DE',
    'DU',
    'DES',
    'LA',
    'LE',
    'LES',
    'ET',
    'EN',
    'AU',
    'AUX',
    'SUR',
    'SOUS',
    'LES',
    'D',
    'L',
    'VB',
    'UC',
    'AS',
    'US',
    'ESC',
    'OSC',
    'AC',
    'FC',
    'SC',
    'CS',
    'JS',
    'ES',
    'LOISIRS',
    'LOISIR',
    'COMPETITION',
    'COMPÉTITION',
    'MASCULIN',
    'MASCULINS',
    'FEMININ',
    'FÉMININ',
    'FEMININE',
    'FÉMININE',
    'SENIOR',
    'SENIORS',
    'JEUNE',
    'JEUNES',
  ].map((s) => s.toUpperCase()),
)

function stripAccents(s: string) {
  return s.normalize('NFD').replace(/\p{M}/gu, '')
}

function normalize(s: string) {
  return stripAccents(s)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Expand ST ↔ SAINT for matching */
function expandVariants(token: string): string[] {
  const t = token.toUpperCase()
  if (t === 'ST' || t === 'SAINT') return ['ST', 'SAINT']
  if (t === 'STE' || t === 'SAINTE') return ['STE', 'SAINTE']
  return [t]
}

export function clubSignificantTokens(clubName: string): string[] {
  const norm = normalize(clubName)
  const raw = norm.split(' ').filter(Boolean)
  const tokens: string[] = []
  for (const w of raw) {
    if (w.length < 2) continue
    if (STOP.has(w)) continue
    if (/^\d+$/.test(w)) continue
    tokens.push(w)
  }
  // Prefer longer / more distinctive tokens first
  return [...new Set(tokens)].sort((a, b) => b.length - a.length || a.localeCompare(b))
}

/** Human core label e.g. "SAINT ANDRE" from "UNION SPORTIVE DE SAINT ANDRE" */
export function clubCoreLabel(clubName: string): string {
  const tokens = clubSignificantTokens(clubName)
  if (!tokens.length) return normalize(clubName)
  // Keep geographic / name order as in original
  const norm = normalize(clubName)
  return tokens
    .slice()
    .sort((a, b) => norm.indexOf(a) - norm.indexOf(b))
    .join(' ')
}

/**
 * Strict: team belongs to club if it contains the club core tokens
 * (not a single generic word like UNION / SPORTIVE).
 */
export function teamBelongsToClub(teamName: string, clubName: string): boolean {
  const team = normalize(teamName)
  if (!team) return false

  const tokens = clubSignificantTokens(clubName)
  if (!tokens.length) {
    // fallback: full normalized club name must be substring-ish
    const core = normalize(clubName)
    return team.includes(core) || core.includes(team.replace(/\s+\d+$/, ''))
  }

  // All significant tokens must appear (with ST/SAINT variants)
  return tokens.every((tok) => {
    const variants = expandVariants(tok)
    return variants.some((v) => {
      // word boundary-ish match
      const re = new RegExp(`(?:^|\\s)${v}(?:\\s|$)`)
      return re.test(team) || team.includes(` ${v} `) || team.startsWith(v + ' ') || team.endsWith(' ' + v) || team === v
    })
  })
}

function teamBaseKey(teamName: string): string {
  // "SAINT ANDRE 1" → "SAINT ANDRE"
  return normalize(teamName).replace(/\s+\d+$/, '').trim()
}

export interface ClubTeamInfo {
  name: string
  base: string
  number: string | null
  matchCount: number
}

/**
 * Discover competition teams linked to a club via FFVB search + match feeds.
 */
export async function discoverClubTeams(club: Club): Promise<{
  teams: ClubTeamInfo[]
  matches: Match[]
  queries: string[]
}> {
  const core = clubCoreLabel(club.name)
  const tokens = clubSignificantTokens(club.name)
  const queries = new Set<string>()

  if (core) queries.add(core)
  // ST ANDRE variant
  if (core.includes('SAINT ')) queries.add(core.replace(/SAINT /g, 'ST '))
  if (core.includes('ST ')) queries.add(core.replace(/\bST /g, 'SAINT '))
  // First two significant tokens
  if (tokens.length >= 2) queries.add(`${tokens[0]} ${tokens[1]}`)
  // City from CP if we only have generic name — skip
  // Also try last two tokens (often city)
  if (tokens.length >= 2) {
    const ordered = tokens
      .slice()
      .sort(
        (a, b) =>
          normalize(club.name).indexOf(a) - normalize(club.name).indexOf(b),
      )
    queries.add(ordered.slice(-2).join(' '))
    if (ordered.length >= 1 && ordered[ordered.length - 1].length >= 4) {
      queries.add(ordered[ordered.length - 1])
    }
  }

  // Drop queries that are a single stop-ish short token
  const cleanQueries = [...queries].filter((q) => {
    const parts = q.split(' ').filter(Boolean)
    if (parts.length === 0) return false
    if (parts.length === 1 && parts[0].length < 5) return false
    if (parts.length === 1 && STOP.has(parts[0])) return false
    return true
  })

  // 1) Search API for team names
  const teamNames = new Set<string>()
  await Promise.all(
    cleanQueries.slice(0, 6).map(async (q) => {
      try {
        const res = await searchTeams(q)
        ;(res.teams || []).forEach((t) => {
          if (teamBelongsToClub(t, club.name)) teamNames.add(t)
        })
      } catch {
        /* ignore */
      }
    }),
  )

  // 2) Fetch matches for each discovered team name
  const matchMap = new Map<string, Match>()
  const teamsForFetch = [...teamNames]
  // If search found nothing, try core as team filter directly
  if (!teamsForFetch.length && core) {
    teamsForFetch.push(core)
  }

  await Promise.all(
    teamsForFetch.slice(0, 12).map(async (team) => {
      try {
        const [nat, reg] = await Promise.all([
          fetchNationalMatches({ team, limit: 40 }).catch(() => ({ matches: [] as Match[] })),
          fetchMatches({ team, limit: 40 }).catch(() => ({ matches: [] as Match[] })),
        ])
        ;[...(nat.matches || []), ...(reg.matches || [])].forEach((m) => {
          const homeOk = teamBelongsToClub(m.team_home, club.name)
          const awayOk = teamBelongsToClub(m.team_away, club.name)
          if (!homeOk && !awayOk) return
          if (!matchMap.has(m.match_id)) matchMap.set(m.match_id, m)
          // Collect exact team labels that matched
          if (homeOk) teamNames.add(m.team_home)
          if (awayOk) teamNames.add(m.team_away)
        })
      } catch {
        /* ignore */
      }
    }),
  )

  const matches = [...matchMap.values()]

  // Build team list with match counts
  const countByTeam = new Map<string, number>()
  matches.forEach((m) => {
    ;[m.team_home, m.team_away].forEach((t) => {
      if (teamBelongsToClub(t, club.name)) {
        countByTeam.set(t, (countByTeam.get(t) || 0) + 1)
      }
    })
  })
  // Ensure search hits appear even with 0 matches loaded
  teamNames.forEach((t) => {
    if (!countByTeam.has(t)) countByTeam.set(t, 0)
  })

  const teams: ClubTeamInfo[] = [...countByTeam.entries()]
    .map(([name, matchCount]) => {
      const base = teamBaseKey(name)
      const num = name.match(/\s+(\d+)\s*$/)?.[1] || null
      return { name, base, number: num, matchCount }
    })
    .sort((a, b) => {
      // group by base, then number
      const bc = a.base.localeCompare(b.base, 'fr')
      if (bc !== 0) return bc
      return Number(a.number || 0) - Number(b.number || 0)
    })

  return { teams, matches, queries: cleanQueries }
}

export function filterMatchesForTeam(matches: Match[], teamName: string): Match[] {
  const key = normalize(teamName)
  return matches.filter(
    (m) => normalize(m.team_home) === key || normalize(m.team_away) === key,
  )
}

export function filterMatchesForClub(matches: Match[], clubName: string): Match[] {
  return matches.filter(
    (m) => teamBelongsToClub(m.team_home, clubName) || teamBelongsToClub(m.team_away, clubName),
  )
}
