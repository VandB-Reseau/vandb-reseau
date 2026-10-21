import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// En-tête des fiches : sur PC, les compteurs sont sur la ligne du nom, entre les infos et les pictos

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const fiches = [
  { nom: 'magasin', url: './#/magasins/Lyon%20Test', titre: 'Lyon Test', bouton: 'Appeler' },
  { nom: 'coach', url: './#/equipe/coach/In%C3%A8s%20EXEMPLE', titre: 'Inès EXEMPLE', bouton: 'Appeler' },
  { nom: 'rr', url: './#/equipe/rr/rr1', titre: null, bouton: 'Appeler' },
]

for (const f of fiches) {
  test(`fiche ${f.nom} : en-tête compact, compteurs sur la ligne du nom`, async ({ page, isMobile }, info) => {
    await seConnecter(page)
    await page.goto(f.url)
    const titre = page.getByRole('main').getByRole('heading', { level: 1, ...(f.titre ? { name: f.titre } : {}) })
    await expect(titre).toBeVisible()
    const bref = page.getByRole('group', { name: 'En bref' })
    await expect(bref).toBeVisible()
    const t = (await titre.boundingBox())!, b = (await bref.boundingBox())!
    const appel = (await page.getByRole('main').getByRole('button', { name: /^Appeler/ }).or(page.getByRole('main').getByRole('link', { name: /^Appeler/ })).first().boundingBox())!
    const carte = (await bref.locator('xpath=ancestor::div[contains(@class,"MuiCard-root")][1]').boundingBox())!
    if (isMobile) {
      // Téléphone : compteurs sous le nom, comme avant
      expect(b.y).toBeGreaterThan(t.y + t.height - 1)
    } else {
      // PC : même ligne que le nom, à droite des infos et à gauche des pictos
      expect(b.y).toBeLessThan(appel.y + appel.height)
      expect(b.y + b.height).toBeGreaterThan(t.y)
      expect(b.x).toBeGreaterThan(t.x)
      expect(b.x + b.width).toBeLessThanOrEqual(appel.x + 1)
      expect(carte.height).toBeLessThan(170)
    }
    expect(await textesTropPetits(page)).toEqual([])
    await page.screenshot({ path: `captures/${info.project.name}-entete-${f.nom}.png`, clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: Math.min(page.viewportSize()!.height, carte.y + carte.height + 80) } })
  })
}

test('PC étroit : compteurs et pictos passent sous le nom sans déborder', async ({ page, isMobile }, info) => {
  test.skip(isMobile)
  await page.setViewportSize({ width: 960, height: 700 })
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByRole('group', { name: 'En bref' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: `captures/${info.project.name}-entete-etroit.png` })
})
