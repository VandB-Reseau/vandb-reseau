import { expect, test } from '@playwright/test'
import { paliersRanges, simulerRemisesB2B, unitaireB2B } from '../../../src/pilotage/moteur/boiteOutils'
import { parametresParDefaut } from '../../../src/pilotage/moteur/parametres'

// 228 · Remises entreprise par paliers (fichier de Joseph, 16/11/2026). Chiffres fictifs, vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 4) => expect(v).toBeCloseTo(attendu, chiffres)
const p = parametresParDefaut // redevance 2 %, publicité 1 %
const paliers = [{ min: 0, remise: 0 }, { min: 50, remise: 0.05 }, { min: 100, remise: 0.1 }]
// Un produit à 12 € TTC (10 € HT), acheté 6 € HT
const ligne = (quantite: number, achatHT = 6) => ({ libelle: 'Vin', quantite, prixTTC: 12, achatHT })

test('228 · le palier se lit sur le total des unités, sa remise vaut pour toute la commande', () => {
  const r = simulerRemisesB2B({ paliers, lignes: [ligne(70), ligne(50)], tva: 0.2, plancher: 0.25 }, p)
  expect(r.unites).toBe(120)
  expect(r.palier).toBe(2)
  proche(r.remise, 0.1)
  proche(r.caBrut, 1200)       // 120 × 10
  proche(r.caNet, 1080)        // − 10 %
  proche(r.cout, 720)          // 120 × 6
  proche(r.marge, 360)
  proche(r.taux, 1 / 3)        // 360 ÷ 1 080
  proche(r.margeCedee, 120)
  proche(r.margeSansRemise, 480)
  proche(r.redevance, 32.4)    // 3 % de 1 080
  proche(r.reste, 327.6)
  expect(r.suivant).toBeNull()
  expect(r.alertes).toBe(0)
  // Remise maximale au plancher de 25 % : 1 − 6 ÷ (10 × 0,75) = 20 %
  proche(r.lignes[0].remiseMax, 0.2)
  expect(r.lignes[0].alerte).toBe('ok')
})

test('228 · marge par palier au mélange de la commande, et creux au passage d’un seuil', () => {
  const r = simulerRemisesB2B({ paliers, lignes: [ligne(120)], tva: 0.2, plancher: 0.25 }, p)
  proche(r.paliers[0].margeUnite, 4); proche(r.paliers[0].taux, 0.4)
  proche(r.paliers[1].margeUnite, 3.5); proche(r.paliers[1].taux, 3.5 / 9.5)
  proche(r.paliers[2].margeUnite, 3); proche(r.paliers[2].taux, 1 / 3)
  expect(r.paliers[0].max).toBe(49)
  expect(r.paliers[2].max).toBeNull()
  // 49 unités à 4 € = 196 € ; à 3,50 € il en faut 56 pour faire autant
  expect(r.paliers[1].margeRetrouveeA).toBe(56)
  // 99 × 3,50 = 346,50 € ; à 3 € il en faut 115,5, donc 116
  expect(r.paliers[2].margeRetrouveeA).toBe(116)
  expect(r.paliers[0].margeRetrouveeA).toBeNull()
})

test('228 · palier suivant, plancher et vente à perte', () => {
  const petit = simulerRemisesB2B({ paliers, lignes: [ligne(30)], tva: 0.2, plancher: 0.25 }, p)
  expect(petit.palier).toBe(0)
  expect(petit.suivant).toEqual({ index: 1, manque: 20, remise: 0.05 })
  // Achat 8 € au palier à 10 % : vendu 9 € HT, marge 1 € soit 11 % : sous le plancher ; aucune remise possible au plancher
  const serre = simulerRemisesB2B({ paliers, lignes: [ligne(100, 8)], tva: 0.2, plancher: 0.25 }, p)
  expect(serre.lignes[0].alerte).toBe('plancher')
  proche(serre.lignes[0].taux, 1 / 9)
  proche(serre.lignes[0].remiseMax, 0)
  expect(serre.alertes).toBe(1)
  // Achat 9,50 € : 0,50 € perdus par unité
  const perte = simulerRemisesB2B({ paliers, lignes: [ligne(100, 9.5), ligne(0)], tva: 0.2, plancher: 0.25 }, p)
  expect(perte.lignes[0].alerte).toBe('perte')
  proche(perte.marge, -50)
  expect(perte.alertes).toBe(1) // la ligne vide ne compte pas
  // Commande vide : pas de taux, pas d'alerte
  const vide = simulerRemisesB2B({ paliers, lignes: [ligne(0)], tva: 0.2, plancher: 0.25 }, p)
  expect(vide.taux).toBeNull()
  expect(vide.paliers[1].margeUnite).toBeNull()
})

test('228 · paliers rangés par quantité, le premier part de zéro', () => {
  expect(paliersRanges([{ min: 100, remise: 0.1 }, { min: 10, remise: 0 }, { min: 50, remise: 0.05 }]))
    .toEqual([{ min: 0, remise: 0 }, { min: 50, remise: 0.05 }, { min: 100, remise: 0.1 }])
  expect(paliersRanges([])).toEqual([{ min: 0, remise: 0 }])
})

test('% de marge par famille : achat = prix HT × (1 − taux), avant remise', () => {
  // 12 € TTC = 10 € HT ; 40 % de marge → 4 € de marge HT par unité, achat 6 €
  const u = unitaireB2B({ libelle: 'Vin', quantite: 1, prixTTC: 12, achatHT: 0, taux: 0.4 }, 0.2)
  proche(u.prixHT, 10); proche(u.achatHT, 6); proche(u.marge, 4); proche(u.taux, 0.4)
  // Même commande qu'avec un achat de 6 € : 100 unités, palier à 10 %, CA net 900 €, marge 900 − 600 = 300 €
  const parTaux = simulerRemisesB2B({ paliers, lignes: [{ libelle: 'Vin', quantite: 100, prixTTC: 12, achatHT: 0, taux: 0.4 }], tva: 0.2, plancher: 0.25 }, p)
  const parAchat = simulerRemisesB2B({ paliers, lignes: [ligne(100)], tva: 0.2, plancher: 0.25 }, p)
  proche(parTaux.marge, 300); proche(parTaux.marge, parAchat.marge); proche(parTaux.cout, 600)
  // Produit par produit (sans taux) : l'achat saisi fait foi, marge unitaire 10 − 7,50 = 2,50 € soit 25 %
  const v = unitaireB2B({ libelle: 'Gin', quantite: 1, prixTTC: 12, achatHT: 7.5 }, 0.2)
  proche(v.marge, 2.5); proche(v.taux, 0.25)
})
