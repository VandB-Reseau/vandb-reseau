// Demandes des franchisés au siège (refonte vague 4, Joseph 10/11/2026, 37A) : un guichet par thème, un statut, un
// interlocuteur par thème (Paramètres), le délai de réponse mesuré. Table demandes (migration 0043), fermée : le franchisé
// passe par creer_demande / mes_demandes / completer_demande, l'équipe lit ses magasins et répond par repondre_demande.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Apercu } from './espaceFranchise'

export type ThemeDemande = 'achats' | 'travaux' | 'marketing' | 'caisse' | 'juridique' | 'autre'
export type StatutDemande = 'nouvelle' | 'en_cours' | 'attente' | 'resolue'
export const themesDemande: { v: ThemeDemande; libelle: string }[] = [
  { v: 'achats', libelle: 'Achats et fournisseurs' }, { v: 'travaux', libelle: 'Travaux et magasin' }, { v: 'marketing', libelle: 'Marketing et communication' },
  { v: 'caisse', libelle: 'Informatique et caisse' }, { v: 'juridique', libelle: 'Juridique' }, { v: 'autre', libelle: 'Autre' },
]
export const libelleTheme = (t: string) => themesDemande.find((x) => x.v === t)?.libelle ?? 'Autre'
export const libelleStatutDemande: Record<StatutDemande, string> = { nouvelle: 'Nouvelle', en_cours: 'En traitement', attente: 'Attend le franchisé', resolue: 'Résolue' }

export interface Echange { par: string; role: 'franchise' | 'equipe'; texte: string; le: string }
export interface Demande {
  id: number; magasin: string; franchise: string; theme: ThemeDemande; titre: string; statut: StatutDemande
  echanges: Echange[]; ouverteLe: string; premiereReponseLe: string; resolueLe: string; majLe: string
}

const texte = (v: unknown) => (typeof v === 'string' ? v : '')
export function lireDemande(l: Record<string, unknown>): Demande {
  const theme = themesDemande.some((t) => t.v === l.theme) ? l.theme as ThemeDemande : 'autre'
  const statut = (['nouvelle', 'en_cours', 'attente', 'resolue'] as const).find((s) => s === l.statut) ?? 'nouvelle'
  const echanges = Array.isArray(l.echanges) ? l.echanges.flatMap((e): Echange[] => {
    if (!e || typeof e !== 'object') return []
    const x = e as Record<string, unknown>
    return texte(x.texte) ? [{ par: texte(x.par), role: x.role === 'equipe' ? 'equipe' : 'franchise', texte: texte(x.texte), le: texte(x.le) }] : []
  }) : []
  return { id: Number(l.id), magasin: texte(l.magasin), franchise: texte(l.franchise), theme, titre: texte(l.titre), statut, echanges,
    ouverteLe: texte(l.ouverte_le), premiereReponseLe: texte(l.premiere_reponse_le), resolueLe: texte(l.resolue_le), majLe: texte(l.maj_le) }
}

export function normaliserInterlocuteurs(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k, x]) => themesDemande.some((t) => t.v === k) && typeof x === 'string' && x.trim()).map(([k, x]) => [k, (x as string).trim()]))
}

export class ErreurDemande extends Error {}
const humaine = (code: string) => new ErreurDemande(
  code.includes('trop_de_demandes') ? 'Tu as déjà envoyé beaucoup de demandes aujourd’hui. Réessaie demain ou appelle ton Coach.'
    : 'L’envoi n’a pas abouti. Vérifie ta connexion et réessaie.')

// Équipe : demandes de ses magasins (null : table absente, migration 0043 pas encore passée)
export function useDemandes(actif = true) {
  const [liste, setListe] = useState<Demande[] | null | undefined>(undefined)
  const charger = useCallback(async () => {
    if (!actif) return
    const { data, error } = await supabase.from('demandes').select('*').order('ouverte_le', { ascending: false })
    setListe(error ? null : (data ?? []).map((l) => lireDemande(l as Record<string, unknown>)))
  }, [actif])
  useEffect(() => { void charger() }, [charger])
  return { liste, recharger: charger }
}

// Franchisé : ses demandes ; en aperçu (« Voir comme »), le Directeur lit la table pour les magasins vus
export function useMesDemandes(apercu: Apercu | null, actif = true) {
  const [liste, setListe] = useState<Demande[] | null | undefined>(undefined)
  const cle = (actif ? '1' : '0') + (apercu ? apercu.magasins.join('|') : '')
  const charger = useCallback(async () => {
    if (!actif) return
    const r = apercu
      ? await supabase.from('demandes').select('*').in('magasin', apercu.magasins).order('ouverte_le', { ascending: false })
      : await supabase.rpc('mes_demandes')
    if (r.error) { setListe(null); return }
    const lignes = Array.isArray(r.data) ? r.data : []
    setListe(lignes.map((l) => lireDemande(l as Record<string, unknown>)))
  }, [cle]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void charger() }, [charger])
  return { liste, recharger: charger }
}

export async function creerDemande(magasin: string, theme: ThemeDemande, titre: string, message: string) {
  const { error } = await supabase.rpc('creer_demande', { p_store: magasin, p_theme: theme, p_titre: titre, p_texte: message })
  if (error) throw humaine(error.message ?? '')
}
export async function completerDemande(id: number, message: string) {
  const { error } = await supabase.rpc('completer_demande', { p_id: id, p_texte: message })
  if (error) throw humaine(error.message ?? '')
}
export async function repondreDemande(id: number, message: string, statut: StatutDemande) {
  const { error } = await supabase.rpc('repondre_demande', { p_id: id, p_texte: message, p_statut: statut })
  if (error) throw new ErreurDemande('La réponse n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.')
}

// Jours écoulés entre deux horodatages
const jours = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000
export const ouverteDepuis = (d: Demande, maintenant: string) => Math.floor(jours(d.ouverteLe, maintenant))
// Ouverte depuis plus de 5 jours sans être résolue
export const enAttenteLongue = (d: Demande, maintenant: string) => d.statut !== 'resolue' && jours(d.ouverteLe, maintenant) > 5
// Délai médian de première réponse, en jours (null : aucune réponse encore)
export function delaiMedian(liste: Demande[]): number | null {
  const d = liste.filter((x) => x.premiereReponseLe).map((x) => jours(x.ouverteLe, x.premiereReponseLe)).sort((a, b) => a - b)
  if (!d.length) return null
  const m = d.length % 2 ? d[(d.length - 1) / 2] : (d[d.length / 2 - 1] + d[d.length / 2]) / 2
  return Math.round(m * 10) / 10
}
// Le siège doit agir : nouvelle ou en traitement (pas en attente du franchisé)
export const aTraiterParLeSiege = (d: Demande) => d.statut === 'nouvelle' || d.statut === 'en_cours'
