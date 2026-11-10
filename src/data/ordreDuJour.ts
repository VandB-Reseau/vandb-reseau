// Parcours de visite (vague 7, Joseph 10/11/2026, 79 à 85) : une seule prochaine étape par magasin, et un ordre du jour
// proposé à la préparation (priorités du plan, tâches ouvertes, campagnes, mot du franchisé, objectifs, chiffres).
// Les sujets cochés et les sujets libres sont rangés avec la préparation (rubrique « preparation », sans migration).
import type { PreparationVisite, Reseau, Visite } from './modele'
import { visiteFaite } from './modele'
import { actionsDuMagasin, echeanceDate, enRetard } from './actions'
import { analyser, estVisite, formatPourcent, libelleAlerte, libelleMois } from './chiffres'
import { campagnesDuMagasin } from './campagnes'
import { motDe } from './motFranchise'
import { avancement, libelleStatut, objectifsDu, phraseObjectif } from './objectifs'
import { prioritesActives } from './planAction'
import { preparationDe } from './semaine'
import { dateCourte } from '../lib/format'

export type GenreSujet = 'priorite' | 'tache' | 'campagne' | 'mot' | 'objectif' | 'chiffres' | 'libre'
export interface Sujet { id: string; genre: GenreSujet; titre: string; detail: string; equipe?: boolean }

export const libelleGenreSujet: Record<GenreSujet, string> = {
  priorite: 'Priorité du plan', tache: 'Tâche', campagne: 'Campagne', mot: 'Mot du franchisé', objectif: 'Objectif', chiffres: 'Chiffres', libre: 'Sujet',
}

// Visite à venir ou du jour (planifiée, pas encore faite), la plus proche
export function visiteAVenir(reseau: Reseau, magasin: string): Visite | null {
  return reseau.visites.filter((v) => v.magasin === magasin && estVisite(v) && v.prevue && v.id !== null && v.date >= ajouter(reseau.jour, -7))
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
}

// Visite planifiée à reprendre plutôt que d'en créer une seconde (84A) : entre 7 jours avant et 7 jours après la date
export function visitePlanifieeProche(reseau: Reseau, magasin: string, date: string): Visite | null {
  return reseau.visites.filter((v) => v.magasin === magasin && v.prevue && v.id !== null && estVisite(v) && v.date >= ajouter(date, -7) && v.date <= ajouter(date, 7))
    .sort((a, b) => Math.abs(ecartJours(a.date, date)) - Math.abs(ecartJours(b.date, date)))[0] ?? null
}

// Sujets proposés pour la prochaine visite : rien n'est coché d'office
export function sujetsProposes(reseau: Reseau, magasin: string): Sujet[] {
  const r: Sujet[] = []
  for (const p of prioritesActives(reseau, magasin)) r.push({ id: `p:${p.id}`, genre: 'priorite', titre: p.titre, detail: 'Faire le point sur la priorité et ses tâches' })
  const ouvertes = actionsDuMagasin(reseau, magasin).filter((x) => !x.a.faite)
    .sort((x, y) => Number(enRetard(y.a, reseau.jour)) - Number(enRetard(x.a, reseau.jour)) || Number(y.a.statut === 'bloquee') - Number(x.a.statut === 'bloquee')
      || (echeanceDate(x.a) || '9999').localeCompare(echeanceDate(y.a) || '9999'))
  for (const x of ouvertes) {
    const detail = [x.a.porteur, enRetard(x.a, reseau.jour) ? `en retard depuis le ${dateCourte(echeanceDate(x.a))}` : x.a.statut === 'bloquee' ? `bloquée${x.a.raison ? ` : ${x.a.raison}` : ''}` : echeanceDate(x.a) ? `pour le ${dateCourte(echeanceDate(x.a))}` : x.a.echeance].filter(Boolean).join(' · ')
    r.push({ id: `t:${x.cle}`, genre: 'tache', titre: x.a.action, detail })
  }
  for (const c of campagnesDuMagasin(reseau, magasin, reseau.jour)) {
    const reste = c.points.filter((p) => !reseau.campagnes.constats[c.id]?.[magasin]?.[p.id])
    if (reste.length) r.push({ id: `c:${c.id}`, genre: 'campagne', titre: c.nom, detail: `${reste.length} point${reste.length > 1 ? 's' : ''} à constater` })
  }
  const v = visiteAVenir(reseau, magasin)
  if (v && motDe(reseau, magasin, v.id)) r.push({ id: 'mot', genre: 'mot', titre: 'Le mot du franchisé', detail: `Écrit pour la visite du ${dateCourte(v.date)}` })
  for (const o of objectifsDu(reseau, magasin)) {
    const s = avancement(reseau, magasin, o).statut
    if (s === 'retard' || s === 'manque') r.push({ id: `o:${o.id}`, genre: 'objectif', titre: phraseObjectif(o), detail: libelleStatut[s], equipe: true })
  }
  const a = analyser(reseau, magasin)
  if (a?.statut === 'decroche' || a?.statut === 'surveiller') r.push({ id: 'chiffres', genre: 'chiffres', titre: `CA de ${libelleMois(a.mois)} ${formatPourcent(a.ecart)}`, detail: libelleAlerte[a.statut], equipe: true })
  return r
}

// Ordre du jour retenu : sujets proposés cochés (encore d'actualité) puis sujets libres
export function ordreDuJour(reseau: Reseau, magasin: string, p: PreparationVisite | null = preparationDe(reseau, magasin)): Sujet[] {
  if (!p) return []
  const choisis = new Set(p.sujets ?? [])
  const proposes = sujetsProposes(reseau, magasin).filter((s) => choisis.has(s.id))
  return [...proposes, ...(p.libres ?? []).filter((t) => t.trim()).map((t, i) => ({ id: `l:${i}`, genre: 'libre' as const, titre: t, detail: '' }))]
}

export const estPreparee = (p: PreparationVisite | null) => !!p && (!!p.notes.trim() || !!p.sujets?.length || !!p.libres?.some((t) => t.trim()))

// Prochaine étape d'un magasin (79A) : un seul bouton « Visite » dont le libellé suit l'état
export type EtapeBouton = 'planifier' | 'preparer' | 'commencer' | 'compterendu' | 'voir'
export interface ProchaineEtape { etape: EtapeBouton; libelle: string; detail: string; visite: Visite | null; lien: string }

export function prochaineEtape(reseau: Reseau, magasin: string): ProchaineEtape {
  const base = `/magasins/${encodeURIComponent(magasin)}/visite`
  const avecId = (v: Visite, etape: string) => `${base}?id=${v.id}&etape=${etape}`
  const v = visiteAVenir(reseau, magasin)
  const p = preparationDe(reseau, magasin)
  if (v) {
    if (v.date <= reseau.jour) return { etape: 'commencer', libelle: 'Commencer la visite', detail: v.date === reseau.jour ? 'Aujourd’hui' : `Prévue le ${dateCourte(v.date)}`, visite: v, lien: avecId(v, 'surplace') }
    return { etape: 'preparer', libelle: 'Préparer la visite', detail: `Le ${dateCourte(v.date)}${estPreparee(p) ? ' · préparée' : ''}`, visite: v, lien: avecId(v, 'preparer') }
  }
  const derniere = reseau.visites.filter((x) => x.magasin === magasin && estVisite(x) && visiteFaite(x, reseau.jour) && x.id !== null)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  if (derniere && derniere.date >= ajouter(reseau.jour, -14) && !compteRenduEcrit(derniere)) {
    return { etape: 'compterendu', libelle: 'Écrire le compte rendu', detail: `Visite du ${dateCourte(derniere.date)}`, visite: derniere, lien: avecId(derniere, 'surplace') }
  }
  if (estPreparee(p)) return { etape: 'preparer', libelle: 'Préparer la visite', detail: 'Pas encore de date', visite: null, lien: `${base}?etape=preparer` }
  return { etape: 'planifier', libelle: 'Planifier la visite', detail: 'Pas de visite prévue', visite: null, lien: `${base}?etape=preparer` }
}

export const compteRenduEcrit = (v: Visite) => !!v.notes.trim() || v.parties.some((p) => p.trim()) || v.plan.length > 0

// Rappels du visiteur (85A) : préparer 3 jours avant, écrire le compte rendu le lendemain, signature au bout de 3 jours
export interface Rappel { cle: string; magasin: string; visite: Visite; genre: 'preparer' | 'compterendu' | 'signature'; detail: string }
export function rappelsVisites(reseau: Reseau, magasins: Set<string>, moi: string): Rappel[] {
  const j = reseau.jour
  const r: Rappel[] = []
  const miennes = (v: Visite) => !moi || !v.visiteurs.length || v.visiteurs.includes(moi)
  for (const v of reseau.visites) {
    if (!magasins.has(v.magasin) || !estVisite(v) || v.id === null || !miennes(v)) continue
    if (v.prevue && v.date > j && v.date <= ajouter(j, 3) && !estPreparee(preparationDe(reseau, v.magasin))) {
      r.push({ cle: `rp-${v.id}`, magasin: v.magasin, visite: v, genre: 'preparer', detail: `Visite le ${dateCourte(v.date)} · ordre du jour à préparer` })
    } else if (visiteFaite(v, j) && v.date < j && v.date >= ajouter(j, -14) && !compteRenduEcrit(v)) {
      r.push({ cle: `rc-${v.id}`, magasin: v.magasin, visite: v, genre: 'compterendu', detail: `Visite du ${dateCourte(v.date)} · compte rendu à écrire` })
    } else if (visiteFaite(v, j) && v.signatureRequise && !v.lienSigne && v.date <= ajouter(j, -3) && v.date >= ajouter(j, -30)) {
      r.push({ cle: `rs-${v.id}`, magasin: v.magasin, visite: v, genre: 'signature', detail: `Visite du ${dateCourte(v.date)} · signature attendue` })
    }
  }
  return r.sort((a, b) => a.visite.date.localeCompare(b.visite.date))
}

function ajouter(iso: string, n: number) { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
function ecartJours(a: string, b: string) { return (Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000 }
