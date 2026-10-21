import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

// L8 (Joseph, 21/10/2026) : notifications sur le téléphone. Le navigateur de test n'a pas de service d'envoi :
// l'abonnement de l'appareil est simulé, la fonction Supabase « notifier » aussi.

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

async function appareilSimule(page: Page, permission: 'default' | 'denied' = 'default') {
  await page.addInitScript((p) => {
    let abonne: unknown = null
    const sub = { endpoint: 'https://push.exemple.test/appareil', toJSON: () => ({ endpoint: 'https://push.exemple.test/appareil', keys: { p256dh: 'cle', auth: 'secret' } }), unsubscribe: async () => { abonne = null; return true } }
    const reg = { pushManager: { getSubscription: async () => abonne, subscribe: async () => { abonne = sub; return sub } } }
    const n = { permission: p, requestPermission: async () => { n.permission = 'granted'; return 'granted' } }
    Object.defineProperty(window, 'Notification', { value: n, configurable: true })
    Object.defineProperty(window, 'PushManager', { value: function PushManager() {}, configurable: true })
    Object.defineProperty(navigator, 'serviceWorker', { value: { register: async () => reg, ready: Promise.resolve(reg), getRegistration: async () => reg }, configurable: true })
  }, permission)
}

async function fonctionSimulee(page: Page) {
  const appels: unknown[] = []
  await page.route('https://supabase.test/functions/v1/notifier', (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, body: 'ok' })
    const corps = r.request().postDataJSON()
    appels.push(corps)
    return r.fulfill({ json: corps.action === 'cle' ? { cle: 'BAAA' } : { envoyees: 1 } })
  })
  return appels
}

test('activer puis couper les notifications sur cet appareil depuis le menu du compte', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await appareilSimule(page)
  await seConnecter(page, { ecritures })
  const appels = await fonctionSimulee(page)
  await page.getByRole('button', { name: 'Mon compte' }).click()
  const activer = page.getByRole('menuitem', { name: 'Recevoir les notifications sur cet appareil' })
  expect((await activer.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-menu-notifications.png` })
  await activer.click()
  await expect(page.getByText('Notifications activées sur cet appareil.')).toBeVisible()
  expect(appels).toContainEqual({ action: 'cle' })
  expect(ecritures.find((e) => e.table === 'rpc/abonner_appareil')!.corps).toEqual({ p_endpoint: 'https://push.exemple.test/appareil', p_p256dh: 'cle', p_auth: 'secret' })

  await page.getByRole('button', { name: 'Mon compte' }).click()
  await page.getByRole('menuitem', { name: 'Couper les notifications sur cet appareil' }).click()
  await expect(page.getByText('Notifications coupées sur cet appareil.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'rpc/desabonner_appareil')!.corps).toEqual({ p_endpoint: 'https://push.exemple.test/appareil' })
})

test('notifications bloquées dans le navigateur : la ligne le dit, sans rien proposer', async ({ page }) => {
  await appareilSimule(page, 'denied')
  await seConnecter(page)
  await page.getByRole('button', { name: 'Mon compte' }).click()
  await expect(page.getByRole('menuitem', { name: 'Notifications bloquées sur cet appareil' })).toBeDisabled()
})

test('sans fonction d’envoi en place : message humain, rien d’enregistré', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await appareilSimule(page)
  await seConnecter(page, { ecritures })
  await page.route('https://supabase.test/functions/v1/notifier', (r) => r.fulfill({ status: 404, json: { message: 'Requested function was not found' } }))
  await page.getByRole('button', { name: 'Mon compte' }).click()
  await page.getByRole('menuitem', { name: 'Recevoir les notifications sur cet appareil' }).click()
  await expect(page.getByText('Les notifications ne sont pas encore disponibles. Réessaie plus tard.')).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'rpc/abonner_appareil')).toEqual([])
})

test('un message privé envoyé part aussi en notification vers le téléphone du destinataire', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, messagerie: { messages: [] } })
  const appels = await fonctionSimulee(page)
  await page.goto('./#/magasins/Annecy%20Test?vue=messages')
  await page.getByRole('radiogroup', { name: 'Écrire à' }).getByRole('radio', { name: /Hugo FICTIF/ }).click()
  await page.getByLabel('Message', { exact: true }).fill('Tu passes jeudi ?')
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect.poll(() => appels).toContainEqual({ type: 'message', ids: [1] })
})

test('navigateur sans notifications : rien dans le menu', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'PushManager', { value: undefined, configurable: true }); delete (window as { PushManager?: unknown }).PushManager })
  await seConnecter(page)
  await page.getByRole('button', { name: 'Mon compte' }).click()
  await expect(page.getByRole('menuitem', { name: 'Changer mon mot de passe' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /notifications/i })).toHaveCount(0)
})

test('une visite saisie part en notification vers le franchisé du magasin', async ({ page }) => {
  await seConnecter(page)
  const appels = await fonctionSimulee(page)
  await page.route('https://supabase.test/rest/v1/visits*', (r) => r.request().method() === 'POST' ? r.fulfill({ status: 201, json: [{ id: 42 }] }) : r.fallback())
  await page.goto('./#/visites')
  await page.getByRole('button', { name: 'Saisir une visite pour Lyon Test' }).click()
  await page.getByRole('dialog', { name: 'Saisir une visite' }).getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Visite enregistrée.')).toBeVisible()
  await expect.poll(() => appels).toContainEqual({ type: 'visite', ids: [42] })
})
