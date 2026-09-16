import { Link } from 'react-router-dom'
import { ChevronRight, Star, MapPin } from 'lucide-react'
import type { Club } from '../types'
import { deptLabel, PRATIQUE_LABELS } from '../lib/api'
import { clubFavId } from '../lib/favorites'
import { useFavorites } from '../hooks/useFavorites'

function initials(name: string) {
  const parts = name.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'VB'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function ClubCard({ club }: { club: Club }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const fav = isFavorite(clubFavId(club.id_club))
  const city = club.ville || (club.cpostal ? `CP ${club.cpostal}` : deptLabel(club.id_dept))

  return (
    <div className="card club-card card-clickable" style={{ position: 'relative' }}>
      <Link
        to={`/clubs/${club.id_club}`}
        style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, minWidth: 0 }}
      >
        <div className="club-avatar">{initials(club.name)}</div>
        <div className="club-body">
          <h3>{club.name}</h3>
          <div className="club-meta">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} />
              {city}
            </span>
            <span>{deptLabel(club.id_dept)}</span>
          </div>
          {club.pratiques?.length > 0 && (
            <div className="pratique-tags">
              {club.pratiques.slice(0, 3).map((p) => (
                <span className="tag" key={p}>
                  {PRATIQUE_LABELS[p] || p}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight size={18} style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: 12 }} />
      </Link>
      <button
        type="button"
        className={`icon-btn${fav ? ' active' : ''}`}
        style={{ position: 'absolute', top: 10, right: 10 }}
        aria-label="Ajouter aux favoris"
        onClick={(e) => {
          e.preventDefault()
          toggleFavorite({
            id: clubFavId(club.id_club),
            kind: 'club',
            label: club.name,
            meta: city,
          })
        }}
      >
        <Star size={16} fill={fav ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}
