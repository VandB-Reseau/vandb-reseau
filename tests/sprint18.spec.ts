import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, actionFiche } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('la fiche Coach s’ouvre sur son portefeuille comparé au réseau', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe/coach/In%C3%A8s%20EXEMPLE')
  await expect(page.getByRole('heading', { name: 'Inès EXEMPLE', level: 1 })).toBeVisible()
  await expect(page.getByRole('group', { name: 'En bref' })).toContainText('visites')
  await expect(page.getByRole('link', { name: 'Message' })).toBeVisible()
  const portefeuille = page.getByRole('region', { name: 'Portefeuille' })
  await expect(page.getByRole('heading', { name: 'Portefeuille comparé au réseau' })).toBeVisible()
  await expect(portefeuille).not.toContainText('Rythme de visite tenu')
  for (const l of ['En Décroche', 'Évolution du CA', 'Note d’audit moyenne', 'Nine box à surveiller']) await expect(portefeuille).toContainText(l)
  await expect(portefeuille).toContainText('réseau')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-coach-portefeuille.png`, fullPage: !isMobile })
})

test('la fiche RR est un profil avec portefeuille, Coachs, magasins et fiche', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe/rr/rr1')
  await expect(page.getByRole('heading', { name: 'Alex NORD', level: 1 })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Rubriques de Alex NORD' }).getByRole('tab')).toHaveText(isMobile ? ['Portefeuille', 'Revue', 'Coachs', 'Plus'] : ['Portefeuille', 'Revue', 'Coachs', 'Magasins', 'Fiche'])
  await expect(page.getByRole('region', { name: 'Portefeuille' })).toContainText('En Décroche')
  await page.screenshot({ path: `captures/${info.project.name}-fiche-rr-portefeuille.png`, fullPage: !isMobile })
})

test('l’onglet Portefeuilles de l’équipe compare chaque Coach au réseau', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe?vue=portefeuilles')
  const coachs = page.getByRole('region', { name: 'Coachs' })
  await expect(coachs.getByRole('link', { name: /^Inès EXEMPLE/ })).toBeVisible()
  await expect(coachs.getByRole('link', { name: /^Inès EXEMPLE/ })).toContainText(/\d+ visites?/)
  await expect(coachs.getByRole('link', { name: /^Inès EXEMPLE/ })).not.toContainText('rythme')
  await expect(page.getByRole('region', { name: 'Responsables Régionaux' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-equipe-portefeuilles.png`, fullPage: !isMobile })
  if (!isMobile) {
    await page.getByRole('button', { name: 'Tableau' }).click()
    await expect(page.getByRole('table', { name: 'Coachs' }).getByRole('row', { name: /^Réseau/ })).toBeVisible()
  }
})

test('un Coach arrive sur sa semaine, prépare et planifie un magasin pas vu depuis longtemps', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await page.addInitScript(() => { (window as unknown as { ouverts: string[] }).ouverts = []; window.open = (u?: string | URL) => { (window as unknown as { ouverts: string[] }).ouverts.push(String(u)); return null } })
  await seConnecter(page, { ecritures, appMetadata: { role: 'coach', coach: 'Inès EXEMPLE' } })
  await page.goto('./#/visites')
  await expect(page.getByRole('tab', { name: isMobile ? 'Semaine' : 'Ma semaine', selected: true })).toBeVisible()
  const aPlanifier = page.getByRole('region', { name: 'Visites à planifier' })
  const nantes = aPlanifier.getByRole('link', { name: 'Nantes Test', exact: true })
  await expect(nantes).toContainText(/Pas vu depuis \d+ j/)
  await expect(nantes).not.toContainText(/retard|due/)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-ma-semaine.png`, fullPage: !isMobile })
  await page.getByRole('button', { name: 'Planifier la visite de Nantes Test' }).click()
  const d = page.getByRole('dialog', { name: 'Visite de Nantes Test' })
  const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  await d.getByLabel('Date').fill(demain)
  await d.getByLabel('Heure').fill('09:30')
  await d.getByLabel('Notes de préparation').fill('Revoir la vitrine et le corner épicerie')
  await expect(d.getByRole('switch', { name: 'Ajouter à Google Agenda' })).toBeChecked()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-planifier-visite.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/^Visite planifiée le /)).toBeVisible()
  const visite = ecritures.find((e) => e.table === 'visits' && e.methode === 'POST')!
  expect((visite.corps as Record<string, unknown>[])[0]).toMatchObject({ store: 'Nantes Test', visitor: 'Inès EXEMPLE', visit_date: demain, notes: null })
  const prepa = ecritures.find((e) => e.table === 'suivi_magasins' && e.methode === 'POST')!
  expect((prepa.corps as Record<string, unknown>[])[0]).toMatchObject({ store_name: 'Nantes Test', cle: 'preparation', valeur: { notes: 'Revoir la vitrine et le corner épicerie', heure: '09:30', par: 'Inès EXEMPLE' } })
  const [lien] = await page.evaluate(() => (window as unknown as { ouverts: string[] }).ouverts)
  const url = new URL(lien)
  expect(url.host).toBe('calendar.google.com')
  expect(url.searchParams.get('text')).toBe('Visite Nantes Test')
  expect(url.searchParams.get('dates')).toBe(`${demain.replace(/-/g, '')}T093000/${demain.replace(/-/g, '')}T110000`)
  expect(url.searchParams.get('details')).toContain('Revoir la vitrine')
  expect(url.searchParams.get('details')).toContain('/preparer')
})

test('la tournée de la semaine se planifie le même jour, en un seul événement', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await page.addInitScript(() => { (window as unknown as { ouverts: string[] }).ouverts = []; window.open = (u?: string | URL) => { (window as unknown as { ouverts: string[] }).ouverts.push(String(u)); return null } })
  await seConnecter(page, { ecritures, appMetadata: { role: 'coach', coach: 'Inès EXEMPLE' } })
  await page.goto('./#/visites?vue=semaine')
  const n = await page.getByRole('region', { name: 'Visites à planifier' }).getByRole('button', { name: /^Planifier la visite de / }).count()
  test.skip(n < 2, 'une seule visite due')
  await page.getByRole('button', { name: 'Planifier la tournée' }).click()
  const d = page.getByRole('dialog', { name: `Tournée de ${n} magasins` })
  await d.getByRole('switch', { name: 'Ajouter à Google Agenda' }).click()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(`${n} visites planifiées le`, { exact: false })).toBeVisible()
  const visites = ecritures.find((e) => e.table === 'visits' && e.methode === 'POST')!.corps as Record<string, unknown>[]
  expect(visites).toHaveLength(n)
  expect(new Set(visites.map((v) => v.group_id)).size).toBe(1)
  expect(await page.evaluate(() => (window as unknown as { ouverts: string[] }).ouverts)).toEqual([])
})

test('un Coach planifie une visite en plus, même pour un magasin qui n’est pas dû', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await page.addInitScript(() => { window.open = () => null })
  await seConnecter(page, { ecritures, appMetadata: { role: 'coach', coach: 'Inès EXEMPLE' } })
  await page.goto('./#/visites?vue=semaine')
  await page.getByRole('button', { name: 'Planifier une visite' }).click()
  const d = page.getByRole('dialog', { name: 'Planifier une visite' })
  await expect(d.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await d.getByLabel('Magasins').click()
  const options = page.getByRole('option')
  const nom = (await options.last().textContent())!
  await options.last().click()
  await page.keyboard.press('Escape')
  await d.getByLabel(`Notes de préparation`).fill('Point sur la fidélité')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/^Visite planifiée le /)).toBeVisible()
  const visite = ecritures.find((e) => e.table === 'visits' && e.methode === 'POST')!
  expect((visite.corps as Record<string, unknown>[])[0]).toMatchObject({ store: nom, visitor: 'Inès EXEMPLE' })
})

test('la fiche magasin permet de planifier la visite', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await page.addInitScript(() => { window.open = () => null })
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Nantes%20Test')
  await actionFiche(page, 'Planifier la visite')
  const d = page.getByRole('dialog', { name: 'Visite de Nantes Test' })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/^Visite planifiée le /)).toBeVisible()
  expect(ecritures.some((e) => e.table === 'visits' && e.methode === 'POST')).toBe(true)
})

test('les notes de préparation figurent sur la fiche avant visite', async ({ page }) => {
  const jour = new Date().toISOString().slice(0, 10)
  await seConnecter(page, { config: { preparations_visites: { 'Nantes Test': { notes: 'Parler du corner épicerie', heure: '14:00', par: 'Inès EXEMPLE', maj: jour } } } })
  await page.goto('./#/magasins/Nantes%20Test/preparer')
  const bloc = page.getByRole('region', { name: 'Notes de préparation' })
  await expect(bloc).toContainText('Parler du corner épicerie')
  await expect(bloc).toContainText('Inès EXEMPLE')
})

test('le Directeur choisit le Coach dont il regarde la semaine', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/visites?vue=semaine')
  await page.getByRole('button', { name: 'Filtre Coach' }).click()
  await page.getByRole('menuitem', { name: 'Inès EXEMPLE' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: 'Visites à planifier' }).getByRole('link', { name: 'Nantes Test', exact: true })).toBeVisible()
})

test('l’agenda montre les visites', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/plus/agenda')
  await expect(page.getByRole('button', { name: 'Visites', pressed: true })).toBeVisible()
})
