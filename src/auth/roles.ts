// Rôles des comptes. Le Directeur de réseau, les Responsables Régionaux et les Coachs forment l'équipe ;
// un franchisé ne voit que ses magasins ; « aucun » : compte créé mais pas encore ouvert.
// « direction » (24/11/2026) : un DG ou un autre accès donné par le Directeur, lit tout le réseau comme lui, n'écrit
// que dans le carnet des magasins (migrations réseau 0054 et pilotage 0038).
export type Role = 'directeur' | 'rr' | 'coach' | 'franchise' | 'aucun' | 'direction'

export interface Profil {
  id: string
  email: string
  nom: string
  role: Role
  // Périmètre : vide = tout le réseau ; sinon identifiants RR / Coach couverts, ou franchisé et ses magasins
  perimetre: { rr?: string[]; coachs?: string[]; franchise?: string; magasins?: string[] }
}

export const roleLibelle: Record<Role, string> = {
  directeur: 'Directeur de réseau',
  rr: 'Responsable Régional',
  coach: 'Coach',
  franchise: 'Franchisé',
  aucun: 'Accès non ouvert',
  direction: 'Direction',
}

export const estEquipe = (p: Profil | null) => !!p && ['directeur', 'rr', 'coach', 'direction'].includes(p.role)
// Compte Direction : lecture de tout le réseau, écriture dans le carnet seulement
export const estDirection = (p: Profil | null) => p?.role === 'direction'
