// Communications du réseau vers les franchisés (script supabase/migrations/0008_communications.sql) : publiées par le Directeur
// de réseau (tout le réseau) ou un Responsable Régional (ses magasins), lues, commentées et « J'aime » par l'équipe
// et les franchisés concernés. Tout passe par des fonctions de la base.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { normaliserPieces, type Piece } from '../lib/pieces'

export interface Commentaire { id: number; auteur: string; auteurNom: string; auteurRole: string; texte: string; creeLe: string }
export interface Communication {
  id: number; titre: string; texte: string; pieces: Piece[]; magasins: string[] | null
  html: string | null // communication mise en forme (nettoyée à l'affichage), texte = sa version brute
  entete: string | null // chemin de la photo d'en-tête, parmi les pièces jointes
  auteur: string; auteurNom: string; auteurRole: string; creeLe: string; modifieLe: string | null
  pouces: { userId: string; nom: string }[]; commentaires: Commentaire[]
  aLaUne: string | null // reste en tête jusqu'à ce jour inclus (script 0014_communications_a_la_une.sql)
}
export interface Communications { moi: string; role: string; liste: Communication[] }

type Ligne = Record<string, unknown>
const t = (v: unknown) => (v === null || v === undefined ? '' : String(v))
const lignes = (v: unknown) => (Array.isArray(v) ? (v as Ligne[]).filter((x) => x && typeof x === 'object') : [])

// Dernières communications lues, affichées aussitôt au retour sur la page (puis remplacées par la base) ;
// oubliées quand le compte change
let derniere: { utilisateur: string; communications: Communications | null; lectures?: Map<number, Lecture> | null } | null = null
let utilisateur: string | null = null
supabase.auth.onAuthStateChange((_e, session) => {
  const id = session?.user.id ?? null
  if (id !== utilisateur) { utilisateur = id; derniere = null }
})
export const communicationsConnues = () => (derniere && derniere.utilisateur === utilisateur ? derniere : null)
const retenir = (c: { communications?: Communications | null; lectures?: Map<number, Lecture> | null }) => {
  if (!utilisateur) return
  derniere = { ...(derniere?.utilisateur === utilisateur ? derniere : { utilisateur, communications: null }), ...c }
}
// Liste changée sur place (publication, retrait) avant la réponse de la base
export const retenirCommunications = (communications: Communications) => retenir({ communications })

// null : communications pas encore activées dans la base
export async function chargerCommunications(): Promise<Communications | null> {
  const c = await lireCommunications()
  retenir({ communications: c })
  return c
}
async function lireCommunications(): Promise<Communications | null> {
  const [{ data, error }, une] = await Promise.all([supabase.rpc('communications'), supabase.rpc('a_la_une')])
  if (error || !data || typeof data !== 'object') return null
  const d = data as Ligne
  // Sans le script 0014, aucune communication n'est à la une
  const unes = new Map(une.error || !Array.isArray(une.data) ? [] : lignes(une.data).map((u) => [Number(u.id), t(u.jusqu_au).slice(0, 10)]))
  return {
    moi: t(d.moi), role: t(d.role),
    liste: lignes(d.liste).map((c) => ({
      id: Number(c.id), titre: t(c.titre), texte: t(c.texte), pieces: normaliserPieces(c.pieces),
      html: c.html ? t(c.html) : null, entete: c.entete ? t(c.entete) : null,
      magasins: Array.isArray(c.magasins) ? c.magasins.map(String) : null,
      auteur: t(c.auteur), auteurNom: t(c.auteur_nom), auteurRole: t(c.auteur_role), creeLe: t(c.cree_le), modifieLe: c.modifie_le ? t(c.modifie_le) : null,
      pouces: lignes(c.pouces).map((p) => ({ userId: t(p.user_id), nom: t(p.nom) })),
      commentaires: lignes(c.commentaires).map((k) => ({ id: Number(k.id), auteur: t(k.auteur), auteurNom: t(k.auteur_nom), auteurRole: t(k.auteur_role), texte: t(k.texte), creeLe: t(k.cree_le) })),
      aLaUne: unes.get(Number(c.id)) ?? null,
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
export const mettreALaUne = (id: number, jusquAu: string | null) => appeler('mettre_a_la_une', { p_id: id, p_jusqu_au: jusquAu })
// Les communications à la une d'abord (la plus proche de sa fin en premier), puis les autres dans leur ordre
export const aLaUneDabord = <T extends { aLaUne: string | null }>(liste: T[]) => [...liste.filter((c) => c.aLaUne), ...liste.filter((c) => !c.aLaUne)]
export const supprimerCommunication = (id: number) => appeler('supprimer_communication', { p_id: id })
export const basculerPouce = (id: number) => appeler('basculer_pouce_communication', { p_id: id })
export const commenter = (id: number, texte: string) => appeler('commenter_communication', { p_id: id, p_texte: texte })
export const supprimerCommentaire = (id: number) => appeler('supprimer_commentaire_communication', { p_id: id })

// Lecture des communications par les franchisés (script supabase/migrations/0013_lectures_communications.sql)
export interface Lecture { lus: string[]; nonLus: string[] }
// Directeur et Responsable Régional : qui a lu chaque communication ; null tant que la base ne le sait pas
export async function chargerLectures(): Promise<Map<number, Lecture> | null> {
  const { data, error } = await supabase.rpc('lectures_communications')
  const lectures = error || !Array.isArray(data) ? null : new Map(lignes(data).map((l) => [Number(l.id), { lus: Array.isArray(l.lus) ? l.lus.map(String) : [], nonLus: Array.isArray(l.non_lus) ? l.non_lus.map(String) : [] }] as const))
  retenir({ lectures })
  return lectures
}
// Franchisé : les communications affichées sont notées lues (sans message si la base ne connaît pas encore la fonction)
export async function noterLues(ids: number[]) {
  if (!ids.length) return
  await supabase.rpc('lire_communications', { p_ids: ids })
}

// Message humain pour une erreur renvoyée par la base
export function messageCommunication(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/acces_refuse/.test(m)) return 'Tu n’as pas accès à cette communication.'
  if (/trop_long/.test(m)) return 'Le texte est trop long.'
  if (/vide/.test(m)) return 'Le texte est vide.'
  if (/date_invalide/.test(m)) return 'La date de fin doit être dans l’année qui vient.'
  if (/Could not find the function|PGRST202/.test(m)) return 'Les communications ne sont pas encore activées : le script SQL des communications doit être lancé dans Supabase.'
  return 'L’envoi n’a pas abouti. Vérifie ta connexion et réessaie.'
}

// Communications reprises dans le fil d'activité (liste vide tant que la base ne les connaît pas)
export interface CommunicationsDuFil { liste: Communication[]; moi: string; recharger: () => Promise<void> }
export function useCommunicationsDuFil(): CommunicationsDuFil {
  const [etat, setEtat] = useState<Communications | null>(() => communicationsConnues()?.communications ?? null)
  const recharger = useCallback(async () => { setEtat(await chargerCommunications()) }, [])
  useEffect(() => {
    let actif = true
    void chargerCommunications().then((c) => { if (actif) setEtat(c) })
    return () => { actif = false }
  }, [])
  return useMemo(() => ({ liste: etat?.liste ?? [], moi: etat?.moi ?? '', recharger }), [etat, recharger])
}
