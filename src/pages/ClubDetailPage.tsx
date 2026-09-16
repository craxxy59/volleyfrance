import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Star, Phone, Mail, Globe, MapPin } from 'lucide-react'
import { MatchCard } from '../components/MatchCard'
import { SkeletonList, EmptyState, ErrorState } from '../components/Loading'
import {
  deptLabel,
  fetchClubs,
  fetchMatches,
  fetchNationalMatches,
  PRATIQUE_LABELS,
  searchTeams,
} from '../lib/api'
import type { Club, Match } from '../types'
import { clubFavId } from '../lib/favorites'
import { useFavorites } from '../hooks/useFavorites'

export function ClubDetailPage() {
  const { id } = useParams()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [club, setClub] = useState<Club | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const clubs = await fetchClubs()
        const found = clubs.find((c) => c.id_club === id) || null
        if (!cancelled) setClub(found)
        if (found) {
          // Try to find related team results via search on short name tokens
          const token = found.name
            .replace(/\b(VOLLEY|BALL|CLUB|AS|ASSOC(?:IATION)?|SPORTIVE|OMNISPORTS|UC|VB)\b/gi, ' ')
            .trim()
            .split(/\s+/)
            .filter((t) => t.length > 3)[0]
          if (token) {
            try {
              const s = await searchTeams(token)
              const team = (s.teams || []).find((t) =>
                t.toUpperCase().includes(token.toUpperCase()),
              )
              if (team) {
                const [nat, reg] = await Promise.all([
                  fetchNationalMatches({ team, limit: 15 }).catch(() => ({ matches: [] as Match[] })),
                  fetchMatches({ team, limit: 15 }).catch(() => ({ matches: [] as Match[] })),
                ])
                const all = [...(nat.matches || []), ...(reg.matches || [])]
                // dedupe
                const seen = new Set<string>()
                const uniq = all.filter((m) => {
                  if (seen.has(m.match_id)) return false
                  seen.add(m.match_id)
                  return true
                })
                if (!cancelled) setMatches(uniq.slice(0, 20))
              }
            } catch {
              /* optional */
            }
          }
        }
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
  }, [id])

  const fav = club ? isFavorite(clubFavId(club.id_club)) : false
  const phone = club?.telport || club?.telfixe
  const cityLine = useMemo(() => {
    if (!club) return ''
    return [club.adresse, club.cpostal, club.ville].filter(Boolean).join(', ') || deptLabel(club.id_dept)
  }, [club])

  if (loading) {
    return (
      <div className="page">
        <SkeletonList count={4} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <ErrorState message={error} />
      </div>
    )
  }

  if (!club) {
    return (
      <div className="page">
        <Link to="/clubs" className="back-btn">
          <ArrowLeft size={16} /> Retour
        </Link>
        <EmptyState title="Club introuvable" />
      </div>
    )
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/clubs" className="back-btn">
          <ArrowLeft size={16} /> Clubs
        </Link>
        <button
          type="button"
          className={`icon-btn${fav ? ' active' : ''}`}
          onClick={() =>
            toggleFavorite({
              id: clubFavId(club.id_club),
              kind: 'club',
              label: club.name,
              meta: club.ville || club.cpostal || deptLabel(club.id_dept),
            })
          }
        >
          <Star size={16} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="detail-header">
        <div className="club-avatar" style={{ width: 56, height: 56, fontSize: '1rem', marginBottom: 12 }}>
          {club.name.slice(0, 2).toUpperCase()}
        </div>
        <h1>{club.name}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {deptLabel(club.id_dept)}
          {club.cpostal ? ` · ${club.cpostal}` : ''}
        </p>
        {club.pratiques?.length > 0 && (
          <div className="pratique-tags" style={{ marginTop: 10 }}>
            {club.pratiques.map((p) => (
              <span className="tag" key={p}>
                {PRATIQUE_LABELS[p] || p}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="section-head">
        <h2>Contact</h2>
      </div>
      <div className="contact-list">
        {cityLine && (
          <div className="contact-row">
            <MapPin size={18} />
            <span>{cityLine}</span>
          </div>
        )}
        {phone && (
          <a className="contact-row" href={`tel:${phone.replace(/\s/g, '')}`}>
            <Phone size={18} />
            <span>{phone}</span>
          </a>
        )}
        {club.email && (
          <a className="contact-row" href={`mailto:${club.email}`}>
            <Mail size={18} />
            <span>{club.email}</span>
          </a>
        )}
        {club.website && (
          <a
            className="contact-row"
            href={club.website.startsWith('http') ? club.website : `https://${club.website}`}
            target="_blank"
            rel="noreferrer"
          >
            <Globe size={18} />
            <span>{club.website}</span>
          </a>
        )}
        {!phone && !club.email && !club.website && (
          <div className="empty" style={{ padding: 16 }}>
            <p>Pas de coordonnées publiques pour ce club.</p>
          </div>
        )}
      </div>

      <div className="section-head">
        <h2>Résultats liés</h2>
      </div>
      {matches.length ? (
        matches.map((m) => <MatchCard key={m.match_id} match={m} />)
      ) : (
        <EmptyState
          title="Pas de matchs reliés"
          subtitle="Les noms d’équipes fédérales ne correspondent pas toujours au nom du club."
        />
      )}
    </div>
  )
}
