import { chargeA, coachA, poids } from './charge'
import { statutA } from './construction'
import { centre, type Point } from './zones'
import { matriceMinutes, trajetEntre } from './tournee'
import { minutesMoyennes, visitesPrevues } from './kilometrage'
import type { Coach, Magasin, Reseau, ResponsableRegional } from './modele'

// Plan d'affectation à une date : l'app propose, le Directeur coche ce qu'il garde, puis enregistre.
// Les propositions viennent du temps de route réel (Coach au magasin, Coach à la zone du RR) et des seuils de charge.

export type Plafond = 'maximum' | 'seuil'

export function plafondCharge(reseau: Reseau, p: Plafond): number {
  return p === 'maximum' ? reseau.parametres.maxUnits : reseau.parametres.alertThreshold - 1
}

export type RaisonMagasin = 'sans-coach' | 'coach-absent' | 'depassement' | 'trajets'
export const raisonMagasinLibelle: Record<RaisonMagasin, string> = {
  'sans-coach': 'Sans Coach',
  'coach-absent': 'Coach plus dans l’équipe',
  depassement: 'Rééquilibrage de charge',
  trajets: 'Zones mieux réparties',
}

export interface PropositionMagasin { magasin: Magasin; avant: string; raison: RaisonMagasin; coach: string }

export type RaisonRR = 'sans-rr' | 'surcharge'
export const raisonRRLibelle: Record<RaisonRR, string> = {
  'sans-rr': 'Sans Responsable Régional',
  surcharge: 'Rééquilibrage entre Responsables Régionaux',
}

export interface PropositionRR { coach: Coach; avant: ResponsableRegional | null; raison: RaisonRR; rr: string }

// Coachs pouvant prendre des magasins à cette date (arrivés, ou poste prévu à pourvoir)
export function coachsDisponibles(reseau: Reseau, jour: string): Coach[] {
  return reseau.equipe.filter((c) => c.fictif || !c.arrivee || c.arrivee <= jour)
}

export function rrDuCoachA(c: Coach, jour: string): ResponsableRegional | null {
  if (!c.historiqueRR.length) return c.rr
  const h = c.historiqueRR.filter((a) => a.date <= jour)
  return h.length ? h[h.length - 1].rr : null
}

export const poidsA = (reseau: Reseau, m: Magasin, jour: string) => poids(reseau, statutA(m.ouverture, jour, reseau.parametres))

// Charges à la date, une fois les choix du plan appliqués (magasin -> Coach)
export function chargesAvecPlan(reseau: Reseau, jour: string, choix: Map<string, string>, calcul?: Calcul): Map<string, number> {
  const ch = new Map(calcul ? calcul.chargesBase : reseau.equipe.map((c) => [c.nom, chargeA(reseau, c.nom, jour)]))
  for (const [nom, coach] of choix) {
    const m = calcul ? calcul.magasin.get(nom) : reseau.magasins.find((x) => x.nom === nom)
    if (!m) continue
    const w = calcul ? calcul.poids.get(m)! : poidsA(reseau, m, jour)
    const avant = calcul ? calcul.coachDe.get(m)! : coachA(m, jour)
    if (avant && ch.has(avant)) ch.set(avant, ch.get(avant)! - w)
    if (coach) ch.set(coach, (ch.get(coach) ?? 0) + w)
  }
  return ch
}

// Position d'un Coach : son domicile, sinon le centre de ses magasins
export function positionCoach(reseau: Reseau, c: Coach, jour: string, choix?: Map<string, string>): Point | null {
  if (c.lat !== null && c.lon !== null) return { lat: c.lat, lon: c.lon }
  return centre(reseau.magasins.filter((m) => (choix?.get(m.nom) ?? coachA(m, jour)) === c.nom))
}

// trajet : aller simple par la route du Coach au magasin ; minutesEnPlus : route ajoutée sur l'année (visites du rythme)
export interface OptionCoach { coach: Coach; trajet: { km: number; minutes: number; estime: boolean } | null; minutesEnPlus: number | null; chargeApres: number; depasse: boolean }

// Magasins d'un Coach à la date, une fois le plan appliqué
export function magasinsAvecPlan(reseau: Reseau, coach: string, jour: string, choix: Map<string, string>): Magasin[] {
  return reseau.magasins.filter((m) => (choix.get(m.nom) ?? coachA(m, jour)) === coach)
}

// Contexte de calcul d'un plan à une date : Coach, poids et charge de chaque magasin, positions des Coachs,
// durées par la route entre points, gardés pour ne pas refaire les mêmes calculs des milliers de fois.
// La route d'un Coach = pour chacun de ses magasins, un aller-retour depuis son domicile par visite prévue sur l'année.
export interface Calcul {
  jour: string
  positions: Map<string, Point | null>
  magasin: Map<string, Magasin>
  coachDe: Map<Magasin, string>
  poids: Map<Magasin, number>
  chargesBase: Map<string, number>
  minutes: (coach: string, choix: Map<string, string>, magasin?: string, vers?: string) => number
}

export function creerCalcul(reseau: Reseau, jour: string): Calcul {
  const positions = new Map(reseau.equipe.map((c) => [c.nom, positionCoach(reseau, c, jour)]))
  const coachDe = new Map(reseau.magasins.map((m) => [m, coachA(m, jour)]))
  const poids = new Map(reseau.magasins.map((m) => [m, poidsA(reseau, m, jour)]))
  const chargesBase = new Map(reseau.equipe.map((c) => [c.nom, 0]))
  const parCoach = new Map<string, number[]>()
  reseau.magasins.forEach((m, i) => {
    const c = coachDe.get(m)!
    if (chargesBase.has(c)) chargesBase.set(c, chargesBase.get(c)! + poids.get(m)!)
    if (m.lat !== null && m.lon !== null) parCoach.set(c, [...(parCoach.get(c) ?? []), i])
  })
  // Points : les magasins (indices 0..n-1), puis les positions des Coachs
  const points: Point[] = reseau.magasins.map((m) => ({ lat: m.lat ?? 0, lon: m.lon ?? 0 }))
  const indiceCoach = new Map<string, number>()
  for (const [nom, p] of positions) if (p) { indiceCoach.set(nom, points.length); points.push(p) }
  const dist = matriceMinutes(points)
  const indice = new Map(reseau.magasins.map((m, i) => [m.nom, i]))
  const visites = reseau.magasins.map((m) => visitesPrevues(reseau, m, jour))

  // Route annuelle du Coach avec les choix du plan, et éventuellement un magasin de plus confié à « vers » (vide : retiré)
  const minutes = (coach: string, choix: Map<string, string>, magasin?: string, vers?: string) => {
    const dep = indiceCoach.get(coach)
    if (dep === undefined) return 0
    const change = (nom: string) => magasin === nom || choix.has(nom)
    const etapes = new Set((parCoach.get(coach) ?? []).filter((i) => !change(reseau.magasins[i].nom)))
    const ajouter = (nom: string, c: string) => {
      const i = indice.get(nom)
      if (c === coach && i !== undefined && reseau.magasins[i].lat !== null && reseau.magasins[i].lon !== null) etapes.add(i)
    }
    for (const [nom, c] of choix) if (nom !== magasin) ajouter(nom, c)
    if (magasin !== undefined) ajouter(magasin, vers ?? '')
    let total = 0
    for (const i of etapes) total += (dist(dep, i) + dist(i, dep)) * visites[i]
    return total
  }
  return { jour, positions, magasin: new Map(reseau.magasins.map((m) => [m.nom, m])), coachDe, poids, chargesBase, minutes }
}

// Minutes de route sur l'année d'un Coach : un aller-retour domicile-magasin par visite prévue
export function minutesTournee(calcul: Calcul, coach: string, choix: Map<string, string>, magasin?: string, vers?: string): number {
  return calcul.minutes(coach, choix, magasin, vers)
}

export function positionsCoachs(reseau: Reseau, jour: string): Map<string, Point | null> {
  return new Map(reseau.equipe.map((c) => [c.nom, positionCoach(reseau, c, jour)]))
}

// Coachs candidats pour un magasin, classés : sous le plafond d'abord, Coachs en poste avant postes à pourvoir,
// puis celui dont la route de l'année s'allonge le moins, et enfin le moins chargé
export function optionsCoach(reseau: Reseau, m: Magasin, jour: string, charges: Map<string, number>, plafond: number, exclure = '', calcul = creerCalcul(reseau, jour), choix = new Map<string, string>()): OptionCoach[] {
  const w = calcul.poids.get(m) ?? poidsA(reseau, m, jour)
  const positions = calcul.positions
  return coachsDisponibles(reseau, jour)
    .filter((c) => c.nom !== exclure)
    .map((c) => {
      const pos = positions.get(c.nom) ?? null
      const apres = (charges.get(c.nom) ?? 0) + w
      const minutesEnPlus = pos && m.lat !== null ? minutesTournee(calcul, c.nom, choix, m.nom, c.nom) - minutesTournee(calcul, c.nom, choix, m.nom, calcul.coachDe.get(m) ?? coachA(m, jour)) : null
      return { coach: c, trajet: pos && m.lat !== null && m.lon !== null ? trajetEntre(pos, { lat: m.lat, lon: m.lon }) : null, minutesEnPlus, chargeApres: apres, depasse: apres > plafond }
    })
    .sort((a, b) => Number(a.depasse) - Number(b.depasse) || Number(a.coach.fictif) - Number(b.coach.fictif) || (a.minutesEnPlus ?? 99999) - (b.minutesEnPlus ?? 99999) || a.chargeApres - b.chargeApres)
}

// Coachs proposés pour reprendre un magasin seul (réaffectation depuis la fiche) : même classement que le plan,
// avec la charge maximale comme plafond
export interface Suggestion extends OptionCoach { chargeAvant: number }
export function suggererCoachs(reseau: Reseau, m: Magasin, jour: string): Suggestion[] {
  const calcul = creerCalcul(reseau, jour)
  return optionsCoach(reseau, m, jour, calcul.chargesBase, reseau.parametres.maxUnits, coachA(m, jour), calcul)
    .map((o) => ({ ...o, chargeAvant: calcul.chargesBase.get(o.coach.nom) ?? 0 }))
}

export function proposerMagasins(reseau: Reseau, jour: string, plafond: number, calcul = creerCalcul(reseau, jour)): PropositionMagasin[] {
  const equipe = new Set(reseau.equipe.map((c) => c.nom))
  const choix = new Map<string, string>()
  const res: PropositionMagasin[] = []
  const charges = () => chargesAvecPlan(reseau, jour, choix, calcul)
  const positions = calcul.positions
  const coachA = (m: Magasin) => calcul.coachDe.get(m)!
  const poidsA = (m: Magasin) => calcul.poids.get(m)!

  // 1) Magasins en activité ou en préparation à la date, sans Coach (hors gestion directe par un RR)
  const aPourvoir = reseau.magasins
    .filter((m) => statutA(m.ouverture, jour, reseau.parametres) !== 'avenir' && !m.rrEnDirect)
    .map((m) => ({ m, avant: coachA(m) }))
    .filter(({ avant }) => !avant || !equipe.has(avant))
    .sort((a, b) => a.m.ouverture.localeCompare(b.m.ouverture))
  for (const { m, avant } of aPourvoir) {
    const meilleur = optionsCoach(reseau, m, jour, charges(), plafond, avant, calcul, choix)[0]
    if (!meilleur) continue
    choix.set(m.nom, meilleur.coach.nom)
    res.push({ magasin: m, avant, raison: avant ? 'coach-absent' : 'sans-coach', coach: meilleur.coach.nom })
  }

  // 2) Coachs au-dessus du plafond de charge : on confie, un par un, le magasin dont le transfert fait gagner
  //    le plus de temps de route sur l'année au total, à un Coach en poste qui reste sous le plafond
  const enPoste = coachsDisponibles(reseau, jour).filter((c) => !c.fictif && positions.get(c.nom))
  const minutes = (c: string) => minutesTournee(calcul, c, choix)
  const raisons = new Map<string, RaisonMagasin>()
  const origine = coachA
  const surcharges = enPoste.filter((c) => (charges().get(c.nom) ?? 0) > plafond).sort((a, b) => minutes(b.nom) - minutes(a.nom))
  for (const c of surcharges) {
    for (let garde = 0; garde < 50 && (charges().get(c.nom) ?? 0) > plafond; garde++) {
      const ch = charges()
      const minC = minutes(c.nom)
      let mieux: { m: Magasin; vers: string; cout: number } | null = null
      for (const m of reseau.magasins) {
        if ((choix.get(m.nom) ?? coachA(m)) !== c.nom || choix.has(m.nom) || m.lat === null) continue
        const w = poidsA(m)
        const gain = minC - minutesTournee(calcul, c.nom, choix, m.nom, '')
        for (const t of enPoste) {
          if (t.nom === c.nom || (ch.get(t.nom) ?? 0) + w > plafond) continue
          const cout = minutesTournee(calcul, t.nom, choix, m.nom, t.nom) - minutes(t.nom) - gain
          if (!mieux || cout < mieux.cout) mieux = { m, vers: t.nom, cout }
        }
      }
      if (!mieux) break
      choix.set(mieux.m.nom, mieux.vers)
      raisons.set(mieux.m.nom, 'depassement')
    }
  }

  // 3) Répartition des zones par temps de route : on déplace un magasin vers un Coach voisin tant que cela
  //    réduit la somme des carrés des heures de route de l'année (moins de route au total, et des Coachs plus égaux),
  //    sans dépasser le plafond de charge
  const VOISINS = 3
  const SEUIL = 100 // gain minimal (en heures au carré) pour proposer un déplacement
  const h2 = (minutes: number) => (minutes / 60) ** 2
  const places = new Set(res.map((p) => p.magasin.nom))
  const duree = new Map(enPoste.map((c) => [c.nom, minutes(c.nom)]))
  for (let passe = 0; passe < 30; passe++) {
    let mieux: { m: Magasin; de: string; vers: string; gain: number; dDe: number; dVers: number } | null = null
    const ch = charges()
    for (const m of reseau.magasins) {
      if (m.lat === null || m.rrEnDirect || statutA(m.ouverture, jour, reseau.parametres) === 'avenir') continue
      const de = choix.get(m.nom) ?? origine(m)
      if (!de || !duree.has(de) || places.has(m.nom)) continue
      const dDe = minutesTournee(calcul, de, choix, m.nom, '')
      const w = poidsA(m)
      const proches = enPoste
        .filter((t) => t.nom !== de && (ch.get(t.nom) ?? 0) + w <= plafond)
        .sort((a, b) => trajetEntre(positions.get(a.nom)!, m as Point).minutes - trajetEntre(positions.get(b.nom)!, m as Point).minutes)
        .slice(0, VOISINS)
      for (const t of proches) {
        const dVers = minutesTournee(calcul, t.nom, choix, m.nom, t.nom)
        const avant = h2(duree.get(de)!) + h2(duree.get(t.nom)!)
        const gain = avant - h2(dDe) - h2(dVers)
        if (gain > SEUIL && (!mieux || gain > mieux.gain)) mieux = { m, de, vers: t.nom, gain, dDe, dVers }
      }
    }
    if (!mieux) break
    if (mieux.vers === origine(mieux.m)) { choix.delete(mieux.m.nom); raisons.delete(mieux.m.nom) }
    else { choix.set(mieux.m.nom, mieux.vers); if (!raisons.has(mieux.m.nom)) raisons.set(mieux.m.nom, 'trajets') }
    duree.set(mieux.de, mieux.dDe); duree.set(mieux.vers, mieux.dVers)
  }

  // Propositions de l'étape 1, puis transferts des étapes 2 et 3
  const finales = [...res]
  for (const [nom, raison] of raisons) {
    const m = reseau.magasins.find((x) => x.nom === nom)!
    const coach = choix.get(nom)
    if (coach && coach !== origine(m)) finales.push({ magasin: m, avant: origine(m), raison, coach })
  }
  return finales
}

// ── Coachs → Responsables Régionaux ──

export function rrsRattachables(reseau: Reseau): ResponsableRegional[] {
  return reseau.rrs.filter((r) => !r.integres)
}

// Zone d'un RR : ses magasins (via ses Coachs, ou gérés en direct) à la date
export function zonesRR(reseau: Reseau, jour: string, choix: Map<string, string>): Map<string, Magasin[]> {
  const coachs = new Map(reseau.equipe.map((c) => [c.nom, c]))
  return new Map(rrsRattachables(reseau).map((r) => [r.id, reseau.magasins.filter((m) => {
    if (m.rrEnDirect) return m.rr?.id === r.id
    const c = coachs.get(choix.get(m.nom) ?? coachA(m, jour))
    return !!c && rrDuCoachA(c, jour)?.id === r.id
  })]))
}

export function coachsParRR(reseau: Reseau, jour: string, choixRR: Map<string, string>): Map<string, number> {
  const n = new Map(rrsRattachables(reseau).map((r) => [r.id, 0]))
  for (const c of coachsDisponibles(reseau, jour)) {
    const id = choixRR.get(c.nom) ?? rrDuCoachA(c, jour)?.id
    if (id && n.has(id)) n.set(id, n.get(id)! + 1)
  }
  return n
}

// minutes : temps moyen par la route du Coach aux magasins de la zone du RR
export interface OptionRR { rr: ResponsableRegional; minutes: number | null; coachsApres: number; depasse: boolean }

export function optionsRR(reseau: Reseau, c: Coach, jour: string, choixMagasins: Map<string, string>, nbCoachs: Map<string, number>, exclure = ''): OptionRR[] {
  const zones = zonesRR(reseau, jour, choixMagasins)
  const pos = positionCoach(reseau, c, jour, choixMagasins)
  const max = reseau.parametres.maxCoachsRR
  return rrsRattachables(reseau)
    .filter((r) => r.id !== exclure)
    .map((r) => {
      const apres = (nbCoachs.get(r.id) ?? 0) + 1
      return { rr: r, minutes: minutesMoyennes(pos, zones.get(r.id) ?? []), coachsApres: apres, depasse: apres > max }
    })
    .sort((a, b) => Number(a.depasse) - Number(b.depasse) || (a.minutes ?? 99999) - (b.minutes ?? 99999) || a.coachsApres - b.coachsApres)
}

export function proposerRR(reseau: Reseau, jour: string, choixMagasins: Map<string, string>): PropositionRR[] {
  const choix = new Map<string, string>()
  const res: PropositionRR[] = []
  const max = reseau.parametres.maxCoachsRR
  const ids = new Set(rrsRattachables(reseau).map((r) => r.id))
  const disponibles = coachsDisponibles(reseau, jour)

  // 1) Coachs sans Responsable Régional à la date : le RR dont la zone est la plus proche par la route, sous le maximum
  for (const c of disponibles) {
    const avant = rrDuCoachA(c, jour)
    if (avant && ids.has(avant.id)) continue
    const meilleur = optionsRR(reseau, c, jour, choixMagasins, coachsParRR(reseau, jour, choix))[0]
    if (!meilleur) continue
    choix.set(c.nom, meilleur.rr.id)
    res.push({ coach: c, avant, raison: 'sans-rr', rr: meilleur.rr.id })
  }

  // 2) RR au-dessus du maximum : le Coach le plus proche (par la route) d'une autre zone qui a de la place change de RR
  for (const r of rrsRattachables(reseau)) {
    for (let garde = 0; garde < 30 && (coachsParRR(reseau, jour, choix).get(r.id) ?? 0) > max; garde++) {
      const nb = coachsParRR(reseau, jour, choix)
      const zones = zonesRR(reseau, jour, choixMagasins)
      let mieux: { c: Coach; vers: string; cout: number } | null = null
      for (const c of disponibles) {
        if ((choix.get(c.nom) ?? rrDuCoachA(c, jour)?.id) !== r.id || choix.has(c.nom)) continue
        const pos = positionCoach(reseau, c, jour, choixMagasins)
        const ici = minutesMoyennes(pos, zones.get(r.id) ?? [])
        for (const t of rrsRattachables(reseau)) {
          if (t.id === r.id || (nb.get(t.id) ?? 0) + 1 > max) continue
          const la = minutesMoyennes(pos, zones.get(t.id) ?? [])
          const cout = la === null ? 99999 : la - (ici ?? 0)
          if (!mieux || cout < mieux.cout) mieux = { c, vers: t.id, cout }
        }
      }
      if (!mieux) break
      choix.set(mieux.c.nom, mieux.vers)
      res.push({ coach: mieux.c, avant: r, raison: 'surcharge', rr: mieux.vers })
    }
  }
  return res
}
