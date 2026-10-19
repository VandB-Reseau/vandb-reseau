// Rôles des comptes. Le Directeur de réseau, les Responsables Régionaux et les Coachs forment l'équipe ;
// un franchisé ne voit que ses magasins ; « aucun » : compte créé mais pas encore ouvert.
export type Role = 'directeur' | 'rr' | 'coach' | 'franchise' | 'aucun'

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
}

export const estEquipe = (p: Profil | null) => !!p && ['directeur', 'rr', 'coach'].includes(p.role)
