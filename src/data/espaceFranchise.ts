// Espace d'un franchisé : la base ne lui renvoie que ses magasins (fonction espace_franchise),
// dans le format des tables ; l'app le lit comme le réseau complet.
import { supabase } from '../lib/supabase'
import { assemblerReseau, ErreurChargement, type Tables } from './chargement'
import { franchises } from './personnes'
import type { Reseau } from './modele'

export type IndicateurRepere = 'pmCave' | 'pmBar' | 'fluxCave' | 'fluxBar' | 'panier' | 'marge' | 'evolution'
export interface Repere { n: number; mediane: number; quartHaut: number }
export interface Reperes { mois: string; indicateurs: Partial<Record<IndicateurRepere, Repere>> }
export interface EspaceFranchise { franchise: string; reperes: Reperes | null }

// Aperçu par le Directeur de réseau : la même fonction, pour un franchisé et ses magasins
export interface Apercu { franchise: string; magasins: string[] }

type Ligne = Record<string, unknown>
interface Reponse {
  franchise?: string; app_config?: Tables['config']; store_overrides?: Ligne[]; reassigns?: Ligne[]; cs_overrides?: Ligne[]
  visits?: Ligne[]; store_finance?: Ligne[]; reperes?: Reperes | null
}

export async function chargerEspaceFranchise(apercu: Apercu | null, jour = new Date().toISOString().slice(0, 10)): Promise<Reseau> {
  const { data, error } = await supabase.rpc('espace_franchise', apercu ? { p_franchise: apercu.franchise, p_magasins: apercu.magasins } : {})
  if (error || !data || typeof data !== 'object') throw new ErreurChargement(error?.message ?? 'espace vide')
  const d = data as Reponse
  const reseau = assemblerReseau({
    config: d.app_config ?? [], surcharges: d.store_overrides ?? [], affectations: d.reassigns ?? [], coachs: d.cs_overrides ?? [],
    recrues: [], visites: d.visits ?? [], conges: [], evenements: [], finances: d.store_finance ?? [],
  }, jour)
  reseau.espace = { franchise: d.franchise ?? apercu?.franchise ?? '', reperes: d.reperes && typeof d.reperes === 'object' ? d.reperes : null }
  return reseau
}

// ── Accès des franchisés, gérés par le Directeur de réseau ──
export interface AccesFranchise { userId: string; email: string; franchise: string; magasins: string[]; ouvertLe: string; derniereConnexion: string }

export class ErreurAcces extends Error {}
const messages: Record<string, string> = {
  compte_introuvable: 'Aucun compte n’existe avec cet email. Crée-le d’abord dans Supabase.',
  compte_equipe: 'Ce compte appartient à l’équipe V and B : il ne peut pas devenir un accès franchisé.',
  compte_deja_pris: 'Ce compte est déjà l’accès d’un autre franchisé.',
  sans_magasin: 'Ce franchisé n’a aucun magasin en place.',
  acces_refuse: 'Seul le Directeur de réseau peut gérer les accès.',
}
function erreur(e: { message?: string; code?: string } | null): never {
  const cle = Object.keys(messages).find((k) => e?.message?.includes(k))
  if (cle) throw new ErreurAcces(messages[cle])
  if (e?.code === 'PGRST202' || e?.message?.includes('Could not find the function')) throw new ErreurAcces('Les accès franchisés ne sont pas encore activés dans la base.')
  throw new ErreurAcces('Enregistrement impossible pour le moment. Réessaie dans un instant.')
}

// null : accès pas encore activés dans la base (script non passé)
export async function listerAcces(): Promise<AccesFranchise[] | null> {
  const { data, error } = await supabase.rpc('liste_acces_franchises')
  if (error || !Array.isArray(data)) return null
  return (data as Ligne[]).map((a) => ({
    userId: String(a.user_id), email: String(a.email ?? ''), franchise: String(a.franchise ?? ''),
    magasins: Array.isArray(a.magasins) ? a.magasins.map(String) : [], ouvertLe: String(a.ouvert_le ?? '').slice(0, 10), derniereConnexion: String(a.derniere_connexion ?? '').slice(0, 10),
  }))
}

export async function ouvrirAcces(email: string, franchise: string, magasins: string[]) {
  const { error } = await supabase.rpc('ouvrir_acces_franchise', { p_email: email.trim(), p_franchise: franchise, p_magasins: magasins })
  if (error) erreur(error)
}

export async function couperAcces(userId: string) {
  const { error } = await supabase.rpc('couper_acces_franchise', { p_user: userId })
  if (error) erreur(error)
}

async function majAcces(userId: string, franchise: string, magasins: string[]) {
  const { error } = await supabase.rpc('maj_acces_franchise', { p_user: userId, p_franchise: franchise, p_magasins: magasins })
  if (error) erreur(error)
}

// Magasins en place d'un franchisé, dans l'ordre du réseau
export const magasinsDuFranchise = (reseau: Reseau, nom: string) => franchises(reseau).find((f) => f.nom === nom)?.magasins.map((m) => m.nom) ?? null

// Après chaque chargement du réseau par le Directeur : les accès suivent les associés et les renommages.
// Un franchisé introuvable (renommé hors de l'app) garde ses magasins, pour ne jamais lui couper l'accès par erreur.
export async function synchroniserAcces(reseau: Reseau): Promise<void> {
  const liste = await listerAcces()
  if (!liste) return
  for (const a of liste) {
    // Associé sorti de tous ses magasins : plus aucun magasin
    const sorti = Object.values(reseau.associes).some((l) => l.some((x) => x.nom === a.franchise))
    const magasins = magasinsDuFranchise(reseau, a.franchise) ?? (sorti ? [] : null)
    if (!magasins || (magasins.length === a.magasins.length && magasins.every((m) => a.magasins.includes(m)))) continue
    await majAcces(a.userId, a.franchise, magasins).catch(() => undefined)
  }
}

// Un franchisé renommé dans l'app : son accès suit
export async function renommerAcces(ancien: string, nouveau: string, magasins: string[]) {
  const liste = await listerAcces()
  for (const a of liste ?? []) if (a.franchise === ancien) await majAcces(a.userId, nouveau, magasins.length ? magasins : a.magasins).catch(() => undefined)
}

// Franchisé supprimé : son accès est coupé
export async function couperAccesDe(nom: string) {
  for (const a of (await listerAcces()) ?? []) if (a.franchise === nom) await couperAcces(a.userId)
}
