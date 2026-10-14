import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import Typography from '@mui/material/Typography'
import { PastilleStatut, PastilleType } from './Pastilles'
import { dateCourte, lienFiche } from '../lib/format'
import type { Magasin } from '../data/modele'

type Colonne = 'nom' | 'departement' | 'statut' | 'type' | 'coach' | 'rr' | 'responsable' | 'ouverture'
const ordreStatut = { preouverture: 0, nouveau: 1, ouvert: 2, avenir: 3 }

const valeur = (m: Magasin, c: Colonne): string | number => {
  switch (c) {
    case 'statut': return ordreStatut[m.statut]
    case 'type': return m.franchise ? 0 : 1
    case 'rr': return m.rr?.nom ?? '~'
    case 'responsable': return m.responsable?.nom ?? '~'
    case 'coach': return m.coach || '~'
    case 'departement': return m.departement.padStart(3, '0')
    default: return m[c]
  }
}

const colonnes: { id: Colonne; libelle: string }[] = [
  { id: 'nom', libelle: 'Magasin' },
  { id: 'departement', libelle: 'Dépt' },
  { id: 'statut', libelle: 'Statut' },
  { id: 'type', libelle: 'Type' },
  { id: 'coach', libelle: 'Coach' },
  { id: 'rr', libelle: 'Responsable Régional' },
  { id: 'responsable', libelle: 'Franchisé' },
  { id: 'ouverture', libelle: 'Ouverture' },
]

const Vide = () => <Typography component="span" variant="body2" color="text.secondary">Non renseigné</Typography>

export function TableMagasins({ magasins }: { magasins: Magasin[] }) {
  const naviguer = useNavigate()
  const [tri, setTri] = useState<{ col: Colonne; sens: 'asc' | 'desc' }>({ col: 'nom', sens: 'asc' })
  const [page, setPage] = useState(0)
  const [parPage, setParPage] = useState(50)
  const tries = [...magasins].sort((a, b) => {
    const va = valeur(a, tri.col), vb = valeur(b, tri.col)
    const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'fr')
    return tri.sens === 'asc' ? r : -r
  })
  const visibles = tries.slice(page * parPage, page * parPage + parPage)
  return (
    <Card>
      <TableContainer>
        <Table size="small" aria-label="Liste des magasins">
          <TableHead>
            <TableRow>
              {colonnes.map((c) => (
                <TableCell key={c.id} sx={{ fontWeight: 600, whiteSpace: 'nowrap', py: 1.5 }}>
                  <TableSortLabel active={tri.col === c.id} direction={tri.col === c.id ? tri.sens : 'asc'} onClick={() => setTri({ col: c.id, sens: tri.col === c.id && tri.sens === 'asc' ? 'desc' : 'asc' })}>
                    {c.libelle}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visibles.map((m) => (
              <TableRow key={m.nom} hover onClick={() => naviguer(lienFiche(m.nom))} sx={{ cursor: 'pointer', '& td': { py: 1.25 } }}>
                <TableCell sx={{ fontWeight: 600 }}>{m.nom}</TableCell>
                <TableCell>{m.departement}</TableCell>
                <TableCell><PastilleStatut statut={m.statut} /></TableCell>
                <TableCell><PastilleType franchise={m.franchise} /></TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{m.coach || <Vide />}</TableCell>
                <TableCell>
                  {m.rr ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: m.rr.couleur, flexShrink: 0 }} />
                      {m.rr.nom}
                    </Box>
                  ) : <Vide />}
                </TableCell>
                <TableCell>{m.responsable?.nom ?? <Vide />}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{m.ouvertureConnue ? dateCourte(m.ouverture) : <Vide />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={tries.length}
        page={page}
        onPageChange={(_e, p) => setPage(p)}
        rowsPerPage={parPage}
        onRowsPerPageChange={(e) => { setParPage(Number(e.target.value)); setPage(0) }}
        rowsPerPageOptions={[25, 50, 100, 400]}
        labelRowsPerPage="Lignes par page"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} sur ${count}`}
      />
    </Card>
  )
}
