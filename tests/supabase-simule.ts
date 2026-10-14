import type { Page } from '@playwright/test'
import { affectationsFictives, coachsFictifs, congesFictifs, evenementsFictifs, recruesFictives, visitesFictives, configRRFictive, magasinsFictifs, santeFictive, deploiementsFictifs, fichesFictives } from './donnees-fictives'

export const COMPTE = { email: 'joseph@vandb.test', motDePasse: 'bon-mot-de-passe' }

// Simule l'API d'authentification Supabase : seul COMPTE est accepté.
export interface Ecriture { methode: string; table: string; corps: unknown; filtre: string }

export async function simulerSupabase(page: Page, options: { panne?: boolean; ecritures?: Ecriture[] } = {}) {
  await page.route('https://*.tile.openstreetmap.org/**', (r) => r.fulfill({ status: 204, body: '' }))
  await page.route('https://supabase.test/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      const corps = req.postDataJSON() as { email: string; password: string }
      if (corps.email !== COMPTE.email || corps.password !== COMPTE.motDePasse) {
        return route.fulfill({ status: 400, json: { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials', code: 'invalid_credentials' } })
      }
      const maintenant = Math.floor(Date.now() / 1000)
      return route.fulfill({
        json: {
          access_token: 'jeton-test', token_type: 'bearer', expires_in: 3600, expires_at: maintenant + 3600, refresh_token: 'rafraichissement-test',
          user: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: COMPTE.email, app_metadata: {}, user_metadata: {}, created_at: '2026-10-14T00:00:00Z' },
        },
      })
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' })
    if (options.panne && url.pathname.startsWith('/rest/')) return route.fulfill({ status: 500, json: { message: 'indisponible' } })
    const table = url.pathname.replace('/rest/v1/', '')
    if (req.method() !== 'GET' && req.method() !== 'HEAD') {
      options.ecritures?.push({ methode: req.method(), table, corps: req.postDataJSON(), filtre: url.search })
      return route.fulfill({ status: 201, json: [] })
    }
    // Filtres simples « colonne=eq.valeur » appliqués comme le ferait Supabase
    const filtrer = (lignes: Record<string, unknown>[]) => lignes.filter((l) => [...url.searchParams].every(([k, v]) => {
      if (v.startsWith('eq.')) return String(l[k]) === v.slice(3)
      // « in.(a,b) » : sans lui, une clé oubliée dans la liste chargée passerait inaperçue
      if (v.startsWith('in.(')) return v.slice(4, -1).split(',').map((x) => x.replace(/^"|"$/g, '')).includes(String(l[k]))
      return true
    }))
    if (table === 'app_config') {
      return route.fulfill({ json: filtrer([
        { key: 'store_adds', value: JSON.stringify(magasinsFictifs) },
        { key: 'drs_data', value: JSON.stringify(configRRFictive) },
        { key: 'sante_parc', value: JSON.stringify(santeFictive) },
        { key: 'deploiements', value: JSON.stringify(deploiementsFictifs) },
        { key: 'fiches_personnes', value: JSON.stringify(fichesFictives) },
        { key: 'params', value: JSON.stringify({ prepDuration: 2, postDuration: 4, directionHorizon: 6 }) },
      ]) })
    }
    if (table === 'store_overrides') return route.fulfill({ json: filtrer([{ store_name: 'Nice Test', resp: 'Responsable surchargé' }, { store_name: 'Metz Test', rr: 'rr1' }]) })
    if (table === 'reassigns') return route.fulfill({ json: affectationsFictives })
    if (table === 'cs_overrides') return route.fulfill({ json: filtrer(coachsFictifs) })
    if (table === 'visits') return route.fulfill({ json: filtrer(visitesFictives) })
    if (table === 'leaves') return route.fulfill({ json: filtrer(congesFictifs) })
    if (table === 'events') return route.fulfill({ json: filtrer(evenementsFictifs) })
    if (table === 'recruits') return route.fulfill({ json: filtrer(recruesFictives) })
    return route.fulfill({ json: [] })
  })
}

export async function seConnecter(page: Page, options: { panne?: boolean; ecritures?: Ecriture[] } = {}) {
  await simulerSupabase(page, options)
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1, name: /Bonjour|Bonsoir/ }).waitFor()
}

// Liste les textes visibles plus petits que min px
export async function textesTropPetits(page: Page, min = 12): Promise<string[]> {
  return page.evaluate((min) => {
    const fautifs: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const n = walker.currentNode
      const t = n.textContent?.trim()
      const el = n.parentElement
      if (!t || !el || el.closest('[role=img]')) continue // le logo est une image
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none') continue
      if (parseFloat(s.fontSize) < min) fautifs.push(`${t} (${s.fontSize})`)
    }
    return fautifs
  }, min)
}
