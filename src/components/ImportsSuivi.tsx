import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import { useReseau } from '../data/ReseauContext'
import { Fenetre, messageErreur } from './EditionEquipe'
import { effacerToutesEvaluations, enregistrerChiffres, enregistrerDeploiements, enregistrerThematiques, importerHistorique, importerVisites } from '../data/chargement'
import { analyser, lireFichier, type ResultatImport } from '../data/import'
import { analyserChiffres, type ResultatImportChiffres } from '../data/importChiffres'
import { analyserVisites, lireClasseur, type ResultatImportVisites } from '../data/importVisites'
import { completerChiffres, libelleMois, libellesChiffres, moisPrecedent } from '../data/chiffres'
import { libelleCritere, type Thematique, type Ton } from '../data/sante'
import { dateCourte } from '../lib/format'
import type { Reseau } from '../data/modele'

// Imports des fichiers de suivi (santé du parc, chiffres, classeur des visites) et thématiques de déploiement :
// réservés au Directeur de réseau, rangés dans les Paramètres

// ── Import d'un fichier Excel ou CSV ──
export function DialogImportSante({ reseau, date, onFermer }: { reseau: Reseau; date: string; onFermer: (m?: string) => void }) {
  const [res, setRes] = useState<ResultatImport | null>(null)
  const [nomFichier, setNomFichier] = useState('')
  const [erreur, setErreur] = useState('')
  const choisir = async (f: File | undefined) => {
    if (!f) return
    setNomFichier(f.name); setErreur(''); setRes(null)
    try {
      const r = analyser(await lireFichier(f), reseau, date)
      if (!r) setErreur('Aucune colonne de noms de magasins reconnue dans ce fichier. Vérifie que les noms sont écrits comme dans l’app.')
      else setRes(r)
    } catch { setErreur('Ce fichier ne peut pas être lu. Enregistre-le au format Excel (.xlsx) ou CSV puis réessaie.') }
  }
  const nbNotes = res ? res.notes.reduce((t, n) => t + Object.keys(n.notes).length, 0) : 0
  const dates = res ? [...new Set([...res.notes.map((n) => n.date), ...res.deploiements.map((d) => d.date)])].sort() : []
  const total = nbNotes + (res?.deploiements.length ?? 0)
  return (
    <Fenetre large titre="Importer depuis Excel" ouvert onFermer={onFermer} valide={total > 0}
      enregistrer={async () => {
        if (res!.notes.length) await importerHistorique(res!.notes, reseau.directeur.nom)
        if (res!.deploiements.length) await enregistrerDeploiements(res!.deploiements, date)
        return `${total} valeur${total > 1 ? 's' : ''} importée${total > 1 ? 's' : ''}`
      }}>
      <Button variant="outlined" component="label" startIcon={<UploadFileOutlined />} sx={{ alignSelf: 'flex-start', minHeight: 48 }}>
        {nomFichier || 'Choisir un fichier'}
        <input type="file" hidden accept=".xlsx,.csv,.txt" aria-label="Fichier à importer" onChange={(e) => choisir(e.target.files?.[0])} />
      </Button>
      {erreur && <Alert severity="warning">{erreur}</Alert>}
      {res && (
        <>
          <Alert severity={total ? 'success' : 'info'}>
            {total ? `${total} valeur${total > 1 ? 's' : ''} prête${total > 1 ? 's' : ''} à importer pour ${new Set([...res.notes.map((n) => n.magasin), ...res.deploiements.map((d) => d.magasin)]).size} magasins (colonne des magasins : « ${res.colonneMagasin} »). ${dates.length > 1 ? `${dates.length} dates, du ${dateCourte(dates[0])} au ${dateCourte(dates.at(-1)!)}, ajoutées à l’historique.` : `Datées du ${dateCourte(dates[0] ?? date)}.`}` : 'Aucune valeur reconnue dans ce fichier.'}
          </Alert>
          {res.criteres.length + res.thematiques.length > 0 && (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Colonnes reconnues</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {res.criteres.map((c) => <Chip key={c.entete} label={`${c.entete} → ${libelleCritere(c.id)}`} color="primary" variant="outlined" sx={{ fontSize: 13 }} />)}
                {res.thematiques.map((t) => <Chip key={t.entete} label={`${t.entete} → ${t.t.libelle}`} color="secondary" variant="outlined" sx={{ fontSize: 13 }} />)}
              </Box>
            </Box>
          )}
          {res.ignorees.length > 0 && <Typography variant="body2" color="text.secondary">Colonnes ignorées : {res.ignorees.join(', ')}. Pour en suivre une, ajoute-la d’abord comme thématique.</Typography>}
          {res.inconnus.length > 0 && <Typography variant="body2" color="text.secondary">Magasins non trouvés ({res.inconnus.length}) : {res.inconnus.slice(0, 12).join(', ')}{res.inconnus.length > 12 ? '…' : ''}</Typography>}
          {res.illisibles > 0 && <Typography variant="body2" color="text.secondary">{res.illisibles} case{res.illisibles > 1 ? 's' : ''} avec une valeur non reconnue, laissée{res.illisibles > 1 ? 's' : ''} de côté.</Typography>}
        </>
      )}
    </Fenetre>
  )
}


export function DialogImportChiffres({ reseau, onFermer }: { reseau: Reseau; onFermer: (m?: string) => void }) {
  const [res, setRes] = useState<ResultatImportChiffres | null>(null)
  const [nomFichier, setNomFichier] = useState('')
  const [erreur, setErreur] = useState('')
  const choisir = async (f: File | undefined) => {
    if (!f) return
    setNomFichier(f.name); setErreur(''); setRes(null)
    try {
      const r = analyserChiffres(await lireFichier(f), reseau, moisPrecedent(reseau.jour))
      if (!r) setErreur('Aucune colonne de noms de magasins reconnue dans ce fichier. Vérifie que les noms sont écrits comme dans l’app.')
      else setRes(r)
    } catch { setErreur('Ce fichier ne peut pas être lu. Enregistre-le au format Excel (.xlsx) ou CSV puis réessaie.') }
  }
  const total = res?.lignes.length ?? 0
  const mois = res ? [...new Set(res.lignes.map((l) => l.mois))].sort() : []
  const nbMag = res ? new Set(res.lignes.map((l) => l.magasin)).size : 0
  return (
    <Fenetre large titre="Importer les chiffres mensuels" ouvert onFermer={onFermer} valide={total > 0}
      enregistrer={async () => { await enregistrerChiffres(res!.lignes.map((l) => completerChiffres(l, reseau.chiffres[l.magasin]?.find((c) => c.mois === l.mois)))); return `${total} mois de chiffres importé${total > 1 ? 's' : ''}` }}>
      <Button variant="outlined" component="label" startIcon={<UploadFileOutlined />} sx={{ alignSelf: 'flex-start', minHeight: 48 }}>
        {nomFichier || 'Choisir un fichier'}
        <input type="file" hidden accept=".xlsx,.csv,.txt" aria-label="Fichier de chiffres à importer" onChange={(e) => choisir(e.target.files?.[0])} />
      </Button>
      {erreur && <Alert severity="warning">{erreur}</Alert>}
      {res && (
        <>
          <Alert severity={total ? 'success' : 'info'}>
            {total ? `${total} ligne${total > 1 ? 's' : ''} prête${total > 1 ? 's' : ''} à importer pour ${nbMag} magasin${nbMag > 1 ? 's' : ''}, ${mois.length > 1 ? `${/^[aeiouo]/.test(libelleMois(mois[0])) ? 'd’' : 'de '}${libelleMois(mois[0])} à ${libelleMois(mois.at(-1)!)}` : libelleMois(mois[0])}.${res.colonneMois ? '' : ' Aucune colonne de mois : les chiffres sont rangés sur le mois dernier.'}` : 'Aucun chiffre reconnu dans ce fichier.'}
          </Alert>
          {res.colonnes.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {res.colonnes.map((c) => <Chip key={c.entete} label={`${c.entete} → ${libellesChiffres[c.id].libelle}`} color="primary" variant="outlined" sx={{ fontSize: 13 }} />)}
            </Box>
          )}
          {res.ignorees.length > 0 && <Typography variant="body2" color="text.secondary">Colonnes ignorées : {res.ignorees.join(', ')}.</Typography>}
          {res.inconnus.length > 0 && <Typography variant="body2" color="text.secondary">Magasins non trouvés ({res.inconnus.length}) : {res.inconnus.slice(0, 12).join(', ')}{res.inconnus.length > 12 ? '…' : ''}</Typography>}
          {res.illisibles > 0 && <Typography variant="body2" color="text.secondary">{res.illisibles} case{res.illisibles > 1 ? 's' : ''} avec une valeur non reconnue, laissée{res.illisibles > 1 ? 's' : ''} de côté.</Typography>}
        </>
      )}
    </Fenetre>
  )
}


// ── Import du classeur de suivi des visites (un onglet par Coach) ──
export function DialogImportVisites({ reseau, onFermer }: { reseau: Reseau; onFermer: (m?: string) => void }) {
  const [res, setRes] = useState<ResultatImportVisites | null>(null)
  const [nomFichier, setNomFichier] = useState('')
  const [erreur, setErreur] = useState('')
  const [dateAudits, setDateAudits] = useState(reseau.jour)
  const choisir = async (f: File | undefined) => {
    if (!f) return
    setNomFichier(f.name); setErreur(''); setRes(null)
    try {
      const r = analyserVisites(await lireClasseur(f), reseau)
      if (!r.visites.length && !r.audits.length && !r.dejaLa) setErreur('Aucune visite reconnue dans ce fichier. Vérifie que chaque onglet a une colonne « Magasin » et des colonnes « Visite 1 », « Visite 2 »…')
      else setRes(r)
    } catch { setErreur('Ce fichier ne peut pas être lu. Enregistre-le au format Excel (.xlsx) puis réessaie.') }
  }
  // Feuilles de route sans date : rangées à la date choisie, sauf si elles y sont déjà
  const feuilles = (res?.feuillesDeRoute ?? []).filter((f) => !reseau.visites.some((v) => v.magasin === f.magasin && v.date === dateAudits && v.type === 'feuille'))
  const n = res?.visites.length ?? 0, a = res?.audits.length ?? 0, fr = feuilles.length
  // Seules les notes des anciens tableaux d'audit et les feuilles de route sans date demandent une date
  const sansDate = (res?.audits.filter((x) => !x.date).length ?? 0) + fr
  const nbMag = res ? new Set(res.visites.map((v) => v.magasin)).size : 0
  const annees = res ? [...new Set(res.visites.map((v) => v.date.slice(0, 4)))].sort() : []
  const pluriel = (k: number, mot: string) => `${k} ${mot}${k > 1 ? 's' : ''}`
  const dateValide = /^\d{4}-\d{2}-\d{2}$/.test(dateAudits)
  return (
    <Fenetre large titre="Importer des visites" ouvert onFermer={onFermer} valide={n + a + fr > 0 && (!sansDate || dateValide)}
      enregistrer={async () => {
        await importerVisites([...res!.visites, ...feuilles.map((f) => ({ ...f, date: dateAudits, type: 'feuille' }))], res!.audits, dateAudits)
        return [n ? `${pluriel(n, 'visite')} importée${n > 1 ? 's' : ''}` : '', fr ? pluriel(fr, 'feuille') + ' de route' : '', a ? `${pluriel(a, 'note')} d’audit` : ''].filter(Boolean).join(', ')
      }}>
      <Button variant="outlined" component="label" startIcon={<UploadFileOutlined />} sx={{ alignSelf: 'flex-start', minHeight: 48 }}>
        {nomFichier || 'Choisir un fichier'}
        <input type="file" hidden accept=".xlsx" aria-label="Fichier de visites à importer" onChange={(e) => choisir(e.target.files?.[0])} />
      </Button>
      {erreur && <Alert severity="warning">{erreur}</Alert>}
      {res && (
        <>
          <Alert severity={n ? 'success' : 'info'}>
            {n ? `${pluriel(n, 'visite')} à ajouter pour ${pluriel(nbMag, 'magasin')}, ${annees.length > 1 ? `de ${annees[0]} à ${annees.at(-1)}` : `en ${annees[0]}`}.` : 'Aucune nouvelle visite.'}
            {res.dejaLa > 0 && ` ${pluriel(res.dejaLa, 'visite')} déjà dans l’app, laissée${res.dejaLa > 1 ? 's' : ''} telle${res.dejaLa > 1 ? 's' : ''} quelle${res.dejaLa > 1 ? 's' : ''}.`}
          </Alert>
          {a + fr > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <Box sx={{ flex: '1 1 240px' }}>
                {a > 0 && <Typography variant="body1">{pluriel(a, 'note')} d’audit : {res.audits.filter((x) => x.type === 'hygiene').length} hygiène, {res.audits.filter((x) => x.type === 'excellence').length} excellence.</Typography>}
                {fr > 0 && <Typography variant="body1">{pluriel(fr, 'feuille')} de route faite{fr > 1 ? 's' : ''}.</Typography>}
              </Box>
              {sansDate > 0 && <TextField type="date" label="Date des audits et feuilles de route" value={dateAudits} onChange={(e) => setDateAudits(e.target.value)} error={!dateValide}
                slotProps={{ inputLabel: { shrink: true } }} sx={{ width: { xs: '100%', sm: 300 } }} />}
            </Box>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {res.feuilles.filter((f) => f.visites).map((f) => (
              <Chip key={f.nom} label={`${f.nom} → ${f.personne}${f.equipe ? '' : ' (hors équipe)'} · ${f.visites}`} color={f.equipe ? 'primary' : 'default'} variant="outlined" sx={{ fontSize: 13 }} />
            ))}
          </Box>
          {res.inconnus.length > 0 && <Typography variant="body2" color="text.secondary">Magasins non trouvés ({res.inconnus.length}) : {res.inconnus.slice(0, 12).join(', ')}{res.inconnus.length > 12 ? '…' : ''}</Typography>}
          {res.illisibles.length > 0 && <Typography variant="body2" color="text.secondary">Dates non reconnues, laissées de côté ({res.illisibles.length}) : {res.illisibles.slice(0, 12).join(' · ')}{res.illisibles.length > 12 ? '…' : ''}</Typography>}
        </>
      )}
    </Fenetre>
  )
}


const tons: { id: Ton; libelle: string }[] = [{ id: 'positif', libelle: 'Vert (fait)' }, { id: 'partiel', libelle: 'Orange (en partie)' }, { id: 'negatif', libelle: 'Rouge (non)' }]

export function DialogThematiques({ reseau, onFermer }: { reseau: Reseau; onFermer: (m?: string) => void }) {
  const [liste, setListe] = useState<Thematique[]>(() => reseau.deploiements.thematiques.map((t) => ({ ...t, options: t.options.map((o) => ({ ...o })) })))
  const changer = (i: number, f: (t: Thematique) => Thematique) => setListe((l) => l.map((t, j) => (j === i ? f(t) : t)))
  const valide = liste.every((t) => t.libelle.trim() && t.options.length > 0 && t.options.every((o) => o.libelle.trim()))
  const ajouter = () => setListe((l) => [...l, { id: `t${Date.now().toString(36)}`, libelle: '', options: [{ libelle: 'Oui', ton: 'positif' }, { libelle: 'Non', ton: 'negatif' }] }])
  return (
    <Fenetre large titre="Thématiques de déploiement" ouvert onFermer={onFermer} valide={valide}
      enregistrer={async () => { await enregistrerThematiques(liste.map((t) => ({ ...t, libelle: t.libelle.trim(), options: t.options.map((o) => ({ ...o, libelle: o.libelle.trim() })) }))); return 'Thématiques enregistrées' }}>
      {liste.map((t, i) => (
        <Card key={t.id} variant="outlined">
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField label="Thématique" value={t.libelle} onChange={(e) => changer(i, (x) => ({ ...x, libelle: e.target.value }))} sx={{ flex: 1 }} required />
              <Tooltip title="Supprimer la thématique"><IconButton onClick={() => setListe((l) => l.filter((_, j) => j !== i))} aria-label={`Supprimer la thématique ${t.libelle || "sans nom"}`}><DeleteOutlined /></IconButton></Tooltip>
            </Box>
            {t.options.map((o, k) => (
              <Box key={k} sx={{ display: 'flex', gap: 1, alignItems: 'center', pl: { sm: 2 }, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                <TextField size="small" label="Réponse possible" value={o.libelle} onChange={(e) => changer(i, (x) => ({ ...x, options: x.options.map((p, n) => (n === k ? { ...p, libelle: e.target.value } : p)) }))} sx={{ flex: 1, minWidth: 140, '& .MuiInputBase-root': { minHeight: 48 } }} />
                <TextField select size="small" label="Couleur" value={o.ton} onChange={(e) => changer(i, (x) => ({ ...x, options: x.options.map((p, n) => (n === k ? { ...p, ton: e.target.value as Ton } : p)) }))} sx={{ minWidth: 170, '& .MuiInputBase-root': { minHeight: 48 } }}>
                  {tons.map((x) => <MenuItem key={x.id} value={x.id}>{x.libelle}</MenuItem>)}
                </TextField>
                <IconButton onClick={() => changer(i, (x) => ({ ...x, options: x.options.filter((_, n) => n !== k) }))} aria-label={`Retirer la réponse ${o.libelle}`} disabled={t.options.length <= 1}><DeleteOutlined /></IconButton>
              </Box>
            ))}
            <Button startIcon={<AddOutlined />} onClick={() => changer(i, (x) => ({ ...x, options: [...x.options, { libelle: '', ton: 'partiel' }] }))} sx={{ alignSelf: 'flex-start', minHeight: 48 }}>Ajouter une réponse</Button>
          </CardContent>
        </Card>
      ))}
      <Button variant="outlined" startIcon={<AddOutlined />} onClick={ajouter} sx={{ alignSelf: 'flex-start', minHeight: 48 }}>Ajouter une thématique</Button>
    </Fenetre>
  )
}

// Paramètres : thématiques suivies dans « Déploiements » (le Directeur seul les modifie)
export function CarteThematiques({ reseau, signaler }: { reseau: Reseau; signaler: (m: string) => void }) {
  const [ouvert, setOuvert] = useState(false)
  const ths = reseau.deploiements.thematiques
  return (
    <Card sx={{ mt: 2 }} component="section" aria-label="Thématiques de déploiement">
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
          <Typography variant="h3" component="h2" sx={{ flex: 1 }}>Thématiques de déploiement</Typography>
          <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setOuvert(true)} sx={{ minHeight: 48 }}>Gérer les thématiques</Button>
        </Box>
        {ths.length ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {ths.map((t) => <Chip key={t.id} label={`${t.libelle} · ${t.options.map((o) => o.libelle).join(' / ')}`} variant="outlined" sx={{ fontSize: 13, minHeight: 36 }} />)}
          </Box>
        ) : <Typography color="text.secondary">Aucune thématique</Typography>}
      </CardContent>
      {ouvert && <DialogThematiques reseau={reseau} onFermer={(m) => { setOuvert(false); if (m) signaler(m) }} />}
    </Card>
  )
}

// Paramètres : remise à zéro des notes de la nine box (une copie est gardée dans la base)
export function CarteEffacerNotes({ reseau }: { reseau: Reseau }) {
  const { recharger } = useReseau()
  const [ouvert, setOuvert] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const nombre = Object.keys(reseau.evaluations).length
  if (!nombre) return null
  const effacer = async () => {
    setEnvoi(true); setErreur('')
    try { await effacerToutesEvaluations(); await recharger(); setOuvert(false) } catch (e) { setErreur(messageErreur(e)) } finally { setEnvoi(false) }
  }
  return (
    <Card sx={{ mt: 2 }} component="section" aria-label="Notes de la nine box">
      <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h3" component="h2">Notes de la nine box</Typography>
          <Typography variant="body2" color="text.secondary">{nombre} magasin{nombre > 1 ? 's' : ''} noté{nombre > 1 ? 's' : ''}</Typography>
        </Box>
        <Button color="error" startIcon={<DeleteOutlined />} onClick={() => setOuvert(true)} sx={{ minHeight: 48 }}>Effacer toutes les notes</Button>
      </CardContent>
      <Dialog open={ouvert} onClose={() => setOuvert(false)} aria-labelledby="titre-effacer-notes" maxWidth="xs" fullWidth>
        <DialogTitle id="titre-effacer-notes">Effacer toutes les notes ?</DialogTitle>
        <DialogContent>
          <Typography>Les notes nine box de {nombre} magasin{nombre > 1 ? 's' : ''}, historique compris, seront effacées. Tous les magasins redeviennent non classés. Les déploiements ne changent pas.</Typography>
          {erreur && <Alert severity="error" sx={{ mt: 2 }}>{erreur}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOuvert(false)} sx={{ minHeight: 48 }}>Annuler</Button>
          <Button variant="contained" color="error" onClick={effacer} disabled={envoi} sx={{ minHeight: 48 }}>{envoi ? 'Effacement…' : 'Tout effacer'}</Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

type Fichier = 'visites' | 'sante' | 'chiffres'
const fichiers: { id: Fichier; libelle: string; detail: string }[] = [
  { id: 'visites', libelle: 'Classeur des visites', detail: 'Un onglet par Coach' },
  { id: 'sante', libelle: 'Export Asana de la santé du parc', detail: 'Notes nine box et déploiements, Excel ou CSV' },
  { id: 'chiffres', libelle: 'Export mensuel des chiffres', detail: 'Excel ou CSV' },
]

// Import et export : fichiers de suivi venus d'autres outils (anciens classeurs, export Asana)
export function FichiersSuivi({ reseau, signaler }: { reseau: Reseau; signaler: (m: string) => void }) {
  const [ouvert, setOuvert] = useState<Fichier | null>(null)
  const fermer = (m?: string) => { setOuvert(null); if (m) signaler(m) }
  return (
    <>
      <Typography variant="h3" component="h2" sx={{ mt: 3, mb: 2 }}>Fichiers de suivi</Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' } }}>
        {fichiers.map((f) => (
          <Card key={f.id} component="section" aria-label={f.libelle}>
            <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" component="h3">{f.libelle}</Typography>
                <Typography variant="body2" color="text.secondary">{f.detail}</Typography>
              </Box>
              <Button variant="outlined" startIcon={<UploadFileOutlined />} onClick={() => setOuvert(f.id)} aria-label={`Importer le fichier : ${f.libelle}`} sx={{ minHeight: 48, alignSelf: 'flex-start' }}>Importer</Button>
            </CardContent>
          </Card>
        ))}
      </Box>
      {ouvert === 'visites' && <DialogImportVisites reseau={reseau} onFermer={fermer} />}
      {ouvert === 'sante' && <DialogImportSante reseau={reseau} date={reseau.jour} onFermer={fermer} />}
      {ouvert === 'chiffres' && <DialogImportChiffres reseau={reseau} onFermer={fermer} />}
    </>
  )
}
