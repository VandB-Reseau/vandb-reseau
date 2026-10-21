import { visiteFaite, type Magasin, type Reseau, type Visite } from './modele'
import { coachA } from './charge'
import { caseDe, delaiVisite, historiqueSante, joursParVisite, nineBox, visitesParAn, type CaseNineBox } from './sante'
import { estVisite, typesContact } from './chiffres'

// Semestres de l'année (janvier → décembre) : S1 = janvier → juin, S2 = juillet → décembre
export interface Semestre { cle: string; debut: string; fin: string; libelle: string; court: string }

const mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export function semestreDe(iso: string): Semestre {
  const a = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7))
  if (m <= 6) return { cle: `${a}-S1`, debut: `${a}-01-01`, fin: `${a}-06-30`, court: `S1 ${a}`, libelle: `S1 ${a} · ${mois[0]} à ${mois[5]} ${a}` }
  return { cle: `${a}-S2`, debut: `${a}-07-01`, fin: `${a}-12-31`, court: `S2 ${a}`, libelle: `S2 ${a} · ${mois[6]} à ${mois[11]} ${a}` }
}

export function semestresDisponibles(reseau: Reseau): Semestre[] {
  const m = new Map<string, Semestre>()
  const cour = semestreDe(reseau.jour)
  m.set(cour.cle, cour)
  reseau.visites.forEach((v) => { if (v.date) { const s = semestreDe(v.date); m.set(s.cle, s) } })
  return [...m.values()].sort((a, b) => b.debut.localeCompare(a.debut))
}

export interface LigneCouverture { magasin: Magasin; coach: string; visites: Visite[]; derniere: Visite | null }

// Objectif : au moins une visite par magasin ouvert et par semestre
export function couverture(reseau: Reseau, s: Semestre): LigneCouverture[] {
  const reference = s.fin < reseau.jour ? s.fin : reseau.jour
  return reseau.magasins
    .filter((m) => m.ouverture <= s.fin && m.statut !== 'avenir')
    .map((m) => {
      const toutes = reseau.visites.filter((v) => v.magasin === m.nom && estVisite(v))
      const visites = toutes.filter((v) => v.date >= s.debut && v.date <= s.fin)
      return { magasin: m, coach: coachA(m, reference), visites, derniere: toutes.filter((v) => visiteFaite(v, reseau.jour)).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null }
    })
}

export function visitesDuMagasin(reseau: Reseau, nom: string): Visite[] {
  return reseau.visites.filter((v) => v.magasin === nom).sort((a, b) => b.date.localeCompare(a.date))
}

export function lienCompteRendu(v: Visite): string { return `/visites/compte-rendu/${v.id}` }

// ── Rythme de visite selon la nine box (démarche coach : 2 à 8 visites par an, 2 au minimum) ──
export interface Annee { cle: string; debut: string; fin: string; libelle: string; court: string }

export function anneeDe(iso: string): Annee {
  const a = iso.slice(0, 4)
  return { cle: a, debut: `${a}-01-01`, fin: `${a}-12-31`, court: a, libelle: a }
}

export function anneesDisponibles(reseau: Reseau): Annee[] {
  const m = new Map<string, Annee>()
  const cour = anneeDe(reseau.jour)
  m.set(cour.cle, cour)
  reseau.visites.forEach((v) => { if (v.date) { const a = anneeDe(v.date); m.set(a.cle, a) } })
  return [...m.values()].sort((a, b) => b.debut.localeCompare(a.debut))
}

export interface LigneRythme {
  magasin: Magasin; coach: string; case: CaseNineBox | null
  reference: number // visites de référence sur l'année, au prorata des cases occupées (et de l'ouverture)
  faites: number // visites faites sur l'année
  delai: number // jours sans visite avant l'alerte, selon la case actuelle
  depuis: number | null // jours depuis la dernière visite (ou l'ouverture) ; null si jamais visité et ouverture inconnue
  alerte: boolean // pas vu depuis plus longtemps que le délai de la case
  echeance: string | null // date à partir de laquelle l'alerte part
  jours: number // jours de visite de référence sur l'année (charge)
  derniere: Visite | null
  dernierContact: Visite | null // dernier appel ou point, s'il est plus récent que la dernière visite
}

const jourNum = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86400000
const isoDe = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10)

// Visites de référence sur l'année : chaque période compte au rythme de la case qu'occupait le magasin.
// Avant son premier classement, le magasin prend la case de ce premier classement.
function referenceAnnee(reseau: Reseau, m: Magasin, a: Annee, actuelle: CaseNineBox | null): number {
  const h = historiqueSante(reseau.evaluations, m.nom)
  const caseDuPoint = (i: number) => (i >= h.length - 1 ? actuelle : nineBox.find((c) => c.id === h[Math.max(0, i)].caseId) ?? null)
  const debut = m.ouverture > a.debut ? m.ouverture : a.debut
  const bornes = [debut, ...h.map((p) => p.date).filter((d) => d > debut && d <= a.fin), isoDe(jourNum(a.fin) + 1)]
  let total = 0
  for (let k = 0; k < bornes.length - 1; k++) {
    const i = h.findLastIndex((p) => p.date <= bornes[k])
    total += visitesParAn(h.length ? caseDuPoint(i) : actuelle) * (jourNum(bornes[k + 1]) - jourNum(bornes[k]))
  }
  return Math.max(1, Math.round(total / (jourNum(a.fin) - jourNum(a.debut) + 1)))
}

export function suiviRythme(reseau: Reseau, a: Annee): LigneRythme[] {
  const reference = a.fin < reseau.jour ? a.fin : reseau.jour
  // Visites et contacts rangés par magasin en un seul passage (le réseau compte des centaines de magasins et des milliers de visites)
  const parMagasin = new Map<string, Visite[]>()
  const contacts = new Map<string, Visite>()
  for (const v of reseau.visites) {
    if (v.date > reseau.jour) continue
    if (estVisite(v)) {
      if (v.prevue) continue
      const l = parMagasin.get(v.magasin)
      if (l) l.push(v); else parMagasin.set(v.magasin, [v])
    } else if (typesContact.includes(v.type) && (contacts.get(v.magasin)?.date ?? '') < v.date) contacts.set(v.magasin, v)
  }
  return reseau.magasins
    .filter((m) => m.ouverture <= a.fin && m.statut !== 'avenir' && m.ouverture <= reseau.jour)
    .map((m) => {
      const c = caseDe(reseau.evaluations[m.nom])
      const ref = referenceAnnee(reseau, m, a, c)
      const toutes = (parMagasin.get(m.nom) ?? []).filter((v) => v.date <= reference)
      const faites = toutes.filter((v) => v.date >= a.debut).length
      const derniere = toutes.reduce<Visite | null>((d, v) => (!d || v.date > d.date ? v : d), null)
      const delai = delaiVisite(reseau.delaisVisite, c)
      // Jamais visité : le délai court depuis l'ouverture quand elle est connue
      const depart = derniere?.date ?? (m.ouvertureConnue ? m.ouverture : null)
      const depuis = depart ? jourNum(reference) - jourNum(depart) : null
      const contact = contacts.get(m.nom) ?? null
      return {
        magasin: m, coach: coachA(m, reference), case: c, reference: ref, faites, delai, depuis,
        alerte: depuis === null || depuis > delai, echeance: depart ? isoDe(jourNum(depart) + delai + 1) : null,
        jours: ref * joursParVisite(c), derniere,
        dernierContact: contact && contact.date <= reference && (!derniere || contact.date > derniere.date) ? contact : null,
      }
    })
}

// Libellé de l'alerte : « pas vu depuis 95 j » ou « jamais visité »
export const libellePasVu = (l: LigneRythme) => (l.derniere ? `Pas vu depuis ${l.depuis} j` : 'Jamais visité')
