// Réunions et formations (sprint 22, A2 ; script supabase/migrations/0025_reunions.sql) : un événement de l'agenda
// invite des magasins ; le franchisé répond Présent ou Absent ; après la date, l'équipe pointe les présents.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Evenement, Reseau } from './modele'

export type Reponse = 'present' | 'absent'
// Réponse et pointage d'un magasin invité
export interface Presence { event: number; magasin: string; reponse: Reponse | null; present: boolean | null }
// Réunion vue par le franchisé
export interface ReunionFranchise { id: number; titre: string; debut: string; fin: string; notes: string; magasins: string[]; reponse: Reponse | null; present: boolean | null }

type Ligne = Record<string, unknown>
const lignes = (v: unknown) => (Array.isArray(v) ? (v as Ligne[]).filter((x) => x && typeof x === 'object') : [])
const reponse = (v: unknown): Reponse | null => (v === 'present' || v === 'absent' ? v : null)
const booleen = (v: unknown) => (typeof v === 'boolean' ? v : null)

export class ErreurReunion extends Error {}
const humain = (e: { message?: string } | null) => new ErreurReunion(
  /acces_refuse/.test(e?.message ?? '') ? 'Cette réponse n’est plus possible pour cette réunion.' : 'L’enregistrement n’a pas abouti. Réessaie dans un instant.')

// Équipe : null tant que la base ne connaît pas les réunions
export async function chargerPresences(): Promise<Presence[] | null> {
  const { data, error } = await supabase.rpc('presences_reunions')
  if (error) return null
  return lignes(data).map((l) => ({ event: Number(l.event), magasin: String(l.magasin ?? ''), reponse: reponse(l.reponse), present: booleen(l.present) }))
}

export async function pointerPresence(id: number, magasin: string, present: boolean | null) {
  const { error } = await supabase.rpc('pointer_presence', { p_id: id, p_magasin: magasin, p_present: present })
  if (error) throw humain(error)
}

export async function chargerReunionsFranchise(): Promise<ReunionFranchise[] | null> {
  const { data, error } = await supabase.rpc('reunions_franchise')
  if (error) return null
  return lignes(data).map((l) => ({
    id: Number(l.id), titre: String(l.titre ?? ''), debut: String(l.debut ?? '').slice(0, 10), fin: String(l.fin ?? l.debut ?? '').slice(0, 10), notes: String(l.notes ?? ''),
    magasins: Array.isArray(l.magasins) ? l.magasins.map(String) : [], reponse: reponse(l.reponse), present: booleen(l.present),
  }))
}

export async function repondreReunion(id: number, r: Reponse) {
  const { error } = await supabase.rpc('repondre_reunion', { p_id: id, p_reponse: r })
  if (error) throw humain(error)
}

export function usePresences() {
  const [presences, setPresences] = useState<Presence[] | null>(null)
  const recharger = useCallback(async () => { setPresences(await chargerPresences().catch(() => null)) }, [])
  useEffect(() => { void recharger() }, [recharger])
  return { presences, recharger }
}

// Réunions d'un magasin sur l'année en cours : passées (avec présence pointée) et à venir
export interface ReunionMagasin { e: Evenement; presence: Presence | null }
export function reunionsDuMagasin(reseau: Reseau, magasin: string, presences: Presence[]): ReunionMagasin[] {
  const annee = reseau.jour.slice(0, 4)
  return reseau.evenements
    .filter((e) => e.id !== null && e.invites?.includes(magasin) && e.debut.slice(0, 4) === annee)
    .sort((a, b) => a.debut.localeCompare(b.debut))
    .map((e) => ({ e, presence: presences.find((p) => p.event === e.id && p.magasin === magasin) ?? null }))
}
export function tauxPresence(liste: ReunionMagasin[], jour: string) {
  const passees = liste.filter((x) => x.e.debut <= jour)
  return { presences: passees.filter((x) => x.presence?.present === true).length, total: passees.length }
}
