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

export function telLien(tel: string): string {
  return `tel:${tel.replace(/[^\d+]/g, '')}`
}
