import type { Reseau } from './modele'

// Santé du parc : six critères notés à la main (pas encore de lien avec la BI), de 1 (faible) à 3 (fort)
export type Note = 1 | 2 | 3
export const criteresResultats = [
  { id: 'caExterieur', libelle: 'CA marché extérieur' },
  { id: 'panierCave', libelle: 'Panier moyen cave' },
  { id: 'panierBar', libelle: 'Panier moyen bar' },
  { id: 'fluxCave', libelle: 'Flux cave' },
  { id: 'fluxBar', libelle: 'Flux bar' },
] as const
export const critereManagement = { id: 'franchise', libelle: 'Niveau du franchisé (management, gestion)' } as const
export const tousCriteres = [...criteresResultats, critereManagement]
export type IdCritere = (typeof tousCriteres)[number]['id']

export const libelleNote: Record<Note, string> = { 1: 'Faible', 2: 'Moyen', 3: 'Fort' }

export interface Evaluation { notes: Partial<Record<IdCritere, Note>>; date: string; par: string }
export type Evaluations = Record<string, Evaluation & { historique?: { date: string; caseId: string }[] }>

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

const niveau = (moyenne: number): 1 | 2 | 3 => (moyenne < 1.67 ? 1 : moyenne < 2.34 ? 2 : 3)

export function scoreResultats(e: Evaluation | undefined): number | null {
  const n = criteresResultats.map((c) => e?.notes[c.id]).filter((x): x is Note => !!x)
  return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null
}

// Case de la nine box : il faut au moins un critère de résultat et la note du franchisé
export function caseDe(e: Evaluation | undefined): CaseNineBox | null {
  const r = scoreResultats(e)
  const m = e?.notes.franchise
  if (r === null || !m) return null
  return nineBox.find((c) => c.resultats === niveau(r) && c.management === m) ?? null
}

// ── Déploiements : thématiques libres, chaque magasin a un état par thématique ──
export type Ton = 'positif' | 'partiel' | 'negatif'
export interface OptionDeploiement { libelle: string; ton: Ton }
export interface Thematique { id: string; libelle: string; options: OptionDeploiement[] }
export interface Deploiements { thematiques: Thematique[]; valeurs: Record<string, Record<string, string>> }

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
