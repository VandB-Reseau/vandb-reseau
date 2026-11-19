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

// Joseph (19/11/2026) : un même équipement peut être acheté en plusieurs fois (10 tireuses en 2024, 7 en 2026).
// Chaque achat a sa quantité, son année et son prix HT ; la ligne garde alors les totaux (quantité, prix) pour les
// lectures qui ne connaissent pas le détail (parc de tireuses, résumé).
export interface AchatEquipement { quantite: number; annee: number | null; valeur: number | null }

export interface Equipement {
  id: string
  categorie: CategorieEquipement
  precision: string // marque, modèle, nombre de becs…
  quantite: number
  annee: number | null // année d'achat (la première s'il y a plusieurs achats)
  valeur: number | null // prix d'achat HT de l'ensemble de la ligne
  achats?: AchatEquipement[] // seulement à partir de deux achats
  note: string
  par: string
  le: string // AAAA-MM-JJ
}

const anneeOuNull = (a: number | null) => (a !== null && a >= 1950 && a <= 2100 ? Math.round(a) : null)

// Les achats d'une ligne : ceux saisis, ou la ligne elle-même s'il n'y en a qu'un
export const achatsDe = (e: Equipement): AchatEquipement[] =>
  e.achats && e.achats.length > 1 ? e.achats : [{ quantite: e.quantite, annee: e.annee, valeur: e.valeur }]

// Range les achats dans la ligne : null si plus aucun, ligne simple s'il n'en reste qu'un, totaux sinon
export function avecAchats(e: Equipement, achats: AchatEquipement[]): Equipement | null {
  const gardes = achats.filter((a) => a.quantite >= 1)
  const { achats: _ancien, ...base } = e
  void _ancien
  if (!gardes.length) return null
  if (gardes.length === 1) return { ...base, ...gardes[0] }
  const prix = gardes.filter((a) => a.valeur !== null)
  const annees = gardes.map((a) => a.annee).filter((a): a is number => a !== null)
  return {
    ...base, achats: gardes, quantite: gardes.reduce((s, a) => s + a.quantite, 0),
    annee: annees.length ? Math.min(...annees) : null, valeur: prix.length ? prix.reduce((s, a) => s + (a.valeur ?? 0), 0) : null,
  }
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
      const e: Equipement = {
        id: texte(x.id, 40), categorie: (cles.has(String(x.categorie)) ? x.categorie : 'autre') as CategorieEquipement,
        precision: texte(x.precision, 120), quantite: q !== null && q > 0 ? Math.round(q) : 1,
        annee: anneeOuNull(a), valeur: val !== null && val >= 0 ? val : null,
        note: texte(x.note, 500), par: texte(x.par, 80), le: texte(x.le, 10),
      }
      const achats = (Array.isArray(x.achats) ? x.achats : []).filter((y): y is Record<string, unknown> => !!y && typeof y === 'object').slice(0, 50)
        .map((y): AchatEquipement => {
          const qa = nombre(y.quantite), va = nombre(y.valeur)
          return { quantite: qa !== null && qa > 0 ? Math.round(qa) : 0, annee: anneeOuNull(nombre(y.annee)), valeur: va !== null && va >= 0 ? va : null }
        })
      return achats.length > 1 ? avecAchats(e, achats) ?? e : e
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
