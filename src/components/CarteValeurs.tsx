// 399 (Joseph, 24/11/2026) : affichage « Carte » de Face au budget et de Chiffres des magasins, comme celui de Pilotage
// (CarteRapport) : un rond par magasin, vert s'il fait mieux que la référence, brique sinon, gris sans comparaison.
// Positions lues dans le réseau du compte ; les magasins sans position sont comptés sous la carte.
import { Link as RouterLink } from 'react-router-dom'
import { AttributionControl, CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { brand } from '../theme/theme'
import { useReseauSiDispo } from '../data/ReseauContext'

export interface PointCarte { nom: string; texte: string; bon: boolean | null; lien: string }
const NEUTRE = '#8a8580'

export default function CarteValeurs({ points, titre, mieux, moins, surPC }: { points: PointCarte[]; titre: string; mieux: string; moins: string; surPC: boolean }) {
  const etat = useReseauSiDispo()
  const parNom = new Map((etat?.complet ?? etat?.reseau)?.magasins.map((m) => [m.nom, m]) ?? [])
  const places = points.flatMap((p) => { const m = parNom.get(p.nom); return m && m.lat !== null && m.lon !== null ? [{ ...p, lat: m.lat, lon: m.lon }] : [] })
  const sans = points.length - places.length
  return (
    <Card variant="outlined" aria-label={titre} sx={{ p: { xs: 1.5, md: 2 }, borderRadius: '14px', mb: 2, position: 'relative' }}>
      <Box sx={{ height: { xs: 380, md: 520 }, borderRadius: '10px', overflow: 'hidden', position: 'relative', zIndex: 0,
        '& .leaflet-container .leaflet-control-zoom a': { width: { xs: 48, md: 30 }, height: { xs: 48, md: 30 }, lineHeight: { xs: '48px', md: '30px' } } }}>
        <MapContainer center={[46.6, 2.4]} zoom={surPC ? 6 : 5} style={{ height: '100%', width: '100%' }} scrollWheelZoom={surPC} attributionControl={false}>
          <AttributionControl prefix={false} />
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {places.map((p) => (
            <CircleMarker key={p.nom} center={[p.lat, p.lon]} radius={8} pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: p.bon === null ? NEUTRE : p.bon ? brand.vertFonce : brand.brique, fillOpacity: 0.85 }}>
              <Tooltip>{`${p.nom} : ${p.texte}`}</Tooltip>
              <Popup>
                <Typography sx={{ fontWeight: 700 }}>{p.nom}</Typography>
                <Typography variant="body2">{p.texte}</Typography>
                <Link component={RouterLink} to={p.lien}>Ouvrir la fiche</Link>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1, alignItems: 'center' }}>
        {[[brand.vertFonce, mieux], [brand.brique, moins], [NEUTRE, 'Sans comparaison']].map(([c, t]) => (
          <Typography key={t} variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box component="span" aria-hidden sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c }} />{t}
          </Typography>
        ))}
        {sans > 0 && <Typography variant="caption" color="text.secondary">{sans} magasin{sans > 1 ? 's' : ''} sans position ne {sans > 1 ? 'sont' : 'est'} pas sur la carte.</Typography>}
      </Box>
      {/* Liste lisible par les lecteurs d'écran et pour les tests : la carte seule ne se lit pas */}
      <Box component="ul" aria-label="Magasins sur la carte" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', m: 0, p: 0 }}>
        {places.map((p) => <li key={p.nom}>{`${p.nom} : ${p.texte}`}</li>)}
      </Box>
    </Card>
  )
}
