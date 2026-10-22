// « J'aime » et commentaires des comptes rendus de visite (migration 0022_reactions_visites.sql), dans le fil d'actualité :
// l'équipe et les franchisés, chacun sur les visites qu'il voit, par des fonctions de la base.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Commentaire, Pouce } from '../components/Reactions'

export interface ReactionsVisites {
  moi: string
  pouces: Record<string, Pouce[]>
  commentaires: Record<string, Commentaire[]>
  recharger: () => Promise<void>
}

type Ligne = Record<string, unknown>
const t = (v: unknown) => (v === null || v === undefined ? '' : String(v))
const lignes = (v: unknown) => (Array.isArray(v) ? (v as Ligne[]).filter((x) => x && typeof x === 'object') : [])
const parVisite = <T,>(v: unknown, f: (l: Ligne) => T): Record<string, T[]> =>
  Object.fromEntries(Object.entries(v && typeof v === 'object' ? (v as Record<string, unknown>) : {}).map(([id, l]) => [id, lignes(l).map(f)]))

async function charger(): Promise<Omit<ReactionsVisites, 'recharger'> | null> {
  const { data, error } = await supabase.rpc('reactions_visites')
  if (error || !data || typeof data !== 'object') return null
  const d = data as Ligne
  return {
    moi: t(d.moi),
    pouces: parVisite(d.pouces, (p) => ({ userId: t(p.user_id), nom: t(p.nom) })),
    commentaires: parVisite(d.commentaires, (k) => ({ id: Number(k.id), auteur: t(k.auteur), auteurNom: t(k.auteur_nom), auteurRole: t(k.auteur_role), texte: t(k.texte), creeLe: t(k.cree_le) })),
  }
}

// null : réactions pas encore activées dans la base (migration 0022 pas encore passée)
export function useReactionsVisites(): ReactionsVisites | null {
  const [etat, setEtat] = useState<Omit<ReactionsVisites, 'recharger'> | null>(null)
  const recharger = useCallback(async () => { setEtat(await charger()) }, [])
  useEffect(() => {
    let actif = true
    void charger().then((r) => { if (actif) setEtat(r) })
    return () => { actif = false }
  }, [])
  return useMemo(() => (etat ? { ...etat, recharger } : null), [etat, recharger])
}

async function appeler(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data
}

export const basculerPouceVisite = (id: number) => appeler('basculer_pouce_visite', { p_id: id })
export const commenterVisite = (id: number, texte: string) => appeler('commenter_visite', { p_id: id, p_texte: texte })
export const supprimerCommentaireVisite = (id: number) => appeler('supprimer_commentaire_visite', { p_id: id })

export function messageReactionVisite(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/acces_refuse/.test(m)) return 'Tu n’as pas accès à ce compte rendu.'
  if (/trop_long/.test(m)) return 'Le commentaire est trop long.'
  if (/vide/.test(m)) return 'Le commentaire est vide.'
  return 'L’envoi n’a pas abouti. Vérifie ta connexion et réessaie.'
}
