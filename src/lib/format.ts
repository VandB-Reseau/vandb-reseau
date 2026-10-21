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
// Instant ISO en heure locale : « 21/10 à 14h32 »
export function dateHeure(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const deux = (n: number) => String(n).padStart(2, '0')
  return `${deux(d.getDate())}/${deux(d.getMonth() + 1)} à ${d.getHours()}h${deux(d.getMinutes())}`
}
