import { useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Collapse from '@mui/material/Collapse'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Switch from '@mui/material/Switch'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tabs from '@mui/material/Tabs'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import CallOutlined from '@mui/icons-material/CallOutlined'
import MailOutlined from '@mui/icons-material/MailOutlined'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import BuildOutlined from '@mui/icons-material/BuildOutlined'
import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined'
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined'
import ChevronRight from '@mui/icons-material/ChevronRight'
import ExpandMore from '@mui/icons-material/ExpandMore'
import WorkOutlineOutlined from '@mui/icons-material/WorkOutlineOutlined'
import { VueCharge } from './VueCharge'
import { PastilleStatut } from '../components/Pastilles'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { PastilleCharge } from '../components/Charge'
import { chargeA, magasinsDuCoach, niveauCharge } from '../data/charge'
import { dateCourte, lienCoach, lienFiche, telLien } from '../lib/format'
import type { Personne, Reseau } from '../data/modele'

type Vue = 'organisation' | 'charge' | 'magasins' | 'postes'

function BoutonsContact({ p }: { p: Personne }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {p.telephone && <Tooltip title={p.telephone}><IconButton href={telLien(p.telephone)} aria-label={`Appeler ${p.nom}`} onClick={(e) => e.stopPropagation()}><CallOutlined /></IconButton></Tooltip>}
      {p.email && <Tooltip title={p.email}><IconButton href={`mailto:${p.email}`} aria-label={`Écrire à ${p.nom}`} onClick={(e) => e.stopPropagation()}><MailOutlined /></IconButton></Tooltip>}
    </Box>
  )
}

export function lignesCoachs(reseau: Reseau) {
  return reseau.equipe
    .map((c) => {
      const magasins = magasinsDuCoach(reseau, c.nom)
      return { coach: c, liste: magasins, magasins: magasins.length, charge: chargeA(reseau, c.nom) }
    })
    .sort((a, b) => b.charge - a.charge || a.coach.nom.localeCompare(b.coach.nom, 'fr'))
}

type LigneCoach = ReturnType<typeof lignesCoachs>[number]

function Noeud({ niveau, ouvert, onBasculer, enfants, children }: { niveau: number; ouvert?: boolean; onBasculer?: () => void; enfants?: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ ml: niveau ? { xs: 1.5, sm: 3 } : 0, pl: niveau ? { xs: 1, sm: 2 } : 0, borderLeft: niveau ? '2px solid' : 0, borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 52 }}>
        {onBasculer ? (
          <IconButton onClick={onBasculer} aria-label={ouvert ? 'Replier' : 'Déplier'} aria-expanded={ouvert}>
            {ouvert ? <ExpandMore /> : <ChevronRight />}
          </IconButton>
        ) : <Box sx={{ width: 48, flexShrink: 0 }} />}
        {children}
      </Box>
      {enfants && <Collapse in={ouvert} unmountOnExit>{enfants}</Collapse>}
    </Box>
  )
}

function LigneCoachOrga({ l, reseau, ouverts, basculer }: { l: LigneCoach; reseau: Reseau; ouverts: Set<string>; basculer: (k: string) => void }) {
  const cle = `c:${l.coach.nom}`
  return (
    <Noeud niveau={1} ouvert={ouverts.has(cle)} onBasculer={l.magasins ? () => basculer(cle) : undefined} enfants={
      <Box>
        {l.liste.map((m) => (
          <Noeud key={m.nom} niveau={2}>
            <Link component={RouterLink} to={lienFiche(m.nom)} sx={{ flex: 1, minWidth: 0, py: 1.5 }}>{m.nom}</Link>
            <PastilleStatut statut={m.statut} />
          </Noeud>
        ))}
      </Box>
    }>
      <PersonOutlineOutlined color="action" />
      <Link component={RouterLink} to={lienCoach(l.coach.nom)} sx={{ flex: 1, minWidth: 0, py: 1.5, fontWeight: 500 }}>{l.coach.nom}</Link>
      {l.coach.fictif && <Chip size="small" variant="outlined" color="warning" label="À recruter" sx={{ fontSize: '0.75rem' }} />}
      <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{l.magasins} magasin{l.magasins > 1 ? 's' : ''}</Typography>
      <PastilleCharge reseau={reseau} charge={l.charge} />
    </Noeud>
  )
}

function VueOrganisation({ reseau }: { reseau: Reseau }) {
  const lignes = lignesCoachs(reseau)
  const [ouverts, setOuverts] = useState<Set<string>>(() => new Set(reseau.rrs.map((r) => `r:${r.id}`)))
  const basculer = (k: string) => setOuverts((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const toutDeplier = () => setOuverts(new Set([...reseau.rrs.map((r) => `r:${r.id}`), 'r:aucun', ...lignes.map((l) => `c:${l.coach.nom}`)]))
  const toutReplier = () => setOuverts(new Set())
  const sansRR = lignes.filter((l) => !l.coach.rr)
  const depassements = lignes.filter((l) => niveauCharge(reseau, l.charge) === 'depassement').length
  const sansCoach = reseau.magasins.filter((m) => m.statut !== 'avenir' && !m.coach).length
  const aPourvoir = reseau.equipe.filter((c) => c.fictif).length + reseau.magasins.filter((m) => m.statut !== 'avenir' && m.responsableARecruter).length

  const groupes = [
    ...reseau.rrs.map((r) => ({ cle: `r:${r.id}`, titre: r.nom, role: r.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional', couleur: r.couleur, personne: r as Personne | null, coachs: lignes.filter((l) => l.coach.rr?.id === r.id), direct: reseau.magasins.filter((m) => m.rr?.id === r.id && m.rrEnDirect).length })),
    ...(sansRR.length ? [{ cle: 'r:aucun', titre: 'Coachs sans Responsable Régional', role: 'À rattacher', couleur: '#9e9e9e', personne: null, coachs: sansRR, direct: 0 }] : []),
  ]

  return (
    <>
      {(depassements > 0 || sansCoach > 0 || aPourvoir > 0) && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {depassements > 0 && <Chip color="error" component={RouterLink} to="/equipe?vue=charge" clickable label={`${depassements} Coach${depassements > 1 ? 's' : ''} en dépassement`} sx={{ minHeight: 40 }} />}
          {sansCoach > 0 && <Chip color="warning" component={RouterLink} to="/equipe?vue=charge" clickable label={`${sansCoach} magasin${sansCoach > 1 ? 's' : ''} sans Coach`} sx={{ minHeight: 40 }} />}
          {aPourvoir > 0 && <Chip color="warning" variant="outlined" component={RouterLink} to="/equipe?vue=postes" clickable label={`${aPourvoir} poste${aPourvoir > 1 ? 's' : ''} à pourvoir`} sx={{ minHeight: 40 }} />}
        </Box>
      )}
      <Card>
        <CardContent sx={{ p: { xs: 1.5, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <AccountTreeOutlined color="action" />
            <Typography variant="h3" component="h2" sx={{ flex: 1 }}>Organigramme</Typography>
            <Button onClick={toutDeplier} sx={{ minHeight: 48 }}>Tout déplier</Button>
            <Button onClick={toutReplier} sx={{ minHeight: 48 }}>Tout replier</Button>
          </Box>
          <Noeud niveau={0}>
            <AdminPanelSettingsOutlined color="action" />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="text.secondary">Direction du réseau</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>{reseau.equipe.length} Coachs · {reseau.magasins.length} magasins</Typography>
            </Box>
          </Noeud>
          {groupes.map((g) => (
            <Noeud key={g.cle} niveau={1} ouvert={ouverts.has(g.cle)} onBasculer={() => basculer(g.cle)} enfants={
              <Box>
                {g.coachs.length === 0 && <Noeud niveau={1}><Typography variant="body2" color="text.secondary">Aucun Coach rattaché.</Typography></Noeud>}
                {g.coachs.map((l) => <LigneCoachOrga key={l.coach.nom} l={l} reseau={reseau} ouverts={ouverts} basculer={basculer} />)}
              </Box>
            }>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: g.couleur, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" color="text.secondary">{g.role}</Typography>
                <Typography variant="h4" component="h3">{g.titre}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {g.coachs.length} Coach{g.coachs.length > 1 ? 's' : ''}{g.direct ? ` · ${g.direct} en direct` : ''}
              </Typography>
              {g.personne && <BoutonsContact p={g.personne} />}
            </Noeud>
          ))}
        </CardContent>
      </Card>
      {reseau.techniciens.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h3" component="h2" sx={{ mb: 0.5 }}>Techniciens et formateurs</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Ils accompagnent les Coachs sans piloter de magasin, ils n’ont donc pas de charge.</Typography>
          <Card>
            {reseau.techniciens.map((t) => (
              <Box key={t.nom} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, minHeight: 56, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                <BuildOutlined color="action" />
                <Typography variant="body1" sx={{ flex: 1 }}>{t.nom}</Typography>
                <BoutonsContact p={t} />
              </Box>
            ))}
          </Card>
        </Box>
      )}
    </>
  )
}

function VuePostes({ reseau }: { reseau: Reseau }) {
  const lignes = lignesCoachs(reseau)
  const coachsARecruter = lignes.filter((l) => l.coach.fictif)
  const arrivees = reseau.equipe.filter((c) => !c.fictif && c.arrivee > reseau.jour).sort((a, b) => a.arrivee.localeCompare(b.arrivee))
  const responsables = reseau.magasins.filter((m) => m.statut !== 'avenir' && m.responsableARecruter)
  const rien = !coachsARecruter.length && !arrivees.length && !responsables.length
  if (rien) return <EmptyState icone={<WorkOutlineOutlined />} titre="Aucun poste à pourvoir" texte="Tous les postes de Coach et de responsable magasin sont pourvus. Un Coach marqué « non recruté » dans l’ancienne application apparaîtra ici." />
  const Bloc = ({ titre, aide, children }: { titre: string; aide: string; children: ReactNode }) => (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h3" component="h2">{titre}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{aide}</Typography>
        {children}
      </CardContent>
    </Card>
  )
  const Rangee = ({ children }: { children: ReactNode }) => <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 52, flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>{children}</Box>
  return (
    <>
      {coachsARecruter.length > 0 && (
        <Bloc titre={`Coachs à recruter (${coachsARecruter.length})`} aide="Postes de Coach prévus mais pas encore pourvus, avec les magasins qui les attendent.">
          {coachsARecruter.map((l) => (
            <Rangee key={l.coach.nom}>
              <Link component={RouterLink} to={lienCoach(l.coach.nom)} sx={{ flex: 1, minWidth: 160, py: 1.5, fontWeight: 500 }}>{l.coach.nom}</Link>
              <Typography variant="body2" color="text.secondary">{[l.coach.rr?.nom, l.coach.ville, l.coach.arrivee && `arrivée visée ${dateCourte(l.coach.arrivee)}`, `${l.magasins} magasin${l.magasins > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}</Typography>
            </Rangee>
          ))}
        </Bloc>
      )}
      {arrivees.length > 0 && (
        <Bloc titre={`Arrivées prévues (${arrivees.length})`} aide="Coachs recrutés qui n’ont pas encore pris leur poste.">
          {arrivees.map((c) => (
            <Rangee key={c.nom}>
              <Link component={RouterLink} to={lienCoach(c.nom)} sx={{ flex: 1, minWidth: 160, py: 1.5, fontWeight: 500 }}>{c.nom}</Link>
              <Typography variant="body2" color="text.secondary">{[c.rr?.nom, c.ville, `arrive le ${dateCourte(c.arrivee)}`].filter(Boolean).join(' · ')}</Typography>
            </Rangee>
          ))}
        </Bloc>
      )}
      {responsables.length > 0 && (
        <Bloc titre={`Responsables magasin à recruter (${responsables.length})`} aide="Magasins dont le poste de responsable est indiqué en recrutement.">
          {responsables.map((m) => (
            <Rangee key={m.nom}>
              <Link component={RouterLink} to={lienFiche(m.nom)} sx={{ flex: 1, minWidth: 160, py: 1.5, fontWeight: 500 }}>{m.nom}</Link>
              <Typography variant="body2" color="text.secondary">{[m.coach && `Coach ${m.coach}`, m.adjoint && `adjoint ${m.adjoint.nom}`].filter(Boolean).join(' · ') || 'Sans adjoint'}</Typography>
            </Rangee>
          ))}
        </Bloc>
      )}
    </>
  )
}

function VueResponsables({ reseau, surPC }: { reseau: Reseau; surPC: boolean }) {
  const [manquants, setManquants] = useState(false)
  const magasins = useMemo(() => reseau.magasins.filter((m) => m.statut !== 'avenir' && (!manquants || !m.responsable)), [reseau, manquants])
  const nbManquants = reseau.magasins.filter((m) => m.statut !== 'avenir' && !m.responsable).length
  return (
    <>
      <FormControlLabel
        control={<Switch checked={manquants} onChange={(e) => setManquants(e.target.checked)} />}
        label={`Seulement les magasins sans responsable (${nbManquants})`}
        sx={{ mb: 2, minHeight: 48 }}
      />
      {magasins.length === 0 ? (
        <EmptyState icone={<StorefrontOutlined />} titre="Tous les magasins ont un responsable" texte="Aucun poste de responsable magasin n’est vacant ou non renseigné." />
      ) : surPC ? (
        <Card>
          <TableContainer>
            <Table aria-label="Responsables magasin">
              <TableHead>
                <TableRow>
                  <TableCell>Magasin</TableCell>
                  <TableCell>Responsable magasin</TableCell>
                  <TableCell>Adjoint</TableCell>
                  <TableCell>Coach</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {magasins.map((m) => (
                  <TableRow key={m.nom} hover>
                    <TableCell><Link component={RouterLink} to={lienFiche(m.nom)} sx={{ fontWeight: 600 }}>{m.nom}</Link></TableCell>
                    <TableCell>
                      {m.responsable ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>{m.responsable.nom}</span>
                          {m.responsable.telephone && <Link href={telLien(m.responsable.telephone)} variant="body2">{m.responsable.telephone}</Link>}
                        </Box>
                      ) : <Chip size="small" color="warning" label="À pourvoir ou non renseigné" sx={{ fontSize: '0.75rem' }} />}
                    </TableCell>
                    <TableCell>{m.adjoint?.nom ?? <Typography variant="body2" color="text.secondary">Aucun</Typography>}</TableCell>
                    <TableCell>{m.coach || <Typography variant="body2" color="text.secondary">Aucun</Typography>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      ) : (
        <Card>
          {magasins.map((m) => (
            <CardActionArea key={m.nom} component={RouterLink} to={lienFiche(m.nom)} sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>{m.nom}</Typography>
              <Typography variant="body2" color={m.responsable ? 'text.secondary' : 'warning.main'}>
                {m.responsable ? `Responsable : ${m.responsable.nom}` : 'Responsable à pourvoir ou non renseigné'}
              </Typography>
              {m.adjoint && <Typography variant="body2" color="text.secondary">Adjoint : {m.adjoint.nom}</Typography>}
            </CardActionArea>
          ))}
        </Card>
      )}
    </>
  )
}

export function Equipe() {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [params, setParams] = useSearchParams()
  const vue = (params.get('vue') as Vue | null) ?? 'organisation'
  const changerVue = (v: Vue) => setParams({ vue: v }, { replace: true })
  return (
    <AvecReseau>
      {(reseau) => (
        <>
          <PageHeader titre="Équipe" sousTitre={`${reseau.equipe.length} Coachs · ${reseau.rrs.length} Responsables Régionaux · ${reseau.techniciens.length} technicien${reseau.techniciens.length > 1 ? 's' : ''}`} />
          <Tabs value={vue} onChange={(_e, v) => changerVue(v)} variant="scrollable" allowScrollButtonsMobile aria-label="Rubriques de l’équipe" sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Tab value="organisation" label="Organisation" sx={{ minHeight: 48 }} />
            <Tab value="charge" label="Charge des Coachs" sx={{ minHeight: 48 }} />
            <Tab value="postes" label="Postes à pourvoir" sx={{ minHeight: 48 }} />
            <Tab value="magasins" label="Responsables magasin" sx={{ minHeight: 48 }} />
          </Tabs>
          {vue === 'charge' ? <VueCharge reseau={reseau} /> : vue === 'postes' ? <VuePostes reseau={reseau} /> : vue === 'magasins' ? <VueResponsables reseau={reseau} surPC={surPC} /> : <VueOrganisation reseau={reseau} />}
        </>
      )}
    </AvecReseau>
  )
}
