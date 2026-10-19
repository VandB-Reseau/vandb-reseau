import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

// Noé MODELE suit Lyon, Rennes, Metz, Brest… ; Nantes et Annecy sont à d'autres Coachs
const NOE = { appMetadata: { role: 'coach', coach: 'Noé MODELE' } }
const pratiques = [
  { id: 'bp_1', magasin: 'Annecy Test', date: '2026-09-12', titre: 'Dégustation du samedi', theme: 'Animation et événements', texte: '', par: 'Hugo FICTIF', photos: [], reprises: [] },
  { id: 'bp_2', magasin: 'Lyon Test', date: '2026-08-02', titre: 'Carte fidélité proposée à chaque passage', theme: 'Fidélité', texte: '', par: '', photos: [], reprises: [] },
]

test('un Coach ne voit pas les Paramètres', async ({ page, isMobile }, info) => {
  await seConnecter(page, NOE)
  if (isMobile) {
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Plus' }).click()
    await expect(page.getByRole('heading', { name: 'Plus' })).toBeVisible()
    await expect(page.getByText('Agenda')).toBeVisible()
  }
  await expect(page.getByText('Paramètres', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Import et export')).toHaveCount(0)
  await expect(page.getByText('Collaborateurs')).toHaveCount(0)
  await page.screenshot({ path: `captures/${info.project.name}-coach-menu.png` })
  for (const chemin of ['/parametres/reglages', '/parametres/donnees', '/parametres/collaborateurs', '/equipe']) {
    await page.goto(`./#${chemin}`)
    await expect(page).toHaveURL(/#\/$/)
  }
})

test('un Coach ne voit que ses magasins dans la liste, les visites et la santé du parc', async ({ page, isMobile }, info) => {
  await seConnecter(page, NOE)
  await page.goto('./#/magasins?vue=liste')
  await expect(page.getByText('Rennes Test').first()).toBeVisible()
  await expect(page.getByText('Nantes Test')).toHaveCount(0)
  await expect(page.getByText('Annecy Test')).toHaveCount(0)
  await expect(page.getByText(/^8 magasins$/)).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-coach-magasins.png`, fullPage: !isMobile })
  // Fiche d'un magasin hors de son périmètre
  await page.goto('./#/magasins/Nantes%20Test')
  await expect(page.getByText('Magasin introuvable')).toBeVisible()
  await page.goto('./#/visites?vue=historique')
  await expect(page.getByText('Lyon Test').first()).toBeVisible()
  await expect(page.getByText('Nantes Test')).toHaveCount(0)
  await expect(page.getByText('Agen Test')).toHaveCount(0)
  await page.goto('./#/plus/sante?vue=deploiements')
  // Tableau des déploiements sur PC ; magasin par magasin sur téléphone
  if (!isMobile) await expect(page.getByText('Rennes Test').first()).toBeVisible()
  await expect(page.getByText('Nantes Test')).toHaveCount(0)
})

test('un Coach voit toute la carte et les bonnes pratiques de tout le réseau', async ({ page, isMobile }, info) => {
  await seConnecter(page, { ...NOE, config: { bonnes_pratiques: pratiques } })
  await page.goto('./#/magasins?vue=carte')
  await expect(page.getByText('30 magasins dans le réseau')).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-coach-carte.png` })
  await page.goto('./#/visites?vue=pratiques')
  await expect(page.getByText(/^2 bonnes pratiques/)).toBeVisible()
  const annecy = page.getByRole('article', { name: 'Dégustation du samedi' })
  await expect(annecy).toContainText('Annecy Test')
  await expect(annecy.getByRole('link', { name: 'Annecy Test' })).toHaveCount(0)
  await expect(annecy.getByRole('button', { name: /Modifier/ })).toHaveCount(0)
  const lyon = page.getByRole('article', { name: 'Carte fidélité proposée à chaque passage' })
  await expect(lyon.getByRole('link', { name: 'Lyon Test' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-coach-pratiques.png`, fullPage: !isMobile })
})

test('un Responsable Régional voit les magasins de ses Coachs, le Responsable des intégrés les intégrés', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'rr', rr: 'rr1' } })
  await page.goto('./#/magasins?vue=liste')
  // Alex NORD : Camille TESTARD et Hugo FICTIF
  await expect(page.getByText('Annecy Test').first()).toBeVisible()
  await expect(page.getByText('Rennes Test')).toHaveCount(0)
  await expect(page.getByText('Paramètres', { exact: true })).toHaveCount(0)
})

test('le Responsable des intégrés ne voit que les intégrés', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'rr', rr: 'rr3' } })
  await page.goto('./#/magasins?vue=liste')
  // Intégrés : un magasin sur six (Lyon, Lille, Brest, Albi, Lavaur…)
  await expect(page.getByText('Lyon Test').first()).toBeVisible()
  await expect(page.getByText('Annecy Test')).toHaveCount(0)
})
