import { expect, test } from '@playwright/test'
import { PNG, seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const photo = { name: 'terrasse.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') }

const pratiques = [
  { id: 'bp_1', magasin: 'Annecy Test', date: '2026-09-12', titre: 'Dégustation du samedi', theme: 'Animation et événements', texte: 'Trois vins ouverts chaque samedi après-midi.', par: 'Hugo FICTIF', photos: [{ chemin: 'pratiques/a.jpg', taille: 180000 }], reprises: ['Nantes Test'] },
  { id: 'bp_2', magasin: 'Lyon Test', date: '2026-08-02', titre: 'Carte fidélité proposée à chaque passage', theme: 'Fidélité', texte: '', par: '', photos: [], reprises: [] },
]

test('ajouter des photos à une visite terrain', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Annecy%20Test?vue=visites')
  await page.getByRole('button', { name: 'Saisir', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  const zone = d.getByRole('region', { name: 'Photos' })
  await d.getByTestId('photos-libres').setInputFiles([photo, { ...photo, name: 'rayon.png' }])
  await expect(zone.getByRole('img', { name: 'Photo 2' })).toBeVisible()
  await zone.scrollIntoViewIfNeeded()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-visite-photos.png` })
  await zone.getByRole('button', { name: 'Retirer la photo 1' }).click()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const ligne = (ecritures.find((e) => e.table === 'visits')!.corps as Record<string, unknown>[])[0]
  const docs = ligne.docs as { chemin?: string; taille?: number }[]
  expect(docs.filter((x) => x.chemin)).toHaveLength(1)
  expect(docs[0].taille).toBeGreaterThan(0)
  // La photo retirée avant l'enregistrement est effacée de l'espace photos
  expect(ecritures.filter((e) => e.table === 'storage' && e.methode === 'DELETE')).toHaveLength(1)
  if (isMobile) return
  // La fiche et le compte rendu montrent les photos d'une visite
  await page.goto('./#/magasins/Lyon%20Test?vue=visites')
  await expect(page.getByRole('img', { name: 'Photo 1' }).first()).toBeVisible()
})

test('les bonnes pratiques : liste, filtre par thème, fiche magasin', async ({ page, isMobile }, info) => {
  await seConnecter(page, { config: { bonnes_pratiques: pratiques } })
  await page.goto('./#/echanges/pratiques')
  await expect(page.getByRole('heading', { name: 'Bonnes pratiques' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Publications de Bonnes pratiques' }).getByRole('article')).toHaveCount(2)
  const carte = page.getByRole('article', { name: 'Dégustation du samedi' })
  await expect(carte.getByText('Trois vins ouverts chaque samedi après-midi.')).toBeVisible()
  await expect(carte.getByRole('img', { name: 'Photo 1' })).toBeVisible()
  await expect(carte.getByRole('link', { name: 'Nantes Test' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-bonnes-pratiques.png`, fullPage: !isMobile })
  // Le filtre par thème est dans Infos réseau
  await page.goto('./#/infos')
  if (isMobile) await page.getByRole('tab', { name: 'Bonnes pratiques' }).click()
  if (isMobile) await page.getByRole('button', { name: /^Filtres/ }).click()
  await page.getByRole('button', { name: 'Filtre Thème' }).click()
  await page.getByRole('menuitem', { name: 'Fidélité' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: 'Bonnes pratiques' }).getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('article', { name: 'Dégustation du samedi' })).toHaveCount(0)
  // Fiche du magasin qui l'a reprise
  await page.goto('./#/magasins/Nantes%20Test?vue=journal')
  const section = page.getByRole('heading', { name: 'Bonnes pratiques' }).locator('xpath=ancestor::div[contains(@class,"MuiCard-root")]')
  await expect(section.getByText('Reprises d’autres magasins')).toBeVisible()
  await expect(section.getByRole('link', { name: 'Annecy Test' })).toBeVisible()
})

test('ajouter une bonne pratique avec une photo et un magasin qui la reprend', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, config: { bonnes_pratiques: pratiques } })
  await page.goto('./#/magasins/Lyon%20Test?vue=journal')
  await page.getByRole('button', { name: 'Ajouter une bonne pratique' }).click()
  const d = page.getByRole('dialog', { name: 'Nouvelle bonne pratique' })
  await expect(d.getByRole('combobox', { name: 'Magasin' })).toHaveValue('Lyon Test')
  await expect(d.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await d.getByLabel('Titre').fill('Terrasse chauffée en hiver')
  await d.getByRole('combobox', { name: 'Thème' }).fill('Bar')
  await d.getByRole('textbox', { name: 'Ce que fait le magasin' }).fill('Quatre parasols chauffants, plaids à disposition.')
  await d.getByTestId('photos-libres').setInputFiles(photo)
  await expect(d.getByRole('img', { name: 'Photo 1' })).toBeVisible()
  await d.getByRole('combobox', { name: 'Reprise par' }).click()
  await page.getByRole('option', { name: 'Agen Test' }).click()
  await page.keyboard.press('Escape')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const ecrit = ecritures.filter((e) => e.table === 'app_config').at(-1)!
  const liste = JSON.parse((ecrit.corps as { value: string }).value)
  expect(liste).toHaveLength(3)
  expect(liste[0]).toEqual(expect.objectContaining({ magasin: 'Lyon Test', titre: 'Terrasse chauffée en hiver', theme: 'Bar', reprises: ['Agen Test'] }))
  expect(liste[0].photos).toHaveLength(1)
})

// Photo d'en-tête facultative (Joseph, 22/10/2026) : rangée avec les photos, en grand au-dessus du titre
test('une bonne pratique avec une photo d’en-tête, affichée en grand au-dessus du titre', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, config: { bonnes_pratiques: pratiques } })
  await page.goto('./#/echanges/pratiques')
  await page.getByRole('button', { name: 'Modifier la bonne pratique Carte fidélité proposée à chaque passage' }).click()
  const d = page.getByRole('dialog', { name: 'Modifier la bonne pratique' })
  await d.getByLabel('Photo d’en-tête').setInputFiles(photo)
  await expect(d.getByRole('img', { name: 'Photo d’en-tête' })).toBeVisible()
  await expect(d.getByRole('button', { name: 'Retirer la photo d’en-tête' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const ecrit = ecritures.filter((e) => e.table === 'app_config').at(-1)!
  const fidelite = (JSON.parse((ecrit.corps as { value: string }).value) as { id: string; entete: string; photos: { chemin: string }[] }[]).find((p) => p.id === 'bp_2')!
  expect(fidelite.photos).toHaveLength(1)
  expect(fidelite.entete).toBe(fidelite.photos[0].chemin)
})

test('la photo d’en-tête n’est pas répétée dans les vignettes', async ({ page }, info) => {
  const avecEntete = [{ ...pratiques[0], photos: [{ chemin: 'pratiques/entete.jpg', taille: 1 }, ...pratiques[0].photos], entete: 'pratiques/entete.jpg' }, pratiques[1]]
  await seConnecter(page, { config: { bonnes_pratiques: avecEntete } })
  await page.goto('./#/echanges/pratiques')
  const carte = page.getByRole('article', { name: 'Dégustation du samedi' })
  await expect(carte.getByRole('img', { name: 'Photo d’en-tête de Dégustation du samedi' })).toBeVisible()
  await expect(carte.getByRole('button', { name: /^Agrandir la photo/ })).toHaveCount(1)
  // En-tête entre l'auteur et le titre
  const image = (await carte.getByRole('img', { name: /^Photo d’en-tête/ }).boundingBox())!
  const titre = (await carte.getByRole('heading', { name: 'Dégustation du samedi' }).boundingBox())!
  expect(image.y + image.height).toBeLessThanOrEqual(titre.y)
  await page.screenshot({ path: `captures/${info.project.name}-pratique-entete.png` })
})
