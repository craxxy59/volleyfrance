import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Star } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { MatchCard } from '../components/MatchCard'
import { RankingTable } from '../components/RankingTable'
import { SkeletonList, EmptyState, ErrorState } from '../components/Loading'
import { StatusFilter } from '../components/StatusFilter'
import {
  detectGender,
  fetchEntities,
  fetchMatches,
  fetchNationalMatches,
  fetchNationalPoules,
  fetchNationalRankings,
  fetchPoules,
  fetchRankings,
  nationalGroup,
  sortMatchesChrono,
} from '../lib/api'
import type { Entity, Gender, Match, Poule, RankingRow } from '../types'
import { pouleFavId } from '../lib/favorites'
import { matchBucket, type MatchBucket } from '../lib/matchStore'
import { useFavorites } from '../hooks/useFavorites'

type Level = 'national' | 'regional'
type View = 'poules' | 'matchs' | 'classement'

export function CompetitionsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { isFavorite, toggleFavorite } = useFavorites()

  const level = (params.get('level') as Level) || 'national'
  const codent = params.get('codent') || ''
  const pouleCode = params.get('poule') || ''
  const gender = (params.get('gender') as Gender) || 'all'
  const view = (params.get('view') as View) || 'poules'

  const [entities, setEntities] = useState<Entity[]>([])
  const [poules, setPoules] = useState<Poule[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [rankings, setRankings] = useState<RankingRow[]>([])
  const [pouleName, setPouleName] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matchBucketFilter, setMatchBucketFilter] = useState<MatchBucket>('all')

  const setQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    })
    setParams(next, { replace: true })
  }

  // Load entities once
  useEffect(() => {
    fetchEntities()
      .then(setEntities)
      .catch(() => setEntities([]))
  }, [])

  // Load poules when level/codent changes
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const list =
          level === 'national'
            ? await fetchNationalPoules()
            : codent
              ? await fetchPoules(codent)
              : []
        if (!cancelled) setPoules(list)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur poules')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [level, codent])

  const filteredPoules = useMemo(() => {
    return poules.filter((p) => {
      if (gender === 'all') return true
      const g = detectGender(p.poule_name || p.label || '')
      return g === gender
    })
  }, [poules, gender])

  const groupedNational = useMemo(() => {
    if (level !== 'national') return null
    const groups: Record<string, Poule[]> = {}
    filteredPoules.forEach((p) => {
      const g = nationalGroup(p.poule_id)
      ;(groups[g] = groups[g] || []).push(p)
    })
    return groups
  }, [filteredPoules, level])

  const selectedPoule = useMemo(
    () => poules.find((p) => p.poule_id === pouleCode),
    [poules, pouleCode],
  )

  // Load matches / rankings when poule or view changes
  useEffect(() => {
    if (!pouleCode || view === 'poules') {
      setMatches([])
      setRankings([])
      return
    }
    let cancelled = false
    const run = async () => {
      setLoadingDetail(true)
      try {
        if (view === 'matchs') {
          if (level === 'national') {
            const [done, soon] = await Promise.all([
              fetchNationalMatches({ poule: pouleCode, status: 'completed', limit: 200 }),
              fetchNationalMatches({ poule: pouleCode, status: 'scheduled', limit: 100 }),
            ])
            const seen = new Set<string>()
            const all = [] as typeof done.matches
            ;[...(done.matches || []), ...(soon.matches || [])].forEach((m) => {
              if (!seen.has(m.match_id)) { seen.add(m.match_id); all.push(m) }
            })
            if (!cancelled) setMatches(all)
          } else {
            const [done, soon] = await Promise.all([
              fetchMatches({ codent, poule: pouleCode, status: 'completed', limit: 200 }),
              fetchMatches({ codent, poule: pouleCode, status: 'scheduled', limit: 100 }),
            ])
            const seen = new Set<string>()
            const all = [] as typeof done.matches
            ;[...(done.matches || []), ...(soon.matches || [])].forEach((m) => {
              if (!seen.has(m.match_id)) { seen.add(m.match_id); all.push(m) }
            })
            if (!cancelled) setMatches(all)
          }
        } else if (view === 'classement' && selectedPoule) {
          const data =
            level === 'national'
              ? await fetchNationalRankings(selectedPoule.id)
              : await fetchRankings(selectedPoule.id)
          if (!cancelled) {
            setRankings(data.rankings || [])
            setPouleName(data.poule_name || selectedPoule.poule_name)
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur détail')
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [pouleCode, view, level, codent, selectedPoule])

  const favId = selectedPoule
    ? pouleFavId(selectedPoule.codent || (level === 'national' ? 'ABCCS' : codent), selectedPoule.poule_id)
    : ''
  const favActive = favId ? isFavorite(favId) : false

  return (
    <div className="page">
      <TopBar subtitle="Compétitions · poules · classements" />

      <div className="chips">
        <button
          type="button"
          className={`chip${level === 'national' ? ' active' : ''}`}
          onClick={() =>
            setQuery({ level: 'national', codent: null, poule: null, view: 'poules' })
          }
        >
          National
        </button>
        <button
          type="button"
          className={`chip${level === 'regional' ? ' active' : ''}`}
          onClick={() =>
            setQuery({
              level: 'regional',
              codent: codent || 'LIFL',
              poule: null,
              view: 'poules',
            })
          }
        >
          Régional / Départ.
        </button>
      </div>

      <div className="chips">
        {(
          [
            ['all', 'Tous'],
            ['F', 'Féminin'],
            ['M', 'Masculin'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`chip ghost${gender === id ? ' active' : ''}`}
            onClick={() => setQuery({ gender: id === 'all' ? null : id })}
          >
            {label}
          </button>
        ))}
      </div>

      {level === 'regional' && (
        <div className="filters-row">
          <select
            className="filter-select"
            value={codent}
            onChange={(e) =>
              setQuery({ codent: e.target.value, poule: null, view: 'poules' })
            }
          >
            <option value="">— Choisir une ligue —</option>
            {entities.map((en) => (
              <option key={en.codent} value={en.codent}>
                {en.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <ErrorState message={error} />}

      {/* Poule detail */}
      {pouleCode && selectedPoule && (
        <>
          <button
            type="button"
            className="back-btn"
            onClick={() => setQuery({ poule: null, view: 'poules' })}
          >
            ← Retour aux poules
          </button>
          <div className="detail-header" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div className="poule-code" style={{ display: 'inline-block', marginBottom: 8 }}>
                {selectedPoule.poule_id}
              </div>
              <h1 style={{ fontSize: '1.1rem' }}>
                {(selectedPoule.label || selectedPoule.poule_name).replace(
                  /^[A-Z0-9]+ - /,
                  '',
                )}
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
                {selectedPoule.saison}
                {level === 'national' ? ' · National' : ` · ${entities.find((e) => e.codent === codent)?.name || codent}`}
              </p>
            </div>
            <button
              type="button"
              className={`icon-btn${favActive ? ' active' : ''}`}
              onClick={() =>
                toggleFavorite({
                  id: favId,
                  kind: 'poule',
                  label: selectedPoule.label || selectedPoule.poule_name,
                  meta: level === 'national' ? 'National' : codent,
                  pouleNumericId: selectedPoule.id,
                  pouleCode: selectedPoule.poule_id,
                  codent: selectedPoule.codent || codent || 'ABCCS',
                  national: level === 'national',
                })
              }
            >
              <Star size={16} fill={favActive ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={`tab${view === 'matchs' ? ' active' : ''}`}
              onClick={() => setQuery({ view: 'matchs' })}
            >
              Matchs
            </button>
            <button
              type="button"
              className={`tab${view === 'classement' ? ' active' : ''}`}
              onClick={() => setQuery({ view: 'classement' })}
            >
              Classement
            </button>
          </div>

          {view === 'matchs' && (
            <>
              <StatusFilter
                value={matchBucketFilter}
                onChange={setMatchBucketFilter}
                counts={{
                  all: matches.length,
                  past: matches.filter((m) => matchBucket(m.status) === 'past').length,
                  upcoming: matches.filter((m) => matchBucket(m.status) === 'upcoming').length,
                  live: matches.filter((m) => matchBucket(m.status) === 'live').length,
                }}
                hideLive
              />
              {loadingDetail ? (
                <SkeletonList count={4} />
              ) : (() => {
                const list = sortMatchesChrono(
                  matchBucketFilter === 'all'
                    ? matches
                    : matches.filter((m) => matchBucket(m.status) === matchBucketFilter),
                  matchBucketFilter === 'upcoming' ? 'asc' : 'desc',
                )
                return list.length ? (
                  list.map((m) => <MatchCard key={m.match_id} match={m} showPoule={false} />)
                ) : (
                  <EmptyState title="Aucun match" subtitle="Pas de rencontre pour ce filtre." />
                )
              })()}
            </>
          )}

          {view === 'classement' && (
            <>
              {loadingDetail ? (
                <SkeletonList count={3} />
              ) : (
                <>
                  {pouleName && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                      {pouleName}
                    </p>
                  )}
                  <RankingTable rows={rankings} />
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Poule list */}
      {(!pouleCode || !selectedPoule) && (
        <>
          {loading ? (
            <SkeletonList count={6} />
          ) : level === 'regional' && !codent ? (
            <EmptyState
              title="Choisis une ligue"
              subtitle="Sélectionne ta région pour afficher les poules départementales et régionales."
            />
          ) : filteredPoules.length === 0 ? (
            <EmptyState title="Aucune poule" subtitle="Essaie un autre filtre genre / ligue." />
          ) : level === 'national' && groupedNational ? (
            Object.entries(groupedNational).map(([group, list]) => (
              <div key={group}>
                <div className="group-title">{group}</div>
                {list.map((p) => (
                  <PouleRow
                    key={p.id}
                    poule={p}
                    onOpen={() => setQuery({ poule: p.poule_id, view: 'matchs' })}
                  />
                ))}
              </div>
            ))
          ) : (
            filteredPoules.map((p) => (
              <PouleRow
                key={p.id}
                poule={p}
                onOpen={() => setQuery({ poule: p.poule_id, view: 'matchs' })}
              />
            ))
          )}

          {level === 'regional' && codent === 'LIFL' && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 12, textAlign: 'center' }}>
              Astuce : tu es en Hauts-de-France — filtre F/M pour aller plus vite.
            </p>
          )}
        </>
      )}

      {!pouleCode && level === 'national' && (
        <button
          type="button"
          className="load-more"
          onClick={() => navigate('/scores')}
          style={{ marginTop: 16 }}
        >
          Voir aussi le livescore FFVolley →
        </button>
      )}
    </div>
  )
}

function PouleRow({ poule, onOpen }: { poule: Poule; onOpen: () => void }) {
  const g = detectGender(poule.poule_name || poule.label || '')
  const title = (poule.label || poule.poule_name || '').replace(/^[A-Z0-9]+ - /, '')
  return (
    <button type="button" className="card card-clickable poule-item" onClick={onOpen} style={{ width: '100%', textAlign: 'left' }}>
      <div className="poule-code">{poule.poule_id}</div>
      <div className="poule-info">
        <h3>{title}</h3>
        <p>
          {poule.saison}
          {g && (
            <span className={`badge ${g === 'F' ? 'gender-f' : 'gender-m'}`} style={{ marginLeft: 8 }}>
              {g === 'F' ? 'Fém.' : 'Masc.'}
            </span>
          )}
        </p>
      </div>
      <ChevronRight size={18} style={{ color: 'var(--text-dim)' }} />
    </button>
  )
}

