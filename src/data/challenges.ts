// Challenge du mois entre magasins (sprint 22, A6 ; script supabase/migrations/0028_challenges.sql) : classement calculé par
// la base sur les chiffres mensuels ; l'équipe voit les chiffres de ses magasins, le franchisé son rang et le podium.
import { supabase } from '../lib/supabase'

export type Indicateur = 'ca' | 'pm_cave' | 'pm_bar'
export const libellesIndicateur: Record<Indicateur, string> = { ca: 'Progression du CA', pm_cave: 'Progression du panier moyen cave', pm_bar: 'Progression du panier moyen bar' }
export interface Rang { magasin: string; rang: number; valeur: number | null }
export interface Challenge { id: number; titre: string; indicateur: Indicateur; mois: string; magasins: string[]; franchises: boolean; auteur: string; auteurNom: string; classement: Rang[] }
export interface ChallengeFranchise { id: number; titre: string; indicateur: Indicateur; mois: string; participants: number; classes: number; podium: Rang[]; mesRangs: Rang[] }

type Ligne = Record<string, unknown>
const lignes = (v: unknown) => (Array.isArray(v) ? (v as Ligne[]).filter((x) => x && typeof x === 'object') : [])
const indicateur = (v: unknown): Indicateur => (v === 'pm_cave' || v === 'pm_bar' ? v : 'ca')
const rangs = (v: unknown): Rang[] => lignes(v).map((k) => ({ magasin: String(k.magasin ?? ''), rang: Number(k.rang) || 0, valeur: k.valeur === null || k.valeur === undefined ? null : Number(k.valeur) }))

export class ErreurChallenge extends Error {}
const humain = (e: { message?: string }) => new ErreurChallenge(/date_invalide/.test(e.message ?? '') ? 'Choisis un mois entre l’an dernier et les trois prochains mois.'
  : /format/.test(e.message ?? '') ? 'Un challenge demande un titre et au moins deux magasins.' : 'L’enregistrement n’a pas abouti. Réessaie dans un instant.')

// null tant que la base ne connaît pas les challenges
export async function chargerChallenges(): Promise<Challenge[] | null> {
  const { data, error } = await supabase.rpc('challenges_equipe')
  if (error) return null
  return lignes(data).map((l) => ({ id: Number(l.id), titre: String(l.titre ?? ''), indicateur: indicateur(l.indicateur), mois: String(l.mois ?? '').slice(0, 7),
    magasins: Array.isArray(l.magasins) ? l.magasins.map(String) : [], franchises: l.franchises !== false, auteur: String(l.auteur ?? ''), auteurNom: String(l.auteur_nom ?? ''), classement: rangs(l.classement) }))
}
export async function chargerChallengesFranchise(): Promise<ChallengeFranchise[] | null> {
  const { data, error } = await supabase.rpc('challenges_franchise')
  if (error) return null
  return lignes(data).map((l) => ({ id: Number(l.id), titre: String(l.titre ?? ''), indicateur: indicateur(l.indicateur), mois: String(l.mois ?? '').slice(0, 7),
    participants: Number(l.participants) || 0, classes: Number(l.classes) || 0, podium: rangs(l.podium), mesRangs: rangs(l.mes_rangs) }))
}
export async function creerChallenge(c: { titre: string; indicateur: Indicateur; mois: string; magasins: string[]; franchises: boolean }) {
  const { error } = await supabase.rpc('creer_challenge', { p_titre: c.titre, p_indicateur: c.indicateur, p_mois: `${c.mois}-01`, p_magasins: c.magasins, p_franchises: c.franchises })
  if (error) throw humain(error)
}
export async function supprimerChallenge(id: number) {
  const { error } = await supabase.rpc('supprimer_challenge', { p_id: id })
  if (error) throw humain(error)
}

export const rangTexte = (r: number) => (r === 1 ? '1er' : `${r}e`)
export const progression = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')} %`
