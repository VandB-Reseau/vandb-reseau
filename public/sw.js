// Notifications sur le téléphone (lot L8) : affiche ce que la fonction « notifier » envoie et ouvre l'écran visé.
// Rien n'est mis en cache : l'app ne fonctionne pas hors connexion.
// Partage vers l'app (sprint 25, F5, Android) : la galerie envoie ses photos à « partage » ; elles sont gardées le temps
// que l'écran Partager les reprenne (cache « partage », vidé à chaque nouveau partage et après usage).
const CACHE_PARTAGE = 'partage'
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'POST' || e.request.url.split('?')[0] !== self.registration.scope + 'partage') return
  e.respondWith((async () => {
    const scope = self.registration.scope
    try {
      const f = await e.request.formData()
      await caches.delete(CACHE_PARTAGE)
      const cache = await caches.open(CACHE_PARTAGE)
      const photos = f.getAll('photos').filter((x) => typeof x === 'object' && x.type && x.type.startsWith('image/')).slice(0, 10)
      for (let i = 0; i < photos.length; i++) {
        await cache.put(`${scope}partage/photo-${i}`, new Response(photos[i], { headers: { 'Content-Type': photos[i].type, 'X-Nom': encodeURIComponent(photos[i].name || `photo-${i + 1}.jpg`) } }))
      }
      const texte = ['titre', 'texte', 'lien'].map((k) => f.get(k)).filter((x) => typeof x === 'string' && x.trim()).join('\n')
      await cache.put(`${scope}partage/texte`, new Response(texte, { headers: { 'Content-Type': 'text/plain;charset=utf-8' } }))
    } catch { /* partage illisible : l'écran Partager dit qu'il n'y a rien */ }
    return Response.redirect(scope + '#/partage', 303)
  })())
})

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
