import { expect, test } from '@playwright/test'
import { REGLES_FORMATION, simulerFormation, type Formation } from '../../../src/pilotage/moteur/formation'
import { parametresSimulateurs } from '../../../src/pilotage/moteur/simulateurs'

// Former un collaborateur (Joseph, 18/11/2026). Chiffres fictifs, vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 2) => expect(v).toBeCloseTo(attendu, chiffres)
const r = REGLES_FORMATION // 5 CV 0,636 €/km, + 20 % en électrique, OPCO 30 €/h dans 2 500 € par an, CPF 150 €, apprenti 5 000 / 4 500 / 2 000 / 6 000 €
// 2 jours de 7 h à 20 € l'heure chargée, 350 € HT par jour ; 240 km en 5 CV, 30 € de péages, 1 nuit à 95 €, 4 repas à 18 € ;
// 14 h de remplacement à 20 € ; demande à l'OPCO ; marge 45 %
const x: Formation = {
  jours: 2, heuresParJour: 7, coutHeure: 20, pedagogiqueJour: 350, trajets: 1, kmAllerRetour: 240, puissance: 'cv5', electrique: false, peages: 30,
  nuits: 1, prixNuit: 95, repas: 4, prixRepas: 18, heuresRemplacement: 14, coutHeureRemplacement: 20,
  opco: true, opcoDejaUtilise: 0, opcoAutres: 0, cpf: 0, apprenti: null, tauxMarge: 0.45,
}

test('Formation : coût complet, prise en charge de l OPCO au plafond horaire, reste à charge et CA pour le payer', () => {
  const e = simulerFormation(x, r)
  proche(e.heures, 14)
  proche(e.salaire, 280)          // 14 h × 20 €
  proche(e.pedagogique, 700)      // 2 × 350
  proche(e.indemnites, 152.64)    // 240 × 0,636
  proche(e.hotel, 95)
  proche(e.repas, 72)
  proche(e.remplacement, 280)
  proche(e.coutTotal, 1_609.64)
  proche(e.opcoPedagogique, 420)  // 14 h × 30 €, sous les 700 € et le budget de 2 500 €
  proche(e.resteACharge, 1_189.64)
  proche(e.parJour!, 594.82)
  proche(e.caPourPayer!, 2_832.48) // 1 189,64 ÷ (45 % − 3 %)
  // Voiture électrique : 240 × 0,636 × 1,2 = 183,17 €
  proche(simulerFormation({ ...x, electrique: true }, r).indemnites, 183.17)
  // Budget OPCO de l'année presque pris : 2 300 € déjà utilisés, il reste 200 €
  proche(simulerFormation({ ...x, opcoDejaUtilise: 2_300 }, r).opcoPedagogique, 200)
  // Sans demande à l'OPCO : tout reste au magasin
  proche(simulerFormation({ ...x, opco: false }, r).resteACharge, 1_609.64)
})

test('Formation : CPF du collaborateur d abord, forfait de 150 € sauf si le magasin complète ; apprenti', () => {
  // 600 € de droits CPF : il reste 100 € de prix de formation, pris par l'OPCO ; le magasin ne complète pas, 150 € pour le salarié
  const c = simulerFormation({ ...x, cpf: 600 }, r)
  proche(c.cpf, 600)
  proche(c.opcoPedagogique, 100)
  proche(c.participationCollaborateur, 150)
  proche(c.resteACharge, 1_609.64 - 700)
  // 200 € de droits, sans OPCO : le magasin paie 500 € de la formation, forfait non dû
  const d = simulerFormation({ ...x, cpf: 200, opco: false }, r)
  proche(d.participationCollaborateur, 0)
  proche(d.resteACharge, 1_409.64)
  // Apprenti en BTS : CFA payé par l'OPCO (700 €), aide de 4 500 € la 1re année ; le CPF ne joue pas
  const a = simulerFormation({ ...x, cpf: 600, apprenti: 'niveau5' }, r)
  proche(a.cpf, 0)
  proche(a.opcoPedagogique, 700)
  proche(a.aide, 4_500)
  proche(a.resteACharge, 1_609.64 - 700 - 4_500)  // l'aide dépasse le coût : − 3 590,36 €
  expect(a.caPourPayer).toBeNull()
  // Repères : valeurs 2026 par défaut, modifiables par le Directeur
  expect(parametresSimulateurs({}).formation).toEqual(r)
  expect(parametresSimulateurs({ simulateurs: { formation: { ...r, opcoHeure: 25 } } }).formation.opcoHeure).toBe(25)
})
