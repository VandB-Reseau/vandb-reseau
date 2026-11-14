import { useSyncExternalStore } from 'react'

// Travailler sans réseau (choix 114, Joseph 13/11/2026) : en réserve ou en sous-sol, les créations (visite, note, tâche,
// photo) sont gardées sur l'appareil et partent seules au retour du réseau, dans l'ordre de saisie. Les modifications ne
// passent pas hors réseau (deux personnes pourraient changer la même chose). Stockage : IndexedDB (les photos sont des
// fichiers), en mémoire si le navigateur le refuse.
export type GenreEnvoi = 'visite' | 'note' | 'tache' | 'photo'
export interface EnvoiEnAttente { id: string; genre: GenreEnvoi; libelle: string; cree: string; donnees: unknown }

const BASE = 'vandb-hors-ligne'
const MAGASIN = 'envois'
let memoire: EnvoiEnAttente[] = []
let enAttente: EnvoiEnAttente[] = []
const abonnes = new Set<() => void>()
const executeurs = new Map<GenreEnvoi, (d: unknown) => Promise<void>>()
const apresEnvoi = new Set<() => void>()
let refus: string[] = []

export const horsLigne = () => typeof navigator !== 'undefined' && navigator.onLine === false
// Erreur de transport (pas de réponse du serveur), pas un refus de la base
export function estErreurReseau(e: unknown): boolean {
  if (horsLigne()) return true
  const m = e instanceof Error ? `${e.message} ${String((e as { cause?: unknown }).cause ?? '')}` : String((e as { message?: unknown })?.message ?? e)
  return /Failed to fetch|NetworkError|Load failed|network request failed|ERR_INTERNET_DISCONNECTED/i.test(m)
}

function ouvrir(): Promise<IDBDatabase | null> {
  return new Promise((ok) => {
    try {
      const r = indexedDB.open(BASE, 1)
      r.onupgradeneeded = () => { r.result.createObjectStore(MAGASIN, { keyPath: 'id' }) }
      r.onsuccess = () => ok(r.result)
      r.onerror = () => ok(null)
    } catch { ok(null) }
  })
}
async function transaction<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | null> {
  const db = await ouvrir()
  if (!db) return null
  return new Promise((ok) => {
    const t = db.transaction(MAGASIN, mode)
    const r = f(t.objectStore(MAGASIN))
    t.oncomplete = () => { ok(r ? r.result : null); db.close() }
    t.onerror = () => { ok(null); db.close() }
  })
}
async function lireTout(): Promise<EnvoiEnAttente[]> {
  const l = await transaction<EnvoiEnAttente[]>('readonly', (s) => s.getAll())
  return [...(l ?? []), ...memoire].sort((a, b) => a.cree.localeCompare(b.cree) || a.id.localeCompare(b.id))
}
function publier(l: EnvoiEnAttente[]) { enAttente = l; abonnes.forEach((f) => f()) }

export async function mettreEnAttente(genre: GenreEnvoi, libelle: string, donnees: unknown) {
  const e: EnvoiEnAttente = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, genre, libelle, cree: new Date().toISOString(), donnees }
  const db = await ouvrir()
  if (db) { db.close(); await transaction('readwrite', (s) => { s.put(e) }) } else memoire.push(e)
  publier(await lireTout())
}
async function retirer(id: string) {
  memoire = memoire.filter((x) => x.id !== id)
  await transaction('readwrite', (s) => { s.delete(id) })
}

// Crée tout de suite si le réseau répond, sinon garde la création pour plus tard. Renvoie true si elle est en attente.
export async function creerOuGarder(genre: GenreEnvoi, libelle: string, donnees: unknown, creer: () => Promise<void>): Promise<boolean> {
  if (!horsLigne()) {
    try { await creer(); return false } catch (e) { if (!estErreurReseau(e)) throw e }
  }
  await mettreEnAttente(genre, libelle, donnees)
  return true
}

export function brancherEnvoi(genre: GenreEnvoi, f: (d: unknown) => Promise<void>) { executeurs.set(genre, f) }
export function apresEnvois(f: () => void) { apresEnvoi.add(f); return () => { apresEnvoi.delete(f) } }

// Envoi dans l'ordre de saisie ; s'arrête au premier souci de réseau. Une création refusée par la base est retirée de la
// file et signalée (elle ne repartirait jamais).
let enCours: Promise<void> | null = null
export function envoyerEnAttente(): Promise<void> {
  if (enCours) return enCours
  enCours = (async () => {
    const l = await lireTout()
    let envoyes = 0
    for (const e of l) {
      if (horsLigne()) break
      const f = executeurs.get(e.genre)
      if (!f) continue
      try { await f(e.donnees); await retirer(e.id); envoyes++ } catch (err) {
        if (estErreurReseau(err)) break
        await retirer(e.id)
        refus = [...refus, e.libelle]
      }
    }
    publier(await lireTout())
    if (envoyes || refus.length) apresEnvoi.forEach((f) => f())
  })().finally(() => { enCours = null })
  return enCours
}
export function refusEtVider(): string[] { const r = refus; refus = []; return r }

let demarre = false
export function demarrerEnvois() {
  if (demarre || typeof window === 'undefined') return
  demarre = true
  window.addEventListener('online', () => { void envoyerEnAttente() })
  void lireTout().then((l) => { publier(l); if (l.length) void envoyerEnAttente() })
}

const abonner = (f: () => void) => { abonnes.add(f); return () => { abonnes.delete(f) } }
export const useEnvoisEnAttente = () => useSyncExternalStore(abonner, () => enAttente, () => enAttente)
