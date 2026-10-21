import { expect, test, type Locator, type Page } from '@playwright/test'
import { seConnecter } from './supabase-simule'

// Onglets et barres de filtres collés sous la barre du haut sur tous les écrans (Joseph, 21/10/2026)
const haut = (l: Locator) => l.evaluate((e) => Math.round(e.getBoundingClientRect().top))
const bas = (l: Locator) => l.evaluate((e) => Math.round(e.getBoundingClientRect().bottom))
// Rien ne passe par-dessus la bande : le point au milieu de sa dernière ligne lui appartient
const visible = (l: Locator) => l.evaluate((e) => {
  const r = e.getBoundingClientRect()
  const x = Math.min(r.left + 40, window.innerWidth - 4)
  const dessus = document.elementFromPoint(x, r.bottom - 3)
  return !!dessus && (e === dessus || e.contains(dessus))
})
// Écran assez long pour défiler, même avec peu de données fictives
const allonger = (l: Locator) => l.evaluate((e) => {
  let b: HTMLElement = e as HTMLElement
  while (getComputedStyle(b).position !== 'sticky') b = b.parentElement!
  const d = document.createElement('div'); d.style.height = '3000px'; b.parentElement!.appendChild(d)
})
const defiler = (page: Page, y = 1200) => page.evaluate((y) => window.scrollTo(0, Math.min(y, document.documentElement.scrollHeight)), y)
// La barre du bas du téléphone et la bande ne se chevauchent pas
const sousBarreBasse = async (page: Page, l: Locator, telephone: boolean) => {
  const barre = page.getByRole('navigation', { name: 'Navigation principale' })
  if (telephone && await barre.count()) expect(await bas(l)).toBeLessThan(await haut(barre.first()))
}

const ecrans = [
  { titre: 'visites', adresse: './#/visites?vue=rythme', onglets: 'Rubriques des visites', filtres: true },
  { titre: 'visites-historique', adresse: './#/visites?vue=historique', onglets: 'Rubriques des visites', filtres: true },
  { titre: 'magasins', adresse: './#/magasins', onglets: 'Affichage', filtres: true },
  { titre: 'equipe', adresse: './#/equipe?vue=organisation&forme=liste', onglets: 'Rubriques de l’équipe', filtres: false },
  { titre: 'sante', adresse: './#/plus/sante?vue=evaluer', onglets: 'Rubriques de la santé du parc', filtres: false },
  { titre: 'charge', adresse: './#/parametres/charge', onglets: 'Rubriques de la charge', filtres: false },
]

for (const e of ecrans) {
  test(`${e.titre} : les onglets et les filtres restent sous la barre du haut`, async ({ page, isMobile }, info) => {
    await seConnecter(page)
    await page.goto(e.adresse)
    const onglets = page.getByRole('tablist', { name: e.onglets })
    await expect(onglets).toBeVisible()
    const entete = isMobile ? 64 : 72
    await allonger(onglets)
    await defiler(page)
    await expect.poll(() => haut(onglets)).toBe(entete)
    expect(await visible(onglets)).toBe(true)
    if (e.filtres) {
      // La barre de recherche se range juste sous les onglets
      const recherche = page.getByRole('main').getByRole('textbox').first()
      await expect.poll(async () => (await recherche.boundingBox())!.y).toBeGreaterThanOrEqual(await bas(onglets))
      expect(await visible(onglets)).toBe(true)
      expect((await recherche.boundingBox())!.y).toBeLessThan(await bas(onglets) + 24)
    }
    await sousBarreBasse(page, onglets, isMobile)
    await page.screenshot({ path: `captures/${info.project.name}-collant-${e.titre}.png` })
  })
}

test('magasins : les lettres se rangent sous les onglets et la recherche', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  const onglets = page.getByRole('tablist', { name: 'Affichage' })
  await defiler(page, 600)
  const lettres = page.locator('[id^="lettre-"]')
  await expect(lettres.first()).toBeAttached()
  // La lettre collée commence juste sous la barre de recherche, jamais derrière
  const basBarre = await page.getByRole('main').getByRole('textbox').first().evaluate((e) => {
    let b: HTMLElement | null = e as HTMLElement
    while (b && getComputedStyle(b).position !== 'sticky') b = b.parentElement
    return Math.round(b!.getBoundingClientRect().bottom)
  })
  const position = await lettres.first().evaluate((e) => Math.round(parseFloat(getComputedStyle(e).top)))
  expect(Math.abs(position - basBarre)).toBeLessThanOrEqual(1)
  expect(await visible(onglets)).toBe(true)
  await page.screenshot({ path: `captures/${info.project.name}-collant-magasins-lettres.png` })
})

test('carte : la carte passe sous les onglets et la recherche', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins?vue=carte')
  const onglets = page.getByRole('tablist', { name: 'Affichage' })
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await defiler(page, 300)
  expect(await visible(onglets)).toBe(true)
  if (!isMobile) await page.screenshot({ path: `captures/${info.project.name}-collant-carte.png` })
})

test('agenda et notifications : le mois et les puces restent en haut', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/plus/agenda')
  const mois = page.getByRole('button', { name: 'Mois suivant' })
  await expect(mois).toBeVisible()
  await allonger(page.getByRole('group', { name: 'Catégories affichées' }))
  await defiler(page)
  await expect.poll(async () => (await mois.boundingBox())!.y).toBeLessThan((isMobile ? 64 : 72) + 24)
  await expect(page.getByRole('group', { name: 'Catégories affichées' })).toBeInViewport()
  await page.screenshot({ path: `captures/${info.project.name}-collant-agenda.png` })
})

test('paramètres : le sommaire (PC) ou le retour (téléphone) reste à l’écran', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/parametres/reglages?rubrique=audits')
  await page.waitForLoadState('networkidle')
  await defiler(page, 5000)
  if (isMobile) {
    const retour = page.getByRole('button', { name: 'Paramètres' })
    await expect.poll(async () => Math.round((await retour.boundingBox())!.y)).toBeLessThan(64 + 16)
    expect(await visible(retour)).toBe(true)
  } else {
    await expect(page.getByRole('region', { name: 'Rubriques des paramètres' })).toBeInViewport()
  }
  await page.screenshot({ path: `captures/${info.project.name}-collant-parametres.png` })
})
