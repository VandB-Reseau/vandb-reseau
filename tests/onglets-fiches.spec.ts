import { expect, test, type Page } from '@playwright/test'
import { ouvrirOnglet, seConnecter } from './supabase-simule'

const hauteur = (page: Page) => page.evaluate(() => window.scrollY)
const bande = (page: Page, nom: string) => page.getByRole('tablist', { name: `Rubriques de ${nom}` })
// Haut de la bande d'onglets par rapport à l'écran (64 px sous la barre du haut sur téléphone, 72 px sur PC)
const hautBande = (page: Page, nom: string) => bande(page, nom).evaluate((e) => Math.round(e.getBoundingClientRect().top))

for (const fiche of [
  { titre: 'magasin', adresse: './#/magasins/Brest%20Test', nom: 'Brest Test', onglet: 'Chiffres', retour: 'Fiche' },
  { titre: 'Coach', adresse: './#/equipe/coach/In%C3%A8s%20EXEMPLE?vue=magasins', nom: 'Inès EXEMPLE', onglet: 'Visites', retour: 'Portefeuille' },
]) {
  test(`fiche ${fiche.titre} : changer d’onglet garde les onglets à l’écran au lieu de remonter tout en haut`, async ({ page, isMobile }, info) => {
    await page.setViewportSize(isMobile ? { width: 390, height: 640 } : { width: 1280, height: 640 })
    await seConnecter(page)
    await page.goto(fiche.adresse)
    await expect(bande(page, fiche.nom)).toBeVisible()
    const haut = isMobile ? 64 : 72
    // Téléphone : en-tête bas, les onglets commencent avant 300 px
    if (isMobile) expect(await hautBande(page, fiche.nom)).toBeLessThan(300)
    // En haut de la fiche : changer d'onglet ne bouge pas la page
    await bande(page, fiche.nom).getByRole('tab', { name: fiche.retour }).click()
    await expect.poll(() => hauteur(page)).toBe(0)
    await page.goto(fiche.adresse)
    // L'en-tête a défilé : la bande reste collée sous la barre du haut
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect.poll(() => hautBande(page, fiche.nom)).toBe(haut)
    await page.screenshot({ path: `captures/${info.project.name}-fiche-${fiche.titre.toLowerCase()}-onglets-colles.png` })
    // Changer d'onglet : la page ne remonte pas, le nouvel onglet commence sous les onglets
    // Clic sans défilement du test vers l'onglet (« Chiffres et santé » déborde à droite de la bande)
    const onglet = bande(page, fiche.nom).getByRole('tab', { name: new RegExp(`^${fiche.onglet}`) })
    if (await onglet.isVisible()) await onglet.dispatchEvent('click'); else await ouvrirOnglet(page, fiche.onglet, bande(page, fiche.nom))
    await expect(onglet).toHaveAttribute('aria-selected', 'true')
    await expect.poll(() => hauteur(page)).toBeGreaterThan(100)
    await expect.poll(() => hautBande(page, fiche.nom)).toBe(haut)
    // Même pour un onglet court
    await bande(page, fiche.nom).getByRole('tab', { name: fiche.retour }).click()
    await expect.poll(() => hautBande(page, fiche.nom)).toBe(haut)
    await page.screenshot({ path: `captures/${info.project.name}-fiche-${fiche.titre.toLowerCase()}-changement-onglet.png` })
  })
}
