/* global self, clients */
/* Web Push handler — imported by the Workbox service worker */

self.addEventListener('push', (event) => {
  let data = {
    title: 'VolleyFrance',
    body: 'Nouveau résultat pour une équipe suivie',
    url: '/favoris',
    tag: 'vf-push',
  }
  try {
    if (event.data) {
      const parsed = event.data.json()
      data = { ...data, ...parsed }
    }
  } catch {
    try {
      data.body = event.data ? event.data.text() : data.body
    } catch {
      /* keep defaults */
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'VolleyFrance', {
      body: data.body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: data.tag || 'vf-push',
      renotify: true,
      data: { url: data.url || '/favoris' },
      vibrate: [120, 60, 120],
      actions: [
        { action: 'open', title: 'Voir' },
        { action: 'dismiss', title: 'OK' },
      ],
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return
  const url = (event.notification.data && event.notification.data.url) || '/favoris'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    }),
  )
})
