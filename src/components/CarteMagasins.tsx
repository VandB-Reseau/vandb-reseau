import { useEffect, useMemo, useRef, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { CircleMarker, MapContainer, Pane, Polygon, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import ToggleButton from '@mui/material/ToggleButton'
import Typography from '@mui/material/Typography'
import PersonPinCircleOutlined from '@mui/icons-material/PersonPinCircleOutlined'
import HubOutlined from '@mui/icons-material/HubOutlined'
import { lienFiche } from '../lib/format'
import { contourZone, couleurAuto, grappes, type Point } from '../data/zones'
import { statutLibelle, type Coach, type Magasin, type ResponsableRegional, type Statut } from '../data/modele'

function AjusterTaille({ hauteur }: { hauteur: number }) {
  const map = useMap()
  useEffect(() => { map.invalidateSize() }, [map, hauteur])
  return null
}

// Organisation affichée : celle du jour par défaut, ou celle d'un plan d'affectation simulé
export interface VueCarte {
  coachDe: (m: Magasin) => string
  rrDe: (m: Magasin) => ResponsableRegional | null
  statutDe: (m: Magasin) => Statut
  modifies?: Map<string, string> // magasin -> Coach avant le plan
}

const vueDuJour: VueCarte = { coachDe: (m) => m.coach, rrDe: (m) => m.rr, statutDe: (m) => m.statut }

interface Zone { cle: string; nom: string; couleur: string; magasins: (Magasin & Point)[]; rr: boolean }

const GRIS = '#6b6b73'

// Carte : un point par magasin ; zones des Coachs et des Responsables Régionaux, affichables séparément
export function CarteMagasins({ magasins, rrs, equipe = [], vue = vueDuJour, margeBas = 24, zonesInitiales = { coachs: true, rr: false } }: {
  magasins: Magasin[]; rrs: ResponsableRegional[]; equipe?: Coach[]; vue?: VueCarte; margeBas?: number; zonesInitiales?: { coachs: boolean; rr: boolean }
}) {
  const [zonesCoachs, setZonesCoachs] = useState(zonesInitiales.coachs)
  const [zonesRR, setZonesRR] = useState(zonesInitiales.rr)
  const places = useMemo(() => magasins.filter((m): m is Magasin & Point => m.lat !== null && m.lon !== null), [magasins])
  const nonPlaces = magasins.length - places.length
  const couleurCoach = useMemo(() => new Map(equipe.map((c) => [c.nom, c.couleur])), [equipe])
  const couleurDe = (coach: string) => couleurCoach.get(coach) ?? couleurAuto(coach)

  // Une zone regroupe les magasins en activité ou en préparation (pas ceux « à venir »)
  const zones = useMemo(() => {
    const actifs = places.filter((m) => vue.statutDe(m) !== 'avenir')
    const res: Zone[] = []
    const parCoach = new Map<string, (Magasin & Point)[]>()
    actifs.forEach((m) => { const c = vue.coachDe(m); if (c) parCoach.set(c, [...(parCoach.get(c) ?? []), m]) })
    parCoach.forEach((l, c) => res.push({ cle: `c:${c}`, nom: c, couleur: couleurCoach.get(c) ?? couleurAuto(c), magasins: l, rr: false }))
    rrs.forEach((r) => {
      // Responsable Magasins Intégrés : rôle transverse, sa zone couvre tous les magasins intégrés
      const l = actifs.filter((m) => (r.integres ? !m.franchise : vue.rrDe(m)?.id === r.id))
      if (l.length) res.push({ cle: `r:${r.id}`, nom: r.nom, couleur: r.couleur, magasins: l, rr: true })
    })
    return res.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }, [places, vue, rrs, couleurCoach])
  const zonesVisibles = zones.filter((z) => (z.rr ? zonesRR : zonesCoachs))
  const legende = zonesCoachs
    ? zones.filter((z) => !z.rr).map((z) => ({ cle: z.cle, nom: z.nom, couleur: z.couleur }))
    : rrs.filter((r) => places.some((m) => vue.rrDe(m)?.id === r.id)).map((r) => ({ cle: r.id, nom: r.nom, couleur: r.couleur }))

  // La carte occupe toute la hauteur restante de l'écran, légende comprise
  const carteRef = useRef<HTMLDivElement>(null)
  const legendeRef = useRef<HTMLDivElement>(null)
  const [hauteur, setHauteur] = useState(500)
  useEffect(() => {
    const calculer = () => {
      const haut = carteRef.current?.getBoundingClientRect().top ?? 0
      const leg = (legendeRef.current?.offsetHeight ?? 0) + 12
      setHauteur(Math.max(280, Math.floor(window.innerHeight - haut - leg - margeBas)))
    }
    calculer()
    window.addEventListener('resize', calculer)
    return () => window.removeEventListener('resize', calculer)
  }, [margeBas, legende.length, nonPlaces, zonesCoachs])

  const couleurPoint = (m: Magasin) => {
    const coach = vue.coachDe(m)
    if (zonesCoachs) return coach ? couleurDe(coach) : vue.rrDe(m)?.couleur ?? GRIS
    return vue.rrDe(m)?.couleur ?? GRIS
  }

  const dessinerZone = (z: Zone) => grappes(z.magasins).map((g, i) => (
    <Polygon
      key={`${z.cle}:${i}`}
      positions={contourZone(g, z.rr ? 24 : 12)}
      pathOptions={{ color: z.couleur, weight: z.rr ? 2.5 : 2, fillColor: z.couleur, fillOpacity: z.rr ? 0.06 : 0.14, dashArray: z.rr ? '8 6' : undefined }}
      className={z.rr ? 'zone-rr' : 'zone-coach'}
    >
      <Tooltip sticky>{z.rr ? 'Responsable Régional' : 'Coach'} : {z.nom} · {z.magasins.length} magasin{z.magasins.length > 1 ? 's' : ''}</Tooltip>
    </Polygon>
  ))

  return (
    <Box>
      <Box ref={carteRef} sx={{ position: 'relative', height: hauteur, borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        {/* Boutons posés sur la carte pour lui laisser toute la hauteur */}
        <Box role="group" aria-label="Zones affichées" sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          {[
            { cle: 'coachs', actif: zonesCoachs, basculer: () => setZonesCoachs((v) => !v), icone: <PersonPinCircleOutlined fontSize="small" />, long: 'Zones des Coachs', court: 'Zones Coach' },
            { cle: 'rr', actif: zonesRR, basculer: () => setZonesRR((v) => !v), icone: <HubOutlined fontSize="small" />, long: 'Zones des Responsables Régionaux', court: 'Zones RR' },
          ].map((b) => (
            <ToggleButton key={b.cle} value={b.cle} size="small" color="primary" selected={b.actif} onChange={b.basculer} aria-label={b.long}
              sx={{ minHeight: 48, px: 2, gap: 1, borderRadius: 6, bgcolor: 'background.paper', boxShadow: 2, '&:hover': { bgcolor: 'background.paper' }, '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'primary.main', color: 'primary.contrastText' } }}>
              {b.icone}<Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{b.long}</Box><Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{b.court}</Box>
            </ToggleButton>
          ))}
        </Box>
        <MapContainer center={[46.6, 2.4]} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <AjusterTaille hauteur={hauteur} />
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {/* Zones RR sous les zones Coach, elles-mêmes sous les magasins */}
          <Pane name="zones-rr" style={{ zIndex: 350 }}>{zonesVisibles.filter((z) => z.rr).flatMap(dessinerZone)}</Pane>
          <Pane name="zones-coachs" style={{ zIndex: 360 }}>{zonesVisibles.filter((z) => !z.rr).flatMap(dessinerZone)}</Pane>
          {places.map((m) => {
            const statut = vue.statutDe(m)
            const avant = vue.modifies?.get(m.nom)
            const coach = vue.coachDe(m)
            return (
              <CircleMarker
                key={m.nom}
                center={[m.lat, m.lon]}
                radius={avant !== undefined ? 9 : statut === 'avenir' || statut === 'preouverture' ? 6 : 7}
                pathOptions={{ color: avant !== undefined ? '#1b1b1f' : '#ffffff', weight: avant !== undefined ? 3 : 1.5, fillColor: couleurPoint(m), fillOpacity: statut === 'avenir' ? 0.45 : 0.95, dashArray: statut === 'avenir' ? '3' : undefined }}
              >
                <Popup>
                  <Typography variant="subtitle2" component="div">{m.nom}</Typography>
                  <Typography variant="body2" component="div">{statutLibelle[statut]} · {m.franchise ? 'Franchisé' : 'Intégré'}</Typography>
                  <Typography variant="body2" component="div">Coach : {coach || (m.rrEnDirect ? 'aucun, géré en direct par le Responsable Régional' : 'aucun')}</Typography>
                  {avant !== undefined && <Typography variant="body2" component="div">Proposé dans le plan, avant : {avant || 'aucun Coach'}</Typography>}
                  <Link component={RouterLink} to={lienFiche(m.nom)} variant="body2">Ouvrir la fiche</Link>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </Box>
      <Box ref={legendeRef} sx={{ display: 'flex', flexWrap: { xs: 'nowrap', sm: 'wrap' }, overflowX: { xs: 'auto', sm: 'visible' }, columnGap: 2, rowGap: 1, mt: 1.5, pb: { xs: 0.5, sm: 0 }, alignItems: 'center', '& > *': { flexShrink: 0, whiteSpace: 'nowrap' } }} aria-label="Légende de la carte">
        {legende.map((l) => (
          <Box key={l.cle} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: l.couleur, flexShrink: 0 }} />
            <Typography variant="body2">{l.nom}</Typography>
          </Box>
        ))}
        {zonesRR && <Typography variant="body2" color="text.secondary">Pointillés : zones des Responsables Régionaux (RR)</Typography>}
        {vue.modifies?.size ? <Typography variant="body2" color="text.secondary">Cerclés de noir : magasins qui changent de Coach dans le plan</Typography> : null}
        {nonPlaces > 0 && <Typography variant="body2" color="text.secondary">{nonPlaces} magasin{nonPlaces > 1 ? 's' : ''} sans position précise, non affiché{nonPlaces > 1 ? 's' : ''}</Typography>}
      </Box>
    </Box>
  )
}
