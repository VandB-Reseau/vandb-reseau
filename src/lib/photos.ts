import { supabase } from './supabase'
import type { Photo } from '../data/grilles'

// Photos d'audit : espace fichiers Supabase (seau privé « photos »), lues par liens temporaires
export const SEAU = 'photos'
export const ESPACE_GRATUIT = 1024 ** 3 // 1 Go dans l'offre gratuite de Supabase
const COTE_MAX = 1600
const QUALITE = 0.75

export class ErreurPhoto extends Error {}

export function messagePhoto(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/bucket not found|not found/i.test(m)) return 'L’espace photos n’est pas encore activé : le script SQL des photos doit être lancé dans Supabase.'
  if (/row-level security|unauthorized|permission/i.test(m)) return 'La base refuse la photo : la règle d’accès de l’espace photos manque dans Supabase.'
  if (/image/i.test(m)) return 'Ce fichier n’est pas une photo lisible.'
  return 'La photo n’a pas pu être envoyée. Vérifie ta connexion et réessaie.'
}

// Réduit la photo du téléphone (souvent 3 à 5 Mo) à 1 600 px de côté en JPEG : environ 250 Ko
export async function compresser(fichier: File): Promise<Blob> {
  let image: ImageBitmap
  try { image = await createImageBitmap(fichier) } catch { throw new ErreurPhoto('image illisible') }
  const r = Math.min(1, COTE_MAX / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * r)
  canvas.height = Math.round(image.height * r)
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close()
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', QUALITE))
  if (!blob) throw new ErreurPhoto('image illisible')
  return blob
}

const aleatoire = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

export async function envoyerPhoto(fichier: File): Promise<Photo> {
  const blob = await compresser(fichier)
  const chemin = `audits/${new Date().toISOString().slice(0, 7)}/${aleatoire()}.jpg`
  const { error } = await supabase.storage.from(SEAU).upload(chemin, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new ErreurPhoto(error.message)
  return { chemin, taille: blob.size }
}

export async function lienPhoto(chemin: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(SEAU).createSignedUrl(chemin, 3600)
  return error ? null : data.signedUrl
}

export async function supprimerPhotos(chemins: string[]) {
  if (!chemins.length) return
  // Une photo déjà absente n'empêche pas d'enregistrer
  await supabase.storage.from(SEAU).remove(chemins).catch(() => undefined)
}

export function formatTaille(octets: number): string {
  if (octets < 1024 ** 2) return `${Math.max(1, Math.round(octets / 1024)).toLocaleString('fr-FR')} Ko`
  if (octets < 1024 ** 3) return `${(octets / 1024 ** 2).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
  return `${(octets / 1024 ** 3).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Go`
}
