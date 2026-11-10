// Les 6 premiers mois d'un nouveau magasin (refonte vague 5, Joseph 10/11/2026, 50A) : à l'ouverture, l'app déroule un
// parcours d'intégration. Ses étapes se règlent dans Paramètres par le Directeur (clé « parcours_integration »
// d'app_config, demande de Joseph du 10/11/2026 9h49) ; chaque étape a un jour (J+N après l'ouverture) et un
// responsable. Le suivi est rangé par magasin (rubrique « integration » de suivi_magasins, 0044) : étape → faite le, par.
// Le franchisé voit son parcours sur son accueil ; l'équipe coche les étapes sur la fiche du magasin.
import type { Magasin, Reseau } from './modele'

export type ResponsableEtape = 'coach' | 'rr' | 'directeur' | 'franchise'
export const libellesResponsable: Record<ResponsableEtape, string> = { coach: 'Coach', rr: 'Responsable Régional', directeur: 'Directeur de réseau', franchise: 'Franchisé' }
export interface EtapeParcours { id: string; libelle: string; jour: number; responsable: ResponsableEtape }
export interface EtapeFaite { faite: string; par: string }
export interface SuiviIntegration { etapes: Record<string, EtapeFaite> }

export const DUREE_PARCOURS = 180
// Parcours proposé tant que le Directeur n'a rien réglé
export const parcoursParDefaut: EtapeParcours[] = [
  { id: 'v7', libelle: 'Visite de la première semaine', jour: 7, responsable: 'coach' },
  { id: 'f15', libelle: 'Formation de l’équipe à la vente additionnelle', jour: 15, responsable: 'coach' },
  { id: 'v30', libelle: 'Visite du premier mois', jour: 30, responsable: 'coach' },
  { id: 'c35', libelle: 'Première clôture du mois', jour: 35, responsable: 'franchise' },
  { id: 'v60', libelle: 'Visite du deuxième mois', jour: 60, responsable: 'coach' },
  { id: 'e90', libelle: 'Entretien avec le Responsable Régional', jour: 90, responsable: 'rr' },
  { id: 'v90', libelle: 'Visite du troisième mois', jour: 90, responsable: 'coach' },
  { id: 'b120', libelle: 'Premier budget relu ensemble', jour: 120, responsable: 'franchise' },
  { id: 'v180', libelle: 'Bilan des 6 mois et première nine box', jour: 180, responsable: 'rr' },
]

const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
export function normaliserParcours(v: unknown): EtapeParcours[] {
  if (!Array.isArray(v)) return parcoursParDefaut
  return v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object').map((x) => {
    const jour = Math.round(Number(x.jour))
    return { id: texte(x.id, 60), libelle: texte(x.libelle, 120), jour: Number.isFinite(jour) ? Math.min(365, Math.max(0, jour)) : 0,
      responsable: (['coach', 'rr', 'directeur', 'franchise'].includes(String(x.responsable)) ? x.responsable : 'coach') as ResponsableEtape }
  }).filter((e) => e.id && e.libelle).sort((a, b) => a.jour - b.jour)
}

export function normaliserIntegration(v: unknown): Record<string, SuiviIntegration> {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
  return Object.fromEntries(Object.entries(o).map(([m, x]) => {
    const etapes = x && typeof x === 'object' ? (x as { etapes?: unknown }).etapes : null
    const e = etapes && typeof etapes === 'object' ? etapes as Record<string, unknown> : {}
    return [m, { etapes: Object.fromEntries(Object.entries(e).filter(([, f]) => f && typeof f === 'object' && typeof (f as EtapeFaite).faite === 'string')
      .map(([id, f]) => [id, { faite: (f as EtapeFaite).faite.slice(0, 10), par: texte((f as EtapeFaite).par, 80) }])) }]
  }))
}

const decaler = (jour: string, n: number) => new Date(Date.parse(`${jour}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const ecartJours = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000)

// Un magasin est en intégration de son ouverture à J+180 (avec un mois de grâce pour finir le bilan)
export function enIntegration(m: Magasin, jour: string): boolean {
  if (!m.ouverture || m.ouverture > jour || m.statut === 'avenir') return false
  return ecartJours(m.ouverture, jour) <= DUREE_PARCOURS + 30
}

export type EtatEtape = 'faite' | 'retard' | 'bientot' | 'avenir'
export interface EtapeDuMagasin { e: EtapeParcours; echeance: string; etat: EtatEtape; faite?: EtapeFaite }
export interface ParcoursDuMagasin { m: Magasin; jourParcours: number; etapes: EtapeDuMagasin[]; faites: number }

export function parcoursDu(reseau: Reseau, m: Magasin): ParcoursDuMagasin | null {
  if (!enIntegration(m, reseau.jour)) return null
  const modele = reseau.parcoursIntegration ?? parcoursParDefaut
  if (!modele.length) return null
  const suivi = reseau.integration?.[m.nom]?.etapes ?? {}
  const etapes = modele.map((e) => {
    const echeance = decaler(m.ouverture, e.jour)
    const faite = suivi[e.id]
    const etat: EtatEtape = faite ? 'faite' : echeance < reseau.jour ? 'retard' : echeance <= decaler(reseau.jour, 7) ? 'bientot' : 'avenir'
    return { e, echeance, etat, ...(faite ? { faite } : {}) }
  })
  return { m, jourParcours: ecartJours(m.ouverture, reseau.jour), etapes, faites: etapes.filter((x) => x.etat === 'faite').length }
}

export const libellesEtat: Record<EtatEtape, string> = { faite: 'Faite', retard: 'En retard', bientot: 'Cette semaine', avenir: 'À venir' }
