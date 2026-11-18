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
// Corrections du 18/11/2026 (Joseph, 10h41) : capital, primes d'émission et comptes courants saisis à part ; impôt sur le
// revenu de la rémunération au barème progressif (le taux du foyer appliqué à tout le salaire avantageait trop la
// rémunération aux hauts niveaux) ; recommandation du montage pour un montant visé, net après impôts.
// - barème 2026 (revenus 2025, loi de finances n° 2026-103, + 0,9 %) : 0 % jusqu'à 11 600 €, 11 % jusqu'à 29 579 €,
//   30 % jusqu'à 84 577 €, 41 % jusqu'à 181 917 €, 45 % au-delà, par part du foyer (plafonnement du quotient familial et
//   décote ignorés) ; rémunération imposée après la déduction de 10 % pour frais (plafond 14 555 € pour les revenus 2025).
export const BAREME_IR_2026: { de: number; taux: number }[] = [
  { de: 0, taux: 0 }, { de: 11_600, taux: 0.11 }, { de: 29_579, taux: 0.3 }, { de: 84_577, taux: 0.41 }, { de: 181_917, taux: 0.45 },
]

export interface ReglesRemuneration {
  cotisationsTNS: number          // en part de la rémunération nette (et des dividendes au-delà du seuil)
  minimumTNS: number              // cotisations minimales par an, même sans rémunération
  cotisationsAssimile: number     // président de SAS : charges patronales et salariales en part du net
  irDividendes: number            // impôt sur le revenu forfaitaire des dividendes
  prelevementsSociaux: number     // prélèvements sociaux des dividendes
  seuilDividendesTNS: number      // part du capital, des primes et des comptes courants au-delà de laquelle les dividendes cotisent
  abattement: number              // déduction forfaitaire pour frais sur la rémunération (impôt sur le revenu)
  plafondAbattement: number       // plafond de cette déduction, par an et par personne
}
export const REGLES_REMUNERATION: ReglesRemuneration = {
  cotisationsTNS: 0.45, minimumTNS: 1_255, cotisationsAssimile: 0.8, irDividendes: 0.128, prelevementsSociaux: 0.186, seuilDividendesTNS: 0.1,
  abattement: 0.1, plafondAbattement: 14_555,
}

// Impôt sur le revenu du barème pour un revenu imposable et un nombre de parts ; tranche marginale du revenu
export function impotBareme(revenu: number, parts: number, bareme = BAREME_IR_2026): number {
  const n = Math.max(1, Number.isFinite(parts) ? parts : 1)
  const q = Math.max(0, Number.isFinite(revenu) ? revenu : 0) / n
  let impot = 0
  bareme.forEach((t, i) => {
    const haut = bareme[i + 1]?.de ?? Infinity
    if (q > t.de) impot += (Math.min(q, haut) - t.de) * t.taux
  })
  return impot * n
}
export function trancheMarginale(revenu: number, parts: number, bareme = BAREME_IR_2026): number {
  const q = Math.max(0, Number.isFinite(revenu) ? revenu : 0) / Math.max(1, Number.isFinite(parts) ? parts : 1)
  return [...bareme].reverse().find((t) => q > t.de)?.taux ?? 0
}

export type StatutDirigeant = 'tns' | 'assimile'
export interface Remuneration {
  benefice: number      // résultat de la société avant la rémunération du dirigeant et avant l'impôt sur les sociétés
  statut: StatutDirigeant
  netMois: number       // rémunération nette par mois, avant impôt sur le revenu
  distribution: number  // part du résultat net (après impôt sur les sociétés) versée en dividendes
  capital: number       // capital social libéré (seuil des 10 %)
  primes?: number       // primes d'émission
  comptesCourants?: number // comptes courants d'associés (sommes laissées dans la société)
  parts: number         // parts du foyer fiscal
  autresRevenus?: number // autres revenus imposables du foyer, par an (conjoint, autres activités)
  deficit?: number      // déficits reportables de la société
}
type Base = Omit<Remuneration, 'netMois' | 'distribution'>
export interface ScenarioRemuneration {
  netAn: number; cotisations: number; coutSociete: number          // rémunération nette, cotisations, coût pour la société
  resultatAvantImpot: number; impotSocietes: number; resultatNet: number
  dividendes: number; partSoumise: number                          // dividendes bruts ; part qui cotise (gérant majoritaire)
  cotisationsDividendes: number; irDividendes: number; prelevementsSociaux: number; netDividendes: number
  seuilDividendes: number   // 10 % du capital, des primes et des comptes courants (gérant majoritaire)
  irRemuneration: number; imposable: number; trancheMarginale: number // impôt du barème dû à la rémunération, base, tranche
  netPerso: number          // ce que le dirigeant garde, impôt sur le revenu payé
  impotsEtCotisations: number // cotisations, impôt sur les sociétés, impôt sur le revenu, prélèvements sur dividendes
  resteSociete: number      // résultat net gardé dans la société (réserves, trésorerie)
  sortiesSociete: number    // ce qui sort de la trésorerie de la société : coût de la rémunération, impôt, dividendes
}
export interface EffetRemuneration { choix: ScenarioRemuneration; toutSalaire: ScenarioRemuneration; toutDividendes: ScenarioRemuneration }
export interface Recommandation {
  atteint: boolean          // le montant visé est atteignable avec ce bénéfice
  netMois: number           // rémunération nette par mois conseillée (avant impôt sur le revenu)
  distribution: number      // part du résultat net à verser en dividendes
  scenario: ScenarioRemuneration
}

const pos = (x: number | null | undefined) => (Number.isFinite(x) ? Math.max(0, x as number) : 0)
const part = (x: number | null | undefined) => Math.min(1, pos(x))
const fini = (x: number | null | undefined) => (Number.isFinite(x) ? (x as number) : 0)

function tauxCotisations(statut: StatutDirigeant, r: ReglesRemuneration) { return statut === 'tns' ? pos(r.cotisationsTNS) : pos(r.cotisationsAssimile) }
function cotisationsSur(netAn: number, statut: StatutDirigeant, r: ReglesRemuneration) {
  const c = netAn * tauxCotisations(statut, r)
  return statut === 'tns' ? Math.max(c, pos(r.minimumTNS)) : c
}

export function scenarioRemuneration(x: Base & { netAn: number; distribution: number }, r: ReglesRemuneration, impot: ParametresReseau['impot']): ScenarioRemuneration {
  const netAn = pos(x.netAn)
  const cotisations = cotisationsSur(netAn, x.statut, r)
  const coutSociete = netAn + cotisations
  const resultatAvantImpot = fini(x.benefice) - coutSociete
  const is = impotSocietes(resultatAvantImpot, pos(x.deficit), impot)
  const resultatNet = resultatAvantImpot - is
  const dividendes = Math.max(0, resultatNet) * part(x.distribution)
  const seuilDividendes = x.statut === 'tns' ? (pos(x.capital) + pos(x.primes) + pos(x.comptesCourants)) * pos(r.seuilDividendesTNS) : 0
  const partSoumise = x.statut === 'tns' ? Math.max(0, dividendes - seuilDividendes) : 0
  const cotisationsDividendes = partSoumise * pos(r.cotisationsTNS)
  const irDividendes = dividendes * pos(r.irDividendes)
  const prelevementsSociaux = (dividendes - partSoumise) * pos(r.prelevementsSociaux)
  const netDividendes = dividendes - cotisationsDividendes - irDividendes - prelevementsSociaux
  // Impôt du barème dû à la rémunération : impôt du foyer avec elle − impôt du foyer sans elle
  const imposable = netAn - Math.min(netAn * pos(r.abattement), pos(r.plafondAbattement))
  const parts = Math.max(1, fini(x.parts) || 1), autres = pos(x.autresRevenus)
  const irRemuneration = impotBareme(autres + imposable, parts) - impotBareme(autres, parts)
  return {
    netAn, cotisations, coutSociete, resultatAvantImpot, impotSocietes: is, resultatNet, dividendes, partSoumise, seuilDividendes,
    cotisationsDividendes, irDividendes, prelevementsSociaux, netDividendes, irRemuneration, imposable,
    trancheMarginale: trancheMarginale(autres + imposable, parts),
    netPerso: netAn - irRemuneration + netDividendes,
    impotsEtCotisations: cotisations + is + irRemuneration + cotisationsDividendes + irDividendes + prelevementsSociaux,
    resteSociete: resultatNet - dividendes,
    sortiesSociete: coutSociete + is + dividendes,
  }
}

// Trois façons de sortir le même bénéfice : ma répartition, tout en rémunération (le bénéfice entier part en salaire
// chargé, il ne reste rien à imposer dans la société), tout en dividendes (aucune rémunération, tout le résultat distribué)
export function simulerRemuneration(x: Remuneration, r: ReglesRemuneration, impot: ParametresReseau['impot']): EffetRemuneration {
  const { netMois: _n, distribution: _d, ...base } = x
  const netMax = netMaximum(base, r)
  return {
    choix: scenarioRemuneration({ ...base, netAn: pos(x.netMois) * 12, distribution: x.distribution }, r, impot),
    toutSalaire: scenarioRemuneration({ ...base, netAn: netMax, distribution: 0 }, r, impot),
    toutDividendes: scenarioRemuneration({ ...base, netAn: 0, distribution: 1 }, r, impot),
  }
}

// Tout en rémunération : net × (1 + taux) = bénéfice ; un gérant majoritaire paie au moins le minimum
function netMaximum(x: Base, r: ReglesRemuneration): number {
  const benefice = pos(x.benefice)
  const t = tauxCotisations(x.statut, r)
  let netMax = benefice / (1 + t)
  if (x.statut === 'tns' && netMax * t < pos(r.minimumTNS)) netMax = Math.max(0, benefice - pos(r.minimumTNS))
  return netMax
}

// Recommandation (Joseph, 18/11/2026) : pour garder un montant visé par an, net après tous les impôts (ce qui arrive sur
// le compte du foyer, la notion la plus simple pour un franchisé), le couple rémunération nette et part distribuée qui
// laisse le plus dans la société (donc le moins d'impôts et de cotisations). Recherche sur une grille de rémunérations,
// la part distribuée trouvée par dichotomie (ce que je garde croît avec elle), puis arrondie : rémunération à 10 € par
// mois, part au millième supérieur. Montant hors d'atteinte : le montage qui garde le plus.
export function recommanderRemuneration(x: Base, cibleAn: number, r: ReglesRemuneration, impot: ParametresReseau['impot']): Recommandation | null {
  const cible = pos(cibleAn)
  if (!cible || pos(x.benefice) <= 0) return null
  const netMax = netMaximum(x, r)
  const sc = (netAn: number, distribution: number) => scenarioRemuneration({ ...x, netAn, distribution }, r, impot)
  const partPour = (netAn: number): number | null => {
    if (sc(netAn, 1).netPerso < cible) return null
    if (sc(netAn, 0).netPerso >= cible) return 0
    let bas = 0, haut = 1
    for (let i = 0; i < 40; i++) { const m = (bas + haut) / 2; if (sc(netAn, m).netPerso >= cible) haut = m; else bas = m }
    return haut
  }
  let meilleur: { netAn: number; d: number; reste: number } | null = null
  let plus: { netAn: number; garde: number } = { netAn: 0, garde: -Infinity }
  const essayer = (netAn: number) => {
    const g = sc(netAn, 1).netPerso
    if (g > plus.garde) plus = { netAn, garde: g }
    const d = partPour(netAn)
    if (d === null) return
    const reste = sc(netAn, d).resteSociete
    if (!meilleur || reste > meilleur.reste + 0.005) meilleur = { netAn, d, reste }
  }
  const pas = netMax / 200
  for (let i = 0; i <= 200; i++) essayer(pas * i)
  const m0 = meilleur as { netAn: number } | null
  if (m0) { const c = m0.netAn; for (let i = -20; i <= 20; i++) essayer(Math.min(netMax, Math.max(0, c + (pas * i) / 20))) }
  const m = meilleur as { netAn: number; d: number } | null
  // Arrondis lisibles, sans repasser sous le montant visé
  const netMois = Math.round((m ? m.netAn : plus.netAn) / 120) * 10
  const netAn = Math.min(netMax, netMois * 12)
  let d = m ? (partPour(netAn) ?? 1) : 1
  d = Math.min(1, Math.max(0, Math.ceil(d * 1000 - 1e-6) / 1000))
  const scenario = sc(netAn, d)
  return { atteint: !!m, netMois: netAn / 12, distribution: d, scenario }
}

// Ce que laisse 1 € de bénéfice en plus, au point d'un scénario (pour expliquer la recommandation) :
// - en rémunération : 1 ÷ (1 + taux de cotisations) de net, moins l'impôt à la tranche marginale sur 90 % de ce net ;
// - en dividendes : 1 − impôt sur les sociétés à son taux marginal, puis − 12,8 % et − 18,6 % (prélèvement forfaitaire
//   unique), ou − 12,8 % et − cotisations du non-salarié pour la part au-delà du seuil des 10 %.
export function rendements(x: { statut: StatutDirigeant; deficit?: number }, sc: ScenarioRemuneration, r: ReglesRemuneration, impot: ParametresReseau['impot']) {
  const t = tauxCotisations(x.statut, r)
  const abattu = sc.netAn * pos(r.abattement) < pos(r.plafondAbattement) ? 1 - pos(r.abattement) : 1
  const salaire = (1 / (1 + t)) * (1 - sc.trancheMarginale * abattu)
  const tauxIS = sc.resultatAvantImpot - pos(x.deficit) >= impot.plafondTauxReduit ? impot.tauxNormal : impot.tauxReduit
  const auDela = x.statut === 'tns' && sc.dividendes >= sc.seuilDividendes
  const dividendes = (1 - tauxIS) * (1 - pos(r.irDividendes) - (auDela ? pos(r.cotisationsTNS) : pos(r.prelevementsSociaux)))
  return { salaire, dividendes, tauxIS, auDela }
}
