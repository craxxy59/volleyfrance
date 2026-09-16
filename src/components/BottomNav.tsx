import { NavLink } from 'react-router-dom'
import { Home, Trophy, Users, Radio, Star } from 'lucide-react'

const items = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/competitions', label: 'Compètes', icon: Trophy },
  { to: '/scores', label: 'Scores', icon: Radio },
  { to: '/clubs', label: 'Clubs', icon: Users },
  { to: '/favoris', label: 'Suivi', icon: Star },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <span className="nav-icon">
            <Icon strokeWidth={2.15} />
          </span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
