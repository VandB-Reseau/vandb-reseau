// Notifications sur le téléphone (lot L8) : affiche ce que la fonction « notifier » envoie et ouvre l'écran visé.
// Choix 114 et 124 (Joseph, 13/11/2026) : les fichiers de l'app (nommés par leur contenu, dans assets/) sont gardés sur
// l'appareil à la première ouverture, puis servis tout de suite ; la page d'entrée passe toujours par le réseau (nouvelle
// version aussitôt en ligne) et sert la copie gardée seulement sans réseau. Les données (Supabase) ne passent jamais ici.
const CACHE_APP = 'app-v1'
const MAX_FICHIERS = 400
async function fichierApp(requete) {
  const cache = await caches.open(CACHE_APP)
  const garde = await cache.match(requete)
  if (garde) return garde
  const r = await fetch(requete)
  if (r.ok) {
    await cache.put(requete, r.clone())
    const cles = await cache.keys()
    // Les anciennes versions s'effacent par les plus anciennes
    if (cles.length > MAX_FICHIERS) await Promise.all(cles.slice(0, cles.length - MAX_FICHIERS + 100).map((k) => cache.delete(k)))
  }
  return r
}
async function pageEntree(requete) {
  const cache = await caches.open(CACHE_APP)
  try {
    const r = await fetch(requete)
    if (r.ok) await cache.put('./', r.clone())
    return r
  } catch (e) {
    const garde = await cache.match('./')
    if (garde) return garde
    throw e
  }
}
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return
  if (url.pathname.includes('/assets/')) e.respondWith(fichierApp(req))
  else if (req.mode === 'navigate') e.respondWith(pageEntree(req))
})
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
