import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

// Zones tactiles de 48 px au moins sur téléphone
async function petitesZones(page: import('@playwright/test').Page, selecteur: string) {
  return page.locator(selecteur).evaluateAll((els) => els.filter((e) => {
    const r = e.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && r.height < 47.5 && getComputedStyle(e).visibility !== 'hidden'
  }).map((e) => (e.textContent || e.getAttribute('aria-label') || '').trim()))
}

test('l’accueil met en tête les magasins qui décrochent, avec l’appel en retard', async ({ page }, info) => {
  await seConnecter(page)
  const bloc = page.getByRole('region', { name: 'Magasins qui décrochent' })
  await expect(bloc.getByRole('link', { name: 'Lyon Test' })).toBeVisible()
  await expect(bloc.getByText(/CA 3 mois −10,0 %/)).toBeVisible()
  await expect(bloc.getByText(/Appel en retard de \d+ j/)).toBeVisible()
  await expect(bloc.getByRole('link', { name: 'Nantes Test' })).toBeVisible()
  await expect(bloc.getByText('À surveiller')).toBeVisible()
  await expect(bloc.getByRole('link', { name: 'Annecy Test' })).toHaveCount(0)
  // Premier bloc de l'accueil
  await expect(page.getByRole('region').first()).toHaveAttribute('aria-label', 'Magasins qui décrochent')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-accueil-chiffres.png` })
})

test('la fiche magasin montre les chiffres, l’alerte et le graphique', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  const section = page.getByRole('heading', { name: 'Chiffres', exact: true }).locator('xpath=ancestor::div[contains(@class,"MuiCard-root")]')
  await expect(section.getByText('Décroche')).toBeVisible()
  await expect(section.getByText('Chiffres à fin septembre 2026')).toBeVisible()
  await expect(section.getByText('CA sur 3 mois sous −5 %')).toBeVisible()
  await expect(section.getByText('−10,0 %')).toBeVisible()
  await expect(section.getByText('42 %')).toBeVisible()
  await expect(section.getByRole('img', { name: /CA mensuel sur 12 mois/ })).toBeVisible()
  await expect(section.getByRole('button', { name: 'Saisir un appel' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await section.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `captures/${info.project.name}-fiche-chiffres.png`, fullPage: !isMobile })
  // Audit consolidé sur une autre fiche
  await page.goto('./#/magasins/Nantes%20Test')
  await expect(page.getByText('Conforme · 92 % · 10 mars 2026')).toBeVisible()
})

test('saisir un appel : il ne compte pas comme visite et arrête le retard', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Saisir un appel' }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await expect(d.getByLabel('Type')).toHaveText('Appel')
  // Pas de compte rendu ni de signature pour un appel
  await expect(d.getByText('Visite contractuelle, à faire signer')).toHaveCount(0)
  await d.getByLabel('Notes').fill('Point sur la baisse de septembre.')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const visite = ecritures.find((e) => e.table === 'visits')!
  expect(JSON.stringify(visite.corps)).toContain('"type":"appel"')
  expect(ecritures.some((e) => e.table === 'store_finance')).toBe(false)
  // Un appel déjà saisi ne compte pas dans le rythme de visite
  await page.goto('./#/magasins/Agen%20Test')
  await expect(page.getByText(/^0 visite sur \d+ en \d{4} · \d+ j de retard$/)).toBeVisible()
  await expect(page.getByText('Appel · Inès EXEMPLE').first()).toBeVisible()
})

test('saisir les chiffres du mois pendant une visite et noter un audit', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Annecy%20Test')
  await page.getByRole('button', { name: 'Saisir', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await d.getByLabel('Type').click()
  await page.getByRole('option', { name: 'Audit hygiène' }).click()
  await d.getByLabel('Résultat de l’audit').click()
  await page.getByRole('option', { name: 'Non conforme', exact: true }).click()
  await d.getByLabel('Score de l’audit (%)').fill('68')
  // Mois dernier pré-rempli avec les chiffres connus
  await expect(d.getByLabel('Mois')).toHaveText('septembre 2026')
  await expect(d.getByLabel('Panier moyen HT cave (€)')).toHaveValue('40')
  await expect(d.getByLabel('Flux cave')).toHaveValue('1400')
  await d.getByLabel('Flux cave').fill('1 500')
  await d.getByLabel('Flux bar').fill('abc')
  await expect(d.getByText('Nombre attendu')).toBeVisible()
  await expect(d.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await d.getByLabel('Flux bar').fill('2100')
  await d.getByLabel('CA marché extérieur (€)').fill('3 200')
  await d.getByLabel('Marge (%)').fill('41,5')
  // CA et flux calculés : 40 × 1 500 + 12 × 2 100
  const calcules = d.getByRole('group', { name: 'Chiffres calculés' })
  await expect(calcules).toContainText('60 000 €')
  await expect(calcules).toContainText('25 200 €')
  await expect(calcules).toContainText('85 200 €')
  await expect(calcules).toContainText('3 600')
  await calcules.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `captures/${test.info().project.name}-saisie-chiffres.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const chiffres = ecritures.find((e) => e.table === 'store_finance')!
  expect(chiffres.corps).toEqual([expect.objectContaining({
    store_name: 'Annecy Test', month: '2026-09-01', ca_ext: 3200, pm_cave: 40, flux_cave: 1500, pm_bar: 12, flux_bar: 2100,
    ca_cave: 60000, ca_bar: 25200, freq: 3600, panier: 23.67, marge: 41.5,
  })])
  const audit = ecritures.filter((e) => e.table === 'app_config').at(-1)!
  const valeur = JSON.parse((audit.corps as { value: string }).value)
  expect(valeur['Annecy Test']).toEqual([expect.objectContaining({ type: 'hygiene', conforme: false, score: 68 })])
  expect(valeur['Nantes Test']).toHaveLength(1)
})

test('l’onglet Chiffres donne les indicateurs et la liste des magasins', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/plus/sante?vue=chiffres')
  await expect(page.getByRole('tab', { name: 'Chiffres', selected: true })).toBeVisible()
  await expect(page.getByText(/Audits conformes : 1 sur 1/)).toBeVisible()
  await expect(page.getByText(/1 appel en retard/)).toBeVisible()
  if (!isMobile) {
    const table = page.getByRole('table', { name: 'Chiffres des magasins' })
    await expect(table.getByRole('row').nth(1)).toContainText('Lyon Test')
    await expect(table.getByRole('row').nth(2)).toContainText('Nantes Test')
  } else {
    await expect(page.getByRole('link', { name: /Lyon Test/ }).first()).toBeVisible()
    expect(await petitesZones(page, 'main a, main button')).toEqual([])
  }
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-sante-chiffres.png`, fullPage: !isMobile })
  // Filtre sur l'alerte
  await page.getByRole('button', { name: /Filtre Alerte/ }).click()
  await page.getByRole('menuitem', { name: /^OK/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('link', { name: /Lyon Test/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Annecy Test/ }).first()).toBeVisible()
})

test('importer l’export mensuel des chiffres', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Import sur PC')
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/plus/sante?vue=chiffres')
  await page.getByRole('button', { name: 'Importer Excel' }).click()
  const d = page.getByRole('dialog', { name: 'Importer les chiffres mensuels' })
  const csv = 'Magasin;Mois;CA marché extérieur;PM HT cave;Flux cave;PM HT bar;Flux bar;Marge %;CA cave N-1;CA cumulé\nV and B Brest Test;09/2026;1 500;40;1250;12,5;1600;43,2;48000;70000\nBrest Test;08/2026;;40;1200;;;;;\nInconnu Test;09/2026;1;1;1;1;1;1;1;1\n'
  await d.getByLabel('Fichier de chiffres à importer').setInputFiles({ name: 'export.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(d.getByText(/2 lignes prêtes à importer pour 1 magasin, d’août 2026 à septembre 2026/)).toBeVisible()
  await expect(d.getByText('Colonnes ignorées : CA cave N-1, CA cumulé.')).toBeVisible()
  await expect(d.getByText(/Magasins non trouvés \(1\) : Inconnu Test/)).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const lots = ecritures.filter((e) => e.table === 'store_finance').flatMap((e) => e.corps as Record<string, unknown>[])
  expect(lots).toEqual(expect.arrayContaining([
    expect.objectContaining({ store_name: 'Brest Test', month: '2026-09-01', ca_ext: 1500, pm_cave: 40, flux_cave: 1250, pm_bar: 12.5, flux_bar: 1600, marge: 43.2, ca_cave: 50000, ca_bar: 20000, freq: 2850, panier: 24.56 }),
    expect.objectContaining({ store_name: 'Brest Test', month: '2026-08-01', pm_cave: 40, flux_cave: 1200, ca_cave: 48000 }),
  ]))
  // Une colonne vide n'efface pas la valeur en base
  expect(lots.find((l) => l.month === '2026-08-01')).not.toHaveProperty('pm_bar')
})

test('régler les seuils de l’alerte et le délai d’appel', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/parametres/reglages')
  await expect(page.getByRole('heading', { name: 'Alerte sur les chiffres' })).toBeVisible()
  const decroche = page.getByLabel('Décroche : baisse du CA sur 3 mois (%)')
  await expect(decroche).toHaveValue('5')
  await decroche.fill('15')
  await page.getByLabel('À surveiller : baisse du CA sur 3 mois (%)').fill('12')
  await expect(page.getByText('Avec ces réglages, 0 magasin décrocherait (contre 1 actuellement).')).toBeVisible()
  await page.getByLabel('Délai pour appeler un magasin qui décroche (jours)').fill('3')
  await page.getByRole('button', { name: 'Enregistrer' }).nth(1).click()
  await expect(page.getByText('Alerte sur les chiffres enregistrée.')).toBeVisible()
  const params = ecritures.filter((e) => e.table === 'app_config').at(-1)!
  expect(JSON.parse((params.corps as { value: string }).value)).toEqual(expect.objectContaining({ seuilDecroche: 15, seuilSurveiller: 12, delaiAppel: 3, prepDuration: 2 }))
})
