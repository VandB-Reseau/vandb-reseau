import { chargeA, coachA, distanceKm, poids } from './charge'
import { statutA } from './construction'
import { centre, type Point } from './zones'
import { tournee } from './tournee'
import type { Coach, Magasin, Reseau, ResponsableRegional } from './modele'

// Plan d'affectation à une date : l'app propose, le Directeur coche ce qu'il garde, puis enregistre.
// Les propositions viennent des distances (Coach au magasin, Coach à la zone du RR) et des seuils de charge.

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
export function chargesAvecPlan(reseau: Reseau, jour: string, choix: Map<string, string>): Map<string, number> {
  const ch = new Map(reseau.equipe.map((c) => [c.nom, chargeA(reseau, c.nom, jour)]))
  for (const [nom, coach] of choix) {
    const m = reseau.magasins.find((x) => x.nom === nom)
    if (!m) continue
    const w = poidsA(reseau, m, jour)
    const avant = coachA(m, jour)
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

export interface OptionCoach { coach: Coach; distance: number | null; minutesEnPlus: number | null; chargeApres: number; depasse: boolean }

// Magasins d'un Coach à la date, une fois le plan appliqué
export function magasinsAvecPlan(reseau: Reseau, coach: string, jour: string, choix: Map<string, string>): Magasin[] {
  return reseau.magasins.filter((m) => (choix.get(m.nom) ?? coachA(m, jour)) === coach)
}

// Durée de tournée (minutes) d'un Coach : domicile, ses magasins, retour
export function minutesTournee(reseau: Reseau, coach: string, jour: string, choix: Map<string, string>, positions: Map<string, Point | null>): number {
  return tournee(positions.get(coach) ?? null, magasinsAvecPlan(reseau, coach, jour, choix)).minutes
}

// Coachs candidats pour un magasin, classés : sous le plafond d'abord, Coachs en poste avant postes à pourvoir,
// puis celui dont la tournée s'allonge le moins, et enfin le moins chargé
export function positionsCoachs(reseau: Reseau, jour: string): Map<string, Point | null> {
  return new Map(reseau.equipe.map((c) => [c.nom, positionCoach(reseau, c, jour)]))
}

export function optionsCoach(reseau: Reseau, m: Magasin, jour: string, charges: Map<string, number>, plafond: number, exclure = '', positions = positionsCoachs(reseau, jour), choix = new Map<string, string>()): OptionCoach[] {
  const w = poidsA(reseau, m, jour)
  return coachsDisponibles(reseau, jour)
    .filter((c) => c.nom !== exclure)
    .map((c) => {
      const pos = positions.get(c.nom) ?? null
      const apres = (charges.get(c.nom) ?? 0) + w
      const sans = new Map(choix); sans.delete(m.nom)
      const avec = new Map(sans); avec.set(m.nom, c.nom)
      const minutesEnPlus = pos && m.lat !== null ? minutesTournee(reseau, c.nom, jour, avec, positions) - minutesTournee(reseau, c.nom, jour, sans, positions) : null
      return { coach: c, distance: pos ? distanceKm(pos, m) : null, minutesEnPlus, chargeApres: apres, depasse: apres > plafond }
    })
    .sort((a, b) => Number(a.depasse) - Number(b.depasse) || Number(a.coach.fictif) - Number(b.coach.fictif) || (a.minutesEnPlus ?? 99999) - (b.minutesEnPlus ?? 99999) || a.chargeApres - b.chargeApres)
}

export function proposerMagasins(reseau: Reseau, jour: string, plafond: number): PropositionMagasin[] {
  const equipe = new Set(reseau.equipe.map((c) => c.nom))
  const choix = new Map<string, string>()
  const res: PropositionMagasin[] = []
  const charges = () => chargesAvecPlan(reseau, jour, choix)
  const positions = positionsCoachs(reseau, jour)

  // 1) Magasins en activité ou en préparation à la date, sans Coach (hors gestion directe par un RR)
  const aPourvoir = reseau.magasins
    .filter((m) => statutA(m.ouverture, jour, reseau.parametres) !== 'avenir' && !m.rrEnDirect)
    .map((m) => ({ m, avant: coachA(m, jour) }))
    .filter(({ avant }) => !avant || !equipe.has(avant))
    .sort((a, b) => a.m.ouverture.localeCompare(b.m.ouverture))
  for (const { m, avant } of aPourvoir) {
    const meilleur = optionsCoach(reseau, m, jour, charges(), plafond, avant, positions, choix)[0]
    if (!meilleur) continue
    choix.set(m.nom, meilleur.coach.nom)
    res.push({ magasin: m, avant, raison: avant ? 'coach-absent' : 'sans-coach', coach: meilleur.coach.nom })
  }

  // 2) Coachs au-dessus du plafond de charge : on confie, un par un, le magasin dont le transfert fait gagner
  //    le plus de temps de trajet au total, à un Coach en poste qui reste sous le plafond
  const enPoste = coachsDisponibles(reseau, jour).filter((c) => !c.fictif && positions.get(c.nom))
  const minutes = (c: string) => minutesTournee(reseau, c, jour, choix, positions)
  const raisons = new Map<string, RaisonMagasin>()
  const origine = (m: Magasin) => coachA(m, jour)
  const surcharges = enPoste.filter((c) => (charges().get(c.nom) ?? 0) > plafond).sort((a, b) => minutes(b.nom) - minutes(a.nom))
  for (const c of surcharges) {
    for (let garde = 0; garde < 50 && (charges().get(c.nom) ?? 0) > plafond; garde++) {
      const ch = charges()
      const minC = minutes(c.nom)
      let mieux: { m: Magasin; vers: string; cout: number } | null = null
      for (const m of reseau.magasins) {
        if ((choix.get(m.nom) ?? coachA(m, jour)) !== c.nom || choix.has(m.nom) || m.lat === null) continue
        const w = poidsA(reseau, m, jour)
        const sansM = new Map(choix); sansM.set(m.nom, '')
        const gain = minC - minutesTournee(reseau, c.nom, jour, sansM, positions)
        for (const t of enPoste) {
          if (t.nom === c.nom || (ch.get(t.nom) ?? 0) + w > plafond) continue
          const avec = new Map(choix); avec.set(m.nom, t.nom)
          const cout = minutesTournee(reseau, t.nom, jour, avec, positions) - minutes(t.nom) - gain
          if (!mieux || cout < mieux.cout) mieux = { m, vers: t.nom, cout }
        }
      }
      if (!mieux) break
      choix.set(mieux.m.nom, mieux.vers)
      raisons.set(mieux.m.nom, 'depassement')
    }
  }

  // 3) Répartition des zones par temps de trajet : on déplace un magasin vers un Coach voisin tant que cela
  //    réduit la somme des carrés des durées de tournée (moins de route au total, et des tournées plus égales),
  //    sans dépasser le plafond de charge
  const VOISINS = 3
  const SEUIL = 15 * 15 // gain minimal pour proposer un déplacement
  const places = new Set(res.map((p) => p.magasin.nom))
  const duree = new Map(enPoste.map((c) => [c.nom, minutes(c.nom)]))
  for (let passe = 0; passe < 30; passe++) {
    let mieux: { m: Magasin; de: string; vers: string; gain: number; dDe: number; dVers: number } | null = null
    const ch = charges()
    for (const m of reseau.magasins) {
      if (m.lat === null || m.rrEnDirect || statutA(m.ouverture, jour, reseau.parametres) === 'avenir') continue
      const de = choix.get(m.nom) ?? origine(m)
      if (!de || !duree.has(de) || places.has(m.nom)) continue
      const sansM = new Map(choix); sansM.set(m.nom, '')
      const dDe = minutesTournee(reseau, de, jour, sansM, positions)
      const w = poidsA(reseau, m, jour)
      const proches = enPoste
        .filter((t) => t.nom !== de && (ch.get(t.nom) ?? 0) + w <= plafond)
        .sort((a, b) => (distanceKm(positions.get(a.nom)!, m) ?? 0) - (distanceKm(positions.get(b.nom)!, m) ?? 0))
        .slice(0, VOISINS)
      for (const t of proches) {
        const avec = new Map(choix); avec.set(m.nom, t.nom)
        const dVers = minutesTournee(reseau, t.nom, jour, avec, positions)
        const avant = duree.get(de)! ** 2 + duree.get(t.nom)! ** 2
        const gain = avant - dDe ** 2 - dVers ** 2
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

// Centre de la zone d'un RR : ses magasins (via ses Coachs, ou gérés en direct) à la date
export function centresRR(reseau: Reseau, jour: string, choix: Map<string, string>): Map<string, Point | null> {
  const coachs = new Map(reseau.equipe.map((c) => [c.nom, c]))
  return new Map(rrsRattachables(reseau).map((r) => [r.id, centre(reseau.magasins.filter((m) => {
    if (m.rrEnDirect) return m.rr?.id === r.id
    const c = coachs.get(choix.get(m.nom) ?? coachA(m, jour))
    return !!c && rrDuCoachA(c, jour)?.id === r.id
  }))]))
}

export function coachsParRR(reseau: Reseau, jour: string, choixRR: Map<string, string>): Map<string, number> {
  const n = new Map(rrsRattachables(reseau).map((r) => [r.id, 0]))
  for (const c of coachsDisponibles(reseau, jour)) {
    const id = choixRR.get(c.nom) ?? rrDuCoachA(c, jour)?.id
    if (id && n.has(id)) n.set(id, n.get(id)! + 1)
  }
  return n
}

export interface OptionRR { rr: ResponsableRegional; distance: number | null; coachsApres: number; depasse: boolean }

export function optionsRR(reseau: Reseau, c: Coach, jour: string, choixMagasins: Map<string, string>, nbCoachs: Map<string, number>, exclure = ''): OptionRR[] {
  const centres = centresRR(reseau, jour, choixMagasins)
  const pos = positionCoach(reseau, c, jour, choixMagasins)
  const max = reseau.parametres.maxCoachsRR
  return rrsRattachables(reseau)
    .filter((r) => r.id !== exclure)
    .map((r) => {
      const ctr = centres.get(r.id)
      const apres = (nbCoachs.get(r.id) ?? 0) + 1
      return { rr: r, distance: pos && ctr ? distanceKm(pos, ctr) : null, coachsApres: apres, depasse: apres > max }
    })
    .sort((a, b) => Number(a.depasse) - Number(b.depasse) || (a.distance ?? 9999) - (b.distance ?? 9999) || a.coachsApres - b.coachsApres)
}

export function proposerRR(reseau: Reseau, jour: string, choixMagasins: Map<string, string>): PropositionRR[] {
  const choix = new Map<string, string>()
  const res: PropositionRR[] = []
  const max = reseau.parametres.maxCoachsRR
  const ids = new Set(rrsRattachables(reseau).map((r) => r.id))
  const disponibles = coachsDisponibles(reseau, jour)

  // 1) Coachs sans Responsable Régional à la date : le RR dont la zone est la plus proche, sous le maximum
  for (const c of disponibles) {
    const avant = rrDuCoachA(c, jour)
    if (avant && ids.has(avant.id)) continue
    const meilleur = optionsRR(reseau, c, jour, choixMagasins, coachsParRR(reseau, jour, choix))[0]
    if (!meilleur) continue
    choix.set(c.nom, meilleur.rr.id)
    res.push({ coach: c, avant, raison: 'sans-rr', rr: meilleur.rr.id })
  }

  // 2) RR au-dessus du maximum : le Coach le plus proche d'une autre zone qui a de la place change de RR
  for (const r of rrsRattachables(reseau)) {
    for (let garde = 0; garde < 30 && (coachsParRR(reseau, jour, choix).get(r.id) ?? 0) > max; garde++) {
      const nb = coachsParRR(reseau, jour, choix)
      const centres = centresRR(reseau, jour, choixMagasins)
      let mieux: { c: Coach; vers: string; cout: number } | null = null
      for (const c of disponibles) {
        if ((choix.get(c.nom) ?? rrDuCoachA(c, jour)?.id) !== r.id || choix.has(c.nom)) continue
        const pos = positionCoach(reseau, c, jour, choixMagasins)
        const ici = pos && centres.get(r.id) ? distanceKm(pos, centres.get(r.id)!) : null
        for (const t of rrsRattachables(reseau)) {
          if (t.id === r.id || (nb.get(t.id) ?? 0) + 1 > max) continue
          const ctr = centres.get(t.id)
          const la = pos && ctr ? distanceKm(pos, ctr) : null
          const cout = la === null ? 5000 : la - (ici ?? 0)
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
