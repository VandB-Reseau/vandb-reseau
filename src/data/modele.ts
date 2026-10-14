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
  adjoint: Personne | null
  lat: number | null
  lon: number | null
  historiqueCoach: AffectationCoach[]
}

export interface Reseau {
  magasins: Magasin[]
  coachs: Record<string, Personne>
  rrs: ResponsableRegional[]
  chargeLe: string
}
