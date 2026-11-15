// 185 · Journal des opérations commerciales (Joseph, 15/11/2026) : le franchisé ou l'équipe note ce que le magasin a
// lancé (dégustation, soirée, promotion…) avec sa date, son univers et son coût ; l'app en fait le bilan en caisse et le
// réseau voit quels types d'opération marchent le mieux. Rubrique « operations » de suivi_magasins (0047).
//
// Bilan d'une opération (caisse mensuelle, donc effet dilué dans le mois : c'est un repère, pas une preuve) :
// - évolution du mois de l'opération face au même mois de l'an passé, sur l'univers choisi ;
// - tendance : la même évolution sur les 3 mois d'avant (CA cumulé face au CA cumulé de l'an passé) ;
// - effet = évolution du mois − tendance, en points ; en euros : CA du mois − CA de l'an passé × (1 + tendance).
import { formatEuros, formatPourcent, libelleMois, type ChiffreMois } from './chiffres'
import type { Reseau } from './modele'

export const typesOperation = [
  ['degustation', 'Dégustation'],
  ['soiree', 'Soirée ou animation'],
  ['promotion', 'Promotion ou offre'],
  ['evenement', 'Événement local, salon, marché'],
  ['partenariat', 'Partenariat (entreprise, association)'],
  ['communication', 'Communication (affichage, réseaux sociaux, presse)'],
  ['autre', 'Autre'],
] as const
export type TypeOperation = (typeof typesOperation)[number][0]
export const libelleTypeOperation = (t: TypeOperation) => typesOperation.find(([k]) => k === t)?.[1] ?? 'Autre'

export type UniversOperation = 'tout' | 'cave' | 'bar' | 'exterieur'
export const universOperation: [UniversOperation, string][] = [['tout', 'Tout le magasin'], ['cave', 'Cave'], ['bar', 'Bar'], ['exterieur', 'Extérieur']]

export interface Operation {
  id: string
  type: TypeOperation
  titre: string
  jour: string // AAAA-MM-JJ : date (ou début) de l'opération
  univers: UniversOperation
  cout: number | null // coût HT (produits offerts, animation, communication…)
  note: string
  par: string
  le: string // AAAA-MM-JJ : saisie
}

const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
export function normaliserOperations(v: unknown): Record<string, Operation[]> {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
  const types = new Set<string>(typesOperation.map(([k]) => k))
  const univers = new Set<string>(universOperation.map(([k]) => k))
  return Object.fromEntries(Object.entries(o).map(([m, liste]) => [m, (Array.isArray(liste) ? liste : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x): Operation => ({
      id: texte(x.id, 40), type: (types.has(String(x.type)) ? x.type : 'autre') as TypeOperation, titre: texte(x.titre, 120),
      jour: /^\d{4}-\d{2}-\d{2}$/.test(String(x.jour)) ? String(x.jour) : '', univers: (univers.has(String(x.univers)) ? x.univers : 'tout') as UniversOperation,
      cout: typeof x.cout === 'number' && Number.isFinite(x.cout) && x.cout >= 0 ? x.cout : null, note: texte(x.note, 500), par: texte(x.par, 80), le: texte(x.le, 10),
    })).filter((e) => e.id && e.titre && e.jour)
    .sort((a, b) => b.jour.localeCompare(a.jour))]).filter(([, l]) => (l as Operation[]).length))
}

export const operationsDu = (reseau: Pick<Reseau, 'operations'> | null | undefined, magasin: string) => reseau?.operations?.[magasin] ?? []

function caUnivers(c: ChiffreMois | undefined, u: UniversOperation): number | null {
  if (!c) return null
  if (u === 'cave') return c.caCave
  if (u === 'bar') return c.caBar
  if (u === 'exterieur') return c.caExt
  const l = [c.caCave, c.caBar, c.caExt]
  return l.every((x) => x === null) ? null : l.reduce<number>((s, x) => s + (x ?? 0), 0)
}
const decale = (mois: string, n: number) => {
  const d = Number(mois.slice(0, 4)) * 12 + Number(mois.slice(5, 7)) - 1 + n
  return `${Math.floor(d / 12)}-${String((d % 12) + 1).padStart(2, '0')}`
}

export type Bilan =
  | { etat: 'attente'; mois: string } // caisse du mois pas encore arrivée
  | { etat: 'sans_comparaison'; mois: string } // pas de N-1 pour le mois ou la tendance
  | { etat: 'mesure'; mois: string; ca: number; caAvant: number; evolution: number; tendance: number; effetPts: number; effetEuros: number; rendement: number | null }

export function bilanOperation(chiffres: ChiffreMois[], op: Pick<Operation, 'jour' | 'univers' | 'cout'>): Bilan {
  const mois = op.jour.slice(0, 7)
  const par = new Map(chiffres.map((c) => [c.mois, c]))
  const ca = caUnivers(par.get(mois), op.univers)
  if (ca === null) return { etat: 'attente', mois }
  const caAvant = caUnivers(par.get(decale(mois, -12)), op.univers)
  let t = 0, tAvant = 0
  for (let i = 1; i <= 3; i++) {
    const x = caUnivers(par.get(decale(mois, -i)), op.univers), y = caUnivers(par.get(decale(mois, -12 - i)), op.univers)
    if (x === null || y === null) { t = NaN; break }
    t += x; tAvant += y
  }
  if (!caAvant || caAvant <= 0 || !Number.isFinite(t) || tAvant <= 0) return { etat: 'sans_comparaison', mois }
  const evolution = ca / caAvant - 1, tendance = t / tAvant - 1
  const effetEuros = ca - caAvant * (1 + tendance)
  return { etat: 'mesure', mois, ca, caAvant, evolution, tendance, effetPts: evolution - tendance, effetEuros, rendement: op.cout && op.cout > 0 ? effetEuros / op.cout : null }
}

// Vue du réseau : par type d'opération, ce qui a été mesuré sur les magasins lisibles par le compte
export interface StatType { type: TypeOperation; operations: number; magasins: number; mesurees: number; effetMedian: number | null; coutMedian: number | null; positives: number }
const mediane = (l: number[]) => {
  if (!l.length) return null
  const t = [...l].sort((a, b) => a - b), m = Math.floor(t.length / 2)
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2
}
export function statsOperations(reseau: Pick<Reseau, 'operations' | 'chiffres'>, magasins: string[]): StatType[] {
  const r: StatType[] = []
  for (const [type] of typesOperation) {
    const ops = magasins.flatMap((m) => operationsDu(reseau, m).filter((o) => o.type === type).map((o) => ({ m, o, b: bilanOperation(reseau.chiffres[m] ?? [], o) })))
    if (!ops.length) continue
    const mesurees = ops.flatMap((x) => (x.b.etat === 'mesure' ? [x.b] : []))
    const couts = ops.flatMap((x) => (x.o.cout !== null ? [x.o.cout] : []))
    r.push({
      type, operations: ops.length, magasins: new Set(ops.map((x) => x.m)).size, mesurees: mesurees.length,
      effetMedian: mediane(mesurees.map((b) => b.effetPts)), coutMedian: mediane(couts), positives: mesurees.filter((b) => b.effetPts > 0).length,
    })
  }
  return r.sort((a, b) => (b.effetMedian ?? -Infinity) - (a.effetMedian ?? -Infinity))
}

export const libelleUnivers = (u: UniversOperation) => universOperation.find(([k]) => k === u)?.[1] ?? 'Tout le magasin'
export const pts = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} pt${Math.abs(v * 100) >= 2 ? 's' : ''}`
const signeEuros = (v: number) => `${v > 0 ? '+' : ''}${formatEuros(v)}`

// Une ligne de bilan, en phrase ; ton vert si l'effet est positif
export function phraseBilan(b: Bilan, o: Pick<Operation, 'univers' | 'cout'>): { texte: string; ton: 'bon' | 'faible' | 'neutre' } {
  if (b.etat === 'attente') return { texte: `Bilan dès la caisse de ${libelleMois(b.mois)}`, ton: 'neutre' }
  if (b.etat === 'sans_comparaison') return { texte: 'Pas de bilan : il manque l’an passé pour comparer', ton: 'neutre' }
  const u = o.univers === 'tout' ? 'CA' : `CA ${libelleUnivers(o.univers)}`
  const cout = o.cout ? ` pour ${formatEuros(o.cout)} de coût` : ''
  return {
    texte: `${u} de ${libelleMois(b.mois)} ${formatPourcent(b.evolution * 100)} face à l’an passé, tendance ${formatPourcent(b.tendance * 100)} : effet ${pts(b.effetPts)}, environ ${signeEuros(b.effetEuros)} HT${cout}`,
    ton: b.effetPts > 0 ? 'bon' : 'faible',
  }
}

