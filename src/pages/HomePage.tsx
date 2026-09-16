import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Users, Radio, Star, Search, ChevronRight, MapPinned, Zap } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { MatchCard } from '../components/MatchCard'
import { SkeletonList, ErrorState } from '../components/Loading'
import {
  fetchGlobalStats,
  fetchNationalStats,
  fetchNationalMatches,
  fetchMatches,
  fetchClubs,
  sortMatchesChrono,
} from '../lib/api'
import type { Match, Stats } from '../types'
import { useFavorites } from '../hooks/useFavorites'
import { matchBucket } from '../lib/matchStore'

export function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [natStats, setNatStats] = useState<Stats | null>(null)
  const [recent, setRecent] = useState<Match[]>([])
  const [upcoming, setUpcoming] = useState<Match[]>([])
  const [hdf, setHdf] = useState<Match[]>([])
  const [clubCount, setClubCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { favorites } = useFavorites()
  const teamFavs = favorites.filter((f) => f.kind === 'team')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      // allSettled: one flaky endpoint must not blank the whole home
      const results = await Promise.allSettled([
        fetchGlobalStats(),
        fetchNationalStats(),
        fetchNationalMatches({ status: 'completed', limit: 8 }),
        fetchNationalMatches({ status: 'scheduled', limit: 8 }),
        fetchMatches({ codent: 'LIFL', limit: 6 }),
        fetchClubs(),
      ])

      const val = <T,>(i: number): T | null =>
        results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<T>).value : null

      const g = val<Stats>(0)
      const n = val<Stats>(1)
      const past = val<{ matches: Match[] }>(2)
      const soon = val<{ matches: Match[] }>(3)
      const h = val<{ matches: Match[] }>(4)
      const clubs = val<unknown[]>(5)

      if (g) setStats(g)
      if (n) setNatStats(n)
      if (past) setRecent(sortMatchesChrono(past.matches || [], 'desc').slice(0, 5))
      if (soon) {
        setUpcoming(
          sortMatchesChrono(
            (soon.matches || []).filter((m) => matchBucket(m.status) === 'upcoming'),
            'asc',
          ).slice(0, 4),
        )
      }
      if (h) setHdf(sortMatchesChrono(h.matches || [], 'desc').slice(0, 4))
      if (clubs) setClubCount(clubs.length)

      const failed = results.filter((r) => r.status === 'rejected').length
      // Only hard-fail if everything is down
      if (failed === results.length) {
        const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
        setError(first.reason instanceof Error ? first.reason.message : 'Erreur de chargement')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="page">
      <TopBar />

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && (
        <>
          <section className="home-hero">
            <div className="home-hero-copy">
              <p className="eyebrow">
                <Zap size={14} /> Saison 2025/2026
              </p>
              <h2>Le volley français, centralisé.</h2>
              <p className="lede">
                Clubs, poules, scores et équipes suivies — national jusqu’au départemental.
              </p>
            </div>
            {teamFavs.length > 0 && (
              <Link to="/favoris" className="home-follow-chip">
                <Star size={14} fill="currentColor" />
                {teamFavs.length} équipe{teamFavs.length > 1 ? 's' : ''} suivie
                {teamFavs.length > 1 ? 's' : ''}
              </Link>
            )}
          </section>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="value">
                {loading ? '…' : (stats?.total_matches ?? '–').toLocaleString('fr-FR')}
              </div>
              <div className="label">Matchs saison</div>
            </div>
            <div className="stat-card">
              <div className="value">{loading ? '…' : stats?.total_poules ?? '–'}</div>
              <div className="label">Poules</div>
            </div>
            <div className="stat-card">
              <div className="value">{loading ? '…' : natStats?.total_poules ?? '–'}</div>
              <div className="label">Nat. poules</div>
            </div>
            <div className="stat-card">
              <div className="value">
                {loading ? '…' : clubCount?.toLocaleString('fr-FR') ?? '–'}
              </div>
              <div className="label">Clubs FFVolley</div>
            </div>
          </div>

          <Link to="/clubs" className="search-bar search-link">
            <Search size={18} />
            <span>Rechercher un club, une ville, une équipe…</span>
          </Link>

          <div className="quick-grid">
            <Link to="/competitions?level=national" className="card card-clickable quick-card">
              <div className="icon" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}>
                <Trophy size={18} />
              </div>
              <h3>Nationaux</h3>
              <p>Élite, N2, N3 — poules & classements</p>
            </Link>
            <Link
              to="/competitions?level=regional&codent=LIFL"
              className="card card-clickable quick-card"
            >
              <div className="icon" style={{ background: 'var(--blue-soft)', color: '#93c5fd' }}>
                <MapPinned size={18} />
              </div>
              <h3>Hauts-de-France</h3>
              <p>Ta ligue locale, R1, pré-nat…</p>
            </Link>
            <Link to="/scores" className="card card-clickable quick-card">
              <div className="icon" style={{ background: 'var(--cyan-soft)', color: 'var(--cyan)' }}>
                <Radio size={18} />
              </div>
              <h3>Scores</h3>
              <p>À venir · en cours · passés</p>
            </Link>
            <Link to="/favoris" className="card card-clickable quick-card">
              <div className="icon" style={{ background: 'var(--pink-soft)', color: 'var(--pink)' }}>
                <Star size={18} />
              </div>
              <h3>Suivi</h3>
              <p>
                {teamFavs.length
                  ? `${teamFavs.length} équipe${teamFavs.length > 1 ? 's' : ''}`
                  : 'Suivre une équipe'}
              </p>
            </Link>
          </div>

          {upcoming.length > 0 && (
            <>
              <div className="section-head">
                <h2>Prochains matchs</h2>
                <Link className="link" to="/scores">
                  Voir tout <ChevronRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
                </Link>
              </div>
              {loading ? <SkeletonList count={2} /> : upcoming.map((m) => <MatchCard key={m.match_id} match={m} />)}
            </>
          )}

          <div className="section-head">
            <h2>Derniers résultats nationaux</h2>
            <Link className="link" to="/scores">
              Scores
            </Link>
          </div>
          {loading ? (
            <SkeletonList count={3} />
          ) : (
            recent.map((m) => <MatchCard key={m.match_id} match={m} />)
          )}

          <div className="section-head">
            <h2>Hauts-de-France</h2>
            <Link className="link" to="/competitions?level=regional&codent=LIFL">
              Ouvrir
            </Link>
          </div>
          {loading ? (
            <SkeletonList count={2} />
          ) : hdf.length ? (
            hdf.map((m) => <MatchCard key={m.match_id} match={m} />)
          ) : (
            <div className="empty">
              <p>Pas de matchs HDF récents dans le flux.</p>
            </div>
          )}

          <div className="section-head">
            <h2>Explorer</h2>
          </div>
          <Link to="/clubs" className="card card-clickable club-card" style={{ marginBottom: 10 }}>
            <div
              className="club-avatar"
              style={{ background: 'var(--green-soft)', color: 'var(--green)' }}
            >
              <Users size={18} />
            </div>
            <div className="club-body">
              <h3>Annuaire des clubs</h3>
              <div className="club-meta">
                {clubCount ? `${clubCount} clubs actifs` : 'FFVolley'} · contact, pratiques,
                département
              </div>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--text-dim)', marginTop: 12 }} />
          </Link>
        </>
      )}
    </div>
  )
}
