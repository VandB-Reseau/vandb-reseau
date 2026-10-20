// Dernières données gardées sur l'appareil (IndexedDB) : l'app s'ouvre aussitôt avec elles,
// puis se met à jour en arrière-plan. Effacées à la déconnexion.
const BASE = 'vandb-reseau'
const MAGASIN = 'donnees'

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(BASE, 1)
    r.onupgradeneeded = () => { r.result.createObjectStore(MAGASIN) }
    r.onsuccess = () => ok(r.result)
    r.onerror = () => ko(r.error)
  })
}

async function agir<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  const db = await ouvrir()
  try {
    return await new Promise<T | undefined>((ok, ko) => {
      const t = db.transaction(MAGASIN, mode)
      const r = f(t.objectStore(MAGASIN))
      t.oncomplete = () => ok(r.result as T | undefined)
      t.onerror = () => ko(t.error)
      t.onabort = () => ko(t.error)
    })
  } finally { db.close() }
}

// Toute erreur (navigation privée, stockage plein, données illisibles) revient à « pas de cache »
export async function lireCache<T>(cle: string): Promise<T | null> {
  try { return (await agir<T>('readonly', (s) => s.get(cle))) ?? null } catch { return null }
}

export async function ecrireCache(cle: string, valeur: unknown): Promise<void> {
  try { await agir('readwrite', (s) => s.put(valeur, cle)) } catch { /* l'app reste utilisable sans cache */ }
}

export async function viderCache(): Promise<void> {
  try { await agir('readwrite', (s) => s.clear()) } catch { /* rien à effacer */ }
}
