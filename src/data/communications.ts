// Communications du réseau vers les franchisés (script supabase/communications.sql) : publiées par le Directeur
// de réseau (tout le réseau) ou un Responsable Régional (ses magasins), lues, commentées et « J'aime » par l'équipe
// et les franchisés concernés. Tout passe par des fonctions de la base.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { normaliserPieces, type Piece } from '../lib/pieces'

export interface Commentaire { id: number; auteur: string; auteurNom: string; auteurRole: string; texte: string; creeLe: string }
export interface Communication {
  id: number; titre: string; texte: string; pieces: Piece[]; magasins: string[] | null
  html: string | null // communication mise en forme (nettoyée à l'affichage), texte = sa version brute
  entete: string | null // chemin de la photo d'en-tête, parmi les pièces jointes
  auteur: string; auteurNom: string; auteurRole: string; creeLe: string; modifieLe: string | null
  pouces: { userId: string; nom: string }[]; commentaires: Commentaire[]
}
export interface Communications { moi: string; role: string; liste: Communication[] }

type Ligne = Record<string, unknown>
const t = (v: unknown) => (v === null || v === undefined ? '' : String(v))
const lignes = (v: unknown) => (Array.isArray(v) ? (v as Ligne[]).filter((x) => x && typeof x === 'object') : [])

// null : communications pas encore activées dans la base
export async function chargerCommunications(): Promise<Communications | null> {
  const { data, error } = await supabase.rpc('communications')
  if (error || !data || typeof data !== 'object') return null
  const d = data as Ligne
  return {
    moi: t(d.moi), role: t(d.role),
    liste: lignes(d.liste).map((c) => ({
      id: Number(c.id), titre: t(c.titre), texte: t(c.texte), pieces: normaliserPieces(c.pieces),
      html: c.html ? t(c.html) : null, entete: c.entete ? t(c.entete) : null,
      magasins: Array.isArray(c.magasins) ? c.magasins.map(String) : null,
      auteur: t(c.auteur), auteurNom: t(c.auteur_nom), auteurRole: t(c.auteur_role), creeLe: t(c.cree_le), modifieLe: c.modifie_le ? t(c.modifie_le) : null,
      pouces: lignes(c.pouces).map((p) => ({ userId: t(p.user_id), nom: t(p.nom) })),
      commentaires: lignes(c.commentaires).map((k) => ({ id: Number(k.id), auteur: t(k.auteur), auteurNom: t(k.auteur_nom), auteurRole: t(k.auteur_role), texte: t(k.texte), creeLe: t(k.cree_le) })),
    })),
  }
}

async function appeler(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data
}

export const publierCommunication = (id: number | null, titre: string, texte: string, pieces: Piece[], html: string | null = null, entete: string | null = null) =>
  appeler('publier_communication', { p_id: id, p_titre: titre, p_texte: texte, p_pieces: pieces, p_html: html, p_entete: entete })
export const supprimerCommunication = (id: number) => appeler('supprimer_communication', { p_id: id })
export const basculerPouce = (id: number) => appeler('basculer_pouce_communication', { p_id: id })
export const commenter = (id: number, texte: string) => appeler('commenter_communication', { p_id: id, p_texte: texte })
export const supprimerCommentaire = (id: number) => appeler('supprimer_commentaire_communication', { p_id: id })

// Message humain pour une erreur renvoyée par la base
export function messageCommunication(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/acces_refuse/.test(m)) return 'Tu n’as pas accès à cette communication.'
  if (/trop_long/.test(m)) return 'Le texte est trop long.'
  if (/vide/.test(m)) return 'Le texte est vide.'
  if (/Could not find the function|PGRST202/.test(m)) return 'Les communications ne sont pas encore activées : le script SQL des communications doit être lancé dans Supabase.'
  return 'L’envoi n’a pas abouti. Vérifie ta connexion et réessaie.'
}

// Communications reprises dans le fil d'activité (liste vide tant que la base ne les connaît pas)
export function useCommunicationsDuFil(): Communication[] {
  const [liste, setListe] = useState<Communication[]>([])
  useEffect(() => {
    let actif = true
    void chargerCommunications().then((c) => { if (actif) setListe(c?.liste ?? []) })
    return () => { actif = false }
  }, [])
  return liste
}
