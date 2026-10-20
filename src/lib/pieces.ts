// Pièces jointes des messages et des tâches : espace fichiers Supabase (seau privé « pieces »,
// script supabase/pieces_jointes.sql), lues par liens temporaires. Chaque fichier est rangé
// sous l'identifiant de son auteur ; la base ne le montre qu'à ceux qui voient le message ou la tâche.
import { supabase } from './supabase'
import { compresser } from './photos'

export interface Piece { chemin: string; nom: string; taille: number; type: string }

export const SEAU_PIECES = 'pieces'
export const TAILLE_MAX = 10 * 1024 ** 2
export const NOMBRE_MAX = 10
export const ACCEPTE = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'
const TYPES = [
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

export class ErreurPiece extends Error {}

export function messagePiece(e: unknown): string {
  if (e instanceof ErreurPiece) return e.message
  const m = e instanceof Error ? e.message : String(e)
  if (/bucket not found|not found/i.test(m)) return 'Les pièces jointes ne sont pas encore activées : le script SQL des pièces jointes doit être lancé dans Supabase.'
  if (/row-level security|unauthorized|permission/i.test(m)) return 'La base refuse le fichier : la règle d’accès des pièces jointes manque dans Supabase.'
  return 'Le fichier n’a pas pu être envoyé. Vérifie ta connexion et réessaie.'
}

export const estImage = (p: Piece) => p.type.startsWith('image/')

const aleatoire = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

// Les photos sont réduites (environ 250 Ko) ; les documents partent tels quels, 10 Mo au plus
export async function envoyerPiece(fichier: File, auteur: string): Promise<Piece> {
  const image = fichier.type.startsWith('image/')
  if (!image && !TYPES.includes(fichier.type)) throw new ErreurPiece(`« ${fichier.name} » n’est ni une photo, ni un PDF, ni un document bureautique.`)
  let contenu: Blob = fichier
  let type = fichier.type
  let nom = fichier.name
  if (image) {
    try { contenu = await compresser(fichier) } catch { throw new ErreurPiece(`« ${fichier.name} » n’est pas une photo lisible.`) }
    type = 'image/jpeg'
    nom = nom.replace(/\.[^.]+$/, '') + '.jpg'
  }
  if (contenu.size > TAILLE_MAX) throw new ErreurPiece(`« ${fichier.name} » dépasse 10 Mo.`)
  const extension = nom.includes('.') ? nom.slice(nom.lastIndexOf('.') + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  const chemin = `${auteur}/${new Date().toISOString().slice(0, 7)}/${aleatoire()}${extension ? `.${extension}` : ''}`
  const { error } = await supabase.storage.from(SEAU_PIECES).upload(chemin, contenu, { contentType: type, upsert: false })
  if (error) throw new ErreurPiece(messagePiece(error))
  return { chemin, nom, taille: contenu.size, type }
}

export async function lienPiece(chemin: string, telecharger?: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(SEAU_PIECES).createSignedUrl(chemin, 3600, telecharger ? { download: telecharger } : undefined)
  return error ? null : data.signedUrl
}

// Fichier retiré avant l'envoi ; un fichier déjà absent n'empêche rien
export async function retirerPiece(chemin: string) {
  await supabase.storage.from(SEAU_PIECES).remove([chemin]).catch(() => undefined)
}

export function normaliserPieces(v: unknown): Piece[] {
  if (!Array.isArray(v)) return []
  return v.filter((p) => p && typeof p === 'object' && typeof (p as Piece).chemin === 'string' && (p as Piece).chemin).slice(0, NOMBRE_MAX).map((x) => {
    const p = x as Record<string, unknown>
    return { chemin: String(p.chemin), nom: String(p.nom ?? 'Fichier'), taille: Number(p.taille) || 0, type: String(p.type ?? '') }
  })
}
