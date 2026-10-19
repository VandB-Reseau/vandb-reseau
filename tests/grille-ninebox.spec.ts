import { expect, test } from '@playwright/test'
import { caseDe, grilleParDefaut, niveauAxe, normaliserGrille, type GrilleNineBox } from '../src/data/sante'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const ev = (notes: Record<string, 0 | 1 | 2 | 3>) => ({ notes, date: '2026-10-19', par: 'Test' })
const resultatsForts = { caExterieur: 3, panierCave: 3, panierBar: 3, fluxCave: 3, fluxBar: 3 } as const

test.describe('calcul de la grille', () => {
  test.skip(({ isMobile }) => isMobile, 'logique pure, un seul passage')

  test('moyenne pondérée de l’axe Franchisé', () => {
    // 25×3 + 25×3 + 20×1 + 20×2 + 10×1 = 220 / 100 = 2,2 → Moyen
    expect(niveauAxe(ev({ gestion: 3, management: 3, animation: 1, tenue: 2, relation: 1 }), 'franchise')).toBe(2)
    // À poids égaux la moyenne serait 2 aussi ; avec gestion et management forts et le reste moyen : 2,5 → Fort
    expect(niveauAxe(ev({ gestion: 3, management: 3, animation: 2, tenue: 2, relation: 2 }), 'franchise')).toBe(3)
  })

  test('un « Non concerné » sort du calcul et son poids est redistribué', () => {
    expect(niveauAxe(ev({ gestion: 3, management: 3, animation: 0, tenue: 3, relation: 1 }), 'franchise')).toBe(3)
  })

  test('critère bloquant noté Faible : l’axe est Faible', () => {
    const e = ev({ ...resultatsForts, gestion: 3, management: 3, animation: 3, tenue: 1, relation: 3 })
    expect(niveauAxe(e, 'franchise')).toBe(1)
    expect(caseDe(e)?.id).toBe('fragile')
    const sansBlocage: GrilleNineBox = { ...grilleParDefaut, criteres: grilleParDefaut.criteres.map((c) => ({ ...c, bloquant: false })) }
    expect(caseDe(e, sansBlocage)?.id).toBe('locomotive')
  })

  test('l’ancienne note du franchisé décide tant qu’aucun critère détaillé n’est noté', () => {
    expect(caseDe(ev({ ...resultatsForts, franchise: 1 }))?.id).toBe('fragile')
    // Dès qu'un critère détaillé est noté, l'ancienne note ne compte plus
    expect(caseDe(ev({ ...resultatsForts, franchise: 1, gestion: 3 }))?.id).toBe('locomotive')
    expect(caseDe(ev({ ...resultatsForts }))).toBeNull()
  })

  test('les seuils de la grille décident du niveau', () => {
    const e = ev({ ...resultatsForts, gestion: 2, management: 2, animation: 2, tenue: 2, relation: 2 })
    expect(caseDe(e)?.id).toBe('grandir')
    expect(caseDe(e, { ...grilleParDefaut, seuilHaut: 2 })?.id).toBe('locomotive')
  })

  test('une grille enregistrée illisible reprend la grille par défaut', () => {
    expect(normaliserGrille(null)).toEqual(grilleParDefaut)
    expect(normaliserGrille({ criteres: [{ id: 'x', libelle: 'Seul', axe: 'resultats', poids: 100 }] }).criteres).toEqual(grilleParDefaut.criteres)
    expect(normaliserGrille({ ...grilleParDefaut, seuilBas: 2.5, seuilHaut: 2 }).seuilBas).toBe(1.67)
  })
})

test('la saisie affiche le détail du franchisé, rangé par axe', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Rennes%20Test')
  await page.getByRole('button', { name: 'Modifier', exact: true }).first().click()
  const d = page.getByRole('dialog', { name: 'Modifier Rennes Test' })
  await expect(d.getByRole('heading', { name: 'Résultats' })).toBeVisible()
  await expect(d.getByRole('heading', { name: 'Franchisé' })).toBeVisible()
  for (const c of ['Gestion', 'Management de l’équipe', 'Animation commerciale', 'Tenue du magasin', 'Relation au réseau']) {
    await expect(d.getByRole('button', { name: `Fort : ${c}`, exact: true })).toBeVisible()
  }
  await expect(d.getByRole('button', { name: /^Gestion : Suit ses chiffres/ })).toBeVisible()
  await d.getByRole('button', { name: 'Fort : CA marché extérieur', exact: true }).click()
  for (const c of ['Gestion', 'Management de l’équipe', 'Animation commerciale', 'Relation au réseau']) await d.getByRole('button', { name: `Fort : ${c}`, exact: true }).click()
  await expect(d.getByText('Locomotive')).toBeVisible()
  // Tenue du magasin est bloquante : Faible fait tomber le franchisé en Faible
  await d.getByRole('button', { name: 'Faible : Tenue du magasin', exact: true }).click()
  await expect(d.getByText('Performance fragile')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${test.info().project.name}-ninebox-saisie-detail.png` })
})

test('la fiche magasin montre le niveau de chaque axe et l’ancienne note tant qu’elle compte', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Annecy%20Test?vue=sante')
  await expect(page.getByRole('heading', { name: 'Franchisé', exact: true })).toBeVisible()
  await expect(page.getByText('Niveau du franchisé (ancienne note)', { exact: true })).toBeVisible()
})

test('régler la grille dans Paramètres, avec l’aperçu des magasins qui changent de case', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/parametres/reglages')
  const carte = page.locator('.MuiCard-root').filter({ has: page.getByRole('heading', { name: 'Grille de la nine box' }) })
  await carte.scrollIntoViewIfNeeded()
  await expect(carte.getByText('Total 100 %')).toHaveCount(2)
  const enregistrer = carte.getByRole('button', { name: 'Enregistrer' })
  await expect(enregistrer).toBeDisabled()

  // Poids qui ne font plus 100 % : enregistrement impossible
  await carte.getByLabel('Poids de CA marché extérieur').fill('40')
  await expect(carte.getByText('Les poids des Résultats font 120 % au lieu de 100 %.')).toBeVisible()
  await expect(enregistrer).toBeDisabled()
  await carte.getByLabel('Poids de CA marché extérieur').fill('20')

  // Fort dès 2 : les résultats de Nantes (tout à 2) passent en Fort, l'ancienne note du franchisé (Moyen) ne bouge pas
  await carte.getByLabel('Fort à partir de').fill('2')
  await expect(carte.getByText('1 magasin change de case.')).toBeVisible()
  const liste = carte.getByRole('list', { name: 'Magasins qui changent de case' })
  await expect(liste).toContainText('Nantes Test')
  await expect(liste).toContainText('À faire grandir')

  // Nouveau critère sur l'axe Franchisé
  await carte.getByRole('button', { name: 'Ajouter un critère' }).nth(1).click()
  const nouveau = carte.getByLabel('Critère', { exact: true }).last()
  await nouveau.fill('Digital')
  await carte.getByLabel('Poids de Digital').fill('10')
  await carte.getByLabel('Poids de Relation au réseau').fill('0')
  await expect(carte.getByText('Total 100 %')).toHaveCount(2)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${test.info().project.name}-parametres-grille-ninebox.png`, fullPage: !isMobile })

  await enregistrer.click()
  await expect(page.getByText('Grille de la nine box enregistrée.')).toBeVisible()
  const ecrite = ecritures.filter((e) => e.table === 'app_config' && JSON.stringify(e.corps).includes('seuilHaut')).at(-1)!
  const g = JSON.parse((ecrite.corps as { value: string }).value)
  expect(g.seuilHaut).toBe(2)
  expect(g.modifieLe).toBeTruthy()
  expect(g.criteres.find((c: { libelle: string }) => c.libelle === 'Digital')).toMatchObject({ axe: 'franchise', poids: 10 })
})

test('une grille enregistrée change les colonnes de la saisie et la case des magasins', async ({ page }) => {
  const grille: GrilleNineBox = {
    seuilBas: 1.67, seuilHaut: 2.34,
    criteres: [
      { id: 'caExterieur', libelle: 'CA marché extérieur', axe: 'resultats', poids: 100 },
      { id: 'gestion', libelle: 'Gestion', axe: 'franchise', poids: 50 },
      { id: 'digital', libelle: 'Digital', axe: 'franchise', poids: 50 },
    ],
  }
  await seConnecter(page, { config: { grille_ninebox: grille } })
  await page.goto('./#/magasins/Rennes%20Test')
  await page.getByRole('button', { name: 'Modifier', exact: true }).first().click()
  const d = page.getByRole('dialog', { name: 'Modifier Rennes Test' })
  await expect(d.getByRole('button', { name: 'Fort : Digital', exact: true })).toBeVisible()
  await expect(d.getByRole('button', { name: 'Fort : Panier moyen cave', exact: true })).toHaveCount(0)
  await d.getByRole('button', { name: 'Faible : CA marché extérieur', exact: true }).click()
  await d.getByRole('button', { name: 'Fort : Digital', exact: true }).click()
  await expect(d.getByText('Diagnostic marché')).toBeVisible()
})
