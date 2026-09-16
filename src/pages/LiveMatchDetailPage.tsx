import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Shield, Users, Hash, Clock } from 'lucide-react'
import { FollowButton } from '../components/FollowButton'
import { SkeletonList, EmptyState, ErrorState } from '../components/Loading'
import {
  fetchLiveMatchDetail,
  fetchLiveMatchEvents,
  formatDuration,
  formatMatchDate,
  type LiveEvent,
  type LiveMatchDetail,
  type LivePlayer,
} from '../lib/api'
import { getCachedLiveMatch, matchBucket } from '../lib/matchStore'
import { teamFavId } from '../lib/favorites'
import { useFavorites } from '../hooks/useFavorites'

export function LiveMatchDetailPage() {
  const { id = '' } = useParams()
  const matchId = decodeURIComponent(id)
  const navigate = useNavigate()
  const { isFavorite } = useFavorites()

  const cached = getCachedLiveMatch(matchId)
  const [detail, setDetail] = useState<LiveMatchDetail | null>(
    cached ? ({ ...cached } as LiveMatchDetail) : null,
  )
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const [d, ev] = await Promise.all([
          fetchLiveMatchDetail(matchId),
          fetchLiveMatchEvents(matchId).catch(() => [] as LiveEvent[]),
        ])
        if (!cancelled) {
          setDetail(d)
          setEvents(Array.isArray(ev) ? ev : [])
        }
      } catch (e) {
        if (!cancelled && !detail) {
          setError(e instanceof Error ? e.message : 'Impossible de charger le match')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  const bucket = matchBucket(detail?.status)
  const home = detail?.local_team_name || 'Équipe A'
  const away = detail?.visitor_team_name || 'Équipe B'
  const homeWin = bucket === 'past' && (detail?.local_score ?? 0) > (detail?.visitor_score ?? 0)
  const awayWin = bucket === 'past' && (detail?.visitor_score ?? 0) > (detail?.local_score ?? 0)
  const duration = formatDuration(detail?.started_at, detail?.ended_at)

  const localPlayers = useMemo(
    () => (detail?.players || []).filter((p) => p.team === 'local'),
    [detail],
  )
  const visitorPlayers = useMemo(
    () => (detail?.players || []).filter((p) => p.team === 'visitor'),
    [detail],
  )

  const scoreEvents = useMemo(
    () =>
      events
        .filter((e) => e.event_type === 'SCORE' || e.event_type === 'SET_END' || e.event_type === 'END')
        .slice(-40)
        .reverse(),
    [events],
  )

  if (loading && !detail) {
    return (
      <div className="page detail-page">
        <button type="button" className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Retour
        </button>
        <SkeletonList count={5} />
      </div>
    )
  }

  if (error && !detail) {
    return (
      <div className="page detail-page">
        <button type="button" className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Retour
        </button>
        <ErrorState message={error} />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="page detail-page">
        <EmptyState title="Match introuvable" />
      </div>
    )
  }

  return (
    <div className="page detail-page">
      <div className="detail-top">
        <button type="button" className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Retour
        </button>
        <span className={`badge ${bucket === 'live' ? 'live' : bucket === 'upcoming' ? 'soon' : 'done'}`}>
          {bucket === 'live' ? 'En cours' : bucket === 'upcoming' ? 'À venir' : 'Terminé'}
        </span>
      </div>

      <section className="hero-match">
        <div className="hero-glow" aria-hidden />
        <div className="hero-meta">
          {detail.date && <span>{formatMatchDate(detail.date)}</span>}
          {detail.category && <span>· {detail.category}</span>}
          {detail.division && <span>· {detail.division}</span>}
        </div>

        <div className="hero-scoreboard">
          <div className="hero-team">
            <Link
              to={`/equipe/${encodeURIComponent(home)}`}
              className={`hero-team-name${isFavorite(teamFavId(home)) ? ' fav' : ''}`}
            >
              {home}
            </Link>
            <FollowButton teamName={home} showLabel />
          </div>
          <div className="hero-score">
            {bucket === 'upcoming' ? (
              <div className="hero-vs">VS</div>
            ) : (
              <div className="hero-score-nums">
                <span className={homeWin ? 'win' : ''}>{detail.local_score ?? 0}</span>
                <span className="sep">:</span>
                <span className={awayWin ? 'win' : ''}>{detail.visitor_score ?? 0}</span>
              </div>
            )}
            <div className="hero-score-label">
              {detail.match_players_mode || 'Sets'}
              {duration ? ` · ${duration}` : ''}
            </div>
          </div>
          <div className="hero-team away">
            <Link
              to={`/equipe/${encodeURIComponent(away)}`}
              className={`hero-team-name${isFavorite(teamFavId(away)) ? ' fav' : ''}`}
            >
              {away}
            </Link>
            <FollowButton teamName={away} showLabel />
          </div>
        </div>

        {(detail.compet || detail.pool || detail.hall || detail.city) && (
          <div className="hero-comp">
            <Shield size={14} />
            <span>
              {[detail.compet, detail.pool, detail.hall, detail.city].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}
      </section>

      {detail.sets && detail.sets.length > 0 && (
        <section className="panel">
          <h2 className="panel-title">Sets</h2>
          <div className="sets-grid">
            {detail.sets
              .slice()
              .sort((a, b) => a.set_number - b.set_number)
              .map((s) => {
                const hw = s.local_score > s.visitor_score
                const aw = s.visitor_score > s.local_score
                return (
                  <div className="set-card" key={s.id || s.set_number}>
                    <div className="set-num">Set {s.set_number}</div>
                    <div className="set-score">
                      <span className={hw ? 'win' : ''}>{s.local_score}</span>
                      <span className="sep">–</span>
                      <span className={aw ? 'win' : ''}>{s.visitor_score}</span>
                    </div>
                    <div className="set-bar">
                      <div
                        className="set-bar-home"
                        style={{
                          width: `${Math.max(
                            8,
                            (s.local_score / Math.max(s.local_score + s.visitor_score, 1)) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    {s.started_at && s.ended_at && (
                      <div className="set-duration">{formatDuration(s.started_at, s.ended_at)}</div>
                    )}
                  </div>
                )
              })}
          </div>
        </section>
      )}

      <section className="panel">
        <h2 className="panel-title">Informations</h2>
        <div className="info-list">
          <InfoRow icon={<Hash size={16} />} label="N°" value={detail.match_number || detail.match_id} />
          {detail.date && (
            <InfoRow icon={<Calendar size={16} />} label="Date" value={formatMatchDate(detail.date)} />
          )}
          {(detail.hall || detail.city || detail.address) && (
            <InfoRow
              icon={<MapPin size={16} />}
              label="Lieu"
              value={[detail.hall, detail.address, detail.city].filter(Boolean).join(' · ')}
            />
          )}
          {detail.entite_code && (
            <InfoRow icon={<Shield size={16} />} label="Entité" value={detail.entite_label || detail.entite_code} />
          )}
          {detail.match_type && (
            <InfoRow icon={<Users size={16} />} label="Type" value={`${detail.match_type}${detail.match_players_mode ? ` · ${detail.match_players_mode}` : ''}`} />
          )}
          {duration && <InfoRow icon={<Clock size={16} />} label="Durée" value={duration} />}
        </div>
      </section>

      {(localPlayers.length > 0 || visitorPlayers.length > 0) && (
        <section className="panel">
          <h2 className="panel-title">Compositions</h2>
          <div className="lineups">
            <Lineup title={home} players={localPlayers} />
            <Lineup title={away} players={visitorPlayers} />
          </div>
        </section>
      )}

      {scoreEvents.length > 0 && (
        <section className="panel">
          <h2 className="panel-title">Timeline</h2>
          <div className="timeline">
            {scoreEvents.map((e) => (
              <div className="timeline-item" key={e.id}>
                <div className="timeline-dot" />
                <div className="timeline-body">
                  <div className="timeline-top">
                    <strong>
                      {e.event_type === 'SCORE'
                        ? `${e.new_score_local ?? e.score_local}–${e.new_score_visitor ?? e.score_visitor}`
                        : e.event_type.replace(/_/g, ' ')}
                    </strong>
                    <span>Set {e.set_number}</span>
                  </div>
                  <div className="timeline-sub">
                    {e.team_name || ''}
                    {e.timestamp && (
                      <>
                        {' · '}
                        {new Date(e.timestamp).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <h2 className="panel-title">Suivre</h2>
        <div className="follow-row">
          <Link to={`/equipe/${encodeURIComponent(home)}`} className="follow-team-link">
            <span>{home}</span>
            <small>Fiche équipe</small>
          </Link>
          <FollowButton teamName={home} showLabel />
        </div>
        <div className="follow-row">
          <Link to={`/equipe/${encodeURIComponent(away)}`} className="follow-team-link">
            <span>{away}</span>
            <small>Fiche équipe</small>
          </Link>
          <FollowButton teamName={away} showLabel />
        </div>
      </section>
    </div>
  )
}

function Lineup({ title, players }: { title: string; players: LivePlayer[] }) {
  return (
    <div className="lineup">
      <h3>{title}</h3>
      <ul>
        {players
          .slice()
          .sort((a, b) => (a.shirt_number || 99) - (b.shirt_number || 99))
          .map((p) => (
            <li key={p.id}>
              <span className="shirt">{p.shirt_number ?? '–'}</span>
              <span className="pname">
                {p.last_name} {p.first_name}
              </span>
              {p.role && <span className="prole">{p.role}</span>}
            </li>
          ))}
      </ul>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="info-row">
      <div className="info-icon">{icon}</div>
      <div className="info-text">
        <span className="info-label">{label}</span>
        <span className="info-value">{value}</span>
      </div>
    </div>
  )
}
