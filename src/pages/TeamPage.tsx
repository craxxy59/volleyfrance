import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bell, CalendarDays, Trophy } from 'lucide-react'
import { FollowButton } from '../components/FollowButton'
import { MatchCard } from '../components/MatchCard'
import { StatusFilter } from '../components/StatusFilter'
import { SkeletonList, EmptyState, ErrorState } from '../components/Loading'
import { fetchDeptTeams, fetchTeamMatches, sortMatchesChrono } from '../lib/api'
import { matchBucket, type MatchBucket } from '../lib/matchStore'
import type { Match } from '../types'
import { teamFavId } from '../lib/favorites'
import { useFavorites } from '../hooks/useFavorites'
import { parseCompetitionMeta } from '../lib/teamMeta'
import { filterMatchesForTeam } from '../lib/clubTeams'

export function TeamPage() {
  const { name = '' } = useParams()
  const [params] = useSearchParams()
  const teamName = decodeURIComponent(name)
  const pouleFilter = params.get('poule') || ''
  const codentFilter = params.get('codent') || ''
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
        const list = await fetchTeamMatches(teamName, { limit: 80 })
        // Enrich with dept matches if codent is departmental or unknown
        let extra: Match[] = []
        if (codentFilter && /^PT/i.test(codentFilter)) {
          try {
            const entries = await fetchDeptTeams({
              codent: codentFilter,
              q: teamName,
              full: true,
              limit: 50,
            })
            for (const e of entries) {
              if (e.team.toUpperCase() === teamName.toUpperCase()) {
                extra.push(...(e.matches || []))
              }
            }
          } catch {
            /* ignore */
          }
        }
        const seen = new Set<string>()
        const all: Match[] = []
        for (const m of [...list, ...extra]) {
          if (seen.has(m.match_id)) continue
          seen.add(m.match_id)
          all.push(m)
        }
        if (!cancelled) setMatches(all)
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
  }, [teamName, codentFilter])

  const scopedMatches = useMemo(() => {
    if (!pouleFilter) return matches
    return filterMatchesForTeam(matches, teamName, pouleFilter)
  }, [matches, teamName, pouleFilter])

  const competitions = useMemo(() => {
    const map = new Map<string, { pouleCode: string; pouleName: string; count: number }>()
    matches.forEach((m) => {
      const side =
        m.team_home?.toUpperCase() === teamName.toUpperCase() ||
        m.team_away?.toUpperCase() === teamName.toUpperCase()
      if (!side) return
      const code = m.poule_code || '?'
      const prev = map.get(code)
      if (prev) prev.count += 1
      else map.set(code, { pouleCode: code, pouleName: m.poule_name || code, count: 1 })
    })
    return [...map.values()].map((c) => ({
      ...c,
      meta: parseCompetitionMeta(c.pouleName, c.pouleCode),
    }))
  }, [matches, teamName])

  const primaryMeta = useMemo(() => {
    if (pouleFilter) {
      const hit = competitions.find((c) => c.pouleCode === pouleFilter)
      if (hit) return hit.meta
      const m = scopedMatches[0]
      if (m) return parseCompetitionMeta(m.poule_name, m.poule_code)
    }
    // Prefer senior if multiple
    const senior = competitions.find((c) => c.meta.category === 'Senior')
    return (senior || competitions[0])?.meta || null
  }, [competitions, pouleFilter, scopedMatches])

  const counts = useMemo(() => {
    const c: Partial<Record<MatchBucket, number>> = {
      all: scopedMatches.length,
      live: 0,
      upcoming: 0,
      past: 0,
    }
    scopedMatches.forEach((m) => {
      const b = matchBucket(m.status)
      c[b] = (c[b] || 0) + 1
    })
    return c
  }, [scopedMatches])

  const filtered = useMemo(() => {
    const list =
      bucket === 'all'
        ? scopedMatches
        : scopedMatches.filter((m) => matchBucket(m.status) === bucket)
    return sortMatchesChrono(list, bucket === 'upcoming' ? 'asc' : 'desc')
  }, [scopedMatches, bucket])

  const record = useMemo(() => {
    const past = scopedMatches.filter((m) => matchBucket(m.status) === 'past')
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
  }, [scopedMatches, teamName])

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
          <div className="team-row-badges" style={{ marginTop: 8, marginBottom: 6 }}>
            {primaryMeta && (
              <>
                <span className="comp-badge">{primaryMeta.category}</span>
                {primaryMeta.gender && (
                  <span
                    className={`comp-badge ${primaryMeta.gender === 'F' ? 'gender-f' : 'gender-m'}`}
                  >
                    {primaryMeta.gender === 'F' ? 'Féminin' : 'Masculin'}
                  </span>
                )}
                {primaryMeta.level && (
                  <span className="comp-badge level">{primaryMeta.level}</span>
                )}
              </>
            )}
          </div>
          <p>
            {pouleFilter
              ? `Compétition ${pouleFilter}`
              : competitions.length > 1
                ? `${competitions.length} compétitions détectées`
                : 'Résultats nationaux, régionaux & départementaux'}
          </p>
          <div className="team-hero-actions">
            <FollowButton
              teamName={teamName}
              meta={primaryMeta?.label}
              showLabel
              size="lg"
            />
          </div>
        </div>
      </section>

      {competitions.length > 1 && (
        <div className="chips">
          <button
            type="button"
            className={`chip${!pouleFilter ? ' active' : ''}`}
            onClick={() => {
              const next = new URLSearchParams(params)
              next.delete('poule')
              navigate(`/equipe/${encodeURIComponent(teamName)}?${next}`, { replace: true })
            }}
          >
            Toutes
          </button>
          {competitions.map((c) => (
            <button
              key={c.pouleCode}
              type="button"
              className={`chip ghost${pouleFilter === c.pouleCode ? ' active' : ''}`}
              onClick={() => {
                const next = new URLSearchParams(params)
                next.set('poule', c.pouleCode)
                navigate(`/equipe/${encodeURIComponent(teamName)}?${next}`, { replace: true })
              }}
            >
              {c.meta.badge}
              {c.meta.level ? ` · ${c.meta.level}` : ''}
            </button>
          ))}
        </div>
      )}

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
