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
export const lienBilan = (nom: string) => `${lienFiche(nom)}/bilan`

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

// Date relative (refonte vague 4, Joseph 10/11/2026, 41A) : « aujourd’hui », « hier », « il y a 3 j » jusqu'à 7 jours,
// « demain », « dans 3 j » ; au-delà « 2 oct. », l'année seulement si ce n'est pas l'année du jour. jour : AAAA-MM-JJ.
export function dateRelative(iso: string, jour: string): string {
  const j = iso.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(j)) return ''
  const ecart = Math.round((Date.parse(`${j}T12:00:00Z`) - Date.parse(`${jour}T12:00:00Z`)) / 86_400_000)
  if (ecart === 0) return 'aujourd’hui'
  if (ecart === -1) return 'hier'
  if (ecart === 1) return 'demain'
  if (ecart < 0 && ecart >= -7) return `il y a ${-ecart} j`
  if (ecart > 0 && ecart <= 7) return `dans ${ecart} j`
  const [a, m, d] = j.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(j.slice(0, 4) !== jour.slice(0, 4) ? { year: 'numeric' } : {}) })
}
