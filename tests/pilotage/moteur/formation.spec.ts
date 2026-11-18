import { expect, test } from '@playwright/test'
import { REGLES_FORMATION, simulerFormation, type Formation } from '../../../src/pilotage/moteur/formation'
import { parametresSimulateurs } from '../../../src/pilotage/moteur/simulateurs'

// Former un collaborateur (Joseph, 18/11/2026). Chiffres fictifs, vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 2) => expect(v).toBeCloseTo(attendu, chiffres)
const r = REGLES_FORMATION // 5 CV 0,636 €/km, + 20 % en électrique, OPCO (L'Opcommerce) 100 % du prix puis 13 €/h de salaire dans 2 000 € par an sous 11 salariés, CPF 150 €, apprenti 5 000 / 4 500 / 2 000 / 6 000 €
// 2 jours de 7 h à 20 € l'heure chargée, 350 € HT par jour ; 240 km en 5 CV, 30 € de péages, 1 nuit à 95 €, 4 repas à 18 € ;
// 14 h de remplacement à 20 € ; demande à l'OPCO ; marge 45 %
const x: Formation = {
  jours: 2, heuresParJour: 7, coutHeure: 20, pedagogiqueJour: 350, trajets: 1, kmAllerRetour: 240, puissance: 'cv5', electrique: false, peages: 30,
  nuits: 1, prixNuit: 95, repas: 4, prixRepas: 18, heuresRemplacement: 14, coutHeureRemplacement: 20,
  opco: true, opcoDejaUtilise: 0, opcoAutres: 0, effectif: 'moins11', cpf: 0, apprenti: null, tauxMarge: 0.45,
}

test('Formation : coût complet, prise en charge de l OPCO dans son budget annuel, reste à charge et CA pour le payer', () => {
  const e = simulerFormation(x, r)
  proche(e.heures, 14)
  proche(e.salaire, 280)          // 14 h × 20 €
  proche(e.pedagogique, 700)      // 2 × 350
  proche(e.indemnites, 152.64)    // 240 × 0,636
  proche(e.hotel, 95)
  proche(e.repas, 72)
  proche(e.remplacement, 280)
  proche(e.coutTotal, 1_609.64)
  proche(e.opcoPedagogique, 700)  // 100 % du prix, sous le budget de 2 000 €
  proche(e.opcoSalaire, 182)      // 14 h × 13 €, sous les 280 € de salaire et les 1 300 € restants
  proche(e.financements, 882)
  proche(e.resteACharge, 727.64)
  proche(e.parJour!, 363.82)
  proche(e.caPourPayer!, 1_732.48) // 727,64 ÷ (45 % − 3 %)
  expect(e.budgetOpco).toBe(2_000)
  proche(e.budgetOpcoAvant!, 2_000)
  proche(e.budgetOpcoApres!, 1_118) // 2 000 − 700 − 182
  // De 11 à 49 salariés : budget de 3 500 €
  proche(simulerFormation({ ...x, effectif: 'de11a49' }, r).budgetOpcoApres!, 2_618)
  // Plafond horaire réglé à 30 € (autre OPCO) : 14 h × 30 € = 420 €
  proche(simulerFormation(x, { ...r, opcoPedagogiqueHeure: 30 }).opcoPedagogique, 420)
  // Voiture électrique : 240 × 0,636 × 1,2 = 183,17 €
  proche(simulerFormation({ ...x, electrique: true }, r).indemnites, 183.17)
  // Budget OPCO de l'année presque pris : 1 500 € déjà utilisés, il reste 500 €, tout pour le prix, rien pour le salaire
  const presque = simulerFormation({ ...x, opcoDejaUtilise: 1_500 }, r)
  proche(presque.opcoPedagogique, 500)
  proche(presque.opcoSalaire, 0)
  proche(presque.budgetOpcoApres!, 0)
  // Sans demande à l'OPCO : tout reste au magasin
  proche(simulerFormation({ ...x, opco: false }, r).resteACharge, 1_609.64)
})

test('Formation : CPF du collaborateur d abord, forfait de 150 € sauf si le magasin complète ; apprenti', () => {
  // 600 € de droits CPF : il reste 100 € de prix de formation, pris par l'OPCO avec 182 € de salaire ; le magasin ne
  // complète pas, 150 € pour le salarié
  const c = simulerFormation({ ...x, cpf: 600 }, r)
  proche(c.cpf, 600)
  proche(c.opcoPedagogique, 100)
  proche(c.participationCollaborateur, 150)
  proche(c.opcoSalaire, 182)
  proche(c.resteACharge, 1_609.64 - 700 - 182)
  // 200 € de droits, sans OPCO : le magasin paie 500 € de la formation, forfait non dû
  const d = simulerFormation({ ...x, cpf: 200, opco: false }, r)
  proche(d.participationCollaborateur, 0)
  proche(d.resteACharge, 1_409.64)
  // Apprenti en BTS : CFA payé par l'OPCO (700 €), aide de 4 500 € la 1re année ; le CPF ne joue pas
  const a = simulerFormation({ ...x, cpf: 600, apprenti: 'niveau5' }, r)
  proche(a.cpf, 0)
  proche(a.opcoPedagogique, 700)
  proche(a.opcoSalaire, 0)
  proche(a.aide, 4_500)
  proche(a.resteACharge, 1_609.64 - 700 - 4_500)  // l'aide dépasse le coût : − 3 590,36 €
  expect(a.caPourPayer).toBeNull()
  // Repères : valeurs 2026 par défaut, modifiables par le Directeur
  expect(parametresSimulateurs({}).formation).toEqual(r)
  expect(parametresSimulateurs({ simulateurs: { formation: { ...r, opcoBudgetMoins11: 2_500 } } }).formation.opcoBudgetMoins11).toBe(2_500)
  // Anciennes clés (règles AKTO) ignorées : les règles de L'Opcommerce s'appliquent
  expect(parametresSimulateurs({ simulateurs: { formation: { opcoHeure: 30, opcoBudget: 2_500 } as never } }).formation).toEqual(r)
})
