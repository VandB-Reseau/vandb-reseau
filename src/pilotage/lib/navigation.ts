// Navigation en trois espaces (lot 36, Joseph 02/11/2026). Chaque partie de la fiche d'un magasin a son adresse :
// #/magasins/<nom>/<partie>. Depuis le 03/11/2026, ces espaces sont des onglets de la fiche du magasin.
// Joseph (03/11/2026, option A de la maquette de navigation) : trois onglets seulement, dans l'ordre d'usage :
// « Suivi <année> » (une seule page), « Budget <année suivante> » (les étapes en frise), « Saisies » (ce qui entre).
// À la fusion avec l'app réseau, le Suivi rejoindra « Chiffres et santé » et le Budget deviendra un onglet de sa fiche.
import { anneeSuivi } from '../data/annees'
export type Espace = 'donnees' | 'budget' | 'suivi'

export interface Partie { cle: string; libelle: string }

export const ESPACES: { cle: Espace; libelle: string }[] = [
  { cle: 'suivi', libelle: 'Suivi' },
  { cle: 'budget', libelle: 'Budget' },
  { cle: 'donnees', libelle: 'Saisies' },
]
// Libellé affiché de l'onglet : l'année suivie, l'année du budget
export function libelleEspace(cle: Espace, anneeEnCours: number, anneeBudget: number) {
  return cle === 'suivi' ? `Suivi ${anneeEnCours}` : cle === 'budget' ? `Budget ${anneeBudget}` : 'Saisies'
}

export function partiesDe(espace: Espace, annee: number = anneeSuivi()): Partie[] {
  if (espace === 'donnees') {
    return [
      // Refonte vague 2 (Joseph, 09/11/2026, 12A) : la clôture du mois guide les saisies
      { cle: 'cloture', libelle: 'Clôture du mois' },
      { cle: 'reel', libelle: 'Réel du mois' },
      // Option A (03/11/2026) : la saisie du stock rejoint les autres saisies ; sa lecture reste dans le Suivi
      { cle: 'saisieStock', libelle: 'Stock de fin de mois' },
      { cle: 'quadrimestres', libelle: 'Comptes du quadrimestre' },
      { cle: 'frais', libelle: `Frais ${annee}` },
    ]
  }
  if (espace === 'budget') {
    return [
      // Joseph (03/11/2026) : trois étapes ; le point de départ devient une carte de « Construire », le résultat et la
      // trésorerie ont leur page
      { cle: 'budget', libelle: '1 · Construire' },
      { cle: 'visualiser', libelle: '2 · Visualiser' },
      { cle: 'echanges', libelle: '3 · Envoyer et valider' },
    ]
  }
  // Joseph (09/11/2026) : le Suivi ne se déroule plus sur une seule page ; chaque partie a sa puce, comme les saisies
  return PARTIES_SUIVI(annee)
}

// Parties du Suivi, dans l'ordre de lecture : la vue d'ensemble d'abord, l'analyse (graphique, leviers, réseau) en dernier
export const PARTIES_SUIVI = (annee: number = anneeSuivi()): Partie[] => [
  { cle: 'synthese', libelle: 'Vue d’ensemble' },
  { cle: 'mois', libelle: 'Mois par mois' },
  { cle: 'comptes', libelle: 'Comptes et trésorerie' },
  { cle: 'atterrissage', libelle: `Atterrissage ${annee}` },
  { cle: 'stock', libelle: 'Stock' },
  { cle: 'analyse', libelle: 'Analyse' },
  // Choix 125 (Joseph, 13/11/2026) : les simulateurs du franchisé, ouverts aussi par le Coach pendant la visite.
  // Dans la fiche du magasin, ils ont leur onglet (Joseph, 14/11/2026) et sortent des puces de Chiffres.
  { cle: 'simulateurs', libelle: 'Simulateurs' },
]
// « sante » : santé, leviers et chiffres du réseau, rangés avec le suivi dans l'onglet Chiffres de la fiche (refonte, 3A)
const CLES_SUIVI = ['synthese', 'mois', 'comptes', 'atterrissage', 'stock', 'analyse', 'simulateurs', 'passees', 'sante']


// Lot 37 (Joseph, 02/11/2026) : les hypothèses du budget se lisent en cartes par thème ; chaque carte ouvre un tableau
// court du thème. Ces thèmes ont leur adresse mais restent sous l'étape « 1 · Hypothèses ».
// Lot 42 : les ventes et le résultat sont sur la page « Construire » ; restent en détail les thèmes ci-dessous.
// Joseph (03/11/2026) : les ventes aussi, ouvertes depuis les cartes des univers
// Joseph (03/11/2026) : le point de départ en carte, le Calendrier devient « Évènements & Temps forts », les travaux
// passent dans « Investissements & Financements »
export const THEMES: Partie[] = [
  { cle: 'depart', libelle: 'Point de départ' },
  { cle: 'ventes', libelle: 'Ventes et marge' },
  { cle: 'calendrier', libelle: 'Évènements & Temps forts' },
  { cle: 'investissements', libelle: 'Investissements & Financements' },
  { cle: 'equipe', libelle: 'Équipe' },
  { cle: 'fraisBudget', libelle: 'Frais' },
]
const CLES_THEMES = THEMES.map((t) => t.cle)
export const estTheme = (cle: string) => CLES_THEMES.includes(cle)
// Étape ou partie du menu à mettre en avant pour une partie (un thème : l'étape des hypothèses)
export const etapeDe = (cle: string) => (estTheme(cle) ? 'budget' : cle)

// Refonte vague 2 (12A) : les saisies s'ouvrent sur la clôture du mois
export const PARTIE_PAR_DEFAUT: Record<Espace, string> = { donnees: 'cloture', budget: 'budget', suivi: 'synthese' }

// Anciennes clés (liens, alertes, « à faire ») : la partie qui les montre désormais, et la section où défiler
// Lot 43 : l'ancien thème « Trésorerie » du budget est au point de départ ; le résultat a sa page (03/11/2026)
// Joseph (09/11/2026) : l'atterrissage et le stock ont leur puce, la trésorerie est avec les comptes ; le plan d'action est
// dans les tâches du magasin
const ANCIENNES: Record<string, string> = { tresorerie: 'comptes', tresoBudget: 'depart', plan: 'synthese', suivi: 'synthese', resultat: 'visualiser', travaux: 'investissements' }
export const partieDe = (cle: string) => ANCIENNES[cle] ?? cle
export const sectionDe = (cle: string) => (ANCIENNES[cle] && !['travaux', 'tresorerie', 'plan', 'suivi'].includes(cle) ? cle : null)

const DONNEES = ['cloture', 'reel', 'saisieStock', 'quadrimestres', 'frais']
const BUDGET = ['budget', 'visualiser', 'echanges', ...CLES_THEMES]
export function espaceDe(cle: string): Espace {
  const p = partieDe(cle)
  return DONNEES.includes(p) ? 'donnees' : BUDGET.includes(p) ? 'budget' : 'suivi'
}
export const partieConnue = (cle: string) => [...DONNEES, ...BUDGET, ...CLES_SUIVI].includes(partieDe(cle))

// Magasin et partie lus dans l'adresse
export function magasinDeChemin(chemin: string): { nom: string; partie: string | null } | null {
  const m = /^\/magasins\/([^/]+)(?:\/([^/]+))?/.exec(chemin)
  if (!m) return null
  return { nom: decodeURIComponent(m[1]), partie: m[2] ? decodeURIComponent(m[2]) : null }
}
