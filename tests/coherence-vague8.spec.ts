import { expect, test, type Page } from '@playwright/test'
import { seConnecter } from './supabase-simule'

// Vague 8 (95A) : un test de cohérence qui empêche les dérives. Sur les écrans principaux :
// toutes les tailles de texte sont sur l'échelle du thème (92A) et aucun bouton n'emploie un verbe retiré (101A).
const ECHELLE = [12, 13, 14, 16, 18, 20, 22, 26]
const PAGES = ['./#/', './#/magasins', './#/magasins/Lyon%20Test', './#/magasins/Lyon%20Test?vue=activite', './#/magasins/Lyon%20Test?vue=ninebox', './#/visites', './#/taches', './#/echanges', './#/infos', './#/plus/sante']

async function taillesHorsEchelle(page: Page): Promise<string[]> {
  return page.evaluate((echelle) => {
    const hors = new Set<string>()
    for (const el of document.querySelectorAll<HTMLElement>('main *')) {
      if (el.closest('svg, input, textarea, [aria-hidden="true"], .recharts-wrapper')) continue
      const texte = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent?.trim()).join('')
      if (!texte || !el.offsetParent) continue
      const px = Math.round(parseFloat(getComputedStyle(el).fontSize))
      if (!echelle.includes(px)) hors.add(`${px} px : ${texte.slice(0, 30)}`)
    }
    return [...hors]
  }, ECHELLE)
}

test('tailles de texte sur l’échelle et verbes fixes, écran par écran', async ({ page }) => {
  await seConnecter(page)
  for (const adresse of PAGES) {
    await page.goto(adresse)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    expect(await taillesHorsEchelle(page), adresse).toEqual([])
    const boutons = await page.getByRole('main').getByRole('button').allInnerTexts()
    expect(boutons.filter((b) => /^(Créer|Nouveau|Nouvelle|Effacer)\b/.test(b.trim())), adresse).toEqual([])
  }
})
