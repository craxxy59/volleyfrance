import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { ClubCard } from '../components/ClubCard'
import { SkeletonList, EmptyState, ErrorState } from '../components/Loading'
import { clubSearchText, deptLabel, fetchClubs } from '../lib/api'
import type { Club } from '../types'
import { SeasonSelect } from '../components/SeasonSelect'
import { useSeason } from '../hooks/useSeason'

const PAGE = 40

export function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [pratique, setPratique] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(PAGE)
  const { season } = useSeason()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchClubs()
      setClubs(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur clubs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const depts = useMemo(() => {
    const map = new Map<string, number>()
    clubs.forEach((c) => {
      const id = c.id_dept || '?'
      map.set(id, (map.get(id) || 0) + 1)
    })
    return [...map.entries()]
      .sort((a, b) => deptLabel(a[0]).localeCompare(deptLabel(b[0]), 'fr'))
      .map(([id, count]) => ({ id, count }))
  }, [clubs])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return clubs.filter((c) => {
      if (dept && c.id_dept !== dept) return false
      if (pratique && !(c.pratiques || []).includes(pratique)) return false
      if (query && !clubSearchText(c).includes(query)) return false
      return true
    })
  }, [clubs, q, dept, pratique])

  useEffect(() => {
    setVisible(PAGE)
  }, [q, dept, pratique])

  // Default hint for Lille user
  useEffect(() => {
    if (!loading && clubs.length && !dept && !q) {
      // soft default nothing — user can pick Nord
    }
  }, [loading, clubs, dept, q])

  return (
    <div className="page">
      <TopBar subtitle="Annuaire clubs FFVolley" />

      <SeasonSelect variant="chips" />

      <div className="search-bar">
        <Search size={18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom, ville, code postal…"
          autoComplete="off"
        />
      </div>

      <div className="filters-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <select
          className="filter-select"
          value={dept}
          onChange={(e) => setDept(e.target.value)}
        >
          <option value="">Tous les départements</option>
          <option value="059">59 — Nord</option>
          <option value="062">62 — Pas-de-Calais</option>
          <option value="080">80 — Somme</option>
          <option value="060">60 — Oise</option>
          <option value="002">02 — Aisne</option>
          <option disabled>──────────</option>
          {depts.map((d) => (
            <option key={d.id} value={d.id}>
              {deptLabel(d.id)} ({d.count})
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={pratique}
          onChange={(e) => setPratique(e.target.value)}
        >
          <option value="">Toutes pratiques</option>
          <option value="vb">Volley indoor</option>
          <option value="bv">Beach-volley</option>
          <option value="competlib">Compet’Lib</option>
        </select>
      </div>

      <div className="chips">
        <button type="button" className={`chip ghost${dept === '059' ? ' active' : ''}`} onClick={() => setDept(dept === '059' ? '' : '059')}>
          Nord 59
        </button>
        <button type="button" className={`chip ghost${dept === '062' ? ' active' : ''}`} onClick={() => setDept(dept === '062' ? '' : '062')}>
          PdC 62
        </button>
        <button type="button" className={`chip ghost${q.toLowerCase() === 'lille' ? ' active' : ''}`} onClick={() => setQ(q.toLowerCase() === 'lille' ? '' : 'lille')}>
          Lille
        </button>
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        {loading ? 'Chargement…' : `${filtered.length} club${filtered.length > 1 ? 's' : ''}`}
        {!loading && clubs.length > 0 && ` · ${clubs.length} au total`}
        {!loading && ` · saison ${season} (équipes & matchs du club)`}
      </p>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <SkeletonList count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucun club" subtitle="Élargis ta recherche ou change de département." />
      ) : (
        <>
          {filtered.slice(0, visible).map((c) => (
            <ClubCard key={c.id_club} club={c} />
          ))}
          {visible < filtered.length && (
            <button type="button" className="load-more" onClick={() => setVisible((v) => v + PAGE)}>
              Voir plus ({filtered.length - visible} restants)
            </button>
          )}
        </>
      )}
    </div>
  )
}
