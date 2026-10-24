import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined'
import MyLocationOutlined from '@mui/icons-material/MyLocationOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { DialogVisite } from './DialogVisite'
import { distanceKm } from '../data/charge'
import { magasinsDu, type Perimetre } from '../data/perimetre'
import { lienFiche, lienPreparation } from '../lib/format'
import type { Magasin, Reseau } from '../data/modele'

// « Je suis au magasin » (sprint 24, F1) : sur téléphone, à moins de 300 m d'un magasin de son périmètre,
// l'accueil propose la saisie de la visite. Position lue sur le téléphone avec son accord, jamais enregistrée.
const RAYON_KM = 0.3
type Point = { lat: number; lon: number }

export function plusProche(magasins: Magasin[], ici: Point): Magasin | null {
  let meilleur: { m: Magasin; d: number } | null = null
  for (const m of magasins) {
    const d = distanceKm(m, ici)
    if (d !== null && d <= RAYON_KM && (!meilleur || d < meilleur.d)) meilleur = { m, d }
  }
  return meilleur?.m ?? null
}

export function AuMagasin({ reseau, p }: { reseau: Reseau; p: Perimetre }) {
  const [ici, setIci] = useState<Point | null>(null)
  // demande : bouton proposé (accord pas encore donné) ; cherche : position en cours ; loin : aucun magasin autour
  const [etat, setEtat] = useState<'' | 'demande' | 'cherche' | 'loin'>('')
  const [visite, setVisite] = useState(false)
  const [message, setMessage] = useState('')
  const magasins = useMemo(() => magasinsDu(reseau, p), [reseau, p])
  const proche = ici ? plusProche(magasins, ici) : null

  const localiser = (demandee: boolean) => {
    if (!('geolocation' in navigator)) return
    setEtat('cherche')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        setIci(point)
        setEtat(plusProche(magasins, point) ? '' : demandee ? 'loin' : 'demande')
      },
      () => setEtat(demandee ? '' : 'demande'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  // Accord déjà donné : position lue à l'ouverture ; sinon un bouton, jamais de demande d'office
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    let actif = true
    const permissions = navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    if (!permissions) { setEtat('demande'); return }
    permissions.then((r) => {
      if (!actif) return
      if (r.state === 'granted') localiser(false)
      else if (r.state === 'prompt') setEtat('demande')
    }, () => { if (actif) setEtat('demande') })
    return () => { actif = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!magasins.length) return null
  return (
    <>
      {proche ? (
        <Card component="section" aria-label="Au magasin" sx={{ bgcolor: '#1d1d1b', color: '#ffffff', border: 0, p: 1.5, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25 }}>
            <MyLocationOutlined sx={{ color: '#f8bb09' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ color: '#e6e1da' }}>Au magasin</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.125rem', color: '#f8bb09', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proche.nom}</Typography>
            </Box>
            <Button variant="contained" onClick={() => setVisite(true)} sx={{ minHeight: 48, bgcolor: '#f8bb09', color: '#1d1d1b', flexShrink: 0, '&:hover': { bgcolor: '#e0a800' } }}>Saisir la visite</Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button component={RouterLink} to={lienPreparation(proche.nom)} startIcon={<AssignmentOutlined />} sx={{ minHeight: 48, color: '#ffffff', borderColor: '#5f5f66' }} variant="outlined">Préparer</Button>
            <Button component={RouterLink} to={lienFiche(proche.nom)} startIcon={<StorefrontOutlined />} sx={{ minHeight: 48, color: '#ffffff', borderColor: '#5f5f66' }} variant="outlined">Fiche</Button>
          </Box>
        </Card>
      ) : (etat === 'demande' || etat === 'cherche' || etat === 'loin') && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
          <Button variant="outlined" startIcon={<MyLocationOutlined />} onClick={() => localiser(true)} disabled={etat === 'cherche'} sx={{ minHeight: 48, bgcolor: 'background.paper' }}>
            {etat === 'cherche' ? 'Recherche…' : 'Je suis au magasin'}
          </Button>
          {etat === 'loin' && <Typography variant="body2" color="text.secondary">Aucun de tes magasins à moins de 300 m.</Typography>}
        </Box>
      )}
      {visite && proche && <DialogVisite reseau={reseau} visite={null} magasinsInitiaux={[proche.nom]} onFermer={(m) => { setVisite(false); if (m) setMessage(m) }} />}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </>
  )
}
