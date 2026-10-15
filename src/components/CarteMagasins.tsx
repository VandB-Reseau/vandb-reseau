import { useEffect, useMemo, useRef, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { CircleMarker, MapContainer, Marker, Pane, Polygon, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { createPortal } from 'react-dom'
import 'leaflet/dist/leaflet.css'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import ToggleButton from '@mui/material/ToggleButton'
import Typography from '@mui/material/Typography'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import LayersOutlined from '@mui/icons-material/LayersOutlined'
import CheckBoxOutlined from '@mui/icons-material/CheckBoxOutlined'
import CheckBoxOutlineBlankOutlined from '@mui/icons-material/CheckBoxOutlineBlankOutlined'
import { Bulle, BoutonOutil, boutonGroupeSx, groupeSx, useTelephone } from './Outils'
import PersonPinCircleOutlined from '@mui/icons-material/PersonPinCircleOutlined'
import FullscreenOutlined from '@mui/icons-material/FullscreenOutlined'
import FullscreenExitOutlined from '@mui/icons-material/FullscreenExitOutlined'
import HubOutlined from '@mui/icons-material/HubOutlined'
import BadgeOutlined from '@mui/icons-material/BadgeOutlined'
import { lienCoach, lienFiche, lienRR } from '../lib/format'
import { contourZone, couleurAuto, grappes, type Point } from '../data/zones'
import { statutLibelle, type Coach, type Magasin, type Reseau, type ResponsableRegional, type Statut } from '../data/modele'
import { cleCommune, centreCommune, normaliserVille } from '../data/geocodage'
import { cleFiche, estFrance, type FichePersonnelle } from '../data/personnes'


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

// Pictos des personnes (tracés des icônes Material Person et SupervisorAccount)
const TRACE_COACH = 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4m0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4'
const TRACE_RR = 'M16.5 12c1.38 0 2.49-1.12 2.49-2.5S17.88 7 16.5 7C15.12 7 14 8.12 14 9.5s1.12 2.5 2.5 2.5M9 11c1.66 0 2.99-1.34 2.99-3S10.66 5 9 5C7.34 5 6 6.34 6 8s1.34 3 3 3m7.5 3c-1.83 0-5.5.92-5.5 2.75V19h11v-2.25c0-1.83-3.67-2.75-5.5-2.75M9 13c-2.33 0-7 1.17-7 3.5V19h7v-2.25c0-.85.33-2.34 2.37-3.47C10.5 13.1 9.66 13 9 13'

type TypePicto = 'coach' | 'rr'
const couleurSure = (c: string) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : GRIS)
// Coach : rond cerclé de blanc ; Responsable Régional : carré cerclé de noir, plus grand
function htmlPicto(type: TypePicto, couleur: string, taille: number) {
  const rr = type === 'rr'
  const bord = rr ? '#1b1b1f' : '#ffffff'
  return `<div style="box-sizing:border-box;width:${taille}px;height:${taille}px;border-radius:${rr ? '7px' : '50%'};background:${couleurSure(couleur)};border:${rr ? 3 : 2.5}px solid ${bord};box-shadow:0 1px 4px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center">`
    + `<svg viewBox="0 0 24 24" width="${Math.round(taille * 0.62)}" height="${Math.round(taille * 0.62)}" aria-hidden="true"><path fill="#ffffff" stroke="#1b1b1f" stroke-width="0.6" d="${rr ? TRACE_RR : TRACE_COACH}"/></svg></div>`
}
const icones = new Map<string, ReturnType<typeof divIcon>>()
const iconePicto = (type: TypePicto, couleur: string) => {
  const cle = `${type}${couleur}`
  if (!icones.has(cle)) {
    const taille = type === 'rr' ? 36 : 32
    icones.set(cle, divIcon({ html: htmlPicto(type, couleur, taille), className: `picto-${type}`, iconSize: [taille, taille], iconAnchor: [taille / 2, taille / 2], popupAnchor: [0, -taille / 2] }))
  }
  return icones.get(cle)!
}

// Fiche lue sans se fier au format enregistré (anciennes saisies, imports)
const texte = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const fiche = (f: Partial<FichePersonnelle> | undefined) => ({ ville: texte(f?.ville), codePostal: texte(f?.codePostal), departement: texte(f?.departement), pays: texte(f?.pays) })

interface PersonneCarte { cle: string; type: TypePicto; nom: string; role: string; couleur: string; ville: string; codePostal: string; departement: string; domicile: Point | null; lien: string; magasins: number }

// Carte : un point par magasin ; zones des Coachs et des Responsables Régionaux, affichables séparément
// restreindre : seuls les Coachs et RR des magasins affichés (liste filtrée)
export function CarteMagasins({ magasins, rrs, equipe = [], personnes = {}, restreindre = false, vue = vueDuJour, margeBas = 24, zonesInitiales = { coachs: true, rr: false }, emplacementBoutons = null }: {
  // Où poser les boutons (ligne des filtres) ; à défaut, juste au-dessus de la carte
  emplacementBoutons?: HTMLElement | null
  magasins: Magasin[]; rrs: ResponsableRegional[]; equipe?: Coach[]; personnes?: Reseau['personnes']; restreindre?: boolean; vue?: VueCarte; margeBas?: number; zonesInitiales?: { coachs: boolean; rr: boolean }
}) {
  const [zonesCoachs, setZonesCoachs] = useState(zonesInitiales.coachs)
  const [zonesRR, setZonesRR] = useState(zonesInitiales.rr)
  const [voirPersonnes, setVoirPersonnes] = useState(true)
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
      // Responsable Magasins Intégrés : rôle transverse, sans territoire, donc sans zone
      if (r.integres) return
      const l = actifs.filter((m) => vue.rrDe(m)?.id === r.id)
      if (l.length) res.push({ cle: `r:${r.id}`, nom: r.nom, couleur: r.couleur, magasins: l, rr: true })
    })
    return res.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }, [places, vue, rrs, couleurCoach])

  // Coachs et RR placés à leur ville de rattachement (fiche personne)
  const listePersonnes = useMemo(() => {
    const aujourdhui = new Date().toISOString().slice(0, 10)
    const res: PersonneCarte[] = []
    for (const c of equipe) {
      if (c.fictif || (c.arrivee && c.arrivee > aujourdhui)) continue
      const n = magasins.filter((m) => vue.coachDe(m) === c.nom).length
      if (restreindre && !n) continue
      const f = fiche(personnes[cleFiche({ type: 'coach', cle: c.nom })])
      if (f.pays && !estFrance(f.pays) && c.lat === null) continue
      const ville = f.ville || texte(c.ville)
      // Position connue de l'ancienne app, tant que la ville n'a pas changé
      const domicile = c.lat !== null && c.lon !== null && (!f.ville || !c.ville || normaliserVille(f.ville) === normaliserVille(texte(c.ville))) ? { lat: c.lat, lon: c.lon } : null
      res.push({ cle: `coach:${c.nom}`, type: 'coach', nom: c.nom, role: 'Coach', couleur: c.couleur, ville, codePostal: f.codePostal, departement: f.departement, domicile, lien: lienCoach(c.nom), magasins: n })
    }
    for (const r of rrs) {
      const n = magasins.filter((m) => vue.rrDe(m)?.id === r.id).length
      if (restreindre && !n) continue
      const f = fiche(personnes[cleFiche({ type: 'rr', cle: r.id })])
      if (f.pays && !estFrance(f.pays)) continue
      res.push({ cle: `rr:${r.id}`, type: 'rr', nom: r.nom, role: r.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional', couleur: r.couleur, ville: f.ville, codePostal: f.codePostal, departement: f.departement, domicile: null, lien: lienRR(r.id), magasins: n })
    }
    return res
  }, [equipe, rrs, personnes, magasins, vue, restreindre])
  const [centres, setCentres] = useState<Record<string, Point | null>>({})
  // Communes à situer, une seule demande par commune
  const communes = useMemo(() => new Map(listePersonnes.filter((p) => !p.domicile && (p.ville || p.codePostal))
    .map((p) => [cleCommune(p.codePostal, p.ville), { codePostal: p.codePostal, ville: p.ville, departement: p.departement }])), [listePersonnes])
  const cleCommunes = [...communes.keys()].sort().join(';')
  useEffect(() => {
    const ctrl = new AbortController()
    communes.forEach((c, cle) => {
      centreCommune(c.codePostal, c.ville, ctrl.signal, c.departement).then((pt) => { if (pt !== undefined && !ctrl.signal.aborted) setCentres((x) => ({ ...x, [cle]: pt })) })
    })
    return () => ctrl.abort()
  }, [cleCommunes]) // eslint-disable-line react-hooks/exhaustive-deps
  const personnesPlacees = listePersonnes.map((p) => ({ ...p, position: p.domicile ?? centres[cleCommune(p.codePostal, p.ville)] ?? null }))
    .filter((p): p is PersonneCarte & { position: Point } => p.position !== null)
  const personnesSansVille = listePersonnes.filter((p) => !p.domicile && !p.ville && !p.codePostal).length

  const zonesVisibles = zones.filter((z) => (z.rr ? zonesRR : zonesCoachs))
  const legende = zonesCoachs
    ? zones.filter((z) => !z.rr).map((z) => ({ cle: z.cle, nom: z.nom, couleur: z.couleur }))
    : rrs.filter((r) => places.some((m) => vue.rrDe(m)?.id === r.id)).map((r) => ({ cle: r.id, nom: r.nom, couleur: r.couleur }))

  // La carte occupe toute la hauteur restante de l'écran, légende comprise
  const carteRef = useRef<HTMLDivElement>(null)
  const legendeRef = useRef<HTMLDivElement>(null)
  const [hauteur, setHauteur] = useState(500)
  const [pleinEcran, setPleinEcran] = useState(false)
  const compact = useTelephone()
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const calculer = () => {
      const haut = carteRef.current?.getBoundingClientRect().top ?? 0
      const leg = (legendeRef.current?.offsetHeight ?? 0) + 12
      setHauteur(pleinEcran ? window.innerHeight : Math.max(280, Math.floor(window.innerHeight - haut - leg - margeBas)))
    }
    calculer()
    window.addEventListener('resize', calculer)
    return () => window.removeEventListener('resize', calculer)
  }, [margeBas, legende.length, nonPlaces, zonesCoachs, pleinEcran, voirPersonnes, personnesPlacees.length, personnesSansVille])
  useEffect(() => {
    if (!pleinEcran) return
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setPleinEcran(false) }
    window.addEventListener('keydown', echap)
    return () => window.removeEventListener('keydown', echap)
  }, [pleinEcran])

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

  // Boutons hors de la carte : dans la ligne des filtres, ou au-dessus de la carte en plein écran
  const affichages = [
    { cle: 'coachs', actif: zonesCoachs, basculer: () => setZonesCoachs((v) => !v), icone: <PersonPinCircleOutlined />, long: 'Zones des Coachs' },
    { cle: 'rr', actif: zonesRR, basculer: () => setZonesRR((v) => !v), icone: <HubOutlined />, long: 'Zones des Responsables Régionaux' },
    { cle: 'personnes', actif: voirPersonnes, basculer: () => setVoirPersonnes((v) => !v), icone: <BadgeOutlined />, long: 'Coachs et Responsables Régionaux' },
  ]
  // Boutons hors de la carte : dans la ligne des filtres, ou au-dessus de la carte en plein écran.
  // Sur téléphone, les trois affichages tiennent dans un seul bouton pour laisser la place à la recherche.
  const boutons = (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexShrink: 0 }}>
      {compact ? (
        <>
          <BoutonOutil libelle="Affichage de la carte" icone={<LayersOutlined />} onClick={(e) => setMenu(e.currentTarget)} actif={Boolean(menu)} attributs={{ 'aria-haspopup': 'menu' }} />
          <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} sx={{ zIndex: 1500 }}>
            {affichages.map((b) => (
              <MenuItem key={b.cle} role="menuitemcheckbox" aria-checked={b.actif} onClick={b.basculer} sx={{ minHeight: 48, gap: 1.5 }}>
                {b.actif ? <CheckBoxOutlined color="primary" /> : <CheckBoxOutlineBlankOutlined />}{b.icone}<Typography variant="body2">{b.long}</Typography>
              </MenuItem>
            ))}
          </Menu>
        </>
      ) : (
        <Box role="group" aria-label="Zones affichées" sx={groupeSx}>
          {affichages.map((b) => (
            <Bulle key={b.cle} titre={b.long}>
              <ToggleButton value={b.cle} selected={b.actif} onChange={b.basculer} aria-label={b.long} sx={boutonGroupeSx}>{b.icone}</ToggleButton>
            </Bulle>
          ))}
        </Box>
      )}
      <BoutonOutil libelle={pleinEcran ? 'Quitter le plein écran' : 'Carte en plein écran'} icone={pleinEcran ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={() => setPleinEcran((v) => !v)} actif={pleinEcran} />
    </Box>
  )

  return (
    <Box>
      {emplacementBoutons && !pleinEcran && createPortal(boutons, emplacementBoutons)}
      <Box ref={carteRef} sx={{ position: pleinEcran ? 'fixed' : 'relative', inset: pleinEcran ? 0 : undefined, zIndex: pleinEcran ? 1400 : undefined, bgcolor: pleinEcran ? 'background.default' : undefined, height: hauteur, display: 'flex', flexDirection: 'column', gap: 1, p: pleinEcran ? 1 : 0 }}>
        {(pleinEcran || !emplacementBoutons) && boutons}
        <Box sx={{ flex: 1, minHeight: 0, borderRadius: pleinEcran ? 2 : 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
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
          {voirPersonnes && personnesPlacees.map((p) => (
            <Marker key={p.cle} position={[p.position.lat, p.position.lon]} icon={iconePicto(p.type, p.couleur)} title={`${p.role} : ${p.nom}`} alt={`${p.role} : ${p.nom}`} zIndexOffset={p.type === 'rr' ? 200 : 100}>
              <Popup>
                <Typography variant="subtitle2" component="div">{p.nom}</Typography>
                <Typography variant="body2" component="div">{p.role}{p.ville ? ` · ${p.ville}` : ''}</Typography>
                <Typography variant="body2" component="div">{p.magasins} magasin{p.magasins > 1 ? 's' : ''}</Typography>
                <Link component={RouterLink} to={p.lien} variant="body2">Ouvrir la fiche</Link>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        </Box>
      </Box>
      <Box ref={legendeRef} sx={{ display: 'flex', flexWrap: { xs: 'nowrap', sm: 'wrap' }, overflowX: { xs: 'auto', sm: 'visible' }, columnGap: 2, rowGap: 1, mt: 1.5, pb: { xs: 0.5, sm: 0 }, alignItems: 'center', '& > *': { flexShrink: 0, whiteSpace: 'nowrap' } }} aria-label="Légende de la carte">
        {legende.map((l) => (
          <Box key={l.cle} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: l.couleur, flexShrink: 0 }} />
            <Typography variant="body2">{l.nom}</Typography>
          </Box>
        ))}
        {voirPersonnes && (['coach', 'rr'] as const).filter((t) => personnesPlacees.some((p) => p.type === t)).map((t) => (
          <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box aria-hidden sx={{ display: 'flex' }} dangerouslySetInnerHTML={{ __html: htmlPicto(t, GRIS, 20) }} />
            <Typography variant="body2">{t === 'coach' ? 'Coach' : 'Responsable Régional'}</Typography>
          </Box>
        ))}
        {zonesRR && <Typography variant="body2" color="text.secondary">Pointillés : zones des Responsables Régionaux (RR)</Typography>}
        {vue.modifies?.size ? <Typography variant="body2" color="text.secondary">Cerclés de noir : magasins qui changent de Coach dans le plan</Typography> : null}
        {voirPersonnes && personnesSansVille > 0 && <Typography variant="body2" color="text.secondary">{personnesSansVille} Coach{personnesSansVille > 1 ? 's' : ''} ou RR sans ville renseignée, non affiché{personnesSansVille > 1 ? 's' : ''}</Typography>}
        {nonPlaces > 0 && <Typography variant="body2" color="text.secondary">{nonPlaces} magasin{nonPlaces > 1 ? 's' : ''} sans position précise, non affiché{nonPlaces > 1 ? 's' : ''}</Typography>}
      </Box>
    </Box>
  )
}
