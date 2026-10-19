import { useDroits } from '../auth/Droits'
import { useState } from 'react'
import Snackbar from '@mui/material/Snackbar'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { DialogCoach } from '../components/EditionEquipe'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import ArrowBack from '@mui/icons-material/ArrowBack'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { JaugeCharge, aideCharge } from '../components/Charge'
import { TableMagasins } from '../components/TableMagasins'
import { ListeMagasins } from '../components/ListeMagasins'
import { Contact, Section } from './FicheMagasin'
import { chargeA, libelleMois, magasinsDuCoach, moisAVenir } from '../data/charge'
import { dateCourte, lienCoach, lienFiche, lienRR } from '../lib/format'
import { SectionFichePersonnelle } from './FichePersonne'
import { SectionAccesEquipe } from '../components/AccesEquipe'
import { libelleTypeVisite, type Coach, type Reseau } from '../data/modele'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import BalanceOutlined from '@mui/icons-material/BalanceOutlined'
import BadgeOutlined from '@mui/icons-material/BadgeOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import { Onglets, type Rubrique } from '../components/Onglets'
import { BoutonAjouterAction, ListeActions } from '../components/Actions'
import { BilanCampagnes } from '../components/Campagnes'
import { actionsDes, enRetard } from '../data/actions'
import { anneeDe, lienCompteRendu, suiviRythme } from '../data/visites'

type VueCoach = 'magasins' | 'visites' | 'actions' | 'campagnes' | 'charge' | 'fiche'
const rubriquesCoach: Rubrique<VueCoach>[] = [
  { vue: 'magasins', libelle: 'Magasins', icone: <StorefrontOutlined /> },
  { vue: 'visites', libelle: 'Visites', icone: <EventNoteOutlined /> },
  { vue: 'actions', libelle: 'Actions', icone: <TaskAltOutlined /> },
  { vue: 'campagnes', libelle: 'Campagnes', icone: <CampaignOutlined /> },
  { vue: 'charge', libelle: 'Charge', icone: <BalanceOutlined /> },
  { vue: 'fiche', libelle: 'Fiche', icone: <BadgeOutlined /> },
]

function Fiche({ coach, reseau }: { coach: Coach; reseau: Reseau }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const naviguer = useNavigate()
  const [params, setParams] = useSearchParams()
  const vue = (rubriquesCoach.find((r) => r.vue === params.get('vue'))?.vue ?? 'magasins') as VueCoach
  const changerVue = (v: VueCoach) => setParams((p) => { const n = new URLSearchParams(p); if (v === 'magasins') n.delete('vue'); else n.set('vue', v); return n }, { replace: true })
  const [edition, setEdition] = useState(false)
  const [message, setMessage] = useState('')
  const magasins = magasinsDuCoach(reseau, coach.nom)
  const noms = new Set(magasins.map((m) => m.nom))
  const charge = chargeA(reseau, coach.nom)
  const projection = moisAVenir(reseau.jour, 7).slice(1).map((mois) => ({ mois, charge: chargeA(reseau, coach.nom, mois) }))
  const a = anneeDe(reseau.jour)
  const rythme = suiviRythme(reseau, a).filter((l) => noms.has(l.magasin.nom))
  const enRetardVisite = rythme.filter((l) => l.retard > 0).sort((x, y) => y.retard - x.retard)
  const visites = reseau.visites.filter((v) => v.date <= reseau.jour && (v.visiteurs.includes(coach.nom) || (noms.has(v.magasin) && !v.visiteurs.length)))
    .sort((x, y) => y.date.localeCompare(x.date))
  const [toutes, setToutes] = useState(false)
  const { referentiels } = useDroits()
  const actions = actionsDes(reseau, noms)
  const ouvertes = actions.filter((x) => !x.a.faite)
  const retards = ouvertes.filter((x) => enRetard(x.a, reseau.jour)).length
  const faitesAn = rythme.reduce((t, l) => t + l.faites, 0), objectifAn = rythme.reduce((t, l) => t + l.objectif, 0)
  return (
    <>
      <Button startIcon={<ArrowBack />} onClick={() => (window.history.length > 1 ? naviguer(-1) : naviguer('/equipe'))} sx={{ mb: 2, ml: -1 }}>Équipe</Button>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h1" sx={{ flex: 1 }}>{coach.nom}</Typography>
        {referentiels && <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setEdition(true)} sx={{ minHeight: 48 }}>Modifier</Button>}
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5 }}>
        Coach · {magasins.length} magasin{magasins.length > 1 ? 's' : ''}{coach.rr ? ` · ${coach.rr.nom}` : ''}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }} role="group" aria-label="En bref">
        <Chip size="small" variant="outlined" label={`Charge ${charge} sur ${reseau.parametres.maxUnits}`} sx={{ fontSize: 12, fontWeight: 600 }} />
        <Chip size="small" variant="outlined" label={`${faitesAn} visite${faitesAn > 1 ? 's' : ''} sur ${objectifAn} en ${a.court}`} sx={{ fontSize: 12, fontWeight: 600 }} />
        {enRetardVisite.length > 0 && <Chip size="small" color="warning" clickable onClick={() => changerVue('visites')} label={`${enRetardVisite.length} visite${enRetardVisite.length > 1 ? 's' : ''} en retard`} sx={{ fontSize: 12, fontWeight: 600 }} />}
        {ouvertes.length > 0 && <Chip size="small" clickable onClick={() => changerVue('actions')} color={retards ? 'error' : 'default'} variant={retards ? 'filled' : 'outlined'}
          label={`${ouvertes.length} action${ouvertes.length > 1 ? 's' : ''} en cours${retards ? ` · ${retards} en retard` : ''}`} sx={{ fontSize: 12, fontWeight: 600 }} />}
      </Box>
      <Onglets valeur={vue} onChange={changerVue} rubriques={rubriquesCoach} libelle={`Rubriques de ${coach.nom}`} />

      {vue === 'magasins' && (magasins.length === 0
        ? <Typography variant="body2" color="text.secondary">Aucun magasin affecté aujourd’hui.</Typography>
        : surPC ? <TableMagasins magasins={magasins} /> : <ListeMagasins magasins={magasins} />)}

      {vue === 'visites' && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
          <Section titre="Visites en retard">
            {enRetardVisite.length === 0 ? <Typography variant="body2" color="text.secondary">Tous ses magasins sont à jour de leurs visites sur {a.court}.</Typography> : enRetardVisite.map((l) => (
              <Box key={l.magasin.nom} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Link component={RouterLink} to={lienFiche(l.magasin.nom)} sx={{ fontWeight: 500 }}>{l.magasin.nom}</Link>
                  <Typography variant="body2" color="text.secondary">{l.derniere ? `Dernière visite le ${dateCourte(l.derniere.date)}` : 'Jamais visité'} · {l.faites} sur {l.objectif}</Typography>
                </Box>
                <Chip size="small" color="warning" label={`${l.retard} j de retard`} sx={{ fontSize: 12, fontWeight: 600 }} />
              </Box>
            ))}
          </Section>
          <Section titre="Dernières visites">
            {visites.length === 0 ? <Typography variant="body2" color="text.secondary">Aucune visite enregistrée.</Typography> : (toutes ? visites : visites.slice(0, 12)).map((v) => (
              <Box key={v.id ?? `${v.magasin}-${v.date}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                <Typography variant="body2" color="text.secondary" sx={{ width: 100, flexShrink: 0 }}>{dateCourte(v.date)}</Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Link component={RouterLink} to={lienFiche(v.magasin)} sx={{ fontWeight: 500 }}>{v.magasin}</Link>
                  <Typography variant="body2" color="text.secondary">{libelleTypeVisite(v.type)}</Typography>
                </Box>
                <Tooltip title="Compte rendu PDF"><IconButton component={RouterLink} to={lienCompteRendu(v)} aria-label={`Compte rendu de ${v.magasin} du ${dateCourte(v.date)}`}><PictureAsPdfOutlined /></IconButton></Tooltip>
              </Box>
            ))}
            {visites.length > 12 && <Button onClick={() => setToutes((x) => !x)} sx={{ minHeight: 48, mt: 0.5 }}>{toutes ? 'Afficher moins' : `Voir les ${visites.length} visites`}</Button>}
          </Section>
        </Box>
      )}

      {vue === 'actions' && <Section titre="Actions en cours de ses magasins" action={<BoutonAjouterAction reseau={reseau} magasins={[...noms].sort()} signaler={setMessage} />}><ListeActions reseau={reseau} actions={actions} avecMagasin signaler={setMessage} libelle={`Actions en cours des magasins de ${coach.nom}`} magasins={[...noms]} /></Section>}

      {vue === 'campagnes' && <Section titre="Campagnes"><BilanCampagnes reseau={reseau} magasins={magasins} /></Section>}

      {vue === 'charge' && (
        <Section titre="Charge">
          <JaugeCharge reseau={reseau} charge={charge} libelle="Aujourd’hui" />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>{aideCharge}</Typography>
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>Les six prochains mois</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {projection.map((p) => <JaugeCharge key={p.mois} reseau={reseau} charge={p.charge} libelle={libelleMois(p.mois)} />)}
          </Box>
        </Section>
      )}

      {vue === 'fiche' && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
          <SectionFichePersonnelle reseau={reseau} r={{ type: 'coach', cle: coach.nom }} />
          <Section titre="Rattachement">
            <Contact role={coach.rr?.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional'} p={coach.rr} lien={coach.rr ? lienRR(coach.rr.id) : undefined} sousTitre={coach.rr ? undefined : 'Non rattaché à ce jour'} />
          </Section>
          {referentiels && !coach.fictif && <SectionAccesEquipe role="coach" cle={coach.nom} nom={coach.nom} signaler={setMessage} />}
        </Box>
      )}
      {edition && <DialogCoach reseau={reseau} coach={coach} onFermer={(m, nom) => { setEdition(false); if (m?.includes('retiré')) naviguer('/equipe'); else if (m) { setMessage(m); if (nom && nom !== coach.nom) naviguer(lienCoach(nom), { replace: true }) } }} />}
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

export function FicheCoach() {
  const { nom = '' } = useParams()
  const naviguer = useNavigate()
  return (
    <AvecReseau>
      {(reseau) => {
        const coach = reseau.equipe.find((c) => c.nom === nom)
        if (!coach) return <EmptyState icone={<PersonOutlineOutlined />} titre="Coach introuvable" texte={`Aucun Coach ne s’appelle « ${nom} ».`} action={<Button variant="contained" onClick={() => naviguer('/equipe')}>Voir toute l’équipe</Button>} />
        return <Fiche coach={coach} reseau={reseau} />
      }}
    </AvecReseau>
  )
}
