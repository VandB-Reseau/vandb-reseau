import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Link from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme, type Theme } from '@mui/material/styles'
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined'
import CelebrationOutlined from '@mui/icons-material/CelebrationOutlined'
import ConstructionOutlined from '@mui/icons-material/ConstructionOutlined'
import DoNotDisturbOnOutlined from '@mui/icons-material/DoNotDisturbOnOutlined'
import HandshakeOutlined from '@mui/icons-material/HandshakeOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import SwapHorizOutlined from '@mui/icons-material/SwapHorizOutlined'
import { CarteLignes, ChoixAffichage, Initiales, LigneCompacte, useAffichage, cartouche } from '../components/Social'
import { LigneOuverture } from '../components/Ouverture'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { dateLongue, lienFiche } from '../lib/format'
import { mandatsARenouveler } from '../data/associes'
import { texteSituation } from '../data/situations'
import type { Magasin, Reseau, TypeSituation } from '../data/modele'

// Année civile, de janvier à décembre
export const anneeDe = (iso: string) => Number(iso.slice(0, 4))

function lignes(reseau: Reseau) {
  const tous = [...reseau.magasins, ...reseau.fermes]
  // Date d'ouverture posée par défaut à l'import (projet sans date) : pas comptée
  const datees = tous.filter((m) => m.ouvertureConnue)
  const sortis = tous.filter((m) => m.fermeture)
  const toutes = [...datees.map((m) => anneeDe(m.ouverture)), ...sortis.map((m) => anneeDe(m.fermeture!.date))]
  if (!toutes.length) return []
  // Toutes les années de la première à la dernière, même sans ouverture (une année vide compte à 0)
  const annees = Array.from({ length: Math.max(...toutes) - Math.min(...toutes) + 1 }, (_, i) => Math.min(...toutes) + i)
  let cumul = 0
  const annee = anneeDe(reseau.jour)
  return annees.map((a) => {
    const ouvertures = datees.filter((m) => anneeDe(m.ouverture) === a).sort((x, y) => x.ouverture.localeCompare(y.ouverture))
    const sorties = sortis.filter((m) => anneeDe(m.fermeture!.date) === a).sort((x, y) => x.fermeture!.date.localeCompare(y.fermeture!.date))
    cumul += ouvertures.length - sorties.length
    return {
      a, ouvertures, sorties, cumul, enCours: a === annee,
      prevues: ouvertures.filter((m) => m.ouverture > reseau.jour).length + sorties.filter((m) => m.fermeture!.date > reseau.jour).length,
    }
  })
}

// À venir sur 12 mois : ouvertures, inaugurations, fins de mandat, passages intégré ou franchisé, sorties, fermetures provisoires
type Genre = TypeSituation | 'ouverture' | 'mandat'
const icones: Record<Genre, ReactNode> = {
  ouverture: <StorefrontOutlined />, inauguration: <CelebrationOutlined />, mandat: <HandshakeOutlined />, integre: <SwapHorizOutlined />,
  franchise: <SwapHorizOutlined />, sortie: <DoNotDisturbOnOutlined />, travaux: <ConstructionOutlined />,
}
function aVenir(reseau: Reseau) {
  const d = new Date(`${reseau.jour}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 12)
  const limite = d.toISOString().slice(0, 10)
  const l: { date: string; genre: Genre; m: Magasin; texte: string }[] = []
  for (const m of [...reseau.magasins, ...reseau.fermes]) {
    if (m.ouverture > reseau.jour && m.ouverture <= limite) l.push({ date: m.ouverture, genre: 'ouverture', m, texte: `Ouverture le ${dateLongue(m.ouverture)}` })
    for (const s of m.situations) {
      const enCours = s.type === 'travaux' && s.date <= reseau.jour && (s.fin ?? s.date) >= reseau.jour
      if ((s.date > reseau.jour || enCours) && s.date <= limite) l.push({ date: enCours ? reseau.jour : s.date, genre: s.type, m, texte: texteSituation(s) })
    }
  }
  for (const x of mandatsARenouveler(reseau, reseau.magasins)) {
    if (x.mandat.fin >= reseau.jour) l.push({ date: x.mandat.fin, genre: 'mandat', m: x.m, texte: `Fin de mandat de ${x.a.nom} le ${dateLongue(x.mandat.fin)}` })
  }
  return l.sort((a, b) => a.date.localeCompare(b.date) || a.m.nom.localeCompare(b.m.nom, 'fr'))
}

// Vert lisible sur fond clair comme sombre
const vert = (theme: Theme) => ({ color: theme.vars!.palette.success.dark, ...theme.applyStyles('dark', { color: theme.vars!.palette.success.light }) })

// Parc en fin d'année au-dessus des barres : une colonne par année, mêmes largeurs que les barres
function CourbeParc({ annees, jour }: { annees: ReturnType<typeof lignes>; jour: string }) {
  const n = annees.length
  const parcs = annees.map((x) => x.cumul)
  const bas = Math.min(...parcs), haut = Math.max(...parcs)
  // Hauteur du point dans la bande, en % depuis le haut (place gardée au-dessus pour le chiffre)
  const y = (v: number) => (haut === bas ? 60 : 88 - ((v - bas) / (haut - bas)) * 56)
  const annee = anneeDe(jour)
  const points = (l: typeof annees) => l.map((x) => `${annees.indexOf(x) + 0.5},${y(x.cumul)}`).join(' ')
  const passees = annees.filter((x) => x.a <= annee)
  const futures = annees.filter((x) => x.a >= annee)
  return (
    <Box role="img" aria-label={`Parc en fin d’année : ${annees.map((x) => `${x.a} ${x.cumul}`).join(' ; ')}`}
      sx={{ position: 'relative', height: 96, mb: 1.5, color: 'success.main' }}>
      <Box component="svg" viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" aria-hidden
        sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        {passees.length > 1 && <polyline points={points(passees)} fill="none" stroke="currentColor" strokeWidth={3} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
        {futures.length > 1 && <polyline points={points(futures)} fill="none" stroke="currentColor" strokeWidth={3} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />}
      </Box>
      {annees.map((x, i) => (
        <Box key={x.a} sx={{ position: 'absolute', left: `${((i + 0.5) / n) * 100}%`, top: `${y(x.cumul)}%`, transform: 'translate(-50%, -50%)' }}>
          <Typography variant="body2" sx={[{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', fontWeight: 700, whiteSpace: 'nowrap', opacity: x.a > annee ? 0.7 : 1 }, vert]}>{x.cumul}</Typography>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid', borderColor: 'success.main', bgcolor: x.a > annee ? 'background.paper' : 'success.main' }} />
        </Box>
      ))}
    </Box>
  )
}

const signe = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')
const detailAnnee = (x: ReturnType<typeof lignes>[number]) => [
  x.ouvertures.length ? x.ouvertures.map((m) => m.nom).join(', ') : '',
  x.sorties.length ? `${x.sorties.length > 1 ? 'Sortis' : 'Sorti'} : ${x.sorties.map((m) => m.nom).join(', ')}` : '',
].filter(Boolean).join(' · ') || 'Aucune ouverture'

function Contenu({ reseau }: { reseau: Reseau }) {
  const l = lignes(reseau)
  const max = Math.max(1, ...l.map((x) => Math.max(x.ouvertures.length, x.sorties.length)))
  const recentes = l.slice(-8)
  const avecSorties = l.some((x) => x.sorties.length)
  const sansDate = reseau.magasins.filter((m) => !m.ouvertureConnue).length
  const ouverts = reseau.magasins.filter((m) => m.ouverture && m.ouverture <= reseau.jour).length
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [affichage, setAffichage] = useAffichage('evolution')
  const prochains = aVenir(reseau)
  const prevues = (x: ReturnType<typeof lignes>[number]) => (x.prevues ? `dont ${x.prevues} prévue${x.prevues > 1 ? 's' : ''} · ` : '')
  return (
    <>
      <PageHeader titre="Évolution du parc" sousTitre={`${ouverts} magasins ouverts aujourd’hui`} />
      {sansDate > 0 && <Alert severity="info" sx={{ mb: 3 }}>{`${sansDate} magasin${sansDate > 1 ? 's' : ''} sans date d’ouverture ${sansDate > 1 ? 'ne sont' : 'n’est'} pas compté${sansDate > 1 ? 's' : ''}.`}</Alert>}
      {prochains.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography component="h2" sx={[cartouche, { mb: 1.5 }]}>À venir sur 12 mois</Typography>
          <CarteLignes label="À venir sur 12 mois">
            {prochains.map((x) => x.genre === 'ouverture'
              ? <LigneOuverture key={`${x.genre}-${x.m.nom}-${x.date}`} reseau={reseau} m={x.m} lien={lienFiche(x.m.nom)} avatar={<Initiales nom={x.m.nom} icone={icones[x.genre]} />} />
              : <LigneCompacte key={`${x.genre}-${x.m.nom}-${x.date}-${x.texte}`} lien={lienFiche(x.m.nom)} avatar={<Initiales nom={x.m.nom} icone={icones[x.genre]} />}
                titre={x.m.nom} detail={x.texte} />)}
          </CarteLignes>
        </Box>
      )}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography component="h2" sx={[cartouche, { mb: 2 }]}>{avecSorties ? 'Ouvertures et sorties par année' : 'Ouvertures par année'}</Typography>
          <CourbeParc annees={recentes} jour={reseau.jour} />
          <Box sx={{ display: 'flex', alignItems: 'flex-end', height: 200 }} role="img"
            aria-label={`Ouvertures : ${recentes.map((x) => `${x.a} ${x.ouvertures.length}${x.sorties.length ? `, ${x.sorties.length} sortie${x.sorties.length > 1 ? 's' : ''}` : ''}`).join(' ; ')}`}>
            {recentes.map((x) => (
              <Box key={x.a} sx={{ flex: 1, minWidth: 0, px: { xs: 0.5, md: 1 }, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {x.ouvertures.length}{x.sorties.length > 0 && <Box component="span" sx={{ color: 'error.main' }}> −{x.sorties.length}</Box>}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '100%', maxWidth: 64, justifyContent: 'center' }}>
                  <Box sx={{ flex: 2, height: `${(x.ouvertures.length / max) * 140}px`, minHeight: 4, borderRadius: '8px 8px 0 0', bgcolor: x.ouvertures.length ? (x.enCours ? 'secondary.main' : 'primary.main') : 'divider', opacity: x.a > anneeDe(reseau.jour) ? 0.5 : 1 }} />
                  {x.sorties.length > 0 && <Box sx={{ flex: 1, height: `${(x.sorties.length / max) * 140}px`, borderRadius: '8px 8px 0 0', bgcolor: 'error.main' }} />}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{x.a}</Typography>
              </Box>
            ))}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}><Box component="span" sx={[{ fontWeight: 700 }, vert]}>En vert</Box> : magasins dans le réseau en fin d’année</Typography>
          {avecSorties && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}><Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}>En rouge</Box> : sorties du réseau (fermeture, liquidation, tombée d’enseigne, cession)</Typography>}
        </CardContent>
      </Card>
      {surPC && <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}><ChoixAffichage valeur={affichage} onChange={setAffichage} /></Box>}
      {!surPC || affichage === 'lignes' ? (
        <CarteLignes label="Évolution par année">
          {[...l].reverse().map((x) => (
            <LigneCompacte key={x.a} avatar={<Initiales nom={String(x.a)} icone={<CalendarTodayOutlined />} />}
              titre={`${x.a}${x.enCours ? ' (en cours)' : ''}`}
              detail={detailAnnee(x)}
              fin={<Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                  +{x.ouvertures.length}{x.sorties.length > 0 && <Box component="span" sx={{ color: 'error.main' }}> −{x.sorties.length}</Box>}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{prevues(x)}{x.cumul} au total</Typography>
              </Box>} />
          ))}
        </CarteLignes>
      ) : (
      <TableContainer component={Card}>
        <Table aria-label="Évolution par année">
          <TableHead>
            <TableRow>
              <TableCell>Année</TableCell>
              <TableCell align="right">Ouvertures</TableCell>
              <TableCell align="right">Sorties</TableCell>
              <TableCell align="right">Solde</TableCell>
              <TableCell align="right">Taille du réseau</TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Magasins</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...l].reverse().map((x) => (
              <TableRow key={x.a} selected={x.enCours}>
                <TableCell>{x.a}{x.enCours ? ' (en cours)' : ''}</TableCell>
                <TableCell align="right">{x.ouvertures.length}</TableCell>
                <TableCell align="right">{x.sorties.length}</TableCell>
                <TableCell align="right">{signe(x.ouvertures.length - x.sorties.length)}{x.prevues ? ` (dont ${x.prevues} prévue${x.prevues > 1 ? 's' : ''})` : ''}</TableCell>
                <TableCell align="right">{x.cumul}</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                  {x.ouvertures.map((m: Magasin, i) => <span key={m.nom}>{i > 0 && ', '}<Link component={RouterLink} to={lienFiche(m.nom)}>{m.nom}</Link></span>)}
                  {x.sorties.length > 0 && <>{x.ouvertures.length > 0 && ' · '}Sortis : {x.sorties.map((m: Magasin, i) => <span key={m.nom}>{i > 0 && ', '}<Link component={RouterLink} to={lienFiche(m.nom)}>{m.nom}</Link></span>)}</>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      )}
    </>
  )
}

export function Evolution() {
  return <AvecReseau>{(reseau) => <Contenu reseau={reseau} />}</AvecReseau>
}
