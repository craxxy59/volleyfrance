import { useEffect, useMemo, useState } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { LiveMatchCard } from '../components/LiveMatchCard'
import { MatchCard } from '../components/MatchCard'
import { StatusFilter } from '../components/StatusFilter'
import { SkeletonList, EmptyState, ErrorState } from '../components/Loading'
import { fetchLiveMatches, fetchNationalMatches, fetchMatches, sortMatchesChrono } from '../lib/api'
import { matchBucket, type MatchBucket } from '../lib/matchStore'
import type { LiveMatch, Match } from '../types'

type Scope = 'national' | 'hdf' | 'livefeed'

export function ScoresPage() {
  const [scope, setScope] = useState<Scope>('national')
  const [bucket, setBucket] = useState<MatchBucket>('past')
  const [live, setLive] = useState<LiveMatch[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      if (scope === 'livefeed') {
        const list = await fetchLiveMatches()
        setLive(list)
        setFetchedAt(new Date().toISOString())
      } else {
        // Load both completed + scheduled then filter client-side for smooth tabs
        if (scope === 'national') {
          const [done, soon] = await Promise.all([
            fetchNationalMatches({ status: 'completed', limit: 100 }),
            fetchNationalMatches({ status: 'scheduled', limit: 80 }),
          ])
          const seen = new Set<string>()
          const all: Match[] = []
          ;[...(done.matches || []), ...(soon.matches || [])].forEach((m) => {
            if (!seen.has(m.match_id)) {
              seen.add(m.match_id)
              all.push(m)
            }
          })
          setMatches(all)
        } else {
          const [done, soon] = await Promise.all([
            fetchMatches({ codent: 'LIFL', status: 'completed', limit: 100 }),
            fetchMatches({ codent: 'LIFL', status: 'scheduled', limit: 80 }),
          ])
          const seen = new Set<string>()
          const all: Match[] = []
          ;[...(done.matches || []), ...(soon.matches || [])].forEach((m) => {
            if (!seen.has(m.match_id)) {
              seen.add(m.match_id)
              all.push(m)
            }
          })
          setMatches(all)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur scores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  // Default bucket when switching scope
  useEffect(() => {
    if (scope === 'livefeed') setBucket('past')
    else setBucket('past')
  }, [scope])

  const liveFiltered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = live.filter((m) => m.local_team_name || m.visitor_team_name)
    if (bucket !== 'all') list = list.filter((m) => matchBucket(m.status) === bucket)
    if (query) {
      list = list.filter((m) =>
        [m.local_team_name, m.visitor_team_name, m.city, m.compet, m.division, m.entite_code]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
    }
    list.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0
      const db = b.date ? new Date(b.date).getTime() : 0
      return db - da
    })
    return list.slice(0, 80)
  }, [live, q, bucket])

  const liveCounts = useMemo(() => {
    const base = live.filter((m) => m.local_team_name || m.visitor_team_name)
    const c: Partial<Record<MatchBucket, number>> = { all: base.length, live: 0, upcoming: 0, past: 0 }
    base.forEach((m) => {
      const b = matchBucket(m.status)
      c[b] = (c[b] || 0) + 1
    })
    return c
  }, [live])

  const matchCounts = useMemo(() => {
    const c: Partial<Record<MatchBucket, number>> = { all: matches.length, live: 0, upcoming: 0, past: 0 }
    matches.forEach((m) => {
      const b = matchBucket(m.status)
      c[b] = (c[b] || 0) + 1
    })
    return c
  }, [matches])

  const matchesFiltered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = matches
    if (bucket !== 'all') list = list.filter((m) => matchBucket(m.status) === bucket)
    if (query) {
      list = list.filter((m) =>
        [m.team_home, m.team_away, m.poule_name, m.poule_code, m.entity_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
    }
    return sortMatchesChrono(list, bucket === 'upcoming' ? 'asc' : 'desc')
  }, [matches, q, bucket])

  return (
    <div className="page">
      <TopBar
        subtitle="Scores · à venir · en cours · passés"
        right={
          <button type="button" className="icon-btn" onClick={load} title="Rafraîchir" aria-label="Rafraîchir">
            <RefreshCw size={16} />
          </button>
        }
      />

      <div className="chips">
        <button
          type="button"
          className={`chip${scope === 'national' ? ' active' : ''}`}
          onClick={() => setScope('national')}
        >
          Nationaux
        </button>
        <button
          type="button"
          className={`chip${scope === 'hdf' ? ' active' : ''}`}
          onClick={() => setScope('hdf')}
        >
          Hauts-de-France
        </button>
        <button
          type="button"
          className={`chip${scope === 'livefeed' ? ' active' : ''}`}
          onClick={() => setScope('livefeed')}
        >
          Feuilles live
        </button>
      </div>

      <div className="search-bar">
        <Search size={18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Équipe, poule, ville…"
        />
      </div>

      <StatusFilter
        value={bucket}
        onChange={setBucket}
        counts={scope === 'livefeed' ? liveCounts : matchCounts}
        hideLive={scope !== 'livefeed' && !(matchCounts.live && matchCounts.live > 0)}
      />

      {scope === 'livefeed' && fetchedAt && (
        <p className="feed-hint">
          Flux FFVolley · {new Date(fetchedAt).toLocaleTimeString('fr-FR')} · {liveFiltered.length} affichés
        </p>
      )}

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <SkeletonList count={5} />
      ) : scope === 'livefeed' ? (
        liveFiltered.length ? (
          liveFiltered.map((m) => <LiveMatchCard key={m.id || m.match_id} match={m} />)
        ) : (
          <EmptyState
            title={bucket === 'live' ? 'Aucun match en cours' : 'Pas de matchs'}
            subtitle={
              bucket === 'live'
                ? 'Reviens le week-end : le live s’active pendant les rencontres.'
                : 'Modifie le filtre ou la recherche.'
            }
          />
        )
      ) : matchesFiltered.length ? (
        matchesFiltered.map((m) => <MatchCard key={m.match_id} match={m} />)
      ) : (
        <EmptyState
          title={bucket === 'upcoming' ? 'Aucun match à venir' : 'Aucun résultat'}
          subtitle="Modifie les filtres ou la recherche."
        />
      )}
    </div>
  )
}
