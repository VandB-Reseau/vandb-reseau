import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type CommunicationSimulee } from './supabase-simule'

// Onglet Infos réseau (Joseph, 22/10/2026) : communications et bonnes pratiques réunies, recherche et filtres communs

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const AUTRE = '00000000-0000-0000-0000-000000000009'
const ilYa = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString()
const communications: CommunicationSimulee[] = [
  { id: 1, titre: 'Coffrets de Noël', texte: 'Arrivée le 2 novembre.', magasins: null, auteur: AUTRE, auteur_nom: 'Joseph PERREAU', auteur_role: 'directeur', cree_le: ilYa(5) },
  { id: 2, titre: 'Réunion du Sud', texte: 'Rendez-vous à Marseille.', magasins: ['Nice Test'], auteur: AUTRE, auteur_nom: 'Sam SUD', auteur_role: 'rr', cree_le: ilYa(10) },
  { id: 3, titre: 'Bilan de l’été', texte: 'Ventes en hausse.', magasins: null, auteur: AUTRE, auteur_nom: 'Joseph PERREAU', auteur_role: 'directeur', cree_le: ilYa(200) },
]
const pratiques = [
  { id: 'bp_1', magasin: 'Annecy Test', date: ilYa(3).slice(0, 10), titre: 'Dégustation du samedi', theme: 'Animation et événements', texte: 'Trois vins ouverts chaque samedi.', par: 'Hugo FICTIF', photos: [], reprises: [], jaime: [] },
  { id: 'bp_2', magasin: 'Nice Test', date: ilYa(20).slice(0, 10), titre: 'Accord mets et vins', theme: 'Vente additionnelle', texte: 'Une fiche par plat.', par: 'Sam SUD', photos: [], reprises: [], jaime: [] },
]

const infos = (page: Page) => page.getByRole('banner').getByRole('button', { name: /^Infos réseau/ })
const ouvrir = async (page: Page) => {
  // En-tête, à droite du « + », sur PC comme sur téléphone
  await infos(page).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Infos réseau' })).toBeVisible()
}
const titres = (page: Page, section: string) => page.getByRole('region', { name: section }).getByRole('article')

test('communications et bonnes pratiques réunies, filtrées ensemble', async ({ page, isMobile }, info) => {
  await seConnecter(page, { communications, config: { bonnes_pratiques: pratiques } })
  await ouvrir(page)
  const voir = async (section: 'Communications' | 'Bonnes pratiques') => {
    if (isMobile) await page.getByRole('tab', { name: section }).click()
  }
  await voir('Communications')
  await expect(titres(page, 'Communications')).toHaveCount(3)
  if (!isMobile) {
    // PC : les deux colonnes côte à côte
    const c = (await page.getByRole('region', { name: 'Communications' }).boundingBox())!
    const p = (await page.getByRole('region', { name: 'Bonnes pratiques' }).boundingBox())!
    expect(c.x + c.width).toBeLessThanOrEqual(p.x)
    await expect(titres(page, 'Bonnes pratiques')).toHaveCount(2)
  }
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-infos-reseau.png` })

  // Recherche commune
  await page.getByRole('textbox', { name: /Rechercher une communication ou une pratique/ }).fill('noel')
  await expect(titres(page, 'Communications')).toHaveText([/Coffrets de Noël/])
  await page.getByRole('textbox', { name: /Rechercher une communication ou une pratique/ }).fill('')

  // Période : les 3 derniers mois écartent le bilan de l'été
  if (isMobile) await page.getByRole('button', { name: /^Filtres/ }).click()
  await page.getByRole('button', { name: 'Filtre Période' }).click()
  await page.getByRole('menuitem', { name: /3 derniers mois/ }).click()
  await expect(titres(page, 'Communications')).toHaveCount(2)

  // Magasin : Nice garde les communications à tout le réseau et la sienne, et sa bonne pratique
  await page.getByRole('button', { name: 'Filtre Magasin' }).click()
  await page.getByRole('menuitem', { name: /^Nice Test/ }).click()
  await page.keyboard.press('Escape')
  await expect(titres(page, 'Communications')).toHaveCount(2)
  await voir('Bonnes pratiques')
  await expect(titres(page, 'Bonnes pratiques')).toHaveText([/Accord mets et vins/])
})

test('le picto compte les communications et bonnes pratiques pas encore vues, puis retombe à zéro', async ({ page, isMobile }, info) => {
  // Appareil où l'onglet a déjà été ouvert, avant ces publications
  await page.addInitScript(() => {
    if (sessionStorage.getItem('pose')) return
    localStorage.setItem('vandb-reseau-vu', new Date(Date.now() - 7 * 86_400_000).toISOString())
    localStorage.setItem('vandb-pratiques-vues', JSON.stringify(['bp_2']))
    sessionStorage.setItem('pose', '1')
  })
  await seConnecter(page, { communications, config: { bonnes_pratiques: pratiques } })
  // Coffrets de Noël (5 jours) et Dégustation du samedi
  await expect(infos(page)).toHaveAccessibleName('Infos réseau : 2 nouveautés')
  if (isMobile) {
    // À droite du « + », sur la même ligne
    const plus = (await page.getByRole('banner').getByRole('button', { name: 'Créer' }).boundingBox())!
    const i = (await infos(page).boundingBox())!
    expect(i.x).toBeGreaterThan(plus.x)
    expect(Math.abs(i.y - plus.y)).toBeLessThan(4)
    expect(i.height).toBeGreaterThanOrEqual(48)
  }
  await page.screenshot({ path: `captures/${info.project.name}-infos-picto.png`, clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: 120 } })
  await ouvrir(page)
  await expect(infos(page)).toHaveAccessibleName('Infos réseau')
  await page.reload()
  await expect(infos(page)).toHaveAccessibleName('Infos réseau')
})

test('le franchisé n’a pas l’onglet Infos réseau', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'franchise' }, acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] }, espace: {} })
  await expect(infos(page)).toHaveCount(0)
  await page.goto('./#/infos')
  await expect(page.getByRole('heading', { level: 1, name: 'Infos réseau' })).toHaveCount(0)
})
