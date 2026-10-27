// Mot du franchisé avant une visite prévue (sprint 27, F4, migration 0038) : ce qui marche, ce qui bloque et ce dont il
// a besoin. Écrit par le franchisé dans son espace (fonction ecrire_mot_franchise, son nom et l'heure posés par la base),
// lu par l'équipe dans la fiche avant visite et le compte rendu. Rubrique « mot_franchise » de suivi_magasins.
import { supabase } from '../lib/supabase'
import type { Reseau, Visite } from './modele'

export interface MotFranchise { visite: number; date: string; marche: string; bloque: string; besoin: string; par: string; le: string }
export type ContenuMot = Pick<MotFranchise, 'marche' | 'bloque' | 'besoin'>
export const partiesMot: { cle: keyof ContenuMot; libelle: string }[] = [
  { cle: 'marche', libelle: 'Ce qui marche' }, { cle: 'bloque', libelle: 'Ce qui bloque' }, { cle: 'besoin', libelle: 'Ce dont j’ai besoin' },
]

const texte = (v: unknown) => (typeof v === 'string' ? v : '')
export function normaliserMots(v: unknown): Record<string, MotFranchise[]> {
  const r: Record<string, MotFranchise[]> = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return r
  for (const [m, liste] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(liste)) continue
    const mots = liste.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map((x) => ({ visite: Number(x.visite), date: texte(x.date), marche: texte(x.marche), bloque: texte(x.bloque), besoin: texte(x.besoin), par: texte(x.par), le: texte(x.le) }))
      .filter((x) => Number.isFinite(x.visite) && (x.marche || x.bloque || x.besoin))
    if (mots.length) r[m] = mots
  }
  return r
}

export const motDe = (reseau: Reseau, magasin: string, visite: number | null): MotFranchise | undefined =>
  visite === null ? undefined : reseau.motsFranchise[magasin]?.find((x) => x.visite === visite)

// Prochaine visite du magasin (aujourd'hui compris), hors appels et points téléphoniques
export function prochaineVisite(reseau: Reseau, magasin: string): Visite | undefined {
  return reseau.visites.filter((v) => v.magasin === magasin && v.id !== null && v.date >= reseau.jour && (v.prevue || v.date > reseau.jour) && !['appel', 'point'].includes(v.type))
    .sort((a, b) => a.date.localeCompare(b.date))[0]
}

export class ErreurMot extends Error {}
export async function ecrireMotFranchise(magasin: string, visite: number, mot: ContenuMot) {
  const { error } = await supabase.rpc('ecrire_mot_franchise', { p_store: magasin, p_visite: visite, p_marche: mot.marche, p_bloque: mot.bloque, p_besoin: mot.besoin })
  if (!error) return
  if (error.code === 'PGRST202' || error.message?.includes('Could not find the function')) throw new ErreurMot('Ce message ne peut pas encore être envoyé depuis ton espace. Écris à ton Coach en attendant.')
  if (error.message?.includes('visite_introuvable')) throw new ErreurMot('Cette visite a été déplacée ou est passée. Recharge la page.')
  throw new ErreurMot('Ton message n’a pas pu être envoyé. Vérifie ta connexion et réessaie.')
}
