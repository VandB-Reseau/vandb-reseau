import { expect, test, type Page } from '@playwright/test'
import { seConnecter } from './pilotage/ecrans/outils'

// 360 (Joseph, 18/11/2026) : aucune couleur vive hors de la charte V and B. Les teintes pâles (fonds) et les gris ne
// comptent pas ; toute couleur franche doit être proche d'une couleur de la charte (il aurait attrapé le bleu du Pilotage).
const CHARTE = ['#1d1d1b', '#312e2e', '#f8bb09', '#f7d802', '#ea6029', '#c24119', '#3a8f8d', '#307672', '#b84a1e']
const PAGES = ['./#/', './#/magasins', './#/magasins/Lyon%20Test', './#/magasins/Lyon%20Test?vue=historique', './#/magasins/Lyon%20Test?vue=ninebox',
  './#/plus/sante', './#/performance', './#/pilotage', './#/budgets', './#/visites', './#/taches', './#/equipe']

async function couleursHorsCharte(page: Page): Promise<string[]> {
  return page.evaluate((charte) => {
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
    const ref = charte.map(rgb)
    const hors = new Set<string>()
    const lire = (c: string) => { const m = c.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/); return m && (m[4] === undefined || Number(m[4]) > 0.5) ? [Number(m[1]), Number(m[2]), Number(m[3])] : null }
    const vive = ([r, g, b]: number[]) => { const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, l = (max + min) / 2; const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1)); return s > 0.35 && l > 0.15 && l < 0.75 }
    for (const el of document.querySelectorAll<HTMLElement>('main *')) {
      if (!el.offsetParent || el.closest('img, [data-blason], .blason')) continue
      const st = getComputedStyle(el)
      for (const c of [st.color, st.backgroundColor, st.fill === 'none' ? '' : st.fill]) {
        const v = c && lire(c)
        if (!v || !vive(v)) continue
        const proche = ref.some((r) => Math.hypot(r[0] - v[0], r[1] - v[1], r[2] - v[2]) < 48)
        if (!proche) hors.add(`${c} (${el.tagName.toLowerCase()} « ${(el.textContent ?? '').trim().slice(0, 24)} »)`)
      }
    }
    return [...hors]
  }, CHARTE)
}

test('360 : aucune couleur vive hors de la charte sur les écrans principaux', async ({ page }) => {
  await seConnecter(page)
  for (const adresse of PAGES) {
    await page.goto(adresse)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await page.waitForTimeout(400)
    expect(await couleursHorsCharte(page), adresse).toEqual([])
  }
})
