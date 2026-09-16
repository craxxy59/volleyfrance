import type {
  Club,
  Department,
  Entity,
  LiveMatch,
  Match,
  Poule,
  RankingRow,
  Stats,
} from '../types'

const FFVB = '/ffvb-api'
const FFVOLLEY = '/ffvolley-api'

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function isRetryableStatus(status: number) {
  return status === 404 || status === 408 || status === 425 || status === 429 || status >= 500
}

async function getJson<T>(url: string, init?: RequestInit & { retries?: number }): Promise<T> {
  const retries = init?.retries ?? 3
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init?.headers || {}),
        },
        cache: 'no-store',
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const retryable =
          isRetryableStatus(res.status) ||
          /NOT_FOUND|page could not be found|indisponible/i.test(text)

        if (retryable && attempt < retries) {
          lastError = new Error(`HTTP ${res.status} — ${url}`)
          await sleep(280 * (attempt + 1) + Math.random() * 150)
          continue
        }

        let detail = text.slice(0, 180)
        try {
          const j = JSON.parse(text)
          detail = j.detail || j.error || j.message || detail
        } catch {
          /* keep */
        }
        throw new Error(
          typeof detail === 'string' && detail.length < 120
            ? `HTTP ${res.status} — ${detail}`
            : `HTTP ${res.status} — ${url}`,
        )
      }

      return (await res.json()) as T
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // Network / abort — retry
      if (attempt < retries && !(lastError.message.startsWith('HTTP 4') && !lastError.message.includes('404'))) {
        if (/HTTP 4\d\d/.test(lastError.message) && !/404/.test(lastError.message)) {
          break
        }
        await sleep(280 * (attempt + 1))
        continue
      }
      throw lastError
    }
  }

  throw lastError || new Error(`Échec — ${url}`)
}

function qs(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/* ─── Results API ─── */

export async function fetchGlobalStats(): Promise<Stats> {
  return getJson(`${FFVB}/stats`)
}

export async function fetchNationalStats(): Promise<Stats> {
  return getJson(`${FFVB}/nationals/stats`)
}

export async function fetchEntities(): Promise<Entity[]> {
  const data = await getJson<{ entities: Entity[] }>(`${FFVB}/entities`)
  return data.entities || []
}

/** Comités départementaux (catalogue + scrape ffvbbeach.org) */
export async function fetchDepartments(ligueCodent?: string): Promise<Department[]> {
  const data = await getJson<{ departments: Department[] }>(
    `${FFVB}/departments${qs({ ligue: ligueCodent })}`,
  )
  return data.departments || []
}

export function isDeptCodent(codent?: string | null): boolean {
  return /^PT/i.test(String(codent || ''))
}

export async function fetchNationalPoules(): Promise<Poule[]> {
  const data = await getJson<{ poules: Poule[] }>(`${FFVB}/nationals/poules`)
  return data.poules || []
}

export async function fetchPoules(codent?: string): Promise<Poule[]> {
  const data = await getJson<{ poules: Poule[] }>(`${FFVB}/poules${qs({ codent })}`)
  return data.poules || []
}

/** Classement départemental (scrape officiel) — fallback si rankings/:id indispo */
export async function fetchDeptRankings(
  codent: string,
  pouleCode: string,
): Promise<{ rankings: RankingRow[]; poule_name?: string; count: number }> {
  return getJson(`${FFVB}/departments/${encodeURIComponent(codent)}/rankings${qs({ poule: pouleCode })}`)
}

export async function fetchNationalMatches(params: {
  poule?: string
  status?: string
  team?: string
  limit?: number
  offset?: number
}): Promise<{ matches: Match[]; total?: number; count: number }> {
  return getJson(`${FFVB}/nationals/matches${qs(params)}`)
}

export async function fetchMatches(params: {
  codent?: string
  poule?: string
  status?: string
  team?: string
  limit?: number
  offset?: number
}): Promise<{ matches: Match[]; count: number; limit?: number }> {
  return getJson(`${FFVB}/matches${qs(params)}`)
}

export async function fetchNationalRankings(pouleNumericId: number): Promise<{
  rankings: RankingRow[]
  poule_name?: string
  count: number
}> {
  return getJson(`${FFVB}/nationals/rankings/${pouleNumericId}`)
}

export async function fetchRankings(pouleNumericId: number): Promise<{
  rankings: RankingRow[]
  poule_name?: string
  count: number
}> {
  return getJson(`${FFVB}/rankings/${pouleNumericId}`)
}

export async function searchTeams(q: string): Promise<{ teams: string[]; poules: unknown[] }> {
  return getJson(`${FFVB}/search${qs({ q })}`)
}

/** Fetch both national + regional results for a team name */
export async function fetchTeamMatches(
  team: string,
  opts?: { limit?: number },
): Promise<Match[]> {
  const limit = opts?.limit ?? 40
  const [nat, reg] = await Promise.all([
    fetchNationalMatches({ team, limit }).catch(() => ({ matches: [] as Match[] })),
    fetchMatches({ team, limit }).catch(() => ({ matches: [] as Match[] })),
  ])
  const seen = new Set<string>()
  const all: Match[] = []
  ;[...(nat.matches || []), ...(reg.matches || [])].forEach((m) => {
    if (!seen.has(m.match_id)) {
      seen.add(m.match_id)
      all.push(m)
    }
  })
  return all
}

/* ─── FFVolley official API ─── */

let clubsCache: Club[] | null = null
let clubsPromise: Promise<Club[]> | null = null

export async function fetchClubs(force = false): Promise<Club[]> {
  if (!force && clubsCache) return clubsCache
  if (!force && clubsPromise) return clubsPromise
  clubsPromise = getJson<Club[]>(`${FFVOLLEY}/v3/clubs`, { retries: 2 })
    .then((list) => {
      clubsCache = (list || []).filter((c) => c.is_active !== false)
      return clubsCache
    })
    .catch((err) => {
      clubsPromise = null
      throw err
    })
  return clubsPromise
}

export async function fetchLiveMatches(): Promise<LiveMatch[]> {
  try {
    const data = await getJson<{ matches: LiveMatch[]; count: number }>(`${FFVB}/fetch_matches`)
    return data.matches || []
  } catch {
    return getJson<LiveMatch[]>(`${FFVOLLEY}/v3/livescore/matches`, { retries: 2 })
  }
}

export interface LiveSet {
  id: number
  set_number: number
  local_score: number
  visitor_score: number
  winner: string | null
  local_side?: string
  visitor_side?: string
  started_at?: string | null
  ended_at?: string | null
}

export interface LivePlayer {
  id: number
  team: 'local' | 'visitor' | string
  role: string | null
  licence?: string
  first_name: string
  last_name: string
  shirt_number: number | null
  is_pipi?: boolean
}

export interface LiveEvent {
  id: number
  event_type: string
  timestamp: string
  set_number: number
  score_local: number | null
  score_visitor: number | null
  new_score_local: number | null
  new_score_visitor: number | null
  team_name: string | null
  service_team?: string | null
  comment?: string | null
}

export interface LiveMatchDetail extends LiveMatch {
  pool?: string | null
  address?: string | null
  hall?: string | null
  type_set?: string | null
  match_nb_set?: number
  match_nb_point_set?: number
  match_nb_point_set_tie_break?: number
  sets?: LiveSet[]
  players?: LivePlayer[]
  officials?: Array<{
    role?: string
    first_name?: string
    last_name?: string
    name?: string
  }>
}

export async function fetchLiveMatchDetail(matchUuid: string): Promise<LiveMatchDetail> {
  return getJson(`${FFVOLLEY}/v3/livescore/matches/${encodeURIComponent(matchUuid)}`)
}

export async function fetchLiveMatchEvents(matchUuid: string): Promise<LiveEvent[]> {
  return getJson(`${FFVOLLEY}/v3/livescore/matches/${encodeURIComponent(matchUuid)}/events`)
}

export async function fetchLiveMatchSets(matchUuid: string): Promise<LiveSet[]> {
  return getJson(`${FFVOLLEY}/v3/livescore/matches/${encodeURIComponent(matchUuid)}/sets`)
}

/* ─── Helpers ─── */

export function detectGender(name: string): 'F' | 'M' | null {
  const n = (name || '').toUpperCase()
  if (/FEMIN|FILLE|DAMES|\bFEM\b|\bF\.\b/.test(n) && !/MASCUL/.test(n)) return 'F'
  if (/MASCUL|GARCON|HOMME|AVENIR|\bMES\b/.test(n)) return 'M'
  return null
}

export function nationalGroup(pouleId: string): string {
  const prefix = (pouleId || '').slice(0, 2).toUpperCase()
  const map: Record<string, string> = {
    EF: 'Élite Féminine',
    EM: 'Élite Masculine',
    EA: 'Élite Avenir',
    '2F': 'Nationale 2 Féminine',
    '2M': 'Nationale 2 Masculine',
    '3F': 'Nationale 3 Féminine',
    '3M': 'Nationale 3 Masculine',
  }
  return map[prefix] || 'Autres / Phases finales'
}

export function parseSets(detail?: string): { home: number; away: number }[] {
  if (!detail) return []
  return detail.split(',').map((s) => {
    const [a, b] = s.trim().split(':').map((x) => Number(x.trim()))
    return { home: a || 0, away: b || 0 }
  })
}

export function formatMatchDate(date: string, time?: string): string {
  if (!date) return ''
  const m = date.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (m) {
    const [, d, mo, y] = m
    const full = `20${y}-${mo}-${d}`
    try {
      const dt = new Date(`${full}T${(time || '12:00').padStart(5, '0')}:00`)
      const label = dt.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
      return time ? `${label} · ${time}` : label
    } catch {
      return time ? `${date} · ${time}` : date
    }
  }
  try {
    const dt = new Date(date)
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  } catch {
    /* ignore */
  }
  return date
}

export function formatDuration(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null
  const min = Math.round((b - a) / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h${m.toString().padStart(2, '0')}`
}

export const DEPT_NAMES: Record<string, string> = {
  '001': 'Ain',
  '002': 'Aisne',
  '003': 'Allier',
  '004': 'Alpes-de-Haute-Provence',
  '005': 'Hautes-Alpes',
  '006': 'Alpes-Maritimes',
  '007': 'Ardèche',
  '008': 'Ardennes',
  '009': 'Ariège',
  '010': 'Aube',
  '011': 'Aude',
  '012': 'Aveyron',
  '013': 'Bouches-du-Rhône',
  '014': 'Calvados',
  '015': 'Cantal',
  '016': 'Charente',
  '017': 'Charente-Maritime',
  '018': 'Cher',
  '019': 'Corrèze',
  '02A': 'Corse-du-Sud',
  '02B': 'Haute-Corse',
  '021': 'Côte-d’Or',
  '022': 'Côtes-d’Armor',
  '023': 'Creuse',
  '024': 'Dordogne',
  '025': 'Doubs',
  '026': 'Drôme',
  '027': 'Eure',
  '028': 'Eure-et-Loir',
  '029': 'Finistère',
  '030': 'Gard',
  '031': 'Haute-Garonne',
  '032': 'Gers',
  '033': 'Gironde',
  '034': 'Hérault',
  '035': 'Ille-et-Vilaine',
  '036': 'Indre',
  '037': 'Indre-et-Loire',
  '038': 'Isère',
  '039': 'Jura',
  '040': 'Landes',
  '041': 'Loir-et-Cher',
  '042': 'Loire',
  '043': 'Haute-Loire',
  '044': 'Loire-Atlantique',
  '045': 'Loiret',
  '046': 'Lot',
  '047': 'Lot-et-Garonne',
  '048': 'Lozère',
  '049': 'Maine-et-Loire',
  '050': 'Manche',
  '051': 'Marne',
  '052': 'Haute-Marne',
  '053': 'Mayenne',
  '054': 'Meurthe-et-Moselle',
  '055': 'Meuse',
  '056': 'Morbihan',
  '057': 'Moselle',
  '058': 'Nièvre',
  '059': 'Nord',
  '060': 'Oise',
  '061': 'Orne',
  '062': 'Pas-de-Calais',
  '063': 'Puy-de-Dôme',
  '064': 'Pyrénées-Atlantiques',
  '065': 'Hautes-Pyrénées',
  '066': 'Pyrénées-Orientales',
  '067': 'Bas-Rhin',
  '068': 'Haut-Rhin',
  '069': 'Rhône',
  '070': 'Haute-Saône',
  '071': 'Saône-et-Loire',
  '072': 'Sarthe',
  '073': 'Savoie',
  '074': 'Haute-Savoie',
  '075': 'Paris',
  '076': 'Seine-Maritime',
  '077': 'Seine-et-Marne',
  '078': 'Yvelines',
  '079': 'Deux-Sèvres',
  '080': 'Somme',
  '081': 'Tarn',
  '082': 'Tarn-et-Garonne',
  '083': 'Var',
  '084': 'Vaucluse',
  '085': 'Vendée',
  '086': 'Vienne',
  '087': 'Haute-Vienne',
  '088': 'Vosges',
  '089': 'Yonne',
  '090': 'Territoire de Belfort',
  '091': 'Essonne',
  '092': 'Hauts-de-Seine',
  '093': 'Seine-Saint-Denis',
  '094': 'Val-de-Marne',
  '095': 'Val-d’Oise',
  '971': 'Guadeloupe',
  '972': 'Martinique',
  '973': 'Guyane',
  '974': 'La Réunion',
  '976': 'Mayotte',
}

export function deptLabel(id: string): string {
  const key = (id || '').padStart(3, '0')
  const name = DEPT_NAMES[key] || DEPT_NAMES[id]
  const num = key.replace(/^0+/, '') || id
  return name ? `${num} — ${name}` : id
}

export const PRATIQUE_LABELS: Record<string, string> = {
  vb: 'Volley indoor',
  bv: 'Beach-volley',
  competlib: 'Compet’Lib',
  soft: 'Soft volley',
  sitting: 'Sitting volley',
}

export function clubSearchText(c: Club): string {
  return [c.name, c.ville, c.cpostal, c.email, deptLabel(c.id_dept)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function sortMatchesChrono(matches: Match[], dir: 'asc' | 'desc' = 'desc'): Match[] {
  const toKey = (m: Match) => {
    const mm = m.date?.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
    if (mm) {
      return `20${mm[3]}-${mm[2]}-${mm[1]}T${m.time || '00:00'}`
    }
    return m.date || ''
  }
  return [...matches].sort((a, b) => {
    const ka = toKey(a)
    const kb = toKey(b)
    return dir === 'asc' ? ka.localeCompare(kb) : kb.localeCompare(ka)
  })
}
