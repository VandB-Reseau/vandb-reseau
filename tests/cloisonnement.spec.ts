import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, type OptionsSimulation, ouvrirInfos } from './supabase-simule'

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
    // Sur téléphone, les écrans hors de la barre du bas sont dans le menu du compte
    await page.getByRole('button', { name: 'Mon compte' }).click()
    await expect(page.getByRole('menuitem', { name: 'Agenda', exact: true })).toBeVisible()
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
  await expect(page.getByText('7 ouverts · 1 à venir')).toBeVisible()
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
  await expect(page.getByText(/^Tout le réseau : \d+ ouverts/)).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-coach-carte.png` })
  await expect((await ouvrirInfos(page, 'Bonnes pratiques')).getByRole('article')).toHaveCount(2)
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

test('le Directeur tient à jour dans la base le périmètre de chaque magasin', async ({ page }) => {
  const options: OptionsSimulation = {}
  await seConnecter(page, options)
  await expect.poll(() => options.perimetreRecu?.length).toBe(30)
  const ligne = (n: string) => options.perimetreRecu!.find((l) => l.magasin === n)
  expect(ligne('Rennes Test')).toEqual({ magasin: 'Rennes Test', coach: 'Noé MODELE', rrs: ['rr2'] })
  // Lyon : intégré, suivi aussi par le Responsable des intégrés ; Metz : géré en direct par Alex NORD
  expect(ligne('Lyon Test')!.rrs).toEqual(['rr2', 'rr3'])
  expect(ligne('Metz Test')!.rrs).toEqual(['rr1'])
})

test('un Coach ne l’envoie pas, et sa note de santé ne réécrit que la ligne de son magasin', async ({ page }) => {
  const ecritures: Ecriture[] = []
  const options: OptionsSimulation = { ...NOE, ecritures }
  await seConnecter(page, options)
  await page.goto('./#/plus/sante?vue=evaluer')
  await page.getByRole('combobox', { name: 'Rechercher un magasin ou un Coach' }).fill('Rennes')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Saisir Rennes Test' }).click()
  await page.getByRole('button', { name: 'Fort : CA marché extérieur de Rennes Test' }).click()
  await expect.poll(() => ecritures.filter((e) => e.table === 'suivi_magasins').length).toBe(1)
  const e = ecritures.find((x) => x.table === 'suivi_magasins')!
  expect((e.corps as { store_name: string; cle: string }[]).map((l) => [l.store_name, l.cle])).toEqual([['Rennes Test', 'sante']])
  expect(ecritures.filter((x) => x.table === 'app_config' && x.methode !== 'SUIVI')).toEqual([])
  expect(options.perimetreRecu).toBeUndefined()
})

test('tant que le script n’est pas passé, le suivi reste dans app_config', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, suiviEnConfig: true })
  await page.goto('./#/magasins/Lyon%20Test?vue=journal')
  await expect(page.getByText('Appel du franchisé : travaux de vitrine prévus.')).toBeVisible()
  await page.goto('./#/plus/sante?vue=evaluer')
  await page.getByRole('combobox', { name: 'Rechercher un magasin ou un Coach' }).fill('Rennes')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Saisir Rennes Test' }).click()
  await page.getByRole('button', { name: 'Fort : CA marché extérieur de Rennes Test' }).click()
  await expect.poll(() => ecritures.filter((e) => e.table === 'app_config' && (e.corps as { key?: string }).key !== 'derniere_sauvegarde').length).toBe(1)
  expect(ecritures.filter((e) => e.table === 'suivi_magasins')).toEqual([])
})
