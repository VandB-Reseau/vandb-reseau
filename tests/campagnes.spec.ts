import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

const constat = (fait: boolean) => ({ fait, date: '2026-10-01', par: 'Camille TESTARD' })
const campagnes = {
  liste: [
    { id: 'c1', nom: 'Noël 2026', debut: '2026-01-01', fin: '2099-12-31', points: [{ id: 'p1', libelle: 'Vitrine posée' }, { id: 'p2', libelle: 'PLV en place' }], perimetre: 'franchises', magasins: [] },
    { id: 'c0', nom: 'Beaujolais 2025', debut: '2025-11-01', fin: '2025-11-30', points: [{ id: 'p1', libelle: 'Offre affichée' }], perimetre: 'tous', magasins: [] },
  ],
  constats: { c1: { 'Annecy Test': { p1: constat(true), p2: constat(true) }, 'Nantes Test': { p1: constat(false) }, 'Rennes Test': { p1: constat(true), p2: constat(false) } } },
}

const derniereValeur = (ecritures: Ecriture[]) => {
  const e = ecritures.filter((x) => x.table === 'app_config' && ((x.corps as { key?: string }).key === 'campagnes' || x.filtre.includes('key=eq.campagnes'))).at(-1)
  return JSON.parse((e!.corps as { value: string }).value)
}

test('créer une campagne et constater son exécution', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, persister: true })
  await page.goto('./#/visites?vue=campagnes')
  await expect(page.getByText('Aucune campagne')).toBeVisible()
  await page.getByRole('button', { name: 'Nouvelle campagne' }).click()
  const d = page.getByRole('dialog', { name: 'Nouvelle campagne' })
  await d.getByLabel('Nom de la campagne').fill('Vitrine de Noël')
  await d.getByLabel('Début').fill('2026-10-01')
  await d.getByLabel('Fin').fill('2099-01-31')
  await d.getByLabel('Point 1', { exact: true }).fill('Vitrine posée')
  await d.getByRole('button', { name: 'Ajouter un point' }).click()
  await d.getByLabel('Point 2', { exact: true }).fill('PLV en place')
  expect(await textesTropPetits(page)).toEqual([])
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const cree = derniereValeur(ecritures)
  expect(cree.liste).toEqual([expect.objectContaining({ nom: 'Vitrine de Noël', debut: '2026-10-01', fin: '2099-01-31', perimetre: 'tous', points: [{ id: 'p1', libelle: 'Vitrine posée' }, { id: 'p2', libelle: 'PLV en place' }] })])

  // La campagne créée s'ouvre : on constate un point dans un magasin
  await expect(page.getByRole('heading', { name: 'Vitrine de Noël' })).toBeVisible()
  await expect(page.getByText(/0 sur \d+ exécuté · 0 constaté/)).toBeVisible()
  await page.getByRole('button', { name: 'Annecy Test, Vitrine posée : fait' }).click()
  await page.getByRole('button', { name: 'Annecy Test, PLV en place : fait' }).click()
  await expect(page.getByText(/1 sur \d+ exécuté · 1 constaté/)).toBeVisible()
  const c = derniereValeur(ecritures)
  expect(c.constats[cree.liste[0].id]['Annecy Test']).toEqual({ p1: expect.objectContaining({ fait: true, par: 'Dominique DIRECTION' }), p2: expect.objectContaining({ fait: true }) })
  // Un second clic sur le même choix : le point redevient à constater
  await page.getByRole('button', { name: 'Annecy Test, PLV en place : fait' }).click()
  await expect(page.getByText(/0 sur \d+ exécuté · 1 constaté/)).toBeVisible()
  expect(derniereValeur(ecritures).constats[cree.liste[0].id]['Annecy Test']).toEqual({ p1: expect.objectContaining({ fait: true }) })
})

test('taux d’exécution par Responsable Régional, par Coach et par magasin', async ({ page, isMobile }, info) => {
  await seConnecter(page, { config: { campagnes } })
  await page.goto('./#/visites?vue=campagnes')
  await expect(page.getByRole('region', { name: 'En cours' }).getByRole('heading', { name: 'Noël 2026' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Terminées' }).getByRole('heading', { name: 'Beaujolais 2025' })).toBeVisible()
  await expect(page.getByText(/^1 sur \d+ exécuté · 3 constatés$/)).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-campagnes.png` })

  await page.getByRole('button', { name: 'Ouvrir la campagne Noël 2026' }).click()
  await expect(page.getByRole('heading', { name: 'Noël 2026' })).toBeVisible()
  await expect(page.getByText('Exécutée : 1', { exact: true })).toBeVisible()
  await expect(page.getByText('En partie : 1')).toBeVisible()
  await expect(page.getByText('Non exécutée : 1')).toBeVisible()
  const parCoach = page.getByRole('table', { name: 'Exécution par Coach' })
  await expect(parCoach.getByRole('row', { name: /Hugo FICTIF/ })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Exécution par Responsable Régional' }).getByRole('row', { name: /Alex NORD/ })).toBeVisible()
  // Les magasins intégrés ne sont pas concernés par une campagne des franchisés
  await expect(page.getByRole('link', { name: 'Lyon Test' })).toHaveCount(0)
  if (isMobile) await page.getByRole('button', { name: 'Filtres' }).click()
  await page.getByLabel('Filtre Exécution').click()
  await page.getByRole('menuitem', { name: /En partie/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('link', { name: 'Rennes Test' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Annecy Test' })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-campagne-detail.png`, fullPage: !isMobile })
})

test('constater une campagne depuis la fiche magasin et pendant une visite', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, config: { campagnes } })
  await page.goto(`./#/magasins/${encodeURIComponent('Nantes Test')}`)
  const section = page.getByRole('heading', { name: 'Campagnes' }).locator('xpath=ancestor::div[contains(@class,"MuiCard-root")]')
  await expect(section.getByText('Noël 2026')).toBeVisible()
  await expect(section.getByRole('button', { name: 'Noël 2026, Vitrine posée : pas fait' })).toHaveAttribute('aria-pressed', 'true')
  await section.getByRole('button', { name: 'Noël 2026, Vitrine posée : fait' }).click()
  await expect.poll(() => ecritures.filter((e) => e.table === 'app_config').length).toBeGreaterThan(0)
  expect(derniereValeur(ecritures).constats.c1['Nantes Test'].p1).toEqual(expect.objectContaining({ fait: true }))

  // Pendant une visite : constats enregistrés à la date de la visite
  await page.goto(`./#/magasins/${encodeURIComponent('Annecy Test')}`)
  await page.getByRole('button', { name: 'Saisir', exact: true }).first().click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await d.getByLabel('Date').fill('2026-10-10')
  await expect(d.getByText('Campagnes en cours')).toBeVisible()
  await d.getByRole('button', { name: 'Noël 2026, PLV en place : pas fait' }).click()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  expect(derniereValeur(ecritures).constats.c1['Annecy Test'].p2).toEqual(expect.objectContaining({ fait: false, date: '2026-10-10' }))
})
