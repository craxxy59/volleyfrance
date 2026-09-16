export type Gender = 'F' | 'M' | 'all'

export interface Entity {
  codent: string
  name: string
  type: string
}

export interface Poule {
  id: number
  poule_id: string
  poule_name: string
  label?: string
  codent: string
  saison: string
}

export interface Match {
  match_id: string
  date: string
  time: string
  team_home: string
  team_away: string
  score_home: number | null
  score_away: number | null
  sets_detail?: string
  points_home?: number | null
  points_away?: number | null
  status: string
  tour?: string
  referee?: string
  poule_code: string
  poule_id?: number
  poule_name?: string
  codent: string
  entity_name?: string
  saison?: string
}

export interface RankingRow {
  rank: number
  team: string
  played: number | null
  won: number | null
  lost: number | null
  points: number | null
  sets_won: number | null
  sets_lost: number | null
  pts_won: number | null
  pts_lost: number | null
  forfeit: number | null
  poule_id?: number
  poule_name?: string
}

export interface Club {
  id_club: string
  id_dept: string
  id_ligue: string
  name: string
  telfixe: string
  telport: string
  email: string
  website: string
  adresse: string | null
  cpostal: string
  ville: string | null
  pratiques: string[]
  is_active: boolean
  mon_club_active?: boolean
  helloasso_slug?: string | null
}

export interface LiveMatch {
  id: number
  match_id: string
  match_number: string
  status: string
  entite_code: string | null
  entite_label: string | null
  date: string | null
  city: string | null
  compet: string | null
  category: string | null
  division: string | null
  match_type: string | null
  match_players_mode: string | null
  local_team_name: string | null
  visitor_team_name: string | null
  local_score: number
  visitor_score: number
  winner: string | null
  started_at: string | null
  ended_at: string | null
  updated_at: string | null
}

export interface Stats {
  total_matches: number
  total_poules: number
  total_entities?: number
  matches_by_status: {
    completed?: number
    scheduled?: number
  }
}

export type FavoriteKind = 'team' | 'club' | 'poule'

export interface Favorite {
  id: string
  kind: FavoriteKind
  label: string
  meta?: string
  // For poules
  pouleNumericId?: number
  pouleCode?: string
  codent?: string
  national?: boolean
}
