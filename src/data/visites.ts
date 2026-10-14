import type { Magasin, Reseau, Visite } from './modele'
import { coachA } from './charge'

// Semestres de l'année fiscale (octobre → septembre) : S1 = octobre → mars, S2 = avril → septembre
export interface Semestre { cle: string; debut: string; fin: string; libelle: string; court: string }

const mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export function semestreDe(iso: string): Semestre {
  const a = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7))
  const fy = (y: number) => `FY${String(y).slice(2)}`
  if (m >= 10) return { cle: `${a + 1}-S1`, debut: `${a}-10-01`, fin: `${a + 1}-03-31`, court: `S1 ${fy(a + 1)}`, libelle: `S1 ${fy(a + 1)} · ${mois[9]} ${a} à ${mois[2]} ${a + 1}` }
  if (m <= 3) return { cle: `${a}-S1`, debut: `${a - 1}-10-01`, fin: `${a}-03-31`, court: `S1 ${fy(a)}`, libelle: `S1 ${fy(a)} · ${mois[9]} ${a - 1} à ${mois[2]} ${a}` }
  return { cle: `${a}-S2`, debut: `${a}-04-01`, fin: `${a}-09-30`, court: `S2 ${fy(a)}`, libelle: `S2 ${fy(a)} · ${mois[3]} à ${mois[8]} ${a}` }
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
