import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, type OptionsSimulation } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

// Alex NORD (rr1) suit Camille TESTARD et Hugo FICTIF (Annecy…) ; Sam SUD (rr2) suit Inès EXEMPLE et Noé MODELE
const ALEX = { appMetadata: { role: 'rr', rr: 'rr1' } }
const point = [{ id: 'p1', libelle: 'Affiche en vitrine' }]
const campagnes = { liste: [{ id: 'noel', nom: 'Noël', debut: '2020-01-01', fin: '2099-12-31', points: [{ id: 'p1', libelle: 'Vitrine de Noël' }], perimetre: 'tous', magasins: [] }], constats: {} }
const regionSud = { id: 'sud', rr: 'rr2', valeur: { id: 'sud', nom: 'Fête du Sud', debut: '2020-01-01', fin: '2099-12-31', points: point, perimetre: 'region', magasins: [], rr: 'rr2' } }
const regionNord = { id: 'nord', rr: 'rr1', valeur: { id: 'nord', nom: 'Beaujolais du Nord', debut: '2020-01-01', fin: '2099-12-31', points: point, perimetre: 'region', magasins: [], rr: 'rr1' } }

test('un Responsable Régional crée une campagne pour sa région', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  const options: OptionsSimulation = { ...ALEX, ecritures, persister: true, config: { campagnes }, campagnesRegions: [regionSud] }
  await seConnecter(page, options)
  await page.goto('./#/visites?vue=campagnes')
  await expect(page.getByText('Noël', { exact: true })).toBeVisible()
  // La campagne d'une autre région ne le concerne pas
  await expect(page.getByText('Fête du Sud')).toHaveCount(0)
  await page.getByRole('button', { name: 'Nouvelle campagne' }).first().click()
  const d = page.getByRole('dialog', { name: 'Nouvelle campagne' })
  await d.getByLabel('Nom de la campagne').fill('Salon des vins du Nord')
  await d.getByLabel('Début').fill('2026-10-01')
  await d.getByLabel('Fin').fill('2099-01-31')
  await d.getByLabel('Point 1', { exact: true }).fill('Kakémono posé')
  await expect(d.getByLabel('Magasins concernés')).toHaveText('Tous les magasins de la région')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-campagne-region-creation.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const cree = ecritures.find((e) => e.table === 'campagnes_regions' && e.methode === 'POST')?.corps as { rr: string; valeur: { nom: string; perimetre: string; rr: string } }
  expect(cree).toEqual(expect.objectContaining({ rr: 'rr1', valeur: expect.objectContaining({ nom: 'Salon des vins du Nord', perimetre: 'region', rr: 'rr1' }) }))
  // Rien d'écrit dans les référentiels du Directeur
  expect(ecritures.filter((e) => e.table === 'app_config' && e.methode !== 'SUIVI')).toEqual([])
  await expect(page.getByRole('heading', { name: 'Salon des vins du Nord' })).toBeVisible()
  await expect(page.getByText(/Tous les magasins de la région · Région de Alex NORD/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Modifier', exact: true })).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-campagne-region.png`, fullPage: !isMobile })
  // Il constate dans ses magasins ; la campagne nationale reste au Directeur
  await page.getByRole('button', { name: 'Annecy Test, Kakémono posé : fait' }).click()
  await expect(page.getByText(/1 sur \d+ exécuté · 1 constaté/)).toBeVisible()
  await page.getByRole('button', { name: 'Retour aux campagnes' }).click()
  await expect(page.getByText('Région de Alex NORD')).toBeVisible()
  await page.getByRole('button', { name: 'Ouvrir la campagne Noël' }).click()
  await expect(page.getByRole('heading', { name: 'Noël' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Modifier', exact: true })).toHaveCount(0)
})

test('un Responsable Régional limite sa campagne à quelques magasins de sa région', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ...ALEX, ecritures, campagnesRegions: [regionNord] })
  await page.goto('./#/visites?vue=campagnes&campagne=nord')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Modifier Beaujolais du Nord' })
  await d.getByLabel('Magasins concernés').click()
  // Pas de choix « tout le réseau » pour un Responsable Régional
  await expect(page.getByRole('option', { name: 'Tous les magasins ouverts' })).toHaveCount(0)
  await page.getByRole('option', { name: 'Magasins choisis' }).click()
  await d.getByLabel('Magasins', { exact: true }).click()
  await expect(page.getByRole('option', { name: 'Rennes Test' })).toHaveCount(0)
  await page.getByRole('option', { name: 'Annecy Test' }).click()
  await page.keyboard.press('Escape')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const e = ecritures.filter((x) => x.table === 'campagnes_regions').at(-1)!.corps as { valeur: { perimetre: string; magasins: string[] } }
  expect(e.valeur).toEqual(expect.objectContaining({ perimetre: 'choix', magasins: ['Annecy Test'] }))
  await expect(page.getByText(/0 sur 1 exécuté/)).toBeVisible()
})

test('un Responsable Régional lance exceptionnellement une campagne sur tout le réseau', async ({ page }) => {
  const ecritures: Ecriture[] = []
  const options: OptionsSimulation = { ...ALEX, ecritures, campagnesRegions: [] }
  await seConnecter(page, options)
  await page.goto('./#/visites?vue=campagnes')
  await page.getByRole('button', { name: 'Nouvelle campagne' }).first().click()
  const d = page.getByRole('dialog', { name: 'Nouvelle campagne' })
  await d.getByLabel('Nom de la campagne').fill('Foire aux vins')
  await d.getByLabel('Fin').fill('2099-01-31')
  await d.getByLabel('Point 1', { exact: true }).fill('Catalogue distribué')
  await d.getByLabel('Magasins concernés').click()
  await page.getByRole('option', { name: 'Tout le réseau' }).click()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  expect(options.campagnesRegions).toEqual([expect.objectContaining({ rr: 'rr1', valeur: expect.objectContaining({ perimetre: 'tous', rr: 'rr1' }) })])
  await expect(page.getByText(/Tout le réseau · Lancée par Alex NORD/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Modifier', exact: true })).toBeVisible()
})

test('le Directeur voit la campagne réseau lancée par un Responsable Régional sur tous les magasins', async ({ page }) => {
  const reseau = { id: 'foire', rr: 'rr1', valeur: { ...regionNord.valeur, id: 'foire', nom: 'Foire aux vins', perimetre: 'tous' } }
  await seConnecter(page, { campagnesRegions: [reseau] })
  await page.goto('./#/visites?vue=campagnes')
  await expect(page.getByText('Lancée par Alex NORD')).toBeVisible()
  await page.getByRole('button', { name: 'Ouvrir la campagne Foire aux vins' }).click()
  const parRR = page.getByRole('region', { name: 'Exécution par Responsable Régional' })
  await expect(parRR).toContainText('Alex NORD')
  await expect(parRR).toContainText('Sam SUD')
})

test('le Directeur voit les campagnes de chaque région et peut en supprimer une', async ({ page }) => {
  const ecritures: Ecriture[] = []
  const options: OptionsSimulation = { ecritures, campagnesRegions: [regionNord, regionSud] }
  await seConnecter(page, options)
  await page.goto('./#/visites?vue=campagnes')
  await expect(page.getByText('Région de Alex NORD')).toBeVisible()
  await expect(page.getByText('Région de Sam SUD')).toBeVisible()
  await page.getByRole('button', { name: 'Ouvrir la campagne Fête du Sud' }).click()
  await expect(page.getByRole('region', { name: 'Exécution par Responsable Régional' })).toContainText('Sam SUD')
  await expect(page.getByRole('region', { name: 'Exécution par Responsable Régional' })).not.toContainText('Alex NORD')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Modifier Fête du Sud' })
  await d.getByRole('button', { name: 'Supprimer' }).click()
  await d.getByRole('alert').getByRole('button', { name: 'Supprimer' }).click()
  await expect(d).toBeHidden()
  expect(ecritures.find((x) => x.table === 'campagnes_regions' && x.methode === 'DELETE')?.filtre).toContain('id=eq.sud')
  expect(options.campagnesRegions!.map((c) => c.id)).toEqual(['nord'])
})

test('la campagne de sa région apparaît dans la fiche d’un magasin, et pas ailleurs', async ({ page }) => {
  await seConnecter(page, { campagnesRegions: [regionNord] })
  await page.goto('./#/magasins/Annecy%20Test?vue=campagnes')
  await expect(page.getByText('Beaujolais du Nord').first()).toBeVisible()
  await page.goto('./#/magasins/Rennes%20Test?vue=campagnes')
  await expect(page.getByRole('heading', { level: 1, name: 'Rennes Test' })).toBeVisible()
  await expect(page.getByText('Beaujolais du Nord')).toHaveCount(0)
})

test('sans la table des campagnes régionales, l’app fonctionne comme avant', async ({ page }) => {
  await seConnecter(page, { campagnesRegions: null, config: { campagnes } })
  await page.goto('./#/visites?vue=campagnes')
  await expect(page.getByText('Noël', { exact: true })).toBeVisible()
})
