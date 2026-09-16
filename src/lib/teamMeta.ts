/**
 * Métadonnées compétition (catégorie d’âge + genre) à partir du nom de poule FFVB.
 * Affichage type Blockout : M18 · Féminin, Senior · Masculin, etc.
 */

export type TeamGender = 'F' | 'M'

export interface CompetitionMeta {
  /** Ex. Senior, M21, M18, M15, M13, M11, Loisir */
  category: string
  /** F / M si détectable */
  gender: TeamGender | null
  /** Niveau lisible : Nationale, Pré-nationale, Régionale, Départementale… */
  level: string | null
  /** Phase / précision courte (Excellence, Honneur…) */
  phase: string | null
  /** Libellé compact pour badge : "M18 Fém." */
  badge: string
  /** Libellé long : "M18 · Féminin · Régionale" */
  label: string
}

const GENDER_F =
  /\b(FEMININ|FEMININE|FEMININES|FÉMININ|FÉMININE|FÉMININES|FILLES?|DAMES|BENJAMINES|MINIMES\s+FEM|\bFÉM\b|\bFEM\b|FÉM\.|FEM\.)\b/i
const GENDER_M =
  /\b(MASCULIN|MASCULINS|MASCULINE|MASCULINES|GARCONS?|GARÇONS?|HOMMES?|MESSIEURS|BENJAMINS\b|MINIMES\s+MAS|\bMAS\b|MAS\.|MASC\.)\b/i

/** Détection genre depuis un libellé poule / compétition */
export function detectGenderFromText(text: string): TeamGender | null {
  const t = (text || '').toUpperCase().normalize('NFD').replace(/\p{M}/gu, '')
  // Explicit feminine markers first (BENJAMINES before BENJAMINS)
  if (
    /FEMIN|FILLE|DAMES|\bFEM\b|FÉM|BENJAMINES|MINIMES FEM|\bF\b\s*-|\sF\s/.test(t) &&
    !/MASCULIN|GARCON|HOMME|\bMES\b/.test(t.replace(/FEMININ\w*/g, ''))
  ) {
    // Careful: "Fém." in M18 Fém.
    if (GENDER_F.test(text) || /\bFÉM\b|\bFEM\b|FÉMIN|FEMIN|BENJAMINES/i.test(text)) return 'F'
  }
  if (GENDER_F.test(text)) return 'F'
  if (GENDER_M.test(text)) return 'M'
  // Poule codes often encode gender: 1FA, PMB, CFH (C=cadet? F=fem), CMA
  const code = (text || '').trim().toUpperCase()
  if (/^[A-Z0-9]*F[A-Z0-9]*$/.test(code) && !/^[A-Z0-9]*M[A-Z0-9]*$/.test(code)) {
    // ambiguous single letter
  }
  return null
}

function detectCategory(text: string): string {
  const t = (text || '').toUpperCase().normalize('NFD').replace(/\p{M}/gu, '')

  // Age categories — order matters (M21 before M2, etc.)
  if (/\bM\s*21\b|\bU\s*21\b|JUNIORS?/.test(t) && !/\bM\s*18\b/.test(t)) return 'M21'
  if (/\bM\s*18\b|\bU\s*18\b|CADETS?|CADETTES?/.test(t)) return 'M18'
  if (/\bM\s*17\b|\bU\s*17\b/.test(t)) return 'M17'
  if (/\bM\s*15\b|\bU\s*15\b|MINIMES?/.test(t)) return 'M15'
  if (/\bM\s*13\b|\bU\s*13\b|BENJAMIN/.test(t)) return 'M13'
  if (/\bM\s*11\b|\bU\s*11\b|POUSSIN/.test(t)) return 'M11'
  if (/\bM\s*9\b|\bU\s*9\b|BABY/.test(t)) return 'M9'
  if (/LOISIR|DETENTE|DÉTENTE|CORPO|COMPET.?LIB|SOFT/.test(t)) return 'Loisir'
  if (/VETERAN|VÉTÉRAN|SENOIRS\b/.test(t)) return 'Vétéran'
  if (/AVENIR/.test(t)) return 'Avenir'
  if (/SENIOR|SENIORS|PRE-?NATIONALE|REGIONALE\s*[123]|RÉGIONALE\s*[123]|DEPARTEMENTALE|DÉPARTEMENTALE|NATIONALE\s*[23]|ELITE|ÉLITE|ACCESSION/.test(t)) {
    return 'Senior'
  }
  // National prefixes in poule id alone handled by caller
  return 'Senior'
}

function detectLevel(text: string): string | null {
  const t = (text || '').toUpperCase().normalize('NFD').replace(/\p{M}/gu, '')
  if (/ELITE|ÉLITE|LIGUE\s*A|LAM|LAF/.test(t)) return 'Élite'
  if (/NATIONALE\s*2|\bN2\b|\b2F\b|\b2M\b/.test(t)) return 'Nationale 2'
  if (/NATIONALE\s*3|\bN3\b|\b3F\b|\b3M\b/.test(t)) return 'Nationale 3'
  if (/PRE-?NATIONALE|PRÉ-?NATIONALE|\bPN[MF]/.test(t)) return 'Pré-nationale'
  if (/ACCESSION/.test(t)) return 'Accession régionale'
  if (/DEPARTEMENTALE|DÉPARTEMENTALE|\bD1\b|\bDEPT/.test(t)) return 'Départementale'
  if (/REGIONAL\w*\s*1|RÉGIONAL\w*\s*1|\bR1\b/.test(t)) return 'Régionale 1'
  if (/REGIONAL\w*\s*2|RÉGIONAL\w*\s*2|\bR2\b/.test(t)) return 'Régionale 2'
  if (/REGIONAL\w*\s*3|RÉGIONAL\w*\s*3|\bR3\b/.test(t)) return 'Régionale 3'
  if (/REGIONAL|RÉGIONAL/.test(t)) return 'Régionale'
  if (/INTERDEP|INTER-?DEP/.test(t)) return 'Interdépartementale'
  if (/NATIONAL/.test(t)) return 'Nationale'
  return null
}

function detectPhase(text: string): string | null {
  const t = (text || '').toUpperCase().normalize('NFD').replace(/\p{M}/gu, '')
  if (/EXCELLENCE/.test(t)) return 'Excellence'
  if (/HONNEUR/.test(t)) return 'Honneur'
  if (/PROMOTION/.test(t)) return 'Promotion'
  if (/1\s*ere\s*PHASE|1ERE\s*PHASE|1ÈRE\s*PHASE|PHASE\s*1/.test(t)) return 'Phase 1'
  if (/2\s*eme\s*PHASE|2EME\s*PHASE|2ÈME\s*PHASE|PHASE\s*2/.test(t)) return 'Phase 2'
  if (/POLE|PÔLE/.test(t)) return 'Pôle'
  if (/4\s*x\s*4|4X4/.test(t)) return '4x4'
  if (/6\s*x\s*6|6X6/.test(t)) return '6x6'
  return null
}

function genderShort(g: TeamGender | null): string {
  if (g === 'F') return 'Fém.'
  if (g === 'M') return 'Masc.'
  return ''
}

function genderLong(g: TeamGender | null): string {
  if (g === 'F') return 'Féminin'
  if (g === 'M') return 'Masculin'
  return ''
}

/**
 * Parse poule_name / label FFVB → meta compétition.
 * Ex. "CMF - M18 Mas. 6x6 2ème Phase Régionale 1 HDF Nord Poule B"
 */
export function parseCompetitionMeta(
  pouleName?: string | null,
  pouleCode?: string | null,
): CompetitionMeta {
  const raw = [pouleName || '', pouleCode || ''].filter(Boolean).join(' · ')
  const text = raw || ''

  let gender = detectGenderFromText(text)

  // Poule code heuristics: *F* often féminin for youth (CFA, 1FA, PFA), *M* masculin
  if (!gender && pouleCode) {
    const c = pouleCode.toUpperCase()
    if (/F/.test(c) && !/M/.test(c)) gender = 'F'
    else if (/M/.test(c) && !/F/.test(c)) gender = 'M'
    // 1FA / 1FB féminin, 1MA masculin
    if (/^\d*F/.test(c)) gender = 'F'
    if (/^\d*M/.test(c)) gender = 'M'
    if (/^[PJTC]F/.test(c)) gender = 'F'
    if (/^[PJTC]M/.test(c)) gender = 'M'
    if (/^PF/.test(c) || /^AF/.test(c) || /^DF/.test(c)) gender = 'F'
    if (/^PM/.test(c) || /^AM/.test(c) || /^DM/.test(c)) gender = 'M'
  }

  const category = detectCategory(text)
  const level = detectLevel(text)
  const phase = detectPhase(text)

  const gShort = genderShort(gender)
  const badge = [category, gShort].filter(Boolean).join(' ')
  const label = [category, genderLong(gender), level, phase].filter(Boolean).join(' · ')

  return {
    category,
    gender,
    level,
    phase,
    badge: badge || 'Compétition',
    label: label || badge || 'Compétition',
  }
}

/** Ordre d’affichage type Blockout */
const CATEGORY_ORDER = [
  'Senior',
  'Avenir',
  'M21',
  'M18',
  'M17',
  'M15',
  'M13',
  'M11',
  'M9',
  'Vétéran',
  'Loisir',
]

export function categorySortKey(cat: string): number {
  const i = CATEGORY_ORDER.indexOf(cat)
  return i >= 0 ? i : 50
}

export function genderLabel(g: TeamGender | null | undefined): string {
  return genderLong(g || null) || 'Mixte / ND'
}
