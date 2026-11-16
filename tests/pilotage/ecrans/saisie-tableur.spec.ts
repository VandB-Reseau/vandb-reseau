import { expect, test } from '@playwright/test'
import { MAGASINS } from '../donnees-fictives'
import { ouvrir, seConnecter } from './outils'

// 233 (Joseph, 16/11/2026) : dans un tableau, on saisit comme dans un tableur. Une colonne copiée d'Excel se colle d'un
// coup ; Entrée descend, Maj + Entrée remonte. Données fictives.
test('233 : coller une colonne d’Excel remplit les lignes du dessous ; Entrée descend, Maj + Entrée remonte', async ({ page }) => {
  await seConnecter(page, { role: 'franchise' })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Frais')
  await page.getByRole('button', { name: 'Partir des lignes courantes' }).click()
  const loyer = page.getByLabel('Locations immobilières', { exact: true })
  const charges = page.getByLabel('Charges locatives', { exact: true })
  await loyer.evaluate((el) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', '48 000 €\r\n2 400,5\r\n')
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await expect(loyer).toHaveValue(/48\s?000/)
  await expect(charges).toHaveValue(/2\s?400,5/)
  await loyer.focus()
  await loyer.press('Enter')
  await expect(charges).toBeFocused()
  await charges.press('Shift+Enter')
  await expect(loyer).toBeFocused()
})
