import type { Club, Match } from '../types'
import {
  fetchDeptTeams,
  fetchMatches,
  fetchNationalMatches,
  searchTeams,
} from './api'
import {
  categorySortKey,
  parseCompetitionMeta,
  type CompetitionMeta,
  type TeamGender,
} from './teamMeta'

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
  return [...new Set(tokens)].sort((a, b) => b.length - a.length || a.localeCompare(b))
}

/** Human core label e.g. "SAINT ANDRE" from "UNION SPORTIVE DE SAINT ANDRE" */
export function clubCoreLabel(clubName: string): string {
  const tokens = clubSignificantTokens(clubName)
  if (!tokens.length) return normalize(clubName)
  const norm = normalize(clubName)
  return tokens
    .slice()
    .sort((a, b) => norm.indexOf(a) - norm.indexOf(b))
    .join(' ')
}

/**
 * Strict: team belongs to club if it contains the club core tokens
 * (not a single generic word like UNION / SPORTIVE).
 * Reject obvious other-club prefixes when the core is a place name (ST ANDRE).
 */
export function teamBelongsToClub(teamName: string, clubName: string): boolean {
  const team = normalize(teamName)
  if (!team) return false

  const tokens = clubSignificantTokens(clubName)
  if (!tokens.length) {
    const core = normalize(clubName)
    return team.includes(core) || core.includes(team.replace(/\s+\d+$/, ''))
  }

  const tokenOk = tokens.every((tok) => {
    const variants = expandVariants(tok)
    return variants.some((v) => {
      const re = new RegExp(`(?:^|\\s)${v}(?:\\s|$)`)
      return (
        re.test(team) ||
        team.includes(` ${v} `) ||
        team.startsWith(v + ' ') ||
        team.endsWith(' ' + v) ||
        team === v
      )
    })
  })
  if (!tokenOk) return false

  // Base team label without trailing number
  const teamBase = team.replace(/\s+\d+$/, '').trim()
  const core = clubCoreLabel(clubName)
  const coreFlex = core.replace(/\bSAINT\b/g, 'ST').replace(/\bSAINTE\b/g, 'STE')
  const teamFlex = teamBase.replace(/\bSAINT\b/g, 'ST').replace(/\bSAINTE\b/g, 'STE')

  // Exact / core-prefix only (SAINT ANDRE, SAINT ANDRE VOLLEY…)
  if (teamFlex === coreFlex || teamFlex.startsWith(coreFlex + ' ')) return true
  // Core may be longer than team short label
  if (coreFlex.startsWith(teamFlex + ' ') || coreFlex === teamFlex) return true

  // Prefix before the place name → autre club (ex. "ASV ST ANDRE")
  if (teamFlex.endsWith(' ' + coreFlex)) {
    const prefix = teamFlex.slice(0, teamFlex.length - coreFlex.length).trim()
    const extra = prefix.split(' ').filter(Boolean)
    // Only allow stop-word prefixes (UNION SPORTIVE … already stripped from core)
    if (extra.every((w) => STOP.has(w))) return true
    return false
  }

  // Fallback: tokens matched and team contains core as contiguous phrase
  if (teamFlex.includes(coreFlex)) {
    const withoutCore = teamFlex.replace(coreFlex, ' ').replace(/\s+/g, ' ').trim()
    const extra = withoutCore.split(' ').filter(Boolean)
    if (!extra.length) return true
    if (extra.every((w) => STOP.has(w) || /^\d+$/.test(w))) return true
    return false
  }
  return false
}

function teamBaseKey(teamName: string): string {
  return normalize(teamName).replace(/\s+\d+$/, '').trim()
}

export interface ClubTeamInfo {
  /** Clé unique name+poule (une ligne Blockout = une compétition) */
  id: string
  name: string
  base: string
  number: string | null
  matchCount: number
  pouleCode: string
  pouleName: string
  pouleNumericId?: number
  codent: string
  levelScope: 'national' | 'regional' | 'departemental'
  meta: CompetitionMeta
  /** Matches already attached (subset) */
  sampleMatches?: Match[]
}

function scopeFromCodent(codent?: string): ClubTeamInfo['levelScope'] {
  const c = (codent || '').toUpperCase()
  if (!c || c === 'ABCCS') return 'national'
  if (/^PT/i.test(c)) return 'departemental'
  return 'regional'
}

function teamId(name: string, pouleCode: string, codent: string) {
  return `${normalize(name)}|${(pouleCode || '').toUpperCase()}|${(codent || '').toUpperCase()}`
}

function upsertTeam(
  map: Map<string, ClubTeamInfo>,
  partial: Omit<ClubTeamInfo, 'id' | 'base' | 'number' | 'meta'> & {
    meta?: CompetitionMeta
  },
) {
  const id = teamId(partial.name, partial.pouleCode, partial.codent)
  const meta =
    partial.meta || parseCompetitionMeta(partial.pouleName, partial.pouleCode)
  const existing = map.get(id)
  if (existing) {
    if (partial.sampleMatches?.length) {
      const seen = new Set((existing.sampleMatches || []).map((m) => m.match_id))
      existing.sampleMatches = existing.sampleMatches || []
      for (const m of partial.sampleMatches) {
        if (!seen.has(m.match_id)) {
          seen.add(m.match_id)
          existing.sampleMatches.push(m)
        }
      }
      existing.matchCount = Math.max(
        existing.matchCount,
        partial.matchCount,
        existing.sampleMatches.length,
      )
    } else {
      existing.matchCount = Math.max(existing.matchCount, partial.matchCount)
    }
    if (partial.pouleName && partial.pouleName.length > (existing.pouleName || '').length) {
      existing.pouleName = partial.pouleName
      existing.meta = parseCompetitionMeta(partial.pouleName, partial.pouleCode)
    }
    return existing
  }
  const num = partial.name.match(/\s+(\d+)\s*$/)?.[1] || null
  const samples = partial.sampleMatches ? [...partial.sampleMatches] : []
  const row: ClubTeamInfo = {
    id,
    name: partial.name,
    base: teamBaseKey(partial.name),
    number: num,
    matchCount: Math.max(partial.matchCount, samples.length),
    pouleCode: partial.pouleCode,
    pouleName: partial.pouleName,
    pouleNumericId: partial.pouleNumericId,
    codent: partial.codent,
    levelScope: partial.levelScope,
    meta,
    sampleMatches: samples,
  }
  map.set(id, row)
  return row
}

function addMatchToTeams(map: Map<string, ClubTeamInfo>, m: Match, clubName: string) {
  const sides = [m.team_home, m.team_away]
  for (const t of sides) {
    if (!teamBelongsToClub(t, clubName)) continue
    const pouleCode = m.poule_code || m.poule_name?.split(' ')[0] || '??'
    const pouleName = m.poule_name || pouleCode
    const codent = m.codent || ''
    upsertTeam(map, {
      name: t,
      matchCount: 1,
      pouleCode,
      pouleName,
      pouleNumericId: m.poule_id,
      codent,
      levelScope: scopeFromCodent(codent),
      sampleMatches: [m],
    })
    // increment properly
    const id = teamId(t, pouleCode, codent)
    const row = map.get(id)
    if (row && row.sampleMatches) {
      const ids = new Set(row.sampleMatches.map((x) => x.match_id))
      if (!ids.has(m.match_id)) {
        row.sampleMatches.push(m)
        row.matchCount = row.sampleMatches.length
      } else {
        row.matchCount = Math.max(row.matchCount, row.sampleMatches.length)
      }
    }
  }
}

/**
 * Discover competition teams linked to a club via FFVB search + match feeds + départemental.
 * Une « équipe » = un couple (nom FFVB, poule) → catégorie + genre visibles.
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
  if (core.includes('SAINT ')) queries.add(core.replace(/SAINT /g, 'ST '))
  if (core.includes('ST ')) queries.add(core.replace(/\bST /g, 'SAINT '))
  if (tokens.length >= 2) queries.add(`${tokens[0]} ${tokens[1]}`)
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

  const cleanQueries = [...queries].filter((q) => {
    const parts = q.split(' ').filter(Boolean)
    if (parts.length === 0) return false
    if (parts.length === 1 && parts[0].length < 5) return false
    if (parts.length === 1 && STOP.has(parts[0])) return false
    return true
  })

  const teamNames = new Set<string>()
  const teamMap = new Map<string, ClubTeamInfo>()
  const matchMap = new Map<string, Match>()

  // 1) Search API for team names (national/regional index)
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

  // 2) Fetch matches for each discovered team name (nat + reg)
  const teamsForFetch = [...teamNames]
  if (!teamsForFetch.length && core) teamsForFetch.push(core)
  // Always try core + numbered variants 1..6 to catch "SAINT ANDRE 3"
  if (core) {
    for (let n = 1; n <= 6; n++) {
      const label = `${core} ${n}`
      if (!teamsForFetch.includes(label)) teamsForFetch.push(label)
      const st = core.replace(/\bSAINT\b/g, 'ST')
      if (st !== core) {
        const stLabel = `${st} ${n}`
        if (!teamsForFetch.includes(stLabel)) teamsForFetch.push(stLabel)
      }
    }
  }

  await Promise.all(
    teamsForFetch.slice(0, 18).map(async (team) => {
      try {
        const [nat, reg] = await Promise.all([
          fetchNationalMatches({ team, limit: 50 }).catch(() => ({
            matches: [] as Match[],
          })),
          fetchMatches({ team, limit: 80 }).catch(() => ({
            matches: [] as Match[],
          })),
        ])
        ;[...(nat.matches || []), ...(reg.matches || [])].forEach((m) => {
          const homeOk = teamBelongsToClub(m.team_home, club.name)
          const awayOk = teamBelongsToClub(m.team_away, club.name)
          if (!homeOk && !awayOk) return
          if (!matchMap.has(m.match_id)) matchMap.set(m.match_id, m)
          if (homeOk) teamNames.add(m.team_home)
          if (awayOk) teamNames.add(m.team_away)
          addMatchToTeams(teamMap, m, club.name)
        })
      } catch {
        /* ignore */
      }
    }),
  )

  // 3) Départemental — source manquante pour Saint-André 3 etc.
  try {
    const deptEntries = await fetchDeptTeams({
      idDept: club.id_dept,
      q: core || clubSignificantTokens(club.name).slice(0, 2).join(' '),
      limit: 300,
      full: true,
    })
    for (const entry of deptEntries) {
      if (!teamBelongsToClub(entry.team, club.name)) continue
      teamNames.add(entry.team)
      const matches = (entry.matches || []) as Match[]
      matches.forEach((m) => {
        if (!matchMap.has(m.match_id)) matchMap.set(m.match_id, m)
      })
      upsertTeam(teamMap, {
        name: entry.team,
        matchCount: entry.matchCount || matches.length || 0,
        pouleCode: entry.poule_id,
        pouleName: entry.poule_name,
        pouleNumericId: entry.poule_numeric_id,
        codent: entry.codent,
        levelScope: 'departemental',
        sampleMatches: matches,
        meta: parseCompetitionMeta(entry.poule_name, entry.poule_id),
      })
      // fix count from samples
      const id = teamId(entry.team, entry.poule_id, entry.codent)
      const row = teamMap.get(id)
      if (row) {
        row.matchCount = Math.max(row.matchCount, entry.matchCount || 0, matches.length)
      }
    }
  } catch {
    /* comité non mappé ou scrape KO — soft fail */
  }

  // Ensure every match contributes
  for (const m of matchMap.values()) {
    addMatchToTeams(teamMap, m, club.name)
  }

  const matches = [...matchMap.values()]

  const teams: ClubTeamInfo[] = [...teamMap.values()].sort((a, b) => {
    // Gender F then M then unknown
    const gRank = (g: TeamGender | null) => (g === 'F' ? 0 : g === 'M' ? 1 : 2)
    const gc = gRank(a.meta.gender) - gRank(b.meta.gender)
    if (gc !== 0) return gc
    const cc = categorySortKey(a.meta.category) - categorySortKey(b.meta.category)
    if (cc !== 0) return cc
    const lc = (a.meta.level || '').localeCompare(b.meta.level || '', 'fr')
    if (lc !== 0) return lc
    const bc = a.base.localeCompare(b.base, 'fr')
    if (bc !== 0) return bc
    return Number(a.number || 0) - Number(b.number || 0)
  })

  return { teams, matches, queries: cleanQueries }
}

export function filterMatchesForTeam(
  matches: Match[],
  teamName: string,
  pouleCode?: string | null,
): Match[] {
  const key = normalize(teamName)
  return matches.filter((m) => {
    const side =
      normalize(m.team_home) === key || normalize(m.team_away) === key
    if (!side) return false
    if (pouleCode) {
      return (m.poule_code || '').toUpperCase() === pouleCode.toUpperCase()
    }
    return true
  })
}

export function filterMatchesForClub(matches: Match[], clubName: string): Match[] {
  return matches.filter(
    (m) =>
      teamBelongsToClub(m.team_home, clubName) ||
      teamBelongsToClub(m.team_away, clubName),
  )
}

/** Groupes d’affichage type Blockout */
export function groupClubTeams(teams: ClubTeamInfo[]): {
  key: string
  title: string
  gender: TeamGender | null
  category: string
  teams: ClubTeamInfo[]
}[] {
  const map = new Map<string, ClubTeamInfo[]>()
  for (const t of teams) {
    const g = t.meta.gender
    const key = `${t.meta.category}|${g || 'X'}`
    const list = map.get(key) || []
    list.push(t)
    map.set(key, list)
  }
  return [...map.entries()]
    .map(([key, list]) => {
      const [category, g] = key.split('|')
      const gender = (g === 'F' || g === 'M' ? g : null) as TeamGender | null
      const gLabel = gender === 'F' ? 'Féminin' : gender === 'M' ? 'Masculin' : ''
      const title = gLabel ? `${category} · ${gLabel}` : category
      return { key, title, gender, category, teams: list }
    })
    .sort((a, b) => {
      const gRank = (g: TeamGender | null) => (g === 'F' ? 0 : g === 'M' ? 1 : 2)
      const gc = gRank(a.gender) - gRank(b.gender)
      if (gc !== 0) return gc
      return categorySortKey(a.category) - categorySortKey(b.category)
    })
}
