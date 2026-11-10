// Entretien mensuel RR–Coach (refonte vague 4, Joseph 10/11/2026, 34A) : un par Coach et par mois, préparé par l'app,
// noté par le RR (ou le Directeur), 3 engagements au plus, repris le mois suivant. Le Coach lit et ajoute ses remarques.
// Table entretiens (migration 0043). Base d'avant 0043 : aucune donnée, l'onglet le dit sans erreur.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { actionsDes, enRetard } from './actions'
import { analyser, decalerMois } from './chiffres'
import { magasinsDuCoach } from './charge'
import { anneeDe, suiviRythme } from './visites'
import { visiteFaite, type Reseau } from './modele'
import { planARevoir } from './planAction'
import { avancement, objectifsDu, phraseObjectif } from './objectifs'

export const ENGAGEMENTS_MAX = 3
export interface Engagement { id: string; texte: string; echeance: string; tenu?: boolean }
export interface Entretien { id: number | null; coach: string; mois: string; notes: string; engagements: Engagement[]; remarques: string; faitLe: string; par: string }

const texte = (v: unknown) => (typeof v === 'string' ? v : '')
function lire(l: Record<string, unknown>): Entretien {
  const engagements = Array.isArray(l.engagements) ? l.engagements.flatMap((e): Engagement[] => {
    if (!e || typeof e !== 'object') return []
    const x = e as Record<string, unknown>
    return texte(x.texte).trim() ? [{ id: texte(x.id) || Math.random().toString(36).slice(2, 8), texte: texte(x.texte), echeance: texte(x.echeance), ...(typeof x.tenu === 'boolean' ? { tenu: x.tenu } : {}) }] : []
  }) : []
  return { id: Number(l.id) || null, coach: texte(l.coach), mois: texte(l.mois), notes: texte(l.notes), engagements, remarques: texte(l.remarques), faitLe: texte(l.fait_le), par: texte(l.par) }
}

export class ErreurEntretien extends Error {}

// Entretiens visibles du compte (null : table absente, migration 0043 pas encore passée)
export function useEntretiens(coach?: string) {
  const [liste, setListe] = useState<Entretien[] | null | undefined>(undefined)
  const charger = useCallback(async () => {
    let q = supabase.from('entretiens').select('*').order('mois', { ascending: false })
    if (coach) q = q.eq('coach', coach)
    const { data, error } = await q
    setListe(error ? null : (data ?? []).map((l) => lire(l as Record<string, unknown>)))
  }, [coach])
  useEffect(() => { void charger() }, [charger])
  return { liste, recharger: charger }
}

export async function enregistrerEntretien(e: Entretien) {
  const ligne = { coach: e.coach, mois: e.mois, notes: e.notes, engagements: e.engagements.slice(0, ENGAGEMENTS_MAX), fait_le: e.faitLe || null, par: e.par, maj_le: new Date().toISOString() }
  const r = e.id ? await supabase.from('entretiens').update(ligne).eq('id', e.id) : await supabase.from('entretiens').upsert(ligne, { onConflict: 'coach,mois' })
  if (r.error) throw new ErreurEntretien(r.error.code === '42P01' ? 'Les entretiens ne sont pas encore activés dans la base.' : 'L’entretien n’a pas pu être enregistré. Vérifie ta connexion et réessaie.')
}

export async function enregistrerRemarques(id: number, remarques: string) {
  const { error } = await supabase.rpc('remarque_entretien', { p_id: id, p_texte: remarques })
  if (error) throw new ErreurEntretien('Tes remarques n’ont pas pu être enregistrées. Vérifie ta connexion et réessaie.')
}

// Ordre du jour préparé par l'app pour l'entretien d'un Coach : ce qui demande une discussion dans son portefeuille
export interface PointAborder { libelle: string; detail: string; lien?: string }
export function ordreDuJour(reseau: Reseau, coach: string): PointAborder[] {
  const magasins = magasinsDuCoach(reseau, coach).filter((m) => m.statut !== 'avenir')
  const noms = new Set(magasins.map((m) => m.nom))
  const points: PointAborder[] = []
  for (const m of magasins) {
    const a = analyser(reseau, m.nom)
    if (a?.statut === 'decroche') points.push({ libelle: `${m.nom} décroche`, detail: `CA ${a.ecart !== null ? `${a.ecart > 0 ? '+' : ''}${a.ecart.toFixed(1).replace('.', ',')} %` : ''} vs ${a.reference}`, lien: `/magasins/${encodeURIComponent(m.nom)}` })
  }
  const enRetardVisite = suiviRythme(reseau, anneeDe(reseau.jour)).filter((l) => noms.has(l.magasin.nom) && l.alerte)
  if (enRetardVisite.length) points.push({ libelle: `${enRetardVisite.length} visite${enRetardVisite.length > 1 ? 's' : ''} en retard sur le rythme`, detail: enRetardVisite.slice(0, 4).map((l) => l.magasin.nom).join(', ') })
  const sansCompteRendu = reseau.visites.filter((v) => noms.has(v.magasin) && visiteFaite(v, reseau.jour) && v.date >= decalerJours(reseau.jour, -60) && v.signatureRequise && !v.lienSigne)
  if (sansCompteRendu.length) points.push({ libelle: `${sansCompteRendu.length} compte${sansCompteRendu.length > 1 ? 's' : ''} rendu${sansCompteRendu.length > 1 ? 's' : ''} pas encore signé${sansCompteRendu.length > 1 ? 's' : ''}`, detail: sansCompteRendu.slice(0, 4).map((v) => v.magasin).join(', ') })
  const plans = magasins.filter((m) => planARevoir(reseau, m.nom))
  if (plans.length) points.push({ libelle: `${plans.length} plan${plans.length > 1 ? 's' : ''} d’action à revoir`, detail: plans.map((m) => m.nom).join(', ') })
  for (const m of magasins) for (const o of objectifsDu(reseau, m.nom)) {
    const s = avancement(reseau, m.nom, o).statut
    if (s === 'retard' || s === 'manque') points.push({ libelle: `${m.nom} : objectif en retard`, detail: phraseObjectif(o), lien: `/magasins/${encodeURIComponent(m.nom)}` })
  }
  const taches = actionsDes(reseau, noms).filter((x) => !x.a.faite)
  const bloquees = taches.filter((x) => x.a.statut === 'bloquee').length
  const retards = taches.filter((x) => enRetard(x.a, reseau.jour)).length
  if (bloquees) points.push({ libelle: `${bloquees} tâche${bloquees > 1 ? 's' : ''} bloquée${bloquees > 1 ? 's' : ''}`, detail: 'dans son portefeuille', lien: '/taches?de=%40bloquees' })
  if (retards) points.push({ libelle: `${retards} tâche${retards > 1 ? 's' : ''} en retard`, detail: 'dans son portefeuille', lien: '/taches?de=%40retard' })
  return points
}
const decalerJours = (jour: string, n: number) => { const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
export const moisPrecedent = (mois: string) => decalerMois(mois, -1)
