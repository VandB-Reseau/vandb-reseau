import type { Magasin, Reseau, Visite } from './modele'
import { coachA } from './charge'
import { caseDe, joursParVisite, visitesParAn, type CaseNineBox } from './sante'

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
      const toutes = reseau.visites.filter((v) => v.magasin === m.nom)
      const visites = toutes.filter((v) => v.date >= s.debut && v.date <= s.fin)
      return { magasin: m, coach: coachA(m, reference), visites, derniere: toutes.filter((v) => v.date <= reseau.jour).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null }
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
  objectif: number // visites sur l'année (au prorata si le magasin ouvre en cours d'année)
  faites: number // visites faites sur l'année
  intervalle: number // jours entre deux visites selon le rythme
  prochaine: string // date avant laquelle la prochaine visite est due
  retard: number // jours de retard (0 = à jour)
  jours: number // jours de visite prévus sur l'année
  derniere: Visite | null
}

const jourNum = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86400000
const isoDe = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10)

// Une visite est due tous les 365 / (visites par an) jours après la précédente
export function suiviRythme(reseau: Reseau, a: Annee): LigneRythme[] {
  const reference = a.fin < reseau.jour ? a.fin : reseau.jour
  return reseau.magasins
    .filter((m) => m.ouverture <= a.fin && m.statut !== 'avenir' && m.ouverture <= reseau.jour)
    .map((m) => {
      const c = caseDe(reseau.evaluations[m.nom])
      const parAn = visitesParAn(c)
      const debut = m.ouverture > a.debut ? m.ouverture : a.debut
      const part = Math.min(1, (jourNum(a.fin) - jourNum(debut) + 1) / (jourNum(a.fin) - jourNum(a.debut) + 1))
      const objectif = Math.max(1, Math.round(parAn * part))
      const toutes = reseau.visites.filter((v) => v.magasin === m.nom && v.date <= reseau.jour)
      const faites = toutes.filter((v) => v.date >= a.debut && v.date <= a.fin).length
      const derniere = toutes.sort((x, y) => y.date.localeCompare(x.date))[0] ?? null
      const intervalle = Math.round(365 / parAn)
      // Jamais visité : le délai court depuis l'ouverture, ou depuis le début de l'année pour un magasin plus ancien
      const depart = derniere?.date ?? (m.ouvertureConnue && m.ouverture > a.debut ? m.ouverture : a.debut)
      const prochaine = isoDe(jourNum(depart) + intervalle)
      return {
        magasin: m, coach: coachA(m, reference), case: c, objectif, faites, intervalle, prochaine,
        retard: Math.max(0, jourNum(reference) - jourNum(prochaine)), jours: objectif * joursParVisite(c), derniere,
      }
    })
}
