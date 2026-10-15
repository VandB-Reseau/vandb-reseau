import type { Reseau } from './modele'
import { tousCriteres, type IdCritere, type Note, type Thematique } from './sante'

// Import d'un tableau (Excel ou CSV, par exemple un export Asana) : une ligne par magasin,
// une colonne par critère de la nine box ou par thématique de déploiement

export const normaliser = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim()
const sansEnseigne = (s: string) => s.replace(/^(v and b|vandb|v b)\s+/, '')

const motsCriteres: Record<IdCritere, string[][]> = {
  caExterieur: [['exterieur'], ['ca', 'marche']],
  panierCave: [['panier', 'cave']],
  panierBar: [['panier', 'bar']],
  fluxCave: [['flux', 'cave']],
  fluxBar: [['flux', 'bar']],
  franchise: [['franchise'], ['management'], ['gestion']],
}

function critereDe(entete: string): IdCritere | null {
  const mots = normaliser(entete).split(' ')
  for (const c of tousCriteres) if (motsCriteres[c.id].some((groupe) => groupe.every((m) => mots.includes(m)))) return c.id
  return null
}

function noteDe(v: unknown): Note | null {
  const n = normaliser(v)
  if (['nc', 'n c', 'na', 'n a', 'non concerne', 'sans objet'].includes(n)) return 0
  if (['1', 'faible', 'f', 'bas'].includes(n)) return 1
  if (['2', 'moyen', 'm', 'moyenne'].includes(n)) return 2
  if (['3', 'fort', 'eleve', 'bon'].includes(n)) return 3
  return null
}

// « Oui - avancé » correspond à « Oui » : on prend la réponse la plus longue qui ouvre la valeur
export function optionDe(t: Thematique, v: unknown): string | null {
  const n = normaliser(v)
  if (!n) return null
  const exacte = t.options.find((o) => normaliser(o.libelle) === n)
  if (exacte) return exacte.libelle
  const debut = t.options.filter((o) => n.startsWith(normaliser(o.libelle))).sort((a, b) => b.libelle.length - a.libelle.length)[0]
  return debut?.libelle ?? null
}

// Date d'une case : objet Date (Excel), nombre de jours Excel, JJ/MM/AAAA ou AAAA-MM-JJ
export function lireDate(v: unknown): string | null {
  const iso = (d: Date) => (isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  if (v instanceof Date) return iso(new Date(v.getTime() + v.getTimezoneOffset() * 60000 * (v.getUTCHours() === 0 ? 1 : 0)))
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10)
  const t = String(v ?? '').trim()
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

export interface LigneHistorique { magasin: string; date: string; notes: Partial<Record<IdCritere, Note>> }

export interface ResultatImport {
  colonneMagasin: string
  colonneDate: string | null // sans colonne de date, tout est daté du jour choisi
  criteres: { entete: string; id: IdCritere }[]
  thematiques: { entete: string; t: Thematique }[]
  ignorees: string[]
  notes: LigneHistorique[] // une ligne par magasin et par date
  deploiements: { magasin: string; thematique: string; etat: string; date: string }[]
  inconnus: string[]
  illisibles: number
}

// « ST PAUL LES DAX » = « Saint-Paul-Lès-Dax », « Elbeufs » = « Elbeuf »
const canonique = (s: string) => sansEnseigne(s).split(' ').map((m) => ({ st: 'saint', ste: 'sainte', lez: 'les' })[m] ?? m.replace(/(.{3,})s$/, '$1')).join(' ')

// Retrouve un magasin à partir du nom écrit dans un fichier (avec ou sans « V and B » devant)
export function trouveurMagasin(reseau: Reseau): (v: unknown) => string | null {
  const parNom = new Map<string, string>(), parCanon = new Map<string, string>()
  for (const m of reseau.magasins) { parNom.set(normaliser(m.nom), m.nom); parNom.set(sansEnseigne(normaliser(m.nom)), m.nom); parCanon.set(canonique(normaliser(m.nom)), m.nom) }
  const canons = [...parCanon.keys()]
  return (v: unknown) => {
    const n = normaliser(v)
    if (!n) return null
    const exact = parNom.get(n) ?? parNom.get(sansEnseigne(n)) ?? parCanon.get(canonique(n))
    if (exact) return exact
    // « Balma Gramont » = « Balma », « Toulon » = « Toulon La Valette » : le nom commun le plus long, s'il est seul
    const c = canonique(n)
    if (c.length < 4) return null
    const proches = canons.filter((k) => k.length >= 4 && (c.startsWith(`${k} `) || k.startsWith(`${c} `)))
    const long = Math.max(0, ...proches.map((k) => Math.min(k.length, c.length)))
    const meilleurs = proches.filter((k) => Math.min(k.length, c.length) === long)
    if (meilleurs.length === 1) return parCanon.get(meilleurs[0])!
    // Une seule lettre d'écart sur un nom assez long (« Biscarosse » = « Biscarrosse »)
    const fautes = c.length >= 6 ? canons.filter((k) => unEcart(k, c)) : []
    return fautes.length === 1 ? parCanon.get(fautes[0])! : null
  }
}

function unEcart(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1)
}

export function analyser(lignes: unknown[][], reseau: Reseau, dateParDefaut: string): ResultatImport | null {
  const iEntete = lignes.findIndex((l) => l.filter((c) => normaliser(c)).length >= 2)
  if (iEntete < 0) return null
  const entetes = lignes[iEntete].map((c) => String(c ?? '').trim())
  const corps = lignes.slice(iEntete + 1).filter((l) => l.some((c) => normaliser(c)))
  const trouver = trouveurMagasin(reseau)
  // La colonne des magasins est celle qui reconnaît le plus de noms
  let iMag = -1, meilleur = 0
  entetes.forEach((_e, i) => { const n = corps.filter((l) => trouver(l[i])).length; if (n > meilleur) { meilleur = n; iMag = i } })
  if (iMag < 0) return null
  const criteres: ResultatImport['criteres'] = [], thematiques: ResultatImport['thematiques'] = [], ignorees: string[] = []
  const colonnes = new Map<number, { id: IdCritere } | { t: Thematique }>()
  const iDate = entetes.findIndex((e, i) => i !== iMag && normaliser(e).split(' ').includes('date'))
  entetes.forEach((e, i) => {
    if (i === iMag || i === iDate || !normaliser(e)) return
    const t = reseau.deploiements.thematiques.find((x) => normaliser(x.libelle) === normaliser(e)) ?? reseau.deploiements.thematiques.find((x) => normaliser(e).includes(normaliser(x.libelle)))
      ?? (normaliser(e).length >= 3 ? reseau.deploiements.thematiques.find((x) => ` ${normaliser(x.libelle)} `.includes(` ${normaliser(e)} `)) : undefined)
    const c = t ? null : critereDe(e)
    if (t) { thematiques.push({ entete: e, t }); colonnes.set(i, { t }) }
    else if (c) { criteres.push({ entete: e, id: c }); colonnes.set(i, { id: c }) }
    else ignorees.push(e)
  })
  const parCle = new Map<string, LigneHistorique>(), inconnus: string[] = []
  const deps = new Map<string, ResultatImport['deploiements'][number]>()
  let illisibles = 0
  for (const l of corps) {
    const nom = trouver(l[iMag])
    if (!nom) { if (normaliser(l[iMag])) inconnus.push(String(l[iMag]).trim()); continue }
    const date = (iDate >= 0 ? lireDate(l[iDate]) : null) ?? dateParDefaut
    if (iDate >= 0 && normaliser(l[iDate]) && !lireDate(l[iDate])) illisibles++
    for (const [i, col] of colonnes) {
      if (!normaliser(l[i])) continue
      if ('id' in col) {
        const n = noteDe(l[i])
        if (n === null) { illisibles++; continue }
        // Deux lignes pour le même magasin et le même jour : la dernière l'emporte
        const cle = `${nom}|${date}`
        const h = parCle.get(cle) ?? { magasin: nom, date, notes: {} }
        h.notes[col.id] = n
        parCle.set(cle, h)
      } else {
        const o = optionDe(col.t, l[i])
        if (o) deps.set(`${nom}|${date}|${col.t.id}`, { magasin: nom, thematique: col.t.id, etat: o, date }); else illisibles++
      }
    }
  }
  const notes = [...parCle.values()], deploiements = [...deps.values()]
  return { colonneMagasin: entetes[iMag], colonneDate: iDate >= 0 ? entetes[iDate] : null, criteres, thematiques, ignorees, notes, deploiements, inconnus, illisibles }
}

// CSV séparé par virgules ou points-virgules, guillemets gérés
export function lireCSV(texte: string): string[][] {
  const premiere = texte.split(/\r?\n/)[0] ?? ''
  const sep = (premiere.match(/;/g)?.length ?? 0) > (premiere.match(/,/g)?.length ?? 0) ? ';' : premiere.includes('\t') && !premiere.includes(',') ? '\t' : ','
  const lignes: string[][] = []
  let ligne: string[] = [], champ = '', guillemets = false
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++ }
      else if (c === '"') guillemets = false
      else champ += c
    } else if (c === '"') guillemets = true
    else if (c === sep) { ligne.push(champ); champ = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && texte[i + 1] === '\n') i++; ligne.push(champ); lignes.push(ligne); ligne = []; champ = '' }
    else champ += c
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne) }
  return lignes
}

export async function lireFichier(f: File): Promise<unknown[][]> {
  if (/\.(csv|txt|tsv)$/i.test(f.name)) return lireCSV(await f.text())
  const { default: lire } = await import('read-excel-file/browser')
  const feuilles = await lire(f)
  // Prend la feuille la plus remplie
  return (feuilles.sort((a, b) => b.data.length - a.data.length)[0]?.data ?? []) as unknown[][]
}
