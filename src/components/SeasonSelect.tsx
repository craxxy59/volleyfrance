import { CalendarRange } from 'lucide-react'
import { useSeason } from '../hooks/useSeason'
import { currentSeasonFull, currentSeasonShort } from '../lib/season'

type Variant = 'select' | 'chips' | 'compact'

interface Props {
  /** select = menu déroulant, chips = pastilles, compact = chip cliquable topbar-like */
  variant?: Variant
  className?: string
  /** Afficher le libellé "Saison" */
  showLabel?: boolean
  /** Options supplémentaires (ex. saisons vues dans stats API) */
  extraSeasons?: string[]
}

/**
 * Sélecteur de saison globale (2025/2026, 2026/2027…).
 * La valeur est partagée app-wide via localStorage.
 */
export function SeasonSelect({
  variant = 'select',
  className = '',
  showLabel = true,
  extraSeasons = [],
}: Props) {
  const { season, setSeason, options } = useSeason()
  const all = [...new Set([...options, ...extraSeasons])].sort((a, b) => b.localeCompare(a))
  const current = currentSeasonFull()

  if (variant === 'chips') {
    return (
      <div className={`chips season-chips ${className}`.trim()} role="group" aria-label="Saison">
        {showLabel && <span className="season-chips-label">Saison</span>}
        {all.slice(0, 6).map((s) => (
          <button
            key={s}
            type="button"
            className={`chip${season === s ? ' active' : ' ghost'}`}
            onClick={() => setSeason(s)}
            title={s === current ? 'Saison en cours' : s}
          >
            {currentSeasonShort(s)}
            {s === current ? ' ·' : ''}
          </button>
        ))}
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <label className={`season-compact ${className}`.trim()} title={`Saison ${season}`}>
        <CalendarRange size={14} aria-hidden />
        <select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          aria-label="Saison sportive"
        >
          {all.map((s) => (
            <option key={s} value={s}>
              {currentSeasonShort(s)}
              {s === current ? ' (en cours)' : ''}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <div className={`season-select-wrap ${className}`.trim()}>
      {showLabel && (
        <span className="season-select-label">
          <CalendarRange size={14} /> Saison
        </span>
      )}
      <select
        className="filter-select season-select"
        value={season}
        onChange={(e) => setSeason(e.target.value)}
        aria-label="Saison sportive"
      >
        {all.map((s) => (
          <option key={s} value={s}>
            {s}
            {s === current ? ' — en cours' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
