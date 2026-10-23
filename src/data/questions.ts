// Sondages (sprint 22, A3, puis 23/10/2026 ; scripts supabase/migrations/0026_questions_eclair.sql et 0029_sondages.sql) :
// le Directeur ou un RR pose de 1 à 5 questions (oui/non, choix, note de 1 à 5) aux franchisés, à l'équipe ou aux deux ;
// chacun répond une fois, à tout d'un coup. Anonymat tenu par la base.
import { supabase } from '../lib/supabase'

export type Genre = 'oui_non' | 'choix' | 'note'
export type Cible = 'franchises' | 'equipe' | 'tous'
export interface QuestionSondage { titre: string; genre: Genre; choix: string[] }
export interface ReponseSondage { valeurs: string[]; role: string; franchise: string | null; regions: string[] }
export interface Sondage {
  id: number; titre: string; questions: QuestionSondage[]; cible: Cible; anonyme: boolean; magasins: string[] | null; jusquAu: string
  auteur: string; auteurNom: string; creeLe: string; reponses: ReponseSondage[]; sansReponse: string[]; concernes: number
}
export interface SondageARepondre { id: number; titre: string; questions: QuestionSondage[]; anonyme: boolean; jusquAu: string; auteurNom: string; repondu: boolean }

type Ligne = Record<string, unknown>
const lignes = (v: unknown) => (Array.isArray(v) ? (v as Ligne[]).filter((x) => x && typeof x === 'object') : [])
const textes = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])
const genre = (v: unknown): Genre => (v === 'choix' || v === 'note' ? v : 'oui_non')
const cible = (v: unknown): Cible => (v === 'equipe' || v === 'tous' ? v : 'franchises')
// Une question éclair d'avant 0029 n'a pas de liste de questions : elle en est une à elle seule
const questionsDe = (l: Ligne): QuestionSondage[] => {
  const q = lignes(l.questions).map((x) => ({ titre: String(x.titre ?? ''), genre: genre(x.genre), choix: textes(x.choix) }))
  return q.length ? q : [{ titre: String(l.titre ?? ''), genre: genre(l.genre), choix: textes(l.choix) }]
}

export class ErreurQuestion extends Error {}
function humain(e: { message?: string }) {
  const m = e.message ?? ''
  return new ErreurQuestion(/deja_repondu/.test(m) ? 'Tu as déjà répondu à ce sondage.'
    : /date_invalide/.test(m) ? 'La date de fin doit tomber dans les 90 prochains jours.'
    : /format/.test(m) ? 'Vérifie les questions : de 1 à 5, et un choix demande de 2 à 6 réponses possibles.'
    : /acces_refuse/.test(m) ? 'Ce sondage n’est plus ouvert.'
    : 'L’enregistrement n’a pas abouti. Réessaie dans un instant.')
}

// Directeur et RR : null tant que la base ne connaît pas les sondages
export async function chargerSondages(): Promise<Sondage[] | null> {
  const { data, error } = await supabase.rpc('resultats_questions')
  if (error) return null
  return lignes(data).map((l) => ({
    id: Number(l.id), titre: String(l.titre ?? ''), questions: questionsDe(l), cible: cible(l.cible), anonyme: !!l.anonyme,
    magasins: Array.isArray(l.magasins) ? l.magasins.map(String) : null, jusquAu: String(l.jusqu_au ?? '').slice(0, 10),
    auteur: String(l.auteur ?? ''), auteurNom: String(l.auteur_nom ?? ''), creeLe: String(l.cree_le ?? ''),
    reponses: lignes(l.reponses).map((r) => ({ valeurs: Array.isArray(r.valeurs) ? textes(r.valeurs) : [String(r.valeur ?? '')], role: String(r.role ?? 'franchise'),
      franchise: r.franchise ? String(r.franchise) : null, regions: textes(r.regions) })),
    sansReponse: textes(l.sans_reponse).sort((a, b) => a.localeCompare(b, 'fr')), concernes: Number(l.concernes) || 0,
  }))
}

export async function publierSondage(s: { titre: string; questions: QuestionSondage[]; cible: Cible; anonyme: boolean; magasins: string[] | null; jusquAu: string }) {
  const { error } = await supabase.rpc('publier_sondage', { p_titre: s.titre, p_questions: s.questions, p_cible: s.cible, p_anonyme: s.anonyme, p_magasins: s.magasins, p_jusqu_au: s.jusquAu })
  if (error) throw humain(error)
}

export async function supprimerSondage(id: number) {
  const { error } = await supabase.rpc('supprimer_question', { p_id: id })
  if (error) throw humain(error)
}

// Sondages ouverts à remplir : ceux du franchisé, ou ceux d'un membre de l'équipe
export async function chargerSondagesARepondre(equipe: boolean): Promise<SondageARepondre[] | null> {
  const { data, error } = await supabase.rpc(equipe ? 'questions_equipe' : 'questions_franchise')
  if (error) return null
  return lignes(data).map((l) => ({ id: Number(l.id), titre: String(l.titre ?? ''), questions: questionsDe(l), anonyme: !!l.anonyme,
    jusquAu: String(l.jusqu_au ?? '').slice(0, 10), auteurNom: String(l.auteur_nom ?? ''), repondu: !!l.repondu }))
}

export async function repondreSondage(id: number, valeurs: string[]) {
  const { error } = await supabase.rpc('repondre_sondage', { p_id: id, p_valeurs: valeurs })
  if (error) throw humain(error)
}

// Valeurs possibles d'une question, dans l'ordre d'affichage
export const valeursDe = (q: Pick<QuestionSondage, 'genre' | 'choix'>) => (q.genre === 'oui_non' ? ['oui', 'non'] : q.genre === 'note' ? ['1', '2', '3', '4', '5'] : q.choix)
export const libelleValeur = (q: Pick<QuestionSondage, 'genre'>, v: string) => (q.genre === 'oui_non' ? (v === 'oui' ? 'Oui' : 'Non') : v)

// Décompte de la question n par valeur, moyenne pour une note
export function decompte(q: QuestionSondage, n: number, reponses: ReponseSondage[]) {
  const valeurs = reponses.map((r) => r.valeurs[n]).filter((v): v is string => !!v)
  const parValeur = valeursDe(q).map((v) => ({ v, n: valeurs.filter((x) => x === v).length }))
  const moyenne = q.genre === 'note' && valeurs.length ? valeurs.reduce((s, v) => s + Number(v), 0) / valeurs.length : null
  return { parValeur, moyenne, total: valeurs.length }
}
