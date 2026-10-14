import { useMemo, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
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
import SupervisorAccountOutlined from '@mui/icons-material/SupervisorAccountOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import BuildOutlined from '@mui/icons-material/BuildOutlined'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { PastilleRR } from '../components/Pastilles'
import { JaugeCharge, PastilleCharge } from '../components/Charge'
import { chargeA, magasinsDuCoach } from '../data/charge'
import { lienCoach, lienFiche, telLien } from '../lib/format'
import type { Personne, Reseau } from '../data/modele'

type Vue = 'coachs' | 'rr' | 'magasins'

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
      return { coach: c, magasins: magasins.length, renforces: magasins.filter((m) => m.statut === 'preouverture' || m.statut === 'nouveau').length, charge: chargeA(reseau, c.nom) }
    })
    .sort((a, b) => b.charge - a.charge || a.coach.nom.localeCompare(b.coach.nom, 'fr'))
}

function VueCoachs({ reseau, surPC }: { reseau: Reseau; surPC: boolean }) {
  const lignes = lignesCoachs(reseau)
  if (lignes.length === 0) return <EmptyState icone={<PersonOutlineOutlined />} titre="Aucun Coach pour l’instant" texte="Les Coachs apparaissent ici dès qu’un magasin leur est affecté dans l’ancienne application." />
  return (
    <>
      {surPC ? (
        <Card>
          <TableContainer>
            <Table aria-label="Coachs">
              <TableHead>
                <TableRow>
                  <TableCell>Coach</TableCell>
                  <TableCell>Responsable Régional</TableCell>
                  <TableCell align="right">Magasins</TableCell>
                  <TableCell align="right">Dont accompagnement renforcé</TableCell>
                  <TableCell>Charge</TableCell>
                  <TableCell>Contact</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lignes.map((l) => (
                  <TableRow key={l.coach.nom} hover>
                    <TableCell><Link component={RouterLink} to={lienCoach(l.coach.nom)} sx={{ fontWeight: 600 }}>{l.coach.nom}</Link></TableCell>
                    <TableCell>{l.coach.rr ? <PastilleRR nom={l.coach.rr.nom} couleur={l.coach.rr.couleur} /> : <Typography variant="body2" color="text.secondary">Non rattaché</Typography>}</TableCell>
                    <TableCell align="right">{l.magasins}</TableCell>
                    <TableCell align="right">{l.renforces}</TableCell>
                    <TableCell><PastilleCharge reseau={reseau} charge={l.charge} /></TableCell>
                    <TableCell sx={{ py: 0 }}><BoutonsContact p={l.coach} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {lignes.map((l) => (
            <Card key={l.coach.nom}>
              <CardActionArea component={RouterLink} to={lienCoach(l.coach.nom)}>
                <CardContent>
                  <Typography variant="h4" component="h2">{l.coach.nom}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {[l.coach.rr?.nom ?? 'Non rattaché à un RR', `${l.magasins} magasin${l.magasins > 1 ? 's' : ''}`].join(' · ')}
                  </Typography>
                  <JaugeCharge reseau={reseau} charge={l.charge} />
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}
      {reseau.techniciens.length > 0 && (
        <Box sx={{ mt: 4 }}>
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

function VueRR({ reseau }: { reseau: Reseau }) {
  if (reseau.rrs.length === 0) return <EmptyState icone={<SupervisorAccountOutlined />} titre="Aucun Responsable Régional" texte="Les Responsables Régionaux se déclarent dans l’ancienne application, rubrique Direction." />
  const lignes = lignesCoachs(reseau)
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: '1fr 1fr 1fr' }, alignItems: 'start' }}>
      {reseau.rrs.map((r) => {
        const coachs = lignes.filter((l) => l.coach.rr?.id === r.id)
        const magasins = reseau.magasins.filter((m) => m.rr?.id === r.id)
        const enDirect = magasins.filter((m) => m.rrEnDirect).length
        return (
          <Card key={r.id} sx={{ borderTop: '4px solid', borderTopColor: r.couleur }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" color="text.secondary">{r.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional'}</Typography>
                  <Typography variant="h3" component="h2">{r.nom}</Typography>
                </Box>
                <BoutonsContact p={r} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 2 }}>
                <Chip size="small" label={`${coachs.length} Coach${coachs.length > 1 ? 's' : ''}`} sx={{ fontSize: '0.75rem' }} />
                <Chip size="small" component={RouterLink} to={`/magasins?rr=${encodeURIComponent(r.id)}`} clickable label={`${magasins.length} magasin${magasins.length > 1 ? 's' : ''}`} sx={{ fontSize: '0.75rem' }} />
                {enDirect > 0 && <Chip size="small" variant="outlined" label={`${enDirect} en direct`} sx={{ fontSize: '0.75rem' }} />}
              </Box>
              {coachs.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Aucun Coach rattaché.</Typography>
              ) : coachs.map((l) => (
                <Box key={l.coach.nom} sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 48, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                  <Link component={RouterLink} to={lienCoach(l.coach.nom)} sx={{ flex: 1, minWidth: 0, py: 1.5 }}>{l.coach.nom}</Link>
                  <Typography variant="body2" color="text.secondary">{l.magasins} mag.</Typography>
                  <PastilleCharge reseau={reseau} charge={l.charge} />
                </Box>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </Box>
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
  const vue = (params.get('vue') as Vue | null) ?? 'coachs'
  const changerVue = (v: Vue) => setParams({ vue: v }, { replace: true })
  return (
    <AvecReseau>
      {(reseau) => (
        <>
          <PageHeader titre="Équipe" sousTitre={`${reseau.equipe.length} Coachs · ${reseau.rrs.length} Responsables Régionaux`} />
          <Tabs value={vue} onChange={(_e, v) => changerVue(v)} variant="scrollable" allowScrollButtonsMobile aria-label="Rubriques de l’équipe" sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Tab value="coachs" label="Coachs" sx={{ minHeight: 48 }} />
            <Tab value="rr" label="Responsables Régionaux" sx={{ minHeight: 48 }} />
            <Tab value="magasins" label="Responsables magasin" sx={{ minHeight: 48 }} />
          </Tabs>
          {vue === 'rr' ? <VueRR reseau={reseau} /> : vue === 'magasins' ? <VueResponsables reseau={reseau} surPC={surPC} /> : <VueCoachs reseau={reseau} surPC={surPC} />}
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 3 }}>
            Pour réaffecter un magasin ou modifier une personne, utilise encore l’ancienne application. La modification arrive dans un prochain sprint.
          </Typography>
        </>
      )}
    </AvecReseau>
  )
}
