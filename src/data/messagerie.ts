// Messagerie par magasin (script supabase/messagerie.sql) : un fil par magasin entre le Directeur de réseau,
// les Responsables Régionaux, les Coachs et les franchisés. Tout passe par des fonctions de la base.
import { supabase } from '../lib/supabase'
import type { Profil } from '../auth/roles'
import { associesEnPlace } from './associes'
import { libelleResponsable, type Magasin, type Reseau } from './modele'
import { lienFiche } from '../lib/format'

export interface Message { id: number; magasin: string; auteur: string; auteurNom: string; auteurRole: string; texte: string; mentions: string[]; creeLe: string }
export type Sujet = 'messages' | 'visites'
// lus : dernière lecture par « magasin|sujet » ; reference : ouverture de l'accès d'un franchisé
export interface Messagerie { moi: string; reference: string; messages: Message[]; lus: Record<string, string> }

export class ErreurMessage extends Error {}

type Ligne = Record<string, unknown>
const t = (v: unknown) => (v === null || v === undefined ? '' : String(v))

// null : messagerie pas encore activée dans la base (ou compte sans accès)
export async function chargerMessagerie(): Promise<Messagerie | null> {
  const { data, error } = await supabase.rpc('messagerie')
  if (error || !data || typeof data !== 'object') return null
  const d = data as Ligne
  return {
    moi: t(d.moi), reference: t(d.reference),
    messages: (Array.isArray(d.messages) ? d.messages as Ligne[] : []).map((m) => ({
      id: Number(m.id), magasin: t(m.store), auteur: t(m.auteur), auteurNom: t(m.auteur_nom), auteurRole: t(m.auteur_role),
      texte: t(m.texte), mentions: Array.isArray(m.mentions) ? m.mentions.map(String) : [], creeLe: t(m.cree_le),
    })),
    lus: d.lus && typeof d.lus === 'object' ? Object.fromEntries(Object.entries(d.lus as Ligne).map(([k, v]) => [k, t(v)])) : {},
  }
}

export async function envoyerMessage(magasin: string, texte: string, mentions: string[]) {
  const { error } = await supabase.rpc('envoyer_message', { p_store: magasin, p_texte: texte, p_mentions: mentions })
  if (error) throw new ErreurMessage(error.message)
}

export async function marquerLu(magasin: string, sujet: Sujet) {
  await supabase.rpc('marquer_lu', { p_store: magasin, p_sujet: sujet })
}

export async function supprimerMessage(id: number) {
  const { error } = await supabase.rpc('supprimer_message', { p_id: id })
  if (error) throw new ErreurMessage(error.message)
}

export const libelleAuteur: Record<string, string> = { directeur: 'Directeur de réseau', rr: 'Responsable Régional', coach: 'Coach', franchise: 'Franchisé' }

// ── Mentions ──
// Clés : directeur, rr:<id>, coach:<nom>, franchise:<nom>
export interface Participant { cle: string; nom: string; role: string }

export function participants(reseau: Reseau, m: Magasin): Participant[] {
  const l: Participant[] = []
  const ajouter = (p: Participant) => { if (p.nom.trim() && !l.some((x) => x.cle === p.cle)) l.push(p) }
  if (m.coach) ajouter({ cle: `coach:${m.coach}`, nom: m.coach, role: 'Coach' })
  if (m.rr) ajouter({ cle: `rr:${m.rr.id}`, nom: m.rr.nom, role: m.rr.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional' })
  if (reseau.directeur?.nom) ajouter({ cle: 'directeur', nom: reseau.directeur.nom, role: 'Directeur de réseau' })
  const franchises = associesEnPlace(reseau, m).map((a) => a.nom)
  for (const nom of franchises.length ? franchises : m.responsable ? [m.responsable.nom] : []) ajouter({ cle: `franchise:${nom}`, nom, role: libelleResponsable(m) })
  return l
}

// Clés sous lesquelles le compte connecté peut être mentionné
export function mesCles(profil: Profil | null): string[] {
  if (!profil) return []
  if (profil.role === 'directeur') return ['directeur']
  if (profil.role === 'rr') return (profil.perimetre.rr ?? []).map((id) => `rr:${id}`)
  if (profil.role === 'coach') return (profil.perimetre.coachs ?? []).map((n) => `coach:${n}`)
  if (profil.role === 'franchise' && profil.perimetre.franchise) return [`franchise:${profil.perimetre.franchise}`]
  return []
}

// Participants dont « @Nom » figure dans le texte
export function mentionsDans(texte: string, liste: Participant[]): string[] {
  const bas = texte.toLocaleLowerCase('fr')
  return liste.filter((p) => bas.includes(`@${p.nom.toLocaleLowerCase('fr')}`)).map((p) => p.cle)
}

// ── Lectures et notifications ──
const instant = (iso: string) => { const n = Date.parse(iso); return isNaN(n) ? 0 : n }
export const derniereLecture = (mg: Messagerie, magasin: string, sujet: Sujet) => instant(mg.lus[`${magasin}|${sujet}`] ?? mg.reference)

export const messagesDu = (mg: Messagerie | null, magasin: string) => (mg?.messages ?? []).filter((m) => m.magasin === magasin)

// Messages d'autres personnes arrivés depuis la dernière lecture du fil
export const nonLus = (mg: Messagerie, magasin: string) => {
  const lu = derniereLecture(mg, magasin, 'messages')
  return messagesDu(mg, magasin).filter((m) => m.auteur !== mg.moi && instant(m.creeLe) > lu)
}

export const lienConversation = (magasin: string) => `/messages/${encodeURIComponent(magasin)}`

// ── Conversations : une par magasin, la plus récente d'abord ──
export interface Conversation { magasin: Magasin; dernier: Message | null; nonLus: number; mention: boolean }

export function conversations(reseau: Reseau, mg: Messagerie, cles: string[]): Conversation[] {
  const parMagasin = new Map<string, Message[]>()
  for (const x of mg.messages) {
    const l = parMagasin.get(x.magasin)
    if (l) l.push(x); else parMagasin.set(x.magasin, [x])
  }
  return reseau.magasins.map((m) => {
    const liste = parMagasin.get(m.nom) ?? []
    const lu = derniereLecture(mg, m.nom, 'messages')
    const nouveaux = liste.filter((x) => x.auteur !== mg.moi && instant(x.creeLe) > lu)
    return { magasin: m, dernier: liste.at(-1) ?? null, nonLus: nouveaux.length, mention: nouveaux.some((x) => x.mentions.some((k) => cles.includes(k))) }
  }).sort((a, b) => (b.dernier ? instant(b.dernier.creeLe) : -1) - (a.dernier ? instant(a.dernier.creeLe) : -1) || a.magasin.nom.localeCompare(b.magasin.nom, 'fr'))
}

export type TypeNotification = 'message' | 'mention' | 'visite'
export interface Notification { cle: string; magasin: string; type: TypeNotification; nombre: number; date: string; apercu: string; lien: string; sujet: Sujet }

// Franchisé : tout ce qui arrive sur ses magasins (messages, comptes rendus de visite).
// Coach : les messages de ses magasins et ceux où il est mentionné. Responsable Régional et Directeur : mentions seulement.
export function notifications(reseau: Reseau | null, profil: Profil | null, mg: Messagerie | null): Notification[] {
  if (!reseau || !profil || !mg) return []
  const cles = mesCles(profil)
  const coach = profil.role === 'coach' ? profil.perimetre.coachs?.[0] : undefined
  const sesMagasins = new Set(coach ? reseau.magasins.filter((m) => m.coach === coach).map((m) => m.nom) : [])
  const franchise = profil.role === 'franchise'
  const res: Notification[] = []
  for (const magasin of [...new Set(mg.messages.map((m) => m.magasin))]) {
    const lus = nonLus(mg, magasin)
    const mentions = lus.filter((m) => m.mentions.some((k) => cles.includes(k)))
    const retenus = franchise || sesMagasins.has(magasin) ? lus : mentions
    if (!retenus.length) continue
    const dernier = retenus[retenus.length - 1]
    res.push({
      cle: `m|${magasin}`, magasin, type: mentions.length ? 'mention' : 'message', nombre: retenus.length, date: dernier.creeLe, sujet: 'messages',
      apercu: `${dernier.auteurNom} : ${dernier.texte}`, lien: lienConversation(magasin),
    })
  }
  if (franchise) {
    for (const m of reseau.magasins) {
      const lu = derniereLecture(mg, m.nom, 'visites')
      const nouvelles = reseau.visites.filter((v) => v.magasin === m.nom && v.date <= reseau.jour && instant(v.creeLe ?? '') > lu)
      if (!nouvelles.length) continue
      res.push({
        cle: `v|${m.nom}`, magasin: m.nom, type: 'visite', nombre: nouvelles.length, sujet: 'visites',
        date: nouvelles.map((v) => v.creeLe ?? '').sort().at(-1) ?? '', apercu: '', lien: `${lienFiche(m.nom)}?vue=visites`,
      })
    }
  }
  return res.sort((a, b) => instant(b.date) - instant(a.date))
}

export function libelleNotification(n: Notification): string {
  if (n.type === 'visite') return n.nombre > 1 ? `${n.nombre} nouveaux comptes rendus de visite` : 'Nouveau compte rendu de visite'
  if (n.type === 'mention') return n.nombre > 1 ? `On te mentionne · ${n.nombre} nouveaux messages` : 'On te mentionne'
  return n.nombre > 1 ? `${n.nombre} nouveaux messages` : 'Nouveau message'
}

// « 19 oct. à 15:33 », avec l'année si elle n'est pas l'année en cours
export function horodatage(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const jour = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
  return `${jour} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

const debutDuJour = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const ecartJours = (d: Date, ref = new Date()) => Math.round((debutDuJour(ref) - debutDuJour(d)) / 86_400_000)

// Liste des conversations : « 15:33 », « Hier », « lun. », « 12 oct. »
export function heureCourte(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const ecart = ecartJours(d)
  if (ecart <= 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (ecart === 1) return 'Hier'
  if (ecart < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' })
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
}

// Séparateur de jour dans un fil : « Aujourd’hui », « Hier », « lundi 12 octobre »
export function jourDuFil(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const ecart = ecartJours(d)
  if (ecart <= 0) return 'Aujourd’hui'
  if (ecart === 1) return 'Hier'
  const j = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
  return j.charAt(0).toUpperCase() + j.slice(1)
}

export const heure = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
