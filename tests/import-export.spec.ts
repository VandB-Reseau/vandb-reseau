import { readFileSync, writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import lireExcel from 'read-excel-file/node'
import ecrireExcel from 'write-excel-file/node'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'
import { magasinsFictifs } from './donnees-fictives'

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

// Situations, campagne avec constats et bonne pratique, pour que chaque feuille ait des lignes
const donneesCompletes = {
  surchargesMagasins: [{ store_name: 'Tours Test', situations: [{ date: '2026-12-01', type: 'travaux', fin: '2026-12-15', motif: 'Lifting' }, { date: '2018-07-15', type: 'franchise' }] }],
  config: {
    campagnes: {
      liste: [{ id: 'c1', nom: 'Beaujolais 2026', debut: '2026-11-01', fin: '2026-11-30', perimetre: 'tous', magasins: [], points: [{ id: 'p1', libelle: 'Vitrine Beaujolais' }, { id: 'p2', libelle: 'Dégustation' }] }],
      constats: { c1: { 'Lyon Test': { p1: { fait: true, date: '2026-11-03', par: 'Noé MODELE' } }, 'Annecy Test': { p2: { fait: false, date: '2026-11-04', par: 'Hugo FICTIF' } } } },
    },
    bonnes_pratiques: [{ id: 'bp1', magasin: 'Lyon Test', date: '2026-10-01', titre: 'Accord mets et vins', theme: 'Vente additionnelle', texte: 'Une suggestion par plateau.', par: 'Noé MODELE', photos: [], entete: '', reprises: ['Annecy Test'], jaime: [] }],
  },
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
  expect(entetes).toEqual(['Code magasin (clé)', 'Magasin', 'Statut', 'Date d’ouverture', 'Adresse', 'Code postal', 'Ville', 'Département', 'Pays', 'Téléphone', 'Email', 'Date d’implantation', 'Typologie', 'Zone de chalandise', 'Licence', 'Instagram'])
  expect(lignes).toHaveLength(30)
  const lyon = lignes.find((l) => l[1] === 'Lyon Test')!
  expect(lyon.slice(0, 3)).toEqual(['001', 'Lyon Test', 'Intégré'])
  expect(lyon[7]).toBe('69')

  // Fichier réimporté tel quel : rien ne change
  let d = await importer(page, 'Magasins', chemin)
  await expect(d.getByText('Aucun changement par rapport aux données de l’app (30 lignes identiques).')).toBeVisible()
  await expect(d.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await d.getByRole('button', { name: 'Annuler' }).click()

  // Un téléphone modifié, un magasin renommé (même code), une cellule vidée (sans effet), un magasin retiré,
  // un magasin ajouté sans code (code suivant), un autre avec un nom déjà pris, une ligne illisible
  lyon[9] = '04 99 99 99 99'
  lignes.find((l) => l[1] === 'Rennes Test')![1] = 'Rennes Centre Test'
  const retire = lignes.splice(lignes.findIndex((l) => l[1] !== 'Lyon Test' && l[1] !== 'Nantes Test'), 1)[0][1] as string
  lignes.find((l) => l[1] === 'Nantes Test')![10] = null
  lignes.push([null, 'Vierzon Test', 'Franchisé', null, '1 place du Test', '18100', 'Vierzon', null, null, null, null])
  lignes.push([null, 'Gap Test', 'Coopérative', null, null, null, null, null, null, null, null])
  lignes.push([null, 'Dax Test', 'Franchisé', null, null, null, null, null, null, null, null])
  const modifie = info.outputPath('magasins-modifies.xlsx')
  writeFileSync(modifie, Buffer.from(await (await ecrireExcel([entetes, ...lignes].map((l) => l.map((v) => (v === undefined ? null : v))) as never, { dateFormat: 'dd/mm/yyyy' } as never).toBuffer())))
  d = await importer(page, 'Magasins', modifie)
  await expect(d.getByText('1 ajout · 2 lignes modifiées · 27 inchangées')).toBeVisible()
  // Ligne absente du fichier : supprimée seulement sur demande
  await d.getByLabel('Supprimer la ligne absente du fichier').check()
  await expect(d.getByText('1 ajout · 2 lignes modifiées · 1 suppression · 27 inchangées')).toBeVisible()
  await expect(d.getByRole('list', { name: 'Changements' }).getByRole('listitem').first()).toContainText(`${retire}Suppression`)
  await expect(d.getByText('Ligne 32 : « Coopérative » non reconnu dans Statut')).toBeVisible()
  await expect(d.getByText('Ligne 33 : Dax Test existe déjà (code 028)')).toBeVisible()
  await expect(d.getByText('Rennes Centre Test')).toBeVisible()
  await expect(d.getByText('04 99 99 99 99')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-import-apercu.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  await expect(page.getByText('4 lignes mises à jour')).toBeVisible()

  const surcharges = ecritures.filter((e) => e.table === 'store_overrides' && e.methode !== 'DELETE')
  const surMagasin = (n: string) => surcharges.filter((e) => (e.corps as { store_name?: string }).store_name === n || e.filtre.includes(encodeURIComponent(n).replace(/%20/g, '+')) || e.filtre.includes(n))
  expect(surMagasin('Lyon Test')[0]?.corps).toEqual(expect.objectContaining({ tel: '04 99 99 99 99', franchise: false, code: '001' }))
  // Renommé : son code reste, son nom change partout
  expect(ecritures.find((e) => e.table === 'reassigns' && e.methode === 'PATCH' && (e.corps as { store?: string }).store === 'Rennes Centre Test')).toBeTruthy()
  // L'email vidé dans le fichier est conservé
  expect(surMagasin('Nantes Test')).toEqual([])
  const ajout = ecritures.find((e) => e.table === 'app_config' && (e.corps as { value: string }).value?.includes('Vierzon Test'))
  expect(JSON.parse((ajout!.corps as { value: string }).value).at(-1)).toEqual(expect.objectContaining({ n: 'Vierzon Test', code: '031', dept: '18', cp: '18100', franchise: true }))
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

  // Un fichier qui n'est pas un export de l'app (pas de colonne « (clé) ») : lu comme l'export mensuel des chiffres,
  // il ajoute ou complète des mois sans rien supprimer (Joseph, 22/10/2026)
  await importer(page, 'Chiffres mensuels', csv('chiffres.csv', 'Magasin;Mois;CA marché extérieur (€)\nV and B Lyon Test;09/2026;1 234,5\n'))
  let d = page.getByRole('dialog', { name: 'Importer les chiffres mensuels' })
  await expect(d.getByText(/^1 ligne prête à importer pour 1 magasin/)).toBeVisible()
  await expect(d.getByText(/seront supprimées/)).toHaveCount(0)
  await d.getByRole('button', { name: 'Annuler' }).click()

  // Fichier complet exporté, un chiffre modifié et un magasin inconnu
  const { chemin } = await telecharger(page, 'Exporter Chiffres mensuels')
  const [feuille] = await lireExcel(readFileSync(chemin))
  const [entetes, ...lignes] = feuille.data as unknown[][]
  const iCA = entetes.indexOf('CA marché extérieur (€)')
  expect(entetes.slice(0, 3)).toEqual(['Code magasin (clé)', 'Magasin', 'Mois (clé)'])
  const iMois = entetes.indexOf('Mois (clé)')
  const lyon = lignes.find((l) => l[1] === 'Lyon Test' && l[iMois] === '09/2026')!
  lyon[iCA] = '1 234,5'
  const texte = [entetes, ...lignes, ['999', 'Cave Inconnue', '09/2026']].map((l) => l.map((v) => (v === null || v === undefined ? '' : String(v))).join(';')).join('\n')
  d = await importer(page, 'Chiffres mensuels', csv('chiffres.csv', texte))
  await expect(d.getByText('1 ligne modifiée', { exact: false })).toBeVisible()
  await expect(d.getByText('suppression', { exact: false })).toHaveCount(0)
  await expect(d.getByText('1 234,5')).toBeVisible()
  await expect(d.getByText(`Ligne ${lignes.length + 2} : 999 introuvable dans Code magasin`)).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const chiffres = ecritures.filter((e) => e.table === 'store_finance').flatMap((e) => e.corps as Record<string, unknown>[])
  expect(chiffres).toEqual([expect.objectContaining({ store_name: 'Lyon Test', month: '2026-09-01', ca_ext: 1234.5 })])
  expect(ecritures.filter((e) => e.table === 'store_finance' && e.methode === 'DELETE')).toEqual([])

  // Historique : une ligne par changement de Coach ; un code tapé sans ses zéros est reconnu ; fichier partiel, rien supprimé
  d = await importer(page, 'Coach des magasins', csv('coachs.csv', 'Code magasin;À partir du mois;Coach\n3;11/2026;camille testard\n004;11/2026;Zorro\n001;06/2025;Noé MODELE\n'))
  await expect(d.getByText('1 ajout · 1 inchangée')).toBeVisible()
  await expect(d.getByText('Ligne 3 : Zorro introuvable dans Coach')).toBeVisible()
  await expect(d.getByLabel(/^Supprimer les \d+ lignes absentes du fichier$/)).not.toBeChecked()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  expect(ecritures.find((e) => e.table === 'reassigns' && e.methode === 'POST')?.corps).toEqual(expect.objectContaining({ store: 'Nantes Test', cs: 'Camille TESTARD', date: '2026-11-01' }))

  d = await importer(page, 'Responsable Régional des Coachs', csv('rr.csv', 'Coach;À partir du mois;Responsable Régional\nHugo FICTIF;11/2026;Sam SUD\n'))
  await expect(d.getByText(/^1 ajout/)).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const rr = ecritures.filter((e) => e.table === 'app_config').map((e) => (e.corps as { value: string }).value).find((v) => v.includes('dr_assigns'))!
  expect(JSON.parse(rr).dr_assigns.at(-1)).toEqual(expect.objectContaining({ cs: 'Hugo FICTIF', dr: 'rr2' }))

  // Colonne clé absente : rien n'est importé
  // (sans colonne « (clé) », le fichier est lu comme un classeur de visites : rien n'y est reconnu)
  await importer(page, 'Visites', csv('autre.csv', 'Ville;Total\nLyon;3\n'))
  d = page.getByRole('dialog', { name: 'Importer des visites' })
  await expect(d.getByText(/Aucune visite reconnue|ne peut pas être lu/)).toBeVisible()
  await expect(d.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
})

test('déploiements et nine box : une date par déploiement et par classement', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mêmes règles que sur PC')
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/parametres/donnees')

  const dep = await telecharger(page, 'Exporter Déploiements')
  const [fd] = await lireExcel(readFileSync(dep.chemin))
  const [ed, ...ld] = fd.data as unknown[][]
  expect(ed.slice(0, 6)).toEqual(['Code magasin (clé)', 'Magasin', 'Concept 2.0', 'Concept 2.0 : date', 'Terrasse', 'Terrasse : date'])
  expect(ld).toHaveLength(30)
  const col = (e: string) => ed.indexOf(e)
  const lyon = ld.find((l) => l[1] === 'Lyon Test')!, annecy = ld.find((l) => l[1] === 'Annecy Test')!
  expect([lyon[2], lyon[3], lyon[4], lyon[5]]).toEqual(['Fait', new Date(Date.UTC(2026, 4, 4)), 'Oui', null])
  // Nouvel état sans date : daté du jour ; date seule plus ancienne : l'état remonte à cette date ; date plus récente : refusée
  annecy[2] = 'Fait'
  lyon[5] = '01/03/2026'
  const texte = (lignes: unknown[][]) => lignes.map((l) => l.map((v) => (v instanceof Date ? v.toISOString().slice(0, 10).split('-').reverse().join('/') : v ?? '')).join(';')).join('\n')
  let d = await importer(page, 'Déploiements', csv('dep.csv', texte([ed, ...ld])))
  await expect(d.getByText(/^2 lignes modifiées · 28 inchangées$/)).toBeVisible()
  await d.getByRole('button', { name: 'Annuler' }).click()
  const plusTard = ld.map((l) => [...l])
  plusTard.find((l) => l[1] === 'Lyon Test')![col('Concept 2.0 : date')] = '01/09/2026'
  d = await importer(page, 'Déploiements', csv('dep.csv', texte([ed, ...plusTard])))
  await expect(d.getByText(/Concept 2.0 : date plus récente que celle en place/)).toBeVisible()
  await d.getByRole('button', { name: 'Annuler' }).click()
  d = await importer(page, 'Déploiements', csv('dep.csv', texte([ed, ...ld])))
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const journal = JSON.parse((ecritures.filter((e) => e.table === 'app_config').at(-1)!.corps as { value: string }).value).journal
  const jour = new Date().toISOString().slice(0, 10)
  expect(journal['Annecy Test']).toEqual([{ date: jour, thematique: 'concept20', etat: 'Fait' }])
  expect(journal['Lyon Test']).toContainEqual({ date: '2026-03-01', thematique: 'terrasse', etat: 'Oui' })

  const nb = await telecharger(page, 'Exporter Nine box')
  const [fn] = await lireExcel(readFileSync(nb.chemin))
  const [en, ...ln] = fn.data as unknown[][]
  // Historique : une ligne par classement daté
  expect(en.slice(0, 3)).toEqual(['Code magasin (clé)', 'Magasin', 'Date du classement (clé)'])
  expect(ln.filter((l) => l[1] === 'Lyon Test').map((l) => l[2])).toContainEqual(new Date(Date.UTC(2026, 9, 1)))
  // Nouveau classement de Nantes daté du jour
  const nantes = [...ln.filter((l) => l[1] === 'Nantes Test').at(-1)!]
  nantes[2] = jour.split('-').reverse().join('/')
  nantes[en.indexOf('Flux cave')] = 'Fort'
  d = await importer(page, 'Nine box', csv('nb.csv', texte([en, ...ln, nantes])))
  await expect(d.getByText(new RegExp(`^1 ajout · ${ln.length} inchangées$`))).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const sante = JSON.parse((ecritures.filter((e) => e.table === 'app_config').at(-1)!.corps as { value: string }).value)
  expect(sante['Nantes Test']).toEqual(expect.objectContaining({ date: jour, notes: expect.objectContaining({ fluxCave: 3, fluxBar: 2 }) }))
})

test('télécharger la sauvegarde complète et tous les référentiels', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mêmes fichiers que sur PC')
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, persister: true, ...donneesCompletes })
  await page.goto('./#/parametres/donnees')
  const { chemin, nom } = await telecharger(page, 'Télécharger la sauvegarde complète')
  expect(nom).toMatch(/^V and B - Sauvegarde complete - \d{4}-\d{2}-\d{2}\.json$/)
  const sauvegarde = JSON.parse(readFileSync(chemin, 'utf8'))
  expect(Object.keys(sauvegarde.tables)).toEqual(['app_config', 'suivi_magasins', 'fiches_personnes', 'store_overrides', 'reassigns', 'cs_overrides', 'recruits', 'visits', 'leaves', 'events', 'store_finance', 'campagnes_regions'])
  expect(sauvegarde.tables.visits.length).toBeGreaterThan(0)
  expect(sauvegarde.tables.fiches_personnes.length).toBeGreaterThan(0)
  await expect(page.getByText(/^Dernière sauvegarde complète : /)).toBeVisible()

  const tous = await telecharger(page, 'Tout exporter en Excel')
  expect(tous.nom).toMatch(/^V and B - Toutes les donnees - \d{4}-\d{2}-\d{2}\.xlsx$/)
  const feuilles = await lireExcel(readFileSync(tous.chemin))
  expect(feuilles.map((f) => f.sheet)).toEqual(['Magasins', 'Franchisés', 'Mandats', 'Coachs', 'Responsables Régionaux', 'Coach des magasins', 'RR des Coachs', 'Situations', 'Étapes d’ouverture', 'Chiffres mensuels', 'Nine box', 'Notes d’audit', 'Déploiements', 'Visites', 'Tâches', 'Journal', 'Campagnes', 'Constats', 'Agenda', 'Bonnes pratiques'])
  // Chaque feuille a des lignes à exporter dans le réseau fictif
  expect(feuilles.filter((f) => (f.data as unknown[][]).length < 2).map((f) => f.sheet)).toEqual([])
  // Le classeur complet sert aussi à l'import : la bonne feuille est retrouvée par son nom
  // Chaque jeu de données réimporté tel quel : aucun changement
  for (const r of ['Magasins', 'Franchisés', 'Mandats des franchisés', 'Coachs', 'Responsables Régionaux', 'Coach des magasins', 'Responsable Régional des Coachs', 'Situations des magasins', 'Étapes d’ouverture', 'Chiffres mensuels', 'Nine box', 'Notes d’audit', 'Déploiements', 'Visites', 'Tâches', 'Journal des magasins', 'Campagnes', 'Constats de campagne', 'Agenda', 'Bonnes pratiques']) {
    const d = await importer(page, r, tous.chemin)
    await expect(d.getByText('Aucun changement par rapport aux données de l’app', { exact: false }), r).toBeVisible()
    await expect(d.getByText('laissée', { exact: false }), r).toHaveCount(0)
    await d.getByRole('button', { name: 'Annuler' }).click()
  }
})

test('mouvements par N° et données datées par code magasin : visites, situations, tâches, journal, agenda', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mêmes règles que sur PC')
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/parametres/donnees')

  // Visite n° 1 déplacée au lendemain (même N° : son compte rendu reste), un appel ajouté sans N°
  const vis = await telecharger(page, 'Exporter Visites')
  const [fv] = await lireExcel(readFileSync(vis.chemin))
  const [ev, ...lv] = fv.data as unknown[][]
  expect(ev.slice(0, 5)).toEqual(['N° (clé)', 'Code magasin', 'Magasin', 'Date', 'Type'])
  const texte = (lignes: unknown[][]) => lignes.map((l) => l.map((v) => (v instanceof Date ? v.toISOString().slice(0, 10).split('-').reverse().join('/') : v ?? '')).join(';')).join('\n')
  lv.find((l) => l[0] === 1)![3] = '03/10/2026'
  lv.push([null, '002', null, '05/10/2026', 'Appel', 'Non', 'Noé MODELE', 'Point stock'])
  let d = await importer(page, 'Visites', csv('visites.csv', texte([ev, ...lv])))
  await expect(d.getByText(/^1 ajout · 1 ligne modifiée/)).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const maj = ecritures.find((e) => e.table === 'visits' && e.methode === 'PATCH')!
  expect(maj.filtre).toContain('id=eq.1')
  expect(maj.corps).toEqual(expect.objectContaining({ store: 'Lyon Test', visit_date: '2026-10-03', sections: ['', '', 'Tête de gondole à reprendre.', '', '', ''] }))
  expect((ecritures.find((e) => e.table === 'visits' && e.methode === 'POST')!.corps as Record<string, unknown>[])[0]).toEqual(expect.objectContaining({ store: 'Annecy Test', visit_date: '2026-10-05', type: 'appel' }))

  // Situation ajoutée par code + date + type
  d = await importer(page, 'Situations des magasins', csv('situations.csv', 'Code magasin;Date;Situation;Fin;Motif\n010;01/02/2027;Fermeture provisoire;15/02/2027;Travaux\n010;01/03/2027;Fermeture provisoire;15/02/2027;Erreur\n'))
  await expect(d.getByText(/^1 ajout$/)).toBeVisible()
  await expect(d.getByText('Ligne 3 : fin avant la date de début')).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const sit = ecritures.find((e) => e.table === 'store_overrides' && (e.corps as { situations?: unknown }).situations)!
  expect((sit.corps as { situations: unknown[] }).situations).toEqual([{ date: '2027-02-01', type: 'travaux', fin: '2027-02-15', motif: 'Travaux' }])

  // Étape d'ouverture d'un magasin à venir : ligne exportée vide, remplie dans le fichier
  d = await importer(page, 'Étapes d’ouverture', csv('etapes.csv', 'Code magasin;Étape;Prévue le\n030;Travaux;01/12/2026\n'))
  await expect(d.getByText(/^1 ajout$/)).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const ouv = ecritures.filter((e) => e.table === 'app_config').map((e) => (e.corps as { value?: string }).value ?? '').find((v) => v.includes('"travaux"'))!
  expect(JSON.parse(ouv)['Vichy Test'].etapes).toEqual({ travaux: { prevu: '2026-12-01', fait: '' } })

  // Tâche d'un plan d'action marquée faite par son N°
  const ta = await telecharger(page, 'Exporter Tâches')
  const [ft] = await lireExcel(readFileSync(ta.chemin))
  const [et, ...lt] = ft.data as unknown[][]
  expect(et.slice(0, 4)).toEqual(['N° (clé)', 'Code magasin', 'Magasin', 'Origine'])
  const vitrine = lt.find((l) => l[0] === 'V4-1')!
  expect(vitrine[5]).toBe('Refaire la vitrine')
  vitrine[et.indexOf('Faite le')] = '02/10/2026'
  d = await importer(page, 'Tâches', csv('taches.csv', texte([et, ...lt])))
  await expect(d.getByText(/^1 ligne modifiée/)).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const plan = ecritures.find((e) => e.table === 'visits' && e.methode === 'PATCH' && e.filtre.includes('id=eq.4'))!
  expect((plan.corps as { action_plan: { faite?: string }[] }).action_plan.map((a) => a.faite ?? '')).toEqual(['2026-10-02', '', '2026-09-24'])

  // Note du journal et événement de l'agenda ajoutés sans N°
  d = await importer(page, 'Journal des magasins', csv('journal.csv', 'N°;Code magasin;Date;Note\n;001;20/10/2026;Franchisé rappelé\n'))
  await expect(d.getByText(/^1 ajout/)).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const journal = ecritures.filter((e) => e.table === 'app_config').map((e) => (e.corps as { value?: string }).value ?? '').find((v) => v.includes('Franchisé rappelé'))!
  expect(JSON.parse(journal)['Lyon Test'].at(-1)).toEqual(expect.objectContaining({ date: '2026-10-20', texte: 'Franchisé rappelé', par: 'Dominique DIRECTION' }))
  d = await importer(page, 'Agenda', csv('agenda.csv', 'N°;Titre;Type;Début;Heure;Codes magasins invités\n;Réunion régionale;Réunion;12/12/2026;9h30;"001 ; 2"\n'))
  await expect(d.getByText(/^1 ajout/)).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  expect(ecritures.find((e) => e.table === 'events' && e.methode === 'POST')!.corps).toEqual(expect.objectContaining({ title: 'Réunion régionale', type: 'reunion', start_date: '2026-12-12', heure: '09:30', invites: ['Lyon Test', 'Annecy Test'] }))
})

test('code magasin à 3 chiffres posé une fois sur chaque magasin, par date d’ouverture', async ({ page, isMobile }) => {
  test.skip(isMobile, 'même règle que sur PC')
  const ecritures: Ecriture[] = []
  // Lyon a déjà son code : les autres prennent les suivants, la plus ancienne ouverture d'abord (Agen, avril 2018)
  const sansCodes = magasinsFictifs.map(({ code: _c, ...m }) => (m.n === 'Lyon Test' ? { ...m, code: '005' } : m))
  await seConnecter(page, { ecritures, config: { store_adds: sansCodes } })
  await expect.poll(() => ecritures.find((e) => e.table === 'app_config' && (e.corps as { value?: string }).value?.includes('"code":"006"'))).toBeTruthy()
  const ecrit = ecritures.find((e) => e.table === 'app_config' && (e.corps as { value?: string }).value?.includes('"code":"006"'))!
  const liste = JSON.parse((ecrit.corps as { value: string }).value) as { n: string; code: string }[]
  const code = (n: string) => liste.find((m) => m.n === n)?.code
  expect([code('Lyon Test'), code('Agen Test'), code('Caen Test')]).toEqual(['005', '006', '007'])
  expect(new Set(liste.map((m) => m.code)).size).toBe(30)
  expect(liste.every((m) => /^\d{3}$/.test(m.code))).toBe(true)
})
