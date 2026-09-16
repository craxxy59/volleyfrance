import { Star, Bell } from 'lucide-react'
import { useFavorites } from '../hooks/useFavorites'
import { teamFavId } from '../lib/favorites'

interface Props {
  teamName: string
  meta?: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function FollowButton({ teamName, meta, size = 'md', showLabel = false }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites()
  if (!teamName) return null
  const id = teamFavId(teamName)
  const active = isFavorite(id)
  const dim = size === 'sm' ? 28 : size === 'lg' ? 44 : 36
  const icon = size === 'sm' ? 14 : size === 'lg' ? 18 : 16

  return (
    <button
      type="button"
      className={`follow-btn${active ? ' active' : ''}${showLabel ? ' with-label' : ''}`}
      style={{ minWidth: showLabel ? undefined : dim, height: dim }}
      aria-pressed={active}
      aria-label={active ? `Ne plus suivre ${teamName}` : `Suivre ${teamName}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavorite({
          id,
          kind: 'team',
          label: teamName,
          meta: meta || 'Équipe suivie',
        })
      }}
    >
      {active ? (
        <>
          <Bell size={icon} fill="currentColor" />
          {showLabel && <span>Suivie</span>}
        </>
      ) : (
        <>
          <Star size={icon} />
          {showLabel && <span>Suivre</span>}
        </>
      )}
    </button>
  )
}
