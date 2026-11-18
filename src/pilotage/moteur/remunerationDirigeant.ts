import { impotSocietes } from './budget'
import type { ParametresReseau } from './types'

// 287 · Me rémunérer : salaire ou dividendes (Joseph, 18/11/2026 : « comparer avec les impôts versés par mois si je me
// rémunère, versus les dividendes, en parlant aussi de trésorerie »). Ordres de grandeur pour préparer l'échange avec
// l'expert-comptable, jamais un conseil fiscal : la situation du foyer, le régime de retraite, les options (barème) et
// les règles de l'année changent le résultat. Fonction pure, testée dans tests/pilotage/moteur/lot287.spec.ts.
//
// Repères proposés par défaut (règles 2026, modifiables par le Directeur dans Paramètres, Simulateurs) :
// - cotisations du gérant majoritaire (travailleur non salarié) : environ 45 % de la rémunération nette (40 à 45 %
//   selon les sources), minimum d'environ 1 255 € par an même sans rémunération ;
// - président de SAS (assimilé salarié) : environ 80 % de la rémunération nette (75 à 82 %, parts patronale et salariale) ;
// - dividendes : prélèvement forfaitaire unique 31,4 % en 2026 = 12,8 % d'impôt sur le revenu + 18,6 % de prélèvements
//   sociaux (CSG 10,6 % depuis la loi de financement de la sécurité sociale pour 2026) ;
// - gérant majoritaire : la part des dividendes au-delà de 10 % du capital, des primes d'émission et des comptes
//   courants d'associés supporte les cotisations du travailleur non salarié à la place des prélèvements sociaux ;
// - impôt sur les sociétés : celui des paramètres du budget (15 % jusqu'à 42 500 € de bénéfice, 25 % au-delà en 2026).
// La rémunération du dirigeant et ses cotisations se déduisent du bénéfice soumis à l'impôt sur les sociétés.

export interface ReglesRemuneration {
  cotisationsTNS: number          // en part de la rémunération nette (et des dividendes au-delà du seuil)
  minimumTNS: number              // cotisations minimales par an, même sans rémunération
  cotisationsAssimile: number     // président de SAS : charges patronales et salariales en part du net
  irDividendes: number            // impôt sur le revenu forfaitaire des dividendes
  prelevementsSociaux: number     // prélèvements sociaux des dividendes
  seuilDividendesTNS: number      // part du capital, des primes et des comptes courants au-delà de laquelle les dividendes cotisent
}
export const REGLES_REMUNERATION: ReglesRemuneration = {
  cotisationsTNS: 0.45, minimumTNS: 1_255, cotisationsAssimile: 0.8, irDividendes: 0.128, prelevementsSociaux: 0.186, seuilDividendesTNS: 0.1,
}

export type StatutDirigeant = 'tns' | 'assimile'
export interface Remuneration {
  benefice: number      // résultat de la société avant la rémunération du dirigeant et avant l'impôt sur les sociétés
  statut: StatutDirigeant
  netMois: number       // rémunération nette par mois, avant impôt sur le revenu
  distribution: number  // part du résultat net (après impôt sur les sociétés) versée en dividendes
  capital: number       // capital libéré + primes d'émission + comptes courants d'associés (seuil des 10 %)
  tauxFoyer: number     // taux de prélèvement à la source du foyer, appliqué à la rémunération nette
  deficit?: number      // déficits reportables de la société
}
export interface ScenarioRemuneration {
  netAn: number; cotisations: number; coutSociete: number          // rémunération nette, cotisations, coût pour la société
  resultatAvantImpot: number; impotSocietes: number; resultatNet: number
  dividendes: number; partSoumise: number                          // dividendes bruts ; part qui cotise (gérant majoritaire)
  cotisationsDividendes: number; irDividendes: number; prelevementsSociaux: number; netDividendes: number
  irRemuneration: number
  netPerso: number          // ce que le dirigeant garde, impôt sur le revenu payé
  impotsEtCotisations: number // cotisations, impôt sur les sociétés, impôt sur le revenu, prélèvements sur dividendes
  resteSociete: number      // résultat net gardé dans la société (réserves, trésorerie)
  sortiesSociete: number    // ce qui sort de la trésorerie de la société : coût de la rémunération, impôt, dividendes
}
export interface EffetRemuneration { choix: ScenarioRemuneration; toutSalaire: ScenarioRemuneration; toutDividendes: ScenarioRemuneration }

const pos = (x: number | null | undefined) => (Number.isFinite(x) ? Math.max(0, x as number) : 0)
const part = (x: number | null | undefined) => Math.min(1, pos(x))
const fini = (x: number | null | undefined) => (Number.isFinite(x) ? (x as number) : 0)

function tauxCotisations(statut: StatutDirigeant, r: ReglesRemuneration) { return statut === 'tns' ? pos(r.cotisationsTNS) : pos(r.cotisationsAssimile) }
function cotisationsSur(netAn: number, statut: StatutDirigeant, r: ReglesRemuneration) {
  const c = netAn * tauxCotisations(statut, r)
  return statut === 'tns' ? Math.max(c, pos(r.minimumTNS)) : c
}

export function scenarioRemuneration(x: { benefice: number; statut: StatutDirigeant; netAn: number; distribution: number; capital: number; tauxFoyer: number; deficit?: number }, r: ReglesRemuneration, impot: ParametresReseau['impot']): ScenarioRemuneration {
  const netAn = pos(x.netAn)
  const cotisations = cotisationsSur(netAn, x.statut, r)
  const coutSociete = netAn + cotisations
  const resultatAvantImpot = fini(x.benefice) - coutSociete
  const is = impotSocietes(resultatAvantImpot, pos(x.deficit), impot)
  const resultatNet = resultatAvantImpot - is
  const dividendes = Math.max(0, resultatNet) * part(x.distribution)
  const partSoumise = x.statut === 'tns' ? Math.max(0, dividendes - pos(x.capital) * pos(r.seuilDividendesTNS)) : 0
  const cotisationsDividendes = partSoumise * pos(r.cotisationsTNS)
  const irDividendes = dividendes * pos(r.irDividendes)
  const prelevementsSociaux = (dividendes - partSoumise) * pos(r.prelevementsSociaux)
  const netDividendes = dividendes - cotisationsDividendes - irDividendes - prelevementsSociaux
  const irRemuneration = netAn * part(x.tauxFoyer)
  return {
    netAn, cotisations, coutSociete, resultatAvantImpot, impotSocietes: is, resultatNet, dividendes, partSoumise,
    cotisationsDividendes, irDividendes, prelevementsSociaux, netDividendes, irRemuneration,
    netPerso: netAn - irRemuneration + netDividendes,
    impotsEtCotisations: cotisations + is + irRemuneration + cotisationsDividendes + irDividendes + prelevementsSociaux,
    resteSociete: resultatNet - dividendes,
    sortiesSociete: coutSociete + is + dividendes,
  }
}

// Trois façons de sortir le même bénéfice : ma répartition, tout en rémunération (le bénéfice entier part en salaire
// chargé, il ne reste rien à imposer dans la société), tout en dividendes (aucune rémunération, tout le résultat distribué)
export function simulerRemuneration(x: Remuneration, r: ReglesRemuneration, impot: ParametresReseau['impot']): EffetRemuneration {
  const base = { benefice: x.benefice, statut: x.statut, capital: x.capital, tauxFoyer: x.tauxFoyer, deficit: x.deficit }
  const benefice = pos(x.benefice)
  // Tout en rémunération : net × (1 + taux) = bénéfice ; un gérant majoritaire paie au moins le minimum
  const t = tauxCotisations(x.statut, r)
  let netMax = benefice / (1 + t)
  if (x.statut === 'tns' && netMax * t < pos(r.minimumTNS)) netMax = Math.max(0, benefice - pos(r.minimumTNS))
  return {
    choix: scenarioRemuneration({ ...base, netAn: pos(x.netMois) * 12, distribution: x.distribution }, r, impot),
    toutSalaire: scenarioRemuneration({ ...base, netAn: netMax, distribution: 0 }, r, impot),
    toutDividendes: scenarioRemuneration({ ...base, netAn: 0, distribution: 1 }, r, impot),
  }
}
