import { expect, test } from '@playwright/test'
import { seConnecter } from './supabase-simule'

// Historique de la fiche magasin (Joseph, 23/11/2026) : le picto PDF ouvre le compte rendu, la ligne d'une visite
// (ou son crayon) ouvre sa modification
test('Historique : le PDF ouvre le compte rendu, la visite se modifie depuis sa ligne', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test?vue=activite')
  const historique = page.getByRole('region', { name: 'Historique' })
  await historique.getByRole('button', { name: 'Ouvrir le compte rendu de Lyon Test' }).first().click()
  const cr = page.getByRole('dialog', { name: 'Compte rendu' })
  await expect(cr.getByRole('button', { name: 'PDF' })).toBeVisible()
  await cr.getByRole('button', { name: 'Fermer' }).click()
  await expect(cr).toBeHidden()
  await expect(page).toHaveURL(/vue=activite/)

  // Crayon de la ligne
  await historique.getByRole('button', { name: /^Modifier la visite du / }).first().click()
  const d = page.getByRole('dialog', { name: 'Modifier la visite de Lyon Test' })
  await expect(d).toBeVisible()
  await d.getByRole('button', { name: /Fermer|Annuler/ }).first().click()
  await expect(d).toBeHidden()

  // La ligne elle-même (sur PC le titre, sur téléphone toute la ligne)
  const conteneur = isMobile ? historique.getByRole('list', { name: 'Historique du magasin' }).getByRole('listitem') : historique.getByRole('row')
  await conteneur.filter({ has: page.getByText('Visite', { exact: true }) }).first().getByRole('button').first().click()
  await expect(d).toBeVisible()
})
