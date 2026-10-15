import type { Reseau } from './modele'
import { coachA } from './charge'
import { lireDate, normaliser, trouveurMagasin } from './import'

// Import du classeur de suivi des visites : un onglet par Coach (prénom dans le nom de l'onglet),
// un tableau « Magasin / Visite 1 / Visite 2… » et, plus bas, des tableaux de notes d'audit sans date

export interface Feuille { nom: string; lignes: unknown[][] }
export interface VisiteImportee { magasin: string; date: string; visiteurs: string[]; notes: string }
// Feuille de route faite (OUI, OK, X, 1), sans date dans le fichier
export interface FeuilleImportee { magasin: string; visiteurs: string[]; notes: string }
export interface AuditImporte { magasin: string; type: 'hygiene' | 'excellence'; score: number }
export interface ResultatImportVisites {
  visites: VisiteImportee[] // visites absentes de l'app
  dejaLa: number // visites déjà enregistrées le même jour pour le même magasin
  audits: AuditImporte[]
  feuillesDeRoute: FeuilleImportee[]
  feuilles: { nom: string; personne: string | null; equipe: boolean; visites: number }[]
  inconnus: string[]
  illisibles: string[]
}

const vide = (l: unknown[] | undefined) => !l || !l.some((c) => normaliser(c))

// Onglet « NOEMIE V. 2026 » : prénom « noemie », initiale « v »
function personnesDesFeuilles(noms: string[], reseau: Reseau): (string | null)[] {
  const personnes = [...reseau.equipe.filter((c) => !c.fictif).map((c) => c.nom), ...reseau.rrs.map((r) => r.nom), reseau.directeur.nom].filter(Boolean)
  const mots = (s: string) => normaliser(s).split(' ').filter((m) => m && !/^\d+$/.test(m))
  const candidats = noms.map((n) => {
    const [prenom, ...initiales] = mots(n)
    if (!prenom) return []
    return personnes.filter((p, i) => {
      if (personnes.indexOf(p) !== i) return false
      const t = mots(p)
      const iPrenom = t.findIndex((x) => x === prenom || (prenom.length >= 3 && x.startsWith(prenom)))
      return iPrenom >= 0 && initiales.every((ini) => t.some((x, k) => k !== iPrenom && x.startsWith(ini)))
    })
  })
  // Deux Coachs avec le même prénom : l'onglet sans initiale prend celui qu'aucun autre onglet n'a pris
  const pris = new Set(candidats.filter((c) => c.length === 1).map((c) => c[0]))
  return candidats.map((c) => (c.length === 1 ? c[0] : c.filter((p) => !pris.has(p)).length === 1 ? c.filter((p) => !pris.has(p))[0] : null))
}

// Case de visite : date Excel, JJ/MM/AAAA, « 19.05.2026 - MAIL », « 28 et 29/01/26 » (premier jour),
// « Visio 9.09 » (année de l'onglet quand la colonne n'en donne pas)
export function lireDateVisite(v: unknown, annee: string | null): string | null {
  if (typeof v !== 'string') { const d = lireDate(v); return d && d >= '2000' ? d : null }
  if (/^-?\d+$/.test(v.trim())) return null
  const t = v.trim()
  let m = t.match(/(?:^|\D)((?:\d{1,2}\s*(?:et|au|\/|-|,)\s*)*)(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?!\d)/)
  if (m) {
    const premier = m[1].match(/\d{1,2}/)?.[0] ?? m[2]
    const a = m[4].length === 2 ? `20${m[4]}` : m[4]
    return dateValide(a, m[3], premier)
  }
  if (!annee) return null
  m = t.match(/(?:^|\D)((?:\d{1,2}\s*(?:et|au|\/|-|,)\s*)*)(\d{1,2})[./](\d{1,2})(?![\d./])/)
  if (m) return dateValide(annee, m[3], m[1].match(/\d{1,2}/)?.[0] ?? m[2])
  return null
}
function dateValide(a: string, mois: string, jour: string): string | null {
  const iso = `${a}-${mois.padStart(2, '0')}-${jour.padStart(2, '0')}`
  const d = new Date(`${iso}T00:00:00Z`)
  return a >= '2000' && !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null
}

// Note d'audit : 0,9012 ou 90,12 → 90,12 % ; « OK / 54% // DOUBLE CHECK 77% » → 77 (le dernier contrôle)
export function lireScore(v: unknown): number | null {
  let n: number | null = null
  if (typeof v === 'number') n = v
  else if (typeof v === 'string') {
    const t = v.trim()
    const seul = t.match(/^(\d+(?:[.,;]\d+)?)\s*%?$/)
    if (seul) n = Number(seul[1].replace(/[,;]/, '.'))
    else {
      const pourcents = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)]
      if (pourcents.length) n = Number(pourcents.at(-1)![1].replace(',', '.'))
    }
  }
  if (n === null || isNaN(n) || n < 0) return null
  if (n <= 1) n *= 100
  return n > 100 ? null : Math.round(n * 100) / 100
}

function typeAudit(entete: unknown): AuditImporte['type'] | null {
  if (typeof entete !== 'string' || entete.length > 40) return null
  const n = normaliser(entete)
  if (n.includes('mystere')) return null
  if (n.includes('hygiene')) return 'hygiene'
  if (n.includes('concept') || n.includes('excellence')) return 'excellence'
  return null
}

const estFeuilleDeRoute = (entete: unknown) => typeof entete === 'string' && entete.length <= 40 && normaliser(entete).includes('feuille de route')
// « X » majuscule = fait ; « x » minuscule (case grisée) = sans objet
const faite = (v: unknown) => v === 1 || (typeof v === 'string' && (/^(oui|ok)( |$)/.test(normaliser(v)) || v.trim() === 'X'))

const estColonneVisite = (entete: unknown) => {
  const n = normaliser(entete)
  return /^visite( |$)/.test(n) || /^derniere visite \d{4}$/.test(n)
}

export function analyserVisites(feuilles: Feuille[], reseau: Reseau): ResultatImportVisites {
  const trouver = trouveurMagasin(reseau)
  const personnes = personnesDesFeuilles(feuilles.map((f) => f.nom), reseau)
  const parCle = new Map<string, VisiteImportee>()
  const parFeuille = new Map<string, string[]>() // Coach de chaque onglet où la visite apparaît
  const audits = new Map<string, AuditImporte>()
  const feuillesDeRoute = new Map<string, FeuilleImportee>()
  const inconnus = new Set<string>(), illisibles: string[] = []
  const resume: ResultatImportVisites['feuilles'] = []

  feuilles.forEach((f, iFeuille) => {
    // Onglet sans Coach de l'équipe : on garde le prénom écrit sur l'onglet
    const prenom = f.nom.trim().split(/\s+/)[0] ?? ''
    const personne = personnes[iFeuille] ?? (prenom ? prenom.charAt(0).toUpperCase() + prenom.slice(1).toLowerCase() : null)
    const anneeFeuille = f.nom.match(/\b(20\d{2})\b/)?.[1] ?? null
    let compte = 0
    const iEntete = f.lignes.findIndex((l) => l.some((c) => normaliser(c) === 'magasin'))
    // Un onglet de synthèse (colonne « Secteurs ») reprend les autres : il est ignoré
    const synthese = iEntete >= 0 && f.lignes[iEntete].some((c) => normaliser(c).startsWith('secteur'))
    if (iEntete >= 0 && !synthese) {
      const entetes = f.lignes[iEntete]
      const iMag = entetes.findIndex((c) => normaliser(c) === 'magasin')
      const iCom = entetes.findIndex((c) => normaliser(c).startsWith('commentaire'))
      const colonnes = entetes.map((e, i) => (estColonneVisite(e) ? i : -1)).filter((i) => i >= 0)
      for (let r = iEntete + 1; r < f.lignes.length && !vide(f.lignes[r]); r++) {
        const l = f.lignes[r]
        const brut = String(l[iMag] ?? '').trim()
        if (!brut || normaliser(brut) === 'moyenne') continue
        const nom = trouver(brut.replace(/\(.*$/, ''))
        const dates: string[] = []
        for (const i of colonnes) {
          if (!normaliser(l[i]) || String(l[i]).startsWith('#')) continue // cases vides ou erreurs de formule (#REF!)
          const annee = /\d{4}/.test(String(entetes[i])) ? null : anneeFeuille
          const date = lireDateVisite(l[i], annee)
          if (!date) { if (nom && typeof l[i] === 'string') illisibles.push(`${nom} : ${String(l[i]).trim()}`); continue }
          if (!nom) { inconnus.add(brut); continue }
          dates.push(date)
          // Le texte de la case devient la note de la visite, sauf s'il ne contient qu'une date
          const note = typeof l[i] === 'string' && /[a-zà-ÿ]{3}/i.test(String(l[i])) ? String(l[i]).trim() : ''
          const cle = `${nom}|${date}`
          const v = parCle.get(cle) ?? { magasin: nom, date, visiteurs: [], notes: '' }
          const ps = parFeuille.get(cle) ?? []
          if (personne && !ps.includes(personne)) ps.push(personne)
          parFeuille.set(cle, ps)
          if (note && !v.notes.includes(note)) v.notes = v.notes ? `${v.notes}\n${note}` : note
          compte++
          parCle.set(cle, v)
        }
        // Le commentaire de la ligne porte sur la dernière visite
        const com = iCom >= 0 && typeof l[iCom] === 'string' ? String(l[iCom]).trim() : ''
        if (nom && dates.length && com.length > 1) {
          const v = parCle.get(`${nom}|${dates.sort().at(-1)}`)!
          if (!v.notes.includes(com)) v.notes = v.notes ? `${v.notes}\n${com}` : com
        }
      }
    }
    if (!synthese) resume.push({ nom: f.nom.trim(), personne, equipe: !!personnes[iFeuille], visites: compte })

    // Tableaux de notes d'audit, où qu'ils soient dans l'onglet
    f.lignes.forEach((ligne, r) => {
      ligne.forEach((entete, c) => {
        if (estFeuilleDeRoute(entete)) {
          for (let k = r + 1; k < f.lignes.length && !vide(f.lignes[k]); k++) {
            const l = f.lignes[k]
            const nom = l.map((x, i) => (i === c || typeof x !== 'string' ? null : trouver(x.replace(/\(.*$/, '')))).find(Boolean)
            if (!nom || !faite(l[c])) continue
            const fr = feuillesDeRoute.get(nom) ?? { magasin: nom, visiteurs: [], notes: '' }
            if (personne && !fr.visiteurs.includes(personne)) fr.visiteurs.push(personne)
            const titre = String(entete).trim()
            if (!fr.notes.includes(titre)) fr.notes = fr.notes ? `${fr.notes}\n${titre}` : titre
            feuillesDeRoute.set(nom, fr)
          }
          return
        }
        const type = typeAudit(entete)
        if (!type) return
        const notes: number[] = []
        for (let k = c + 1; k < ligne.length && normaliser(ligne[k]).startsWith('note'); k++) notes.push(k)
        const lues = notes.length ? notes : [c]
        for (let k = r + 1; k < f.lignes.length && !vide(f.lignes[k]); k++) {
          const l = f.lignes[k]
          const nom = l.map((x, i) => (lues.includes(i) || i === c ? null : typeof x === 'string' ? trouver(x.replace(/\(.*$/, '')) : null)).find(Boolean)
          if (!nom) continue
          // Deuxième contrôle (note V2) prioritaire sur le premier
          const score = lues.map((i) => lireScore(l[i])).filter((x) => x !== null).at(-1)
          if (score !== undefined) audits.set(`${nom}|${type}`, { magasin: nom, type, score })
        }
      })
    })
  })

  // Même visite dans plusieurs onglets (magasin passé d'un Coach à l'autre) : le Coach du magasin à cette date
  // si c'est l'un d'eux, sinon tous
  for (const [cle, v] of parCle) {
    const ps = parFeuille.get(cle) ?? []
    const coach = coachA(reseau.magasins.find((m) => m.nom === v.magasin)!, v.date)
    v.visiteurs = ps.length > 1 && ps.includes(coach) ? [coach] : ps.length ? ps : [coach].filter(Boolean)
  }
  for (const fr of feuillesDeRoute.values()) {
    const coach = coachA(reseau.magasins.find((m) => m.nom === fr.magasin)!, reseau.jour)
    if (fr.visiteurs.length > 1 && fr.visiteurs.includes(coach)) fr.visiteurs = [coach]
  }
  const toutes = [...parCle.values()].sort((a, b) => a.date.localeCompare(b.date) || a.magasin.localeCompare(b.magasin, 'fr'))
  const existe = new Set(reseau.visites.map((v) => `${v.magasin}|${v.date}`))
  const visites = toutes.filter((v) => !existe.has(`${v.magasin}|${v.date}`))
  return { visites, dejaLa: toutes.length - visites.length, audits: [...audits.values()], feuillesDeRoute: [...feuillesDeRoute.values()], feuilles: resume, inconnus: [...inconnus], illisibles }
}

export async function lireClasseur(f: File): Promise<Feuille[]> {
  const { default: lire } = await import('read-excel-file/browser')
  return (await lire(f)).map((s) => ({ nom: s.sheet, lignes: s.data as unknown[][] }))
}
