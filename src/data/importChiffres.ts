import type { Reseau } from './modele'
import { champsChiffres, lireNombre, type ChampChiffre, type ChiffreMois } from './chiffres'
import { lireDate, normaliser, trouveurMagasin } from './import'

// Import de l'export BI mensuel : une ligne par magasin et par mois, une colonne par chiffre
const mots: Record<ChampChiffre, string[][]> = {
  caCave: [['ca', 'cave'], ['chiffre', 'cave'], ['ventes', 'cave'], ['vente', 'cave']],
  caBar: [['ca', 'bar'], ['chiffre', 'bar'], ['ventes', 'bar'], ['vente', 'bar']],
  tickets: [['tickets'], ['ticket'], ['frequentation'], ['freq'], ['clients']],
  panier: [['panier']],
  ebitda: [['ebitda'], ['caf']],
}

function champDe(entete: string): ChampChiffre | null {
  const n = normaliser(entete)
  if (/(^| )n ?1( |$)/.test(n) || n.includes('objectif')) return null // colonnes N-1 ou objectifs : l'app calcule elle-même les comparaisons
  const m = n.split(' ')
  for (const c of champsChiffres) if (mots[c.id].some((g) => g.every((x) => m.includes(x)))) return c.id
  return null
}

const nomsMois = [['jan'], ['fev', 'feb'], ['mar'], ['avr', 'apr'], ['mai', 'may'], ['juin', 'jun'], ['juil', 'jul'], ['aou', 'aug'], ['sep'], ['oct'], ['nov'], ['dec']]
// Mois d'une case : date Excel, AAAA-MM, MM/AAAA, « septembre 2026 », « sept. 26 »
export function lireMois(v: unknown): string | null {
  const t = normaliser(v)
  let m = String(v ?? '').trim().match(/^(\d{4})[-/.](\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`
  m = String(v ?? '').trim().match(/^(\d{1,2})[-/.](\d{4})$/)
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`
  m = t.match(/^([a-z]+) (\d{2,4})$/)
  if (m) {
    const i = nomsMois.findIndex((x) => x.some((p) => m![1].startsWith(p)))
    if (i >= 0) return `${m[2].length === 2 ? `20${m[2]}` : m[2]}-${String(i + 1).padStart(2, '0')}`
  }
  const d = lireDate(v)
  return d ? d.slice(0, 7) : null
}

export type LigneChiffres = Partial<ChiffreMois> & { magasin: string; mois: string }
export interface ResultatImportChiffres {
  colonneMagasin: string
  colonneMois: string | null
  colonnes: { entete: string; id: ChampChiffre }[]
  ignorees: string[]
  lignes: LigneChiffres[]
  inconnus: string[]
  illisibles: number
}

export function analyserChiffres(lignes: unknown[][], reseau: Reseau, moisParDefaut: string): ResultatImportChiffres | null {
  const iEntete = lignes.findIndex((l) => l.filter((c) => normaliser(c)).length >= 2)
  if (iEntete < 0) return null
  const entetes = lignes[iEntete].map((c) => String(c ?? '').trim())
  const corps = lignes.slice(iEntete + 1).filter((l) => l.some((c) => normaliser(c)))
  const trouver = trouveurMagasin(reseau)
  let iMag = -1, meilleur = 0
  entetes.forEach((_e, i) => { const n = corps.filter((l) => trouver(l[i])).length; if (n > meilleur) { meilleur = n; iMag = i } })
  if (iMag < 0) return null
  const iMois = entetes.findIndex((e, i) => i !== iMag && normaliser(e).split(' ').some((x) => ['mois', 'date', 'periode'].includes(x)))
  const colonnes: ResultatImportChiffres['colonnes'] = [], ignorees: string[] = []
  entetes.forEach((e, i) => {
    if (i === iMag || i === iMois || !normaliser(e)) return
    const c = champDe(e)
    if (c && !colonnes.some((x) => x.id === c)) colonnes.push({ entete: e, id: c }); else ignorees.push(e)
  })
  const parCle = new Map<string, LigneChiffres>(), inconnus: string[] = []
  let illisibles = 0
  for (const l of corps) {
    const nom = trouver(l[iMag])
    if (!nom) { if (normaliser(l[iMag]) && !inconnus.includes(String(l[iMag]).trim())) inconnus.push(String(l[iMag]).trim()); continue }
    const mois = iMois >= 0 ? lireMois(l[iMois]) : moisParDefaut
    if (!mois) { illisibles++; continue }
    // Deux lignes pour le même magasin et le même mois : la dernière l'emporte
    const ligne = parCle.get(`${nom}|${mois}`) ?? { magasin: nom, mois }
    for (const c of colonnes) {
      const i = entetes.indexOf(c.entete)
      if (!normaliser(l[i])) continue
      const n = lireNombre(l[i])
      if (n === null) illisibles++
      else ligne[c.id] = n
    }
    if (colonnes.some((c) => ligne[c.id] !== undefined)) parCle.set(`${nom}|${mois}`, ligne)
  }
  return { colonneMagasin: entetes[iMag], colonneMois: iMois >= 0 ? entetes[iMois] : null, colonnes, ignorees, lignes: [...parCle.values()], inconnus, illisibles }
}
