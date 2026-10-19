export function dateLongue(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function dateCourte(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function lienFiche(nom: string): string {
  return `/magasins/${encodeURIComponent(nom)}`
}
export const lienPreparation = (nom: string) => `${lienFiche(nom)}/preparer`

export function telLien(tel: string): string {
  return `tel:${tel.replace(/[^\d+]/g, '')}`
}

export function lienCoach(nom: string): string {
  return `/equipe/coach/${encodeURIComponent(nom)}`
}

export const lienRR = (id: string) => `/equipe/rr/${encodeURIComponent(id)}`
export const lienDirecteur = () => '/equipe/directeur'
export const lienFranchise = (nom: string) => `/equipe/franchise/${encodeURIComponent(nom)}`
