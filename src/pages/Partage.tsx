import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import IosShareOutlined from '@mui/icons-material/IosShareOutlined'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { Puces } from '../components/Social'
import { DialogPratique } from '../components/BonnesPratiques'
import { DialogAction } from '../components/Actions'
import { plusProche } from '../components/AuMagasin'
import { useAuth } from '../auth/AuthContext'
import { useMessagerie } from '../data/MessagerieContext'
import { magasinsDu, perimetreDuProfil } from '../data/perimetre'
import type { Reseau } from '../data/modele'
import type { Photo } from '../data/grilles'
import { lirePartage, viderPartage, type Partage as Recu } from '../lib/partage'
import { envoyerPhoto, messagePhoto } from '../lib/photos'
import { envoyerPiece, ErreurPiece, messagePiece, type Piece } from '../lib/pieces'
import { lienFiche } from '../lib/format'

// Partager vers l'app (sprint 25, F5) : photos (ou texte) venues de la galerie du téléphone, rangées en bonne pratique,
// message au groupe du magasin ou tâche. Magasin proposé d'après la position quand l'accord est déjà donné.
type Usage = 'pratique' | 'message' | 'tache'
const usages: { v: Usage; libelle: string }[] = [{ v: 'pratique', libelle: 'Bonne pratique' }, { v: 'message', libelle: 'Message' }, { v: 'tache', libelle: 'Tâche' }]

export function Partage() {
  return (
    <>
      <PageHeader titre="Partager" />
      <AvecReseau>{(reseau) => <Contenu reseau={reseau} />}</AvecReseau>
    </>
  )
}

function Contenu({ reseau }: { reseau: Reseau }) {
  const { profil } = useAuth()
  const { envoyerFil } = useMessagerie()
  const naviguer = useNavigate()
  const [recu, setRecu] = useState<Recu | null>(null)
  const [usage, setUsage] = useState<Usage>('pratique')
  const [magasin, setMagasin] = useState('')
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const [pratique, setPratique] = useState<Photo[] | null>(null)
  const [tache, setTache] = useState<Piece[] | null>(null)
  const magasins = useMemo(() => magasinsDu(reseau, perimetreDuProfil(profil) ?? { type: 'reseau' }), [reseau, profil])
  const apercus = useMemo(() => (recu?.photos ?? []).map((f) => URL.createObjectURL(f)), [recu])
  useEffect(() => () => apercus.forEach((u) => URL.revokeObjectURL(u)), [apercus])

  useEffect(() => {
    let actif = true
    void lirePartage().then((r) => {
      if (!actif) return
      setRecu(r); setTexte(r.texte)
      if (!r.photos.length) setUsage('message')
    })
    // Magasin d'après la position, seulement si le téléphone l'a déjà autorisée : jamais de demande d'office
    navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then((p) => {
      if (p.state !== 'granted') return
      navigator.geolocation.getCurrentPosition((pos) => {
        const m = plusProche(magasins, { lat: pos.coords.latitude, lon: pos.coords.longitude })
        if (actif && m) setMagasin((x) => x || m.nom)
      }, () => undefined, { timeout: 10000, maximumAge: 60000 })
    }, () => undefined)
    return () => { actif = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!recu) return <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress aria-label="Chargement du partage" /></Box>
  if (!recu.photos.length && !recu.texte) {
    return <EmptyState icone={<IosShareOutlined />} titre="Rien à partager" texte="Les photos partagées depuis la galerie du téléphone arrivent ici." action={<Button variant="contained" component={RouterLink} to="/" sx={{ minHeight: 48 }}>Accueil</Button>} />
  }

  const fin = async (lien: string) => { await viderPartage(); naviguer(lien) }
  const continuer = async () => {
    if (!profil) return
    setEnvoi(true); setErreur('')
    try {
      if (usage === 'pratique') {
        const photos: Photo[] = []
        for (const f of recu.photos) photos.push(await envoyerPhoto(f))
        setPratique(photos)
      } else {
        const pieces: Piece[] = []
        for (const f of recu.photos) pieces.push(await envoyerPiece(f, profil.id))
        if (usage === 'tache') setTache(pieces)
        else {
          await envoyerFil({ genre: 'magasin', magasin, equipe: false }, texte.trim(), [], pieces)
          await fin(`/echanges/magasin/${encodeURIComponent(magasin)}`)
        }
      }
    } catch (e) {
      setErreur(usage === 'pratique' ? messagePhoto(e) : e instanceof ErreurPiece ? messagePiece(e) : 'Le message n’est pas parti. Vérifie ta connexion et réessaie.')
    } finally {
      setEnvoi(false)
    }
  }
  const pret = !!magasin && !envoi && (usage !== 'message' || !!texte.trim() || recu.photos.length > 0)

  return (
    <Box sx={{ display: 'grid', gap: 2, maxWidth: 640 }}>
      {apercus.length > 0 && (
        <Box role="list" aria-label="Photos partagées" sx={{ display: 'flex', gap: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {apercus.map((u, i) => (
            <Box role="listitem" key={u} sx={{ flexShrink: 0 }}>
              <Box component="img" src={u} alt={`Photo ${i + 1}`} sx={{ display: 'block', width: 120, height: 120, objectFit: 'cover', borderRadius: 2 }} />
            </Box>
          ))}
        </Box>
      )}
      <Card sx={{ p: 2, display: 'grid', gap: 2 }}>
        <Typography variant="h3" component="h2">Que faire {recu.photos.length > 1 ? 'de ces photos' : recu.photos.length ? 'de cette photo' : 'de ce texte'} ?</Typography>
        <Puces label="Ranger en" valeur={usage} onChange={setUsage} options={recu.photos.length ? usages : usages.filter((u) => u.v !== 'pratique')} />
        <Autocomplete options={magasins.map((m) => m.nom)} value={magasin || null} onChange={(_e, v) => setMagasin(v ?? '')}
          renderInput={(p) => <TextField {...p} label="Magasin" />} noOptionsText="Aucun magasin" openText="Ouvrir" closeText="Fermer" clearText="Effacer" />
        {usage === 'message' && <TextField label="Message" value={texte} onChange={(e) => setTexte(e.target.value)} multiline minRows={2} />}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" disabled={!pret} onClick={() => void continuer()} startIcon={envoi ? <CircularProgress size={18} /> : undefined} sx={{ minHeight: 48 }}>
            {usage === 'message' ? 'Envoyer' : 'Continuer'}
          </Button>
          <Button onClick={() => void fin('/')} sx={{ minHeight: 48 }}>Annuler</Button>
        </Box>
      </Card>
      {pratique && <DialogPratique reseau={reseau} pratique={null} magasinInitial={magasin} photosInitiales={pratique}
        onFermer={(m) => { setPratique(null); if (m) void fin(lienFiche(magasin)) }} />}
      {tache && <DialogAction reseau={reseau} magasins={[magasin]} action={null} piecesInitiales={tache}
        onFermer={(m) => { setTache(null); if (m) void fin(lienFiche(magasin)) }} />}
      <Snackbar open={!!erreur} autoHideDuration={6000} onClose={() => setErreur('')} message={erreur} />
    </Box>
  )
}
