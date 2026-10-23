// Modèle métier lisible, construit à partir des tables Supabase de l'ancienne app.
import type { Piece } from '../lib/pieces'

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

// Forme du blason de ville (charte V and B) : ville littorale, de montagne ou dans les terres
export type Topographie = 'littoral' | 'montagne' | 'terres'
// Figure au centre du blason : un élément local (voir src/components/FiguresBlason.tsx)
export type Figure = 'voile' | 'phare' | 'ancre' | 'poisson' | 'coquillage' | 'hermine' | 'sommet' | 'sapin' | 'epi' | 'feuille'
  | 'arbre' | 'clocher' | 'chateau' | 'beffroi' | 'pont' | 'soleil' | 'lavande' | 'olivier' | 'etoile' | 'fleur'

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
  positionApprochee: boolean // posé au centre de son département (import Excel) ou jamais trouvé : à géolocaliser
  topographie: Topographie | '' // forme du blason de ville, choisie dans la fiche ; vide = déduite du département
  figure: Figure | '' // figure au centre du blason, choisie dans la fiche ; vide = proposée selon le département
  historiqueCoach: AffectationCoach[]
}

export interface Coach extends Personne {
  rr: ResponsableRegional | null
  fictif: boolean // poste prévu, Coach pas encore recruté
  couleur: string // couleur de sa zone sur la carte (même que dans l'ancienne app)
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
  maxTourneeHeures: number // durée de tournée au-delà de laquelle l'app propose de soulager un Coach
  maxCoachsRR: number // nombre de Coachs au-delà duquel un Responsable Régional est surchargé
}

export interface Reseau {
  magasins: Magasin[]
  coachs: Record<string, Personne>
  equipe: Coach[] // Coachs pilotant des magasins (hors techniciens)
  techniciens: Personne[]
  directeur: Personne & { titre: string; naissance?: string; arrivee?: string }
  personnes: Record<string, Partial<import('./personnes').FichePersonnelle>>
  visites: Visite[]
  evenements: Evenement[]
  anniversaires: Anniversaire[]
  evaluations: import('./sante').Evaluations
  grilleNineBox: import('./sante').GrilleNineBox
  notesMagasins: Record<string, NoteMagasin[]>
  preparations: Record<string, PreparationVisite> // notes de la prochaine visite, par magasin (jamais montrées au franchisé)
  deploiements: import('./sante').Deploiements
  chiffres: Record<string, import('./chiffres').ChiffreMois[]> // par magasin, du plus ancien au plus récent
  audits: import('./chiffres').Audits
  grilles: import('./grilles').Grilles
  pratiques: import('./bonnesPratiques').BonnePratique[]
  campagnes: import('./campagnes').Campagnes
  associes: import('./associes').Associes // par magasin
  actionsLibres: Record<string, ActionLibre[]> // par magasin
  derniereSauvegarde: string // date de la dernière sauvegarde complète téléchargée
  seuils: import('./chiffres').SeuilsAlerte
  delaisVisite: Record<string, number> // jours sans visite avant l'alerte, par case de la nine box
  rrs: ResponsableRegional[]
  parametres: ParametresReseau
  jour: string
  chargeLe: string
  espace?: import('./espaceFranchise').EspaceFranchise // espace d'un franchisé : ses magasins seulement
}

export type TypeVisite = 'terrain' | 'hygiene' | 'excellence' | 'ouverture' | 'feuille' | 'appel' | 'point'
export const typesVisite: { id: TypeVisite; libelle: string; couleur: string }[] = [
  { id: 'terrain', libelle: 'Visite terrain', couleur: '#307672' },
  { id: 'hygiene', libelle: 'Audit hygiène', couleur: '#3a8f8d' },
  { id: 'excellence', libelle: 'Audit excellence', couleur: '#f8bb09' },
  { id: 'ouverture', libelle: 'Accompagnement ouverture', couleur: '#ea6029' },
  // Revue budgétaire avec le franchisé : hors rythme de visite
  { id: 'feuille', libelle: 'Feuille de route', couleur: '#312e2e' },
  // Contacts sans visite : ne comptent pas dans le rythme de visite
  { id: 'appel', libelle: 'Appel', couleur: '#1d1d1b' },
  { id: 'point', libelle: 'Point chiffre', couleur: '#c24119' },
]
// Plusieurs participants enregistrés dans la colonne visitor, séparés par une virgule
export const SEPARATEUR_VISITEURS = ', '
export const lireVisiteurs = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
export const nomsVisiteurs = (v: { visiteurs: string[] }) => v.visiteurs.join(', ')
export const libelleTypeVisite = (t: string) => typesVisite.find((x) => x.id === t)?.libelle ?? 'Visite'

export interface Document { label: string; url: string }
// echeance : AAAA-MM-JJ (texte libre pour les plans saisis avant) ; faite : date de réalisation, vide tant qu'elle est en cours
// faitePar : qui l'a cochée faite ; pieces : photos et fichiers joints
export interface ActionPlan { id?: string; action: string; porteur: string; echeance: string; faite?: string; faitePar?: string; pieces?: Piece[] }
// Action ajoutée hors visite, sur un magasin (app_config, clé actions, par magasin)
// fil : tâche née dans « Équipe seule » (sa carte s'affiche dans ce fil) ; message : message d'où elle vient
export interface ActionLibre extends ActionPlan { id: string; creeLe: string; auteur?: string; fil?: 'equipe'; message?: number }

export interface Visite {
  id: number | null
  groupe: string // même valeur pour une tournée de plusieurs magasins saisie en une fois
  magasin: string
  date: string
  type: string
  visiteurs: string[] // participants : Coachs, RR, Directeur
  signatureRequise: boolean
  lienSigne: string
  dateSignature: string
  documents: Document[]
  notes: string
  parties: string[] // parties du compte rendu (PARTIES), vides si non abordées
  plan: ActionPlan[]
  photos?: import('./grilles').Photo[] // rangées dans la colonne docs avec un chemin d'espace photos
  creeLe?: string // date d'enregistrement (nouveautés de l'espace franchisé)
  prevue?: boolean // planifiée, pas encore faite : ni compte rendu ni « Faite » (0017)
}

// Visite faite à ce jour : une visite planifiée ne compte qu'une fois confirmée
export const visiteFaite = (v: Visite, jour: string) => v.date <= jour && !v.prevue

export interface NoteMagasin { id: string; date: string; texte: string; par: string }
export interface PreparationVisite { notes: string; heure: string; par: string; maj: string }

// invites : magasins invités à une réunion ou une formation (script 0025_reunions.sql) ; absent = événement sans invités
// type : event, reunion ou formation ; heure (HH:MM, heure de Paris) et html (contenu mis en forme) : script 0030_animation_reseau.sql
export type TypeEvenement = 'event' | 'reunion' | 'formation'
export interface Evenement { id: number | null; titre: string; type: string; debut: string; fin: string; notes: string; couleur: string; invites?: string[]; heure?: string; html?: string }
export const libellesTypeEvenement: Record<TypeEvenement, string> = { event: 'Événement', reunion: 'Réunion', formation: 'Formation' }
// Un événement qui invite des magasins est une réunion, sauf s'il est noté formation
export const typeEvenement = (e: Pick<Evenement, 'type' | 'invites'>): TypeEvenement => (e.type === 'formation' ? 'formation' : e.type === 'reunion' || e.invites?.length ? 'reunion' : 'event')
export interface Anniversaire { nom: string; role: string; date: string; nature: 'naissance' | 'arrivee' }
