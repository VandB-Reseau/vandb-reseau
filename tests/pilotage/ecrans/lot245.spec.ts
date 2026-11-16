import { expect, test } from '@playwright/test'
import { MAGASINS } from '../donnees-fictives'
import { allerVers, seConnecter, textesTropPetits, zonesTropPetites, type VenteSimulee } from './outils'

// 245 (Joseph, 16/11/2026) : mois de stock de chaque magasin dans la vue réseau. Données fictives uniquement.
const N = new Date().getFullYear()
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const vente = (magasin: string, a: number, m: number, univers: string, ca: number, marge: number): VenteSimulee =>
  ({ store_name: magasin, mois: mois(a, m), univers, famille: univers === 'bar' ? 'Fût' : 'Vin', ca_ht: ca, ca_ttc: ca * 1.2, marge_ht: marge })
// Janvier et février : 30 000 € de Cave et 20 000 € de Bar, marge 40 % ; pas d'an dernier complet
const reel: VenteSimulee[] = [1, 2].flatMap((m) => [vente(MAGASINS[0], N, m, 'cave', 30_000, 12_000), vente(MAGASINS[0], N, m, 'bar', 20_000, 8_000)])

test('vue réseau : le stock en mois d’achats face à sa cible', async ({ page, isMobile }) => {
  // Fin février : 60 000 € de stock ; achats d'un mois 50 000 × 60 % = 30 000 € : 2,0 mois
  // Cible : (36 000 × 2,5 + 24 000 × 1) ÷ 60 000 = 1,9 mois ; 2,0 dans la tolérance de 10 %
  await seConnecter(page, { reel, stocks: [{ store_name: MAGASINS[0], annee: N, mois: 2, cave: 50_000, bar: 10_000, exterieur: null }] })
  await allerVers(page, 'Suivi ')
  await page.getByRole('group', { name: 'Vue du classement' }).getByRole('button', { name: 'Stock' }).click()
  const tableau = page.getByRole('table', { name: `Réel ${N} par magasin` })
  const ligne = tableau.getByRole('row').filter({ hasText: MAGASINS[0] })
  await expect(ligne).toContainText('2,0 mois')
  await expect(ligne).toContainText('1,9 mois')
  await expect(ligne.getByTitle('dans la cible')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})
