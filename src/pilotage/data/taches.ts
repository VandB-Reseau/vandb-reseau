// Une seule liste de tâches (fusion, Joseph 04/11/2026, option « Tâche réseau avec la mesure ») : une alerte du budget crée
// une tâche du réseau (rubrique « actions » du suivi des magasins) qui garde son type, son responsable et sa valeur de départ
// pour mesurer l'effet. Les anciennes actions du pilotage sont reprises par la migration 0039, puis ne sont plus écrites.
import { enregistrerActionLibre, lireActionsLibres, marquerActions, supprimerActionLibre } from '../../data/chargement'
import { clesDesPorteurs, porteursDu } from '../../data/actions'
import { chargerEspaceFranchise, marquerActionFranchise } from '../../data/espaceFranchise'
import type { ActionLibre, Reseau } from '../../data/modele'
import { notifierTache } from '../../lib/notifications'
import { dansApercu } from '../lib/apercu'

// Réseau du compte, posé par la zone du budget quand elle est dans l'app (fiche, menu Budgets) ; absent pour le contrôle de gestion
export interface PontReseau { reseau: Reseau | null; franchise: boolean; mesCles: string[]; nom: string; recharger: (() => Promise<void>) | null }
export const pont: { courant: PontReseau | null } = { courant: null }

const aujourdhui = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const rafraichirReseau = () => { void pont.courant?.recharger?.().catch(() => undefined) }

// Tâches de tous les magasins lisibles par le compte ; le franchisé passe par son espace (il ne lit aucune table du réseau)
export async function lireTaches(): Promise<Record<string, ActionLibre[]>> {
  if (pont.courant?.franchise) return (await chargerEspaceFranchise(null)).actionsLibres ?? {}
  return lireActionsLibres()
}

// Porteur de la tâche : la personne qui tient ce rôle sur le magasin (franchisé, Coach, RR, Directeur)
export function porteurPour(magasin: string, responsable: string): string {
  const r = pont.courant?.reseau
  if (!r) return ''
  const l = porteursDu(r, magasin)
  const role = { coach: 'Coach', rr: 'Responsable Régional', directeur: 'Directeur de réseau' }[responsable]
  const p = role ? l.find((x) => x.role === role) : l.find((x) => !['Coach', 'Responsable Régional', 'Responsable des magasins intégrés', 'Directeur de réseau'].includes(x.role))
  return p?.nom ?? ''
}

export interface NouvelleTache { magasin: string; intitule: string; echeance: string | null; budget: NonNullable<ActionLibre['budget']> }
export async function creerTache(t: NouvelleTache) {
  if (dansApercu()) throw new Error('apercu')
  const porteur = porteurPour(t.magasin, t.budget.responsable)
  const id = await enregistrerActionLibre(t.magasin, {
    action: t.intitule.trim(), porteur, echeance: t.echeance ?? '', creeLe: aujourdhui(),
    ...(pont.courant?.nom ? { auteur: pont.courant.nom } : {}), budget: t.budget,
  })
  const r = pont.courant?.reseau
  if (r && porteur) notifierTache(t.magasin, id, clesDesPorteurs(r, t.magasin, [porteur]).filter((c) => !pont.courant!.mesCles.includes(c)))
  rafraichirReseau()
}

// Faite, rouverte ou abandonnée (abandonnée = fermée avec la mention) ; le franchisé ne fait que cocher ou décocher
export async function changerStatutTache(magasin: string, id: string, statut: 'a_faire' | 'faite' | 'abandonnee') {
  if (dansApercu()) throw new Error('apercu')
  if (pont.courant?.franchise) {
    await marquerActionFranchise(magasin, statut !== 'a_faire', { libre: id })
  } else {
    const t = (await lireActionsLibres())[magasin]?.find((x) => x.id === id)
    if (!t) throw new Error('tache_introuvable')
    const budget = t.budget ? { ...t.budget } : undefined
    if (budget) { if (statut === 'abandonnee') budget.abandonnee = true; else delete budget.abandonnee }
    if (budget && (budget.abandonnee ?? false) !== (t.budget?.abandonnee ?? false)) await enregistrerActionLibre(magasin, { ...t, budget })
    await marquerActions([{ libre: id, magasin, faite: statut === 'a_faire' ? '' : aujourdhui() }], pont.courant?.nom ?? '')
  }
  rafraichirReseau()
}

export async function retirerTache(magasin: string, id: string) {
  if (dansApercu()) throw new Error('apercu')
  await supprimerActionLibre(magasin, id)
  rafraichirReseau()
}
