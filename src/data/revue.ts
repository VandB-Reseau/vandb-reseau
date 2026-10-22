// Revue mensuelle d'un Responsable Régional : chiffres, visites, tâches et santé de ses magasins sur un mois
import { analyserAu, chiffresDuMagasin, decalerMois, estVisite, type Analyse } from './chiffres'
import { actionsDes, echeanceDate, type ActionSuivie } from './actions'
import { coachA } from './charge'
import { historiqueSante, nineBox, type CaseNineBox } from './sante'
import { anneeDe, suiviRythme } from './visites'
import type { Magasin, Reseau } from './modele'

export interface LigneDecrochage { magasin: Magasin; coach: string; analyse: Analyse }
export interface LigneCoach { coach: string; magasins: number; faites: number; reference: number }
export interface ChangementCase { magasin: Magasin; date: string; avant: CaseNineBox | null; apres: CaseNineBox | null }
export interface Revue {
  mois: string; fin: string
  chiffresSaisis: boolean // au moins un magasin a son CA du mois
  decrochages: LigneDecrochage[] // Décroche puis À surveiller, écart le plus fort en tête
  coachs: LigneCoach[]
  retards: ActionSuivie[]
  changements: ChangementCase[]
}

// Mois proposés : les douze derniers, le mois en cours compris
export function moisDeRevue(jour: string): string[] {
  const courant = jour.slice(0, 7)
  return Array.from({ length: 12 }, (_, i) => decalerMois(courant, -i))
}
// Par défaut, la revue porte sur le mois écoulé
export const moisParDefaut = (jour: string) => decalerMois(jour.slice(0, 7), -1)

const finDuMois = (mois: string) => {
  const [a, m] = mois.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
}
const caseParId = (id: string) => nineBox.find((c) => c.id === id) ?? null

export function revueDu(reseau: Reseau, magasins: Magasin[], mois: string): Revue {
  const fin = finDuMois(mois)
  // Le mois en cours s'arrête à aujourd'hui
  const arret = fin < reseau.jour ? fin : reseau.jour
  const lendemain = decalerMois(mois, 1) + '-01'
  const ouverts = magasins.filter((m) => m.statut !== 'avenir' && m.ouverture <= arret)
  const noms = new Set(ouverts.map((m) => m.nom))

  const decrochages: LigneDecrochage[] = []
  let chiffresSaisis = false
  for (const m of ouverts) {
    const analyse = analyserAu(chiffresDuMagasin(reseau, m.nom), mois, reseau.seuils)
    if (analyse.ca !== null) chiffresSaisis = true
    if (analyse.statut === 'decroche' || analyse.statut === 'surveiller') decrochages.push({ magasin: m, coach: coachA(m, arret), analyse })
  }
  decrochages.sort((a, b) => Number(b.analyse.statut === 'decroche') - Number(a.analyse.statut === 'decroche') || (a.analyse.ecart ?? 0) - (b.analyse.ecart ?? 0))

  // Visites du mois par Coach, face au douzième de la référence annuelle de ses magasins
  const rythme = new Map(suiviRythme(reseau, anneeDe(arret)).map((l) => [l.magasin.nom, l]))
  const parCoach = new Map<string, LigneCoach>()
  const ligne = (coach: string) => {
    let l = parCoach.get(coach)
    if (!l) parCoach.set(coach, (l = { coach, magasins: 0, faites: 0, reference: 0 }))
    return l
  }
  for (const m of ouverts) {
    const l = ligne(coachA(m, arret))
    l.magasins++
    l.reference += (rythme.get(m.nom)?.reference ?? 0) / 12
  }
  for (const v of reseau.visites) {
    if (!noms.has(v.magasin) || !estVisite(v) || v.prevue || v.date < `${mois}-01` || v.date > arret) continue
    ligne(coachA(ouverts.find((m) => m.nom === v.magasin)!, v.date)).faites++
  }
  const coachs = [...parCoach.values()].map((l) => ({ ...l, reference: Math.round(l.reference * 10) / 10 }))
    .sort((a, b) => (a.coach ? 0 : 1) - (b.coach ? 0 : 1) || a.coach.localeCompare(b.coach, 'fr'))

  // Tâches en retard à la fin du mois : échéance passée, pas faites à cette date
  const retards = actionsDes(reseau, noms).filter((x) => {
    const e = echeanceDate(x.a)
    return !!e && e < (lendemain < reseau.jour ? lendemain : reseau.jour) && (!x.a.faite || x.a.faite > arret)
  }).sort((a, b) => echeanceDate(a.a).localeCompare(echeanceDate(b.a)))

  // Changements de case de la nine box pendant le mois
  const changements: ChangementCase[] = []
  for (const m of ouverts) {
    const h = historiqueSante(reseau.evaluations, m.nom)
    h.forEach((p, i) => {
      if (p.date < `${mois}-01` || p.date > fin) return
      const avant = i > 0 ? caseParId(h[i - 1].caseId) : null
      const apres = caseParId(p.caseId)
      if (avant?.id !== apres?.id) changements.push({ magasin: m, date: p.date, avant, apres })
    })
  }
  changements.sort((a, b) => a.date.localeCompare(b.date) || a.magasin.nom.localeCompare(b.magasin.nom, 'fr'))

  return { mois, fin, chiffresSaisis, decrochages, coachs, retards, changements }
}
