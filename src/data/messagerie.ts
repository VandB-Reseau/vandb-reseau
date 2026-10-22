// Messagerie (scripts supabase/migrations/0006_messagerie.sql et 0018_echanges_groupes.sql). Trois sortes de fils :
// - le groupe de chaque magasin, en deux fils : « Avec le franchisé » et « Équipe seule » (equipe, jamais montré au franchisé) ;
// - les groupes libres (créés par le Directeur de réseau ou un RR), lus par leurs seuls membres ;
// - les échanges privés à deux, avec des magasins cités en option.
// Tout passe par des fonctions de la base.
import { supabase } from '../lib/supabase'
import type { Profil } from '../auth/roles'
import { associesEnPlace } from './associes'
import { libelleResponsable, visiteFaite, type Magasin, type Reseau } from './modele'
import { normaliserPieces, type Piece } from '../lib/pieces'
import { notifier } from '../lib/notifications'

// destinataire : clé de la personne à qui le message est écrit (null = groupe d'un magasin ou groupe libre) ;
// magasins : magasins cités (groupe d'un magasin : son magasin) ; equipe : fil « Équipe seule » ; groupe : groupe libre
export interface Message {
  id: number; auteur: string; auteurNom: string; auteurRole: string; auteurCle: string | null; destinataire: string | null
  texte: string; mentions: string[]; creeLe: string; equipe: boolean; magasins: string[]; pieces: Piece[]; groupe: number | null
}
export type Sujet = 'messages' | 'visites' | 'equipe'
// Groupe libre : membres = clés des personnes ; creePar : compte qui l'a créé (il le renomme et change ses membres)
export interface Groupe { id: number; nom: string; membres: string[]; creePar: string }
// lus : dernière lecture par « magasin|sujet », « personne:<clé>|messages » ou « groupe:<id>|messages » ;
// reference : ouverture de l'accès d'un franchisé ; version 3 : échanges à deux ; version 4 : groupes (0018) ; cle : clé du compte connecté
export interface Messagerie { moi: string; cle: string; version: number; reference: string; messages: Message[]; lus: Record<string, string>; groupes: Groupe[] }

// Un fil : groupe d'un magasin (avec le franchisé, ou équipe seule), groupe libre, ou échange avec une personne
export type Fil = { genre: 'magasin'; magasin: string; equipe: boolean } | { genre: 'groupe'; id: number } | { genre: 'personne'; cle: string }
// Désignation du fil pour la base : magasin:<nom>, equipe:<nom>, groupe:<id>
export const cleFil = (f: Fil) => (f.genre === 'magasin' ? `${f.equipe ? 'equipe' : 'magasin'}:${f.magasin}` : f.genre === 'groupe' ? `groupe:${f.id}` : `personne:${f.cle}`)
// Fil auquel appartient un message
export function filDe(x: Message, mg: Messagerie): Fil | null {
  if (x.groupe !== null) return { genre: 'groupe', id: x.groupe }
  if (x.destinataire) { const c = interlocuteur(x, mg); return c ? { genre: 'personne', cle: c } : null }
  return x.magasins[0] ? { genre: 'magasin', magasin: x.magasins[0], equipe: x.equipe } : null
}
export const lienFil = (f: Fil) => (f.genre === 'magasin' ? `/echanges/magasin/${encodeURIComponent(f.magasin)}${f.equipe ? '?fil=equipe' : ''}`
  : f.genre === 'groupe' ? `/echanges/groupe/${f.id}` : lienPersonne(f.cle))

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
    const groupe = m.groupe === null || m.groupe === undefined ? null : Number(m.groupe)
    const destinataire = m.destinataire && groupe === null ? t(m.destinataire) : null
    const magasins = destinataire ? (Array.isArray(m.magasins) ? m.magasins.map(String) : []) : m.store ? [t(m.store)] : []
    const lot = !destinataire && m.lot ? t(m.lot) : ''
    const deja = lot ? lots.get(lot) : undefined
    if (deja) { deja.magasins.push(...magasins); continue }
    const x: Message = {
      id: Number(m.id), auteur: t(m.auteur), auteurNom: t(m.auteur_nom), auteurRole: t(m.auteur_role), auteurCle: m.auteur_cle ? t(m.auteur_cle) : null,
      destinataire, texte: t(m.texte), mentions: Array.isArray(m.mentions) ? m.mentions.map(String) : [], creeLe: t(m.cree_le), equipe: m.equipe === true, magasins: groupe === null ? magasins : [], pieces: normaliserPieces(m.pieces), groupe,
    }
    if (lot) lots.set(lot, x)
    messages.push(x)
  }
  return {
    moi: t(d.moi), cle: t(d.cle), version: Number(d.version) || 1, reference: t(d.reference), messages,
    lus: d.lus && typeof d.lus === 'object' ? Object.fromEntries(Object.entries(d.lus as Ligne).map(([k, v]) => [k, t(v)])) : {},
    groupes: (Array.isArray(d.groupes) ? d.groupes as Ligne[] : []).map((g) => ({ id: Number(g.id), nom: t(g.nom), membres: Array.isArray(g.membres) ? g.membres.map(String) : [], creePar: t(g.cree_par) })),
  }
}

// Message dans le groupe d'un magasin ou un groupe libre ; mentions : clés des personnes citées par « @ ».
// Base d'avant 0018 : le groupe d'un magasin passe par l'ancien envoi (sans pièces jointes).
export async function envoyerDansFil(f: Fil, texte: string, mentions: string[], pieces: Piece[], version: number) {
  if (f.genre === 'personne') throw new ErreurMessage('fil')
  const { data, error } = version >= 4
    ? await supabase.rpc('envoyer_fil', { p_fil: cleFil(f), p_texte: texte, p_mentions: mentions, ...(pieces.length ? { p_pieces: pieces } : {}) })
    : f.genre === 'magasin'
      ? await supabase.rpc('envoyer_message', { p_store: f.magasin, p_texte: texte, p_mentions: mentions, p_equipe: f.equipe })
      : { data: null, error: { message: 'groupes_absents' } }
  if (error) throw new ErreurMessage(error.message)
  const id = Number((data as { id?: unknown } | null)?.id)
  if (version >= 4 && id) notifier('message', [id])
}

export async function marquerLuFil(f: Fil, version: number) {
  if (f.genre === 'personne') return marquerLuPersonne(f.cle)
  if (version >= 4) { await supabase.rpc('marquer_lu_fil', { p_fil: cleFil(f) }); return }
  if (f.genre === 'magasin') await marquerLu(f.magasin, f.equipe ? 'equipe' : 'messages')
}

// Groupes libres
export async function creerGroupe(nom: string, membres: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('creer_groupe', { p_nom: nom, p_membres: membres })
  if (error) throw new ErreurMessage(error.message)
  return Number(data)
}
export async function modifierGroupe(id: number, nom: string, membres: string[]) {
  const { error } = await supabase.rpc('modifier_groupe', { p_id: id, p_nom: nom, p_membres: membres })
  if (error) throw new ErreurMessage(error.message)
}
export async function quitterGroupe(id: number) {
  const { error } = await supabase.rpc('quitter_groupe', { p_id: id })
  if (error) throw new ErreurMessage(error.message)
}
export async function supprimerGroupe(id: number) {
  const { error } = await supabase.rpc('supprimer_groupe', { p_id: id })
  if (error) throw new ErreurMessage(error.message)
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

// Aperçu de l'espace d'un franchisé : jamais les échanges privés, les groupes libres ni « Équipe seule » du compte connecté
export const sansPrives = (mg: Messagerie): Messagerie => ({ ...mg, groupes: [], messages: mg.messages.filter((x) => !x.destinataire && x.groupe === null && !x.equipe) })

// Personnes d'un fil qu'on peut citer avec « @ » (jamais un franchisé dans « Équipe seule »)
export function membresDuFil(reseau: Reseau, f: Fil, membres: string[] = []): Participant[] {
  if (f.genre === 'personne') return []
  if (f.genre === 'groupe') return membres.map((cle) => ({ cle, nom: nomDe(reseau, cle), role: roleDeCle(cle) }))
  const m = reseau.magasins.find((x) => x.nom === f.magasin)
  return m ? participants(reseau, m).filter((p) => !(f.equipe && p.cle.startsWith('franchise:'))) : []
}
export const roleDeCle = (cle: string) => libelleAuteur[cle.split(':')[0]] ?? ''

// ── Lectures ──
const instant = (iso: string) => { const n = Date.parse(iso); return isNaN(n) ? 0 : n }
export const derniereLecture = (mg: Messagerie, magasin: string, sujet: Sujet) => instant(mg.lus[`${magasin}|${sujet}`] ?? mg.reference)
export const lecturePersonne = (mg: Messagerie, cle: string) => instant(mg.lus[`personne:${cle}|messages`] ?? mg.reference)
// Avant 0018, « Équipe seule » se lisait avec le reste du magasin
export function lectureFil(mg: Messagerie, f: Fil): number {
  if (f.genre === 'personne') return lecturePersonne(mg, f.cle)
  if (f.genre === 'groupe') return instant(mg.lus[`groupe:${f.id}|messages`] ?? mg.reference)
  return derniereLecture(mg, f.magasin, f.equipe && mg.version >= 4 ? 'equipe' : 'messages')
}

// L'autre personne d'un échange à deux (null : message d'un groupe)
export const interlocuteur = (x: Message, mg: Messagerie) => (x.destinataire ? (x.auteur === mg.moi ? x.destinataire : x.auteurCle) : null)

// Message d'un autre arrivé depuis la dernière lecture de son fil
export function estNouveau(x: Message, mg: Messagerie): boolean {
  if (x.auteur === mg.moi) return false
  const f = filDe(x, mg)
  return !!f && instant(x.creeLe) > lectureFil(mg, f)
}

export function messagesDuFil(mg: Messagerie | null, f: Fil): Message[] {
  return (mg?.messages ?? []).filter((x) => (f.genre === 'groupe' ? x.groupe === f.id
    : f.genre === 'personne' ? !!x.destinataire && interlocuteur(x, mg!) === f.cle
    : !x.destinataire && x.groupe === null && x.equipe === f.equipe && x.magasins.includes(f.magasin)))
}

// Groupe d'un magasin (ses deux fils)
export const messagesDu = (mg: Messagerie | null, magasin: string) => (mg?.messages ?? []).filter((x) => !x.destinataire && x.groupe === null && x.magasins.includes(magasin))

// Message de l'échange avec une personne
export const concerne = (x: Message, c: Contact, mg: Messagerie) => !!x.destinataire && interlocuteur(x, mg) === c.cle

// ── Personnes avec qui l'on échange à deux ──
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

export const lienPersonne = (cle: string) => `/echanges/personne/${encodeURIComponent(cle)}`

// ── Qui est prévenu (Joseph, 21/10/2026) ──
// Échanges à deux et groupes libres : toujours. Groupe d'un magasin : le franchisé et le Coach du magasin de tout ;
// le RR et le Directeur seulement quand on les cite par « @ » ou s'ils ont déjà écrit dans ce fil.
export interface Destinataire { franchise: boolean; cles: string[]; magasinsCoach: Set<string>; ecritDans: Set<string> }
export function destinataireDe(reseau: Reseau, profil: Profil | null, mg: Messagerie): Destinataire {
  const coach = profil?.role === 'coach' ? profil.perimetre.coachs?.[0] : undefined
  const ecritDans = new Set<string>()
  for (const x of mg.messages) if (x.auteur === mg.moi) { const f = filDe(x, mg); if (f) ecritDans.add(cleFil(f)) }
  return { franchise: profil?.role === 'franchise', cles: mesCles(profil), magasinsCoach: new Set(coach ? reseau.magasins.filter((m) => m.coach === coach).map((m) => m.nom) : []), ecritDans }
}
export const estMention = (x: Message, d: Destinataire) => x.mentions.some((k) => d.cles.includes(k))
export function pourMoi(x: Message, mg: Messagerie, d: Destinataire): boolean {
  const f = filDe(x, mg)
  if (!f) return false
  if (f.genre !== 'magasin') return true
  return d.franchise || estMention(x, d) || d.magasinsCoach.has(f.magasin) || d.ecritDans.has(cleFil(f))
}

// ── Conversations de l'onglet Échanges ──
// nonLus : messages non lus du fil ; pourMoi : ceux qui comptent dans le total (règle ci-dessus) ; mention : on m'a cité
export interface Conversation {
  cle: string; genre: Fil['genre']; titre: string; detail: string; lien: string; recherche: string
  dernier: Message | null; nonLus: number; pourMoi: number; mention: boolean
  contact?: Contact; groupe?: Groupe; magasin?: Magasin
}

// magasins : ceux dont le compte voit le groupe
export function conversations(reseau: Reseau, mg: Messagerie, profil: Profil | null, magasins: Magasin[]): Conversation[] {
  const d = destinataireDe(reseau, profil, mg)
  const bilan = (liste: Message[]) => {
    const nouveaux = liste.filter((x) => estNouveau(x, mg))
    return { dernier: liste.at(-1) ?? null, nonLus: nouveaux.length, pourMoi: nouveaux.filter((x) => pourMoi(x, mg, d)).length, mention: nouveaux.some((x) => estMention(x, d)) }
  }
  const res: Conversation[] = []
  const parMagasin = new Map<string, Message[]>()
  for (const x of mg.messages) {
    if (x.destinataire || x.groupe !== null || !x.magasins[0]) continue
    const l = parMagasin.get(x.magasins[0]); if (l) l.push(x); else parMagasin.set(x.magasins[0], [x])
  }
  for (const m of magasins) {
    const gens = participants(reseau, m).filter((p) => p.cle !== 'directeur')
    res.push({ cle: `magasin:${m.nom}`, genre: 'magasin', titre: m.nom, detail: gens.map((p) => p.nom).join(', '), lien: lienFil({ genre: 'magasin', magasin: m.nom, equipe: false }),
      recherche: `${m.nom} ${m.ville ?? ''} ${gens.map((p) => p.nom).join(' ')}`, magasin: m, ...bilan(parMagasin.get(m.nom) ?? []) })
  }
  for (const g of mg.groupes) {
    const noms = g.membres.filter((k) => k !== mg.cle).map((k) => nomDe(reseau, k))
    res.push({ cle: `groupe:${g.id}`, genre: 'groupe', titre: g.nom, detail: noms.join(', '), lien: lienFil({ genre: 'groupe', id: g.id }), recherche: `${g.nom} ${noms.join(' ')}`, groupe: g,
      ...bilan(mg.messages.filter((x) => x.groupe === g.id)) })
  }
  for (const c of contacts(reseau, profil, mg)) {
    res.push({ cle: `personne:${c.cle}`, genre: 'personne', titre: c.nom, detail: [c.role, c.magasins.length > 3 ? `${c.magasins.length} magasins` : c.magasins.map((m) => m.nom).join(', ')].filter(Boolean).join(' · '),
      lien: lienPersonne(c.cle), recherche: `${c.nom} ${c.magasins.map((m) => `${m.nom} ${m.ville ?? ''}`).join(' ')}`, contact: c,
      ...bilan(mg.messages.filter((x) => concerne(x, c, mg))) })
  }
  return res.sort((a, b) => (b.dernier ? instant(b.dernier.creeLe) : -1) - (a.dernier ? instant(a.dernier.creeLe) : -1) || a.titre.localeCompare(b.titre, 'fr'))
}

// Nouveaux comptes rendus de visite pour un franchisé, par magasin
export function visitesALire(reseau: Reseau, profil: Profil | null, mg: Messagerie): { magasin: string; nombre: number }[] {
  if (profil?.role !== 'franchise') return []
  return reseau.magasins.map((m) => {
    const lu = derniereLecture(mg, m.nom, 'visites')
    return { magasin: m.nom, nombre: reseau.visites.filter((v) => v.magasin === m.nom && visiteFaite(v, reseau.jour) && instant(v.creeLe ?? '') > lu).length }
  }).filter((x) => x.nombre > 0)
}

// Nombre affiché sur l'onglet Échanges : messages qui me concernent, nouveaux comptes rendus (franchisé)
export function totalALire(reseau: Reseau | null, profil: Profil | null, mg: Messagerie | null): number {
  if (!reseau || !mg) return 0
  const d = destinataireDe(reseau, profil, mg)
  return mg.messages.filter((x) => estNouveau(x, mg) && pourMoi(x, mg, d)).length + visitesALire(reseau, profil, mg).reduce((t, x) => t + x.nombre, 0)
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

