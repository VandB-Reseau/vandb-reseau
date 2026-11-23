import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from '../donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule, type TicketsSimules, type VenteSimulee } from './outils'

// Vue d'ensemble de l'onglet Chiffres plus visuelle (Joseph, 23/11/2026, choix 1 à 5) : courbes sur les cartes, flèches
// d'écart, Fiche de visite sur la ligne de « Clôturer », part de l'atterrissage déjà faite, graphes de la page Chiffres.
const N = new Date().getFullYear()
const magasin: MagasinSimule = { magasin: MAGASINS[0], statut: 'valide', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }
// Janvier à avril : Cave 50 000 € HT par mois (marge 40 %), Bar 10 000 € (marge 60 %) ; l'an dernier Cave 45 000 €
const reel: VenteSimulee[] = [N, N - 1].flatMap((a) => [1, 2, 3, 4].flatMap((m) => [
  { store_name: MAGASINS[0], mois: `${a}-0${m}-01`, univers: 'cave', famille: 'Bière', ca_ht: a === N ? 50_000 : 45_000, ca_ttc: a === N ? 60_000 : 54_000, marge_ht: a === N ? 20_000 : 18_000 },
  ...(a === N ? [{ store_name: MAGASINS[0], mois: `${a}-0${m}-01`, univers: 'bar', famille: 'Fût', ca_ht: 10_000, ca_ttc: 12_000, marge_ht: 6_000 }] : []),
]))
const tickets: TicketsSimules[] = [N, N - 1].flatMap((a) => [1, 2, 3, 4].map((m) => ({ store_name: MAGASINS[0], mois: `${a}-0${m}-01`, univers: 'cave', tickets: 2_000 })))

test('vue d’ensemble : atterrissage en barre, CA par univers, 4 derniers mois, Fiche de visite à côté de Clôturer', async ({ page, isMobile }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  await seConnecter(page, { role: 'rr', magasins: [magasin], reel, tickets })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  const sante = page.getByRole('region', { name: 'Santé du magasin à fin avril' })
  await expect(sante.getByRole('progressbar', { name: `Part de l’atterrissage ${N} déjà faite` })).toBeVisible()
  await expect(sante).toContainText(/déjà fait/)
  // 240 000 € à fin avril : Cave 200 000 (83 %), Bar 40 000 (17 %)
  const univers = page.getByRole('region', { name: 'CA par univers' })
  await expect(univers).toContainText(/240\sk€/)
  await expect(univers).toContainText(/200\sk€/)
  await expect(univers).toContainText('83 %')
  await expect(univers).toContainText('17 %')
  const evolution = page.getByRole('region', { name: 'Évolution du CA' })
  await expect(evolution).toContainText(`4 derniers mois, face à ${N - 1}`)
  await expect(evolution.getByRole('img', { name: /4 derniers mois/ })).toContainText(/Avr\. : 60\sk€/)
  // La Fiche de visite est sur la ligne des puces, à côté de « Clôturer » : plus de ligne vide sous les puces
  const visite = page.getByRole('button', { name: 'Fiche de visite' })
  await expect(visite).toHaveCount(1)
  if (!isMobile) {
    const a = await page.getByRole('button', { name: /^Clôturer/ }).boundingBox()
    const b = await visite.boundingBox()
    expect(Math.abs((a?.y ?? 0) - (b?.y ?? 999))).toBeLessThan(4)
  }
  await visite.click()
  await expect(page.getByRole('dialog', { name: /Fiche de visite/ })).toBeVisible()
  await page.keyboard.press('Escape')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  expect(erreurs).toEqual([])
})
