// Équipements du magasin (Joseph, 14/11/2026) : le matériel acheté et mis à disposition, surtout pour le marché
// extérieur (tireuses, barnums, stands, camion frigorifique, chariot…), appelé à grossir avec lui. Une liste par
// magasin, rubrique « equipements » de suivi_magasins (0046) ; l'équipe la tient, le franchisé ne la voit pas.
// Le nombre de tireuses préremplit le simulateur du parc de tireuses.
import type { Reseau } from './modele'

export const categoriesEquipement = [
  ['tireuse', 'Tireuse'],
  ['froid', 'Groupe froid ou refroidisseur de fûts'],
  ['barnum', 'Barnum ou tente'],
  ['stand', 'Stand ou comptoir mobile'],
  ['mobilier', 'Mange-debout et mobilier'],
  ['camion', 'Camion frigorifique'],
  ['remorque', 'Remorque'],
  ['manutention', 'Chariot élévateur, gerbeur ou transpalette'],
  ['electricite', 'Groupe électrogène et rallonges'],
  ['glacieres', 'Glacières et bacs à glace'],
  ['paiement', 'Terminal de paiement mobile'],
  ['signaletique', 'Signalétique (oriflammes, kakémonos)'],
  ['verres', 'Verres réutilisables'],
  ['autre', 'Autre'],
] as const
export type CategorieEquipement = (typeof categoriesEquipement)[number][0]
export const libelleCategorie = (c: CategorieEquipement) => categoriesEquipement.find(([k]) => k === c)?.[1] ?? 'Autre'

export interface Equipement {
  id: string
  categorie: CategorieEquipement
  precision: string // marque, modèle, nombre de becs…
  quantite: number
  annee: number | null // année d'achat
  valeur: number | null // prix d'achat HT de l'ensemble de la ligne
  note: string
  par: string
  le: string // AAAA-MM-JJ
}

const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const nombre = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function normaliserEquipements(v: unknown): Record<string, Equipement[]> {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
  const cles = new Set<string>(categoriesEquipement.map(([k]) => k))
  return Object.fromEntries(Object.entries(o).map(([m, liste]) => [m, (Array.isArray(liste) ? liste : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x): Equipement => {
      const q = nombre(x.quantite), a = nombre(x.annee), val = nombre(x.valeur)
      return {
        id: texte(x.id, 40), categorie: (cles.has(String(x.categorie)) ? x.categorie : 'autre') as CategorieEquipement,
        precision: texte(x.precision, 120), quantite: q !== null && q > 0 ? Math.round(q) : 1,
        annee: a !== null && a >= 1950 && a <= 2100 ? Math.round(a) : null, valeur: val !== null && val >= 0 ? val : null,
        note: texte(x.note, 500), par: texte(x.par, 80), le: texte(x.le, 10),
      }
    }).filter((e) => e.id)]).filter(([, l]) => (l as Equipement[]).length))
}

export const equipementsDu = (reseau: Pick<Reseau, 'equipements'> | null | undefined, magasin: string) => reseau?.equipements?.[magasin] ?? []

// Tireuses du magasin : la somme des quantités de la catégorie (null s'il n'en a saisi aucune)
export function tireusesDu(liste: Equipement[]): number | null {
  const t = liste.filter((e) => e.categorie === 'tireuse')
  return t.length ? t.reduce((s, e) => s + e.quantite, 0) : null
}

// Résumé du parc : nombre d'équipements et valeur d'achat connue
export function resumeEquipements(liste: Equipement[]) {
  return { nombre: liste.reduce((s, e) => s + e.quantite, 0), valeur: liste.reduce((s, e) => s + (e.valeur ?? 0), 0), sansValeur: liste.filter((e) => e.valeur === null).length }
}
