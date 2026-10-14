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

export interface Personne {
  nom: string
  telephone?: string
  email?: string
}

export interface ResponsableRegional extends Personne {
  id: string
  couleur: string
  integres: boolean // Responsable Magasins Intégrés (rôle transverse)
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
  plateforme: string
  telephone: string
  email: string
  coach: string
  rr: ResponsableRegional | null
  rrEnDirect: boolean
  responsable: Personne | null
  responsableARecruter: boolean // poste de responsable magasin en recrutement
  adjoint: Personne | null
  lat: number | null
  lon: number | null
  historiqueCoach: AffectationCoach[]
}

export interface Coach extends Personne {
  rr: ResponsableRegional | null
  fictif: boolean // poste prévu, Coach pas encore recruté
  arrivee: string // date d'arrivée prévue ou réelle (AAAA-MM-JJ), vide si inconnue
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
  rrs: ResponsableRegional[]
  parametres: ParametresReseau
  jour: string
  chargeLe: string
}
