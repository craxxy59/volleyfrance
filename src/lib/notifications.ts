import { getFavorites } from './favorites'

const PREFS_KEY = 'volleyfrance.notif.prefs.v1'
const SUB_KEY = 'volleyfrance.notif.subscription.v1'
const SEEN_KEY = 'volleyfrance.notif.seen.v1'

export type NotifPrefs = {
  enabled: boolean
  onFinished: boolean
  onUpcoming: boolean
  /** minutes before kickoff for upcoming alerts */
  upcomingMinutes: number
}

const DEFAULT_PREFS: NotifPrefs = {
  enabled: false,
  onFinished: true,
  onUpcoming: true,
  upcomingMinutes: 60,
}

export function getNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function setNotifPrefs(patch: Partial<NotifPrefs>) {
  const next = { ...getNotifPrefs(), ...patch }
  localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('vf-notif-prefs', { detail: next }))
  return next
}

export function followedTeamNames(): string[] {
  return getFavorites()
    .filter((f) => f.kind === 'team')
    .map((f) => f.label)
}

export function notificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  )
}

export function pushSupported(): boolean {
  return notificationSupported() && 'PushManager' in window
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationSupported()) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

/** Local OS notification (works great on Android Chrome when permission granted) */
export async function showLocalNotification(opts: {
  title: string
  body: string
  url?: string
  tag?: string
}) {
  const perm = await ensureNotificationPermission()
  if (perm !== 'granted') return false

  const tag = opts.tag || `vf-${Date.now()}`
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(opts.title, {
      body: opts.body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag,
      renotify: true,
      data: { url: opts.url || '/favoris' },
      vibrate: [120, 60, 120],
    } as NotificationOptions)
    return true
  } catch {
    try {
      // Fallback when SW not ready (dev)
      new Notification(opts.title, { body: opts.body, tag })
      return true
    } catch {
      return false
    }
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/.netlify/functions/vapid-public-key', { cache: 'no-store' })
    if (!res.ok) {
      // Vercel / local fallback endpoint
      const res2 = await fetch('/api/vapid-public-key', { cache: 'no-store' })
      if (!res2.ok) return null
      const j = await res2.json()
      return j.publicKey || null
    }
    const j = await res.json()
    return j.publicKey || null
  } catch {
    return null
  }
}

export async function subscribeWebPush(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const perm = await ensureNotificationPermission()
  if (perm !== 'granted') return null

  const vapid = await getVapidPublicKey()
  if (!vapid) {
    // Local-only mode still works without server push keys
    return null
  }

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    })
  }

  const teams = followedTeamNames()
  const prefs = getNotifPrefs()
  await fetch('/.netlify/functions/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      teams,
      prefs: {
        onFinished: prefs.onFinished,
        onUpcoming: prefs.onUpcoming,
        upcomingMinutes: prefs.upcomingMinutes,
      },
    }),
  }).catch(() => null)

  // also try vercel path
  await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      teams,
      prefs: {
        onFinished: prefs.onFinished,
        onUpcoming: prefs.onUpcoming,
        upcomingMinutes: prefs.upcomingMinutes,
      },
    }),
  }).catch(() => null)

  localStorage.setItem(SUB_KEY, JSON.stringify(sub.toJSON()))
  return sub
}

export async function syncPushTeams() {
  const raw = localStorage.getItem(SUB_KEY)
  if (!raw) {
    // try live subscription
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (!sub) return
      localStorage.setItem(SUB_KEY, JSON.stringify(sub.toJSON()))
      await postTeams(sub.toJSON())
    } catch {
      /* ignore */
    }
    return
  }
  try {
    await postTeams(JSON.parse(raw))
  } catch {
    /* ignore */
  }
}

async function postTeams(subscription: PushSubscriptionJSON) {
  const prefs = getNotifPrefs()
  const payload = {
    subscription,
    teams: followedTeamNames(),
    prefs: {
      onFinished: prefs.onFinished,
      onUpcoming: prefs.onUpcoming,
      upcomingMinutes: prefs.upcomingMinutes,
    },
  }
  await Promise.allSettled([
    fetch('/.netlify/functions/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  ])
}

export async function unsubscribeWebPush() {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      const json = sub.toJSON()
      await Promise.allSettled([
        fetch('/.netlify/functions/push-unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: json.endpoint }),
        }),
        fetch('/api/push-unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: json.endpoint }),
        }),
      ])
      await sub.unsubscribe()
    }
  } catch {
    /* ignore */
  }
  localStorage.removeItem(SUB_KEY)
}

/* ─── Seen match state (dedupe local alerts) ─── */

type SeenMap = Record<string, string>

function readSeen(): SeenMap {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeSeen(map: SeenMap) {
  const keys = Object.keys(map)
  if (keys.length > 400) {
    keys.slice(0, keys.length - 300).forEach((k) => delete map[k])
  }
  localStorage.setItem(SEEN_KEY, JSON.stringify(map))
}

export function markMatchSeen(matchId: string, fingerprint: string) {
  const map = readSeen()
  map[matchId] = fingerprint
  writeSeen(map)
}

export function wasMatchSeen(matchId: string, fingerprint: string): boolean {
  return readSeen()[matchId] === fingerprint
}

export function matchFingerprint(m: {
  status: string
  score_home?: number | null
  score_away?: number | null
}): string {
  return `${m.status}:${m.score_home ?? 'x'}:${m.score_away ?? 'x'}`
}
