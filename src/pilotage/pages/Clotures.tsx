import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import CheckCircle from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedOutlined from '@mui/icons-material/RadioButtonUncheckedOutlined'
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined'
import { BarreSelection, CaseEntete, CaseLigne, useSelection } from '../../components/Selection'
import { anneeSuivi } from '../data/annees'
import { chargerBudgets, chargerQuadrimestres, chargerReelDuCompte } from '../data/pilotage'
import { pilotage } from '../lib/supabase'
import { useChargement } from '../data/useChargement'
import { Panne } from '../components/Panne'
import { dernierMoisClos, etapesCloture } from '../components/ClotureMois'
import { apresRelances, relancerFranchise } from '../data/taches'
import { lienMagasin } from '../lib/format'

// Clôtures du mois pour le réseau (refonte vague 2, Joseph 09/11/2026, 12A) : qui a fini ses saisies du mois, qui manque,
// et la relance des franchisés en retard en une fois (16A). Le Coach et le RR voient leurs magasins.
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

async function stocksDuReseau(annee: number): Promise<Record<string, number[]>> {
  try {
    const { data, error } = await pilotage().from('stocks').select('store_name, mois').eq('annee', annee)
    if (error || !Array.isArray(data)) return {}
    const r: Record<string, number[]> = {}
    for (const l of data as { store_name: string; mois: number }[]) (r[l.store_name] ??= []).push(Number(l.mois))
    return r
  } catch { return {} }
}

export function Clotures() {
  const annee = anneeSuivi()
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const navigate = useNavigate()
  const dernier = Math.max(1, dernierMoisClos(annee))
  const [mois, setMois] = useState(dernier)
  const [message, setMessage] = useState('')
  const [occupe, setOccupe] = useState(false)
  const { donnees, erreur, chargement, recharger } = useChargement(async () => {
    const [d, reel, quadris, stocks] = await Promise.all([chargerBudgets(annee), chargerReelDuCompte(annee), chargerQuadrimestres(annee).catch(() => ({})), stocksDuReseau(annee)])
    return { d, reel, quadris: quadris as Record<string, Record<number, unknown>>, stocks }
  }, [annee])
  const lignes = useMemo(() => {
    if (!donnees) return []
    return donnees.d.magasins.map((l) => {
      const reelMois = (donnees.reel.magasins[l.magasin]?.n ?? []).map((x, i) => (x.caHT > 0 ? i + 1 : 0)).filter(Boolean)
      const etapes = etapesCloture({ mois, annee, reelMois, stockSaisi: (donnees.stocks[l.magasin] ?? []).includes(mois), fraisRenseignes: !!donnees.d.frais[l.magasin]?.length,
        quadrimestres: Object.keys(donnees.quadris[l.magasin] ?? {}).map(Number) })
      return { magasin: l.magasin, coach: donnees.reel.coachs[l.magasin] ?? '', etapes, faits: etapes.filter((e) => e.fait).length }
    }).sort((a, b) => a.faits - b.faits || a.magasin.localeCompare(b.magasin, 'fr'))
  }, [donnees, mois, annee])
  const cles = useMemo(() => lignes.map((l) => l.magasin), [lignes])
  const s = useSelection(cles)
  const nomMois = `${MOIS[mois - 1]} ${annee}`
  const relancer = async () => {
    setOccupe(true)
    const echeance = new Date(annee, mois, 10).toISOString().slice(0, 10)
    let faites = 0
    for (const m of s.liste) {
      try { await relancerFranchise(m, `Compléter la clôture de ${nomMois}`, echeance); faites++ } catch { /* suivant */ }
    }
    apresRelances()
    setOccupe(false)
    s.vider()
    setMessage(faites ? `${faites} relance${faites > 1 ? 's' : ''} envoyée${faites > 1 ? 's' : ''} : une tâche pour chaque franchisé, à faire avant le 10.` : 'Les relances n’ont pas pu partir. Réessaie dans un instant.')
  }
  if (chargement && !donnees) return <Skeleton variant="rounded" height={320} />
  if (erreur || !donnees) return <Panne quoi="Les clôtures" recharger={recharger} />
  const complets = lignes.filter((l) => l.faits === l.etapes.length).length
  const etapesNoms = lignes[0]?.etapes.map((e) => e.libelle) ?? []
  return (
    <Box component="section" aria-label="Clôtures du mois">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <IconButton aria-label="Mois précédent" disabled={mois <= 1} onClick={() => setMois(mois - 1)} sx={{ width: 48, height: 48 }}><ChevronLeftOutlined /></IconButton>
        <Typography variant="h2" sx={{ minWidth: 190, textAlign: 'center' }}>{nomMois.charAt(0).toUpperCase() + nomMois.slice(1)}</Typography>
        <IconButton aria-label="Mois suivant" disabled={mois >= dernier} onClick={() => setMois(mois + 1)} sx={{ width: 48, height: 48 }}><ChevronRightOutlined /></IconButton>
        <Typography variant="body2" sx={{ ml: { sm: 'auto' }, fontWeight: 700 }}>{`${complets} magasin${complets > 1 ? 's' : ''} sur ${lignes.length} ${complets > 1 ? 'ont' : 'a'} fini`}</Typography>
      </Box>
      <Card>
        <TableContainer>
          <Table size="small" aria-label={`Clôtures de ${nomMois}`}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ pl: 2 }}><CaseEntete s={s} /></TableCell>
                <TableCell>Magasin</TableCell>
                {surPC && <TableCell>Coach</TableCell>}
                {surPC ? etapesNoms.map((n) => <TableCell key={n} align="center">{n}</TableCell>) : <TableCell>Fait</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {lignes.map((l) => (
                <TableRow key={l.magasin} hover selected={s.choisis.has(l.magasin)} onClick={() => navigate(lienMagasin(l.magasin, 'cloture'))} sx={{ cursor: 'pointer' }}>
                  <TableCell padding="checkbox" sx={{ pl: 2 }}><CaseLigne s={s} cle={l.magasin} nom={l.magasin} /></TableCell>
                  <TableCell><Link component={RouterLink} to={lienMagasin(l.magasin, 'cloture')} onClick={(e) => e.stopPropagation()} sx={{ fontWeight: 600, display: 'inline-flex', minHeight: 40, alignItems: 'center' }}>{l.magasin}</Link></TableCell>
                  {surPC && <TableCell>{l.coach}</TableCell>}
                  {surPC
                    ? l.etapes.map((e) => (
                      <TableCell key={e.cle} align="center" aria-label={`${e.libelle} : ${e.fait ? 'fait' : 'à faire'}`}>
                        {e.fait ? <CheckCircle fontSize="small" sx={{ color: 'success.main' }} /> : <RadioButtonUncheckedOutlined fontSize="small" sx={{ color: 'text.secondary' }} />}
                      </TableCell>
                    ))
                    : <TableCell sx={{ fontWeight: 700, color: l.faits === l.etapes.length ? 'success.main' : 'warning.main' }}>{`${l.faits} sur ${l.etapes.length}`}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      <BarreSelection s={s} quoi="magasin">
        <Button variant="outlined" startIcon={<NotificationsActiveOutlined />} disabled={occupe} onClick={() => void relancer()}>Relancer les franchisés</Button>
      </BarreSelection>
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </Box>
  )
}
