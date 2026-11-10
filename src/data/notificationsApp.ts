// Notifications dans l'app (refonte vague 2, Joseph 09/11/2026, 10A) : ce qui doit arriver sans qu'on aille le chercher.
// Calculées à partir des données déjà lues (tâches, visites) et des commentaires récents des budgets ; aucune table en
// plus. Les notifications lues sont gardées sur l'appareil et, pour l'équipe, recopiées dans les préférences du compte.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { Reseau } from './modele'
import type { Profil } from '../auth/roles'
import { actionsDes, enRetard, monNomPorteur, portePar } from './actions'
import { lienCompteRendu, visitesDuMagasin } from './visites'
import { caDe, decalerMois, libelleMois } from './chiffres'
import { brancher, preferenceChangee } from '../lib/preferences'
import { pilotage } from '../pilotage/lib/supabase'

export type GenreNotification = 'commentaire' | 'tache' | 'retard' | 'compteRendu' | 'rapport'
export interface NotificationApp { id: string; genre: GenreNotification; titre: string; detail: string; quand: string; lien: string }

const CLE = 'vandb-notifications-lues'
const MAX = 400
const abonnes = new Set<() => void>()
let actuel: string[] | null | undefined

function lire(): string[] | null {
  if (actuel !== undefined) return actuel
  try {
    const v = JSON.parse(localStorage.getItem(CLE) ?? 'null') as unknown
    actuel = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null
  } catch { actuel = null }
  return actuel
}
function ecrireIci(l: string[]) {
  actuel = l.slice(-MAX)
  try { localStorage.setItem(CLE, JSON.stringify(actuel)) } catch { /* gardé pour la session */ }
  abonnes.forEach((f) => f())
}
brancher('notificationsLues', { lire: () => lire() ?? [], appliquer: (v) => {
  if (!Array.isArray(v)) return
  const l = lire() ?? []
  const ajout = v.filter((x): x is string => typeof x === 'string' && !l.includes(x))
  if (ajout.length || lire() === null) ecrireIci([...l, ...ajout])
} })
const abonner = (f: () => void) => { abonnes.add(f); return () => { abonnes.delete(f) } }

export function marquerLues(ids: string[]) {
  const l = lire() ?? []
  const ajout = ids.filter((i) => !l.includes(i))
  if (!ajout.length) return
  ecrireIci([...l, ...ajout])
  preferenceChangee()
}

const JOURS = 21
const ilYA = (jour: string, n: number) => { const d = new Date(`${jour}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

// Événements tirés des données du réseau déjà chargées
export function notificationsDuReseau(reseau: Reseau, profil: Profil | null): NotificationApp[] {
  const moi = monNomPorteur(reseau, profil)
  const depuis = ilYA(reseau.jour, JOURS)
  const r: NotificationApp[] = []
  if (moi) {
    for (const x of actionsDes(reseau, null)) {
      if (x.a.faite || !portePar(x.a, moi)) continue
      const confiee = x.libre ? !!x.libre.auteur && x.libre.auteur !== moi : !x.visite?.visiteurs.includes(moi)
      const date = x.libre?.creeLe ?? x.visite?.date ?? x.date
      if (confiee && date >= depuis) r.push({ id: `t:${x.cle}`, genre: 'tache', titre: 'Tâche confiée', detail: `${x.libre?.auteur ? `${x.libre.auteur} · ` : ''}${x.a.action} · ${x.magasin}`, quand: date, lien: '/taches' })
      if (enRetard(x.a, reseau.jour)) r.push({ id: `r:${x.cle}:${x.a.echeance}`, genre: 'retard', titre: 'Tâche en retard', detail: `${x.a.action} · ${x.magasin}`, quand: x.a.echeance, lien: '/taches' })
    }
  }
  if (profil?.role !== 'franchise') {
    // Vague 3 (29A) : un nouveau mois de caisse, un nouveau rapport du mois
    const mois = Object.values(reseau.chiffres).map((l) => l.filter((c) => caDe(c) !== null).at(-1)?.mois ?? '').sort().at(-1)
    if (mois) r.push({ id: `rapport:${mois}`, genre: 'rapport', titre: `Rapport de ${libelleMois(mois)}`, detail: 'Chiffres, visites, tâches et objectifs du mois sur ton périmètre', quand: `${decalerMois(mois, 1)}-01`, lien: '/performance?vue=rapports' })
    for (const m of reseau.magasins) {
      for (const v of visitesDuMagasin(reseau, m.nom)) {
        if (!v.id || v.prevue || v.date < depuis || v.date > reseau.jour || (moi && v.visiteurs.includes(moi))) continue
        r.push({ id: `v:${v.id}`, genre: 'compteRendu', titre: 'Compte rendu publié', detail: `${v.visiteurs.join(', ') || 'Visite'} · ${m.nom}`, quand: v.date, lien: lienCompteRendu(v) })
      }
    }
  }
  return r
}

// Commentaires des budgets écrits par d'autres ces dernières semaines (la base ne renvoie que les magasins du compte)
interface CommentaireRecent { id: number; store_name: string; ancre_libelle: string | null; texte: string; auteur: string | null; auteur_nom: string | null; cree_le: string }
async function commentairesRecents(depuis: string, moi: string | undefined): Promise<NotificationApp[]> {
  try {
    const { data, error } = await pilotage().from('echanges_budget').select('id, store_name, ancre_libelle, texte, auteur, auteur_nom, cree_le').gte('cree_le', depuis).order('cree_le', { ascending: false }).limit(40)
    if (error || !Array.isArray(data)) return []
    return (data as CommentaireRecent[]).filter((c) => !moi || c.auteur !== moi).map((c) => ({
      id: `c:${c.id}`, genre: 'commentaire' as const, titre: `${c.store_name} · Budget`,
      detail: `${c.auteur_nom ?? 'Quelqu’un'} a commenté${c.ancre_libelle ? ` « ${c.ancre_libelle} »` : ''} : « ${c.texte.length > 120 ? `${c.texte.slice(0, 117)}…` : c.texte} »`,
      quand: c.cree_le.slice(0, 10), lien: `/magasins/${encodeURIComponent(c.store_name)}?vue=budget&partie=budget&commentaires=1`,
    }))
  } catch { return [] }
}

export function useNotificationsApp(reseau: Reseau | null, profil: Profil | null, actif: boolean) {
  const lues = useSyncExternalStore(abonner, lire, () => null)
  const [commentaires, setCommentaires] = useState<NotificationApp[] | null>(null)
  const jour = reseau?.jour
  useEffect(() => {
    if (!actif || !jour) return
    let vivant = true
    void commentairesRecents(ilYA(jour, JOURS), profil?.id).then((c) => vivant && setCommentaires(c))
    return () => { vivant = false }
  }, [actif, jour, profil?.id])
  const toutes = useMemo(() => (reseau && actif ? [...(commentaires ?? []), ...notificationsDuReseau(reseau, profil)] : [])
    .sort((a, b) => b.quand.localeCompare(a.quand) || a.id.localeCompare(b.id)), [reseau, profil, actif, commentaires])
  // Première fois sur cet appareil : ce qui existe déjà n'est pas signalé comme nouveau
  useEffect(() => { if (actif && lues === null && reseau && commentaires) marquerLues(toutes.map((n) => n.id)) }, [actif, lues, reseau, toutes, commentaires])
  const nonLues = toutes.filter((n) => !(lues ?? []).includes(n.id))
  return { toutes, nonLues, lues: new Set(lues ?? []) }
}
