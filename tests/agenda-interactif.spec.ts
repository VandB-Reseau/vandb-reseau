import { expect, test, type Locator, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

// Agenda : ajouter depuis une case, glisser et étirer un événement, campagnes affichées (Joseph, 21/10/2026)
const plus = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const aujourdhui = new Date().toISOString().slice(0, 10)
const jourLong = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
// Séminaire fictif : demain et après-demain ; l'agenda s'ouvre sur son mois
const seminaire = plus(aujourdhui, 1)
const moisSeminaire = seminaire.slice(0, 7)
// Une date du même mois, quelques jours plus loin ou plus tôt selon la place
const voisin = (iso: string, n: number) => (Number(iso.slice(8)) > 15 ? plus(iso, -n) : plus(iso, n))
const campagnes = { liste: [{ id: 'cv', nom: 'Vitrine de Noël', debut: `${moisSeminaire}-01`, fin: `${moisSeminaire}-10`, points: [{ id: 'p1', libelle: 'Vitrine posée' }], perimetre: 'tous', magasins: [] }], constats: {} }

const ecrituresDe = (ecritures: Ecriture[], table: string, methode: string) => ecritures.filter((e) => e.table === table && e.methode === methode)
async function glisser(page: Page, depuis: { x: number; y: number }, vers: Locator) {
  const b = (await vers.boundingBox())!
  await page.mouse.move(depuis.x, depuis.y)
  await page.mouse.down()
  await page.mouse.move(depuis.x + 10, depuis.y, { steps: 3 })
  await page.mouse.move(b.x + b.width / 2, b.y + b.height - 12, { steps: 8 })
  await page.mouse.up()
}

test.describe('sur PC', () => {
  test.skip(({ isMobile }) => isMobile, 'Grille du mois sur PC')

  test('cliquer dans une case ajoute un événement à cette date', async ({ page }, info) => {
    const ecritures: Ecriture[] = []
    await seConnecter(page, { ecritures })
    await page.goto(`./#/plus/agenda?mois=${moisSeminaire}`)
    const jour = voisin(seminaire, 5)
    const case_ = page.getByRole('gridcell', { name: jourLong(jour), exact: true })
    const b = (await case_.boundingBox())!
    await page.mouse.click(b.x + b.width / 2, b.y + b.height - 6)
    const menu = page.getByRole('menu', { name: `Ajouter le ${jourLong(jour)}` })
    await expect(menu.getByRole('menuitem')).toHaveText(['Visite', 'Événement', 'Formation'])
    await page.screenshot({ path: `captures/${info.project.name}-agenda-ajout-case.png` })
    await menu.getByRole('menuitem', { name: 'Événement' }).click()
    const d = page.getByRole('dialog', { name: 'Ajouter un événement' })
    await expect(d.getByLabel('Du')).toHaveValue(jour)
    await expect(d.getByLabel('Au')).toHaveValue(jour)
    await d.getByLabel('Titre').fill('Réunion régionale')
    await d.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(d).toBeHidden()
    expect(ecrituresDe(ecritures, 'events', 'POST').at(-1)?.corps).toMatchObject({ title: 'Réunion régionale', start_date: jour, end_date: jour })

    // Le bouton de la case propose aussi une visite, planifiée à la date choisie
    await case_.hover()
    await case_.getByRole('button', { name: `Ajouter le ${jourLong(jour)}` }).click()
    await page.getByRole('menuitem', { name: 'Visite' }).click()
    await expect(page.getByRole('dialog').getByLabel('Date', { exact: true })).toHaveValue(jour)
  })

  test('glisser un événement change sa date, étirer change sa fin', async ({ page }, info) => {
    const ecritures: Ecriture[] = []
    // Tout le mois à l'écran : le pointeur reste sur la grille pendant le glisser
    await page.setViewportSize({ width: 1280, height: 1200 })
    await seConnecter(page, { ecritures })
    await page.goto(`./#/plus/agenda?mois=${moisSeminaire}`)
    const pastille = page.getByRole('gridcell', { name: jourLong(seminaire), exact: true }).getByRole('button', { name: 'Séminaire des Coachs' })
    const p = (await pastille.boundingBox())!
    const cible = voisin(seminaire, 3)
    await glisser(page, { x: p.x + 20, y: p.y + p.height / 2 }, page.getByRole('gridcell', { name: jourLong(cible), exact: true }))
    await expect(page.getByText(`Séminaire des Coachs : du ${jourLong(cible)} au ${jourLong(plus(cible, 1))}.`)).toBeVisible()
    expect(ecrituresDe(ecritures, 'events', 'PATCH').at(-1)?.corps).toMatchObject({ start_date: cible, end_date: plus(cible, 1) })
    // Aucun dialogue ouvert par le lâcher
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Le bord droit de la pastille du dernier jour étire l'événement
    await page.reload()
    const fin = plus(seminaire, 1)
    const derniere = page.getByRole('gridcell', { name: jourLong(fin), exact: true }).getByRole('button', { name: 'Séminaire des Coachs' })
    const q = (await derniere.boundingBox())!
    const nouvelleFin = Number(fin.slice(8)) > 24 ? fin : plus(fin, 3)
    await glisser(page, { x: q.x + q.width - 3, y: q.y + q.height / 2 }, page.getByRole('gridcell', { name: jourLong(nouvelleFin), exact: true }))
    if (nouvelleFin !== fin) expect(ecrituresDe(ecritures, 'events', 'PATCH').at(-1)?.corps).toMatchObject({ start_date: seminaire, end_date: nouvelleFin })
    await page.screenshot({ path: `captures/${info.project.name}-agenda-glisser.png` })

    // Un simple clic ouvre toujours l'événement
    await page.getByRole('gridcell', { name: jourLong(seminaire), exact: true }).getByRole('button', { name: 'Séminaire des Coachs' }).click()
    await expect(page.getByRole('dialog', { name: 'Modifier Séminaire des Coachs' })).toBeVisible()
  })

  test('les campagnes sont dans l’agenda', async ({ page }) => {
    await seConnecter(page, { config: { campagnes } })
    await page.goto(`./#/plus/agenda?mois=${moisSeminaire}`)
    const premier = page.getByRole('gridcell', { name: jourLong(`${moisSeminaire}-01`), exact: true })
    await expect(premier.getByRole('link', { name: 'Vitrine de Noël' })).toBeVisible()
    await expect(page.getByRole('gridcell', { name: jourLong(`${moisSeminaire}-11`), exact: true }).getByRole('link', { name: 'Vitrine de Noël' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Campagnes', pressed: true }).click()
    await expect(premier.getByRole('link', { name: 'Vitrine de Noël' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Campagnes', pressed: false }).click()
    await premier.getByRole('link', { name: 'Vitrine de Noël' }).click()
    await expect(page).toHaveURL(/vue=campagnes&campagne=cv/)
  })
})

test.describe('sur téléphone', () => {
  test.skip(({ isMobile }) => !isMobile, 'Liste des jours sur téléphone')

  test('ajouter depuis un jour et voir les campagnes', async ({ page }, info) => {
    const ecritures: Ecriture[] = []
    await seConnecter(page, { ecritures, config: { campagnes } })
    await page.goto(`./#/plus/agenda?mois=${moisSeminaire}`)
    await expect(page.getByRole('link', { name: /Vitrine de Noël/ })).toBeVisible()

    // Le bouton d'ajout du jour du séminaire propose visite et événement
    const bouton = page.getByRole('button', { name: `Ajouter le ${jourLong(seminaire)}` })
    expect((await bouton.boundingBox())!.height).toBeGreaterThanOrEqual(48)
    await bouton.click()
    await expect(page.getByRole('menuitem')).toHaveText(['Visite', 'Événement', 'Formation'])
    await page.getByRole('menuitem', { name: 'Événement' }).click()
    const d = page.getByRole('dialog', { name: 'Ajouter un événement' })
    await expect(d.getByLabel('Du')).toHaveValue(seminaire)
    await d.getByRole('button', { name: 'Annuler' }).click()

    // Toucher un jour libre de la bande propose d'y ajouter
    const libre = voisin(seminaire, 6)
    await page.getByRole('group', { name: 'Jours du mois' }).getByRole('button', { name: jourLong(libre), exact: true }).click()
    const menu = page.getByRole('menu', { name: `Ajouter le ${jourLong(libre)}` })
    for (const item of await menu.getByRole('menuitem').all()) expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(48)
    expect(await textesTropPetits(page)).toEqual([])
    await page.screenshot({ path: `captures/${info.project.name}-agenda-ajout-jour.png` })
    await menu.getByRole('menuitem', { name: 'Événement' }).click()
    await expect(page.getByRole('dialog', { name: 'Ajouter un événement' }).getByLabel('Du')).toHaveValue(libre)
  })
})
