// Questions éclair aux franchisés (sprint 22, A3 ; script supabase/migrations/0026_questions_eclair.sql) : le Directeur
// ou un RR pose une question (oui/non, choix, note de 1 à 5), le franchisé répond une fois. Anonymat tenu par la base.
import { supabase } from '../lib/supabase'

export type Genre = 'oui_non' | 'choix' | 'note'
export interface ReponseQuestion { valeur: string; franchise: string | null; regions: string[] }
export interface Question {
  id: number; titre: string; genre: Genre; choix: string[]; anonyme: boolean; magasins: string[] | null; jusquAu: string
  auteur: string; auteurNom: string; creeLe: string; reponses: ReponseQuestion[]; sansReponse: string[]; concernes: number
}
export interface QuestionFranchise { id: number; titre: string; genre: Genre; choix: string[]; anonyme: boolean; jusquAu: string; auteurNom: string; repondu: boolean }

type Ligne = Record<string, unknown>
const lignes = (v: unknown) => (Array.isArray(v) ? (v as Ligne[]).filter((x) => x && typeof x === 'object') : [])
const textes = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])
const genre = (v: unknown): Genre => (v === 'choix' || v === 'note' ? v : 'oui_non')

export class ErreurQuestion extends Error {}
function humain(e: { message?: string }) {
  const m = e.message ?? ''
  return new ErreurQuestion(/deja_repondu/.test(m) ? 'Tu as déjà répondu à cette question.'
    : /date_invalide/.test(m) ? 'La date de fin doit tomber dans les 90 prochains jours.'
    : /format/.test(m) ? 'Vérifie la question : un choix demande de 2 à 6 réponses possibles.'
    : /acces_refuse/.test(m) ? 'Cette question n’est plus ouverte.'
    : 'L’enregistrement n’a pas abouti. Réessaie dans un instant.')
}

// Directeur et RR : null tant que la base ne connaît pas les questions
export async function chargerQuestions(): Promise<Question[] | null> {
  const { data, error } = await supabase.rpc('resultats_questions')
  if (error) return null
  return lignes(data).map((l) => ({
    id: Number(l.id), titre: String(l.titre ?? ''), genre: genre(l.genre), choix: textes(l.choix), anonyme: !!l.anonyme,
    magasins: Array.isArray(l.magasins) ? l.magasins.map(String) : null, jusquAu: String(l.jusqu_au ?? '').slice(0, 10),
    auteur: String(l.auteur ?? ''), auteurNom: String(l.auteur_nom ?? ''), creeLe: String(l.cree_le ?? ''),
    reponses: lignes(l.reponses).map((r) => ({ valeur: String(r.valeur ?? ''), franchise: r.franchise ? String(r.franchise) : null, regions: textes(r.regions) })),
    sansReponse: textes(l.sans_reponse).sort((a, b) => a.localeCompare(b, 'fr')), concernes: Number(l.concernes) || 0,
  }))
}

export async function publierQuestion(q: { titre: string; genre: Genre; choix: string[]; anonyme: boolean; magasins: string[] | null; jusquAu: string }) {
  const { error } = await supabase.rpc('publier_question', { p_titre: q.titre, p_genre: q.genre, p_choix: q.choix, p_anonyme: q.anonyme, p_magasins: q.magasins, p_jusqu_au: q.jusquAu })
  if (error) throw humain(error)
}

export async function supprimerQuestion(id: number) {
  const { error } = await supabase.rpc('supprimer_question', { p_id: id })
  if (error) throw humain(error)
}

export async function chargerQuestionsFranchise(): Promise<QuestionFranchise[] | null> {
  const { data, error } = await supabase.rpc('questions_franchise')
  if (error) return null
  return lignes(data).map((l) => ({ id: Number(l.id), titre: String(l.titre ?? ''), genre: genre(l.genre), choix: textes(l.choix), anonyme: !!l.anonyme, jusquAu: String(l.jusqu_au ?? '').slice(0, 10), auteurNom: String(l.auteur_nom ?? ''), repondu: !!l.repondu }))
}

export async function repondreQuestion(id: number, valeur: string) {
  const { error } = await supabase.rpc('repondre_question', { p_id: id, p_valeur: valeur })
  if (error) throw humain(error)
}

// Valeurs possibles d'une question, dans l'ordre d'affichage
export const valeursDe = (q: Pick<Question, 'genre' | 'choix'>) => (q.genre === 'oui_non' ? ['oui', 'non'] : q.genre === 'note' ? ['1', '2', '3', '4', '5'] : q.choix)
export const libelleValeur = (q: Pick<Question, 'genre'>, v: string) => (q.genre === 'oui_non' ? (v === 'oui' ? 'Oui' : 'Non') : v)

// Décompte par valeur, moyenne pour une note
export function decompte(q: Question, reponses = q.reponses) {
  const parValeur = valeursDe(q).map((v) => ({ v, n: reponses.filter((r) => r.valeur === v).length }))
  const moyenne = q.genre === 'note' && reponses.length ? reponses.reduce((s, r) => s + Number(r.valeur), 0) / reponses.length : null
  return { parValeur, moyenne, total: reponses.length }
}
