import { expect, test } from '@playwright/test'
import { simulerLoyer, simulerMix } from '../../../src/pilotage/moteur/boiteOutils'
import { parametresParDefaut } from '../../../src/pilotage/moteur/parametres'
import { impotBareme, recommanderRemuneration, REGLES_REMUNERATION, rendements, scenarioRemuneration, simulerRemuneration } from '../../../src/pilotage/moteur/remunerationDirigeant'
import { parametresSimulateurs } from '../../../src/pilotage/moteur/simulateurs'

// Lot 287, 291, 292 (Joseph, 18/11/2026). Chiffres fictifs, vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 2) => expect(v).toBeCloseTo(attendu, chiffres)
const p = parametresParDefaut // redevance 2 %, publicité 1 %, impôt sur les sociétés 15 % jusqu'à 42 500 €, 25 % au-delà
const r = REGLES_REMUNERATION   // 45 % (gérant majoritaire), minimum 1 255 €, 80 % (SAS), 12,8 % + 18,6 %, seuil 10 %

test('287 · gérant majoritaire : rémunération et dividendes, impôts et cotisations, trésorerie', () => {
  // Bénéfice avant rémunération 60 000 € ; 2 000 € nets par mois ; la moitié du résultat net distribuée ;
  // capital 4 000 €, primes 1 000 €, comptes courants 5 000 € (seuil 1 000 €) ; foyer d'une part, sans autre revenu
  const x = { benefice: 60_000, statut: 'tns' as const, netMois: 2_000, distribution: 0.5, capital: 4_000, primes: 1_000, comptesCourants: 5_000, parts: 1 }
  const e = simulerRemuneration(x, r, p.impot)
  const c = e.choix
  proche(c.netAn, 24_000)
  proche(c.cotisations, 10_800)           // 24 000 × 45 %
  proche(c.coutSociete, 34_800)
  proche(c.resultatAvantImpot, 25_200)    // 60 000 − 34 800
  proche(c.impotSocietes, 3_780)          // 25 200 × 15 %
  proche(c.resultatNet, 21_420)
  proche(c.dividendes, 10_710)            // la moitié
  proche(c.seuilDividendes, 1_000)        // 10 % de 4 000 + 1 000 + 5 000
  proche(c.partSoumise, 9_710)            // au-delà de 10 % de 10 000 €
  proche(c.cotisationsDividendes, 4_369.5) // 9 710 × 45 %
  proche(c.irDividendes, 1_370.88)        // 10 710 × 12,8 %
  proche(c.prelevementsSociaux, 186)      // 1 000 × 18,6 %
  proche(c.netDividendes, 4_783.62)
  proche(c.imposable, 21_600)             // 24 000 − 10 % pour frais
  proche(c.irRemuneration, 1_100)         // (21 600 − 11 600) × 11 %
  proche(c.trancheMarginale, 0.11)
  proche(c.netPerso, 27_683.62)           // 24 000 − 1 100 + 4 783,62
  proche(c.impotsEtCotisations, 21_606.38) // 10 800 + 3 780 + 1 100 + 4 369,5 + 1 370,88 + 186
  proche(c.resteSociete, 10_710)
  proche(c.sortiesSociete, 49_290)        // 34 800 + 3 780 + 10 710
  // Rien ne se perd : ce que je garde + impôts et cotisations + ce qui reste dans la société = bénéfice
  proche(c.netPerso + c.impotsEtCotisations + c.resteSociete, 60_000)

  // Tout en rémunération : 60 000 ÷ 1,45 = 41 379,31 € nets, rien à imposer dans la société
  proche(e.toutSalaire.netAn, 41_379.31)
  proche(e.toutSalaire.cotisations, 18_620.69)
  proche(e.toutSalaire.impotSocietes, 0)
  // Impôt : 37 241,38 imposables ; 17 979 × 11 % + 7 662,38 × 30 % = 1 977,69 + 2 298,71 = 4 276,40
  proche(e.toutSalaire.irRemuneration, 4_276.40)
  proche(e.toutSalaire.netPerso, 37_102.91)
  // Tout en dividendes : minimum de cotisations 1 255 € ; IS 6 375 + 16 245 × 25 % = 10 436,25 €
  const d = e.toutDividendes
  proche(d.cotisations, 1_255)
  proche(d.impotSocietes, 10_436.25)
  proche(d.dividendes, 48_308.75)
  proche(d.cotisationsDividendes, 21_288.94)        // (48 308,75 − 1 000) × 45 %
  proche(d.netPerso, 20_650.29)                     // le gérant majoritaire perd à tout verser en dividendes
  proche(d.resteSociete, 0)
})

test('287 · président de SAS : dividendes sans cotisations, au prélèvement forfaitaire de 31,4 %', () => {
  const e = simulerRemuneration({ benefice: 60_000, statut: 'assimile', netMois: 0, distribution: 1, capital: 50_000, parts: 1 }, r, p.impot)
  const d = e.toutDividendes
  proche(d.cotisations, 0)
  proche(d.impotSocietes, 10_750)         // 6 375 + 17 500 × 25 %
  proche(d.dividendes, 49_250)
  proche(d.partSoumise, 0)                // assimilé salarié : pas de seuil
  proche(d.seuilDividendes, 0)
  proche(d.irDividendes, 6_304)           // 49 250 × 12,8 %
  proche(d.prelevementsSociaux, 9_160.5)  // 49 250 × 18,6 %
  proche(d.netPerso, 33_785.5)
  proche(e.toutSalaire.netAn, 33_333.33)  // 60 000 ÷ 1,8
  // 30 000 imposables : 17 979 × 11 % + 421 × 30 % = 1 977,69 + 126,30 = 2 103,99
  proche(e.toutSalaire.netPerso, 31_229.34)
  // Bénéfice trop petit : perte, ni impôt ni dividende
  const perte = scenarioRemuneration({ benefice: 10_000, statut: 'assimile', netAn: 12_000, distribution: 1, capital: 0, parts: 1 }, r, p.impot)
  proche(perte.resultatNet, -11_600)      // 10 000 − 12 000 × 1,8
  proche(perte.impotSocietes, 0)
  proche(perte.dividendes, 0)
  // Repères modifiables dans Paramètres ; absents : règles 2026
  expect(parametresSimulateurs({}).remuneration).toEqual(r)
  expect(parametresSimulateurs({ simulateurs: { remuneration: { ...r, prelevementsSociaux: 0.172 } } }).remuneration.prelevementsSociaux).toBe(0.172)
})

test('287 · barème de l impôt sur le revenu 2026, parts, autres revenus du foyer, plafond des frais', () => {
  proche(impotBareme(11_600, 1), 0)
  proche(impotBareme(50_000, 1), 8_103.99)          // 17 979 × 11 % + 20 421 × 30 % = 1 977,69 + 6 126,30
  proche(impotBareme(100_000, 2), 8_103.99 * 2)     // quotient familial : 50 000 par part
  proche(impotBareme(200_000, 1), 66_523.84)        // 1 977,69 + 54 998 × 30 % + 97 340 × 41 % + 18 083 × 45 %
  // Conjoint à 40 000 €, 2 parts : 24 000 € nets de rémunération → 21 600 imposables ; foyer 61 600 ÷ 2 = 30 800 par part
  // impôt avec : 2 × (1 977,69 + 1 221 × 30 %) = 4 687,98 ; sans : 2 × (8 400 × 11 %) = 1 848 ; dû à la rémunération 2 839,98
  const c = scenarioRemuneration({ benefice: 60_000, statut: 'assimile', netAn: 24_000, distribution: 0, capital: 0, parts: 2, autresRevenus: 40_000 }, r, p.impot)
  proche(c.irRemuneration, 2_839.98)
  proche(c.trancheMarginale, 0.3)
  // Plafond de la déduction pour frais : 200 000 € nets → 200 000 − 14 555 imposables
  proche(scenarioRemuneration({ benefice: 400_000, statut: 'assimile', netAn: 200_000, distribution: 0, capital: 0, parts: 1 }, r, p.impot).imposable, 185_445)
})

test('287 · montage recommandé pour garder un montant par mois, net après impôts', () => {
  // Non salarié, 60 000 € de bénéfice, garder 2 500 € par mois (30 000 € par an) : tout en rémunération, 2 660 € par mois.
  // 31 920 € nets : cotisations 14 364, imposable 28 728, impôt 17 128 × 11 % = 1 884,08 ; je garde 30 035,92 ;
  // IS (60 000 − 46 284) × 15 % = 2 057,40 ; reste 11 658,60 dans la société
  const base = { benefice: 60_000, statut: 'tns' as const, capital: 10_000, parts: 1 }
  const t = recommanderRemuneration(base, 30_000, r, p.impot)!
  expect(t.atteint).toBe(true)
  proche(t.netMois, 2_660)
  proche(t.distribution, 0)
  proche(t.scenario.netPerso, 30_035.92)
  proche(t.scenario.resteSociete, 11_658.6)
  // À ce niveau, 1 € de bénéfice laisse 1 ÷ 1,45 × (1 − 11 % × 90 %) = 0,6214 € en rémunération, 0,85 × (1 − 12,8 % − 18,6 %) = 0,5831 € en dividendes
  const g = rendements(base, t.scenario, r, p.impot)
  proche(g.salaire, 0.6214, 4)
  proche(g.dividendes, 0.5831, 4)
  // Assimilé salarié : la rémunération ramène le bénéfice à 42 500 € (fin du taux de 15 %), le reste en dividendes.
  // 810 € par mois : 9 720 € nets, 7 776 € de charges, bénéfice 42 504 € ; 81,9 % distribués
  const a = recommanderRemuneration({ ...base, statut: 'assimile' }, 30_000, r, p.impot)!
  proche(a.netMois, 810)
  proche(a.distribution, 0.819, 3)
  expect(a.scenario.netPerso).toBeGreaterThanOrEqual(30_000)
  proche(a.scenario.resultatAvantImpot, 42_504)
  // Toujours au moins le montant visé, et jamais moins dans la société qu'avec tout en rémunération ou tout en dividendes
  const e = simulerRemuneration({ ...base, netMois: 0, distribution: 0 }, r, p.impot)
  expect(t.scenario.resteSociete).toBeGreaterThanOrEqual(e.toutSalaire.resteSociete)
  // Hors d'atteinte : le montage qui garde le plus, signalé
  const h = recommanderRemuneration(base, 45_000, r, p.impot)!
  expect(h.atteint).toBe(false)
  expect(h.scenario.netPerso).toBeLessThan(45_000)
  expect(h.scenario.netPerso).toBeGreaterThanOrEqual(e.toutSalaire.netPerso)
  // Rien visé : pas de recommandation
  expect(recommanderRemuneration(base, 0, r, p.impot)).toBeNull()
})

test('291 · loyer : poids dans le CA, hausse, cumul sur le bail, CA pour l absorber, loyer supportable', () => {
  // CA 400 000 €, marge 45 %, EBE 40 000 € ; loyer 30 000 € + 3 000 € de charges ; +10 % sur 3 ans ; repère 8 %
  const e = simulerLoyer({ ca: 400_000, tauxMarge: 0.45, ebe: 40_000, loyer: 30_000, charges: 3_000, nouveauLoyer: 33_000, annees: 3, repere: 0.08 }, p)
  proche(e.avant.part!, 0.0825, 4)        // 33 000 ÷ 400 000
  proche(e.apres.part!, 0.09, 4)          // 36 000 ÷ 400 000
  proche(e.apres.ebe, 37_000)
  proche(e.ecartMois, 250)
  proche(e.cumul, 9_000)
  proche(e.caPourAbsorber!, 7_142.86)     // 3 000 ÷ (45 % − 3 %)
  proche(e.supportable!, 29_000)          // 8 % × 400 000 − 3 000
  // Une baisse : rien à absorber ; pas de repère : pas de loyer supportable
  const baisse = simulerLoyer({ ca: 400_000, tauxMarge: 0.45, ebe: 40_000, loyer: 30_000, charges: 0, nouveauLoyer: 27_000, annees: 0, repere: 0 }, p)
  proche(baisse.apres.ebe, 43_000)
  expect(baisse.caPourAbsorber).toBeNull()
  expect(baisse.supportable).toBeNull()
})

test('292 · mix Cave / Bar : marge, heures selon la grille du siège, EBE', () => {
  const grille = [{ partBar: 0.53, cible: 95 }, { partBar: 0.46, cible: 102 }, { partBar: 0, cible: 117 }]
  // 300 000 € en cave à 35 %, 100 000 € au bar à 70 % ; 5 % du CA (20 000 €) passe au bar ; 2 h par semaine à 20 €
  const e = simulerMix({ caCave: 300_000, caBar: 100_000, margeCave: 0.35, margeBar: 0.7, part: 0.05, sens: 'vers_bar', heuresSemaine: 2, coutHoraire: 20, grille })
  proche(e.deplace, 20_000)
  proche(e.avant.marge, 175_000)
  proche(e.apres.marge, 182_000)          // 280 000 × 35 % + 120 000 × 70 %
  proche(e.ecartMarge, 7_000)
  proche(e.heuresGrille!, 0)              // 25 % puis 30 % de bar : même cible, 117 € par heure
  proche(e.personnel, 2_080)              // 2 × 52 × 20
  proche(e.ecartEbe, 4_920)
  // Moitié-moitié, 5 % vers le bar : la cible passe de 102 à 95 € par heure ; heures de la grille
  const g = simulerMix({ caCave: 200_000, caBar: 200_000, margeCave: 0.35, margeBar: 0.7, part: 0.05, sens: 'vers_bar', heuresSemaine: null, coutHoraire: 20, grille })
  proche(g.avant.heuresVisees!, 3_921.57) // 400 000 ÷ 102
  proche(g.apres.heuresVisees!, 4_210.53) // 400 000 ÷ 95
  proche(g.heuresSemaine, 5.5569, 3)      // (4 210,53 − 3 921,57) ÷ 52
  proche(g.personnel, 5_779.15)          // (400 000 ÷ 95 − 400 000 ÷ 102) × 20
  proche(g.ecartEbe, 1_220.85)            // 7 000 − 5 779,15
  // Vers la cave : on ne déplace jamais plus que le CA du bar
  const v = simulerMix({ caCave: 300_000, caBar: 10_000, margeCave: 0.35, margeBar: 0.7, part: 0.5, sens: 'vers_cave', heuresSemaine: 0, coutHoraire: 20, grille: [] })
  proche(v.deplace, 10_000)
  proche(v.ecartMarge, -3_500)            // 10 000 × (35 % − 70 %)
})
