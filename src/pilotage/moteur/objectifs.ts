import { UNIVERS_PANIER, type MoisReel, type UniversTickets } from './suivi'
import type { Budget } from './types'

// Objectifs du mois pour l'équipe du magasin (lot 30, F2, 29/10/2026) : le budget du mois traduit en tickets par jour
// d'ouverture et en panier TTC visé, Cave et Bar séparés (jamais additionnés), face au même mois de l'an dernier.
// - CA TTC visé = CA HT du budget du mois × (1 + TVA moyenne de l'univers) ;
// - tickets du mois = CA TTC ÷ panier visé ; par jour = ÷ jours d'ouverture (lundi à samedi par défaut, modifiable) ;
// - « 1 € de plus par ticket » = tickets du mois × 1 € TTC.

export interface ObjectifUnivers {
  caHT: number; caTTC: number; panier: number; tickets: number; ticketsParJour: number; unEuroDePlus: number
  panierN1: number | null; ticketsParJourN1: number | null   // même mois de l'an dernier, mêmes jours d'ouverture
}
export interface ObjectifsMois { mois: number; jours: number; univers: Partial<Record<UniversTickets, ObjectifUnivers>> }

// Jours du mois hors dimanches (mois de 1 à 12)
export function joursHorsDimanche(annee: number, mois: number): number {
  const n = new Date(annee, mois, 0).getDate()
  return Array.from({ length: n }, (_, i) => new Date(annee, mois - 1, i + 1).getDay()).filter((j) => j !== 0).length
}

export function objectifsDuMois(b: Budget, mois: number, jours: number, tva: Record<UniversTickets, number>, n1?: MoisReel): ObjectifsMois {
  const univers: ObjectifsMois['univers'] = {}
  const m = b.mois[mois - 1]
  for (const u of UNIVERS_PANIER) {
    const f = b.flux[u]
    const caHT = m?.univers?.[u].ca ?? 0
    if (!f || f.panierObjectifTTC <= 0 || caHT <= 0 || jours <= 0) continue
    const caTTC = caHT * (1 + tva[u])
    const tickets = caTTC / f.panierObjectifTTC
    const r = n1?.univers?.[u]
    univers[u] = {
      caHT, caTTC, panier: f.panierObjectifTTC, tickets, ticketsParJour: tickets / jours, unEuroDePlus: tickets,
      panierN1: r && r.tickets > 0 ? r.caTTC / r.tickets : null, ticketsParJourN1: r && r.tickets > 0 ? r.tickets / jours : null,
    }
  }
  return { mois, jours, univers }
}

// Défi de vente additionnelle (choix 130, Joseph 13/11/2026) : une simulation « Vente additionnelle » gardée devient un
// objectif de l'équipe sur le mois. Articles du mois = clients visés du mois dans l'univers ÷ « un client sur » ;
// par jour = ÷ jours d'ouverture ; CA TTC en plus = articles × prix TTC.
export interface DefiVente { univers: UniversTickets; unSur: number; prixTTC: number; articles: number; articlesParJour: number; caTTC: number }
export function defiDuMois(o: ObjectifsMois, d: { univers: UniversTickets; unSur: number; prixTTC: number }): DefiVente | null {
  const u = o.univers[d.univers]
  if (!u || d.unSur < 1 || d.prixTTC <= 0 || o.jours <= 0) return null
  const articles = u.tickets / d.unSur
  return { univers: d.univers, unSur: d.unSur, prixTTC: d.prixTTC, articles, articlesParJour: articles / o.jours, caTTC: articles * d.prixTTC }
}
