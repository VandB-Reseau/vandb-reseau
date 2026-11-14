import { expect, test } from '@playwright/test'
import {
  cartePression, cibleProductivite, coutComposition, coutContrats, diagnosticMarge, ecrireCausesDemarque, leviersPour, lireCausesDemarque,
  margePourPrix, nouveauBec, prixPourMarge, productiviteCible, simulerExterieur, simulerOuverture, simulerParc, type Bec, type ContratExterieur,
} from '../../../src/pilotage/moteur/boiteOutils'
import { parametresParDefaut } from '../../../src/pilotage/moteur/parametres'
import { parametresSimulateurs } from '../../../src/pilotage/moteur/simulateurs'

// Boîte à outils du coach (vague 9, choix 138 à 147, Joseph 14/11/2026). Chiffres fictifs, chaque résultat se vérifie à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 6) => expect(v).toBeCloseTo(attendu, chiffres)
const p = parametresParDefaut // redevance 2 %, publicité 1 %

const contrat: ContratExterieur = {
  futs: 40, prixVente: 69, remise: 0, prixAchat: 41.34, co2: 0.76, gobelets: 0,
  tireuse: 'neuve', prixTireuse: 1_500, dureeTireuse: 5, entretien: 0,
  livraisons: 10, km: 30, prixKm: 0.6, heures: 1.5, coutHoraire: 20,
  don: { type: 'aucun', montant: 0, futs: 0, cerfa: false },
}

test('contrat extérieur : net par fût, coûts fixes, équilibre, remise maximale, prix plancher d’une livraison', () => {
  const r = simulerExterieur(contrat, p, false)
  // 69 − 3 % (2,07) − 41,34 − 0,76 = 24,83 € par fût
  proche(r.redevanceParFut, 2.07)
  proche(r.netParFut, 24.83)
  // Tireuse 1 500 ÷ 5 = 300 ; livraison 30 km × 0,60 + 1,5 h × 20 = 48 €, × 10 = 480 ; total 780 €
  proche(r.tireuseAn, 300)
  proche(r.coutLivraison, 48)
  proche(r.coutFixe, 780)
  // Équilibre : 780 ÷ 24,83 = 31,4 → 32 fûts ; à 40 fûts : 993,20 − 780 = 213,20 €
  expect(r.equilibre).toBe(32)
  proche(r.gain, 213.2)
  // Remise tenable à 40 fûts : (24,83 − 780 ÷ 40) ÷ 0,97 = 5,49 €
  proche(r.remiseMax, (24.83 - 19.5) / 0.97)
  // Une livraison facturée au moins 48 ÷ 0,97 = 49,48 € HT
  proche(r.prixPlancherLivraison, 48 / 0.97)
  // Remise de 5 € : 64 − 1,92 − 42,10 = 19,98 € ; 780 ÷ 19,98 = 39,04 → 40 fûts ; gain à 40 fûts 19,20 €
  const remise = simulerExterieur({ ...contrat, remise: 5 }, p, false)
  proche(remise.netParFut, 19.98)
  expect(remise.equilibre).toBe(40)
  proche(remise.gain, 19.2)
  // Tireuse déjà dans le parc : seulement son entretien
  proche(simulerExterieur({ ...contrat, tireuse: 'parc', entretien: 100 }, p, false).coutFixe, 580)
})

test('don à l’association : réduction mécénat de 60 % seulement si le réseau l’autorise et que le reçu Cerfa est demandé', () => {
  const argent = { ...contrat, don: { type: 'argent' as const, montant: 1_000, futs: 0, cerfa: true } }
  expect(simulerExterieur(argent, p, true).don).toEqual({ valeur: 1_000, reduction: 600, cout: 400 })
  expect(simulerExterieur(argent, p, false).don).toEqual({ valeur: 1_000, reduction: 0, cout: 1_000 })
  expect(simulerExterieur({ ...argent, don: { ...argent.don, cerfa: false } }, p, true).don.cout).toBe(1_000)
  proche(simulerExterieur(argent, p, true).coutFixe, 1_180)
  // En nature : 10 fûts au prix d'achat = 413,40 €, réduction 248,04 €, coût 165,36 €
  const nature = simulerExterieur({ ...contrat, don: { type: 'nature', montant: 0, futs: 10, cerfa: true } }, p, true).don
  proche(nature.valeur, 413.4)
  proche(nature.reduction, 248.04)
  proche(nature.cout, 165.36)
})

test('parc de tireuses : occupation, marge perdue sur les refus, racheter ou remplacer', () => {
  const r = simulerParc({
    tireuses: 3, semainesSaison: 22, sortiesSaison: 50, sortiesHorsSaison: 12, refus: 12, futsParSortie: 3, netParFut: 24.83,
    prixNeuve: 1_500, dureeVie: 5, entretien: 100, vieilles: [{ nom: 'Tireuse 1', age: 8, reparations: 450 }, { nom: 'Tireuse 2', age: 4, reparations: 120 }],
  })
  // 50 sorties ÷ (3 × 22 semaines) ; 12 ÷ (3 × 30)
  proche(r.occupationSaison, 50 / 66)
  proche(r.occupationHorsSaison, 12 / 90)
  // 12 refus × 3 fûts × 24,83 € = 893,88 € face à 300 + 100 = 400 € par an : racheter, 2,2 fois couvert
  proche(r.margePerdue, 893.88)
  proche(r.coutAnnuelNeuve, 400)
  expect(r.racheter).toBe(true)
  proche(r.couverture, 893.88 / 400)
  expect(r.aRemplacer).toEqual(['Tireuse 1'])
})

const blonde: Bec = { biere: 'Blonde', prixFut: 90, litres: 30, perte: 0.1, prixDemi: 4.2, prixPinte: 7.8, demis: 100, pintes: 40 }
const ipa: Bec = { biere: 'IPA', prixFut: 120, litres: 20, perte: 0.1, prixDemi: 4.8, prixPinte: 9, demis: 10, pintes: 5 }

test('carte pression : coût au verre, marge, jours pour vider un fût, bec à revoir', () => {
  const c = cartePression([blonde, ipa], 0.2, 0.68, 21)
  const [b, i] = c.lignes
  // Blonde : 27 l servis, 3,33 € le litre ; demi 0,83 € pour 3,50 € HT ; 610 € de CA et 460 € de marge par semaine
  proche(b.coutLitre, 90 / 27)
  proche(b.tauxDemi, (3.5 - 90 / 27 / 4) / 3.5)
  proche(b.caSemaine, 610)
  proche(b.margeSemaine, 460)
  // 45 litres par semaine : fût vidé en 27 ÷ (45 ÷ 7) = 4,2 jours ; 45 × 52 ÷ 12 ÷ 27 = 7,22 fûts par mois
  proche(b.joursPourVider, 4.2)
  proche(b.futsParMois, 45 * 52 / 12 / 27)
  expect(b.vieillit || b.sousCible).toBe(false)
  // IPA : 77,50 € de CA, 44,17 € de marge (57 %), 25,2 jours pour vider un fût : à revoir ; demi à 6,25 € pour 68 %
  proche(i.caSemaine, 77.5)
  proche(i.margeSemaine, 77.5 - 100 / 3)
  proche(i.joursPourVider, 25.2)
  expect(i).toMatchObject({ vieillit: true, sousCible: true })
  proche(i.prixDemiCible, 6.25)
  expect(c.faible).toBe(1)
  proche(c.margeSemaine, 460 + 77.5 - 100 / 3)
})

test('ajouter ou remplacer un bec : marge du nouveau moins cannibalisation et bec retiré', () => {
  const blanche: Bec = { biere: 'Blanche', prixFut: 80, litres: 30, perte: 0.1, prixDemi: 4.2, prixPinte: 7.8, demis: 40, pintes: 10 }
  // Blanche : 205 € de CA, 44,44 € de coût, 160,56 € de marge, 15 l par semaine
  const ajout = nouveauBec([blonde, ipa], blanche, { cout: 500, cannibalisation: 0.5, remplace: null }, 0.2)
  proche(ajout.margeNouveau, 205 - 80 / 27 * 15)
  // Marge par litre des becs en place : (460 + 44,17) ÷ 50 l = 10,08 € ; la moitié des 15 l est prise aux autres
  const parLitre = (460 + 77.5 - 100 / 3) / 50
  proche(ajout.perteCannibalisation, 7.5 * parLitre)
  proche(ajout.gainSemaine, ajout.margeNouveau - 7.5 * parLitre)
  proche(ajout.semainesRetour, 500 / ajout.gainSemaine)
  // Remplacer l'IPA : on perd aussi ses 44,17 € par semaine ; la cannibalisation se lit sur la Blonde seule
  const remplace = nouveauBec([blonde, ipa], blanche, { cout: 500, cannibalisation: 0.5, remplace: 1 }, 0.2)
  proche(remplace.perteRemplace, 77.5 - 100 / 3)
  proche(remplace.perteCannibalisation, 7.5 * 460 / 45)
})

test('calculette : prix pour une marge, marge pour un prix, coefficient', () => {
  const cout = coutComposition([{ libelle: 'Planche', cout: 3.2, quantite: 1 }, { libelle: 'Fromage', cout: 1.5, quantite: 2 }])
  proche(cout, 6.2)
  // 70 % de marge : 6,20 ÷ 0,30 = 20,67 € HT, 22,73 € TTC à 10 %, coefficient 3,67
  const prix = prixPourMarge(cout, 0.7, 0.1)!
  proche(prix.prixHT, 6.2 / 0.3)
  proche(prix.prixTTC, 6.2 / 0.3 * 1.1)
  proche(prix.coefficient, 6.2 / 0.3 * 1.1 / 6.2)
  expect(prixPourMarge(cout, 1, 0.1)).toBeNull()
  // Vendu 22 € TTC : 20 € HT, 13,80 € de marge, 69 %
  const marge = margePourPrix(cout, 22, 0.1)
  proche(marge.prixHT, 20)
  proche(marge.marge, 13.8)
  proche(marge.tauxMarge, 0.69)
})

test('écart de marge : un point en euros, causes gardées et relues', () => {
  const d = diagnosticMarge(300_000, -0.015, 0.01)!
  proche(d.unPoint, 3_000)
  proche(d.ecartEuros, -4_500)
  expect(d.alerte).toBe(true)
  expect(diagnosticMarge(300_000, -0.005, 0.01)!.alerte).toBe(false)
  expect(diagnosticMarge(0, -0.02, 0.01)).toBeNull()
  const texte = ecrireCausesDemarque(['casse', 'offerts'], 'Inventaire de juin oublié')
  expect(texte).toBe('Causes : Offerts et dégustations non passés en caisse ; Casse. Inventaire de juin oublié')
  expect(lireCausesDemarque(texte)).toEqual({ causes: ['offerts', 'casse'], phrase: 'Inventaire de juin oublié' })
})

test('productivité cible selon la part du bar, ETP et coût selon le contrat', () => {
  const grille = parametresSimulateurs({ simulateurs: { productivite: [{ partBar: 0, cible: 130 }, { partBar: 0.55, cible: 100 }, { partBar: 0.45, cible: 105 }, { partBar: 0.35, cible: 110 }, { partBar: 0.3, cible: 120 }] } }).productivite
  expect(grille.map((x) => x.cible)).toEqual([100, 105, 110, 120, 130])
  expect(cibleProductivite(grille, 0.55)).toBe(100)
  expect(cibleProductivite(grille, 0.5)).toBe(105)
  expect(cibleProductivite(grille, 0.2)).toBe(130)
  expect(cibleProductivite([], 0.5)).toBeNull()
  // 400 000 € dont 40 % de bar : 110 €/h ; 3 636 h visées, soit 2,26 ETP, face à 3 800 h (2,36 ETP)
  const r = productiviteCible(400_000, 160_000, 3_800, grille)!
  expect(r.cible).toBe(110)
  proche(r.heuresCible, 400_000 / 110)
  proche(r.etpCible, 400_000 / 110 / 1607)
  proche(r.etpReel, 3_800 / 1607)
  proche(r.ecartHeures, 3_800 - 400_000 / 110)
  // CDD : + 10 % ; intérim à coefficient 2 : 1 800 € × 2 × 6 mois
  expect(coutContrats(20_000, 1_800, 6, 2)).toEqual({ cdi: 20_000, cdd: 22_000, interim: 21_600 })
  expect(coutContrats(20_000, 1_800, 6, 0).interim).toBeNull()
})

test('ouvrir un dimanche : CA nouveau, heures majorées, CA pour ne rien perdre', () => {
  const r = simulerOuverture({ caBar: 1_200, caCave: 800, margeBar: 0.7, margeCave: 0.35, report: 0.25, heures: 16, coutHoraire: 20, majoration: 0.5, frais: 50 }, p)
  // 2 000 € dont un quart aurait été fait un autre jour : 1 500 € nouveaux ; marge (840 + 280) × 0,75 = 840 €
  proche(r.caNouveau, 1_500)
  proche(r.marge, 840)
  proche(r.redevance, 45)
  // 16 h × 20 € × 1,5 = 480 € ; gain 840 − 45 − 480 − 50 = 265 €
  proche(r.personnel, 480)
  proche(r.gain, 265)
  // Marge moyenne 56 % : 530 ÷ (0,75 × 0,53) = 1 333 € de CA du jour pour ne rien perdre
  proche(r.seuil, 530 / (0.75 * 0.53))
})

test('redressement : leviers des causes cochées, dans l’ordre, sans doublon ; réglages par défaut', () => {
  expect(leviersPour(['charges', 'gestion']).map((l) => l.cle)).toEqual(['preco', 'inventaire', 'consignes', 'tresorerie', 'bilan', 'marge', 'masse', 'seuil', 'echeancier', 'loyer'])
  expect(leviersPour([])).toEqual([])
  const d = parametresSimulateurs(null)
  expect(d.tva).toEqual({ normale: 0.2, intermediaire: 0.1, reduite: 0.055 })
  expect(d).toMatchObject({ donMecenat: false, coutHoraire: 0, productivite: [], coefInterim: 0 })
  expect(parametresSimulateurs({ simulateurs: { donMecenat: true, tva: { normale: 0.2, intermediaire: 0.1, reduite: 0 } } })).toMatchObject({ donMecenat: true, tva: { reduite: 0 } })
})
