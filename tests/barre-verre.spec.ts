import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Téléphone : barre du bas flottante en verre (translucide, floutée, arrondie), le contenu défile dessous

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

for (const schema of ['light', 'dark'] as const) {
  test(`barre du bas en verre sur téléphone (${schema === 'light' ? 'clair' : 'sombre'})`, async ({ page, isMobile }, info) => {
    await page.emulateMedia({ colorScheme: schema })
    await seConnecter(page)
    const nav = page.getByRole('navigation', { name: 'Navigation principale' })
    if (!isMobile) {
      // PC : menu latéral, pas de barre flottante
      await expect(nav).toBeVisible()
      expect(await nav.evaluate((n) => getComputedStyle(n).position)).not.toBe('fixed')
      return
    }
    await page.goto('./#/magasins')
    await expect(nav.getByRole('button', { name: 'Magasins' })).toHaveAttribute('aria-current', 'page')
    const style = await nav.evaluate((n) => {
      const s = getComputedStyle(n)
      return { position: s.position, flou: s.backdropFilter || (s as unknown as Record<string, string>).webkitBackdropFilter, fond: s.backgroundColor, rayon: parseFloat(s.borderTopLeftRadius) }
    })
    expect(style.position).toBe('fixed')
    expect(style.flou).toContain('blur')
    // Fond translucide : le contenu reste visible dessous
    const alpha = Number(style.fond.match(/rgba?\(([^)]+)\)/)![1].split(',')[3] ?? 1)
    expect(alpha).toBeGreaterThan(0.5)
    expect(alpha).toBeLessThan(1)
    expect(style.rayon).toBeGreaterThanOrEqual(24)
    // Flottante : décollée des bords de l'écran
    const boite = (await nav.boundingBox())!
    const ecran = page.viewportSize()!
    expect(boite.x).toBeGreaterThanOrEqual(8)
    expect(ecran.width - (boite.x + boite.width)).toBeGreaterThanOrEqual(8)
    expect(ecran.height - (boite.y + boite.height)).toBeGreaterThanOrEqual(6)
    // Zones tactiles d'au moins 48 px
    for (const b of await nav.getByRole('button').all()) {
      const r = (await b.boundingBox())!
      expect(r.height).toBeGreaterThanOrEqual(48)
      expect(r.width).toBeGreaterThanOrEqual(48)
    }
    expect(await textesTropPetits(page)).toEqual([])
    await page.screenshot({ path: `captures/${info.project.name}-barre-verre-${schema === 'light' ? 'clair' : 'sombre'}.png` })
    // Contenu sous la barre en fin de défilement : la dernière ligne reste accessible au-dessus de la barre
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const finMain = await page.getByRole('main').evaluate((m) => m.lastElementChild!.getBoundingClientRect().bottom)
    expect(finMain).toBeLessThanOrEqual(boite.y + 1)
    await page.screenshot({ path: `captures/${info.project.name}-barre-verre-${schema === 'light' ? 'clair' : 'sombre'}-bas.png` })
  })
}
