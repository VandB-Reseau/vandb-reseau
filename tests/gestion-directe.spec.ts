import { expect, test } from '@playwright/test'
import { construireReseau } from '../src/data/construction'
import { cleFiltreCoach, libelleSuivi, suiviEtRR } from '../src/data/charge'
import { affectationsFictives, coachsFictifs, configRRFictive, magasinsFictifs } from './donnees-fictives'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Metz Test n'a plus de Coach depuis janvier : Alex NORD (Responsable Régional) le gère en direct.
// C'est un choix d'organisation, jamais un « Sans Coach ».
const plusDeCoach = { store: 'Metz Test', cs: '', date: '2026-01-01', note: '', type: 'manual' }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('libellés : Coach, géré en direct, ou vraiment sans Coach', ({ isMobile }) => {
  test.skip(isMobile, 'logique pure, un seul passage')
  const reseau = construireReseau({
    magasins: magasinsFictifs, renommages: {}, surcharges: [{ store_name: 'Metz Test', rr: 'rr1' }],
    affectations: [...affectationsFictives, plusDeCoach, { store: 'Nantes Test', cs: '', date: '2026-01-01', note: '', type: 'manual' }] as never,
    configRR: configRRFictive, coachs: coachsFictifs, parametres: { prepDuration: 2, postDuration: 4 },
  }, '2026-10-14')
  const m = (nom: string) => reseau.magasins.find((x) => x.nom === nom)!
  expect(libelleSuivi(m('Metz Test'))).toBe('Géré en direct · Alex NORD')
  expect(suiviEtRR(m('Metz Test'))).toBe('Géré en direct · Alex NORD')
  expect(cleFiltreCoach(m('Metz Test'))).toBe('__direct__')
  expect(libelleSuivi(m('Nantes Test'))).toBe('Sans Coach')
  expect(cleFiltreCoach(m('Nantes Test'))).toBe('__aucun__')
  expect(suiviEtRR(m('Lyon Test'))).toBe('Noé MODELE · Sam SUD')
  // Avant janvier, Metz avait son Coach : pas de gestion directe à cette date
  expect(libelleSuivi(m('Metz Test'), 'Noé MODELE')).toBe('Noé MODELE')
})

test('un magasin géré en direct par son RR n’est signalé nulle part comme sans Coach', async ({ page, isMobile }, info) => {
  await seConnecter(page, { affectationsEnPlus: [plusDeCoach] })
  await expect(page.getByRole('region', { name: 'À traiter' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'À traiter' })).not.toContainText('Sans Coach')

  // Liste des magasins : le RR à la place du Coach, et son propre filtre
  await page.goto('./#/magasins')
  await page.getByLabel('Rechercher dans les magasins').fill('metz')
  await expect(page.getByText('Géré en direct · Alex NORD')).toBeVisible()
  await page.getByLabel('Rechercher dans les magasins').fill('')
  if (isMobile) await page.getByRole('button', { name: 'Filtres' }).click()
  await page.getByLabel('Filtre Coach').click()
  await expect(page.getByRole('menuitem', { name: /Géré en direct/ })).toContainText('1 magasins')
  await page.getByRole('menuitem', { name: /Géré en direct/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText('1 sur 30 magasins')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-gestion-directe-liste.png`, fullPage: !isMobile })

  // Organisation de l'équipe : pas d'alerte « magasin sans Coach »
  await page.goto('./#/equipe')
  await expect(page.getByText('Alex NORD').first()).toBeVisible()
  await expect(page.getByText(/magasins? sans Coach/)).toHaveCount(0)

  // Visites : la ligne de Metz porte le RR, pas « Sans Coach »
  await page.goto('./#/visites')
  await page.getByPlaceholder('Magasin, ville, Coach…').fill('metz')
  await expect(page.getByText(/Géré en direct · Alex NORD/).first()).toBeVisible()
  await expect(page.getByText('Sans Coach')).toHaveCount(0)
})
