import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { getNotifPrefs } from '../lib/notifications'
import { useEffect, useState } from 'react'

/** Current FFVB season label (full, not abbreviated cryptically) */
export function currentSeasonLabel() {
  // Saison sportive FR : juil. N → juin N+1
  const now = new Date()
  const y = now.getFullYear()
  const month = now.getMonth() + 1
  const start = month >= 7 ? y : y - 1
  const end = start + 1
  return `${start}/${String(end).slice(2)}`
}

interface Props {
  subtitle?: string
  right?: React.ReactNode
}

export function TopBar({ subtitle = 'Clubs · scores · équipes suivies', right }: Props) {
  const [notifOn, setNotifOn] = useState(() => getNotifPrefs().enabled)

  useEffect(() => {
    const onPrefs = () => setNotifOn(getNotifPrefs().enabled)
    window.addEventListener('vf-notif-prefs', onPrefs)
    return () => window.removeEventListener('vf-notif-prefs', onPrefs)
  }, [])

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M12 3c3.5 3.2 5.2 6.2 5.2 9s-1.7 5.8-5.2 9c-3.5-3.2-5.2-6.2-5.2-9S8.5 6.2 12 3z"
              stroke="currentColor"
              strokeWidth="1.4"
              opacity="0.9"
            />
            <path
              d="M4.5 9.5c4.5 1.2 10.5 1.2 15 0M4.5 14.5c4.5-1.2 10.5-1.2 15 0"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              opacity="0.85"
            />
          </svg>
        </div>
        <div className="brand-text">
          <h1>VolleyFrance</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      {right ?? (
        <div className="topbar-right">
          <Link
            to="/notifications"
            className={`icon-btn${notifOn ? ' active' : ''}`}
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={16} />
          </Link>
          <span className="season-chip" title="Saison sportive en cours">
            Saison {currentSeasonLabel()}
          </span>
        </div>
      )}
    </header>
  )
}
