// Partage vers l'app (sprint 25, F5) : ce que public/sw.js a reçu de la galerie du téléphone (Android, app installée).
const CACHE = 'partage'
export interface Partage { photos: File[]; texte: string }

const base = () => new URL('partage/', new URL(import.meta.env.BASE_URL, location.href)).href

export async function lirePartage(): Promise<Partage> {
  if (!('caches' in window)) return { photos: [], texte: '' }
  try {
    const cache = await caches.open(CACHE)
    const photos: File[] = []
    for (const r of await cache.keys()) {
      if (!r.url.startsWith(base() + 'photo-')) continue
      const rep = await cache.match(r)
      if (!rep) continue
      const blob = await rep.blob()
      photos.push(new File([blob], decodeURIComponent(rep.headers.get('X-Nom') ?? 'photo.jpg'), { type: blob.type || 'image/jpeg' }))
    }
    const t = await cache.match(base() + 'texte')
    return { photos, texte: t ? (await t.text()).trim() : '' }
  } catch {
    return { photos: [], texte: '' }
  }
}

export async function viderPartage() {
  if ('caches' in window) await caches.delete(CACHE).catch(() => false)
}
