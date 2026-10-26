import { expect, test, type Page } from '@playwright/test'
import { seConnecter, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const derniereSante = (ecritures: Ecriture[]) => {
  const e = ecritures.filter((x) => x.table === 'app_config' && JSON.stringify(x.corps).includes('historique')).at(-1)!
  return JSON.parse((e.corps as { value: string }).value)
}

// La santé se note dans Santé du parc (plus dans « Modifier la fiche », Joseph, 26/10/2026), à la date des changements choisie
async function noter(page: Page, ecritures: Ecriture[], isMobile: boolean, date: string, bouton: RegExp, vue = 'evaluer') {
  await page.goto(`./#/plus/sante?vue=${vue}`)
  await expect(page.getByRole('button', { name: 'Saisir Lyon Test' })).toBeVisible()
  if (isMobile && !(await page.getByLabel('Date des changements').isVisible())) await page.getByRole('button', { name: 'Filtres' }).click()
  await page.getByLabel('Date des changements').fill(date)
  await page.getByRole('button', { name: 'Saisir Lyon Test' }).click()
  const avant = ecritures.length
  const d = page.getByRole('dialog', { name: 'Lyon Test' })
  await d.getByRole('button', { name: bouton }).click()
  await expect.poll(() => ecritures.length).toBeGreaterThan(avant)
  await d.getByRole('button', { name: 'Fermer' }).click()
  await expect(d).toBeHidden()
}

test('changer le classement à une date choisie, un seul changement par jour', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await noter(page, ecritures, isMobile, '2026-08-15', /^Moyen : Gestion/)
  const v = derniereSante(ecritures)['Lyon Test']
  // Inséré à sa date entre les deux points existants, à partir des notes en place ce jour-là ; le classement actuel reste le plus récent
  expect(v.historique.map((p: { date: string; caseId: string }) => `${p.date} ${p.caseId}`)).toEqual(['2026-06-01 coeur', '2026-08-15 coeur', '2026-10-01 redressement'])
  expect(v.date).toBe('2026-10-01')
  expect(v.notes.gestion).toBeUndefined()
})

test('noter le même jour remplace la ligne du jour', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await noter(page, ecritures, isMobile, '2026-10-01', /^Fort : Gestion/)
  const v = derniereSante(ecritures)['Lyon Test']
  expect(v.historique.map((p: { date: string; caseId: string }) => `${p.date} ${p.caseId}`)).toEqual(['2026-06-01 coeur', '2026-10-01 diagnostic'])
  expect(v.notes.gestion).toBe(3)
})

test('la date des changements s’applique aux notes saisies dans Santé du parc', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/plus/sante?vue=evaluer')
  if (isMobile) await page.getByRole('button', { name: 'Filtres' }).click()
  await page.getByLabel('Date des changements').fill('2026-09-20')
  await page.getByRole('button', { name: 'Saisir Nantes Test' }).click()
  await page.getByRole('button', { name: 'Fort : CA marché extérieur de Nantes Test' }).click()
  await expect.poll(() => ecritures.filter((e) => e.table === 'app_config').length).toBeGreaterThan(0)
  expect(JSON.stringify(derniereSante(ecritures))).toContain('"date":"2026-09-20"')
})

test('l’import avec une colonne Date remplit l’historique, une ligne par jour', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Import réservé au PC')
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/parametres/donnees')
  await page.getByRole('button', { name: 'Importer Nine box', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Importer depuis Excel' })
  const csv = [
    'Magasin;Date;CA marché extérieur;Panier moyen cave;Niveau du franchisé;Terrasse',
    'Rennes Test;15/01/2026;Faible;Faible;Faible;Non',
    'Rennes Test;2026-05-10;Moyen;Moyen;Moyen;Oui',
    'Rennes Test;10/05/2026;Fort;Fort;Moyen;',
    'Annecy Test;01/03/2026;Faible;Faible;Fort;',
  ].join('\n')
  await page.getByRole('dialog', { name: 'Importer : Nine box' }).getByLabel('Fichier Nine box à importer').setInputFiles({ name: 'historique.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(d).toContainText('3 dates, du 15 janv. 2026 au 10 mai 2026, ajoutées à l’historique.')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const v = derniereSante(ecritures)
  // Deux lignes le même jour pour Rennes : la dernière remplace la première
  expect(v['Rennes Test'].historique.map((p: { date: string; caseId: string }) => `${p.date} ${p.caseId}`)).toEqual(['2026-01-15 redressement', '2026-05-10 grandir'])
  expect(v['Rennes Test'].notes).toMatchObject({ caExterieur: 3, panierCave: 3, franchise: 2 })
  // Annecy avait une note plus récente (1er oct.) : elle reste l'évaluation actuelle
  expect(v['Annecy Test'].date).toBe('2026-10-01')
  expect(v['Annecy Test'].historique.map((p: { date: string }) => p.date)).toEqual(['2026-03-01', '2026-10-01'])
  const deps = ecritures.filter((e) => e.table === 'app_config' && JSON.stringify(e.corps).includes('journal')).at(-1)!
  const dv = JSON.parse((deps.corps as { value: string }).value)
  expect(dv.journal['Rennes Test']).toEqual([{ date: '2026-01-15', thematique: 'terrasse', etat: 'Non' }, { date: '2026-05-10', thematique: 'terrasse', etat: 'Oui' }])
  expect(dv.valeurs['Rennes Test'].terrasse).toBe('Oui')
})

test('deux changements de case le même jour : le second remplace le premier, même après rechargement', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, persister: true })
  for (const note of ['Moyen', 'Fort']) await noter(page, ecritures, isMobile, '2026-10-14', new RegExp(`^${note} : Gestion`))
  const v = derniereSante(ecritures)['Lyon Test']
  expect(v.historique.map((p: { date: string; caseId: string }) => `${p.date} ${p.caseId}`)).toEqual(['2026-06-01 coeur', '2026-10-01 redressement', '2026-10-14 diagnostic'])
  await page.goto('./#/magasins/Lyon%20Test?vue=journal')
  await page.reload()
  const journal = page.getByRole('region', { name: 'Journal' })
  await expect(journal.getByText('Passe en Diagnostic marché')).toHaveCount(1)
  await expect(journal.getByText('Passe en Relance commerciale')).toHaveCount(0)
})

test('les doublons du même jour déjà enregistrés n’apparaissent qu’une fois et disparaissent à la saisie suivante', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  const notes = (r: number, f: number) => ({ caExterieur: r, panierCave: r, panierBar: r, fluxCave: r, fluxBar: r, franchise: f })
  // Saisies empilées par l'ancienne règle : trois cases le 1er octobre, la dernière est la bonne
  const config = {
    sante_parc: { 'Lyon Test': { notes: notes(1, 1), date: '2026-10-01', par: 'Dominique DIRECTION', historique: [
      { date: '2026-06-01', caseId: 'coeur', notes: notes(2, 2) },
      { date: '2026-10-01', caseId: 'renforcer', notes: notes(2, 1) },
      { date: '2026-10-01', caseId: 'locomotive', notes: notes(3, 3) },
      { date: '2026-10-01', caseId: 'redressement', notes: notes(1, 1) },
    ] } },
    deploiements: { valeurs: { 'Lyon Test': { concept20: 'Fait' } }, journal: { 'Lyon Test': [
      { date: '2026-05-04', thematique: 'concept20', etat: 'En cours' }, { date: '2026-05-04', thematique: 'concept20', etat: 'Fait' },
    ] } },
  }
  await seConnecter(page, { ecritures, config })
  await page.goto('./#/magasins/Lyon%20Test?vue=journal')
  const journal = page.getByRole('region', { name: 'Journal' })
  await expect(journal.getByText('Passe en Redressement urgent')).toHaveCount(1)
  await expect(journal.getByText(/Management à renforcer|Locomotive/)).toHaveCount(0)
  await expect(journal.getByText('Concept 2.0 : Fait')).toHaveCount(1)
  await expect(journal.getByText('Concept 2.0 : En cours')).toHaveCount(0)

  await noter(page, ecritures, isMobile, '2026-10-10', /^Moyen : Gestion/)
  const v = derniereSante(ecritures)['Lyon Test']
  expect(v.historique.map((p: { date: string; caseId: string }) => `${p.date} ${p.caseId}`)).toEqual(['2026-06-01 coeur', '2026-10-01 redressement', '2026-10-10 relance'])
})

test('supprimer un classement du journal : la saisie précédente redevient le classement en place', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Lyon%20Test?vue=journal')
  await page.getByRole('button', { name: /^Modifier le classement du 1 oct/ }).click()
  const d = page.getByRole('dialog', { name: /^Classement du 1 oct/ })
  await expect(d.getByRole('button', { name: /^Faible : CA marché extérieur/ })).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: `captures/suppression-ninebox/${test.info().project.name}-classement.png` })
  await d.getByRole('button', { name: 'Supprimer' }).click()
  await d.getByRole('alert').getByRole('button', { name: 'Supprimer' }).click()
  await expect(d).toBeHidden()
  const v = derniereSante(ecritures)['Lyon Test']
  expect(v.historique.map((p: { date: string; caseId: string }) => `${p.date} ${p.caseId}`)).toEqual(['2026-06-01 coeur'])
  expect(v.date).toBe('2026-06-01')
})

test('supprimer le seul classement d’un magasin le rend non classé', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Annecy%20Test?vue=journal')
  await page.getByRole('button', { name: /^Modifier le classement du 1 oct/ }).click()
  const d = page.getByRole('dialog', { name: /^Classement du 1 oct/ })
  await d.getByRole('button', { name: 'Supprimer' }).click()
  await d.getByRole('alert').getByRole('button', { name: 'Supprimer' }).click()
  await expect(d).toBeHidden()
  const v = derniereSante(ecritures)
  expect(v['Annecy Test']).toBeUndefined()
  expect(v['Lyon Test'].date).toBe('2026-10-01')
})

test('corriger les notes d’un classement passé depuis le journal', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Lyon%20Test?vue=journal')
  await page.getByRole('button', { name: /^Modifier le classement du 1 juin/ }).click()
  const d = page.getByRole('dialog', { name: /^Classement du 1 juin/ })
  await d.getByRole('button', { name: /^Fort : Gestion/ }).click()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const v = derniereSante(ecritures)['Lyon Test']
  expect(v.historique.find((p: { date: string }) => p.date === '2026-06-01').notes.gestion).toBe(3)
  expect(v.date).toBe('2026-10-01')
})

test('effacer toutes les notes nine box en une fois, avec une copie de sauvegarde', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/parametres/reglages?rubrique=ninebox')
  await page.getByRole('button', { name: 'Effacer toutes les notes' }).click()
  const d = page.getByRole('dialog', { name: 'Effacer toutes les notes ?' })
  await expect(d).toContainText('3 magasins')
  await page.screenshot({ path: `captures/suppression-ninebox/${test.info().project.name}-tout-effacer.png` })
  await d.getByRole('button', { name: 'Tout effacer' }).click()
  await expect(d).toBeHidden()
  const config = ecritures.filter((e) => e.table === 'app_config').map((e) => e.corps as { key?: string; value: string })
  expect(JSON.parse(config.at(-1)!.value)).toEqual({})
  expect(JSON.parse(config.at(-2)!.value)['Lyon Test'].date).toBe('2026-10-01')
})

test('un déploiement prend la date des changements choisie dans Santé du parc', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await noter(page, ecritures, isMobile, '2026-09-01', /^Oui : Offre 5\+1/, 'deploiements')
  const e = ecritures.filter((x) => x.table === 'app_config' && JSON.stringify(x.corps).includes('journal')).at(-1)!
  const dv = JSON.parse((e.corps as { value: string }).value)
  expect(dv.journal['Lyon Test']).toContainEqual({ date: '2026-09-01', thematique: 'offre5plus1', etat: 'Oui' })
})
