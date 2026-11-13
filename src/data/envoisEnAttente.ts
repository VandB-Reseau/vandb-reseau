// Envois gardés sans réseau (choix 114) : ce que chaque création en attente fait au retour du réseau
import { enregistrerActionLibre, enregistrerAudit, enregistrerNoteMagasin, enregistrerVisites } from './chargement'
import type { ActionLibre, NoteMagasin, Visite } from './modele'
import { brancherEnvoi } from '../lib/horsLigne'
import { notifierTache } from '../lib/notifications'
import { televerserPhoto } from '../lib/photos'

type ResultatAudit = Parameters<typeof enregistrerAudit>[2]
brancherEnvoi('photo', async (d) => { const x = d as { chemin: string; blob: Blob }; await televerserPhoto(x.chemin, x.blob) })
brancherEnvoi('visite', async (d) => {
  const x = d as { base: Omit<Visite, 'magasin' | 'id'>; magasins: string[]; audit: ResultatAudit | null }
  await enregistrerVisites(x.base, x.magasins, null)
  if (x.audit) await enregistrerAudit(x.magasins[0], null, x.audit)
})
brancherEnvoi('note', async (d) => { const x = d as { magasin: string; note: NoteMagasin }; await enregistrerNoteMagasin(x.magasin, x.note) })
brancherEnvoi('tache', async (d) => {
  const x = d as { magasin: string; tache: ActionLibre; cles: string[] }
  const id = await enregistrerActionLibre(x.magasin, x.tache)
  notifierTache(x.magasin, id, x.cles)
})
