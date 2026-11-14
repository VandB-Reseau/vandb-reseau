import { expect, test } from '@playwright/test'
import { auditPression, coutContrats, ligneBec, palierExterieur, prixLivraisonGrille, simulerExterieur, simulerParc, type Bec, type ContratExterieur } from '../../../src/pilotage/moteur/boiteOutils'
import { parametresParDefaut } from '../../../src/pilotage/moteur/parametres'
import { analyserRemises, appliquerLevier, margeMix, parametresSimulateurs, simulerPrimes, simulerSoiree, tempsFortDeSoiree } from '../../../src/pilotage/moteur/simulateurs'
import type { Budget } from '../../../src/pilotage/moteur/types'

// Simulateurs, vague 10 (choix 152 à 165, Joseph 14/11/2026). Chiffres fictifs, chaque résultat se vérifie à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 4) => expect(v).toBeCloseTo(attendu, chiffres)
const p = parametresParDefaut // redevance 2 %, publicité 1 %

test('152-153 · soirée : achats des participants, bon d’achat, heures de l’équipe en place', () => {
  const base = { prixTTC: 25, participants: 40, tva: 0.2, tauxMarge: 0.6, couts: 200, extras: 150 }
  const achats = { part: 0.25, panierTTC: 36, tva: 0.2, tauxMarge: 0.3, bon: false }
  const equipe = { personnes: 2, heures: 3, coutHoraire: 20, majoration: 0.25 }
  // Un participant : entrée 20,833 € HT ; un sur quatre achète 30 € HT à 30 % : CA 20,833 + 7,5 = 28,333 € ;
  // marge 12,5 + 2,25 = 14,75 € ; moins 3 % de 28,333 = 13,90 € ; équipe en place 2 × 3 h × 20 € × 1,25 = 150 €
  const e = simulerSoiree({ ...base, achats, equipe }, p)
  proche(e.caHT, 28.3333333 * 40)
  proche(e.caAchats, 300)
  expect(e.acheteurs).toBe(10)
  proche(e.equipeEnPlace, 150)
  proche(e.couts, 500)
  proche(e.gainParParticipant, 13.9)
  proche(e.gain, 590 - 34 - 500) // marge 590, redevance et publicité 34
  expect(e.seuil).toBe(36)        // 500 ÷ 13,90 = 35,97
  // Bon d'achat du prix d'entrée : 20,833 € HT de remise par acheteur
  const b = simulerSoiree({ ...base, achats: { ...achats, bon: true }, equipe }, p)
  proche(b.gainParParticipant, 12.5 + 0.25 * (9 - 25 / 1.2) - 0.03 * (25 / 1.2 + 0.25 * (30 - 25 / 1.2)))
  expect(b.seuil).toBe(57)        // 500 ÷ 8,848 = 56,5
  // Au budget : l'entrée au bar, les achats dans un temps fort en cave
  expect(tempsFortDeSoiree('Soirée', 12, 'bar', e, 200)).toEqual([
    { nom: 'Soirée', type: 'soiree', mois: 12, univers: 'bar', caAnPasse: 0, ca: 833, autresCharges: 200, moisAchats: 11 },
    { nom: 'Soirée (achats)', type: 'soiree', mois: 12, univers: 'cave', caAnPasse: 0, ca: 300, autresCharges: 0, moisAchats: 11 },
  ])
  // Sans achats : comme avant (vague 6)
  expect(simulerSoiree(base, p).seuil).toBe(30)
})

const contrat: ContratExterieur = {
  futs: 40, prixVente: 69, remise: 0, prixAchat: 41.34, co2: 0.76, gobelets: 0,
  tireuse: 'neuve', prixTireuse: 1_500, dureeTireuse: 5, entretien: 0,
  livraisons: 10, km: 30, prixKm: 0.6, heures: 1.5, coutHoraire: 20,
  don: { type: 'aucun', montant: 0, futs: 0, cerfa: false },
}
test('154 · contrat extérieur : sponsoring, matériel, astreinte, livraisons et locations facturées', () => {
  const r = simulerExterieur({ ...contrat, sponsoring: { montant: 300, parFut: 2 }, materiel: 100, astreinte: 10, prixLivraison: 25, locations: { nombre: 3, prix: 150 } }, p, true)
  // Net par fût 24,83 € − 2 € de rétrocession = 22,83 €
  proche(r.netParFut, 22.83)
  // Coûts fixes : tireuse 300 + livraisons 480 + sponsoring 300 (charge pleine) + matériel 100 + astreinte 10 h × 20 € = 1 380 €
  proche(r.coutFixe, 1_380)
  expect(r.don.reduction).toBe(0)
  // Recettes : 10 livraisons × 25 € + 3 locations × 150 € = 700 €, 679 € après 3 %
  proche(r.recettes, 700)
  proche(r.recettesNettes, 679)
  proche(r.ca, 40 * 69 + 700)
  // Gain : 40 × 22,83 + 679 − 1 380 = 212,20 € ; équilibre : (1 380 − 679) ÷ 22,83 = 30,7 → 31 fûts
  proche(r.gain, 212.2)
  expect(r.equilibre).toBe(31)
  // Sans les ajouts : les chiffres de la vague 9
  proche(simulerExterieur(contrat, p, false).coutFixe, 780)
})

test('162 · livraison au prix de la grille ; 156 · palier du marché extérieur', () => {
  const grille = [{ kmMax: 15, franco: 900, prix: 50 }, { kmMax: 5, franco: 500, prix: 30 }]
  expect(prixLivraisonGrille(grille, 3, 100)).toBe(30)
  expect(prixLivraisonGrille(grille, 10, 600)).toBe(50)
  expect(prixLivraisonGrille(grille, 10, 900)).toBe(0)
  expect(prixLivraisonGrille(grille, 20, 100)).toBeNull()
  const paliers = [{ caMax: 200_000, nom: 'B' }, { caMax: 100_000, nom: 'A' }, { caMax: 300_000, nom: 'C' }]
  expect(palierExterieur(paliers, 80_000)?.nom).toBe('A')
  expect(palierExterieur(paliers, 150_000)?.nom).toBe('B')
  expect(palierExterieur(paliers, 500_000)?.nom).toBe('C')
  expect(palierExterieur([], 50_000)).toBeNull()
})

test('155 · parc de tireuses en week-ends : fûts et week-ends pour payer une tireuse, parc plein', () => {
  const parc = { tireuses: 2, semainesSaison: 17, sortiesSaison: 0, sortiesHorsSaison: 0, refus: 0, futsParSortie: 2, netParFut: 25.59, prixNeuve: 800, dureeVie: 5, entretien: 60, vieilles: [], occupation: { saison: 0.9, hors: 0.2 }, saturation: 0.85 }
  const r = simulerParc(parc)
  // 17 × 90 % + 35 × 20 % = 15,3 + 7 = 22,3 week-ends par tireuse
  proche(r.weekendsParTireuse, 22.3)
  // 800 ÷ 5 + 60 = 220 € par an ; 220 ÷ 25,59 = 8,6 → 9 fûts ; 9 ÷ 2 = 4,5 → 5 week-ends
  expect(r.futsPourPayer).toBe(9)
  expect(r.weekendsPourPayer).toBe(5)
  expect(r.sature).toBe(true)
  proche(r.gainParTireuse, 22.3 * 2 * 25.59 - 220)
  // Tireuse à 1 500 € : 360 € par an, 15 fûts, 8 week-ends
  const g = simulerParc({ ...parc, prixNeuve: 1_500 })
  expect([g.futsPourPayer, g.weekendsPourPayer]).toEqual([15, 8])
  // 6 week-ends refusés × 2 fûts × 25,59 € = 307,08 € > 220 € : racheter
  expect(simulerParc({ ...parc, refus: 6 }).racheter).toBe(true)
  // Sans occupation saisie : lue sur les sorties, comme en vague 9
  proche(simulerParc({ ...parc, occupation: null, sortiesSaison: 17, sortiesHorsSaison: 14 }).occupationSaison, 0.5)
})

const blonde: Bec = { biere: 'Blonde', prixFut: 90, litres: 30, perte: 0.1, prixDemi: 4.2, prixPinte: 7.8, demis: 100, pintes: 40 }
test('161 · le verre de 33 cl et la perte réelle d’une semaine', () => {
  // 27 litres servis, 3,333 € le litre : 20 verres de 33 cl à 5,50 € TTC = 91,67 € HT pour 22 € de bière
  const a = ligneBec(blonde, 0.2, 0, 0), b = ligneBec({ ...blonde, prix33: 5.5, verres33: 20 }, 0.2, 0, 0)
  proche(b.caSemaine - a.caSemaine, 110 / 1.2)
  proche(b.margeSemaine - a.margeSemaine, 110 / 1.2 - 22)
  proche(b.litresSemaine - a.litresSemaine, 6.6)
  // 6 fûts de 30 l = 180 l ; vendus 400 demis (100 l) + 120 pintes (60 l) ; 4 l offerts : 16 l perdus, 8,9 %
  const r = auditPression({ futs: 6, litres: 30, prixFut: 90, demis: 400, verres33: 0, pintes: 120, litresVendus1L: 0, offerts: 4, caTTC: 2_600, tva: 0.2 })
  expect([r.sortis, r.vendus, r.perte]).toEqual([180, 160, 16])
  proche(r.taux, 16 / 180)
  proche(r.coutSemaine, 48)       // 16 l × 3 €
  proche(r.coutAn, 2_496)
  proche(r.caManqueSemaine, 16 * (2_600 / 1.2 / 160))
})

test('159 · CDD avec ses frais fixes, intérim à 1,75', () => {
  // 20 000 € × 1,1 + 260 € de contrat + 6 bulletins × 20 € = 22 380 € ; intérim 1 800 € × 1,75 × 6 = 18 900 €
  expect(coutContrats(20_000, 1_800, 6, 1.75, { redaction: 260, paieParMois: 20 })).toEqual({ cdi: 20_000, cdd: 22_380, fraisCDD: 380, interim: 18_900 })
  const d = parametresSimulateurs(null)
  expect(d).toMatchObject({ coefInterim: 1.75, contrat: { redaction: 260, paieParMois: 20 }, tireuses: { semainesSaison: 17, occupationSaison: 0.9, occupationHors: 0.2, saturation: 0.85 } })
  expect(d.familles).toEqual([])
  expect(parametresSimulateurs({ simulateurs: { contrat: { redaction: 0, paieParMois: 15 }, tireuses: { semainesSaison: 18, occupationSaison: 0.8, occupationHors: 0.25, saturation: 0.9 } } })).toMatchObject({ contrat: { redaction: 0, paieParMois: 15 }, tireuses: { semainesSaison: 18, occupationSaison: 0.8 } })
})

test('164 · primes par paliers : coût chargé face à la marge gagnée', () => {
  const r = simulerPrimes({
    caBase: 500_000, tauxMarge: 0.4, salaries: 3, tauxCharges: 0.4, partReversee: 0.02,
    paliers: [{ progression: 0.1, prime: 200, primeGerant: 300 }, { progression: 0.02, prime: 3_000, primeGerant: 0 }, { progression: 0.05, prime: 150, primeGerant: 0 }],
  }, p)
  // + 2 % : 10 000 € × 37 % = 3 700 € ; (3 × 3 000 + 200) × 1,4 = 12 880 € : perd 9 180 €
  // + 5 % : 25 000 € → 9 250 € ; (450 + 500) × 1,4 = 1 330 € : gagne 7 920 €
  // + 10 % : 50 000 € → 18 500 € ; (600 + 300 + 1 000) × 1,4 = 2 660 € : gagne 15 840 €
  expect(r.paliers.map((l) => l.progression)).toEqual([0.02, 0.05, 0.1])
  r.paliers.forEach((l, i) => proche(l.gain, [-9_180, 7_920, 15_840][i]))
  expect(r.paliers.map((l) => l.rentable)).toEqual([false, true, true])
  expect(r.dernierRentable).toBe(2)
})

test('163 · remises et offerts face aux repères ; 160 · marge de plusieurs produits', () => {
  const reperes = { offerts: 0.01, persos: 0.005, prixSpeciaux: 0, remises: 0.01, fidelite: 0.02 }
  const r = analyserRemises(100_000, 6, { offerts: 2_000, persos: 300, remises: 1_500, fidelite: 1_800 }, reperes)
  expect(r.lignes.map((l) => l.ecart)).toEqual([1_000, -200, null, 500, -200])
  proche(r.total, 5_600)
  proche(r.part, 0.056)
  proche(r.ecart, 1_500)
  proche(r.ecartAn, 3_000) // 6 mois → × 2
  // 2 bouteilles à 15 € TTC (coût 6 €) et un coffret à 8 € TTC (coût 3 € + 0,50 € de consigne)
  const m = margeMix([{ libelle: 'Vin', cout: 6, consigne: 0, prixTTC: 15, quantite: 2 }, { libelle: 'Coffret', cout: 3, consigne: 0.5, prixTTC: 8, quantite: 1 }], 0.2)
  proche(m.ca, 25 + 8 / 1.2)
  proche(m.cout, 15.5)
  proche(m.taux, (25 + 8 / 1.2 - 15.5) / (25 + 8 / 1.2))
  proche(m.prixTTC, 38)
})

test('158 · un levier sur le budget d’un magasin', () => {
  const b = { ca: 700_000, ebe: 50_000, flux: { cave: { objectif: 30_000 } }, familles: [{ univers: 'cave', objectif: 600_000, margeObjectif: 180_000 }] } as unknown as Budget
  // Un article à 12 € TTC pour 1 client sur 10 : 30 000 € HT, marge 9 000 €, EBE 8 100 €
  const v = appliquerLevier(b, p, { type: 'vente', univers: 'cave', unSur: 10, prixTTC: 12 })!
  proche(v.ca, 30_000); proche(v.ebe, 8_100); proche(v.redevance, 900); proche(v.articlesParJour, 3_000 / 307)
  // + 1,20 € TTC de panier sur 30 000 tickets : 30 000 € HT au même taux de marge
  proche(appliquerLevier(b, p, { type: 'panier', univers: 'cave', euros: 1.2 })!.ebe, 8_100)
  // + 5 % de tickets : 30 000 € HT à 30 % ; + 5 % de prix : 30 000 € HT tout en marge, EBE 29 100 €
  proche(appliquerLevier(b, p, { type: 'tickets', univers: 'cave', taux: 0.05 })!.marge, 9_000)
  proche(appliquerLevier(b, p, { type: 'prix', univers: 'cave', taux: 0.05 })!.ebe, 29_100)
  expect(appliquerLevier(b, p, { type: 'tickets', univers: 'bar', taux: 0.05 })).toBeNull()
  expect(v).toMatchObject({ caAvant: 700_000, ebeAvant: 50_000 })
})
