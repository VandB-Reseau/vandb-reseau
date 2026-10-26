// Historique des modifications (sprint 26, F3 ; script supabase/migrations/0036_historique_modifications.sql) : la base note
// chaque ajout, changement ou suppression dans les visites, les chiffres, le suivi des magasins, les fiches et les affectations.
// Lecture et remise d'une suppression : Directeur seul. Une tâche retirée d'une liste est remise par l'app.
import { supabase } from '../lib/supabase'
import { enregistrerActionLibre } from './chargement'
import { colonnesChiffres, libelleMois, libellesChiffres, type ChampChiffre } from './chiffres'
import { libelleTypeVisite, type ActionLibre, type Reseau } from './modele'
import { caseDe, type Evaluation } from './sante'
import { dateCourte } from '../lib/format'

type Objet = Record<string, unknown>
export type Operation = 'ajout' | 'changement' | 'suppression'
export interface Modification {
  id: number; le: string; role: string; auteur: string; table: string; operation: Operation
  magasin: string; rubrique: string; avant: Objet | null; apres: Objet | null; remisLe: string | null
}
// Une modification peut donner plusieurs lignes (plusieurs tâches changées d'un coup)
export interface LigneHistorique {
  cle: string; modif: Modification; texte: string; suppression: boolean
  remettre?: { genre: 'ligne' } | { genre: 'tache'; tache: ActionLibre }
}

const objet = (v: unknown): Objet | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as Objet : null)
const texte = (v: unknown) => (v === null || v === undefined ? '' : String(v))
const operation = (v: unknown): Operation => (v === 'ajout' || v === 'suppression' ? v : 'changement')

// null tant que la base ne connaît pas l'historique (script 0036 pas encore passé)
export async function chargerHistorique(): Promise<Modification[] | null> {
  const { data, error } = await supabase.rpc('historique_modifications', {})
  if (error) return null
  return (Array.isArray(data) ? data as Objet[] : []).filter(objet).map((l) => ({
    id: Number(l.id), le: texte(l.le), role: texte(l.role), auteur: texte(l.auteur), table: texte(l.table_nom), operation: operation(l.operation),
    magasin: texte(l.magasin), rubrique: texte(l.rubrique), avant: objet(l.avant), apres: objet(l.apres), remisLe: l.remis_le ? texte(l.remis_le) : null,
  }))
}

export class ErreurHistorique extends Error {}

export async function remettre(l: LigneHistorique, reseau: Reseau) {
  if (l.remettre?.genre === 'tache') {
    const t = l.remettre.tache
    // Déjà revenue (remise une première fois, ou recréée) : rien à faire
    if ((reseau.actionsLibres[l.modif.magasin] ?? []).some((x) => x.id === t.id)) return
    await enregistrerActionLibre(l.modif.magasin, t)
    return
  }
  const { error } = await supabase.rpc('remettre_modification', { p_id: l.modif.id })
  if (!error) return
  const m = error.message ?? ''
  throw new ErreurHistorique(/deja_remplace/.test(m) ? 'Une nouvelle saisie a pris sa place depuis : rien n’a été remis.'
    : /acces_refuse/.test(m) ? 'Seul le Directeur de réseau peut remettre une suppression.'
      : 'La remise n’a pas abouti. Réessaie dans un instant.')
}

export function nomAuteur(m: Modification, reseau: Reseau): string {
  if (m.role === 'directeur') return reseau.directeur.nom || 'Directeur de réseau'
  if (m.role === 'rr') return reseau.rrs.find((r) => r.id === m.auteur)?.nom || 'Responsable Régional'
  if (m.role === 'coach') return m.auteur || 'Coach'
  if (m.role === 'franchise') return m.auteur ? `${m.auteur} (franchisé)` : 'Franchisé'
  return 'Traitement automatique'
}

const libellesRubrique: Record<string, string> = {
  notes: 'Notes du magasin', audits: 'Audits', associes: 'Associés', deploiements: 'Thématiques de déploiement',
  constats: 'Constats de campagne', ouverture: 'Ouverture', sante: 'Nine box', actions: 'Tâches',
}
const verbe: Record<Operation, string> = { ajout: 'ajout', changement: 'modification', suppression: 'suppression' }
const colonnesVersChamps = Object.fromEntries(Object.entries(colonnesChiffres).map(([id, col]) => [col, id as ChampChiffre]))
const dateVisite = (v: Objet | null) => (v && /^\d{4}-\d{2}-\d{2}/.test(texte(v.visit_date)) ? dateCourte(texte(v.visit_date).slice(0, 10)) : '')
const changes = (a: Objet | null, b: Objet | null, ignorer: string[] = []) =>
  [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].filter((k) => !ignorer.includes(k) && JSON.stringify(a?.[k] ?? null) !== JSON.stringify(b?.[k] ?? null))
const taches = (v: unknown): ActionLibre[] => (Array.isArray(v) ? (v as ActionLibre[]).filter((t) => t && typeof t === 'object' && t.id) : [])
const libelleCase = (v: unknown) => caseDe((objet(v) ?? undefined) as Evaluation | undefined)?.libelle ?? 'non classé'

export function lignesDe(m: Modification): LigneHistorique[] {
  const une = (t: string, remettre?: LigneHistorique['remettre']): LigneHistorique[] =>
    [{ cle: String(m.id), modif: m, texte: t, suppression: m.operation === 'suppression', remettre: m.operation === 'suppression' ? remettre : undefined }]
  const ligne = m.apres ?? m.avant
  if (m.table === 'visits') {
    const v = m.operation === 'ajout' ? m.apres : m.avant
    const quoi = `${libelleTypeVisite(texte(v?.type))} du ${dateVisite(v)}`
    if (m.operation === 'ajout') return une(`${quoi} ajoutée`)
    if (m.operation === 'suppression') return une(`${quoi} supprimée`, { genre: 'ligne' })
    const champs = changes(m.avant, m.apres, ['created_at', 'updated_at'])
    const noms = [...new Set(champs.map((c) => (c === 'visit_date' ? 'date' : c === 'visitor' ? 'participants' : c === 'notes' ? 'note' : c === 'type' ? 'type' : 'compte rendu')))]
    return une(`${quoi} modifiée${noms.length ? ` (${noms.join(', ')})` : ''}`)
  }
  if (m.table === 'store_finance') {
    const mois = /^\d{4}-\d{2}/.test(m.rubrique) ? libelleMois(m.rubrique) : 'un mois'
    if (m.operation === 'ajout') return une(`Chiffres de ${mois} ajoutés`)
    if (m.operation === 'suppression') return une(`Chiffres de ${mois} supprimés`, { genre: 'ligne' })
    const champs = changes(m.avant, m.apres).map((c) => colonnesVersChamps[c]).filter(Boolean).map((c) => libellesChiffres[c].libelle).map((x) => x.charAt(0).toLowerCase() + x.slice(1))
    return une(`Chiffres de ${mois} modifiés${champs.length ? ` (${champs.join(', ')})` : ''}`)
  }
  if (m.table === 'suivi_magasins' && m.rubrique === 'actions') {
    const avant = taches(m.avant?.valeur), apres = taches(m.apres?.valeur)
    const res: LigneHistorique[] = []
    const ajoute = (t: string, sup = false, tache?: ActionLibre) =>
      res.push({ cle: `${m.id}-${res.length}`, modif: m, texte: t, suppression: sup, remettre: sup && tache ? { genre: 'tache', tache } : undefined })
    for (const t of avant) {
      const n = apres.find((x) => x.id === t.id)
      if (!n) ajoute(`Tâche supprimée : « ${t.action} »`, true, t)
      else if (!t.faite && n.faite) ajoute(`Tâche faite : « ${n.action} »`)
      else if (t.faite && !n.faite) ajoute(`Tâche rouverte : « ${n.action} »`)
      else if (JSON.stringify(t) !== JSON.stringify(n)) ajoute(`Tâche modifiée : « ${n.action} »`)
    }
    for (const n of apres) if (!avant.some((t) => t.id === n.id)) ajoute(`Tâche ajoutée : « ${n.action} »`)
    return res
  }
  if (m.table === 'suivi_magasins' && m.rubrique === 'sante') {
    if (m.operation === 'suppression') return une('Note nine box effacée', { genre: 'ligne' })
    const a = m.operation === 'ajout' ? null : libelleCase(m.avant?.valeur), b = libelleCase(m.apres?.valeur)
    return une(a === null ? `Nine box : ${b}` : a === b ? `Nine box : notes modifiées (${b})` : `Nine box : ${a} → ${b}`)
  }
  if (m.table === 'suivi_magasins') return une(`${libellesRubrique[m.rubrique] ?? 'Suivi'} : ${verbe[m.operation]}`, { genre: 'ligne' })
  if (m.table === 'store_overrides') {
    if (m.operation === 'suppression') return une('Fiche du magasin remise à l’origine', { genre: 'ligne' })
    return une(m.operation === 'ajout' ? 'Fiche du magasin complétée' : 'Fiche du magasin modifiée')
  }
  if (m.table === 'reassigns') {
    const coach = texte(ligne?.cs) || 'aucun Coach', depuis = /^\d{4}-\d{2}-\d{2}/.test(texte(ligne?.date)) ? ` à partir du ${dateCourte(texte(ligne?.date).slice(0, 10))}` : ''
    if (m.operation === 'suppression') return une(`Affectation à ${coach}${depuis} retirée`, { genre: 'ligne' })
    return une(`${m.operation === 'ajout' ? 'Affecté' : 'Affectation modifiée'} : ${coach}${depuis}`)
  }
  return une(`Donnée : ${verbe[m.operation]}`)
}
