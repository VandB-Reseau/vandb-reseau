// Notifications sur le téléphone (lot L8) : affiche ce que la fonction « notifier » envoie et ouvre l'écran visé.
// Rien n'est mis en cache : l'app ne fonctionne pas hors connexion.
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { texte: e.data ? e.data.text() : '' } }
  e.waitUntil(self.registration.showNotification(d.titre || 'V and B', {
    body: d.texte || '', icon: 'icone-192.png', badge: 'icone-192.png', lang: 'fr', data: { lien: d.lien || '' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = self.registration.scope + ((e.notification.data && e.notification.data.lien) || '')
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (fenetres) => {
    for (const f of fenetres) {
      if (!f.url.startsWith(self.registration.scope)) continue
      try { await f.navigate(url) } catch { /* fenêtre non contrôlée : elle garde son écran */ }
      return f.focus()
    }
    return self.clients.openWindow(url)
  }))
})
