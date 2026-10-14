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

export interface ResultatImport {
  colonneMagasin: string
  criteres: { entete: string; id: IdCritere }[]
  thematiques: { entete: string; t: Thematique }[]
  ignorees: string[]
  notes: Record<string, Partial<Record<IdCritere, Note>>>
  deploiements: { magasin: string; thematique: string; etat: string }[]
  inconnus: string[]
  illisibles: number
}

export function analyser(lignes: unknown[][], reseau: Reseau): ResultatImport | null {
  const iEntete = lignes.findIndex((l) => l.filter((c) => normaliser(c)).length >= 2)
  if (iEntete < 0) return null
  const entetes = lignes[iEntete].map((c) => String(c ?? '').trim())
  const corps = lignes.slice(iEntete + 1).filter((l) => l.some((c) => normaliser(c)))
  const parNom = new Map<string, string>()
  for (const m of reseau.magasins) { parNom.set(normaliser(m.nom), m.nom); parNom.set(sansEnseigne(normaliser(m.nom)), m.nom) }
  const trouver = (v: unknown) => parNom.get(normaliser(v)) ?? parNom.get(sansEnseigne(normaliser(v))) ?? null
  // La colonne des magasins est celle qui reconnaît le plus de noms
  let iMag = -1, meilleur = 0
  entetes.forEach((_e, i) => { const n = corps.filter((l) => trouver(l[i])).length; if (n > meilleur) { meilleur = n; iMag = i } })
  if (iMag < 0) return null
  const criteres: ResultatImport['criteres'] = [], thematiques: ResultatImport['thematiques'] = [], ignorees: string[] = []
  const colonnes = new Map<number, { id: IdCritere } | { t: Thematique }>()
  entetes.forEach((e, i) => {
    if (i === iMag || !normaliser(e)) return
    const t = reseau.deploiements.thematiques.find((x) => normaliser(x.libelle) === normaliser(e)) ?? reseau.deploiements.thematiques.find((x) => normaliser(e).includes(normaliser(x.libelle)))
      ?? (normaliser(e).length >= 3 ? reseau.deploiements.thematiques.find((x) => ` ${normaliser(x.libelle)} `.includes(` ${normaliser(e)} `)) : undefined)
    const c = t ? null : critereDe(e)
    if (t) { thematiques.push({ entete: e, t }); colonnes.set(i, { t }) }
    else if (c) { criteres.push({ entete: e, id: c }); colonnes.set(i, { id: c }) }
    else ignorees.push(e)
  })
  const notes: ResultatImport['notes'] = {}, deploiements: ResultatImport['deploiements'] = [], inconnus: string[] = []
  let illisibles = 0
  for (const l of corps) {
    const nom = trouver(l[iMag])
    if (!nom) { if (normaliser(l[iMag])) inconnus.push(String(l[iMag]).trim()); continue }
    for (const [i, col] of colonnes) {
      if (!normaliser(l[i])) continue
      if ('id' in col) { const n = noteDe(l[i]); if (n) (notes[nom] ??= {})[col.id] = n; else illisibles++ }
      else { const o = optionDe(col.t, l[i]); if (o) deploiements.push({ magasin: nom, thematique: col.t.id, etat: o }); else illisibles++ }
    }
  }
  return { colonneMagasin: entetes[iMag], criteres, thematiques, ignorees, notes, deploiements, inconnus, illisibles }
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
