// 386 (Joseph, 24/11/2026) : affichage « Carte » de l'onglet Pilotage. Un rond par magasin, coloré selon son écart (à
// l'an dernier, au budget) ou selon sa place face à la médiane de la sélection ; taille selon le montant pour une somme.
// Un clic ouvre la bulle du magasin avec le lien vers sa fiche. Calcul par le moteur des rapports (src/data/rapports.ts).
import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { AttributionControl, CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { brand } from '../theme/theme'
import {
  COMPARAISONS, calculer, comparable, ecartFavorable, ecartReference, formater, formaterEcart, indicateur, mediane,
  type Contexte, type Definition, type Indicateur,
} from '../data/rapports'

const NEUTRE = '#8a8580'

export default function CarteRapport({ ctx, def, surPC }: { ctx: Contexte; def: Definition; surPC: boolean }) {
  const inds = def.indicateurs.map(indicateur).filter((i): i is Indicateur => !!i && i.agregat !== 'texte' && (ctx.equipe || !i.equipeSeule))
  const [choisi, setChoisi] = useState<string | null>(null)
  const i = inds.find((x) => x.id === choisi) ?? inds[0]
  const points = useMemo(() => {
    if (!i) return { liste: [], sansPosition: 0, reference: '' }
    const comp = def.comparer && def.comparer !== 'aucune' && comparable(i, def.comparer) ? def.comparer : undefined
    const r = calculer(ctx, { ...def, lignes: 'magasin', colonnes: 'aucun', comparer: comp, tri: null })
    const k = `${i.id}|${r.colonnes[0].cle}`
    const parNom = new Map(ctx.reseau.magasins.map((m) => [m.nom, m]))
    const lignes = r.lignes.filter((l) => l.cellules[k]?.valeur !== null)
    const avecPosition = lignes.filter((l) => { const m = parNom.get(l.libelle); return m && m.lat !== null && m.lon !== null })
    const nums = lignes.map((l) => l.cellules[k].valeur!)
    const med = mediane(nums), haut = Math.max(...nums.map(Math.abs), 1)
    const liste = avecPosition.map((l) => {
      const m = parNom.get(l.libelle)!
      const c = l.cellules[k]
      const e = comp ? ecartReference(i, c, l.refs?.[k]) : i.format === 'ecart' ? c.valeur : null
      const v = c.valeur!
      const bon = e !== null ? (e === 0 ? null : ecartFavorable(i, e)) : med === null || v === med || nums.length < 3 ? null : (v > med) !== !!i.inverse
      const rayon = i.agregat === 'somme' ? 5 + Math.sqrt(Math.abs(v) / haut) * 11 : 8
      return {
        nom: m.nom, lat: m.lat!, lon: m.lon!, rayon, couleur: bon === null ? NEUTRE : bon ? brand.vertFonce : brand.brique,
        texte: `${formater(i.format, c)}${e !== null && comp ? ` (${formaterEcart(i, e)})` : ''}`,
      }
    })
    return { liste, sansPosition: lignes.length - avecPosition.length, reference: comp ? COMPARAISONS.find((x) => x.cle === comp)!.court : '' }
  }, [ctx, def, i])

  if (!i) return <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Ajoute un indicateur chiffré pour le voir sur la carte.</Typography>
  return (
    <Card variant="outlined" aria-label="Carte du rapport" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: '14px', mb: 2 }}>
      {inds.length > 1 && (
        <Box role="group" aria-label="Indicateur sur la carte" sx={{ display: 'flex', gap: 0.75, flexWrap: surPC ? 'wrap' : 'nowrap', overflowX: 'auto', mb: 1.5, pb: surPC ? 0 : 0.5 }}>
          {inds.map((x) => {
            const actif = x.id === i.id
            return <Chip key={x.id} label={x.libelle} clickable color={actif ? 'secondary' : 'default'} variant={actif ? 'filled' : 'outlined'} aria-pressed={actif}
              onClick={() => setChoisi(x.id)} sx={{ minHeight: { xs: 48, md: 36 }, borderRadius: 999, flexShrink: 0, fontWeight: actif ? 700 : 500 }} />
          })}
        </Box>
      )}
      {/* Téléphone : boutons de zoom à la taille du doigt */}
      <Box sx={{ height: { xs: 380, md: 520 }, borderRadius: '10px', overflow: 'hidden', position: 'relative', zIndex: 0,
        '& .leaflet-container .leaflet-control-zoom a': { width: { xs: 48, md: 30 }, height: { xs: 48, md: 30 }, lineHeight: { xs: '48px', md: '30px' } } }}>
        <MapContainer center={[46.6, 2.4]} zoom={surPC ? 6 : 5} style={{ height: '100%', width: '100%' }} scrollWheelZoom={surPC} attributionControl={false}>
          <AttributionControl prefix={false} />
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {points.liste.map((p) => (
            <CircleMarker key={p.nom} center={[p.lat, p.lon]} radius={p.rayon} pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: p.couleur, fillOpacity: 0.85 }}>
              <Tooltip>{`${p.nom} : ${p.texte}`}</Tooltip>
              <Popup>
                <Typography sx={{ fontWeight: 700 }}>{p.nom}</Typography>
                <Typography variant="body2">{i.libelle} : {p.texte}</Typography>
                <Link component={RouterLink} to={`/magasins/${encodeURIComponent(p.nom)}`}>Ouvrir la fiche</Link>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1, alignItems: 'center' }}>
        {[[brand.vertFonce, points.reference ? `Mieux que ${points.reference}` : 'Au-dessus de la médiane'], [brand.brique, points.reference ? `Moins bien que ${points.reference}` : 'En dessous de la médiane']].map(([c, t]) => (
          <Typography key={t} variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box component="span" aria-hidden sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c }} />{t}
          </Typography>
        ))}
        {points.sansPosition > 0 && <Typography variant="caption" color="text.secondary">{points.sansPosition} magasin{points.sansPosition > 1 ? 's' : ''} sans position ne {points.sansPosition > 1 ? 'sont' : 'est'} pas sur la carte.</Typography>}
      </Box>
      {/* Liste lisible par les lecteurs d'écran et pour les tests : la carte seule ne se lit pas */}
      <Box component="ul" aria-label="Magasins sur la carte" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', m: 0, p: 0 }}>
        {points.liste.map((p) => <li key={p.nom}>{`${p.nom} : ${p.texte}`}</li>)}
      </Box>
    </Card>
  )
}
