import { expect, test, type Locator } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

// Sprint 16 : app « façon réseau social » (bouton Créer, fiche profil, lignes plutôt que tableaux, J'aime, glisser)

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const DIRECTEUR = 'Dominique DIRECTION'
const sansDebordement = (l: Locator) => l.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

test('le bouton Créer propose visite, tâche, message et bonne pratique', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  const creer = isMobile
    ? page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Créer' })
    : page.getByRole('button', { name: 'Créer', exact: true })
  if (isMobile) await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button')).toHaveText(['Accueil', 'Magasins', '', 'Visites', 'Santé'])
  await creer.click()
  const d = page.getByRole('dialog', { name: 'Créer' })
  for (const t of ['Visite', 'Tâche', 'Message', 'Bonne pratique']) await expect(d.getByRole('button', { name: t })).toBeVisible()
  // Fenêtre compacte : 340 px de large sur PC, les quatre choix sur une ligne sur téléphone
  const fenetre = (await d.boundingBox())!
  if (isMobile) {
    expect(fenetre.height).toBeLessThanOrEqual(200)
    const [v, p] = [(await d.getByRole('button', { name: 'Visite' }).boundingBox())!, (await d.getByRole('button', { name: 'Bonne pratique' }).boundingBox())!]
    expect(Math.abs(v.y - p.y)).toBeLessThanOrEqual(1)
  } else expect(fenetre.width).toBeLessThanOrEqual(340)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-creer.png` })
  await d.getByRole('button', { name: 'Tâche' }).click()
  await expect(page.getByRole('dialog', { name: 'Ajouter une tâche' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Ajouter une tâche' }).getByRole('button', { name: 'Annuler' }).click()
  await creer.click()
  await page.getByRole('dialog', { name: 'Créer' }).getByRole('button', { name: 'Message' }).click()
  await expect(page).toHaveURL(/#\/messages/)
})

test('l’accueil et la fiche magasin tiennent dans la largeur ; la fiche s’ouvre sur le fil', async ({ page }, info) => {
  await seConnecter(page)
  await expect(page.getByRole('region', { name: 'À traiter' })).toBeVisible()
  expect(await sansDebordement(page.locator('body'))).toBe(true)
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByRole('heading', { name: 'Lyon Test', level: 1 })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Fil', selected: true })).toBeVisible()
  const bref = page.getByRole('group', { name: 'En bref' })
  await expect(bref).toContainText('70 k€')
  await expect(bref).toContainText('−30,0 %')
  for (const b of ['Appeler', 'Écrire un message', 'Saisir une visite']) await expect(page.getByRole('main').getByRole('button', { name: b, exact: true }).or(page.getByRole('main').getByRole('link', { name: b, exact: true }))).toBeVisible()
  await expect(page.getByRole('link', { name: 'Préparer la visite' })).toBeVisible()
  expect(await sansDebordement(page.locator('body'))).toBe(true)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-profil.png`, fullPage: true })
  await page.getByRole('tab', { name: 'Fiche' }).click()
  await expect(page).toHaveURL(/vue=fiche/)
})

test('Santé > Chiffres en lignes, tableau au choix sur PC, magasins sans chiffres repliés', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/plus/sante?vue=chiffres')
  const lignes = page.getByRole('region', { name: 'Chiffres des magasins' })
  const lyon = lignes.getByRole('link', { name: /Lyon Test/ })
  await expect(lyon).toContainText('70 k€')
  await expect(lyon).toContainText('−30,0 %')
  await expect(page.getByRole('table')).toHaveCount(0)
  const replies = lignes.getByRole('button', { name: 'Voir les magasins sans chiffres' })
  if (await replies.count()) {
    await replies.click()
    await expect(lignes.getByRole('button', { name: 'Replier les magasins sans chiffres' })).toBeVisible()
  }
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-chiffres-lignes.png`, fullPage: !isMobile })
  if (isMobile) {
    await expect(page.getByRole('group', { name: 'Affichage' })).toHaveCount(0)
    return
  }
  await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Tableau' }).click()
  await expect(page.getByRole('table', { name: 'Chiffres des magasins' })).toBeVisible()
  // Le choix est gardé
  await page.reload()
  await expect(page.getByRole('table', { name: 'Chiffres des magasins' })).toBeVisible()
})

test('J’aime sur une bonne pratique, enregistré sans perdre le reste', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  const pratiques = [{ id: 'bp_1', magasin: 'Annecy Test', date: '2026-09-12', titre: 'Dégustation du samedi', theme: 'Animation et événements', texte: 'Trois vins ouverts chaque samedi.', par: 'Hugo FICTIF', photos: [], reprises: ['Nantes Test'], jaime: ['Noé MODELE'] }]
  await seConnecter(page, { ecritures, persister: true, config: { bonnes_pratiques: pratiques } })
  await page.goto('./#/visites?vue=pratiques')
  const carte = page.getByRole('article', { name: 'Dégustation du samedi' })
  const jaime = carte.getByRole('button', { name: /J’aime/ })
  await expect(jaime).toHaveText('J’aime · 1')
  await expect(jaime).toHaveAttribute('aria-pressed', 'false')
  await jaime.click()
  await expect(jaime).toHaveText('J’aime · 2')
  await expect(jaime).toHaveAttribute('aria-pressed', 'true')
  const ecrites = () => ecritures.filter((x) => x.table === 'app_config' && (x.filtre.includes('key=eq.bonnes_pratiques') || (x.corps as { key?: string }).key === 'bonnes_pratiques'))
  await expect.poll(() => ecrites().length).toBeGreaterThan(0)
  const e = ecrites().at(-1)!
  const liste = JSON.parse((e.corps as { value: string }).value)
  expect(liste[0]).toEqual(expect.objectContaining({ id: 'bp_1', reprises: ['Nantes Test'], jaime: ['Noé MODELE', DIRECTEUR] }))
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-pratique-jaime.png` })
})

test('glisser une tâche vers la gauche la marque faite (téléphone)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Le glisser se fait au doigt')
  const ecritures: Ecriture[] = []
  const actions = { 'Brest Test': [{ id: 'l1', action: 'Commander la nouvelle PLV', porteur: DIRECTEUR, echeance: '2026-10-01', creeLe: '2026-09-25' }] }
  await seConnecter(page, { ecritures, persister: true, config: { actions } })
  await page.goto('./#/taches')
  const texte = page.getByText('Commander la nouvelle PLV')
  await expect(texte).toBeVisible()
  const b = (await texte.boundingBox())!
  const y = b.y + b.height / 2
  const x0 = b.x + b.width - 10
  const evt = (type: string, x: number) => texte.dispatchEvent(type, { pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: x, clientY: y, bubbles: true })
  await evt('pointerdown', x0)
  for (const dx of [20, 60, 100, 140]) await evt('pointermove', x0 - dx)
  await evt('pointerup', x0 - 140)
  await expect.poll(() => ecritures.some((e) => e.table === 'app_config' && JSON.stringify(e.corps).includes('"faite\\":\\"'))).toBe(true)
})

// Appeler, Message et Visite en pictos à côté du nom, sur PC comme sur téléphone
for (const f of [
  { url: '/magasins/Nantes%20Test', nom: 'Nantes Test', etroit: true, pictos: ['Appeler', 'Écrire un message', 'Saisir une visite'] },
  { url: '/equipe/coach/In%C3%A8s%20EXEMPLE', nom: 'Inès EXEMPLE', pictos: ['Appeler', 'Écrire un message'] },
]) test(`pictos à côté du nom : ${f.nom}`, async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#' + f.url)
  const titre = page.getByRole('heading', { name: f.nom, level: 1 })
  await expect(titre).toBeVisible()
  const t = (await titre.boundingBox())!
  expect(t.width).toBeGreaterThanOrEqual(80)
  for (const nom of f.pictos) {
    const b = page.locator('main').getByLabel(nom, { exact: true }).first()
    await expect(b).toBeVisible()
    await expect(b).toHaveText('')
    const r = (await b.boundingBox())!
    expect(r.width).toBeGreaterThanOrEqual(48)
    expect(r.height).toBeGreaterThanOrEqual(48)
    // À droite du nom ; sur téléphone, juste sous le nom si la ligne est trop étroite
    if (!f.etroit || !isMobile) {
      expect(r.x).toBeGreaterThan(t.x + t.width - 1)
      expect(r.y).toBeLessThan(t.y + t.height)
    } else expect(r.y).toBeLessThan(t.y + t.height + 80)
  }
  expect(await sansDebordement(page.locator('body'))).toBe(true)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-pictos-${f.nom.split(' ')[0]}.png` })
})
