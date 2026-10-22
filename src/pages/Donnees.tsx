import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined'
import BackupOutlined from '@mui/icons-material/BackupOutlined'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { Fenetre } from '../components/EditionEquipe'
import { DialogImportChiffres, DialogImportSante, DialogImportVisites } from '../components/ImportsSuivi'
import { useReseau } from '../data/ReseauContext'
import { lireSauvegarde, noterSauvegarde } from '../data/chargement'
import type { Reseau } from '../data/modele'
import {
  afficher, analyserReferentiel, appliquerImport, choisirFeuille, feuilleExport, lireClasseur, referentiels, telechargerBlob, telechargerClasseur,
  type Analyse, type Referentiel,
} from '../data/referentiels'
import { dateCourte } from '../lib/format'

// Sans accents : certains navigateurs remplacent sinon le nom du fichier téléchargé par « download »
const nomFichier = (libelle: string, jour: string, ext: string) => `V and B - ${libelle} - ${jour}.${ext}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function Sauvegarde({ reseau, signaler }: { reseau: Reseau; signaler: (m: string) => void }) {
  const { recharger } = useReseau()
  const [envoi, setEnvoi] = useState<'' | 'excel' | 'complete'>('')
  const [erreur, setErreur] = useState(false)
  const agir = async (quoi: 'excel' | 'complete') => {
    setEnvoi(quoi); setErreur(false)
    try {
      if (quoi === 'excel') {
        await telechargerClasseur(referentiels(reseau).map((r) => feuilleExport(r, reseau)), nomFichier('Référentiels', reseau.jour, 'xlsx'))
        signaler('Référentiels exportés.')
      } else {
        const tables = await lireSauvegarde()
        telechargerBlob(new Blob([JSON.stringify({ application: 'V and B Réseau', date: new Date().toISOString(), tables }, null, 1)], { type: 'application/json' }), nomFichier('Sauvegarde complète', reseau.jour, 'json'))
        await noterSauvegarde(reseau.jour, reseau.directeur.nom)
        await recharger()
        signaler('Sauvegarde complète téléchargée.')
      }
    } catch { setErreur(true) } finally { setEnvoi('') }
  }
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h3" component="h2">Sauvegarde</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {reseau.derniereSauvegarde ? `Dernière sauvegarde complète : ${dateCourte(reseau.derniereSauvegarde)}` : 'Aucune sauvegarde complète téléchargée'}
        </Typography>
        {erreur && <Alert severity="error" sx={{ mt: 2 }}>Le fichier n’a pas pu être préparé. Vérifie ta connexion et réessaie.</Alert>}
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" startIcon={<BackupOutlined />} disabled={!!envoi} onClick={() => agir('complete')} sx={{ minHeight: 48 }}>
            {envoi === 'complete' ? 'Préparation…' : 'Télécharger la sauvegarde complète'}
          </Button>
          <Button variant="outlined" startIcon={<DownloadOutlined />} disabled={!!envoi} onClick={() => agir('excel')} sx={{ minHeight: 48 }}>
            {envoi === 'excel' ? 'Préparation…' : 'Exporter tous les référentiels'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}

function CarteReferentiel({ reseau, r, importer, signaler }: { reseau: Reseau; r: Referentiel; importer: () => void; signaler: (m: string) => void }) {
  const [envoi, setEnvoi] = useState(false)
  const n = r.lignes(reseau).length
  const exporter = async () => {
    setEnvoi(true)
    try { await telechargerClasseur([feuilleExport(r, reseau)], nomFichier(r.libelle, reseau.jour, 'xlsx')); signaler(`${r.libelle} exportés.`) }
    catch { signaler('Le fichier n’a pas pu être préparé. Réessaie.') } finally { setEnvoi(false) }
  }
  return (
    <Card component="section" aria-label={r.libelle}>
      <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" component="h3">{r.libelle}</Typography>
          <Typography variant="body2" color="text.secondary">{n} ligne{n > 1 ? 's' : ''}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<DownloadOutlined />} onClick={exporter} disabled={envoi} aria-label={`Exporter ${r.libelle}`} sx={{ minHeight: 48 }}>Exporter</Button>
          <Button variant="outlined" startIcon={<UploadFileOutlined />} onClick={importer} aria-label={`Importer ${r.libelle}`} sx={{ minHeight: 48 }}>Importer</Button>
        </Box>
      </CardContent>
    </Card>
  )
}

const MAX_APERCU = 60

function Apercu({ ref_, a }: { ref_: Referentiel; a: Analyse }) {
  const col = (id: string) => ref_.colonnes.find((c) => c.id === id)!
  const ajouts = a.changements.filter((c) => c.type === 'ajout').length
  const suppressions = a.changements.filter((c) => c.type === 'suppression').length
  const modifs = a.changements.length - ajouts - suppressions
  const resume = [
    ajouts && `${ajouts} ajout${ajouts > 1 ? 's' : ''}`,
    modifs && `${modifs} ligne${modifs > 1 ? 's' : ''} modifiée${modifs > 1 ? 's' : ''}`,
    suppressions && `${suppressions} suppression${suppressions > 1 ? 's' : ''}`,
    a.inchangees && `${a.inchangees} inchangée${a.inchangees > 1 ? 's' : ''}`,
  ].filter(Boolean).join(' · ')
  return (
    <>
      <Alert severity={a.changements.length ? 'success' : 'info'}>
        {a.changements.length ? resume : `Aucun changement par rapport aux données de l’app${a.inchangees ? ` (${a.inchangees} ligne${a.inchangees > 1 ? 's' : ''} identique${a.inchangees > 1 ? 's' : ''})` : ''}.`}
      </Alert>
      {suppressions > 0 && (
        <Alert severity="error">
          {suppressions} ligne{suppressions > 1 ? 's' : ''} absente{suppressions > 1 ? 's' : ''} du fichier {suppressions > 1 ? 'seront supprimées' : 'sera supprimée'} de l’app.
        </Alert>
      )}
      {a.erreurs.length > 0 && (
        <Alert severity="warning">
          {a.erreurs.length} ligne{a.erreurs.length > 1 ? 's' : ''} laissée{a.erreurs.length > 1 ? 's' : ''} de côté :
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {a.erreurs.slice(0, 10).map((e) => <li key={e.ligne}>Ligne {e.ligne} : {e.message}</li>)}
            {a.erreurs.length > 10 && <li>et {a.erreurs.length - 10} autre{a.erreurs.length > 11 ? 's' : ''}</li>}
          </Box>
        </Alert>
      )}
      {a.ignorees.length > 0 && <Typography variant="body2" color="text.secondary">Colonnes ignorées : {a.ignorees.join(', ')}</Typography>}
      {a.changements.length > 0 && (
        <Box component="ul" aria-label="Changements" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[...a.changements].sort((x, y) => Number(y.type === 'suppression') - Number(x.type === 'suppression')).slice(0, MAX_APERCU).map((ch) => (
            <Box component="li" key={ch.cle} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{ch.libelle}</Typography>
                <Chip size="small" label={{ ajout: 'Ajout', modif: 'Modification', suppression: 'Suppression' }[ch.type]} color={({ ajout: 'secondary', modif: 'primary', suppression: 'error' } as const)[ch.type]} variant="outlined" sx={{ fontSize: 13 }} />
              </Box>
              {ch.champs.map((id) => (
                <Typography key={id} variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  <Box component="span" sx={{ color: 'text.secondary' }}>{col(id).entete} : </Box>
                  {ch.avant && <><Box component="span" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>{afficher(col(id), ch.avant[id] ?? '')}</Box>{' → '}</>}
                  <Box component="span" sx={{ fontWeight: 600 }}>{afficher(col(id), ch.apres[id])}</Box>
                </Typography>
              ))}
            </Box>
          ))}
          {a.changements.length > MAX_APERCU && <Typography component="li" variant="body2" color="text.secondary">et {a.changements.length - MAX_APERCU} autres changements</Typography>}
        </Box>
      )}
    </>
  )
}

// Fichiers venus d'autres outils, reconnus sur la même carte que le référentiel (Joseph, 22/10/2026) :
// classeur des visites, export Asana de la santé du parc, export mensuel des chiffres
const autresFormats: Record<string, true> = { visites: true, ninebox: true, deploiements: true, chiffres: true }
// Un export de l'app se reconnaît à ses colonnes clés, marquées « (clé) »
const estExportApp = (feuilles: { lignes: unknown[][] }[]) => feuilles.some((f) => f.lignes.slice(0, 10).some((l) => l.some((x) => /\(clé\)\s*$/i.test(String(x ?? '')))))

function DialogImport({ reseau, r, onFermer }: { reseau: Reseau; r: Referentiel; onFermer: (m?: string) => void }) {
  const [analyse, setAnalyse] = useState<Analyse | null>(null)
  const [nom, setNom] = useState('')
  const [erreur, setErreur] = useState('')
  const [autre, setAutre] = useState<File | null>(null)
  const choisir = async (f: File | undefined) => {
    if (!f) return
    setNom(f.name); setErreur(''); setAnalyse(null)
    try {
      const feuilles = await lireClasseur(f)
      if (autresFormats[r.id] && !estExportApp(feuilles)) { setAutre(f); return }
      const feuille = choisirFeuille(feuilles, r)
      const a = feuille ? analyserReferentiel(r, feuille, reseau, reseau.jour) : null
      if (!a || a.manquantes.length) setErreur(`Colonne${(a?.manquantes.length ?? 1) > 1 ? 's' : ''} introuvable${(a?.manquantes.length ?? 1) > 1 ? 's' : ''} : ${(a?.manquantes ?? r.colonnes.filter((c) => c.cle).map((c) => c.entete)).join(', ')}. Pars du fichier exporté depuis cette page.`)
      else setAnalyse(a)
    } catch { setErreur('Ce fichier ne peut pas être lu. Enregistre-le au format Excel (.xlsx) ou CSV puis réessaie.') }
  }
  const n = analyse?.changements.length ?? 0
  if (autre && r.id === 'visites') return <DialogImportVisites reseau={reseau} fichier={autre} onFermer={onFermer} />
  if (autre && r.id === 'chiffres') return <DialogImportChiffres reseau={reseau} fichier={autre} onFermer={onFermer} />
  if (autre) return <DialogImportSante reseau={reseau} date={reseau.jour} fichier={autre} onFermer={onFermer} />
  return (
    <Fenetre large titre={`Importer : ${r.libelle}`} ouvert onFermer={onFermer} valide={n > 0}
      enregistrer={async () => { await appliquerImport(r, reseau, analyse!.changements); return `${n} ligne${n > 1 ? 's' : ''} mise${n > 1 ? 's' : ''} à jour` }}>
      <Button variant="outlined" component="label" startIcon={<UploadFileOutlined />} sx={{ alignSelf: 'flex-start', minHeight: 48 }}>
        {nom || 'Choisir un fichier'}
        <input type="file" hidden accept=".xlsx,.csv,.txt" aria-label={`Fichier ${r.libelle} à importer`} onChange={(e) => choisir(e.target.files?.[0])} />
      </Button>
      {erreur && <Alert severity="warning">{erreur}</Alert>}
      {analyse && <Apercu ref_={r} a={analyse} />}
    </Fenetre>
  )
}

export function Donnees() {
  const [message, setMessage] = useState('')
  const [importer, setImporter] = useState<string | null>(null)
  return (
    <AvecReseau>
      {(reseau) => {
        const liste = referentiels(reseau)
        const choisi = liste.find((r) => r.id === importer)
        return (
          <>
            <PageHeader titre="Import et export" />
            <Sauvegarde reseau={reseau} signaler={setMessage} />
            <Typography variant="h3" component="h2" sx={{ mb: 2 }}>Référentiels</Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' } }}>
              {liste.map((r) => <CarteReferentiel key={r.id} reseau={reseau} r={r} importer={() => setImporter(r.id)} signaler={setMessage} />)}
            </Box>
            {choisi && <DialogImport reseau={reseau} r={choisi} onFermer={(m) => { setImporter(null); if (m) setMessage(m) }} />}
            <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
          </>
        )
      }}
    </AvecReseau>
  )
}
