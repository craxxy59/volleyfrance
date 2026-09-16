import type { MatchBucket } from '../lib/matchStore'

const OPTIONS: { id: MatchBucket; label: string; hint?: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'live', label: 'En cours', hint: 'Live' },
  { id: 'upcoming', label: 'À venir' },
  { id: 'past', label: 'Passés' },
]

interface Props {
  value: MatchBucket
  onChange: (v: MatchBucket) => void
  counts?: Partial<Record<MatchBucket, number>>
  /** Hide live tab when no live data source */
  hideLive?: boolean
}

export function StatusFilter({ value, onChange, counts, hideLive }: Props) {
  return (
    <div className="status-filter" role="tablist" aria-label="Filtrer par statut">
      {OPTIONS.filter((o) => !(hideLive && o.id === 'live')).map((o) => {
        const count = counts?.[o.id]
        const active = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`status-pill${active ? ' active' : ''}${o.id === 'live' ? ' live' : ''}`}
            onClick={() => onChange(o.id)}
          >
            {o.id === 'live' && <span className="live-dot" aria-hidden />}
            <span>{o.label}</span>
            {typeof count === 'number' && <span className="status-count">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
