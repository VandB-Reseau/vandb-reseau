import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import InputAdornment from '@mui/material/InputAdornment'
import Link from '@mui/material/Link'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import PersonAddAlt1Outlined from '@mui/icons-material/PersonAddAlt1Outlined'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import SearchIcon from '@mui/icons-material/Search'
import ChevronRight from '@mui/icons-material/ChevronRight'
import { DialogCoach, DialogFranchise, DialogRR } from '../components/EditionEquipe'
import { EmptyState } from '../components/EmptyState'
import { normaliser } from '../data/filtres'
import { fichePersonne, franchises, libelleRole, type FichePersonnelle, type TypePersonne } from '../data/personnes'
import { lienCoach, lienDirecteur, lienFranchise, lienRR, telLien } from '../lib/format'
import type { Reseau } from '../data/modele'

interface LignePersonne { cle: string; type: TypePersonne; nom: string; role: string; rattachement: string; lien: string; fiche: FichePersonnelle }

export type Perimetre = 'collaborateurs' | 'franchises'

const FILTRES: { id: 'tous' | TypePersonne; libelle: string }[] = [
  { id: 'tous', libelle: 'Tous' },
  { id: 'rr', libelle: 'Responsables Régionaux' },
  { id: 'coach', libelle: 'Coachs' },
]
const AJOUTS = { collaborateurs: [['coach', 'Un Coach'], ['rr', 'Un Responsable Régional']], franchises: [] } as const

export function lignesPersonnes(reseau: Reseau): LignePersonne[] {
  const l: LignePersonne[] = []
  if (reseau.directeur.nom !== 'Direction du réseau') {
    l.push({ cle: 'directeur', type: 'directeur', nom: reseau.directeur.nom, role: reseau.directeur.titre, rattachement: 'Tout le réseau', lien: lienDirecteur(), fiche: fichePersonne(reseau, { type: 'directeur', cle: '' }) })
  }
  for (const r of reseau.rrs) {
    const n = reseau.equipe.filter((c) => c.rr?.id === r.id).length
    l.push({ cle: `rr:${r.id}`, type: 'rr', nom: r.nom, role: r.integres ? 'Responsable Magasins Intégrés' : libelleRole('rr'), rattachement: r.integres ? 'Magasins intégrés' : `${n} Coach${n > 1 ? 's' : ''}`, lien: lienRR(r.id), fiche: fichePersonne(reseau, { type: 'rr', cle: r.id }) })
  }
  for (const c of reseau.equipe) {
    l.push({ cle: `coach:${c.nom}`, type: 'coach', nom: c.nom, role: c.fictif ? 'Coach (poste à pourvoir)' : 'Coach', rattachement: c.rr?.nom ?? 'Sans Responsable Régional', lien: lienCoach(c.nom), fiche: fichePersonne(reseau, { type: 'coach', cle: c.nom }) })
  }
  for (const f of franchises(reseau)) {
    if (/recrutement/i.test(f.nom)) continue
    l.push({ cle: `franchise:${f.nom}`, type: 'franchise', nom: f.nom, role: libelleRole('franchise', f.integresSeulement), rattachement: f.magasins.map((m) => m.nom).join(', '), lien: lienFranchise(f.nom), fiche: fichePersonne(reseau, { type: 'franchise', cle: f.nom }) })
  }
  return l
}

const Vide = () => <Typography component="span" variant="body2" color="text.secondary">Non renseigné</Typography>

// Annuaire des collaborateurs V and B (Directeur, RR, Coachs) ou des franchisés ; un clic ouvre la fiche, où l'on modifie
export function VuePersonnes({ reseau, surPC, perimetre }: { reseau: Reseau; surPC: boolean; perimetre: Perimetre }) {
  const naviguer = useNavigate()
  const [params, setParams] = useSearchParams()
  const filtre = (FILTRES.find((f) => f.id === params.get('role'))?.id ?? 'tous') as 'tous' | TypePersonne
  const changerFiltre = (id: string) => { const p = new URLSearchParams(params); if (id === 'tous') p.delete('role'); else p.set('role', id); setParams(p, { replace: true }) }
  const [texte, setTexte] = useState('')
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const [ajout, setAjout] = useState<'coach' | 'rr' | 'franchise' | null>(null)
  const [message, setMessage] = useState('')
  const toutes = useMemo(() => lignesPersonnes(reseau).filter((p) => (perimetre === 'franchises') === (p.type === 'franchise')), [reseau, perimetre])
  const compte = (id: string) => (id === 'tous' ? toutes.length : toutes.filter((p) => p.type === id).length)
  const t = normaliser(texte)
  const visibles = toutes.filter((p) => (perimetre === 'franchises' || filtre === 'tous' || p.type === filtre) && (!t || normaliser(`${p.nom} ${p.role} ${p.rattachement} ${p.fiche.ville}`).includes(t)))
  const fermer = (m?: string, nom?: string, lien?: (n: string) => string) => { setAjout(null); if (m) { setMessage(m); if (nom && lien) naviguer(lien(nom)) } }

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <TextField size="small" placeholder="Nom, ville, magasin…" value={texte} onChange={(e) => setTexte(e.target.value)}
          slotProps={{ htmlInput: { 'aria-label': 'Rechercher une personne' }, input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
          sx={{ flex: 1, minWidth: 220, '& .MuiInputBase-root': { minHeight: 48 } }} />
        {perimetre === 'franchises'
          ? <Button variant="contained" startIcon={<PersonAddAlt1Outlined />} onClick={() => setAjout('franchise')} sx={{ minHeight: 48 }}>Ajouter un franchisé</Button>
          : <Button variant="contained" startIcon={<PersonAddAlt1Outlined />} onClick={(e) => setMenu(e.currentTarget)} sx={{ minHeight: 48 }}>Ajouter un collaborateur</Button>}
        <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
          {AJOUTS[perimetre].map(([id, l]) => (
            <MenuItem key={id} onClick={() => { setMenu(null); setAjout(id) }} sx={{ minHeight: 48 }}>{l}</MenuItem>
          ))}
        </Menu>
      </Box>
      {perimetre === 'collaborateurs' && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }} role="group" aria-label="Filtrer par rôle">
        {FILTRES.map((f) => (
          <Chip key={f.id} label={`${f.libelle} (${compte(f.id)})`} onClick={() => changerFiltre(f.id)} color={filtre === f.id ? 'primary' : 'default'} variant={filtre === f.id ? 'filled' : 'outlined'} aria-pressed={filtre === f.id} sx={{ minHeight: 40 }} />
        ))}
      </Box>}
      {visibles.length === 0 ? (
        <EmptyState icone={<PersonOutlineOutlined />} titre={toutes.length ? 'Personne ne correspond' : perimetre === 'franchises' ? 'Aucun franchisé renseigné' : 'Aucun collaborateur'}
          texte={toutes.length ? 'Change la recherche ou le filtre.' : 'Ajoute la personne : elle aura sa fiche personnelle.'}
          action={!toutes.length ? <Button variant="contained" onClick={(e) => (perimetre === 'franchises' ? setAjout('franchise') : setMenu(e.currentTarget))}>Ajouter</Button> : undefined} />
      ) : surPC ? (
        <Card>
          <TableContainer>
            <Table aria-label={perimetre === 'franchises' ? 'Franchisés' : 'Collaborateurs'}>
              <TableHead>
                <TableRow>
                  <TableCell>Nom</TableCell>
                  <TableCell>Rôle</TableCell>
                  <TableCell>{perimetre === 'franchises' ? 'Magasins' : 'Rattachement'}</TableCell>
                  <TableCell>Ville</TableCell>
                  <TableCell>Téléphone</TableCell>
                  <TableCell>Email</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibles.map((p) => (
                  <TableRow key={p.cle} hover onClick={() => naviguer(p.lien)} sx={{ cursor: 'pointer' }}>
                    <TableCell><Link component={RouterLink} to={p.lien} onClick={(e) => e.stopPropagation()} sx={{ fontWeight: 600 }}>{p.nom}</Link></TableCell>
                    <TableCell>{p.role}</TableCell>
                    <TableCell sx={{ maxWidth: 280 }}>{p.rattachement || <Vide />}</TableCell>
                    <TableCell>{p.fiche.ville || <Vide />}</TableCell>
                    <TableCell>{p.fiche.telephone ? <Link href={telLien(p.fiche.telephone)} onClick={(e) => e.stopPropagation()} variant="body2">{p.fiche.telephone}</Link> : <Vide />}</TableCell>
                    <TableCell>{p.fiche.email ? <Link href={`mailto:${p.fiche.email}`} onClick={(e) => e.stopPropagation()} variant="body2">{p.fiche.email}</Link> : <Vide />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      ) : (
        <Card>
          {visibles.map((p) => (
            <CardActionArea key={p.cle} component={RouterLink} to={p.lien} aria-label={p.nom} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, minHeight: 56, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{p.nom}</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>{[p.role, p.rattachement, p.fiche.ville].filter(Boolean).join(' · ')}</Typography>
              </Box>
              <ChevronRight color="action" />
            </CardActionArea>
          ))}
        </Card>
      )}
      {ajout === 'coach' && <DialogCoach reseau={reseau} coach={null} onFermer={(m, n) => fermer(m, n, lienCoach)} />}
      {ajout === 'rr' && <DialogRR reseau={reseau} rr={null} onFermer={(m) => fermer(m)} />}
      {ajout === 'franchise' && <DialogFranchise reseau={reseau} nom={null} onFermer={(m, n) => fermer(m, n, lienFranchise)} />}
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}
