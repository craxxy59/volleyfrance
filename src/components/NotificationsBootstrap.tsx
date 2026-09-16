import { useEffect } from 'react'
import { getNotifPrefs, syncPushTeams } from '../lib/notifications'
import { startMatchWatcher, stopMatchWatcher } from '../lib/matchWatcher'
import { subscribeFavorites } from '../lib/favorites'

/**
 * Starts local match watcher + keeps server push team list in sync.
 * Mount once at app root.
 */
export function NotificationsBootstrap() {
  useEffect(() => {
    const prefs = getNotifPrefs()
    if (prefs.enabled) {
      startMatchWatcher(90_000)
      syncPushTeams().catch(() => null)
    }

    const onPrefs = (e: Event) => {
      const detail = (e as CustomEvent).detail as { enabled?: boolean } | undefined
      if (detail?.enabled) {
        startMatchWatcher(90_000)
        syncPushTeams().catch(() => null)
      } else if (detail && detail.enabled === false) {
        stopMatchWatcher()
      } else {
        // re-read
        const p = getNotifPrefs()
        if (p.enabled) startMatchWatcher(90_000)
        else stopMatchWatcher()
        syncPushTeams().catch(() => null)
      }
    }

    window.addEventListener('vf-notif-prefs', onPrefs as EventListener)
    const unsubFav = subscribeFavorites(() => {
      if (getNotifPrefs().enabled) syncPushTeams().catch(() => null)
    })

    return () => {
      window.removeEventListener('vf-notif-prefs', onPrefs as EventListener)
      unsubFav()
      stopMatchWatcher()
    }
  }, [])

  return null
}
