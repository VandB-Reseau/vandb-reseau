import type { Reseau } from './modele'

// Santé du parc : critères notés à la main (pas encore de lien avec la BI), de 1 (faible) à 3 (fort)
// 0 = non concerné (critère volontairement non évalué, exclu des moyennes)
export type Note = 0 | 1 | 2 | 3
export type IdCritere = string
export type Axe = 'resultats' | 'franchise'

// Grille de la nine box, réglable dans Paramètres (app_config, clé grille_ninebox)
// Chaque axe = moyenne pondérée des critères notés ; un critère bloquant noté Faible rend l'axe Faible
export interface CritereGrille { id: IdCritere; libelle: string; axe: Axe; poids: number; bloquant?: boolean; definition?: string }
export interface GrilleNineBox { criteres: CritereGrille[]; seuilBas: number; seuilHaut: number; modifieLe?: string }

export const grilleParDefaut: GrilleNineBox = {
  seuilBas: 1.67, seuilHaut: 2.34,
  criteres: [
    { id: 'caExterieur', libelle: 'CA marché extérieur', axe: 'resultats', poids: 20 },
    { id: 'panierCave', libelle: 'Panier moyen cave', axe: 'resultats', poids: 20 },
    { id: 'panierBar', libelle: 'Panier moyen bar', axe: 'resultats', poids: 20 },
    { id: 'fluxCave', libelle: 'Flux cave', axe: 'resultats', poids: 20 },
    { id: 'fluxBar', libelle: 'Flux bar', axe: 'resultats', poids: 20 },
    { id: 'gestion', libelle: 'Gestion', axe: 'franchise', poids: 25, definition: 'Suit ses chiffres, marge, stocks, trésorerie, paiements au réseau à l’heure' },
    { id: 'management', libelle: 'Management de l’équipe', axe: 'franchise', poids: 25, definition: 'Recrutement, formation à la vente, planning, stabilité de l’équipe' },
    { id: 'animation', libelle: 'Animation commerciale', axe: 'franchise', poids: 20, definition: 'Vente additionnelle, dégustations, événements, fidélité, réseaux sociaux locaux' },
    { id: 'tenue', libelle: 'Tenue du magasin', axe: 'franchise', poids: 20, bloquant: true, definition: 'Hygiène, merchandising, respect du concept' },
    { id: 'relation', libelle: 'Relation au réseau', axe: 'franchise', poids: 10, definition: 'Applique les standards, entre dans les programmes, répond au Coach' },
  ],
}

// Ancienne note unique du franchisé : elle décide encore de la ligne tant qu'aucun critère détaillé n'est noté
export const ANCIENNE_NOTE_FRANCHISE = 'franchise'
export const libelleAncienneNote = 'Niveau du franchisé (ancienne note)'

// Relit une grille enregistrée ; tout ce qui est invalide reprend la valeur par défaut
export function normaliserGrille(v: unknown): GrilleNineBox {
  const g = (v ?? {}) as Partial<GrilleNineBox>
  const criteres = Array.isArray(g.criteres)
    ? g.criteres.filter((c) => c && typeof c.id === 'string' && c.id && typeof c.libelle === 'string' && (c.axe === 'resultats' || c.axe === 'franchise'))
      .map((c) => ({ id: c.id, libelle: c.libelle, axe: c.axe, poids: Math.max(0, Number(c.poids) || 0), ...(c.bloquant ? { bloquant: true } : {}), ...(c.definition ? { definition: String(c.definition) } : {}) }))
    : []
  const axesComplets = criteres.some((c) => c.axe === 'resultats') && criteres.some((c) => c.axe === 'franchise')
  const bas = Number(g.seuilBas), haut = Number(g.seuilHaut)
  const seuilsOk = bas > 1 && haut > bas && haut < 3
  // Résultats d'abord, puis Franchisé (ordre des colonnes partout)
  const ordre = (l: CritereGrille[]) => [...l.filter((c) => c.axe === 'resultats'), ...l.filter((c) => c.axe === 'franchise')]
  return {
    criteres: axesComplets ? ordre(criteres) : grilleParDefaut.criteres,
    seuilBas: seuilsOk ? bas : grilleParDefaut.seuilBas, seuilHaut: seuilsOk ? haut : grilleParDefaut.seuilHaut,
    ...(g.modifieLe ? { modifieLe: String(g.modifieLe) } : {}),
  }
}

// Grille en vigueur : fixée au chargement du réseau, lue par tous les calculs (liaison vivante des modules)
export let grilleActive: GrilleNineBox = grilleParDefaut
export let tousCriteres: CritereGrille[] = grilleParDefaut.criteres
export function definirGrille(g: GrilleNineBox) {
  grilleActive = g
  tousCriteres = g.criteres
}
export const criteresAxe = (axe: Axe, g: GrilleNineBox = grilleActive) => g.criteres.filter((c) => c.axe === axe)
export const libelleCritere = (id: IdCritere) => (id === ANCIENNE_NOTE_FRANCHISE ? libelleAncienneNote : tousCriteres.find((c) => c.id === id)?.libelle ?? id)
export const libelleAxe = (axe: Axe, integre = false) => (axe === 'resultats' ? 'Résultats' : integre ? 'Responsable du magasin' : 'Franchisé')

export const libelleNote: Record<Note, string> = { 0: 'Non concerné', 1: 'Faible', 2: 'Moyen', 3: 'Fort' }

export interface Evaluation { notes: Partial<Record<IdCritere, Note>>; date: string; par: string }
// Historique daté : une ligne par jour de saisie (case et notes du moment) ; les plus anciennes n'ont que la case
export interface PointSante { date: string; caseId: string; notes?: Partial<Record<IdCritere, Note>> }
export type Evaluations = Record<string, Evaluation & { historique?: PointSante[] }>

// Nine box (démarche coach octobre 2026) : résultats en colonnes, management en lignes
export interface CaseNineBox { id: string; libelle: string; resultats: 1 | 2 | 3; management: 1 | 2 | 3; rythme: string; couleur: string }
export const nineBox: CaseNineBox[] = [
  { id: 'diagnostic', libelle: 'Diagnostic marché', resultats: 1, management: 3, rythme: '4 visites × ½ j', couleur: '#f6c544' },
  { id: 'potentiel', libelle: 'Potentiel à activer', resultats: 2, management: 3, rythme: '3 visites × 1 j', couleur: '#8bc34a' },
  { id: 'locomotive', libelle: 'Locomotive', resultats: 3, management: 3, rythme: '2 visites × 1,5 j', couleur: '#2e7d32' },
  { id: 'relance', libelle: 'Relance commerciale', resultats: 1, management: 2, rythme: '6 visites × ½ j', couleur: '#ef7d00' },
  { id: 'coeur', libelle: 'Cœur de réseau', resultats: 2, management: 2, rythme: '3 visites × 1 j', couleur: '#f6c544' },
  { id: 'grandir', libelle: 'À faire grandir', resultats: 3, management: 2, rythme: '3 visites × 1 j', couleur: '#8bc34a' },
  { id: 'redressement', libelle: 'Redressement urgent', resultats: 1, management: 1, rythme: '8 visites × ½ j', couleur: '#d32f2f' },
  { id: 'renforcer', libelle: 'Management à renforcer', resultats: 2, management: 1, rythme: '6 visites × ½ j', couleur: '#ef7d00' },
  { id: 'fragile', libelle: 'Performance fragile', resultats: 3, management: 1, rythme: '4 visites × ½ j', couleur: '#f6c544' },
]

// Nombre de visites par an et durée d'une visite, lus dans le rythme de la case
export const visitesParAn = (c: CaseNineBox | null): number => (c ? Number(c.rythme.match(/^\d+/)?.[0] ?? 2) : 2)
export function joursParVisite(c: CaseNineBox | null): number {
  const d = c?.rythme.split('×')[1]?.trim() ?? '1 j'
  return d.startsWith('½') ? 0.5 : Number(d.replace(',', '.').replace(/[^\d.]/g, '')) || 1
}

const niveau = (moyenne: number, g: GrilleNineBox): 1 | 2 | 3 => (moyenne < g.seuilBas ? 1 : moyenne < g.seuilHaut ? 2 : 3)

// Moyenne pondérée des critères notés d'un axe (les « Non concerné » sortent du calcul et leur poids est redistribué)
export function scoreAxe(e: Evaluation | undefined, axe: Axe, g: GrilleNineBox = grilleActive): number | null {
  const notes = criteresAxe(axe, g).map((c) => ({ c, n: e?.notes[c.id] })).filter((x): x is { c: CritereGrille; n: 1 | 2 | 3 } => !!x.n)
  if (!notes.length) return null
  const poids = notes.reduce((a, x) => a + x.c.poids, 0)
  return poids > 0 ? notes.reduce((a, x) => a + x.n * x.c.poids, 0) / poids : notes.reduce((a, x) => a + x.n, 0) / notes.length
}
export const scoreResultats = (e: Evaluation | undefined, g: GrilleNineBox = grilleActive) => scoreAxe(e, 'resultats', g)

// Niveau d'un axe : un critère bloquant noté Faible l'emporte sur la moyenne
export function niveauAxe(e: Evaluation | undefined, axe: Axe, g: GrilleNineBox = grilleActive): 1 | 2 | 3 | null {
  const s = scoreAxe(e, axe, g)
  if (s === null) {
    const ancienne = axe === 'franchise' ? e?.notes[ANCIENNE_NOTE_FRANCHISE] : undefined
    return ancienne ? ancienne : null
  }
  if (criteresAxe(axe, g).some((c) => c.bloquant && e?.notes[c.id] === 1)) return 1
  return niveau(s, g)
}

// Case de la nine box : il faut au moins un critère noté sur chaque axe (ou l'ancienne note du franchisé)
export function caseDe(e: Evaluation | undefined, g: GrilleNineBox = grilleActive): CaseNineBox | null {
  const r = niveauAxe(e, 'resultats', g)
  const m = niveauAxe(e, 'franchise', g)
  if (!r || !m) return null
  return nineBox.find((c) => c.resultats === r && c.management === m) ?? null
}

// Rang d'une case : plus il est haut, mieux se porte le magasin
const rang = (c: CaseNineBox) => c.resultats + c.management

// Une seule ligne par jour : à date égale, la dernière saisie l'emporte (nettoie aussi les doublons enregistrés avant la règle)
function unParJour(points: PointSante[]): PointSante[] {
  return [...new Map(points.map((p) => [p.date, p])).values()].sort((a, b) => a.date.localeCompare(b.date))
}

// Le classement en place figure toujours dans l'historique (notes saisies avant l'historique daté)
export function historiqueSante(evaluations: Evaluations, magasin: string): PointSante[] {
  const e = evaluations[magasin]
  const h = e?.historique ?? []
  return unParJour(e?.date && !h.some((p) => p.date === e.date) ? [{ date: e.date, caseId: caseDe(e)?.id ?? '', notes: e.notes }, ...h] : h)
}

export type Sens = 'monte' | 'descend' | 'stable'
export interface Tendance { actuelle: CaseNineBox; precedente: CaseNineBox | null; sens: Sens; depuis: string }

// Compare la case actuelle à la dernière case différente de l'historique
export function tendance(evaluations: Evaluations, magasin: string): Tendance | null {
  const actuelle = caseDe(evaluations[magasin])
  if (!actuelle) return null
  const h = historiqueSante(evaluations, magasin).filter((p) => p.caseId)
  let i = h.length - 1
  while (i >= 0 && h[i].caseId === actuelle.id) i--
  const depuis = h[i + 1]?.date ?? evaluations[magasin].date
  const precedente = i >= 0 ? nineBox.find((c) => c.id === h[i].caseId) ?? null : null
  const sens: Sens = !precedente ? 'stable' : rang(actuelle) > rang(precedente) ? 'monte' : rang(actuelle) < rang(precedente) ? 'descend' : 'stable'
  return { actuelle, precedente, sens, depuis }
}

// Historique : une seule ligne par jour (un nouveau changement le même jour remplace l'ancien), rangé par date
export function ajouterPoint(historique: PointSante[], p: PointSante): PointSante[] {
  return unParJour([...historique, p])
}

// Notes en vigueur à une date : celles du dernier point daté jusqu'à ce jour
export function notesAu(e: (Evaluation & { historique?: PointSante[] }) | undefined, date: string): Partial<Record<IdCritere, Note>> {
  const p = unParJour(e?.historique ?? []).filter((x) => x.notes && x.date <= date).at(-1)
  if (p) return { ...p.notes }
  return e && (!e.date || e.date <= date) ? { ...e.notes } : {}
}

// Ajoute une saisie datée ; l'évaluation actuelle reste la plus récente
export function avecPoint(ancienne: (Evaluation & { historique?: PointSante[] }) | undefined, e: Evaluation): Evaluation & { historique: PointSante[] } {
  const c = caseDe(e)
  // L'évaluation en place entre dans l'historique si elle n'y figure pas encore (notes saisies avant l'historique daté)
  let base = ancienne?.historique ?? []
  if (ancienne?.date && !base.some((x) => x.date === ancienne.date)) base = ajouterPoint(base, { date: ancienne.date, caseId: caseDe(ancienne)?.id ?? '', notes: ancienne.notes })
  const historique = ajouterPoint(base, { date: e.date, caseId: c?.id ?? '', notes: e.notes })
  const plusRecente = ancienne && ancienne.date > e.date && historique.some((x) => x.date > e.date)
  return plusRecente ? { ...ancienne, historique } : { ...e, historique }
}

// Retire la saisie d'une date ; si c'était la plus récente, la saisie précédente redevient l'évaluation en place
export function sansPoint(e: (Evaluation & { historique?: PointSante[] }) | undefined, date: string): (Evaluation & { historique: PointSante[] }) | undefined {
  if (!e) return undefined
  const historique = unParJour(e.historique ?? []).filter((p) => p.date !== date)
  if (e.date !== date) return { ...e, historique }
  const avant = historique.filter((p) => p.notes).at(-1)
  return avant ? { notes: { ...avant.notes }, date: avant.date, par: e.par, historique } : undefined
}

// ── Déploiements : thématiques libres, chaque magasin a un état par thématique ──
export type Ton = 'positif' | 'partiel' | 'negatif'
export interface OptionDeploiement { libelle: string; ton: Ton }
export interface Thematique { id: string; libelle: string; options: OptionDeploiement[] }
export interface ChangementDeploiement { date: string; thematique: string; etat: string }
export interface Deploiements { thematiques: Thematique[]; valeurs: Record<string, Record<string, string>>; journal?: Record<string, ChangementDeploiement[]> }

// Même règle pour les déploiements : un seul changement par jour et par thématique, le dernier l'emporte
export function unChangementParJour(changements: ChangementDeploiement[]): ChangementDeploiement[] {
  return [...new Map(changements.map((c) => [`${c.date}|${c.thematique}`, c])).values()].sort((a, b) => a.date.localeCompare(b.date))
}

// Date depuis laquelle l'état d'une thématique est en place dans un magasin (vide si inconnue)
export function depuisDeploiement(d: Deploiements, magasin: string, thematique: string): string {
  const etat = d.valeurs[magasin]?.[thematique] ?? ''
  const h = unChangementParJour(d.journal?.[magasin] ?? []).filter((c) => c.thematique === thematique)
  if (!etat || h.at(-1)?.etat !== etat) return ''
  let i = h.length - 1
  while (i > 0 && h[i - 1].etat === etat) i--
  return h[i].date
}

const ouiNon: OptionDeploiement[] = [{ libelle: 'Oui', ton: 'positif' }, { libelle: 'Non', ton: 'negatif' }]
export const thematiquesParDefaut: Thematique[] = [
  { id: 'concept20', libelle: 'Concept 2.0', options: [{ libelle: 'Fait', ton: 'positif' }, { libelle: 'En cours', ton: 'partiel' }, { libelle: 'Non', ton: 'negatif' }] },
  { id: 'terrasse', libelle: 'Terrasse', options: ouiNon },
  { id: 'foodChaude', libelle: 'Offre food chaude', options: ouiNon },
  { id: 'offre5plus1', libelle: 'Offre 5+1', options: ouiNon },
  { id: 'epicerie', libelle: 'Épicerie fine', options: [{ libelle: 'Oui', ton: 'positif' }, { libelle: 'Partiellement', ton: 'partiel' }, { libelle: 'Non', ton: 'negatif' }] },
  { id: 'mixologie', libelle: 'Mixologie', options: [{ libelle: 'Oui', ton: 'positif' }, { libelle: 'Partiellement', ton: 'partiel' }, { libelle: 'Non', ton: 'negatif' }] },
]

export const couleurTon: Record<Ton, 'success' | 'warning' | 'error'> = { positif: 'success', partiel: 'warning', negatif: 'error' }

export function tonDe(t: Thematique, valeur: string | undefined): Ton | null {
  return t.options.find((o) => o.libelle === valeur)?.ton ?? null
}

export function avancement(reseau: Reseau, t: Thematique) {
  const actifs = reseau.magasins.filter((m) => m.statut !== 'avenir')
  const v = actifs.map((m) => tonDe(t, reseau.deploiements.valeurs[m.nom]?.[t.id]))
  return { total: actifs.length, positif: v.filter((x) => x === 'positif').length, partiel: v.filter((x) => x === 'partiel').length, negatif: v.filter((x) => x === 'negatif').length, inconnu: v.filter((x) => x === null).length }
}
