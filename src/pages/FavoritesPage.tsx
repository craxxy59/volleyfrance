import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, ChevronRight, Trash2, Bell, BellRing } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { getNotifPrefs } from '../lib/notifications'
import { MatchCard } from '../components/MatchCard'
import { StatusFilter } from '../components/StatusFilter'
import { SkeletonList, EmptyState } from '../components/Loading'
import { useFavorites } from '../hooks/useFavorites'
import { removeFavorite } from '../lib/favorites'
import { fetchTeamMatches, sortMatchesChrono } from '../lib/api'
import { matchBucket, type MatchBucket } from '../lib/matchStore'
import type { Match } from '../types'

export function FavoritesPage() {
  const { favorites } = useFavorites()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(false)
  const [bucket, setBucket] = useState<MatchBucket>('all')
  const [notifOn, setNotifOn] = useState(() => getNotifPrefs().enabled)

  const teams = favorites.filter((f) => f.kind === 'team')
  const clubs = favorites.filter((f) => f.kind === 'club')
  const poules = favorites.filter((f) => f.kind === 'poule')
  const teamKey = teams.map((t) => t.id).join('|')

  useEffect(() => {
    const onPrefs = () => setNotifOn(getNotifPrefs().enabled)
    window.addEventListener('vf-notif-prefs', onPrefs)
    return () => window.removeEventListener('vf-notif-prefs', onPrefs)
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!teams.length) {
        setMatches([])
        return
      }
      setLoading(true)
      try {
        const results = await Promise.all(
          teams.slice(0, 8).map((t) => fetchTeamMatches(t.label, { limit: 20 }).catch(() => [] as Match[])),
        )
        if (cancelled) return
        const seen = new Set<string>()
        const all: Match[] = []
        results.flat().forEach((m) => {
          if (!seen.has(m.match_id)) {
            seen.add(m.match_id)
            all.push(m)
          }
        })
        setMatches(all)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamKey])

  const counts = useMemo(() => {
    const c: Partial<Record<MatchBucket, number>> = { all: matches.length, live: 0, upcoming: 0, past: 0 }
    matches.forEach((m) => {
      const b = matchBucket(m.status)
      c[b] = (c[b] || 0) + 1
    })
    return c
  }, [matches])

  const filtered = useMemo(() => {
    const list = bucket === 'all' ? matches : matches.filter((m) => matchBucket(m.status) === bucket)
    return sortMatchesChrono(list, bucket === 'upcoming' ? 'asc' : 'desc').slice(0, 40)
  }, [matches, bucket])

  return (
    <div className="page">
      <TopBar subtitle="Équipes suivies · alertes perso" />

      <Link to="/notifications" className={`notif-cta card card-clickable${notifOn ? ' on' : ''}`}>
        <div className="notif-cta-icon">
          {notifOn ? <BellRing size={18} /> : <Bell size={18} />}
        </div>
        <div className="notif-cta-body">
          <strong>{notifOn ? 'Notifications activées' : 'Activer les notifications'}</strong>
          <span>
            {notifOn
              ? 'Alerte quand une équipe suivie finit un match (Android).'
              : 'Reçois une notif Android dès qu’une équipe suivie a un résultat.'}
          </span>
        </div>
        <ChevronRight size={18} style={{ color: 'var(--text-dim)' }} />
      </Link>

      {!favorites.length ? (
        <EmptyState
          title="Aucune équipe suivie"
          subtitle="Sur un match, appuie sur ★ Suivre à côté d’une équipe. Tu retrouveras ici tous ses matchs à venir et passés."
        />
      ) : (
        <>
          {teams.length > 0 && (
            <>
              <div className="section-head">
                <h2>
                  <Bell size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Équipes suivies ({teams.length})
                </h2>
              </div>
              {teams.map((f) => (
                <div key={f.id} className="card fav-list-item">
                  <Link
                    to={`/equipe/${encodeURIComponent(f.label)}`}
                    style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}
                  >
                    <div
                      className="club-avatar"
                      style={{
                        width: 42,
                        height: 42,
                        background: 'var(--orange-soft)',
                        color: 'var(--orange)',
                      }}
                    >
                      <Star size={16} fill="currentColor" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{f.label}</div>
                      <div className="kind">{f.meta || 'Équipe'}</div>
                    </div>
                    <ChevronRight size={18} style={{ color: 'var(--text-dim)' }} />
                  </Link>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Ne plus suivre"
                    onClick={() => removeFavorite(f.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </>
          )}

          {poules.length > 0 && (
            <>
              <div className="section-head">
                <h2>Poules ({poules.length})</h2>
              </div>
              {poules.map((f) => (
                <Link
                  key={f.id}
                  to={`/competitions?level=${f.national ? 'national' : 'regional'}${
                    f.codent && !f.national ? `&codent=${f.codent}` : ''
                  }${f.pouleCode ? `&poule=${f.pouleCode}&view=classement` : ''}`}
                  className="card card-clickable fav-list-item"
                >
                  <div className="poule-code">{f.pouleCode || 'PL'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{f.label}</div>
                    <div className="kind">{f.meta}</div>
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--text-dim)' }} />
                </Link>
              ))}
            </>
          )}

          {clubs.length > 0 && (
            <>
              <div className="section-head">
                <h2>Clubs ({clubs.length})</h2>
              </div>
              {clubs.map((f) => {
                const clubId = f.id.replace(/^club:/, '')
                return (
                  <Link key={f.id} to={`/clubs/${clubId}`} className="card card-clickable fav-list-item">
                    <div className="club-avatar" style={{ width: 40, height: 40 }}>
                      {f.label.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{f.label}</div>
                      {f.meta && <div className="kind">{f.meta}</div>}
                    </div>
                    <ChevronRight size={18} style={{ color: 'var(--text-dim)' }} />
                  </Link>
                )
              })}
            </>
          )}

          {teams.length > 0 && (
            <>
              <div className="section-head">
                <h2>Matchs de tes équipes</h2>
              </div>
              <StatusFilter value={bucket} onChange={setBucket} counts={counts} hideLive={!counts.live} />
              {loading ? (
                <SkeletonList count={3} />
              ) : filtered.length ? (
                filtered.map((m) => (
                  <MatchCard key={m.match_id} match={m} highlightTeams={teams.map((t) => t.label)} />
                ))
              ) : (
                <EmptyState
                  title="Pas de matchs dans ce filtre"
                  subtitle="Change de statut ou ajoute d’autres équipes."
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
