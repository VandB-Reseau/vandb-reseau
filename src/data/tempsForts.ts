// Plan d'animation de l'année (refonte vague 5, Joseph 10/11/2026, 48A) : les temps forts du réseau (Noël, Beaujolais,
// Fête des pères…) réglés par le Directeur dans Paramètres (clé « temps_forts » d'app_config). Le franchisé reçoit
// l'annonce d'un temps fort dans son fil, quelques semaines avant (annonce, en jours), pour commander, former son équipe
// et prévoir le personnel. Les campagnes s'y rattachent ; chaque campagne porte ses dates clés (commande, réception,
// facturation…), à la demande de Joseph (10/11/2026 9h49).
import type { Campagne } from './campagnes'

export interface TempsFort { id: string; nom: string; debut: string; fin: string; annonce: number; detail: string }
export const ANNONCE_PAR_DEFAUT = 45

const texte = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '')

export function normaliserTempsForts(v: unknown): TempsFort[] {
  return (Array.isArray(v) ? v : []).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object').map((x) => {
    const annonce = Number(x.annonce)
    return { id: texte(x.id, 60), nom: texte(x.nom, 80), debut: date(x.debut), fin: date(x.fin) || date(x.debut), detail: texte(x.detail, 500),
      annonce: Number.isFinite(annonce) && annonce >= 0 && annonce <= 180 ? Math.round(annonce) : ANNONCE_PAR_DEFAUT }
  }).filter((t) => t.id && t.nom && t.debut).sort((a, b) => a.debut.localeCompare(b.debut))
}

const decaler = (jour: string, n: number) => new Date(Date.parse(`${jour}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
export const dateAnnonce = (t: TempsFort) => decaler(t.debut, -t.annonce)

// Annoncé et pas encore fini à cette date
export const annonce = (t: TempsFort, jour: string) => jour >= dateAnnonce(t) && jour <= t.fin

// Les temps forts d'une année civile, pour la frise
export const tempsFortsDe = (liste: TempsFort[], annee: string) => liste.filter((t) => t.debut.slice(0, 4) <= annee && t.fin.slice(0, 4) >= annee)

// ── Dates clés d'une campagne ──
export type TypeJalon = 'commande_debut' | 'commande_fin' | 'reception' | 'installation' | 'facturation' | 'autre'
export interface Jalon { id: string; type: TypeJalon; libelle: string; date: string }
export const typesJalon: { v: TypeJalon; libelle: string }[] = [
  { v: 'commande_debut', libelle: 'Commande à partir du' },
  { v: 'commande_fin', libelle: 'Commande jusqu’au' },
  { v: 'reception', libelle: 'Réception en magasin' },
  { v: 'installation', libelle: 'Mise en place en magasin' },
  { v: 'facturation', libelle: 'Facturation' },
  { v: 'autre', libelle: 'Autre date' },
]
export const libelleJalon = (j: Jalon) => (j.type === 'autre' && j.libelle ? j.libelle : typesJalon.find((t) => t.v === j.type)?.libelle ?? j.libelle)

export function normaliserJalons(v: unknown): Jalon[] {
  return (Array.isArray(v) ? v : []).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object').map((x) => ({
    id: texte(x.id, 60), type: (typesJalon.some((t) => t.v === x.type) ? x.type : 'autre') as TypeJalon, libelle: texte(x.libelle, 80), date: date(x.date),
  })).filter((j) => j.id && j.date).sort((a, b) => a.date.localeCompare(b.date))
}

// Dates clés à venir d'une liste de campagnes, dans les « jours » qui viennent (les dates passées depuis moins de 2 jours restent)
export function jalonsAVenir(campagnes: Campagne[], jour: string, jours = 21): { c: Campagne; j: Jalon }[] {
  const debut = decaler(jour, -2), fin = decaler(jour, jours)
  return campagnes.flatMap((c) => (c.jalons ?? []).filter((j) => j.date >= debut && j.date <= fin).map((j) => ({ c, j })))
    .sort((a, b) => a.j.date.localeCompare(b.j.date))
}
// Prochaine date clé d'une campagne (aujourd'hui compris)
export const prochainJalon = (c: Campagne, jour: string) => (c.jalons ?? []).find((j) => j.date >= jour) ?? null
