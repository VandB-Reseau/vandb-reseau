// Messagerie (script supabase/migrations/0006_messagerie.sql) : depuis le 20/10/2026, des échanges privés à deux entre le Directeur
// de réseau, les Responsables Régionaux, les Coachs et les franchisés, avec des magasins cités en option.
// Les anciens messages par magasin (sans destinataire) restent lisibles. Tout passe par des fonctions de la base.
import { supabase } from '../lib/supabase'
import type { Profil } from '../auth/roles'
import { associesEnPlace } from './associes'
import { libelleResponsable, visiteFaite, type Magasin, type Reseau } from './modele'
import { lienFiche } from '../lib/format'
import { normaliserPieces, type Piece } from '../lib/pieces'
import { notifier } from '../lib/notifications'

// destinataire : clé de la personne à qui le message est écrit (null = ancien message par magasin) ;
// magasins : magasins cités (ancien message : son magasin) ; equipe : ancien message caché au franchisé
export interface Message {
  id: number; auteur: string; auteurNom: string; auteurRole: string; auteurCle: string | null; destinataire: string | null
  texte: string; mentions: string[]; creeLe: string; equipe: boolean; magasins: string[]; pieces: Piece[]
}
export type Sujet = 'messages' | 'visites'
// lus : dernière lecture par « magasin|sujet » ou « personne:<clé>|messages » ; reference : ouverture de l'accès d'un franchisé ;
// version 3 : échanges à deux (script 0006_messagerie.sql repassé) ; cle : clé du compte connecté
export interface Messagerie { moi: string; cle: string; version: number; reference: string; messages: Message[]; lus: Record<string, string> }

export class ErreurMessage extends Error {}

// Texte d'aperçu : un message fait seulement de pièces jointes est annoncé comme tel
export const apercuDe = (x: Message) => x.texte || (x.pieces.length > 1 ? `${x.pieces.length} pièces jointes` : x.pieces[0]?.type.startsWith('image/') ? 'Photo' : 'Fichier joint')

type Ligne = Record<string, unknown>
const t = (v: unknown) => (v === null || v === undefined ? '' : String(v))

// null : messagerie pas encore activée dans la base (ou compte sans accès).
// Un ancien envoi sur plusieurs magasins (même lot) devient un seul message.
export async function chargerMessagerie(): Promise<Messagerie | null> {
  const { data, error } = await supabase.rpc('messagerie')
  if (error || !data || typeof data !== 'object') return null
  const d = data as Ligne
  const messages: Message[] = []
  const lots = new Map<string, Message>()
  for (const m of Array.isArray(d.messages) ? d.messages as Ligne[] : []) {
    const destinataire = m.destinataire ? t(m.destinataire) : null
    const magasins = destinataire ? (Array.isArray(m.magasins) ? m.magasins.map(String) : []) : m.store ? [t(m.store)] : []
    const lot = !destinataire && m.lot ? t(m.lot) : ''
    const deja = lot ? lots.get(lot) : undefined
    if (deja) { deja.magasins.push(...magasins); continue }
    const x: Message = {
      id: Number(m.id), auteur: t(m.auteur), auteurNom: t(m.auteur_nom), auteurRole: t(m.auteur_role), auteurCle: m.auteur_cle ? t(m.auteur_cle) : null,
      destinataire, texte: t(m.texte), mentions: Array.isArray(m.mentions) ? m.mentions.map(String) : [], creeLe: t(m.cree_le), equipe: m.equipe === true, magasins, pieces: normaliserPieces(m.pieces),
    }
    if (lot) lots.set(lot, x)
    messages.push(x)
  }
  return {
    moi: t(d.moi), cle: t(d.cle), version: Number(d.version) || 1, reference: t(d.reference), messages,
    lus: d.lus && typeof d.lus === 'object' ? Object.fromEntries(Object.entries(d.lus as Ligne).map(([k, v]) => [k, t(v)])) : {},
  }
}

// Message privé à une personne. Base pas encore mise à jour (avant la version 3) : ancien message sur un magasin
// (le premier cité, sinon « repli »), la personne mentionnée pour être notifiée.
// pieces : photos et fichiers joints (échanges à deux seulement)
export async function envoyerMessage(destinataire: string, texte: string, magasins: string[], version: number, repli: string | null, pieces: Piece[] = []) {
  const { data, error } = version >= 3
    ? await supabase.rpc('envoyer_a', { p_destinataire: destinataire, p_texte: texte, p_magasins: magasins, ...(pieces.length ? { p_pieces: pieces } : {}) })
    : await supabase.rpc('envoyer_message', { p_store: magasins[0] ?? repli, p_texte: texte, p_mentions: [destinataire] })
  if (error) throw new ErreurMessage(error.message)
  const id = Number((data as { id?: unknown } | null)?.id)
  if (version >= 3 && id) notifier('message', [id])
}

export async function marquerLu(magasin: string, sujet: Sujet) {
  await supabase.rpc('marquer_lu', { p_store: magasin, p_sujet: sujet })
}

export async function marquerLuPersonne(cle: string) {
  await supabase.rpc('marquer_lu_personne', { p_cle: cle })
}

export async function supprimerMessage(id: number) {
  const { error } = await supabase.rpc('supprimer_message', { p_id: id })
  if (error) throw new ErreurMessage(error.message)
}

export const libelleAuteur: Record<string, string> = { directeur: 'Directeur de réseau', rr: 'Responsable Régional', coach: 'Coach', franchise: 'Franchisé' }

// ── Personnes ──
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

// Nom affiché d'une personne d'après sa clé
export function nomDe(reseau: Reseau, cle: string): string {
  const [genre, ...reste] = cle.split(':')
  const valeur = reste.join(':')
  if (genre === 'directeur') return reseau.directeur?.nom || 'Directeur de réseau'
  if (genre === 'rr') return reseau.magasins.find((m) => m.rr?.id === valeur)?.rr?.nom ?? 'Responsable Régional'
  return valeur
}

// Personnes à qui le compte peut écrire sur un magasin (un franchisé écrit à l'équipe, pas aux autres franchisés)
export function destinatairesDu(reseau: Reseau, m: Magasin, profil: Profil | null): Participant[] {
  const moi = mesCles(profil)
  return participants(reseau, m).filter((p) => !moi.includes(p.cle) && !(profil?.role === 'franchise' && p.cle.startsWith('franchise:')))
}

// Magasins cités par « #Nom » dans le texte
export function magasinsCites(texte: string, liste: Magasin[]): string[] {
  const bas = texte.toLocaleLowerCase('fr')
  return liste.filter((m) => bas.includes(`#${m.nom.toLocaleLowerCase('fr')}`)).map((m) => m.nom)
}

// Aperçu de l'espace d'un franchisé : jamais les échanges privés du compte connecté
export const sansPrives = (mg: Messagerie): Messagerie => ({ ...mg, messages: mg.messages.filter((x) => !x.destinataire) })

// ── Lectures ──
const instant = (iso: string) => { const n = Date.parse(iso); return isNaN(n) ? 0 : n }
export const derniereLecture = (mg: Messagerie, magasin: string, sujet: Sujet) => instant(mg.lus[`${magasin}|${sujet}`] ?? mg.reference)
export const lecturePersonne = (mg: Messagerie, cle: string) => instant(mg.lus[`personne:${cle}|messages`] ?? mg.reference)

// L'autre personne d'un échange à deux (null : ancien message par magasin)
export const interlocuteur = (x: Message, mg: Messagerie) => (x.destinataire ? (x.auteur === mg.moi ? x.destinataire : x.auteurCle) : null)

// Message d'un autre arrivé depuis la dernière lecture de l'échange (ou du fil du magasin)
export function estNouveau(x: Message, mg: Messagerie): boolean {
  if (x.auteur === mg.moi) return false
  if (x.destinataire) return !!x.auteurCle && instant(x.creeLe) > lecturePersonne(mg, x.auteurCle)
  return x.magasins.some((n) => instant(x.creeLe) > derniereLecture(mg, n, 'messages'))
}

// Messages d'une fiche magasin : les échanges du compte qui citent ce magasin, et l'ancien fil du magasin
export const messagesDu = (mg: Messagerie | null, magasin: string) => (mg?.messages ?? []).filter((x) => x.magasins.includes(magasin))

// Ancien message par magasin échangé avec une personne : écrit par elle, ou qui la mentionne
function concerneAncien(x: Message, c: { cle: string; nom: string }): boolean {
  if (x.mentions.includes(c.cle)) return true
  const [genre] = c.cle.split(':')
  return x.auteurRole === genre && (genre === 'directeur' || x.auteurNom === c.nom)
}

// Message de l'échange avec une personne
export function concerne(x: Message, c: Contact, mg: Messagerie): boolean {
  return x.destinataire ? interlocuteur(x, mg) === c.cle : c.magasins.some((m) => x.magasins.includes(m.nom)) && concerneAncien(x, c)
}

// ── Conversations : une par personne, la plus récente d'abord ──
export interface Contact { cle: string; nom: string; role: string; magasins: Magasin[] }

export function contacts(reseau: Reseau, profil: Profil | null, mg?: Messagerie | null): Contact[] {
  const parCle = new Map<string, Contact>()
  for (const m of reseau.magasins) {
    for (const p of destinatairesDu(reseau, m, profil)) {
      const c = parCle.get(p.cle)
      if (c) c.magasins.push(m)
      else parCle.set(p.cle, { cle: p.cle, nom: p.nom, role: p.cle.startsWith('franchise:') ? 'Franchisé' : p.role, magasins: [m] })
    }
  }
  // Quelqu'un qui écrit sans partager de magasin aujourd'hui (réaffectation) garde sa conversation
  for (const x of mg?.messages ?? []) {
    const cle = x.destinataire && x.auteur !== mg!.moi ? x.auteurCle : null
    if (cle && !parCle.has(cle)) parCle.set(cle, { cle, nom: x.auteurNom, role: libelleAuteur[x.auteurRole] ?? '', magasins: [] })
  }
  return [...parCle.values()]
}

export interface ConversationPersonne { contact: Contact; dernier: Message | null; nonLus: number }

export function conversationsPersonnes(reseau: Reseau, mg: Messagerie, profil: Profil | null): ConversationPersonne[] {
  return contacts(reseau, profil, mg).map((contact) => {
    const liste = mg.messages.filter((x) => concerne(x, contact, mg))
    return { contact, dernier: liste.at(-1) ?? null, nonLus: liste.filter((x) => estNouveau(x, mg)).length }
  }).sort((a, b) => (b.dernier ? instant(b.dernier.creeLe) : -1) - (a.dernier ? instant(a.dernier.creeLe) : -1) || a.contact.nom.localeCompare(b.contact.nom, 'fr'))
}

export const lienPersonne = (cle: string) => `/messages/personne/${encodeURIComponent(cle)}`

// ── Notifications ──
export type TypeNotification = 'message' | 'mention' | 'visite'
// lecture : ce que « lu » marque (un échange avec une personne, ou le fil ou les visites d'un magasin)
export interface Lecture { personne?: string; magasin?: string; sujet: Sujet }
export interface Notification { cle: string; titre: string; type: TypeNotification; nombre: number; date: string; apercu: string; lien: string; lecture: Lecture }

// Chacun est notifié des messages qu'on lui écrit. Anciens messages par magasin : le franchisé tout ce qui arrive
// sur ses magasins, le Coach les messages de ses magasins et ses mentions, RR et Directeur leurs mentions.
// Franchisé : aussi les nouveaux comptes rendus de visite.
export function notifications(reseau: Reseau | null, profil: Profil | null, mg: Messagerie | null): Notification[] {
  if (!reseau || !profil || !mg) return []
  const res: Notification[] = []
  const recus = new Map<string, Message[]>()
  for (const x of mg.messages) {
    if (!x.destinataire || !x.auteurCle || !estNouveau(x, mg)) continue
    const l = recus.get(x.auteurCle)
    if (l) l.push(x); else recus.set(x.auteurCle, [x])
  }
  for (const [cle, l] of recus) {
    const dernier = l[l.length - 1]
    res.push({ cle: `p|${cle}`, titre: dernier.auteurNom, type: 'message', nombre: l.length, date: dernier.creeLe, apercu: apercuDe(dernier), lien: lienPersonne(cle), lecture: { personne: cle, sujet: 'messages' } })
  }
  const cles = mesCles(profil)
  const coach = profil.role === 'coach' ? profil.perimetre.coachs?.[0] : undefined
  const sesMagasins = new Set(coach ? reseau.magasins.filter((m) => m.coach === coach).map((m) => m.nom) : [])
  const franchise = profil.role === 'franchise'
  const anciens = new Map<string, Message[]>()
  for (const x of mg.messages) {
    if (x.destinataire || !estNouveau(x, mg)) continue
    for (const n of x.magasins) { const l = anciens.get(n); if (l) l.push(x); else anciens.set(n, [x]) }
  }
  for (const [magasin, lus] of anciens) {
    const mentions = lus.filter((m) => m.mentions.some((k) => cles.includes(k)))
    const retenus = franchise || sesMagasins.has(magasin) ? lus : mentions
    if (!retenus.length) continue
    const dernier = retenus[retenus.length - 1]
    res.push({
      cle: `m|${magasin}`, titre: magasin, type: mentions.length ? 'mention' : 'message', nombre: retenus.length, date: dernier.creeLe,
      apercu: `${dernier.auteurNom} : ${apercuDe(dernier)}`, lien: `${lienFiche(magasin)}?vue=messages`, lecture: { magasin, sujet: 'messages' },
    })
  }
  if (franchise) {
    for (const m of reseau.magasins) {
      const lu = derniereLecture(mg, m.nom, 'visites')
      const nouvelles = reseau.visites.filter((v) => v.magasin === m.nom && visiteFaite(v, reseau.jour) && instant(v.creeLe ?? '') > lu)
      if (!nouvelles.length) continue
      res.push({
        cle: `v|${m.nom}`, titre: m.nom, type: 'visite', nombre: nouvelles.length, lecture: { magasin: m.nom, sujet: 'visites' },
        date: nouvelles.map((v) => v.creeLe ?? '').sort().at(-1) ?? '', apercu: '', lien: `${lienFiche(m.nom)}?vue=visites`,
      })
    }
  }
  return res.sort((a, b) => instant(b.date) - instant(a.date))
}

// Historique : chaque nouveauté une par une, conservée après lecture (messages des 18 derniers mois)
export interface Evenement { cle: string; type: TypeNotification; magasins: string[]; date: string; auteur: string; texte: string; lien: string; nouveau: boolean; lecture: Lecture }

export function historique(reseau: Reseau | null, profil: Profil | null, mg: Messagerie | null): Evenement[] {
  if (!reseau || !profil || !mg) return []
  const cles = mesCles(profil)
  const coach = profil.role === 'coach' ? profil.perimetre.coachs?.[0] : undefined
  const sesMagasins = new Set(coach ? reseau.magasins.filter((m) => m.coach === coach).map((m) => m.nom) : [])
  const franchise = profil.role === 'franchise'
  const res: Evenement[] = []
  for (const x of mg.messages) {
    if (x.auteur === mg.moi) continue
    const base = { cle: `m|${x.id}`, magasins: x.magasins, date: x.creeLe, auteur: x.auteurNom, texte: apercuDe(x), nouveau: estNouveau(x, mg) }
    if (x.destinataire) {
      if (x.auteurCle) res.push({ ...base, type: 'message', lien: lienPersonne(x.auteurCle), lecture: { personne: x.auteurCle, sujet: 'messages' } })
      continue
    }
    const mention = x.mentions.some((k) => cles.includes(k))
    if (!mention && !franchise && !x.magasins.some((n) => sesMagasins.has(n))) continue
    res.push({ ...base, type: mention ? 'mention' : 'message', lien: `${lienFiche(x.magasins[0])}?vue=messages`, lecture: { magasin: x.magasins[0], sujet: 'messages' } })
  }
  if (franchise) {
    for (const v of reseau.visites) {
      if (!visiteFaite(v, reseau.jour) || !v.creeLe) continue
      res.push({
        cle: `v|${v.id}`, type: 'visite', magasins: [v.magasin], date: v.creeLe, auteur: v.visiteurs.join(', '), texte: '', lecture: { magasin: v.magasin, sujet: 'visites' },
        lien: `${lienFiche(v.magasin)}?vue=visites`, nouveau: instant(v.creeLe) > derniereLecture(mg, v.magasin, 'visites'),
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

