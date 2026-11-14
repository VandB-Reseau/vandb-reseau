import { expect, test, type Page } from '@playwright/test'
import { COMPTE, simulerSupabase, textesTropPetits, type Ecriture, type OptionsSimulation } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type OptionsSimulation as OptionsPilotage } from './supabase-simule'

// Simulateurs, vague 10 (choix 152 à 165, Joseph 14/11/2026). Données fictives uniquement : les repères ci-dessous ne
// sont pas ceux du réseau.
const NOM = 'Annecy Test'
const budget = (magasin: string): MagasinSimule => ({ magasin, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' })
const magasins: MagasinSimule[] = [budget(NOM), budget('Bordeaux Test')]
const franchise: OptionsSimulation = { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: [NOM] } }
const coach: OptionsSimulation = { appMetadata: { role: 'coach', coach: 'Hugo FICTIF' } }
const reperes = {
  tauxRedevance: 0.02, tauxPublicite: 0.01,
  simulateurs: {
    coutHoraire: 20, exterieur: { prixKm: 0.6, dureeTireuse: 5, entretienTireuse: 60, co2ParFut: 0.76 },
    familles: [{ libelle: 'Vins', univers: 'cave', marge: 0.4, tva: 'normale' }],
    livraison: [{ kmMax: 20, franco: 3_000, prix: 40 }],
    marcheExterieur: { paliers: [{ caMax: 100_000, tireuses: 10, investissement: 20_000, heures: 10 }, { caMax: 250_000, tireuses: 25, investissement: 40_000, heures: 20 }], camion: 25_000 },
    remises: { offerts: 0.01, persos: 0.005, prixSpeciaux: 0, remises: 0.01, fidelite: 0.02 },
  },
}

async function connecter(page: Page, reseau: OptionsSimulation, pilotage: OptionsPilotage) {
  await simulerSupabase(page, reseau)
  const ecritures = await simulerPilotage(page, { magasins, parametres: reperes, ...pilotage })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  return ecritures
}
const simulateur = (page: Page, sim: string) => page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=chiffres&partie=simulateurs&sim=${sim}`)
const statut = (page: Page) => page.locator('#carte-simulation').getByRole('status')

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('157 : « Simulateurs » au menu de l’équipe, le dernier magasin retenu', async ({ page, isMobile }, info) => {
  await connecter(page, coach, { role: 'coach' })
  if (!isMobile) await page.getByRole('navigation').getByRole('button', { name: 'Simulateurs' }).first().click()
  else await page.goto('./#/simulateurs')
  await expect(page).toHaveURL(/#\/simulateurs/)
  await expect(page.getByRole('heading', { level: 1, name: 'Simulateurs' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Simuler pour' }).getByRole('button', { name: 'Un magasin' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Magasin', { exact: true }).click()
  await page.getByRole('option', { name: NOM }).click()
  await expect(page.locator('#carte-simulation')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Choisir un simulateur' }).getByRole('button')).toHaveCount(13)
  await expect(page.getByRole('heading', { name: 'Embaucher' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-simulateurs-equipe.png`, fullPage: true })
  // Le magasin choisi est retenu sur l'appareil
  await page.reload()
  await expect(page.getByLabel('Magasin', { exact: true })).toHaveValue(NOM)
})

test('158 : un levier sur une région, magasins sans budget à part ; PDF', async ({ page, isMobile }, info) => {
  await connecter(page, {}, {})
  await page.goto('./#/simulateurs?mode=plusieurs')
  await page.getByLabel('Magasins', { exact: true }).click()
  await page.getByRole('option', { name: 'Région Alex NORD' }).click()
  // Vente additionnelle en cave, un article à 8 € pour 1 client sur 10 : Annecy et Bordeaux ont un budget, pas les autres
  const tableau = page.getByRole('table', { name: 'Effet par magasin' })
  await expect(tableau.getByRole('row')).toHaveCount(4)
  await expect(tableau).toContainText('Total, 2 magasins')
  await expect(page.getByText(/^Sans budget 2027 proposé, pas comptés : /)).toBeVisible()
  await expect(page.getByRole('status')).toContainText(/^Si les magasins de la région Alex NORD vendent un article à 8\s€ TTC à 1 client sur 10 en cave : [\d\s]+\s€ de CA HT et [\d\s]+\s€ d’EBE en plus sur 2 magasins en 2027, soit [\d,]+ articles? par jour et par magasin\.$/)
  // Même budget pour les deux magasins : le total est le double d'une ligne
  const ebe = async (i: number) => Number((await tableau.getByRole('row').nth(i).getByRole('cell').nth(3).innerText()).replace(/\D/g, ''))
  expect(await ebe(3)).toBeCloseTo(2 * await ebe(1), -1)
  // Autre levier : les prix + 2 % au bar
  await page.getByRole('group', { name: 'Levier' }).getByRole('button', { name: 'Prix' }).click()
  await page.getByRole('group', { name: 'Univers' }).getByRole('button', { name: 'Bar' }).click()
  await expect(page.getByRole('status')).toContainText(/relèvent leurs prix au bar de 2\s%/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-simulateurs-plusieurs.png`, fullPage: true })
  await page.evaluate(() => { (window as unknown as { imprime: number }).imprime = 0; window.print = () => { (window as unknown as { imprime: number }).imprime++ } })
  await page.getByRole('button', { name: 'PDF', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { imprime: number }).imprime)).toBe(1)
})

test('franchisé : pas de simulation à plusieurs magasins', async ({ page }) => {
  await connecter(page, franchise, { role: 'franchise' })
  await page.goto('./#/simulateurs?mode=plusieurs')
  await expect(page).toHaveURL(/magasins\/Annecy%20Test\?vue=simulateurs/)
  await expect(page.getByRole('button', { name: 'Plusieurs magasins' })).toHaveCount(0)
})

test('152-153 : soirée avec les achats des participants, les coûts détaillés et l’équipe en place', async ({ page, isMobile }, info) => {
  const ecritures = await connecter(page, franchise, { role: 'franchise' })
  await simulateur(page, 'soiree')
  await page.getByLabel('Part qui achète').fill('25')
  await page.getByLabel('Panier moyen TTC').fill('36')
  await page.getByLabel('Sécurité').fill('120')
  await page.getByLabel('Personnes', { exact: true }).fill('2')
  // 2 personnes × 3 h × 20 € (repère du siège) × 1,25 = 150 €
  await expect(page.getByText('Heures de l’équipe en place')).toBeVisible()
  await expect(page.locator('#carte-simulation')).toContainText(/150\s€chargées, majoration comprise/)
  // 30 participants, un sur quatre achète 36 € TTC : 7,5 acheteurs × 30 € HT = 225 €
  await expect(statut(page)).toContainText(/dont 225\s€ d’achats en cave/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-simulateur-soiree-achats.png`, fullPage: true })
  // Bon d'achat du prix d'entrée : déduit des achats
  await page.getByLabel('Entrée remboursée en bon d’achat').check()
  await expect(page.getByText(/bons de [\d\s]+\s€ déduits/)).toBeVisible()
  await page.getByLabel('Entrée remboursée en bon d’achat').uncheck()
  await page.getByRole('button', { name: 'Mettre dans mon budget 2027' }).click()
  await expect(page.getByText(/Ajouté au budget 2027/)).toBeVisible()
  const corps = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { ajustements: { tempsForts: { univers: string; nom: string; ca: number; autresCharges: number }[] } }
  // Entrée au bar avec les coûts (50 + 150 + 120 = 320 €), achats en cave
  expect(corps.ajustements.tempsForts).toMatchObject([{ univers: 'bar', nom: 'Soirée dégustation', autresCharges: 320 }, { univers: 'cave', nom: 'Soirée dégustation (achats)', ca: 225, autresCharges: 0 }])
})

test('155 : tireuses en week-ends loués, occupation modifiable', async ({ page, isMobile }) => {
  await connecter(page, franchise, { role: 'franchise' })
  await simulateur(page, 'tireuses')
  // Valeurs d'office : 17 week-ends de saison, 90 % puis 20 % des week-ends loués
  await expect(page.getByLabel('Week-ends loués en saison')).toHaveValue('90')
  // Prix du Contrat extérieur d'office : 70 € HT et 42 €, marge 28 € (40 %) ; net 70 − 2,10 − 42 − 0,76 = 25,14 €
  // Prix de vente saisi TTC (PVC) : 70 € HT × 1,2 = 84 € TTC
  await expect(page.getByLabel('Prix de vente du fût TTC')).toHaveValue('84')
  await expect(page.getByText(/Marge par fût : 28,00\s€ HT, soit 40\s% du prix de vente HT \(70,00\s€\).*Net par fût : 25,14\s€/)).toBeVisible()
  await page.getByLabel('Prix d’achat du fût HT').fill('41')
  await expect(page.getByText(/Marge par fût : 29,00\s€ HT, soit 41,4\s%/)).toBeVisible()
  await page.getByLabel('Prix d’une tireuse neuve HT').fill('800')
  // 800 ÷ 5 + 60 = 220 € par an, 26,14 € nets : 9 fûts, 5 week-ends de 2 fûts ; 17 × 90 % + 35 × 20 % = 22 week-ends par tireuse
  await expect(statut(page)).toHaveText('Une tireuse de plus se paie avec 9 fûts, soit 5 week-ends loués par an. Chaque tireuse est louée environ 22 week-ends par an. Parc plein en saison : note les week-ends refusés pour décider.')
  await page.getByLabel('Week-ends loués en saison').fill('70')
  // 17 × 70 % + 7 = 18,9 : 19 week-ends, plus saturé
  await expect(statut(page)).toContainText('louée environ 19 week-ends par an. Aucun week-end refusé : pas besoin de racheter.')
  await page.getByLabel('Week-ends refusés faute de tireuse').fill('5')
  await expect(statut(page)).toContainText('5 week-ends refusés : racheter une tireuse.')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('161 et 160 : perte réelle de la pression, 33 cl, marge par famille et plusieurs produits', async ({ page }) => {
  await connecter(page, coach, { role: 'coach' })
  await simulateur(page, 'pression')
  await expect(page.getByLabel('Prix du 33 cl TTC, bec 1')).toBeVisible()
  await page.getByRole('group', { name: 'Je regarde' }).getByRole('button', { name: 'La perte sur une semaine' }).click()
  // 6 fûts de 30 l, 400 demis et 120 pintes (160 l), 4 l offerts : 16 l perdus ; perte standard = celle de la carte (10 %, 18 l)
  await expect(page.getByLabel('CA pression de la semaine HT')).toHaveValue('2 170')
  await expect(page.getByLabel('Perte standard')).toHaveValue('10')
  await expect(statut(page)).toHaveText(/^16 litres perdus sur 180 sortis du stock, soit 8,9\s% : dans la perte standard de 10\s%, rien à redresser\.$/)
  // Standard 5 % : 9 l normaux, 7 l de trop ; 7 × 3 € × 52 = 1 092 € ; CA manqué 7 × 2 170 ÷ 160 × 52 = 4 937 €
  await page.getByLabel('Perte standard').fill('5')
  await expect(statut(page)).toHaveText(/^16 litres perdus sur 180 sortis, soit 8,9\s% pour 5\s% de perte standard : 7 litres de trop, 1\s092\s€ de bière payée pour rien et 4\s937\s€ de CA HT manqué sur un an\.$/)
  await expect(page.getByText('Écart à la perte standard')).toBeVisible()
  await page.getByRole('button', { name: /Reprendre la perte de la carte/ }).click()
  await expect(page.getByLabel('Perte standard')).toHaveValue('10')

  await page.getByRole('navigation', { name: 'Choisir un simulateur' }).getByRole('button', { name: /Prix et marge/ }).click()
  await page.getByLabel('Famille', { exact: true }).click()
  await page.getByRole('option', { name: /Vins/ }).click()
  // Vins : 40 %, TVA 20 % ; 5,50 € de coût → 9,17 € HT, 11,00 € TTC
  await expect(statut(page)).toContainText(/vendu 11,00\s€ TTC \(9,17\s€ HT\)/)
  await page.getByRole('group', { name: 'Je cherche' }).getByRole('button', { name: 'La marge de plusieurs produits' }).click()
  // 15 € + 8 € TTC pour 6 + 3 € : 19,17 € HT, 10,17 € de marge, 53 % face aux 40 % visés
  await expect(statut(page)).toHaveText(/^Planche mixte : 23,00\s€ TTC pour 9,00\s€ de coût HT, marge 10,17\s€ soit 53\s% \(40\s% visés pour Vins\)\.$/)
})

test('165, 163 et 164 : offre 5 + 1, remises face aux repères, primes par paliers', async ({ page, isMobile }, info) => {
  await connecter(page, franchise, { role: 'franchise' })
  await simulateur(page, 'prix')
  await page.getByLabel('Taux de marge du produit').fill('30')
  await page.getByLabel('Cartons vendus d’habitude').fill('10')
  await page.getByRole('button', { name: 'Offre 5 + 1' }).click()
  // 1 gratuit sur 6 = 16,7 % ; il reste 13,3 % : 30 ÷ 13,33 = 2,25 fois plus, 23 cartons au lieu de 10
  await expect(statut(page)).toContainText(/Avec 16,7\s% de remise, il faut vendre 125(,1)?\s% de plus pour garder la même marge, soit 23 cartons au lieu de 10\./)

  await page.getByRole('group', { name: 'Je regarde' }).getByRole('button', { name: 'Remises et offerts' }).click()
  await page.getByLabel('CA HT de la période').fill('100000')
  await page.getByLabel('Offerts et dégustations, HT').fill('2000')
  await page.getByLabel('Remises en caisse, HT').fill('1500')
  // Repères fictifs 1 % et 1 % : 1 000 + 500 = 1 500 € au-dessus, sur 12 mois
  await expect(statut(page)).toHaveText(/^3\s500\s€ de remises et d’offerts, soit 3,5\s% du CA : 1\s500\s€ au-dessus des repères, 1\s500\s€ d’EBE à récupérer sur un an\.$/)
  await expect(page.getByRole('table', { name: 'Remises et offerts' }).getByRole('row')).toHaveCount(6)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-simulateur-remises.png`, fullPage: true })

  await page.getByRole('navigation', { name: 'Choisir un simulateur' }).getByRole('button', { name: /Embaucher/ }).click()
  await page.getByRole('group', { name: 'Mouvement' }).getByRole('button', { name: 'Primes' }).click()
  await expect(page.getByRole('table', { name: 'Primes par palier' }).getByRole('row')).toHaveCount(4)
  await expect(statut(page)).toContainText(/les primes paient jusqu’à \+ 15\s% de CA/)
  await page.getByRole('button', { name: 'Ajouter un palier' }).click()
  await page.getByLabel('Prime par salarié, palier 4').fill('1000000')
  await expect(statut(page)).toContainText(/à \+ 20\s%, elles coûtent plus que la marge gagnée/)
})

test('154, 162 et 156 : livraison de la grille, sponsoring, modèle Marché extérieur', async ({ page }) => {
  await connecter(page, franchise, { role: 'franchise' })
  await simulateur(page, 'exterieur')
  // 30 km aller-retour = 15 km ; 40 fûts ÷ 10 livraisons × 70 € = 280 € par livraison, sous les 3 000 € de franco : 40 €
  await expect(page.getByText(/Livraison au prix de la grille du siège : 40\s€ pour 15 km et 280\s€ commandés par livraison\./)).toBeVisible()
  await expect(page.getByText('Livraisons et locations facturées', { exact: true })).toBeVisible()
  await page.getByLabel('Sponsoring (contrepartie publicitaire)').check()
  await page.getByLabel('Somme versée HT').fill('300')
  await expect(page.locator('#carte-simulation')).toContainText(/sponsoring 300\s€/)
  await page.getByLabel('Livraison facturée HT').fill('25')
  await expect(page.getByRole('button', { name: /Reprendre le prix de la grille/ })).toBeVisible()

  await page.getByRole('navigation', { name: 'Choisir un simulateur' }).getByRole('button', { name: /Investir/ }).click()
  await page.getByRole('group', { name: 'Projet' }).getByRole('button', { name: 'Marché extérieur' }).click()
  // Palier fictif jusqu'à 100 000 € : 10 tireuses, 20 000 €, 10 h par semaine × 52 × 20 € = 10 400 €
  await expect(page.getByText(/Préconisation du siège pour 100\s000\s€ de CA : 10 tireuses, 20\s000\s€ d’investissement, 10 h par semaine, soit 10\s400\s€ par an/)).toBeVisible()
  await page.getByLabel('Objectif de CA HT extérieur par an').fill('150000')
  await page.getByLabel(/Avec un camion/).check()
  await expect(page.getByText(/25 tireuses, 40\s000\s€ d’investissement et 25\s000\s€ de camion, 20 h par semaine/)).toBeVisible()
  await expect(statut(page)).toContainText(/^Marché extérieur de 65\s000\s€ :/)
})

test('Directeur : les repères de la vague 10 dans Paramètres', async ({ page }) => {
  const ecritures = await connecter(page, {}, { parametres: { tauxRedevance: 0.02, tauxPublicite: 0.01 } })
  await page.goto('./#/parametres/reglages?rubrique=budget')
  await page.getByRole('tab', { name: 'Simulateurs' }).click()
  // Valeurs d'office : intérim 1,75, saison de 17 week-ends
  await expect(page.getByLabel('Week-ends de la saison')).toHaveValue('17')
  await page.getByLabel('Bulletin de paie par mois').fill('25')
  await page.getByLabel('Week-ends loués en saison').fill('85')
  await page.getByLabel('Repère, Offerts et dégustations').fill('1,5')
  await page.getByRole('button', { name: 'Ajouter une famille' }).click()
  await page.getByLabel('Famille 1', { exact: true }).fill('Bières')
  await page.getByLabel('Marge visée, famille 1').fill('42')
  await page.getByRole('button', { name: 'Ajouter une distance' }).click()
  await page.getByLabel('Distance maximale, ligne 1').fill('15')
  await page.getByLabel('Prix de la livraison, ligne 1').fill('50')
  await page.getByRole('button', { name: 'Ajouter un palier extérieur' }).click()
  await page.getByLabel('CA maximal, palier 1').fill('100000')
  await page.getByLabel('Tireuses, palier 1').fill('12')
  await page.getByRole('region', { name: 'Simulateurs' }).getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Repères des simulateurs \d{4} enregistrés\./)).toBeVisible()
  const p = ecritures.filter((e) => e.table === 'parametres_reseau').at(-1)?.corps as { valeur: { simulateurs: Record<string, unknown> } }
  expect(p.valeur.simulateurs).toMatchObject({
    coefInterim: 1.75, contrat: { redaction: 260, paieParMois: 25 }, tireuses: { semainesSaison: 17, occupationSaison: 0.85 },
    remises: { offerts: 0.015 }, familles: [{ libelle: 'Bières', univers: 'cave', marge: 0.42, tva: 'normale' }],
    livraison: [{ kmMax: 15, prix: 50 }], marcheExterieur: { paliers: [{ caMax: 100_000, tireuses: 12 }] },
  })
})

// Équipements du magasin (Joseph, 14/11/2026) : l'équipe les tient sur la fiche, le franchisé les lit ; le nombre de
// tireuses préremplit le simulateur du parc
test('Équipements : saisis par l’équipe, repris dans le parc de tireuses', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await connecter(page, { ecritures, persister: true }, {})
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}`)
  await expect(page.getByText('Aucun équipement enregistré', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter un équipement' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Quantité').fill('4')
  await d.getByLabel('Année d’achat').fill('2025')
  await d.getByLabel('Prix d’achat HT (toute la ligne)').fill('6000')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Équipement ajouté.')).toBeVisible()
  const liste = page.getByRole('list', { name: `Équipements de ${NOM}` })
  await expect(liste.getByText('4 × Tireuse')).toBeVisible()
  await expect(page.getByText(/Équipements · 4 · 6\s000 € HT/)).toBeVisible()
  const e = ecritures.filter((x) => x.methode === 'SUIVI' && (x.corps as { key: string }).key === 'equipements_magasins').at(-1)
  expect(JSON.parse((e!.corps as { value: string }).value)[NOM][0]).toMatchObject({ categorie: 'tireuse', quantite: 4, annee: 2025, valeur: 6000 })
  expect(await textesTropPetits(page)).toEqual([])
  // Zones tactiles du bloc (la fiche a déjà ses propres contrôles, vérifiés ailleurs)
  if (isMobile) for (const z of [page.getByRole('button', { name: 'Ajouter un équipement' }), liste.getByRole('button', { name: 'Modifier Tireuse' }), page.getByRole('link', { name: 'Simuler le parc de 4 tireuses' })]) {
    expect((await z.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  }
  await page.getByRole('link', { name: 'Simuler le parc de 4 tireuses' }).click()
  await expect(page.getByLabel('Tireuses', { exact: true })).toHaveValue('4')
})

test('Équipements : le franchisé voit et modifie ceux de son magasin', async ({ page, isMobile }) => {
  const equipements = { [NOM]: [{ id: 'e1', categorie: 'barnum', precision: '3 × 6 m', quantite: 2, annee: 2024, valeur: 1200, note: '', par: '', le: '2026-10-01' }] }
  const ecritures: Ecriture[] = []
  await connecter(page, { ...franchise, ecritures, config: { equipements_magasins: equipements } }, {})
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}`)
  const liste = page.getByRole('list', { name: `Équipements de ${NOM}` })
  await expect(liste.getByText('2 × Barnum ou tente')).toBeVisible()
  await expect(liste.getByText('3 × 6 m · achat 2024 · 1 200 € HT')).toBeVisible()
  await liste.getByRole('button', { name: /^Modifier Barnum/ }).click()
  await page.getByRole('dialog').getByLabel('Quantité').fill('3')
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Équipement enregistré.')).toBeVisible()
  await expect(liste.getByText('3 × Barnum ou tente')).toBeVisible()
  const e = ecritures.find((x) => x.table === 'rpc/ecrire_equipements')
  expect(e!.corps).toMatchObject({ p_store: NOM, p_liste: [{ id: 'e1', categorie: 'barnum', quantite: 3 }] })
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect((await page.getByRole('button', { name: 'Ajouter un équipement' }).boundingBox())!.height).toBeGreaterThanOrEqual(48)
})
