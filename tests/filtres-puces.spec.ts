import { expect, test, type Locator } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Joseph (14/11/2026) : dans l'Activité de la fiche magasin et les Actualités de l'accueil, « Tout », « Visites »…
// ressemblaient à des sous-onglets. Ce sont des filtres : puces cerclées, coche sur la puce active, picto filtre en tête.
async function verifierFiltres(groupe: Locator, actif: string) {
  await expect(groupe).toBeVisible()
  await expect(groupe.getByRole('tab')).toHaveCount(0)
  const bouton = groupe.getByRole('button', { name: actif, exact: true })
  await expect(bouton).toHaveAttribute('aria-pressed', 'true')
  await expect(bouton.locator('svg')).toHaveCount(1)
  const style = await bouton.locator('> span').evaluate((e) => { const s = getComputedStyle(e); return { bord: s.borderTopWidth, rayon: parseFloat(s.borderTopLeftRadius) } })
  expect(style.bord).toBe('1px')
  expect(style.rayon).toBeGreaterThanOrEqual(16)
  const autre = groupe.getByRole('button', { pressed: false }).first()
  expect(await autre.locator('> span').evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe('1px')
  for (const b of await groupe.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
}

test('fiche magasin : les filtres de l’Activité se lisent comme des filtres, pas comme des onglets', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test?vue=activite')
  const groupe = page.getByRole('group', { name: 'Filtrer l’activité' })
  await verifierFiltres(groupe, 'Tout')
  await groupe.getByRole('button', { name: 'Visites', exact: true }).click()
  await expect(groupe.getByRole('button', { name: 'Visites', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/fil=visites/)
  expect(await textesTropPetits(page)).toEqual([])
})

const pratiques = [
  { id: 'bp_1', magasin: 'Lyon Test', date: '2026-10-20', titre: 'Coffrets à composer', theme: 'Vente additionnelle', texte: 'Le client choisit trois bouteilles.', par: 'Hugo FICTIF', photos: [], reprises: [] },
]

// Sur téléphone, l'accueil montre trois publications sans filtre ; le fil complet et ses filtres sont dans la page Actualités (même composant)
test('accueil : les filtres des Actualités ont le même rendu', async ({ page, isMobile }) => {
  await seConnecter(page, { config: { bonnes_pratiques: pratiques }, reactionsVisites: { pouces: {}, commentaires: {} } })
  if (isMobile) await page.goto('./#/infos')
  const fil = page.getByRole('region', { name: isMobile ? 'Fil du réseau' : 'Actualités' })
  await verifierFiltres(fil.getByRole('group', { name: 'Filtrer le fil' }), 'Tout')
})

// Joseph (14/11/2026) : Simulateurs au même niveau que Chiffres et Budget dans la fiche magasin
test('fiche magasin : un onglet Simulateurs, et les anciens liens des chiffres y mènent', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test?vue=chiffres&partie=simulateurs')
  await expect(page).toHaveURL(/vue=simulateurs/)
  const onglets = page.getByRole('tablist', { name: 'Rubriques de Lyon Test' })
  if (!isMobile) await expect(onglets.getByRole('tab', { name: 'Simulateurs', selected: true })).toBeVisible()
  else await expect(onglets.getByRole('tab', { selected: true })).toHaveText('Simuler')
})
