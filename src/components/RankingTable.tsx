import { Link } from 'react-router-dom'
import type { RankingRow } from '../types'
import { teamFavId } from '../lib/favorites'
import { useFavorites } from '../hooks/useFavorites'
import { FollowButton } from './FollowButton'

interface Props {
  rows: RankingRow[]
  highlightTeams?: string[]
}

export function RankingTable({ rows, highlightTeams = [] }: Props) {
  const { isFavorite } = useFavorites()
  if (!rows.length) {
    return (
      <div className="empty">
        <h3>Classement indisponible</h3>
        <p>Aucun classement publié pour cette poule pour le moment.</p>
      </div>
    )
  }

  const hi = new Set(highlightTeams.map((t) => t.toUpperCase()))

  return (
    <div className="ranking-wrap">
      <table className="ranking-table">
        <thead>
          <tr>
            <th style={{ width: 48 }}>#</th>
            <th>Équipe</th>
            <th className="num">J</th>
            <th className="num">G</th>
            <th className="num">P</th>
            <th className="num">Pts</th>
            <th className="num">Sets</th>
            <th style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const fav = isFavorite(teamFavId(r.team))
            const highlighted = hi.has(r.team.toUpperCase()) || fav
            return (
              <tr key={`${r.rank}-${r.team}`} className={highlighted ? 'highlight' : undefined}>
                <td>
                  <span className={`rank-pill${r.rank <= 3 ? ' top' : ''}`}>{r.rank}</span>
                </td>
                <td>
                  <Link
                    to={`/equipe/${encodeURIComponent(r.team)}`}
                    style={{
                      fontWeight: 650,
                      color: fav ? 'var(--orange)' : undefined,
                    }}
                  >
                    {r.team}
                  </Link>
                </td>
                <td className="num">{r.played ?? '–'}</td>
                <td className="num">{r.won ?? '–'}</td>
                <td className="num">{r.lost ?? '–'}</td>
                <td className="num">
                  <strong style={{ color: 'var(--orange)' }}>{r.points ?? '–'}</strong>
                </td>
                <td className="num" style={{ color: 'var(--text-muted)' }}>
                  {r.sets_won ?? '–'}/{r.sets_lost ?? '–'}
                </td>
                <td>
                  <FollowButton teamName={r.team} size="sm" />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
