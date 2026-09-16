import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bell, CalendarDays, Trophy } from 'lucide-react'
import { FollowButton } from '../components/FollowButton'
import { MatchCard } from '../components/MatchCard'
import { StatusFilter } from '../components/StatusFilter'
import { SkeletonList, EmptyState, ErrorState } from '../components/Loading'
import { fetchTeamMatches, sortMatchesChrono } from '../lib/api'
import { matchBucket, type MatchBucket } from '../lib/matchStore'
import type { Match } from '../types'
import { teamFavId } from '../lib/favorites'
import { useFavorites } from '../hooks/useFavorites'

export function TeamPage() {
  const { name = '' } = useParams()
  const teamName = decodeURIComponent(name)
  const navigate = useNavigate()
  const { isFavorite } = useFavorites()
  const following = isFavorite(teamFavId(teamName))

  const [matches, setMatches] = useState<Match[]>([])
  const [bucket, setBucket] = useState<MatchBucket>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const list = await fetchTeamMatches(teamName, { limit: 60 })
        if (!cancelled) setMatches(list)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [teamName])

  const counts = useMemo(() => {
    const c: Partial<Record<MatchBucket, number>> = { all: matches.length, live: 0, upcoming: 0, past: 0 }
    matches.forEach((m) => {
      const b = matchBucket(m.status)
      c[b] = (c[b] || 0) + 1
    })
    return c
  }, [matches])

  const filtered = useMemo(() => {
    const list =
      bucket === 'all' ? matches : matches.filter((m) => matchBucket(m.status) === bucket)
    return sortMatchesChrono(list, bucket === 'upcoming' ? 'asc' : 'desc')
  }, [matches, bucket])

  const record = useMemo(() => {
    const past = matches.filter((m) => matchBucket(m.status) === 'past')
    let w = 0
    let l = 0
    past.forEach((m) => {
      const home = m.team_home?.toUpperCase() === teamName.toUpperCase()
      if (m.score_home == null || m.score_away == null) return
      const won = home ? m.score_home > m.score_away : m.score_away > m.score_home
      if (won) w += 1
      else l += 1
    })
    return { w, l, played: w + l }
  }, [matches, teamName])

  return (
    <div className="page detail-page">
      <div className="detail-top">
        <button type="button" className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Retour
        </button>
        {following && (
          <span className="badge" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}>
            <Bell size={12} style={{ marginRight: 4 }} /> Suivie
          </span>
        )}
      </div>

      <section className="team-hero">
        <div className="team-hero-mark">{teamName.slice(0, 2).toUpperCase()}</div>
        <div className="team-hero-body">
          <h1>{teamName}</h1>
          <p>Équipe suivie · résultats nationaux & régionaux</p>
          <div className="team-hero-actions">
            <FollowButton teamName={teamName} showLabel size="lg" />
          </div>
        </div>
      </section>

      <div className="stats-grid team-stats">
        <div className="stat-card">
          <div className="value">{record.played}</div>
          <div className="label">Matchs joués</div>
        </div>
        <div className="stat-card">
          <div className="value" style={{ color: 'var(--green)' }}>
            {record.w}
          </div>
          <div className="label">Victoires</div>
        </div>
        <div className="stat-card">
          <div className="value" style={{ color: 'var(--red)' }}>
            {record.l}
          </div>
          <div className="label">Défaites</div>
        </div>
        <div className="stat-card">
          <div className="value">{counts.upcoming || 0}</div>
          <div className="label">À venir</div>
        </div>
      </div>

      <StatusFilter value={bucket} onChange={setBucket} counts={counts} hideLive={!counts.live} />

      {error && <ErrorState message={error} />}
      {loading ? (
        <SkeletonList count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucun match"
          subtitle={
            bucket === 'upcoming'
              ? 'Pas de match à venir trouvé pour cette équipe.'
              : 'Aucun résultat dans ce filtre.'
          }
        />
      ) : (
        <>
          <div className="section-head" style={{ marginTop: 8 }}>
            <h2>
              {bucket === 'upcoming' ? (
                <>
                  <CalendarDays size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Prochains matchs
                </>
              ) : bucket === 'past' ? (
                <>
                  <Trophy size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Résultats
                </>
              ) : (
                'Tous les matchs'
              )}
            </h2>
          </div>
          {filtered.map((m) => (
            <MatchCard key={m.match_id} match={m} highlightTeams={[teamName]} />
          ))}
        </>
      )}
    </div>
  )
}
