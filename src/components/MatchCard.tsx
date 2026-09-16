import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Match } from '../types'
import { formatMatchDate, parseSets } from '../lib/api'
import { cacheMatch, displayScores, matchBucket } from '../lib/matchStore'
import { FollowButton } from './FollowButton'
import { useFavorites } from '../hooks/useFavorites'
import { teamFavId } from '../lib/favorites'

interface Props {
  match: Match
  showPoule?: boolean
  highlightTeams?: string[]
}

export function MatchCard({ match, showPoule = true, highlightTeams = [] }: Props) {
  const navigate = useNavigate()
  const { isFavorite } = useFavorites()
  const bucket = matchBucket(match.status)
  const scores = displayScores(match)

  const homeWin =
    scores.showScore &&
    typeof scores.home === 'number' &&
    typeof scores.away === 'number' &&
    scores.home > scores.away
  const awayWin =
    scores.showScore &&
    typeof scores.home === 'number' &&
    typeof scores.away === 'number' &&
    scores.away > scores.home

  const sets = parseSets(match.sets_detail)
  const setsLabel =
    bucket !== 'upcoming' && sets.length > 0
      ? sets.map((s) => `${s.home}–${s.away}`).join('  ')
      : bucket !== 'upcoming'
        ? match.sets_detail || ''
        : ''

  const homeFav = isFavorite(teamFavId(match.team_home)) || highlightTeams.some((t) => eq(t, match.team_home))
  const awayFav = isFavorite(teamFavId(match.team_away)) || highlightTeams.some((t) => eq(t, match.team_away))

  const open = () => {
    cacheMatch(match)
    navigate(`/match/${encodeURIComponent(match.match_id)}`)
  }

  return (
    <article
      className="card match-card card-clickable"
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
      role="link"
      tabIndex={0}
    >
      <div className="match-meta">
        <span className={`badge ${bucket === 'live' ? 'live' : bucket === 'upcoming' ? 'soon' : 'done'}`}>
          {bucket === 'live' ? 'En cours' : bucket === 'upcoming' ? 'À venir' : 'Terminé'}
        </span>
        <span className="meta-date">{formatMatchDate(match.date, match.time)}</span>
        {match.tour && <span className="meta-tour">{match.tour}</span>}
        {showPoule && (match.poule_name || match.poule_code) && (
          <span className="meta-poule">
            {(match.poule_name || match.poule_code || '').replace(/^[A-Z0-9]+ - /, '')}
          </span>
        )}
        {match.entity_name && <span className="meta-entity">{match.entity_name}</span>}
        <ChevronRight size={14} className="meta-chevron" />
      </div>

      <div className="match-teams">
        <div className="team">
          <div className={`team-name${homeFav ? ' fav' : ''}`}>{match.team_home}</div>
          <div onClick={(e) => e.stopPropagation()}>
            <FollowButton teamName={match.team_home} meta={match.poule_code} size="sm" />
          </div>
        </div>

        <div className="score-box">
          {scores.showScore ? (
            <>
              <div className="score-main">
                <span className={homeWin ? 'win' : ''}>{scores.home}</span>
                <span className="sep">:</span>
                <span className={awayWin ? 'win' : ''}>{scores.away}</span>
              </div>
              {setsLabel && <div className="sets-line">{setsLabel}</div>}
            </>
          ) : (
            <div className="score-vs">
              <span>VS</span>
              {match.time && <small>{match.time}</small>}
            </div>
          )}
        </div>

        <div className="team away">
          <div className={`team-name${awayFav ? ' fav' : ''}`}>{match.team_away}</div>
          <div onClick={(e) => e.stopPropagation()}>
            <FollowButton teamName={match.team_away} meta={match.poule_code} size="sm" />
          </div>
        </div>
      </div>
    </article>
  )
}

function eq(a: string, b: string) {
  return a?.toUpperCase() === b?.toUpperCase()
}
