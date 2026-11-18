import { expect, test } from '@playwright/test'
import { simulerLoyer, simulerMix } from '../../../src/pilotage/moteur/boiteOutils'
import { parametresParDefaut } from '../../../src/pilotage/moteur/parametres'
import { REGLES_REMUNERATION, scenarioRemuneration, simulerRemuneration } from '../../../src/pilotage/moteur/remunerationDirigeant'
import { parametresSimulateurs } from '../../../src/pilotage/moteur/simulateurs'

// Lot 287, 291, 292 (Joseph, 18/11/2026). Chiffres fictifs, vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 2) => expect(v).toBeCloseTo(attendu, chiffres)
const p = parametresParDefaut // redevance 2 %, publicité 1 %, impôt sur les sociétés 15 % jusqu'à 42 500 €, 25 % au-delà
const r = REGLES_REMUNERATION   // 45 % (gérant majoritaire), minimum 1 255 €, 80 % (SAS), 12,8 % + 18,6 %, seuil 10 %

test('287 · gérant majoritaire : rémunération et dividendes, impôts et cotisations, trésorerie', () => {
  // Bénéfice avant rémunération 60 000 € ; 2 000 € nets par mois ; la moitié du résultat net distribuée ;
  // capital et comptes courants 10 000 € ; foyer prélevé à 10 %
  const x = { benefice: 60_000, statut: 'tns' as const, netMois: 2_000, distribution: 0.5, capital: 10_000, tauxFoyer: 0.1 }
  const e = simulerRemuneration(x, r, p.impot)
  const c = e.choix
  proche(c.netAn, 24_000)
  proche(c.cotisations, 10_800)           // 24 000 × 45 %
  proche(c.coutSociete, 34_800)
  proche(c.resultatAvantImpot, 25_200)    // 60 000 − 34 800
  proche(c.impotSocietes, 3_780)          // 25 200 × 15 %
  proche(c.resultatNet, 21_420)
  proche(c.dividendes, 10_710)            // la moitié
  proche(c.partSoumise, 9_710)            // au-delà de 10 % de 10 000 €
  proche(c.cotisationsDividendes, 4_369.5) // 9 710 × 45 %
  proche(c.irDividendes, 1_370.88)        // 10 710 × 12,8 %
  proche(c.prelevementsSociaux, 186)      // 1 000 × 18,6 %
  proche(c.netDividendes, 4_783.62)
  proche(c.irRemuneration, 2_400)         // 24 000 × 10 %
  proche(c.netPerso, 26_383.62)           // 24 000 − 2 400 + 4 783,62
  proche(c.impotsEtCotisations, 22_906.38)
  proche(c.resteSociete, 10_710)
  proche(c.sortiesSociete, 49_290)        // 34 800 + 3 780 + 10 710
  // Rien ne se perd : ce que je garde + impôts et cotisations + ce qui reste dans la société = bénéfice
  proche(c.netPerso + c.impotsEtCotisations + c.resteSociete, 60_000)

  // Tout en rémunération : 60 000 ÷ 1,45 = 41 379,31 € nets, rien à imposer dans la société
  proche(e.toutSalaire.netAn, 41_379.31)
  proche(e.toutSalaire.cotisations, 18_620.69)
  proche(e.toutSalaire.impotSocietes, 0)
  proche(e.toutSalaire.netPerso, 37_241.38)          // 41 379,31 × 90 %
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
  const e = simulerRemuneration({ benefice: 60_000, statut: 'assimile', netMois: 0, distribution: 1, capital: 0, tauxFoyer: 0.1 }, r, p.impot)
  const d = e.toutDividendes
  proche(d.cotisations, 0)
  proche(d.impotSocietes, 10_750)         // 6 375 + 17 500 × 25 %
  proche(d.dividendes, 49_250)
  proche(d.partSoumise, 0)
  proche(d.irDividendes, 6_304)           // 49 250 × 12,8 %
  proche(d.prelevementsSociaux, 9_160.5)  // 49 250 × 18,6 %
  proche(d.netPerso, 33_785.5)
  proche(e.toutSalaire.netAn, 33_333.33)  // 60 000 ÷ 1,8
  proche(e.toutSalaire.netPerso, 30_000)
  // Bénéfice trop petit : perte, ni impôt ni dividende
  const perte = scenarioRemuneration({ benefice: 10_000, statut: 'assimile', netAn: 12_000, distribution: 1, capital: 0, tauxFoyer: 0 }, r, p.impot)
  proche(perte.resultatNet, -11_600)      // 10 000 − 12 000 × 1,8
  proche(perte.impotSocietes, 0)
  proche(perte.dividendes, 0)
  // Repères modifiables dans Paramètres ; absents : règles 2026
  expect(parametresSimulateurs({}).remuneration).toEqual(r)
  expect(parametresSimulateurs({ simulateurs: { remuneration: { ...r, prelevementsSociaux: 0.172 } } }).remuneration.prelevementsSociaux).toBe(0.172)
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
