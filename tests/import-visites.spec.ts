import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

// Classeur fictif : un onglet par Coach, un tableau de notes d'audit sous le tableau des visites
const fichier = new URL('./fichiers/suivi-visites-fictif.xlsx', import.meta.url).pathname

test('importer le classeur de suivi des visites et les notes d’audit', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/visites?vue=historique')
  if (isMobile) {
    await expect(page.getByRole('heading', { name: 'Visites' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Importer Excel' })).toHaveCount(0)
    return
  }
  await page.getByRole('button', { name: 'Importer Excel' }).click()
  const d = page.getByRole('dialog', { name: 'Importer des visites' })
  await d.getByLabel('Fichier de visites à importer').setInputFiles(fichier)
  await expect(d.getByText('5 visites à ajouter pour 3 magasins, de 2025 à 2026. 2 visites déjà dans l’app, laissées telles quelles.')).toBeVisible()
  await expect(d.getByText('2 notes d’audit : 1 hygiène, 1 excellence.')).toBeVisible()
  await expect(d.getByText('HUGO 2026 → Hugo FICTIF · 5')).toBeVisible()
  await expect(d.getByText('ZORRO 2026 → Zorro (hors équipe) · 2')).toBeVisible()
  await expect(d.getByText('GLOBAL', { exact: false })).toHaveCount(0)
  await expect(d.getByText('Magasins non trouvés (1) : CAVE INCONNUE')).toBeVisible()
  await expect(d.getByText('Dates non reconnues, laissées de côté (1) : Rennes Test : juin')).toBeVisible()
  await d.getByLabel('Date des audits').fill('2026-06-30')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: 'captures/pc-import-visites.png' })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  await expect(page.getByText('5 visites importées et 2 notes d’audit')).toBeVisible()

  const lignes = ecritures.filter((e) => e.table === 'visits' && e.methode === 'POST').flatMap((e) => e.corps as Record<string, unknown>[])
  expect(lignes).toHaveLength(5)
  expect(lignes).toEqual(expect.arrayContaining([
    expect.objectContaining({ store: 'Nantes Test', visit_date: '2025-11-06', type: 'terrain', visitor: 'Hugo FICTIF' }),
    // Même visite dans deux onglets : le Coach du magasin l'emporte ; le commentaire va sur la dernière visite
    expect.objectContaining({ store: 'Nantes Test', visit_date: '2026-05-19', visitor: 'Inès EXEMPLE', notes: '19.05.2026 - MAIL\nPoint stock' }),
    expect.objectContaining({ store: 'Lyon Test', visit_date: '2026-09-09', visitor: 'Hugo FICTIF', notes: 'Visio 9.09' }),
    expect.objectContaining({ store: 'Bordeaux Test', visit_date: '2026-02-03', visitor: 'Zorro' }),
    expect.objectContaining({ store: 'Bordeaux Test', visit_date: '2026-04-28', visitor: 'Zorro', notes: null }),
  ]))
  const audits = ecritures.filter((e) => e.table === 'app_config').at(-1)!
  const valeur = JSON.parse((audits.corps as { value: string }).value)
  // La note V2 (deuxième contrôle) remplace la V1 ; l'audit déjà saisi est conservé
  expect(valeur['Nantes Test']).toEqual([
    { date: '2026-03-10', type: 'hygiene', conforme: true, score: 92 },
    { date: '2026-06-30', type: 'hygiene', conforme: null, score: 90.12 },
    { date: '2026-06-30', type: 'excellence', conforme: null, score: 75 },
  ])
})
