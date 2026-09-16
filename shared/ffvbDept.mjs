/**
 * Championnats départementaux FFVB — scrape ffvbbeach.org (même source que le site officiel).
 * L’API volley-ball.vercel.app ne couvre que national + ligues régionales (LIFL…).
 */

const FFVB_RESU = 'https://www.ffvbbeach.org/ffvbapp/resu'
const UA = 'VolleyFrance/1.0 (+dept-bridge; contact local)'

/** @typedef {{ codent: string, name: string, dept: string, ligueCodent: string, ligueName: string }} Department */

/** Catalogue aligné sur https://www.ffvb.org/front/122-37-1-Championnats-Departementaux */
/** @type {Department[]} */
export const DEPARTMENTS = [
  // Auvergne-Rhône-Alpes
  { codent: 'PTRA01', dept: '01', name: 'Ain', ligueCodent: 'LIRA', ligueName: 'AUVERGNE-RHÔNE-ALPES' },
  { codent: 'PTRA26', dept: '07/26', name: 'Drôme-Ardèche', ligueCodent: 'LIRA', ligueName: 'AUVERGNE-RHÔNE-ALPES' },
  { codent: 'PTAU15', dept: '15', name: 'Cantal', ligueCodent: 'LIRA', ligueName: 'AUVERGNE-RHÔNE-ALPES' },
  { codent: 'PTRA38', dept: '38', name: 'Isère', ligueCodent: 'LIRA', ligueName: 'AUVERGNE-RHÔNE-ALPES' },
  { codent: 'PTRA42', dept: '42', name: 'Loire', ligueCodent: 'LIRA', ligueName: 'AUVERGNE-RHÔNE-ALPES' },
  { codent: 'PTAU43', dept: '43', name: 'Haute-Loire', ligueCodent: 'LIRA', ligueName: 'AUVERGNE-RHÔNE-ALPES' },
  { codent: 'PTAU63', dept: '63', name: 'Puy-de-Dôme', ligueCodent: 'LIRA', ligueName: 'AUVERGNE-RHÔNE-ALPES' },
  { codent: 'PTRA69', dept: '69', name: 'Rhône / Métropole de Lyon', ligueCodent: 'LIRA', ligueName: 'AUVERGNE-RHÔNE-ALPES' },
  // Bourgogne-Franche-Comté
  { codent: 'PTBO21', dept: '21', name: "Côte-d'Or", ligueCodent: 'LIBOUR', ligueName: 'BOURGOGNE-FRANCHE-COMTE' },
  { codent: 'PTBO71', dept: '71', name: 'Saône-et-Loire', ligueCodent: 'LIBOUR', ligueName: 'BOURGOGNE-FRANCHE-COMTE' },
  { codent: 'PTBO89', dept: '89', name: 'Yonne', ligueCodent: 'LIBOUR', ligueName: 'BOURGOGNE-FRANCHE-COMTE' },
  // Bretagne
  { codent: 'PTBR22', dept: '22', name: "Côtes-d'Armor", ligueCodent: 'LIBR', ligueName: 'BRETAGNE' },
  { codent: 'PTBR29', dept: '29', name: 'Finistère', ligueCodent: 'LIBR', ligueName: 'BRETAGNE' },
  { codent: 'PTBR35', dept: '35', name: 'Ille-et-Vilaine', ligueCodent: 'LIBR', ligueName: 'BRETAGNE' },
  { codent: 'PTBR56', dept: '56', name: 'Morbihan', ligueCodent: 'LIBR', ligueName: 'BRETAGNE' },
  // Centre-Val de Loire
  { codent: 'PTCE28', dept: '28', name: 'Eure-et-Loir', ligueCodent: 'LICE', ligueName: 'CENTRE-VAL DE LOIRE' },
  { codent: 'PTCE37', dept: '37', name: 'Indre-et-Loire', ligueCodent: 'LICE', ligueName: 'CENTRE-VAL DE LOIRE' },
  { codent: 'PTCE45', dept: '45', name: 'Loiret', ligueCodent: 'LICE', ligueName: 'CENTRE-VAL DE LOIRE' },
  // Grand Est
  { codent: 'PTLO52', dept: '52', name: 'Haute-Marne', ligueCodent: 'LILO', ligueName: 'GRAND EST' },
  { codent: 'PTLO54', dept: '54', name: 'Meurthe-et-Moselle', ligueCodent: 'LILO', ligueName: 'GRAND EST' },
  { codent: 'PTLO57', dept: '57', name: 'Moselle', ligueCodent: 'LILO', ligueName: 'GRAND EST' },
  { codent: 'PTAL67', dept: '67', name: 'Bas-Rhin', ligueCodent: 'LILO', ligueName: 'GRAND EST' },
  { codent: 'PTAL68', dept: '68', name: 'Haut-Rhin', ligueCodent: 'LILO', ligueName: 'GRAND EST' },
  { codent: 'PTLO88', dept: '88', name: 'Vosges', ligueCodent: 'LILO', ligueName: 'GRAND EST' },
  // Hauts-de-France
  { codent: 'PTPI02', dept: '02', name: 'Aisne', ligueCodent: 'LIFL', ligueName: 'HAUTS-DE-FRANCE' },
  { codent: 'PTFL59', dept: '59', name: 'Nord', ligueCodent: 'LIFL', ligueName: 'HAUTS-DE-FRANCE' },
  { codent: 'PTPI60', dept: '60', name: 'Oise', ligueCodent: 'LIFL', ligueName: 'HAUTS-DE-FRANCE' },
  { codent: 'PTFL62', dept: '62', name: 'Pas-de-Calais', ligueCodent: 'LIFL', ligueName: 'HAUTS-DE-FRANCE' },
  { codent: 'PTPI80', dept: '80', name: 'Somme', ligueCodent: 'LIFL', ligueName: 'HAUTS-DE-FRANCE' },
  // Île-de-France
  { codent: 'PTIDF75', dept: '75', name: 'Paris', ligueCodent: 'LIIDF', ligueName: 'ILE-DE-FRANCE' },
  { codent: 'PTIDF77', dept: '77', name: 'Seine-et-Marne', ligueCodent: 'LIIDF', ligueName: 'ILE-DE-FRANCE' },
  { codent: 'PTIDF78', dept: '78', name: 'Yvelines', ligueCodent: 'LIIDF', ligueName: 'ILE-DE-FRANCE' },
  { codent: 'PTIDF91', dept: '91', name: 'Essonne', ligueCodent: 'LIIDF', ligueName: 'ILE-DE-FRANCE' },
  { codent: 'PTIDF92', dept: '92', name: 'Hauts-de-Seine', ligueCodent: 'LIIDF', ligueName: 'ILE-DE-FRANCE' },
  { codent: 'PTIDF93', dept: '93', name: 'Seine-Saint-Denis', ligueCodent: 'LIIDF', ligueName: 'ILE-DE-FRANCE' },
  { codent: 'PTIDF94', dept: '94', name: 'Val-de-Marne', ligueCodent: 'LIIDF', ligueName: 'ILE-DE-FRANCE' },
  { codent: 'PTIDF95', dept: '95', name: "Val-d'Oise", ligueCodent: 'LIIDF', ligueName: 'ILE-DE-FRANCE' },
  // Normandie
  { codent: 'PTLB14', dept: '14', name: 'Calvados', ligueCodent: 'LILBNV', ligueName: 'NORMANDIE' },
  { codent: 'PTLH27', dept: '27', name: 'Eure', ligueCodent: 'LILBNV', ligueName: 'NORMANDIE' },
  { codent: 'PTLB50', dept: '50', name: 'Manche', ligueCodent: 'LILBNV', ligueName: 'NORMANDIE' },
  { codent: 'PTLH76', dept: '76', name: 'Seine-Maritime', ligueCodent: 'LILBNV', ligueName: 'NORMANDIE' },
  // Nouvelle-Aquitaine
  { codent: 'PTPO16', dept: '16', name: 'Charente', ligueCodent: 'LIAQ', ligueName: 'NOUVELLE AQUITAINE' },
  { codent: 'PTPO17', dept: '17', name: 'Charente-Maritime', ligueCodent: 'LIAQ', ligueName: 'NOUVELLE AQUITAINE' },
  { codent: 'PTAQ24', dept: '24', name: 'Dordogne', ligueCodent: 'LIAQ', ligueName: 'NOUVELLE AQUITAINE' },
  { codent: 'PTAQ33', dept: '33', name: 'Gironde', ligueCodent: 'LIAQ', ligueName: 'NOUVELLE AQUITAINE' },
  { codent: 'PTAQ40', dept: '40', name: 'Landes', ligueCodent: 'LIAQ', ligueName: 'NOUVELLE AQUITAINE' },
  { codent: 'PTAQ64', dept: '64', name: 'Pyrénées-Atlantiques', ligueCodent: 'LIAQ', ligueName: 'NOUVELLE AQUITAINE' },
  { codent: 'PTPO79', dept: '79', name: 'Deux-Sèvres', ligueCodent: 'LIAQ', ligueName: 'NOUVELLE AQUITAINE' },
  { codent: 'PTPO86', dept: '86', name: 'Vienne', ligueCodent: 'LIAQ', ligueName: 'NOUVELLE AQUITAINE' },
  // Occitanie
  { codent: 'PTLR11', dept: '11', name: 'Aude', ligueCodent: 'LILR', ligueName: 'OCCITANIE' },
  { codent: 'PTLR30', dept: '30', name: 'Gard', ligueCodent: 'LILR', ligueName: 'OCCITANIE' },
  { codent: 'PTMP31', dept: '31', name: 'Haute-Garonne', ligueCodent: 'LILR', ligueName: 'OCCITANIE' },
  { codent: 'PTLR34', dept: '34', name: 'Hérault', ligueCodent: 'LILR', ligueName: 'OCCITANIE' },
  { codent: 'PTMP65', dept: '65', name: 'Hautes-Pyrénées', ligueCodent: 'LILR', ligueName: 'OCCITANIE' },
  { codent: 'PTLR66', dept: '66', name: 'Pyrénées-Orientales', ligueCodent: 'LILR', ligueName: 'OCCITANIE' },
  { codent: 'PTMP81', dept: '81', name: 'Tarn', ligueCodent: 'LILR', ligueName: 'OCCITANIE' },
  { codent: 'PTMP82', dept: '82', name: 'Tarn-et-Garonne', ligueCodent: 'LILR', ligueName: 'OCCITANIE' },
  // Pays de la Loire
  { codent: 'PTPL44', dept: '44', name: 'Loire-Atlantique', ligueCodent: 'LIPL', ligueName: 'PAYS DE LA LOIRE' },
  { codent: 'PTPL49', dept: '49', name: 'Maine-et-Loire', ligueCodent: 'LIPL', ligueName: 'PAYS DE LA LOIRE' },
  { codent: 'PTPL53', dept: '53', name: 'Mayenne', ligueCodent: 'LIPL', ligueName: 'PAYS DE LA LOIRE' },
  { codent: 'PTPL72', dept: '72', name: 'Sarthe', ligueCodent: 'LIPL', ligueName: 'PAYS DE LA LOIRE' },
  { codent: 'PTPL85', dept: '85', name: 'Vendée', ligueCodent: 'LIPL', ligueName: 'PAYS DE LA LOIRE' },
  // PACA
  { codent: 'PTPR04', dept: '04/05', name: 'Alpes-de-Haute-Provence / Hautes-Alpes', ligueCodent: 'LICA', ligueName: "PROVENCE-ALPES-CÔTE D'AZUR" },
  { codent: 'PTCA06', dept: '06', name: 'Alpes-Maritimes', ligueCodent: 'LICA', ligueName: "PROVENCE-ALPES-CÔTE D'AZUR" },
  { codent: 'PTPR13', dept: '13', name: 'Bouches-du-Rhône', ligueCodent: 'LICA', ligueName: "PROVENCE-ALPES-CÔTE D'AZUR" },
  { codent: 'PTCA83', dept: '83', name: 'Var', ligueCodent: 'LICA', ligueName: "PROVENCE-ALPES-CÔTE D'AZUR" },
  { codent: 'PTPR84', dept: '84', name: 'Vaucluse', ligueCodent: 'LICA', ligueName: "PROVENCE-ALPES-CÔTE D'AZUR" },
]

const DEPT_BY_CODENT = new Map(DEPARTMENTS.map((d) => [d.codent.toUpperCase(), d]))

export function isDeptCodent(codent) {
  return DEPT_BY_CODENT.has(String(codent || '').toUpperCase())
}

export function getDepartment(codent) {
  return DEPT_BY_CODENT.get(String(codent || '').toUpperCase()) || null
}

/** Saison sportive FFVB juil→juin */
export function currentSeasonFull(now = new Date()) {
  const y = now.getFullYear()
  const month = now.getMonth() + 1
  const start = month >= 7 ? y : y - 1
  return `${start}/${start + 1}`
}

export function syntheticPouleId(codent, pouleCode) {
  const s = `${codent}:${pouleCode}`
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) || 1
}

function decodeHtml(buf) {
  // Pages FFVB souvent en latin-1 / windows-1252
  if (typeof buf === 'string') return buf
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  try {
    return new TextDecoder('latin1').decode(u8)
  } catch {
    return Buffer.from(u8).toString('latin1')
  }
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&eacute;/g, 'é')
    .replace(/&Eacute;/g, 'É')
    .replace(/&egrave;/g, 'è')
    .replace(/&agrave;/g, 'à')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchText(url, { method = 'GET', body, timeoutMs = 25_000 } = {}) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method,
      body,
      signal: ac.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/vnd.ms-excel,*/*',
        ...(body
          ? { 'Content-Type': 'application/x-www-form-urlencoded' }
          : {}),
      },
    })
    const ab = await res.arrayBuffer()
    const text = decodeHtml(ab)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} — ${url}`)
    }
    return text
  } finally {
    clearTimeout(t)
  }
}

export function listDepartments(ligueCodent) {
  const all = DEPARTMENTS.map((d) => ({
    ...d,
    label: `${d.dept} — ${d.name}`,
    type: 'departement',
  }))
  if (!ligueCodent) return all
  const key = String(ligueCodent).toUpperCase()
  return all.filter((d) => d.ligueCodent === key)
}

/**
 * Liste des poules d’un comité départemental (page d’accueil officielle).
 */
export async function scrapeDeptPoules(codent, saison) {
  const c = String(codent || '').toUpperCase()
  if (!isDeptCodent(c)) throw new Error(`Comité inconnu: ${codent}`)
  const season = saison || currentSeasonFull()
  const url = `${FFVB_RESU}/vbspo_home.php?saison=${encodeURIComponent(season)}&codent=${encodeURIComponent(c)}`
  const html = await fetchText(url)

  /** @type {Map<string, { poule_id: string, poule_name: string }>} */
  const map = new Map()

  // Liens calendrier : ...poule=DMA'>DMA Départementale…
  const re =
    /vbspo_calendrier\.php\?[^"'>\s]*[?&]poule=([A-Za-z0-9]+)[^"'>\s]*['"][^>]*>([^<]+)/gi
  let m
  while ((m = re.exec(html))) {
    const poule_id = m[1].toUpperCase()
    const poule_name = stripTags(m[2])
    if (!poule_id || poule_id.length > 6) continue
    if (!map.has(poule_id)) {
      map.set(poule_id, {
        poule_id,
        poule_name: poule_name || poule_id,
      })
    }
  }

  // Fallback: href='...poule=XXX'
  if (map.size === 0) {
    const re2 = /poule=([A-Za-z0-9]{2,5})['"&]/g
    while ((m = re2.exec(html))) {
      const poule_id = m[1].toUpperCase()
      if (!map.has(poule_id)) {
        map.set(poule_id, { poule_id, poule_name: poule_id })
      }
    }
  }

  const dept = getDepartment(c)
  const poules = [...map.values()]
    .sort((a, b) => a.poule_id.localeCompare(b.poule_id))
    .map((p, i) => ({
      id: syntheticPouleId(c, p.poule_id),
      poule_id: p.poule_id,
      poule_name: p.poule_name.startsWith(p.poule_id)
        ? p.poule_name
        : `${p.poule_id} - ${p.poule_name}`,
      label: p.poule_name.startsWith(p.poule_id)
        ? p.poule_name
        : `${p.poule_id} - ${p.poule_name}`,
      codent: c,
      saison: season,
      entity_name: dept ? `${dept.dept} — ${dept.name}` : c,
      source: 'ffvbbeach-dept',
      _order: i,
    }))

  return { codent: c, saison: season, count: poules.length, poules, source: 'ffvbbeach.org' }
}

function ymdToFr(date) {
  // 2025-09-27 → 27/09/25
  const m = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return date || ''
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`
}

function parseSetScore(setField, scoreField) {
  // Set: " 3/1"  Score: "25-20,26-28,..."
  let score_home = null
  let score_away = null
  const sm = String(setField || '').match(/(\d+)\s*\/\s*(\d+)/)
  if (sm) {
    score_home = Number(sm[1])
    score_away = Number(sm[2])
  }
  const sets_detail = String(scoreField || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/-/g, ':'))
    .join(',')
  return { score_home, score_away, sets_detail: sets_detail || undefined }
}

/**
 * Matchs d’une poule via export Excel CSV (même data que le site officiel).
 */
export async function scrapeDeptMatches(codent, poule, saison) {
  const c = String(codent || '').toUpperCase()
  const p = String(poule || '').toUpperCase()
  if (!isDeptCodent(c)) throw new Error(`Comité inconnu: ${codent}`)
  if (!p) throw new Error('poule requis')
  const season = saison || currentSeasonFull()

  const body = new URLSearchParams({
    cal_saison: season,
    cal_codent: c,
    cal_codpoule: p,
    cal_coddiv: '',
    cal_codtour: '',
    typ_edition: 'E',
    type: 'RES',
    rech_equipe: '',
  }).toString()

  const csv = await fetchText(`${FFVB_RESU}/vbspo_calendrier_export.php`, {
    method: 'POST',
    body,
  })

  const lines = csv.split(/\r?\n/).filter((l) => l.trim())
  const dept = getDepartment(c)
  const matches = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (i === 0 && /Entit/i.test(line)) continue
    // CSV séparateur ;
    const cols = line.split(';')
    if (cols.length < 9) continue
    const [
      entite,
      jo,
      matchId,
      dateIso,
      heure,
      ,
      home,
      ,
      away,
      setField,
      scoreField,
      ,
      salle,
      arb1,
    ] = cols

    const homeName = (home || '').trim()
    const awayName = (away || '').trim()
    if (!matchId && !homeName && !awayName) continue
    // Placeholder rows
    if (/^x+$/i.test(homeName) || /^x+$/i.test(awayName)) {
      // still keep as scheduled if other side exists
    }

    const { score_home, score_away, sets_detail } = parseSetScore(setField, scoreField)
    const played =
      score_home != null &&
      score_away != null &&
      !(score_home === 0 && score_away === 0 && !sets_detail)
    const forfeit = /forfait/i.test(homeName + ' ' + awayName)
    let status = 'scheduled'
    if (played || forfeit) status = 'completed'

    matches.push({
      match_id: `${c}-${matchId || `${p}-${i}`}`,
      date: ymdToFr(dateIso),
      time: (heure || '').trim().slice(0, 5),
      team_home: homeName || '—',
      team_away: awayName || '—',
      score_home: played ? score_home : null,
      score_away: played ? score_away : null,
      sets_detail: played ? sets_detail : undefined,
      status,
      tour: jo ? `Journée ${String(jo).padStart(2, '0')}` : undefined,
      referee: (arb1 || '').trim() || undefined,
      poule_code: p,
      poule_id: syntheticPouleId(c, p),
      poule_name: p,
      codent: c,
      entity_name: dept ? `${dept.dept} — ${dept.name}` : entite || c,
      saison: season,
      venue: (salle || '').trim() || undefined,
      source: 'ffvbbeach-dept',
    })
  }

  return {
    codent: c,
    poule: p,
    saison: season,
    count: matches.length,
    total: matches.length,
    matches,
    source: 'ffvbbeach.org',
  }
}

/**
 * Classement HTML de la page calendrier officielle.
 */
export async function scrapeDeptRankings(codent, poule, saison) {
  const c = String(codent || '').toUpperCase()
  const p = String(poule || '').toUpperCase()
  if (!isDeptCodent(c)) throw new Error(`Comité inconnu: ${codent}`)
  if (!p) throw new Error('poule requis')
  const season = saison || currentSeasonFull()

  const url = `${FFVB_RESU}/vbspo_calendrier.php?saison=${encodeURIComponent(season)}&codent=${encodeURIComponent(c)}&poule=${encodeURIComponent(p)}`
  const html = await fetchText(url)

  const titleMatch =
    html.match(/class='titreblanc'[^>]*>([^<]*?-\s*[^<]+)</i) ||
    html.match(/class="titreblanc"[^>]*>([^<]*?-\s*[^<]+)</i)
  const poule_name = titleMatch ? stripTags(titleMatch[1]) : p

  const trs = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
  let headerIdx = -1
  for (let i = 0; i < trs.length; i++) {
    const plain = stripTags(trs[i])
    if (plain.includes('Pts.P') && plain.includes('Set.P')) {
      headerIdx = i
      break
    }
  }

  const rankings = []
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < trs.length; i++) {
      const tds = [...trs[i].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((x) =>
        stripTags(x[1]),
      )
      if (!tds.length) continue
      const rankM = tds[0].match(/^(\d+)\.?$/)
      if (!rankM) {
        if (rankings.length) break
        continue
      }
      // Colonnes observées:
      // 0 rank, 1 team, 2 points, 3 joués, 4 gagnés, 5 perdus?, ... Set.P Set.C ... Pts.P Pts.C
      // Indices stables d’après header Points Jou. Gag. Per. F. 3-0… Set.P Set.C Coeff.S Pts.P Pts.C
      const num = (v) => {
        const s = String(v ?? '').replace(',', '.').trim()
        if (!s) return null
        const n = Number(s)
        return Number.isFinite(n) ? n : null
      }
      const team = tds[1] || ''
      if (!team) continue
      const played = num(tds[3])
      const won = num(tds[4])
      let lost = num(tds[5])
      // Cellule vide côté FFVB = 0 (ex. 14 joués / 14 gagnés / — perdus)
      if (lost == null && played != null && won != null) {
        lost = Math.max(0, played - won)
      }
      rankings.push({
        rank: Number(rankM[1]),
        team,
        points: num(tds[2]),
        played,
        won,
        lost,
        forfeit: num(tds[6]),
        sets_won: num(tds[13]),
        sets_lost: num(tds[14]),
        pts_won: num(tds[16]),
        pts_lost: num(tds[17]),
        poule_id: syntheticPouleId(c, p),
        poule_name,
      })
    }
  }

  return {
    codent: c,
    poule: p,
    saison: season,
    poule_name,
    count: rankings.length,
    rankings,
    source: 'ffvbbeach.org',
  }
}

/**
 * Route handler partagé pour /ffvb-api/departments* et interception codent départemental.
 * @returns {Promise<{ status: number, body: string, ctype: string } | null>}
 */
export async function handleDeptApi(subPath, query) {
  const path = String(subPath || '').replace(/^\//, '').replace(/\/$/, '')
  const q = query || {}
  const saison = q.saison || q.season || currentSeasonFull()

  try {
    // GET departments
    if (path === 'departments' || path === 'dept' || path === 'departements') {
      const list = listDepartments(q.ligue || q.codent_ligue)
      return json(200, {
        count: list.length,
        departments: list,
        saison,
        source: 'ffvb.org catalogue + ffvbbeach.org',
        note:
          'Données matchs/classements scrapées en direct depuis le site officiel ffvbbeach.org',
      })
    }

    // GET departments/:codent/poules
    let m = path.match(/^departments\/([A-Za-z0-9]+)\/poules$/)
    if (m) {
      const data = await scrapeDeptPoules(m[1], saison)
      return json(200, data)
    }

    // GET departments/:codent/matches?poule=
    m = path.match(/^departments\/([A-Za-z0-9]+)\/matches$/)
    if (m) {
      if (!q.poule) return json(400, { error: 'Paramètre poule requis' })
      const data = await scrapeDeptMatches(m[1], q.poule, saison)
      // Optional status filter
      let matches = data.matches
      if (q.status === 'completed') matches = matches.filter((x) => x.status === 'completed')
      if (q.status === 'scheduled') matches = matches.filter((x) => x.status === 'scheduled')
      const limit = q.limit ? Number(q.limit) : matches.length
      matches = matches.slice(0, limit)
      return json(200, { ...data, matches, count: matches.length })
    }

    // GET departments/:codent/rankings?poule=
    m = path.match(/^departments\/([A-Za-z0-9]+)\/rankings$/)
    if (m) {
      if (!q.poule) return json(400, { error: 'Paramètre poule requis' })
      const data = await scrapeDeptRankings(m[1], q.poule, saison)
      return json(200, data)
    }

    // Shorthand: poules?codent=PTFL59 — if dept codent, scrape instead of upstream
    if ((path === 'poules' || path === '') && q.codent && isDeptCodent(q.codent)) {
      const data = await scrapeDeptPoules(q.codent, saison)
      return json(200, data)
    }

    if (path === 'matches' && q.codent && isDeptCodent(q.codent) && q.poule) {
      const data = await scrapeDeptMatches(q.codent, q.poule, saison)
      let matches = data.matches
      if (q.status === 'completed') matches = matches.filter((x) => x.status === 'completed')
      if (q.status === 'scheduled') matches = matches.filter((x) => x.status === 'scheduled')
      if (q.limit) matches = matches.slice(0, Number(q.limit) || matches.length)
      return json(200, { ...data, matches, count: matches.length })
    }

    return null
  } catch (err) {
    return json(502, {
      error: 'Données départementales indisponibles',
      detail: String(err?.message || err),
      path,
    })
  }
}

function json(status, obj) {
  return {
    status,
    body: JSON.stringify(obj),
    ctype: 'application/json; charset=utf-8',
  }
}
