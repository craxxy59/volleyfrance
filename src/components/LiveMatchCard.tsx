import { useNavigate } from 'react-router-dom'
import { ChevronRight, MapPin } from 'lucide-react'
import type { LiveMatch } from '../types'
import { formatMatchDate } from '../lib/api'
import { cacheLiveMatch, matchBucket } from '../lib/matchStore'
import { FollowButton } from './FollowButton'

export function LiveMatchCard({ match }: { match: LiveMatch }) {
  const navigate = useNavigate()
  const bucket = matchBucket(match.status)
  const homeWin = bucket === 'past' && match.local_score > match.visitor_score
  const awayWin = bucket === 'past' && match.visitor_score > match.local_score
  const home = match.local_team_name || 'Équipe A'
  const away = match.visitor_team_name || 'Équipe B'

  const open = () => {
    cacheLiveMatch(match)
    navigate(`/live/${encodeURIComponent(match.match_id)}`)
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
        {match.date && <span className="meta-date">{formatMatchDate(match.date)}</span>}
        {match.compet && <span>{match.compet}</span>}
        {match.division && (
          <span
            className={`badge ${
              /FEM|DAME/i.test(match.division) ? 'gender-f' : 'gender-m'
            }`}
          >
            {match.division}
          </span>
        )}
        <ChevronRight size={14} className="meta-chevron" />
      </div>

      <div className="match-teams">
        <div className="team">
          <div className={`team-name${homeWin ? ' fav' : ''}`}>{home}</div>
          <div onClick={(e) => e.stopPropagation()}>
            <FollowButton teamName={home} meta={match.entite_code || undefined} size="sm" />
          </div>
        </div>
        <div className="score-box">
          {bucket === 'upcoming' ? (
            <div className="score-vs">
              <span>VS</span>
            </div>
          ) : (
            <div className="score-main">
              <span className={homeWin ? 'win' : ''}>{match.local_score ?? 0}</span>
              <span className="sep">:</span>
              <span className={awayWin ? 'win' : ''}>{match.visitor_score ?? 0}</span>
            </div>
          )}
          {match.match_players_mode && <div className="sets-line">{match.match_players_mode}</div>}
        </div>
        <div className="team away">
          <div className={`team-name${awayWin ? ' fav' : ''}`}>{away}</div>
          <div onClick={(e) => e.stopPropagation()}>
            <FollowButton teamName={away} meta={match.entite_code || undefined} size="sm" />
          </div>
        </div>
      </div>

      {(match.city || match.entite_code) && (
        <div className="match-footer subtle">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {match.city ? (
              <>
                <MapPin size={12} /> {match.city}
              </>
            ) : (
              match.entite_code
            )}
          </span>
          <span className="mono-id">{match.match_number || match.match_id}</span>
        </div>
      )}
    </article>
  )
}
