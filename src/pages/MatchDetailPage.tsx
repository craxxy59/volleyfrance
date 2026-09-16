import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Shield,
  Users,
  Hash,
  Clock,
} from 'lucide-react'
import { FollowButton } from '../components/FollowButton'
import { SkeletonList, EmptyState, ErrorState } from '../components/Loading'
import {
  fetchMatches,
  fetchNationalMatches,
  formatMatchDate,
  parseSets,
} from '../lib/api'
import { displayScores, getCachedMatch, matchBucket } from '../lib/matchStore'
import type { Match } from '../types'
import { teamFavId } from '../lib/favorites'
import { useFavorites } from '../hooks/useFavorites'

export function MatchDetailPage() {
  const { id = '' } = useParams()
  const matchId = decodeURIComponent(id)
  const navigate = useNavigate()
  const { isFavorite } = useFavorites()

  const [match, setMatch] = useState<Match | null>(() => getCachedMatch(matchId))
  const [loading, setLoading] = useState(!getCachedMatch(matchId))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      // If we already have cache, still try to refresh quietly
      if (!match) setLoading(true)
      setError(null)
      try {
        // Search national then regional by scanning recent + team-less list is hard.
        // Strategy: try nationals with limit and filter, and matches filter.
        // Prefer cached; otherwise try both feeds with a broad limit is too heavy.
        // Use match_id prefix as poule code when pattern like EFA001
        const pouleGuess = matchId.replace(/\d+$/, '').slice(0, 3) || matchId.slice(0, 3)
        const [nat, reg] = await Promise.all([
          fetchNationalMatches({ poule: pouleGuess, limit: 300 }).catch(() => ({
            matches: [] as Match[],
          })),
          fetchMatches({ limit: 300 }).catch(() => ({ matches: [] as Match[] })),
        ])
        const found =
          [...(nat.matches || []), ...(reg.matches || [])].find((m) => m.match_id === matchId) ||
          null
        if (!cancelled && found) setMatch(found)
        if (!cancelled && !found && !match) {
          setError('Match introuvable dans les flux résultats.')
        }
      } catch (e) {
        if (!cancelled && !match) {
          setError(e instanceof Error ? e.message : 'Erreur de chargement')
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

  const bucket = match ? matchBucket(match.status) : 'past'
  const scores = match ? displayScores(match) : null
  const sets = useMemo(() => (match ? parseSets(match.sets_detail) : []), [match])

  const homeWin =
    scores?.showScore &&
    typeof scores.home === 'number' &&
    typeof scores.away === 'number' &&
    scores.home > scores.away
  const awayWin =
    scores?.showScore &&
    typeof scores.home === 'number' &&
    typeof scores.away === 'number' &&
    scores.away > scores.home

  const refs = match?.referee
    ? match.referee.split('/').map((r) => r.trim()).filter(Boolean)
    : []

  if (loading && !match) {
    return (
      <div className="page detail-page">
        <button type="button" className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Retour
        </button>
        <SkeletonList count={4} />
      </div>
    )
  }

  if (error && !match) {
    return (
      <div className="page detail-page">
        <button type="button" className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Retour
        </button>
        <ErrorState message={error} />
      </div>
    )
  }

  if (!match) {
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
          <span>{formatMatchDate(match.date, match.time)}</span>
          {match.tour && <span>· {match.tour}</span>}
        </div>

        <div className="hero-scoreboard">
          <div className="hero-team">
            <Link
              to={`/equipe/${encodeURIComponent(match.team_home)}`}
              className={`hero-team-name${isFavorite(teamFavId(match.team_home)) ? ' fav' : ''}`}
            >
              {match.team_home}
            </Link>
            <FollowButton teamName={match.team_home} meta={match.poule_code} showLabel size="md" />
          </div>

          <div className="hero-score">
            {scores?.showScore ? (
              <>
                <div className="hero-score-nums">
                  <span className={homeWin ? 'win' : ''}>{scores.home}</span>
                  <span className="sep">:</span>
                  <span className={awayWin ? 'win' : ''}>{scores.away}</span>
                </div>
                <div className="hero-score-label">Sets</div>
              </>
            ) : (
              <>
                <div className="hero-vs">VS</div>
                <div className="hero-score-label">{match.time || 'Horaire à confirmer'}</div>
              </>
            )}
          </div>

          <div className="hero-team away">
            <Link
              to={`/equipe/${encodeURIComponent(match.team_away)}`}
              className={`hero-team-name${isFavorite(teamFavId(match.team_away)) ? ' fav' : ''}`}
            >
              {match.team_away}
            </Link>
            <FollowButton teamName={match.team_away} meta={match.poule_code} showLabel size="md" />
          </div>
        </div>

        {(match.poule_name || match.entity_name) && (
          <div className="hero-comp">
            <Shield size={14} />
            <span>
              {(match.poule_name || match.poule_code || '').replace(/^[A-Z0-9]+ - /, '')}
              {match.entity_name ? ` · ${match.entity_name}` : match.codent === 'ABCCS' ? ' · National' : ''}
            </span>
          </div>
        )}
      </section>

      {sets.length > 0 && bucket !== 'upcoming' && (
        <section className="panel">
          <h2 className="panel-title">Détail des sets</h2>
          <div className="sets-grid">
            {sets.map((s, i) => {
              const hw = s.home > s.away
              const aw = s.away > s.home
              return (
                <div className="set-card" key={i}>
                  <div className="set-num">Set {i + 1}</div>
                  <div className="set-score">
                    <span className={hw ? 'win' : ''}>{s.home}</span>
                    <span className="sep">–</span>
                    <span className={aw ? 'win' : ''}>{s.away}</span>
                  </div>
                  <div className="set-bar">
                    <div
                      className="set-bar-home"
                      style={{
                        width: `${Math.max(8, (s.home / Math.max(s.home + s.away, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          {match.points_home != null && match.points_away != null && (
            <div className="points-row">
              <span>Points marqués</span>
              <strong>
                {match.points_home} – {match.points_away}
              </strong>
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <h2 className="panel-title">Informations</h2>
        <div className="info-list">
          <InfoRow icon={<Hash size={16} />} label="N° de match" value={match.match_id} />
          <InfoRow
            icon={<Calendar size={16} />}
            label="Date"
            value={formatMatchDate(match.date, match.time)}
          />
          {match.tour && <InfoRow icon={<Clock size={16} />} label="Journée" value={match.tour} />}
          {(match.poule_name || match.poule_code) && (
            <InfoRow
              icon={<Shield size={16} />}
              label="Poule"
              value={match.poule_name || match.poule_code}
            />
          )}
          {match.entity_name && (
            <InfoRow icon={<MapPin size={16} />} label="Entité" value={match.entity_name} />
          )}
          {match.saison && <InfoRow icon={<Calendar size={16} />} label="Saison" value={match.saison} />}
          {match.codent && (
            <InfoRow icon={<Hash size={16} />} label="Code entité" value={match.codent} />
          )}
        </div>
      </section>

      {refs.length > 0 && (
        <section className="panel">
          <h2 className="panel-title">Arbitrage</h2>
          <div className="info-list">
            {refs.map((r, i) => (
              <InfoRow
                key={r}
                icon={<Users size={16} />}
                label={i === 0 ? '1er arbitre' : i === 1 ? '2e arbitre' : `Officiel ${i + 1}`}
                value={r}
              />
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <h2 className="panel-title">Suivre les équipes</h2>
        <div className="follow-row">
          <Link to={`/equipe/${encodeURIComponent(match.team_home)}`} className="follow-team-link">
            <span>{match.team_home}</span>
            <small>Voir la fiche équipe</small>
          </Link>
          <FollowButton teamName={match.team_home} showLabel />
        </div>
        <div className="follow-row">
          <Link to={`/equipe/${encodeURIComponent(match.team_away)}`} className="follow-team-link">
            <span>{match.team_away}</span>
            <small>Voir la fiche équipe</small>
          </Link>
          <FollowButton teamName={match.team_away} showLabel />
        </div>
      </section>
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
