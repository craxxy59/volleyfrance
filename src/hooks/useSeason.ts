import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  SEASON_EVENT,
  SEASON_STORAGE_KEY,
  currentSeasonFull,
  listSelectableSeasons,
  normalizeSeason,
} from '../lib/season'

function readStoredSeason(): string {
  try {
    const raw = localStorage.getItem(SEASON_STORAGE_KEY)
    const n = normalizeSeason(raw)
    if (n) return n
  } catch {
    /* ignore */
  }
  return currentSeasonFull()
}

/**
 * Saison globale sélectionnée (persistée localStorage).
 * Partagée entre Compétitions, Scores, Clubs, fiches équipe…
 */
export function useSeason() {
  const [season, setSeasonState] = useState<string>(() =>
    typeof window === 'undefined' ? currentSeasonFull() : readStoredSeason(),
  )

  useEffect(() => {
    const sync = () => setSeasonState(readStoredSeason())
    window.addEventListener(SEASON_EVENT, sync)
    window.addEventListener('storage', (e) => {
      if (e.key === SEASON_STORAGE_KEY) sync()
    })
    return () => window.removeEventListener(SEASON_EVENT, sync)
  }, [])

  const setSeason = useCallback((next: string) => {
    const n = normalizeSeason(next) || currentSeasonFull()
    try {
      localStorage.setItem(SEASON_STORAGE_KEY, n)
    } catch {
      /* ignore */
    }
    setSeasonState(n)
    window.dispatchEvent(new CustomEvent(SEASON_EVENT, { detail: n }))
  }, [])

  const options = useMemo(() => listSelectableSeasons(), [season])

  return { season, setSeason, options, isCurrent: season === currentSeasonFull() }
}
