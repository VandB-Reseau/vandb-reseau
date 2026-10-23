// Engagement d'un franchisé (sprint 22, A5) : trois repères sur 90 jours, montrés tels quels à l'équipe seule.
// Communications lues (Directeur et RR seulement, la base ne donne pas les lectures au Coach), tâches tenues
// dans les délais, dernier message écrit dans les fils que voit le compte. Jamais dans l'espace du franchisé.
import { useEffect, useMemo, useState } from 'react'
import { actionsDes, echeanceDate, porteursDe } from './actions'
import { ecartJours } from './agenda'
import { chargerCommunications, chargerLectures, type Communication, type Lecture } from './communications'
import type { Message } from './messagerie'
import { useMessagerie } from './MessagerieContext'
import type { Reseau } from './modele'
import { usePresences, type Presence } from './reunions'
import { useAuth } from '../auth/AuthContext'

export const FENETRE = 90
// Seuils d'un repère en retrait ; « peu engagé » = au moins deux repères en retrait (réunions : depuis 0025)
export const SEUIL_LECTURE = 0.5
export const SEUIL_TACHES = 0.5
export const SEUIL_SILENCE = 60
export const SEUIL_REUNIONS = 0.5

export interface Ratio { fait: number; total: number }
export interface Engagement { communications: Ratio | null; taches: Ratio | null; dernierMessage: string | null; reunions: Ratio | null }

const jourMoins = (jour: string, n: number) => { const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10) }

export function engagementDe(reseau: Reseau, nom: string, magasins: string[], sources: { communications: Communication[]; lectures: Map<number, Lecture> | null; messages: Message[]; presences?: Presence[] | null }): Engagement {
  const debut = jourMoins(reseau.jour, FENETRE)
  let communications: Ratio | null = null
  if (sources.lectures) {
    communications = { fait: 0, total: 0 }
    for (const c of sources.communications) {
      if (c.creeLe.slice(0, 10) < debut) continue
      const l = sources.lectures.get(c.id)
      if (!l) continue
      if (l.lus.includes(nom)) { communications.fait++; communications.total++ } else if (l.nonLus.includes(nom)) communications.total++
    }
    if (!communications.total) communications = null
  }
  // Tâches qu'il porte (son nom, ou « Franchisé » d'un plan de visite) arrivées à échéance dans les 90 jours
  const taches = { fait: 0, total: 0 }
  for (const x of actionsDes(reseau, new Set(magasins))) {
    const e = echeanceDate(x.a)
    if (!e || e < debut || e > reseau.jour) continue
    if (!porteursDe(x.a).some((p) => p === nom || /^franchisé$/i.test(p))) continue
    taches.total++
    if (x.a.faite && x.a.faite.slice(0, 10) <= e) taches.fait++
  }
  const dernierMessage = sources.messages
    .filter((m) => m.auteurCle === `franchise:${nom}` || (m.auteurRole === 'franchise' && m.auteurNom === nom))
    .reduce<string | null>((max, m) => (!max || m.creeLe > max ? m.creeLe : max), null)
  // Réunions et formations (0025) passées dans les 90 jours où un de ses magasins était invité et a été pointé
  let reunions: Ratio | null = null
  if (sources.presences) {
    reunions = { fait: 0, total: 0 }
    for (const e of reseau.evenements) {
      if (e.id === null || e.debut < debut || e.debut > reseau.jour || !e.invites?.some((m) => magasins.includes(m))) continue
      const p = sources.presences.filter((x) => x.event === e.id && magasins.includes(x.magasin) && x.present !== null)
      if (!p.length) continue
      reunions.total++
      if (p.some((x) => x.present)) reunions.fait++
    }
    if (!reunions.total) reunions = null
  }
  return { communications, taches: taches.total ? taches : null, dernierMessage, reunions }
}

export const silence = (e: Engagement, jour: string) => (e.dernierMessage ? ecartJours(e.dernierMessage.slice(0, 10), jour) : null)

// Repères en retrait (un repère inconnu ne compte pas)
export function enRetrait(e: Engagement, jour: string) {
  const s = silence(e, jour)
  return {
    communications: !!e.communications && e.communications.fait / e.communications.total < SEUIL_LECTURE,
    taches: !!e.taches && e.taches.fait / e.taches.total < SEUIL_TACHES,
    messages: s === null || s > SEUIL_SILENCE,
    reunions: !!e.reunions && e.reunions.fait / e.reunions.total < SEUIL_REUNIONS,
  }
}
export const peuEngage = (e: Engagement, jour: string) => Object.values(enRetrait(e, jour)).filter(Boolean).length >= 2

// Repères de chaque franchisé visible ; null pour un compte hors équipe
export function useEngagement(reseau: Reseau) {
  const { profil } = useAuth()
  const { messagerie } = useMessagerie()
  const { presences } = usePresences()
  const equipe = profil?.role === 'directeur' || profil?.role === 'rr' || profil?.role === 'coach'
  const lit = profil?.role === 'directeur' || profil?.role === 'rr'
  const [sources, setSources] = useState<{ communications: Communication[]; lectures: Map<number, Lecture> | null }>({ communications: [], lectures: null })
  useEffect(() => {
    if (!lit) return
    let actif = true
    void Promise.all([chargerCommunications(), chargerLectures()]).then(([c, l]) => { if (actif) setSources({ communications: c?.liste ?? [], lectures: l }) }).catch(() => {})
    return () => { actif = false }
  }, [lit])
  return useMemo(() => {
    if (!equipe) return null
    const messages = messagerie?.messages ?? []
    return (nom: string, magasins: string[]) => engagementDe(reseau, nom, magasins, { ...sources, messages, presences })
  }, [equipe, reseau, sources, messagerie, presences])
}
