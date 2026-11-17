// Maquette 265 (Joseph, 17/11/2026) : l'historique d'un magasin en tableau sur PC (date, type, quoi, par qui, compte
// rendu ou photos), en lignes sur téléphone. Une ligne par élément : une quinzaine visibles d'un coup d'œil, au lieu
// des grandes cartes du fil. La ligne ouvre l'élément (compte rendu, note du journal à modifier, ou sa page).
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined'
import type { ElementFil, GenreFil } from '../data/fil'
import { useOuvrirCompteRendu } from './ApercuCompteRendu'
import { dateCourte } from '../lib/format'
import { brand } from '../theme/theme'

const TYPE: Record<GenreFil, { libelle: string; fond: string; texte: string }> = {
  visite: { libelle: 'Visite', fond: '#e3f0ef', texte: brand.vertFonce },
  tache: { libelle: 'Tâche', fond: '#fdf3d6', texte: '#7a5800' },
  message: { libelle: 'Message', fond: '#f0ece5', texte: '#4a4540' },
  journal: { libelle: 'Journal', fond: '#efe9f7', texte: '#54457a' },
  pratique: { libelle: 'Bonne pratique', fond: '#fde9df', texte: brand.brique },
  chiffres: { libelle: 'Chiffres', fond: '#f0ece5', texte: '#4a4540' },
  communication: { libelle: 'Communication', fond: '#f0ece5', texte: '#4a4540' },
  animation: { libelle: 'Campagne', fond: '#f0ece5', texte: '#4a4540' },
}
const PAS = 30

function Etiquette({ genre }: { genre: GenreFil }) {
  const t = TYPE[genre]
  return <Chip label={t.libelle} size="small" sx={{ bgcolor: t.fond, color: t.texte, fontWeight: 700, fontSize: '0.75rem', height: 24 }} />
}

// Le sujet de la ligne : titre (tâche, compte rendu…) ou texte, sinon l'action (« a visité »)
function sujet(e: ElementFil): { principal: string; second?: string } {
  const action = e.action.charAt(0).toUpperCase() + e.action.slice(1)
  if (e.titre) return { principal: e.titre, second: e.texte }
  if (e.valeur) return { principal: `${action} : ${e.valeur}`, second: e.texte }
  if (e.texte) return { principal: e.texte, second: action }
  return { principal: action }
}

export function TableauActivite({ elements, ouvrirJournal }: { elements: ElementFil[]; ouvrirJournal?: (e: ElementFil) => void }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [nombre, setNombre] = useState(PAS)
  const naviguer = useNavigate()
  const ouvrirCR = useOuvrirCompteRendu()
  const ouvrir = (e: ElementFil) => {
    if (e.libelleOuvrir && ouvrirJournal) ouvrirJournal(e)
    else if (e.genre === 'visite' && e.visiteId) ouvrirCR(e.visiteId)
    else naviguer(e.lien)
  }
  // Compte rendu et photos : de petites icônes, au lieu des vignettes
  const pieces = (e: ElementFil): ReactNode => (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
      {e.genre === 'visite' && e.visiteId && (
        <Tooltip title="Compte rendu"><IconButton aria-label={`Ouvrir le compte rendu de ${e.magasin}`} onClick={(ev) => { ev.stopPropagation(); ouvrirCR(e.visiteId!) }}
          sx={{ width: 48, height: 48, color: brand.brique }}><PictureAsPdfOutlined /></IconButton></Tooltip>
      )}
      {!!e.photos?.length && (
        <Tooltip title={`${e.photos.length} photo${e.photos.length > 1 ? 's' : ''}`}><Box aria-label={`${e.photos.length} photo${e.photos.length > 1 ? 's' : ''}`}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', minHeight: 48, typography: 'body2' }}><PhotoLibraryOutlined fontSize="small" />{e.photos.length}</Box></Tooltip>
      )}
    </Box>
  )
  const liste = elements.slice(0, nombre)
  const suite = elements.length > nombre && (
    <Box sx={{ pt: 1 }}><Button onClick={() => setNombre((n) => n + PAS)} sx={{ minHeight: 48 }}>Voir {Math.min(PAS, elements.length - nombre)} de plus</Button></Box>
  )
  if (!surPC) {
    return (
      <Box role="list" aria-label="Historique du magasin">
        {liste.map((e, i) => {
          const s = sujet(e)
          return (
            <Box role="listitem" key={e.cle} sx={{ display: 'flex', alignItems: 'center', borderTop: i ? '1px solid' : 0, borderColor: 'divider' }}>
              <ButtonBase onClick={() => ouvrir(e)} aria-label={e.libelleOuvrir}
                sx={{ flex: 1, minWidth: 0, display: 'block', textAlign: 'left', py: 1.25, minHeight: 56, fontFamily: 'inherit' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Etiquette genre={e.genre} />
                  <Typography variant="body2" color="text.secondary">{[dateCourte(e.instant.slice(0, 10)), e.auteur].filter(Boolean).join(' · ')}</Typography>
                </Box>
                <Typography sx={{ fontWeight: 600, mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{s.principal}</Typography>
                {s.second && <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{s.second}</Typography>}
              </ButtonBase>
              {pieces(e)}
            </Box>
          )
        })}
        {suite}
      </Box>
    )
  }
  return (
    <>
      <Table size="small" aria-label="Historique du magasin" sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 96 }}>Date</TableCell>
            <TableCell sx={{ width: 150 }}>Type</TableCell>
            <TableCell>Quoi</TableCell>
            <TableCell sx={{ width: 180 }}>Par</TableCell>
            <TableCell sx={{ width: 112 }} aria-label="Pièces" />
          </TableRow>
        </TableHead>
        <TableBody>
          {liste.map((e) => {
            const s = sujet(e)
            return (
              <TableRow key={e.cle} hover onClick={() => ouvrir(e)} sx={{ cursor: 'pointer' }}>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>{dateCourte(e.instant.slice(0, 10))}</TableCell>
                <TableCell><Etiquette genre={e.genre} /></TableCell>
                <TableCell sx={{ minWidth: 0 }}>
                  <ButtonBase onClick={(ev) => { ev.stopPropagation(); ouvrir(e) }} aria-label={e.libelleOuvrir}
                    sx={{ display: 'block', textAlign: 'left', width: '100%', minHeight: 40, fontFamily: 'inherit' }}>
                    <Typography sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.principal}</Typography>
                    {s.second && <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.second}</Typography>}
                  </ButtonBase>
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.auteur || '—'}</TableCell>
                <TableCell sx={{ py: 0 }}>{pieces(e)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {suite}
    </>
  )
}
