import { useState, type ReactElement, type ReactNode } from 'react'
import { Link as RouterLink, Navigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Collapse from '@mui/material/Collapse'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme, type Theme } from '@mui/material/styles'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import FormatListBulleted from '@mui/icons-material/FormatListBulleted'
import CallOutlined from '@mui/icons-material/CallOutlined'
import MailOutlined from '@mui/icons-material/MailOutlined'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import BuildOutlined from '@mui/icons-material/BuildOutlined'
import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined'
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined'
import ChevronRight from '@mui/icons-material/ChevronRight'
import ExpandMore from '@mui/icons-material/ExpandMore'
import WorkOutlineOutlined from '@mui/icons-material/WorkOutlineOutlined'
import { VuePortefeuilles } from '../components/Portefeuille'
import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import { PastilleStatut } from '../components/Pastilles'
import { PageHeader } from '../components/PageHeader'
import { Onglets } from '../components/Onglets'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { PastilleCharge } from '../components/Charge'
import { chargeA, magasinsDuCoach, niveauCharge } from '../data/charge'
import { dateCourte, lienCoach, lienDirecteur, lienFiche, lienRR, telLien } from '../lib/format'
import type { Personne, Reseau, ResponsableRegional } from '../data/modele'

type Vue = 'organisation' | 'portefeuilles' | 'collaborateurs' | 'franchises' | 'charge' | 'postes' | 'plan'

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

interface Groupe { cle: string; titre: string; role: string; couleur: string; personne: Personne | null; rr: ResponsableRegional | null; coachs: LigneCoach[]; direct: number }


const trait = (theme: Theme) => `2px solid ${theme.palette.divider}`

// Organigramme graphique : Directeur en haut, une colonne par Responsable Régional, ses Coachs en dessous
function Pyramide({ reseau, groupes }: { reseau: Reseau; groupes: Groupe[] }) {
  const Boite = ({ couleur, children, lien }: { couleur?: string; children: ReactNode; lien?: string }) => (
    <Box
      {...(lien ? { component: RouterLink, to: lien } : {})}
      sx={{ display: 'block', position: 'relative', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderTop: couleur ? `4px solid ${couleur}` : undefined, borderRadius: 2, px: 1.5, py: 1, textAlign: 'center', color: 'text.primary', textDecoration: 'none', minWidth: 0, '&:hover': lien ? { bgcolor: 'action.hover' } : undefined }}
    >{children}</Box>
  )
  return (
    <Box sx={{ overflowX: 'auto', pb: 1, mt: 2 }}>
      <Box sx={{ minWidth: groupes.length * 210, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Boite lien={lienDirecteur()}>
          <Typography variant="body2" color="text.secondary">{reseau.directeur.titre}</Typography>
          <Typography variant="h4" component="p">{reseau.directeur.nom}</Typography>
          <Typography variant="body2" color="text.secondary">{reseau.equipe.length} Coachs · {reseau.magasins.length} magasins</Typography>
        </Boite>
        <Box sx={{ width: 0, height: 24, borderLeft: trait }} />
        <Box sx={{ display: 'flex', width: '100%' }}>
          {groupes.map((g, i) => (
            <Box key={g.cle} sx={{ flex: 1, minWidth: 0, px: 1, position: 'relative', pt: 3,
              // Barre horizontale reliant les colonnes, et trait vertical vers la boîte du RR
              '&::before': { content: '""', position: 'absolute', top: 0, left: i === 0 ? '50%' : 0, right: i === groupes.length - 1 ? '50%' : 0, borderTop: trait },
              '&::after': { content: '""', position: 'absolute', top: 0, left: '50%', height: 24, borderLeft: trait },
            }}>
              <Boite couleur={g.couleur} lien={g.rr ? lienRR(g.rr.id) : undefined}>
                <Typography variant="body2" color="text.secondary">{g.role}</Typography>
                <Typography variant="h4" component="h3">{g.titre}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {g.coachs.length} Coach{g.coachs.length > 1 ? 's' : ''}{g.direct ? ` · ${g.direct} en direct` : ''}
                </Typography>
              </Boite>
              {g.coachs.length > 0 && (
                <Box sx={{ ml: 2, borderLeft: trait, pt: 1 }}>
                  {g.coachs.map((l) => (
                    <Box key={l.coach.nom} sx={{ display: 'flex', alignItems: 'center', '&::before': { content: '""', width: 12, flexShrink: 0, borderTop: trait } }}>
                      <Box sx={{ flex: 1, minWidth: 0, my: 0.75 }}>
                        <Boite lien={lienCoach(l.coach.nom)}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{l.coach.nom}</Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                            {l.coach.fictif
                              ? <Chip size="small" variant="outlined" color="warning" label="À recruter" sx={{ fontSize: '0.75rem' }} />
                              : <Typography variant="body2" color="text.secondary">{l.magasins} mag.</Typography>}
                            <PastilleCharge reseau={reseau} charge={l.charge} />
                          </Box>
                        </Boite>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

function VueOrganisation({ reseau }: { reseau: Reseau }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [params, setParams] = useSearchParams()
  const forme = (params.get('forme') as 'pyramide' | 'liste' | null) ?? (surPC ? 'pyramide' : 'liste')
  const changerForme = (f: string) => { const p = new URLSearchParams(params); p.set('forme', f); setParams(p, { replace: true }) }
  const lignes = lignesCoachs(reseau)
  const [ouverts, setOuverts] = useState<Set<string>>(() => new Set(reseau.rrs.map((r) => `r:${r.id}`)))
  const basculer = (k: string) => setOuverts((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const toutDeplier = () => setOuverts(new Set([...reseau.rrs.map((r) => `r:${r.id}`), 'r:aucun', ...lignes.map((l) => `c:${l.coach.nom}`)]))
  const toutReplier = () => setOuverts(new Set())
  const sansRR = lignes.filter((l) => !l.coach.rr)
  const depassements = lignes.filter((l) => niveauCharge(reseau, l.charge) === 'depassement').length
  const sansCoach = reseau.magasins.filter((m) => m.statut !== 'avenir' && !m.coach).length
  const aPourvoir = reseau.equipe.filter((c) => c.fictif).length + reseau.magasins.filter((m) => m.statut !== 'avenir' && m.responsableARecruter).length

  const groupes: Groupe[] = [
    ...reseau.rrs.map((r) => ({ cle: `r:${r.id}`, titre: r.nom, role: r.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional', couleur: r.couleur, personne: r as Personne | null, rr: r, coachs: lignes.filter((l) => l.coach.rr?.id === r.id), direct: reseau.magasins.filter((m) => m.rr?.id === r.id && m.rrEnDirect).length })),
    ...(sansRR.length ? [{ cle: 'r:aucun', titre: 'Coachs sans Responsable Régional', role: 'À rattacher', couleur: '#9e9e9e', personne: null, rr: null, coachs: sansRR, direct: 0 }] : []),
  ]

  return (
    <>
      {(depassements > 0 || sansCoach > 0 || aPourvoir > 0) && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {depassements > 0 && <Chip color="error" component={RouterLink} to="/parametres/charge" clickable label={`${depassements} Coach${depassements > 1 ? 's' : ''} en dépassement`} sx={{ minHeight: 40 }} />}
          {sansCoach > 0 && <Chip color="warning" component={RouterLink} to="/parametres/charge" clickable label={`${sansCoach} magasin${sansCoach > 1 ? 's' : ''} sans Coach`} sx={{ minHeight: 40 }} />}
          {aPourvoir > 0 && <Chip color="warning" variant="outlined" component={RouterLink} to="/equipe?vue=postes" clickable label={`${aPourvoir} poste${aPourvoir > 1 ? 's' : ''} à pourvoir`} sx={{ minHeight: 40 }} />}
        </Box>
      )}
      <Card>
        <CardContent sx={{ p: { xs: 1.5, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <AccountTreeOutlined color="action" />
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="h3" component="h2">Organigramme</Typography>
            </Box>
            <ToggleButtonGroup exclusive size="small" value={forme} onChange={(_e, v) => v && changerForme(v)} aria-label="Forme de l’organigramme">
              <ToggleButton value="pyramide" sx={{ minHeight: 48, px: 2, gap: 1 }}><AccountTreeOutlined fontSize="small" />Pyramide</ToggleButton>
              <ToggleButton value="liste" sx={{ minHeight: 48, px: 2, gap: 1 }}><FormatListBulleted fontSize="small" />Liste</ToggleButton>
            </ToggleButtonGroup>
            {forme === 'liste' && <>
              <Button onClick={toutDeplier} sx={{ minHeight: 48 }}>Tout déplier</Button>
              <Button onClick={toutReplier} sx={{ minHeight: 48 }}>Tout replier</Button>
            </>}
          </Box>
          {forme === 'pyramide' ? <Pyramide reseau={reseau} groupes={groupes} /> : <>
          <Noeud niveau={0}>
            <AdminPanelSettingsOutlined color="action" />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="text.secondary">{reseau.directeur.titre}</Typography>
              <Typography variant="body1"><Link component={RouterLink} to={lienDirecteur()} sx={{ fontWeight: 600 }}>{reseau.directeur.nom}</Link> · {reseau.equipe.length} Coachs · {reseau.magasins.length} magasins</Typography>
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
                <Typography variant="h4" component="h3">{g.rr ? <Link component={RouterLink} to={lienRR(g.rr.id)} color="inherit">{g.titre}</Link> : g.titre}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {g.coachs.length} Coach{g.coachs.length > 1 ? 's' : ''}{g.direct ? ` · ${g.direct} en direct` : ''}
              </Typography>
              {g.personne && <BoutonsContact p={g.personne} />}
            </Noeud>
          ))}
          </>}
        </CardContent>
      </Card>
      {reseau.techniciens.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h3" component="h2" sx={{ mb: 0.5 }}>Techniciens et formateurs</Typography>
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
  if (rien) return <EmptyState icone={<WorkOutlineOutlined />} titre="Aucun poste à pourvoir" texte="Tous les postes de Coach sont pourvus et chaque magasin a son franchisé. Un Coach marqué « non recruté » dans l’ancienne application apparaîtra ici." />
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
        <Bloc titre={`Franchisés à trouver (${responsables.length})`} aide="Magasins dont le franchisé est indiqué « En cours de recrutement ».">
          {responsables.map((m) => (
            <Rangee key={m.nom}>
              <Link component={RouterLink} to={lienFiche(m.nom)} sx={{ flex: 1, minWidth: 160, py: 1.5, fontWeight: 500 }}>{m.nom}</Link>
              <Typography variant="body2" color="text.secondary">{m.coach ? `Coach ${m.coach}` : 'Sans Coach'}</Typography>
            </Rangee>
          ))}
        </Bloc>
      )}
    </>
  )
}

const rubriques: { vue: Vue; libelle: string; court: string; icone: ReactElement }[] = [
  { vue: 'organisation', libelle: 'Organisation', court: 'Organisation', icone: <AccountTreeOutlined /> },
  { vue: 'portefeuilles', libelle: 'Portefeuilles', court: 'Portefeuilles', icone: <InsightsOutlined /> },
  { vue: 'postes', libelle: 'Postes à pourvoir', court: 'Postes', icone: <WorkOutlineOutlined /> },
]

export function Equipe() {
  const [params, setParams] = useSearchParams()
  const demandee = params.get('vue')
  const vue = (demandee === 'magasins' ? 'franchises' : demandee as Vue | null) ?? 'organisation'
  // Collaborateurs et Franchisés ont rejoint la partie « Paramètres »
  if (vue === 'collaborateurs' || vue === 'franchises') return <Navigate to={`/parametres/${vue}`} replace />
  // Charge et répartition ont rejoint Paramètres > Charge des Coachs
  if (vue === 'charge') return <Navigate to="/parametres/charge" replace />
  if (vue === 'plan') return <Navigate to={`/parametres/charge?vue=repartition${params.get('date') ? `&date=${params.get('date')}` : ''}`} replace />
  const changerVue = (v: Vue) => setParams({ vue: v }, { replace: true })
  return (
    <AvecReseau>
      {(reseau) => (
        <>
          <PageHeader titre="Équipe" sousTitre={`${reseau.equipe.length} Coachs · ${reseau.rrs.length} Responsables Régionaux · ${reseau.techniciens.length} technicien${reseau.techniciens.length > 1 ? 's' : ''}`} />
          <Onglets valeur={vue} onChange={changerVue} rubriques={rubriques} libelle="Rubriques de l’équipe" />
          {vue === 'portefeuilles' ? <VuePortefeuilles reseau={reseau} /> : vue === 'postes' ? <VuePostes reseau={reseau} /> : <VueOrganisation reseau={reseau} />}
        </>
      )}
    </AvecReseau>
  )
}
