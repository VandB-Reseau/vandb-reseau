import { expect, test } from '@playwright/test'
import { calculerBudget } from '../../../src/pilotage/moteur/budget'
import { economieFranchise } from '../../../src/pilotage/moteur/economie'
import { coutPersonne, type Personne } from '../../../src/pilotage/moteur/equipe'
import { parametresParDefaut } from '../../../src/pilotage/moteur/parametres'
import {
  caCorner, etatBudget, joursOuverts, parametresSimulateurs, resteAFaire, simulerAchat, simulerCoupDur, simulerEmbauche,
  simulerInvestissement, simulerPrix, simulerSoiree, simulerVenteAdditionnelle, tempsFortDeSoiree,
} from '../../../src/pilotage/moteur/simulateurs'
import type { Budget } from '../../../src/pilotage/moteur/types'
import { magasinFictif } from '../donnees-fictives'

// Simulateurs du franchisé (choix 125 à 135, Joseph 13/11/2026). Magasin fictif, chaque résultat se vérifie à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 6) => expect(v).toBeCloseTo(attendu, chiffres)
const p = parametresParDefaut
const s = { h: magasinFictif, p, depart: 20_000 }

test('promo et hausse de prix : ventes en plus ou ventes qu’on peut perdre à marge égale', () => {
  // Marge 30 %, remise 10 % : il reste 20 % par article, il faut vendre 30 ÷ 20 = 1,5 fois plus (+ 50 %)
  const r = simulerPrix('remise', 0.1, 0.3)
  proche(r.ventesEnPlus, 0.5)
  proche(r.nouveauTauxMarge, 0.2 / 0.9)
  // Remise égale à la marge : vente à perte, aucun volume ne compense
  expect(simulerPrix('remise', 0.3, 0.3).ventesEnPlus).toBeNull()
  // Hausse de 5 % : marge par article 35 % de l'ancien prix ; on peut perdre 1 − 30 ÷ 35 = 14,29 % des ventes
  const h = simulerPrix('hausse', 0.05, 0.3)
  proche(h.ventesPerdables, 1 - 0.3 / 0.35)
  proche(h.nouveauTauxMarge, 0.35 / 1.05)
})

test('vente additionnelle : un article de plus à 1 client sur 10', () => {
  const b = { flux: { cave: { objectif: 30_000 } }, familles: [{ univers: 'cave', objectif: 600_000, margeObjectif: 180_000 }] } as unknown as Budget
  const e = simulerVenteAdditionnelle(b, p, { univers: 'cave', unSur: 10, prixTTC: 12 })!
  // 30 000 tickets ÷ 10 = 3 000 articles × 12 € = 36 000 € TTC ÷ 1,2 = 30 000 € HT ; marge 30 % = 9 000 € ;
  // redevance et publicité 3 % = 900 € ; EBE + 8 100 € ; panier + 1,20 € TTC ; 3 000 ÷ 307 jours = 9,77 articles par jour
  expect(e).toMatchObject({ articles: 3_000, caTTC: 36_000 })
  proche(e.caHT, 30_000)
  proche(e.marge, 9_000)
  proche(e.ebe, 8_100)
  proche(e.panierEnPlus, 1.2)
  proche(e.articlesParJour, 3_000 / 307)
  expect(simulerVenteAdditionnelle(b, p, { univers: 'bar', unSur: 10, prixTTC: 12 })).toBeNull()
})

test('reste à faire du mois : par jour d’ouverture restant, face au rythme actuel', () => {
  // Novembre 2026 : le 1er est un dimanche ; 25 jours du lundi au samedi
  expect(joursOuverts(2026, 11, 1, 30)).toBe(25)
  const b = { mois: Array.from({ length: 12 }, (_, i) => ({ ca: i === 10 ? 52_000 : 40_000 })) } as unknown as Budget
  // Le samedi 14 : 11 jours ouverts passés (2 au 7, 9 au 13), 14 restants (14, 16 au 21, 23 au 28, 30)
  const r = resteAFaire(b, 2026, 11, 14, 22_000)
  expect(r).toMatchObject({ budget: 52_000, reste: 30_000, joursPasses: 11, joursRestants: 14, atteint: false })
  proche(r.parJour, 30_000 / 14)
  proche(r.rythme, 2_000)
  proche(r.ecartParJour, 30_000 / 14 - 2_000)
  expect(resteAFaire(b, 2026, 11, 14, 55_000)).toMatchObject({ reste: 0, atteint: true })
})

test('soirée : gain et nombre de participants pour ne pas perdre d’argent', () => {
  // 40 participants à 25 € TTC (20,83 € HT) : 833,33 € HT ; marge 60 % = 500 € ; 3 % = 25 € ; coûts 200 + 150 = 350 €
  const e = simulerSoiree({ prixTTC: 25, participants: 40, tva: 0.2, tauxMarge: 0.6, couts: 200, extras: 150 }, p)
  proche(e.caHT, 1_000 / 1.2)
  proche(e.marge, 500)
  proche(e.gain, 125)
  // Par participant : 20,833 × (60 % − 3 %) = 11,875 € ; 350 ÷ 11,875 = 29,5 → 30 participants
  proche(e.gainParParticipant, 11.875)
  expect(e.seuil).toBe(30)
  // Au budget : CA arrondi, coûts hors extras, achats payés le mois d'avant
  expect(tempsFortDeSoiree('Soirée bières de Noël', 12, 'bar', e, 200)).toEqual({ nom: 'Soirée bières de Noël', type: 'soiree', mois: 12, univers: 'bar', caAnPasse: 0, ca: 833, autresCharges: 200, moisAchats: 11 })
})

test('achat en volume : remise, argent immobilisé, invendu et durée maximale', () => {
  // 10 000 € HT à 10 % de remise, vendus en 4 mois, 5 % d'invendu, argent à 6 % par an
  const e = simulerAchat({ montant: 10_000, remise: 0.1, mois: 4, invendu: 0.05, tauxAnnuel: 0.06, tvaAchats: 0.2 })
  // Payé 9 000 € ; remise 1 000 € ; 9 000 × 6 % ÷ 12 ÷ 2 = 22,50 € par mois × 4 = 90 € ; invendu 450 € ; gain 460 €
  expect(e).toMatchObject({ paye: 9_000, remise: 1_000, perteInvendu: 450 })
  proche(e.coutArgent, 90)
  proche(e.gain, 460)
  // La remise vaut le coup tant que (1 000 − 450) ÷ 22,50 = 24,4 mois ; 10 800 € TTC sortis à la commande
  proche(e.moisMaximum, 550 / 22.5)
  proche(e.payeTTC, 10_800)
  // Sans coût de l'argent réglé : pas de durée maximale
  expect(simulerAchat({ montant: 10_000, remise: 0.1, mois: 4, invendu: 0, tauxAnnuel: 0, tvaAchats: 0.2 }).moisMaximum).toBeNull()
})

test('investissement : EBE en plus, délai de retour, année de la mise en service', () => {
  // 12 000 € amortis sur 5 ans, en service en avril ; 30 000 € de CA en plus, marge 50 %, démarque 2 %, 2 000 € de charges
  const x = { cout: 12_000, duree: 5, mois: 4, ca: 30_000, tauxMarge: 0.5, demarque: 0.02, charges: 2_000 }
  const e = simulerInvestissement(x, p)
  // 30 000 × 48 % − 900 − 2 000 = 11 500 € ; amortissement 2 400 € ; retour 12 000 ÷ 11 500 = 1,04 an
  proche(e.ebeAn, 11_500)
  proche(e.amortissement, 2_400)
  proche(e.resultatAn, 9_100)
  proche(e.retourAnnees, 12_000 / 11_500)
  // Avril à décembre (9 mois) : 8 625 € d'EBE, 12 000 € payés : − 3 375 €
  expect(e.annee1.mois).toBe(9)
  proche(e.annee1.ebe, 8_625)
  proche(e.annee1.tresorerie, -3_375)
  // Prêt à 0 % sur 4 ans : 250 € par mois, 8 échéances de mai à décembre ; la trésorerie reste à + 6 625 €
  const avecPret = simulerInvestissement({ ...x, pret: { taux: 0, duree: 4 } }, p)
  proche(avecPret.annee1.tresorerie, 6_625)
  proche(avecPret.interets, 0)
  // Corner : 6 mètres à 5 000 € par mètre et par an
  expect(caCorner(6, parametresSimulateurs({ simulateurs: { corner: { caParMetre: 5_000, tauxMarge: 0.3, demarque: 0.03 } } }))).toBe(30_000)
  expect(parametresSimulateurs(null)).toEqual({ tauxDecouvert: 0, aideApprenti: 0, corner: { caParMetre: 0, tauxMarge: 0, demarque: 0 } })
})

test('embauche : coût chargé de l’année, EBE, CA nécessaire, aide à l’apprentissage', () => {
  const poste = { poste: 'Vendeur', categorie: 'employe' as const, heuresHebdo: 35, brutMensuel: 2_000, primes: [] }
  const e = simulerEmbauche(s, { type: 'embauche', poste, mois: 7 })
  // Sans équipe saisie : le coût du poste de juillet à décembre s'ajoute aux salaires ; même calcul que l'Équipe
  const cout = coutPersonne({ ...poste, entree: '2027-07', sortie: null }, p.charges, 2027).coutAnnuel
  proche(e.coutAnnee, cout)
  proche(e.ecart.personnel, cout)
  proche(e.ecart.ebe, -cout)
  proche(e.coutPlein, cout * 2)
  const mcv = economieFranchise(calculerBudget(magasinFictif, p), magasinFictif, p).tauxMCV
  proche(e.caNecessaire, cout * 2 / mcv)
  // La trésorerie de décembre baisse d'au moins le coût hors cotisations décalées
  expect(e.ecart.fin).toBeLessThan(0)
  // Apprenti, aide de 6 000 € par an : 3 000 € sur juillet à décembre, en moins sur la baisse d'EBE
  const a = simulerEmbauche(s, { type: 'embauche', poste: { ...poste, categorie: 'apprenti' }, mois: 7 }, 6_000)
  proche(a.aide, 3_000)
  proche(a.ecart.ebe, -(a.coutAnnee - 3_000))
})

test('départ et changement d’heures dans une équipe saisie', () => {
  const equipe: Personne[] = [
    { poste: 'Gérant', categorie: 'gerant_tns', heuresHebdo: 0, brutMensuel: 3_000, primes: [], entree: null, sortie: null },
    { poste: 'Vendeur', categorie: 'employe', heuresHebdo: 35, brutMensuel: 2_000, primes: [], entree: null, sortie: null },
  ]
  const h = { ...magasinFictif, equipe }
  const plein = coutPersonne(equipe[1], p.charges, 2027).coutAnnuel
  // Départ au 1er juillet : 6 mois de moins, même taux de charges (la réduction se proratise) : la moitié du coût
  const d = simulerEmbauche({ ...s, h }, { type: 'depart', index: 1, mois: 7 })
  proche(d.ecart.personnel, -plein / 2, 2)
  expect(d.ecart.ebe).toBeGreaterThan(0)
  // Passage à 28 heures au 1er juillet : salaire à 28/35, 6 mois sur 12
  const r = simulerEmbauche({ ...s, h }, { type: 'heures', index: 1, mois: 7, heuresHebdo: 28 })
  const apres = coutPersonne({ ...equipe[1], heuresHebdo: 28, brutMensuel: 1_600, entree: '2027-07' }, p.charges, 2027).coutAnnuel
  proche(r.ecart.personnel, apres - plein / 2, 2)
})

test('coup dur de trésorerie : baisse du CA, dépense imprévue, retard d’encaissement', () => {
  const avant = etatBudget(magasinFictif, p, 20_000)
  const b = calculerBudget(magasinFictif, p)
  // − 10 % de CA en mars : le CA de l'année perd 10 % du CA de mars
  const baisse = simulerCoupDur(s, [{ type: 'baisse', taux: 0.1, de: 3, a: 3 }])
  proche(baisse.ecart.ca, -0.1 * b.mois[2].ca, 4)
  expect(baisse.avant.soldes).toEqual(avant.soldes)
  proche(baisse.apres.soldes[0], avant.soldes[0], 4)            // janvier ne bouge pas
  expect(baisse.apres.soldes[1]).toBeGreaterThan(avant.soldes[1]) // février : moins de marchandise livrée pour mars
  expect(baisse.apres.soldes[2]).toBeLessThan(avant.soldes[2])
  // Dépense imprévue de 5 000 € HT en mai : 6 000 € TTC sortent en mai ; amortie sur 5 ans (8 mois : 666,67 €)
  const depense = simulerCoupDur(s, [{ type: 'depense', montant: 5_000, mois: 5 }])
  proche(depense.apres.soldes[1], avant.soldes[1], 4)          // avant la dépense, seul l’acompte d’impôt de mars bouge
  expect(depense.apres.soldes[4]).toBeLessThan(avant.soldes[4] - 5_000)
  proche(depense.ecart.ebe, 0, 4)
  // Retard de 2 mois sur 8 000 € attendus en mars : mars et avril à − 8 000 €, rien de changé ensuite
  const retard = simulerCoupDur(s, [{ type: 'retard', montant: 8_000, mois: 3, retard: 2 }])
  expect(retard.apres.soldes.map((x, i) => Math.round(x - avant.soldes[i]))).toEqual([0, 0, -8_000, -8_000, 0, 0, 0, 0, 0, 0, 0, 0])
})
