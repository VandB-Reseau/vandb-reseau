// Espace d'un franchisé : la base ne lui renvoie que ses magasins (fonction espace_franchise),
// dans le format des tables ; l'app le lit comme le réseau complet.
import { supabase } from '../lib/supabase'
import { assemblerReseau, ErreurChargement, type Tables } from './chargement'
import { franchises } from './personnes'
import type { Reseau } from './modele'
import type { Piece } from '../lib/pieces'

export type IndicateurRepere = 'pmCave' | 'pmBar' | 'fluxCave' | 'fluxBar' | 'panier' | 'marge' | 'evolution'
export interface Repere { n: number; mediane: number; quartHaut: number; quartBas?: number } // quartBas : depuis 0020
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
    recrues: [], visites: d.visits ?? [], evenements: [], finances: d.store_finance ?? [],
  }, jour)
  reseau.espace = { franchise: d.franchise ?? apercu?.franchise ?? '', reperes: d.reperes && typeof d.reperes === 'object' ? d.reperes : null }
  // Tâches nées dans « Équipe seule » : la base ne les renvoie plus (0019) ; écartées aussi ici
  reseau.actionsLibres = Object.fromEntries(Object.entries(reseau.actionsLibres).map(([m, l]) => [m, l.filter((a) => a.fil !== 'equipe')]))
  return reseau
}

// ── Accès des franchisés, gérés par le Directeur de réseau ──
export interface AccesFranchise { userId: string; email: string; franchise: string; magasins: string[]; ouvertLe: string; derniereConnexion: string }

export class ErreurAcces extends Error {}
const messages: Record<string, string> = {
  compte_introuvable: 'Aucun compte n’existe avec cet email. Crée-le d’abord dans Supabase.',
  format: 'Cet email n’est pas valide.',
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

// ── Comptes des franchisés, créés et supprimés par la fonction Supabase « comptes » (supabase/functions/comptes) ──
// null : fonction pas encore déployée (on garde alors le compte créé à la main dans Supabase)
async function appelComptes(corps: Record<string, unknown>): Promise<Ligne | null> {
  const { data, error } = await supabase.functions.invoke('comptes', { body: corps })
  if (!error) return (data ?? {}) as Ligne
  const contexte = (error as { context?: unknown }).context
  if (!(contexte instanceof Response)) return null // fonction injoignable : pas encore déployée
  const lu = await contexte.json().catch(() => ({})) as { erreur?: string }
  if (lu.erreur && lu.erreur in messages) throw new ErreurAcces(messages[lu.erreur])
  if (contexte.status === 404) return null
  throw new ErreurAcces('Enregistrement impossible pour le moment. Réessaie dans un instant.')
}

// Ouvre l'accès en créant le compte s'il n'existe pas. Mot de passe provisoire : null si le compte avait déjà le sien
export async function creerEtOuvrirAcces(email: string, franchise: string, magasins: string[]): Promise<string | null> {
  const compte = await appelComptes({ action: 'creer', email: email.trim() })
  await ouvrirAcces(email, franchise, magasins)
  return typeof compte?.mot_de_passe === 'string' ? compte.mot_de_passe : null
}

export async function nouveauMotDePasse(userId: string): Promise<string> {
  const compte = await appelComptes({ action: 'reinitialiser', user: userId })
  if (typeof compte?.mot_de_passe !== 'string') throw new ErreurAcces('La création des comptes depuis l’app n’est pas encore activée dans Supabase.')
  return compte.mot_de_passe
}

// Supprime le compte ; sans la fonction, l'accès est seulement coupé
export async function supprimerCompte(userId: string) {
  if (!(await appelComptes({ action: 'supprimer', user: userId }))) await couperAcces(userId)
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

// Franchisé supprimé : son compte est supprimé (ou son accès coupé, tant que la fonction « comptes » n'est pas déployée)
export async function supprimerComptesDe(nom: string) {
  for (const a of (await listerAcces()) ?? []) if (a.franchise === nom) await supprimerCompte(a.userId)
}

// Repères réseau d'un magasin pour l'équipe (fiche avant visite). null : pas assez de chiffres,
// ou fonction pas encore activée dans la base
export async function chargerReperesEquipe(magasins: string[]): Promise<Reperes | null> {
  const { data, error } = await supabase.rpc('reperes_equipe', { p_magasins: magasins })
  return !error && data && typeof data === 'object' ? data as Reperes : null
}

// ── Actions du franchisé sur ses magasins (script supabase/migrations/0007_actions_franchise.sql) ──
// La base vérifie que le magasin est le sien et y inscrit son nom et la date.
export class ErreurAction extends Error {}
function erreurAction(e: { message?: string; code?: string }): never {
  if (e.code === 'PGRST202' || e.message?.includes('Could not find the function')) throw new ErreurAction('Les tâches ne peuvent pas encore être modifiées depuis ton espace. Ton Coach peut le faire pour toi.')
  if (e.message?.includes('action_introuvable')) throw new ErreurAction('Cette tâche a été modifiée entre-temps. Recharge la page et réessaie.')
  throw new ErreurAction('La tâche n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.')
}

export async function ajouterActionFranchise(magasin: string, action: string, porteur: string, echeance: string, pieces: Piece[] = []) {
  const { error } = await supabase.rpc('ajouter_action_franchise', { p_store: magasin, p_action: action, p_porteur: porteur, p_echeance: echeance, ...(pieces.length ? { p_pieces: pieces } : {}) })
  if (error) erreurAction(error)
}

// Action hors visite (libre) ou action du plan d'une visite (visite, index, texte vérifié par la base)
export async function marquerActionFranchise(magasin: string, faite: boolean, cible: { libre: string } | { visite: number; index: number; texte: string }) {
  const { error } = await supabase.rpc('marquer_action_franchise', 'libre' in cible
    ? { p_store: magasin, p_faite: faite, p_libre: cible.libre }
    : { p_store: magasin, p_faite: faite, p_visite: cible.visite, p_index: cible.index, p_texte: cible.texte })
  if (error) erreurAction(error)
}
