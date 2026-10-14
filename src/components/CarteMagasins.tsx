import { Link as RouterLink } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { lienFiche } from '../lib/format'
import { statutLibelle, type Magasin, type ResponsableRegional } from '../data/modele'

// Carte : un point par magasin, coloré par Responsable Régional
export function CarteMagasins({ magasins, rrs, hauteur = 600 }: { magasins: Magasin[]; rrs: ResponsableRegional[]; hauteur?: number | string }) {
  const places = magasins.filter((m) => m.lat !== null && m.lon !== null)
  const nonPlaces = magasins.length - places.length
  const rrPresents = rrs.filter((r) => places.some((m) => m.rr?.id === r.id))
  return (
    <Box>
      <Box sx={{ height: hauteur, borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <MapContainer center={[46.6, 2.4]} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {places.map((m) => (
            <CircleMarker
              key={m.nom}
              center={[m.lat!, m.lon!]}
              radius={m.statut === 'avenir' || m.statut === 'preouverture' ? 6 : 7}
              pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: m.rr?.couleur ?? '#6b6b73', fillOpacity: m.statut === 'avenir' ? 0.45 : 0.95, dashArray: m.statut === 'avenir' ? '3' : undefined }}
            >
              <Popup>
                <Typography variant="subtitle2" component="div">{m.nom}</Typography>
                <Typography variant="body2" component="div">{statutLibelle[m.statut]} · {m.franchise ? 'Franchisé' : 'Intégré'}</Typography>
                <Typography variant="body2" component="div">Coach : {m.coach || 'aucun'}</Typography>
                <Link component={RouterLink} to={lienFiche(m.nom)} variant="body2">Ouvrir la fiche</Link>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1.5, alignItems: 'center' }}>
        {rrPresents.map((r) => (
          <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: r.couleur }} />
            <Typography variant="body2">{r.nom}</Typography>
          </Box>
        ))}
        {nonPlaces > 0 && <Typography variant="body2" color="text.secondary">{nonPlaces} magasin{nonPlaces > 1 ? 's' : ''} sans position précise, non affiché{nonPlaces > 1 ? 's' : ''}</Typography>}
      </Box>
    </Box>
  )
}
