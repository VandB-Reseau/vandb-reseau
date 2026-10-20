import type { Photo } from './grilles'

// Bonnes pratiques remontées du terrain (app_config, clé bonnes_pratiques)
export interface BonnePratique {
  id: string
  magasin: string
  date: string
  titre: string
  theme: string
  texte: string
  par: string // personne qui l'a remontée
  photos: Photo[]
  reprises: string[] // magasins qui l'appliquent depuis
  jaime: string[] // personnes de l'équipe qui ont réagi
}

export const themesPratiques = ['Vente et conseil', 'Vente additionnelle', 'Fidélité', 'Vitrine et merchandising', 'Bar', 'Offre food', 'Animation et événements', 'Équipe', 'Gestion']

export function normaliserPratiques(brut: unknown): BonnePratique[] {
  if (!Array.isArray(brut)) return []
  const t = (v: unknown) => (typeof v === 'string' ? v : '')
  return brut.filter((x) => x && typeof x === 'object').map((x: Record<string, unknown>) => ({
    id: t(x.id), magasin: t(x.magasin), date: t(x.date), titre: t(x.titre), theme: t(x.theme), texte: t(x.texte), par: t(x.par),
    photos: Array.isArray(x.photos) ? (x.photos as Photo[]) : [],
    reprises: Array.isArray(x.reprises) ? (x.reprises as unknown[]).map(t).filter(Boolean) : [],
    jaime: Array.isArray(x.jaime) ? [...new Set((x.jaime as unknown[]).map(t).filter(Boolean))] : [],
  })).filter((x) => x.id && x.titre).sort((a, b) => b.date.localeCompare(a.date))
}

export const themesConnus = (liste: BonnePratique[]) => [...new Set([...themesPratiques, ...liste.map((p) => p.theme).filter(Boolean)])]
