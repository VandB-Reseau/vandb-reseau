// Modèle métier lisible, construit à partir des tables Supabase de l'ancienne app.

export type Statut = 'avenir' | 'preouverture' | 'nouveau' | 'ouvert'

export const statutLibelle: Record<Statut, string> = {
  avenir: 'À venir',
  preouverture: 'En pré-ouverture',
  nouveau: 'Nouvelle ouverture',
  ouvert: 'Ouvert',
}

export const statutAide: Record<Statut, string> = {
  avenir: 'Ouverture prévue, préparation pas encore commencée',
  preouverture: 'Dans les mois qui précèdent l’ouverture',
  nouveau: 'Ouvert depuis peu, accompagnement renforcé',
  ouvert: 'Magasin en activité courante',
}

// Libellé de la personne qui tient le magasin
export const libelleResponsable = (m: { franchise: boolean }) => (m.franchise ? 'Franchisé' : 'Responsable du magasin')

export interface Personne {
  nom: string
  telephone?: string
  email?: string
}

export interface ResponsableRegional extends Personne {
  id: string
  couleur: string
  integres: boolean // Responsable Magasins Intégrés (rôle transverse)
  naissance: string
  arrivee: string
}

export interface AffectationCoach {
  coach: string
  date: string
  note: string
}

export interface Magasin {
  nom: string
  code: string
  departement: string
  ville: string
  codePostal: string
  adresse: string
  pays: string // vide = France
  ouverture: string // AAAA-MM-JJ
  ouvertureConnue: boolean
  statut: Statut
  franchise: boolean
  telephone: string
  email: string
  coach: string
  rr: ResponsableRegional | null
  rrEnDirect: boolean
  responsable: Personne | null // franchisé (ou responsable d'un magasin intégré)
  responsableARecruter: boolean // franchisé recherché
  lat: number | null
  lon: number | null
  historiqueCoach: AffectationCoach[]
}

export interface Coach extends Personne {
  rr: ResponsableRegional | null
  fictif: boolean // poste prévu, Coach pas encore recruté
  arrivee: string // date d'arrivée prévue ou réelle (AAAA-MM-JJ), vide si inconnue
  naissance: string
  ville: string
  lat: number | null
  lon: number | null
  // Rattachements successifs au Responsable Régional
  historiqueRR: { rr: ResponsableRegional | null; date: string }[]
}

export interface ParametresReseau {
  prepDuration: number // mois de préparation avant ouverture
  postDuration: number // mois d'accompagnement renforcé après ouverture
  maxUnits: number // charge maximale d'un Coach
  alertThreshold: number // seuil d'attention
  poidsOuvert: number // unités pour un magasin ouvert
  poidsRenforce: number // unités pour un magasin en pré-ouverture ou ouvert depuis peu
}

export interface Reseau {
  magasins: Magasin[]
  coachs: Record<string, Personne>
  equipe: Coach[] // Coachs pilotant des magasins (hors techniciens)
  techniciens: Personne[]
  directeur: Personne & { titre: string; naissance?: string; arrivee?: string }
  personnes: Record<string, Partial<import('./personnes').FichePersonnelle>>
  visites: Visite[]
  conges: Conge[]
  evenements: Evenement[]
  anniversaires: Anniversaire[]
  evaluations: import('./sante').Evaluations
  deploiements: import('./sante').Deploiements
  rrs: ResponsableRegional[]
  parametres: ParametresReseau
  jour: string
  chargeLe: string
}

export type TypeVisite = 'terrain' | 'hygiene' | 'excellence' | 'ouverture'
export const typesVisite: { id: TypeVisite; libelle: string; couleur: string }[] = [
  { id: 'terrain', libelle: 'Visite terrain', couleur: '#1b6fce' },
  { id: 'hygiene', libelle: 'Audit hygiène', couleur: '#0f766e' },
  { id: 'excellence', libelle: 'Audit excellence', couleur: '#b7791f' },
  { id: 'ouverture', libelle: 'Accompagnement ouverture', couleur: '#ef7d00' },
]
export const libelleTypeVisite = (t: string) => typesVisite.find((x) => x.id === t)?.libelle ?? 'Visite'

export interface Document { label: string; url: string }

export interface Visite {
  id: number | null
  groupe: string // même valeur pour une tournée de plusieurs magasins saisie en une fois
  magasin: string
  date: string
  type: string
  visiteur: string
  signatureRequise: boolean
  lienSigne: string
  dateSignature: string
  documents: Document[]
  notes: string
}

export interface Conge { id: number | null; personne: string; role: string; debut: string; fin: string; notes: string }
export interface Evenement { id: number | null; titre: string; type: string; debut: string; fin: string; notes: string; couleur: string }
export interface Anniversaire { nom: string; role: string; date: string; nature: 'naissance' | 'arrivee' }
