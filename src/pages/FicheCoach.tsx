import { useDroits } from '../auth/Droits'
import { useState } from 'react'
import Snackbar from '@mui/material/Snackbar'
import { DialogCoach } from '../components/EditionEquipe'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import ArrowBack from '@mui/icons-material/ArrowBack'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { ListeMagasins } from '../components/ListeMagasins'
import { Contact, Section } from './FicheMagasin'
import { chargeA, magasinsDuCoach } from '../data/charge'
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
import BadgeOutlined from '@mui/icons-material/BadgeOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import { ContenuOnglet, Onglets, type Rubrique } from '../components/Onglets'
import { BoutonAjouterAction, ListeActions } from '../components/Actions'
import { BilanCampagnes } from '../components/Campagnes'
import { actionsDes, enRetard } from '../data/actions'
import { anneeDe, libellePasVu, lienCompteRendu, suiviRythme, type LigneRythme } from '../data/visites'
import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import { BlocPortefeuille, ProfilPersonne } from '../components/Portefeuille'
import { portefeuilleDe } from '../data/portefeuille'
import { lienPersonne } from '../data/messagerie'
import { fichePersonne } from '../data/personnes'

type VueCoach = 'portefeuille' | 'magasins' | 'visites' | 'actions' | 'campagnes' | 'fiche'
const rubriquesCoach: Rubrique<VueCoach>[] = [
  { vue: 'portefeuille', libelle: 'Portefeuille', icone: <InsightsOutlined /> },
  { vue: 'magasins', libelle: 'Magasins', icone: <StorefrontOutlined /> },
  { vue: 'visites', libelle: 'Visites', icone: <EventNoteOutlined /> },
  { vue: 'actions', libelle: 'Tâches', icone: <TaskAltOutlined /> },
  { vue: 'campagnes', libelle: 'Campagnes', icone: <CampaignOutlined /> },
  { vue: 'fiche', libelle: 'Fiche', icone: <BadgeOutlined /> },
]

function Fiche({ coach, reseau }: { coach: Coach; reseau: Reseau }) {
  const naviguer = useNavigate()
  const [params, setParams] = useSearchParams()
  const vue = (rubriquesCoach.find((r) => r.vue === params.get('vue'))?.vue ?? 'portefeuille') as VueCoach
  const changerVue = (v: VueCoach) => setParams((p) => { const n = new URLSearchParams(p); if (v === 'portefeuille') n.delete('vue'); else n.set('vue', v); return n }, { replace: true })
  const [edition, setEdition] = useState(false)
  const [message, setMessage] = useState('')
  const magasins = magasinsDuCoach(reseau, coach.nom)
  const noms = new Set(magasins.map((m) => m.nom))
  const charge = chargeA(reseau, coach.nom)
  const a = anneeDe(reseau.jour)
  const rythme = suiviRythme(reseau, a).filter((l) => noms.has(l.magasin.nom))
  const ecart = (l: LigneRythme) => (l.depuis === null ? Infinity : l.depuis - l.delai)
  const aVoir = rythme.filter((l) => l.alerte).sort((x, y) => ecart(y) - ecart(x))
  const visites = reseau.visites.filter((v) => v.date <= reseau.jour && (v.visiteurs.includes(coach.nom) || (noms.has(v.magasin) && !v.visiteurs.length)))
    .sort((x, y) => y.date.localeCompare(x.date))
  const [toutes, setToutes] = useState(false)
  const { referentiels } = useDroits()
  const actions = actionsDes(reseau, noms)
  const ouvertes = actions.filter((x) => !x.a.faite)
  const retards = ouvertes.filter((x) => enRetard(x.a, reseau.jour)).length
  const faitesAn = rythme.reduce((t, l) => t + l.faites, 0), referenceAn = rythme.reduce((t, l) => t + l.reference, 0)
  return (
    <>
      <Button startIcon={<ArrowBack />} onClick={() => (window.history.length > 1 ? naviguer(-1) : naviguer('/equipe'))} sx={{ mb: 1, ml: -1, display: { xs: 'none', md: 'inline-flex' } }}>Équipe</Button>
      <ProfilPersonne retour={{ libelle: 'Équipe', aller: () => (window.history.length > 1 ? naviguer(-1) : naviguer('/equipe')) }} nom={coach.nom} lignes={[['Coach', coach.rr?.nom].filter(Boolean).join(' · ')]}
        pastille={retards ? { ton: 'rouge', libelle: `${retards} tâche${retards > 1 ? 's' : ''} en retard` } : null}
        compteurs={[
          { valeur: magasins.length, libelle: magasins.length > 1 ? 'magasins' : 'magasin' },
          { valeur: faitesAn, libelle: `visites ${a.court}` },
          { valeur: `${charge}/${reseau.parametres.maxUnits}`, libelle: 'charge', couleur: charge > reseau.parametres.maxUnits ? 'error.main' : undefined },
        ]}
        telephone={fichePersonne(reseau, { type: 'coach', cle: coach.nom }).telephone || coach.telephone} lienMessage={coach.fictif ? undefined : lienPersonne(`coach:${coach.nom}`)} modifier={referentiels ? () => setEdition(true) : undefined} />
      <Onglets valeur={vue} onChange={changerVue} rubriques={rubriquesCoach} libelle={`Rubriques de ${coach.nom}`} fiche />
      <ContenuOnglet>

        {vue === 'portefeuille' && <BlocPortefeuille reseau={reseau} p={portefeuilleDe(reseau, magasins.filter((m) => m.statut !== 'avenir'), rythme)} />}

        {vue === 'magasins' && (magasins.length === 0
          ? <Typography variant="body2" color="text.secondary">Aucun magasin affecté aujourd’hui.</Typography>
          : <ListeMagasins magasins={magasins} />)}

        {vue === 'visites' && (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
            <Section titre="Pas vus depuis longtemps">
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{faitesAn} visite{faitesAn > 1 ? 's' : ''} en {a.court} · référence nine box {referenceAn}</Typography>
              {aVoir.length === 0 ? <Typography variant="body2" color="text.secondary">Tous ses magasins ont été vus dans le délai de leur case.</Typography> : aVoir.map((l) => (
                <Box key={l.magasin.nom} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Link component={RouterLink} to={lienFiche(l.magasin.nom)} sx={{ fontWeight: 500 }}>{l.magasin.nom}</Link>
                    <Typography variant="body2" color="text.secondary">{[l.case?.libelle ?? 'Non classé', l.derniere ? `dernière visite le ${dateCourte(l.derniere.date)}` : null, l.dernierContact && `appel le ${dateCourte(l.dernierContact.date)}`].filter(Boolean).join(' · ')}</Typography>
                  </Box>
                  <Chip size="small" color="warning" label={libellePasVu(l)} sx={{ fontSize: 12, fontWeight: 600 }} />
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

        {vue === 'actions' && <Section titre="Tâches en cours de ses magasins" action={<BoutonAjouterAction reseau={reseau} magasins={[...noms].sort()} signaler={setMessage} />}><ListeActions reseau={reseau} actions={actions} avecMagasin signaler={setMessage} libelle={`Tâches en cours des magasins de ${coach.nom}`} magasins={[...noms]} /></Section>}

        {vue === 'campagnes' && <Section titre="Campagnes"><BilanCampagnes reseau={reseau} magasins={magasins} /></Section>}

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
      </ContenuOnglet>
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
