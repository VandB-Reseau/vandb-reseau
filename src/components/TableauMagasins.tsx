import { useMemo, useState, type KeyboardEvent } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { Blason } from './Blason'
import { Pastille } from './Social'
import { useCreer } from './Creer'
import { lienFiche } from '../lib/format'
import { libelleSuivi } from '../data/charge'
import { statutLibelle, type Magasin, type Reseau } from '../data/modele'
import { analyser, formatKEuros, formatPourcent, libelleMois } from '../data/chiffres'
import { caseDe, visitesParAn } from '../data/sante'
import { actionsEnCours } from '../data/actions'
import { anneeDe, suiviRythme } from '../data/visites'
import { useReseau } from '../data/ReseauContext'
import type { TriMagasins } from './ListeMagasins'

// Liste des magasins sur PC en vrai tableau (refonte, Joseph 09/11/2026, choix 5A) : lignes de 44 px, colonnes triables,
// une ligne cliquée ouvre l'aperçu à droite sans quitter la liste ; le nom ouvre la fiche. Le téléphone garde ses lignes.
interface Infos { ca: number | null; mois: string | null; ecart: number | null; caseLibelle: string; rang: number; depuis: number | null; alerteVisite: boolean; taches: number; alerte: 'decroche' | 'surveiller' | null }

function infosDe(reseau: Reseau | null): Map<string, Infos> {
  const res = new Map<string, Infos>()
  if (!reseau) return res
  const rythme = new Map(suiviRythme(reseau, anneeDe(reseau.jour)).map((l) => [l.magasin.nom, l]))
  const taches = new Map<string, number>()
  for (const x of actionsEnCours(reseau, null)) taches.set(x.magasin, (taches.get(x.magasin) ?? 0) + 1)
  for (const m of reseau.magasins) {
    const a = analyser(reseau, m.nom)
    const c = caseDe(reseau.evaluations[m.nom])
    const l = rythme.get(m.nom)
    res.set(m.nom, {
      ca: a?.ca ?? null, mois: a?.mois ?? null, ecart: a?.ecart ?? null, caseLibelle: c?.libelle ?? '', rang: c ? visitesParAn(c) : 0,
      depuis: l?.derniere ? l.depuis ?? 0 : null, alerteVisite: !!l?.alerte, taches: taches.get(m.nom) ?? 0,
      alerte: a?.statut === 'decroche' || a?.statut === 'surveiller' ? a.statut : null,
    })
  }
  return res
}

const colonnes: { v: TriMagasins | null; libelle: string; droite?: boolean; largeur?: number }[] = [
  { v: 'nom', libelle: 'Magasin' },
  { v: null, libelle: 'Coach' },
  { v: null, libelle: 'Responsable Régional' },
  { v: null, libelle: 'CA du mois', droite: true, largeur: 104 },
  { v: 'ca', libelle: 'vs N-1', droite: true, largeur: 88 },
  { v: 'case', libelle: 'Nine box', largeur: 168 },
  { v: 'visite', libelle: 'Dernière visite', droite: true, largeur: 120 },
  { v: 'taches', libelle: 'Tâches', droite: true, largeur: 76 },
]

const PAS = 100

export function TableauMagasins({ magasins, tri, trier }: { magasins: Magasin[]; tri: TriMagasins; trier: (t: TriMagasins) => void }) {
  const { reseau } = useReseau()
  const naviguer = useNavigate()
  const infos = useMemo(() => infosDe(reseau), [reseau])
  const [choisi, setChoisi] = useState<string | null>(null)
  const [nb, setNb] = useState(PAS)
  const tries = useMemo(() => {
    const parNom = (x: Magasin, y: Magasin) => x.nom.localeCompare(y.nom, 'fr')
    const i = (m: Magasin) => infos.get(m.nom)
    const liste = [...magasins]
    if (tri === 'visite') return liste.sort((x, y) => (i(y)?.depuis ?? Infinity) - (i(x)?.depuis ?? Infinity) || parNom(x, y))
    if (tri === 'case') return liste.sort((x, y) => (i(y)?.rang ?? 0) - (i(x)?.rang ?? 0) || parNom(x, y))
    if (tri === 'taches') return liste.sort((x, y) => (i(y)?.taches ?? 0) - (i(x)?.taches ?? 0) || parNom(x, y))
    if (tri === 'ca') return liste.sort((x, y) => (i(x)?.ecart ?? Infinity) - (i(y)?.ecart ?? Infinity) || parNom(x, y))
    return liste.sort(parNom)
  }, [magasins, tri, infos])
  const visibles = tries.slice(0, nb)
  const apercu = choisi ? magasins.find((m) => m.nom === choisi) ?? null : null
  // Totaux en pied : CA du mois des magasins affichés et écart pondéré face à l'an dernier
  const total = useMemo(() => {
    let ca = 0, ref = 0, n = 0
    for (const m of magasins) {
      const x = infos.get(m.nom)
      if (x?.ca === null || x?.ca === undefined) continue
      ca += x.ca; n++
      if (x.ecart !== null) ref += x.ca / (1 + x.ecart / 100)
    }
    return { ca: n ? ca : null, ecart: ref ? ((ca - ref) / ref) * 100 : null }
  }, [magasins, infos])
  const ouvrir = (nom: string) => setChoisi((c) => (c === nom ? null : nom))
  const clavier = (e: KeyboardEvent, nom: string) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(nom) } }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: apercu ? 'minmax(0, 1fr) 320px' : 'minmax(0, 1fr)', gap: 2, alignItems: 'start' }}>
      <Card sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small" aria-label="Tableau des magasins" sx={{ '& td, & th': { py: 0.75, px: 1.5, fontSize: '0.875rem' }, '& tbody tr': { height: 44, cursor: 'pointer' }, '& tbody tr:hover': { bgcolor: 'action.hover' } }}>
            <TableHead>
              <TableRow>
                {colonnes.map((c) => (
                  <TableCell key={c.libelle} align={c.droite ? 'right' : 'left'} sx={{ width: c.largeur, fontWeight: 700, color: 'text.secondary', whiteSpace: 'nowrap' }}
                    sortDirection={c.v && tri === c.v ? (c.v === 'nom' ? 'asc' : 'desc') : false}>
                    {c.v ? (
                      <TableSortLabel active={tri === c.v} direction={c.v === 'nom' || c.v === 'ca' ? 'asc' : 'desc'} onClick={() => trier(c.v!)} aria-label={`Trier par ${c.libelle === 'vs N-1' ? 'évolution du CA' : c.libelle.toLowerCase()}`}>
                        {c.libelle}
                      </TableSortLabel>
                    ) : c.libelle}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {visibles.map((m) => {
                const x = infos.get(m.nom)
                const actif = choisi === m.nom
                return (
                  <TableRow key={m.nom} selected={actif} hover tabIndex={0} aria-selected={actif} onClick={() => ouvrir(m.nom)} onDoubleClick={() => naviguer(lienFiche(m.nom))} onKeyDown={(e) => clavier(e, m.nom)}>
                    <TableCell sx={{ minWidth: 200 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <Blason magasin={m} taille={28} />
                        <Link component={RouterLink} to={lienFiche(m.nom)} color="inherit" underline="hover" onClick={(e) => e.stopPropagation()} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{m.nom}</Link>
                        {x?.alerte === 'decroche' && <Pastille ton="rouge">Décroche</Pastille>}
                        {x?.alerte === 'surveiller' && <Pastille ton="orange">À surveiller</Pastille>}
                        {m.statut !== 'ouvert' && <Pastille ton={m.statut === 'nouveau' ? 'bleu' : 'gris'}>{statutLibelle[m.statut]}</Pastille>}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{libelleSuivi(m) || '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{m.rr?.nom ?? '—'}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{x?.ca !== null && x?.ca !== undefined ? formatKEuros(x.ca) : '—'}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: x?.ecart === null || x?.ecart === undefined ? 'text.secondary' : x.ecart <= -5 ? 'error.main' : x.ecart < 0 ? 'warning.dark' : 'success.dark' }}>
                      {x?.ecart === null || x?.ecart === undefined ? '—' : formatPourcent(x.ecart)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: x?.caseLibelle ? 'text.primary' : 'text.secondary' }}>{x?.caseLibelle || 'Non classé'}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: x?.alerteVisite ? 'warning.dark' : 'text.secondary', fontWeight: x?.alerteVisite ? 600 : 400 }}>
                      {x?.depuis === null || x?.depuis === undefined ? 'jamais' : `il y a ${x.depuis} j`}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{x?.taches || ''}</TableCell>
                  </TableRow>
                )
              })}
              <TableRow sx={{ '&&': { cursor: 'default', height: 44 }, '&&:hover': { bgcolor: 'transparent' }, '& td': { borderBottom: 0, fontWeight: 700 } }}>
                <TableCell colSpan={3} sx={{ color: 'text.secondary' }}>{magasins.length} magasin{magasins.length > 1 ? 's' : ''}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatKEuros(total.ca)}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{total.ecart === null ? '—' : formatPourcent(total.ecart)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        {nb < tries.length && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button variant="outlined" onClick={() => setNb(nb + PAS)}>Afficher {Math.min(PAS, tries.length - nb)} magasins de plus</Button>
          </Box>
        )}
      </Card>
      {apercu && <Apercu m={apercu} infos={infos.get(apercu.nom)} fermer={() => setChoisi(null)} />}
    </Box>
  )
}

// Aperçu d'un magasin à droite du tableau : l'essentiel et les actions courantes, sans quitter la liste
function Apercu({ m, infos, fermer }: { m: Magasin; infos: Infos | undefined; fermer: () => void }) {
  const creer = useCreer()
  const naviguer = useNavigate()
  const ligne = (libelle: string, valeur: string, couleur?: string) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: couleur, textAlign: 'right' }}>{valeur}</Typography>
    </Box>
  )
  const ecart = infos?.ecart ?? null
  return (
    <Card component="aside" aria-label={`Aperçu de ${m.nom}`} sx={{ p: 2, position: 'sticky', top: 16, display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Blason magasin={m} taille={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h3" component="h2" sx={{ fontSize: '1.25rem' }} noWrap>{m.nom}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>{[m.franchise ? 'Franchisé' : 'Intégré', m.ville].filter(Boolean).join(' · ')}</Typography>
        </Box>
        <Tooltip title="Fermer l’aperçu"><IconButton onClick={fermer} aria-label="Fermer l’aperçu" sx={{ width: 40, height: 40 }}><CloseOutlined /></IconButton></Tooltip>
      </Box>
      <Box>
        {ligne(infos?.mois ? `CA de ${libelleMois(infos.mois)}` : 'CA du mois', formatKEuros(infos?.ca ?? null))}
        {ligne('Évolution vs N-1', ecart === null ? '—' : formatPourcent(ecart), ecart === null ? undefined : ecart <= -5 ? 'error.main' : ecart < 0 ? 'warning.dark' : 'success.dark')}
        {ligne('Nine box', infos?.caseLibelle || 'Non classé')}
        {ligne('Dernière visite', infos?.depuis === null || infos?.depuis === undefined ? 'jamais' : `il y a ${infos.depuis} j`, infos?.alerteVisite ? 'warning.dark' : undefined)}
        {ligne('Tâches en cours', String(infos?.taches ?? 0))}
        {ligne('Coach', libelleSuivi(m) || '—')}
        {ligne('Responsable Régional', m.rr?.nom ?? '—')}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={() => naviguer(lienFiche(m.nom))}>Ouvrir la fiche</Button>
        <Button variant="outlined" onClick={() => creer('visite', m.nom)}>Visite</Button>
        <Button variant="outlined" onClick={() => creer('tache', m.nom)}>Tâche</Button>
      </Box>
    </Card>
  )
}
