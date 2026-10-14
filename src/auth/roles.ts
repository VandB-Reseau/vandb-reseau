// Rôles prévus dès maintenant pour ouvrir l'accès plus tard sans refonte.
// Aujourd'hui seul le Directeur de réseau (Joseph) a un compte.
export type Role = 'directeur' | 'rr' | 'coach'

export interface Profil {
  id: string
  email: string
  nom: string
  role: Role
  // Périmètre : vide = tout le réseau ; sinon identifiants RR / Coach couverts
  perimetre: { rr?: string[]; coachs?: string[] }
}

export const roleLibelle: Record<Role, string> = {
  directeur: 'Directeur de réseau',
  rr: 'Responsable Régional',
  coach: 'Coach',
}
