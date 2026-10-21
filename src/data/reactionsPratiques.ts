// « J'aime » et commentaires des bonnes pratiques (script supabase/migrations/0010_pratiques_reactions.sql) : toute l'équipe
// et les franchisés, par des fonctions de la base. Tant que le script n'est pas passé, les anciens « J'aime »
// de l'équipe (champ jaime) restent seuls.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Commentaire, Pouce } from '../components/Reactions'

export interface ReactionsPratiques {
  moi: string
  pouces: Record<string, Pouce[]>
  commentaires: Record<string, Commentaire[]>
  recharger: () => Promise<void>
}

type Ligne = Record<string, unknown>
const t = (v: unknown) => (v === null || v === undefined ? '' : String(v))
const lignes = (v: unknown) => (Array.isArray(v) ? (v as Ligne[]).filter((x) => x && typeof x === 'object') : [])
const parPratique = <T,>(v: unknown, f: (l: Ligne) => T): Record<string, T[]> =>
  Object.fromEntries(Object.entries(v && typeof v === 'object' ? (v as Record<string, unknown>) : {}).map(([id, l]) => [id, lignes(l).map(f)]))

async function charger(): Promise<Omit<ReactionsPratiques, 'recharger'> | null> {
  const { data, error } = await supabase.rpc('reactions_pratiques')
  if (error || !data || typeof data !== 'object') return null
  const d = data as Ligne
  return {
    moi: t(d.moi),
    pouces: parPratique(d.pouces, (p) => ({ userId: t(p.user_id), nom: t(p.nom) })),
    commentaires: parPratique(d.commentaires, (k) => ({ id: Number(k.id), auteur: t(k.auteur), auteurNom: t(k.auteur_nom), auteurRole: t(k.auteur_role), texte: t(k.texte), creeLe: t(k.cree_le) })),
  }
}

// null : réactions pas encore activées dans la base
export function useReactionsPratiques(): ReactionsPratiques | null {
  const [etat, setEtat] = useState<Omit<ReactionsPratiques, 'recharger'> | null>(null)
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

export const basculerPoucePratique = (id: string) => appeler('basculer_pouce_pratique', { p_id: id })
export const commenterPratique = (id: string, texte: string) => appeler('commenter_pratique', { p_id: id, p_texte: texte })
export const supprimerCommentairePratique = (id: number) => appeler('supprimer_commentaire_pratique', { p_id: id })

export function messageReaction(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/acces_refuse/.test(m)) return 'Tu n’as pas accès à cette bonne pratique.'
  if (/trop_long/.test(m)) return 'Le commentaire est trop long.'
  if (/vide/.test(m)) return 'Le commentaire est vide.'
  return 'L’envoi n’a pas abouti. Vérifie ta connexion et réessaie.'
}
