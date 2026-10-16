import { readFileSync, writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import lireExcel from 'read-excel-file/node'
import ecrireExcel from 'write-excel-file/node'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

async function telecharger(page: Page, bouton: string) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: bouton }).click()])
  const chemin = test.info().outputPath(dl.suggestedFilename())
  await dl.saveAs(chemin)
  return { chemin, nom: dl.suggestedFilename() }
}

async function importer(page: Page, referentiel: string, fichier: string | { name: string; mimeType: string; buffer: Buffer }) {
  await page.getByRole('button', { name: `Importer ${referentiel}`, exact: true }).click()
  const d = page.getByRole('dialog', { name: `Importer : ${referentiel}` })
  // Fichier transmis par son contenu : le dossier des résultats porte le titre accentué du test
  const contenu = typeof fichier === 'string' ? { name: 'fichier.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: readFileSync(fichier) } : fichier
  await d.getByLabel(`Fichier ${referentiel} à importer`).setInputFiles(contenu)
  return d
}

const csv = (nom: string, texte: string) => ({ name: nom, mimeType: 'text/csv', buffer: Buffer.from(texte) })

test('exporter les magasins puis réimporter le fichier modifié', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/parametres/donnees')
  await expect(page.getByRole('heading', { level: 1, name: 'Import et export' })).toBeVisible()
  await expect(page.getByText('Aucune sauvegarde complète téléchargée')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-import-export.png`, fullPage: true })

  const { chemin, nom } = await telecharger(page, 'Exporter Magasins')
  expect(nom).toMatch(/^V and B - Magasins - \d{4}-\d{2}-\d{2}\.xlsx$/)
  const [feuille] = await lireExcel(readFileSync(chemin))
  expect(feuille.sheet).toBe('Magasins')
  const [entetes, ...lignes] = feuille.data as unknown[][]
  expect(entetes).toEqual(['Magasin', 'Code', 'Statut', 'Date d’ouverture', 'Adresse', 'Code postal', 'Ville', 'Département', 'Pays', 'Téléphone', 'Email'])
  expect(lignes).toHaveLength(30)
  const lyon = lignes.find((l) => l[0] === 'Lyon Test')!
  expect(lyon.slice(1, 3)).toEqual(['T100', 'Intégré'])
  expect(lyon[7]).toBe('69')

  // Fichier réimporté tel quel : rien ne change
  let d = await importer(page, 'Magasins', chemin)
  await expect(d.getByText('Aucun changement par rapport aux données de l’app (30 lignes identiques).')).toBeVisible()
  await expect(d.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await d.getByRole('button', { name: 'Annuler' }).click()

  // Un téléphone modifié, une cellule vidée (sans effet), un magasin retiré, un magasin ajouté, une ligne illisible
  lyon[9] = '04 99 99 99 99'
  const retire = lignes.splice(lignes.findIndex((l) => l[0] !== 'Lyon Test' && l[0] !== 'Nantes Test'), 1)[0][0] as string
  lignes.find((l) => l[0] === 'Nantes Test')![10] = null
  lignes.push(['Vierzon Test', 'T900', 'Franchisé', null, '1 place du Test', '18100', 'Vierzon', null, null, null, null])
  lignes.push(['Gap Test', null, 'Coopérative', null, null, null, null, null, null, null, null])
  const modifie = info.outputPath('magasins-modifies.xlsx')
  writeFileSync(modifie, Buffer.from(await (await ecrireExcel([entetes, ...lignes].map((l) => l.map((v) => (v === undefined ? null : v))) as never, { dateFormat: 'dd/mm/yyyy' } as never).toBuffer())))
  d = await importer(page, 'Magasins', modifie)
  await expect(d.getByText('1 ajout · 1 ligne modifiée · 1 suppression · 28 inchangées')).toBeVisible()
  await expect(d.getByText('1 ligne absente du fichier sera supprimée de l’app.')).toBeVisible()
  await expect(d.getByRole('list', { name: 'Changements' }).getByRole('listitem').first()).toContainText(`${retire}Suppression`)
  await expect(d.getByText('Ligne 32 : « Coopérative » non reconnu dans Statut')).toBeVisible()
  await expect(d.getByText('04 99 99 99 99')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-import-apercu.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  await expect(page.getByText('3 lignes mises à jour')).toBeVisible()

  const surcharges = ecritures.filter((e) => e.table === 'store_overrides' && e.methode !== 'DELETE')
  const surMagasin = (n: string) => surcharges.filter((e) => (e.corps as { store_name?: string }).store_name === n || e.filtre.includes(encodeURIComponent(n).replace(/%20/g, '+')) || e.filtre.includes(n))
  expect(surMagasin('Lyon Test')[0]?.corps).toEqual(expect.objectContaining({ tel: '04 99 99 99 99', franchise: false, code: 'T100' }))
  // L'email vidé dans le fichier est conservé
  expect(surMagasin('Nantes Test')).toEqual([])
  const ajout = ecritures.find((e) => e.table === 'app_config' && (e.corps as { value: string }).value?.includes('Vierzon Test'))
  expect(JSON.parse((ajout!.corps as { value: string }).value).at(-1)).toEqual(expect.objectContaining({ n: 'Vierzon Test', dept: '18', cp: '18100', franchise: true }))
  const supprimes = ecritures.find((e) => e.table === 'app_config' && (e.corps as { key?: string }).key === 'store_deletes' || e.filtre.includes('key=eq.store_deletes'))
  expect(JSON.parse((supprimes!.corps as { value: string }).value)).toContain(retire)
  // Seul le magasin retiré du fichier est supprimé
  expect(ecritures.filter((e) => e.table === 'store_overrides' && e.methode === 'DELETE').map((e) => decodeURIComponent(e.filtre.replace(/\+/g, ' ')))).toEqual([expect.stringContaining(retire)])
})

test('chiffres, Coach des magasins et Responsable Régional des Coachs depuis un CSV', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mêmes règles que sur PC')
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/parametres/donnees')

  // Un fichier partiel : les mois absents seraient supprimés, on s'arrête à l'aperçu
  let d = await importer(page, 'Chiffres mensuels', csv('chiffres.csv', 'Magasin;Mois;CA marché extérieur (€)\nV and B Lyon Test;09/2026;1 234,5\n'))
  await expect(d.getByText(/^1 ligne modifiée · \d+ suppressions$/)).toBeVisible()
  await expect(d.getByText(/lignes absentes du fichier seront supprimées de l’app/)).toBeVisible()
  await d.getByRole('button', { name: 'Annuler' }).click()

  // Fichier complet exporté, un chiffre modifié et un magasin inconnu
  const { chemin } = await telecharger(page, 'Exporter Chiffres mensuels')
  const [feuille] = await lireExcel(readFileSync(chemin))
  const [entetes, ...lignes] = feuille.data as unknown[][]
  const iCA = entetes.indexOf('CA marché extérieur (€)')
  const iMois = entetes.indexOf('Mois')
  const lyon = lignes.find((l) => l[0] === 'Lyon Test' && l[iMois] === '09/2026')!
  lyon[iCA] = '1 234,5'
  const texte = [entetes, ...lignes, ['Cave Inconnue', '09/2026']].map((l) => l.map((v) => (v === null || v === undefined ? '' : String(v))).join(';')).join('\n')
  d = await importer(page, 'Chiffres mensuels', csv('chiffres.csv', texte))
  await expect(d.getByText('1 ligne modifiée', { exact: false })).toBeVisible()
  await expect(d.getByText('suppression', { exact: false })).toHaveCount(0)
  await expect(d.getByText('1 234,5')).toBeVisible()
  await expect(d.getByText(`Ligne ${lignes.length + 2} : Cave Inconnue introuvable dans Magasin`)).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const chiffres = ecritures.filter((e) => e.table === 'store_finance').flatMap((e) => e.corps as Record<string, unknown>[])
  expect(chiffres).toEqual([expect.objectContaining({ store_name: 'Lyon Test', month: '2026-09-01', ca_ext: 1234.5 })])
  expect(ecritures.filter((e) => e.table === 'store_finance' && e.methode === 'DELETE')).toEqual([])

  d = await importer(page, 'Coach des magasins', csv('coachs.csv', 'Magasin;Coach;À partir du mois\nNantes Test;camille testard;11/2026\nRennes Test;Zorro;\nLyon Test;Noé MODELE;\n'))
  await expect(d.getByText('1 ligne modifiée · 1 inchangée')).toBeVisible()
  await expect(d.getByText('Ligne 3 : Zorro introuvable dans Coach')).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  expect(ecritures.find((e) => e.table === 'reassigns' && e.methode === 'POST')?.corps).toEqual(expect.objectContaining({ store: 'Nantes Test', cs: 'Camille TESTARD', date: '2026-11-01' }))

  d = await importer(page, 'Responsable Régional des Coachs', csv('rr.csv', 'Coach;Responsable Régional\nHugo FICTIF;Sam SUD\n'))
  await expect(d.getByText('1 ligne modifiée')).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const rr = ecritures.filter((e) => e.table === 'app_config').map((e) => (e.corps as { value: string }).value).find((v) => v.includes('dr_assigns'))!
  expect(JSON.parse(rr).dr_assigns.at(-1)).toEqual(expect.objectContaining({ cs: 'Hugo FICTIF', dr: 'rr2' }))

  // Colonne clé absente : rien n'est importé
  d = await importer(page, 'Visites', csv('autre.csv', 'Ville;Total\nLyon;3\n'))
  await expect(d.getByText('Colonnes introuvables : Magasin, Date', { exact: false }).or(d.getByText('introuvable', { exact: false }))).toBeVisible()
})

test('télécharger la sauvegarde complète et tous les référentiels', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mêmes fichiers que sur PC')
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, persister: true })
  await page.goto('./#/parametres/donnees')
  const { chemin, nom } = await telecharger(page, 'Télécharger la sauvegarde complète')
  expect(nom).toMatch(/^V and B - Sauvegarde complete - \d{4}-\d{2}-\d{2}\.json$/)
  const sauvegarde = JSON.parse(readFileSync(chemin, 'utf8'))
  expect(Object.keys(sauvegarde.tables)).toEqual(['app_config', 'store_overrides', 'reassigns', 'cs_overrides', 'recruits', 'visits', 'leaves', 'events', 'store_finance'])
  expect(sauvegarde.tables.visits.length).toBeGreaterThan(0)
  await expect(page.getByText(/^Dernière sauvegarde complète : /)).toBeVisible()

  const tous = await telecharger(page, 'Exporter tous les référentiels')
  expect(tous.nom).toMatch(/^V and B - Referentiels - \d{4}-\d{2}-\d{2}\.xlsx$/)
  const feuilles = await lireExcel(readFileSync(tous.chemin))
  expect(feuilles.map((f) => f.sheet)).toEqual(['Magasins', 'Franchisés', 'Coachs', 'Responsables Régionaux', 'Coach des magasins', 'RR des Coachs', 'Chiffres mensuels', 'Nine box', 'Déploiements', 'Visites'])
  // Le classeur complet sert aussi à l'import : la bonne feuille est retrouvée par son nom
  // Chaque référentiel réimporté tel quel : aucun changement
  for (const r of ['Magasins', 'Franchisés', 'Coachs', 'Responsables Régionaux', 'Coach des magasins', 'Responsable Régional des Coachs', 'Chiffres mensuels', 'Nine box', 'Déploiements', 'Visites']) {
    const d = await importer(page, r, tous.chemin)
    await expect(d.getByText('Aucun changement par rapport aux données de l’app', { exact: false }), r).toBeVisible()
    await expect(d.getByText('laissée', { exact: false }), r).toHaveCount(0)
    await d.getByRole('button', { name: 'Annuler' }).click()
  }
})
