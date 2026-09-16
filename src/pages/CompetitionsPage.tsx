import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, ExternalLink, Star } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { MatchCard } from '../components/MatchCard'
import { RankingTable } from '../components/RankingTable'
import { SkeletonList, EmptyState, ErrorState } from '../components/Loading'
import { StatusFilter } from '../components/StatusFilter'
import {
  detectGender,
  fetchDepartments,
  fetchDeptRankings,
  fetchEntities,
  fetchMatches,
  fetchNationalMatches,
  fetchNationalPoules,
  fetchNationalRankings,
  fetchPoules,
  fetchRankings,
  isDeptCodent,
  nationalGroup,
  sortMatchesChrono,
} from '../lib/api'
import type { Department, Entity, Gender, Match, Poule, RankingRow } from '../types'
import { pouleFavId } from '../lib/favorites'
import { matchBucket, type MatchBucket } from '../lib/matchStore'
import { useFavorites } from '../hooks/useFavorites'
import { useSeason } from '../hooks/useSeason'
import { SeasonSelect } from '../components/SeasonSelect'
import { currentSeasonFull } from '../lib/season'

type Level = 'national' | 'regional' | 'departemental'
type View = 'poules' | 'matchs' | 'classement'

export function CompetitionsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { season, setSeason } = useSeason()

  // URL ?saison= override → global season
  useEffect(() => {
    const s = params.get('saison')
    if (s && s !== season) setSeason(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const level = (params.get('level') as Level) || 'national'
  const codent = params.get('codent') || ''
  const ligue = params.get('ligue') || ''
  const pouleCode = params.get('poule') || ''
  const gender = (params.get('gender') as Gender) || 'all'
  const view = (params.get('view') as View) || 'poules'

  const [entities, setEntities] = useState<Entity[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [poules, setPoules] = useState<Poule[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [rankings, setRankings] = useState<RankingRow[]>([])
  const [pouleName, setPouleName] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matchBucketFilter, setMatchBucketFilter] = useState<MatchBucket>('all')
  const [dataSource, setDataSource] = useState<string | null>(null)

  const setQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    })
    setParams(next, { replace: true })
  }

  // Load entities + departments once
  useEffect(() => {
    fetchEntities()
      .then(setEntities)
      .catch(() => setEntities([]))
    fetchDepartments()
      .then(setDepartments)
      .catch(() => setDepartments([]))
  }, [])

  const deptsForLigue = useMemo(() => {
    if (!ligue) return departments
    return departments.filter((d) => d.ligueCodent === ligue)
  }, [departments, ligue])

  const selectedDept = useMemo(
    () => departments.find((d) => d.codent === codent),
    [departments, codent],
  )

  const selectedLigue = useMemo(
    () => entities.find((e) => e.codent === (ligue || (!isDeptCodent(codent) ? codent : ''))),
    [entities, ligue, codent],
  )

  // Load poules when level/codent changes
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      setDataSource(null)
      try {
        if (level === 'national') {
          const list = await fetchNationalPoules(season)
          if (!cancelled) {
            setPoules(list)
            setDataSource('api-nationale')
          }
        } else if (level === 'departemental') {
          if (!codent || !isDeptCodent(codent)) {
            if (!cancelled) setPoules([])
          } else {
            const list = await fetchPoules(codent, season)
            if (!cancelled) {
              setPoules(list)
              setDataSource('ffvbbeach-dept')
            }
          }
        } else {
          // regional
          const c = codent && !isDeptCodent(codent) ? codent : ligue
          if (!c) {
            if (!cancelled) setPoules([])
          } else {
            const list = await fetchPoules(c, season)
            if (!cancelled) {
              setPoules(list)
              setDataSource('api-regionale')
            }
          }
        }
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
  }, [level, codent, ligue, season])

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

  const effectiveCodent =
    level === 'departemental'
      ? codent
      : level === 'regional'
        ? codent && !isDeptCodent(codent)
          ? codent
          : ligue
        : 'ABCCS'

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
              fetchNationalMatches({
                poule: pouleCode,
                status: 'completed',
                limit: 200,
                saison: season,
              }),
              fetchNationalMatches({
                poule: pouleCode,
                status: 'scheduled',
                limit: 100,
                saison: season,
              }),
            ])
            const seen = new Set<string>()
            const all = [] as typeof done.matches
            ;[...(done.matches || []), ...(soon.matches || [])].forEach((m) => {
              if (!seen.has(m.match_id)) {
                seen.add(m.match_id)
                all.push(m)
              }
            })
            if (!cancelled) setMatches(all)
          } else {
            const c = effectiveCodent
            const [done, soon] = await Promise.all([
              fetchMatches({
                codent: c,
                poule: pouleCode,
                status: 'completed',
                limit: 200,
                saison: season,
              }),
              fetchMatches({
                codent: c,
                poule: pouleCode,
                status: 'scheduled',
                limit: 100,
                saison: season,
              }),
            ])
            const seen = new Set<string>()
            const all = [] as typeof done.matches
            ;[...(done.matches || []), ...(soon.matches || [])].forEach((m) => {
              if (!seen.has(m.match_id)) {
                seen.add(m.match_id)
                all.push(m)
              }
            })
            if (!cancelled) setMatches(all)
          }
        } else if (view === 'classement' && selectedPoule) {
          if (level === 'departemental' || isDeptCodent(effectiveCodent)) {
            const data = await fetchDeptRankings(effectiveCodent, pouleCode, season)
            if (!cancelled) {
              setRankings(data.rankings || [])
              setPouleName(data.poule_name || selectedPoule.poule_name)
            }
          } else if (level === 'national') {
            const data = await fetchNationalRankings(selectedPoule.id)
            if (!cancelled) {
              setRankings(data.rankings || [])
              setPouleName(data.poule_name || selectedPoule.poule_name)
            }
          } else {
            const data = await fetchRankings(selectedPoule.id)
            if (!cancelled) {
              setRankings(data.rankings || [])
              setPouleName(data.poule_name || selectedPoule.poule_name)
            }
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
  }, [pouleCode, view, level, effectiveCodent, selectedPoule, season])

  const favId = selectedPoule
    ? pouleFavId(
        selectedPoule.codent ||
          (level === 'national' ? 'ABCCS' : effectiveCodent || codent),
        selectedPoule.poule_id,
      )
    : ''
  const favActive = favId ? isFavorite(favId) : false

  const officialDeptUrl =
    level === 'departemental' && codent
      ? `https://www.ffvbbeach.org/ffvbapp/resu/vbspo_home.php?saison=${encodeURIComponent(season)}&codent=${encodeURIComponent(codent)}`
      : null

  const scopeLabel =
    level === 'national'
      ? 'National'
      : level === 'departemental'
        ? selectedDept
          ? `${selectedDept.dept} — ${selectedDept.name}`
          : codent || 'Département'
        : selectedLigue?.name || codent || ligue || 'Ligue'

  return (
    <div className="page">
      <TopBar subtitle="Compétitions · poules · classements" />

      <SeasonSelect variant="chips" />

      <div className="chips">
        <button
          type="button"
          className={`chip${level === 'national' ? ' active' : ''}`}
          onClick={() =>
            setQuery({
              level: 'national',
              codent: null,
              ligue: null,
              poule: null,
              view: 'poules',
            })
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
              ligue: ligue || (!isDeptCodent(codent) ? codent : '') || 'LIFL',
              codent: ligue || (!isDeptCodent(codent) ? codent : '') || 'LIFL',
              poule: null,
              view: 'poules',
            })
          }
        >
          Régional
        </button>
        <button
          type="button"
          className={`chip${level === 'departemental' ? ' active' : ''}`}
          onClick={() =>
            setQuery({
              level: 'departemental',
              ligue: ligue || 'LIFL',
              codent: isDeptCodent(codent) ? codent : 'PTFL59',
              poule: null,
              view: 'poules',
            })
          }
        >
          Départemental
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
            value={codent && !isDeptCodent(codent) ? codent : ligue}
            onChange={(e) =>
              setQuery({
                ligue: e.target.value,
                codent: e.target.value,
                poule: null,
                view: 'poules',
              })
            }
            aria-label="Ligue régionale"
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

      {level === 'departemental' && (
        <div className="filters-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <select
            className="filter-select"
            value={ligue || selectedDept?.ligueCodent || ''}
            onChange={(e) => {
              const nextLigue = e.target.value
              const first = departments.find((d) => d.ligueCodent === nextLigue)
              setQuery({
                ligue: nextLigue,
                codent: first?.codent || null,
                poule: null,
                view: 'poules',
              })
            }}
            aria-label="Ligue (filtre départements)"
          >
            <option value="">— Toutes les ligues —</option>
            {entities.map((en) => (
              <option key={en.codent} value={en.codent}>
                {en.name}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={codent}
            onChange={(e) =>
              setQuery({
                codent: e.target.value,
                ligue:
                  departments.find((d) => d.codent === e.target.value)?.ligueCodent ||
                  ligue ||
                  null,
                poule: null,
                view: 'poules',
              })
            }
            aria-label="Département"
          >
            <option value="">— Choisir un département —</option>
            {deptsForLigue.map((d) => (
              <option key={d.codent} value={d.codent}>
                {d.dept} — {d.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {level === 'departemental' && dataSource === 'ffvbbeach-dept' && (
        <p
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-dim)',
            margin: '4px 0 10px',
            lineHeight: 1.4,
          }}
        >
          Source : site officiel FFVB (ffvbbeach.org) · saison {season}
          {officialDeptUrl && (
            <>
              {' · '}
              <a
                href={officialDeptUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)', textDecoration: 'none' }}
              >
                comparer sur ffvb <ExternalLink size={11} style={{ verticalAlign: '-1px' }} />
              </a>
            </>
          )}
        </p>
      )}

      {level !== 'departemental' && poules.length === 0 && !loading && (codent || level === 'national') && (
        <p
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            margin: '0 0 10px',
            lineHeight: 1.45,
          }}
        >
          Aucune poule pour la saison <strong>{season}</strong> dans cette source.
          {season !== currentSeasonFull()
            ? ' L’agrégat national/régional peut encore être sur 2025/2026 — bascule de saison ou ouvre l’onglet Départemental.'
            : ' Les données départementales (onglet Dépt.) suivent mieux la saison en cours.'}
        </p>
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
          <div
            className="detail-header"
            style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
          >
            <div style={{ flex: 1 }}>
              <div className="poule-code" style={{ display: 'inline-block', marginBottom: 8 }}>
                {selectedPoule.poule_id}
              </div>
              <h1 style={{ fontSize: '1.1rem' }}>
                {(selectedPoule.label || selectedPoule.poule_name).replace(/^[A-Z0-9]+ - /, '')}
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
                {selectedPoule.saison || season}
                {' · '}
                {scopeLabel}
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
                  meta:
                    level === 'national'
                      ? 'National'
                      : level === 'departemental'
                        ? scopeLabel
                        : effectiveCodent,
                  pouleNumericId: selectedPoule.id,
                  pouleCode: selectedPoule.poule_id,
                  codent:
                    selectedPoule.codent ||
                    effectiveCodent ||
                    (level === 'national' ? 'ABCCS' : codent),
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
              ) : (
                (() => {
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
                })()
              )}
            </>
          )}

          {view === 'classement' && (
            <>
              {loadingDetail ? (
                <SkeletonList count={3} />
              ) : (
                <>
                  {pouleName && (
                    <p
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        marginBottom: 10,
                      }}
                    >
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
          ) : level === 'regional' && !(codent || ligue) ? (
            <EmptyState
              title="Choisis une ligue"
              subtitle="Sélectionne ta région pour afficher les poules régionales."
            />
          ) : level === 'departemental' && !codent ? (
            <EmptyState
              title="Choisis un département"
              subtitle="Filtre par ligue puis par département pour comparer avec le site officiel FFVB."
            />
          ) : filteredPoules.length === 0 ? (
            <EmptyState
              title="Aucune poule"
              subtitle="Essaie un autre filtre genre / ligue / département."
            />
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

          {level === 'regional' && (codent === 'LIFL' || ligue === 'LIFL') && (
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-dim)',
                marginTop: 12,
                textAlign: 'center',
              }}
            >
              Astuce : pour le Nord / Pas-de-Calais / etc., passe sur l’onglet{' '}
              <strong>Départemental</strong>.
            </p>
          )}

          {level === 'departemental' && codent === 'PTFL59' && (
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-dim)',
                marginTop: 12,
                textAlign: 'center',
              }}
            >
              Comité Nord (59) — mêmes poules que sur le site officiel FFVB.
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
    <button
      type="button"
      className="card card-clickable poule-item"
      onClick={onOpen}
      style={{ width: '100%', textAlign: 'left' }}
    >
      <div className="poule-code">{poule.poule_id}</div>
      <div className="poule-info">
        <h3>{title}</h3>
        <p>
          {poule.saison}
          {g && (
            <span
              className={`badge ${g === 'F' ? 'gender-f' : 'gender-m'}`}
              style={{ marginLeft: 8 }}
            >
              {g === 'F' ? 'Fém.' : 'Masc.'}
            </span>
          )}
        </p>
      </div>
      <ChevronRight size={18} style={{ color: 'var(--text-dim)' }} />
    </button>
  )
}
