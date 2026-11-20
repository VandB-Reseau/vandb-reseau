import { expect, test } from '@playwright/test'
import { masseSelonFuts, prixFutMarche, type MarcheGros } from '../../../src/pilotage/moteur/boiteOutils'
import { parametresParDefaut } from '../../../src/pilotage/moteur/parametres'

// Prix du fût d'un gros marché extérieur (Joseph, 20/11/2026). Chiffres fictifs, vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 2) => expect(v).toBeCloseTo(attendu, chiffres)
const p = parametresParDefaut // redevance 2 %, publicité 1 %
// Festival : 60 fûts achetés 42 € HT ; coûts annexes 2 450 € (livraison 300, PLV 250, stand 400, entretien 150,
// achats annexes 350, tireuse 1 000) ; billet d'entrée en don de 1 000 € avec reçu Cerfa (coût réel 400 €)
const festival: MarcheGros = {
  futs: 60, prixAchat: 42, tva: 0.2,
  couts: [{ libelle: 'Livraison', montant: 300 }, { libelle: 'PLV', montant: 250 }, { libelle: 'Stand', montant: 400 }, { libelle: 'Entretien', montant: 150 }, { libelle: 'Achats annexes', montant: 350 }, { libelle: 'Tireuse', montant: 1_000 }],
  billet: { type: 'don', montant: 1_000, cerfa: true },
  marge: { mode: 'taux', valeur: 0.15 },
}

test('Marge souhaitée en part du CA : prix du fût, masse de marge, équilibre', () => {
  const r = prixFutMarche(festival, p)
  proche(r.annexes, 2_450)
  proche(r.billet.cout, 400)               // 1 000 − 60 %
  proche(r.coutsFixes, 2_850)
  proche(r.prixHT, 109.1463, 3)            // (42 + 2 850 ÷ 60) ÷ (1 − 3 % − 15 %) = 89,5 ÷ 0,82
  proche(r.prixTTC, 130.9756, 3)
  proche(r.ca, 6_548.78)
  proche(r.masseMarge, 982.32)             // 6 548,78 × 0,97 − 2 520 − 2 850 = 15 % du CA
  proche(r.tauxMasse, 0.15, 4)
  proche(r.prixPlancher, 92.268, 2)        // 89,5 ÷ 0,97
  proche(r.netParFut, 63.872, 2)           // 109,15 × 0,97 − 42
  expect(r.equilibre).toBe(45)             // 2 850 ÷ 63,87 = 44,6
  proche(r.parFut!.annexes, 40.83)
  proche(r.parFut!.billet, 6.67)
  proche(r.parFut!.marge, 16.37)
  // achat + annexes + billet + redevance + marge = prix
  proche(r.parFut!.achat + r.parFut!.annexes + r.parFut!.billet + r.parFut!.redevance + r.parFut!.marge, r.prixHT!, 6)
  const l = masseSelonFuts(r, 60)
  expect(l.map((x) => x.futs)).toEqual([30, 45, 60, 72])
  proche(l[0].masse, -933.8, 0)            // 30 × 63,87 − 2 850
  proche(l[2].masse, 982.32)
  expect(l[1].seuil && l[2].prevu).toBe(true)
})

test('Marge souhaitée en euros par fût ou au total, sponsoring sans réduction', () => {
  const parFut = prixFutMarche({ ...festival, marge: { mode: 'parFut', valeur: 20 } }, p)
  proche(parFut.prixHT, 112.8866, 3)        // (42 + (2 850 + 1 200) ÷ 60) ÷ 0,97
  proche(parFut.masseMarge, 1_200)
  const total = prixFutMarche({ ...festival, marge: { mode: 'total', valeur: 1_200 } }, p)
  proche(total.prixHT, parFut.prixHT!, 6)
  const sponso = prixFutMarche({ ...festival, billet: { type: 'sponsoring', montant: 1_000, cerfa: true }, marge: { mode: 'total', valeur: 0 } }, p)
  proche(sponso.billet.cout, 1_000)
  proche(sponso.prixHT, 102.577, 2)         // (42 + 3 450 ÷ 60) ÷ 0,97 = prix plancher
  proche(sponso.masseMarge, 0)
  const sansCerfa = prixFutMarche({ ...festival, billet: { type: 'don', montant: 1_000, cerfa: false } }, p)
  proche(sansCerfa.billet.cout, 1_000)
})

test('Cas limites : aucun fût, marge impossible', () => {
  expect(prixFutMarche({ ...festival, futs: 0 }, p).prixHT).toBeNull()
  expect(prixFutMarche({ ...festival, marge: { mode: 'taux', valeur: 0.97 } }, p).prixHT).toBeNull()
  expect(masseSelonFuts(prixFutMarche({ ...festival, futs: 0 }, p), 0)).toEqual([])
})

// Suite (Joseph, 20/11/2026) : contrat de 3 ans, 2 tireuses à 750 € (durée de vie 5 ans), 6 livraisons de 40 km à
// 0,60 €/km et 1,5 h, 16 h sur place, heure à 20 €, reversement de 5 € par fût, consignes 60 € et 85 € (3 bouteilles)
const complet: MarcheGros = {
  ...festival, reversement: 5, dureeContrat: 3,
  couts: [{ libelle: 'PLV', montant: 250 }, { libelle: 'Stand', montant: 400 }, { libelle: 'Entretien', montant: 150 }, { libelle: 'Achats annexes', montant: 350 }],
  tireuses: { nombre: 2, prix: 750, dureeVie: 5 },
  livraisons: { nombre: 6, km: 40, prixKm: 0.6, heures: 1.5 }, heuresSurPlace: 16, coutHoraire: 20,
  consignes: { fut: 60, bouteille: 85, bouteilles: 3, facturees: false },
}
test('Durée du contrat, tireuses, kilomètres, équipe, reversement, consignes', () => {
  const r = prixFutMarche(complet, p)
  proche(r.annexes, 1_150)
  proche(r.tireusesAn, 500)                // 1 500 ÷ 3 ans du contrat (plus court que 5 ans)
  expect(r.anneesTireuses).toBe(3)
  proche(r.resteNonAmorti, 600)            // 1 500 × 2 ÷ 5
  proche(r.kilometres, 144)                // 6 × 40 × 0,60
  proche(r.heures, 25)                     // 6 × 1,5 + 16
  proche(r.personnel, 500)
  proche(r.coutsFixes, 2_694)              // 1 150 + 400 + 500 + 144 + 500
  proche(r.prixHT, 112.0732, 3)            // (42 + 5 + 2 694 ÷ 60) ÷ 0,82
  proche(r.reversement, 300)
  proche(r.masseMarge, 1_008.66)           // 15 % de 6 724,39
  proche(r.masseContrat, 3_025.98)
  proche(r.prixPlancher, 94.742, 2)        // 91,9 ÷ 0,97
  expect(r.equilibre).toBe(44)             // 2 694 ÷ (112,07 × 0,97 − 47) = 43,7
  proche(r.parFut!.livraisons, 10.73)      // (144 + 500) ÷ 60
  const pf = r.parFut!
  proche(pf.achat + pf.reversement + pf.annexes + pf.tireuses + pf.livraisons + pf.billet + pf.redevance + pf.marge, r.prixHT!, 6)
  proche(r.consignes.bloque, 855)          // 10 fûts d'une livraison × 60 + 3 × 85
  const client = prixFutMarche({ ...complet, consignes: { ...complet.consignes!, facturees: true } }, p)
  expect(client.consignes.bloque).toBe(0)
  proche(client.consignes.avanceClient, 855)
  // Contrat plus long que la durée de vie : tireuses sur leur durée de vie, rien de non amorti
  const long = prixFutMarche({ ...complet, dureeContrat: 6 }, p)
  proche(long.tireusesAn, 300)
  proche(long.resteNonAmorti, 0)
})
