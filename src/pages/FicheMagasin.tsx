import { EcartsAudit, RangeePhotos } from '../components/GrilleAudit'
import { CartePratique, DialogPratique } from '../components/BonnesPratiques'
import { useReactionsPratiques } from '../data/reactionsPratiques'
import type { BonnePratique } from '../data/bonnesPratiques'
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import StarOutlined from '@mui/icons-material/StarOutlined'
import StarBorderOutlined from '@mui/icons-material/StarBorderOutlined'
import { basculerFavori, noterRecent, useSuivis } from '../lib/suivis'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined'
import DynamicFeedOutlined from '@mui/icons-material/DynamicFeedOutlined'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import { GrillePhotos, Initiales, TitreSection, type Ton } from '../components/Social'
import { ProfilPersonne, rond } from '../components/Portefeuille'
import { FilActivite } from './Accueil'
import { filDu } from '../data/fil'
import { useMessagerie } from '../data/MessagerieContext'
import { statutLibelle } from '../data/modele'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ArrowBack from '@mui/icons-material/ArrowBack'
import CallOutlined from '@mui/icons-material/CallOutlined'
import MailOutlined from '@mui/icons-material/MailOutlined'
import PlaceOutlined from '@mui/icons-material/PlaceOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { PastilleCase, PastilleTendance } from '../components/Sante'
import { Journal } from '../components/Journal'
import { ANCIENNE_NOTE_FRANCHISE, caseDe, couleurTon, criteresAxe, historiqueSante, libelleAncienneNote, libelleAxe, libelleNote, niveauAxe, nineBox, scoreAxe, tendance, tonDe, type Axe } from '../data/sante'
import { AvecReseau } from '../components/EtatDonnees'
import { ReaffecterDialog } from '../components/ReaffecterDialog'
import Snackbar from '@mui/material/Snackbar'
import SwapHoriz from '@mui/icons-material/SwapHoriz'
import { EmptyState } from '../components/EmptyState'
import { dateCourte, dateLongue, lienCoach, lienFiche, lienFranchise, lienPreparation, lienRR, telLien } from '../lib/format'
import { DialogMagasin } from '../components/EditionMagasin'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { libelleResponsable, libelleTypeVisite, nomsVisiteurs, type Magasin, type Personne, type Reseau, type Visite } from '../data/modele'
import { DialogVisite } from '../components/DialogVisite'
import { EnvoyerCompteRendu } from '../components/EnvoyerCompteRendu'
import { DialogPlanifier } from '../components/DialogPlanifier'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import { CampagnesMagasin } from '../components/Campagnes'
import { BoutonAjouterAction, ListeActions } from '../components/Actions'
import { ListeAssocies } from '../components/Associes'
import { useDroits } from '../auth/Droits'
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined'
import { ContenuOnglet, Onglets, type Rubrique } from '../components/Onglets'
import { actionsDuMagasin, enRetard } from '../data/actions'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined'
import FavoriteBorderOutlined from '@mui/icons-material/FavoriteBorderOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import { SectionMessages, useNonLusMagasin } from '../components/Messages'
import { anneeDe, libellePasVu, lienCompteRendu, suiviRythme, visitesDuMagasin } from '../data/visites'
import AddOutlined from '@mui/icons-material/AddOutlined'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import PhoneInTalkOutlined from '@mui/icons-material/PhoneInTalkOutlined'
import { DialogChiffres, GraphiqueCA, PastilleAlerte, PastilleAppel } from '../components/Chiffres'
import { analyser, caDe, chiffresDuMagasin, dernierAudit, formatEuros, formatKEuros, formatPourcent, estVisite, formatValeur, libelleAudit, libelleMois, suiviAlerte } from '../data/chiffres'

export function Section({ titre, children, action }: { titre: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h3" component="h2" sx={{ flex: 1 }}>{titre}</Typography>
          {action}
        </Box>
        {children}
      </CardContent>
    </Card>
  )
}

export function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' }, gap: { xs: 0.25, sm: 2 }, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
      <Box sx={{ typography: 'body1', minWidth: 0, overflowWrap: 'anywhere' }}>{children || <Typography color="text.secondary" variant="body2">Non renseigné</Typography>}</Box>
    </Box>
  )
}

// Ligne de contact à initiales, comme dans Magasins : le nom (vers sa fiche), le rôle dessous, les pictos à droite
export function Contact({ role, p, sousTitre, lien }: { role: string; p: Personne | null; sousTitre?: string; lien?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Initiales nom={p?.nom ?? role} taille={40} icone={p ? undefined : <PersonOutlineOutlined />} couleur={p ? undefined : '#9e9e9e'} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {p && lien
          ? <Link component={RouterLink} to={lien} variant="body1" color="inherit" underline="hover" sx={{ fontWeight: 600, display: 'inline-flex', minHeight: 32, alignItems: 'center' }}>{p.nom}</Link>
          : <Typography variant="body1" sx={{ fontWeight: 600, color: p ? undefined : 'text.secondary' }}>{p?.nom ?? 'Non renseigné'}</Typography>}
        <Typography variant="body2" color="text.secondary" noWrap>{[role, sousTitre].filter(Boolean).join(' · ')}</Typography>
      </Box>
      {p?.telephone && <Tooltip title={p.telephone}><IconButton href={telLien(p.telephone)} aria-label={`Appeler ${p.nom}`} sx={{ width: 48, height: 48 }}><CallOutlined /></IconButton></Tooltip>}
      {p?.email && <Tooltip title={p.email}><IconButton href={`mailto:${p.email}`} aria-label={`Écrire à ${p.nom}`} sx={{ width: 48, height: 48 }}><MailOutlined /></IconButton></Tooltip>}
    </Box>
  )
}

type VueFiche = 'fil' | 'fiche' | 'actions' | 'messages' | 'visites' | 'chiffres' | 'sante' | 'campagnes' | 'journal'
const rubriquesFiche: Rubrique<VueFiche>[] = [
  { vue: 'fil', libelle: 'Fil', icone: <DynamicFeedOutlined /> },
  { vue: 'fiche', libelle: 'Fiche', icone: <StorefrontOutlined /> },
  { vue: 'actions', libelle: 'Actions', icone: <TaskAltOutlined /> },
  { vue: 'messages', libelle: 'Messages', icone: <ForumOutlined /> },
  { vue: 'visites', libelle: 'Visites', icone: <EventNoteOutlined /> },
  { vue: 'chiffres', libelle: 'Chiffres', icone: <QueryStatsOutlined /> },
  { vue: 'sante', libelle: 'Santé', icone: <FavoriteBorderOutlined /> },
  { vue: 'campagnes', libelle: 'Campagnes', icone: <CampaignOutlined /> },
  { vue: 'journal', libelle: 'Journal', icone: <HistoryOutlined /> },
]

function Fiche({ m, reseau }: { m: Magasin; reseau: Reseau }) {
  const naviguer = useNavigate()
  const [params, setParams] = useSearchParams()
  const vue = (rubriquesFiche.find((r) => r.vue === params.get('vue'))?.vue ?? 'fil') as VueFiche
  const changerVue = (v: VueFiche) => setParams((p) => { const n = new URLSearchParams(p); if (v === 'fil') n.delete('vue'); else n.set('vue', v); return n }, { replace: true })
  const [reaffectation, setReaffectation] = useState(false)
  const [edition, setEdition] = useState(false)
  const [visite, setVisite] = useState<Visite | null | undefined>(undefined)
  const [planifier, setPlanifier] = useState(false)
  const [typeVisite, setTypeVisite] = useState('terrain')
  const [saisieChiffres, setSaisieChiffres] = useState<string | null | undefined>(undefined)
  const [confirmation, setConfirmation] = useState('')
  useEffect(() => { noterRecent(m.nom) }, [m.nom])
  const coach = m.coach ? reseau.coachs[m.coach] ?? { nom: m.coach } : null
  const adresseComplete = [m.adresse || [m.codePostal, m.ville].filter(Boolean).join(' '), m.pays].filter(Boolean).join(', ')
  const villeDansAdresse = !!m.ville && !!m.adresse?.toLowerCase().includes(m.ville.toLowerCase())
  const rechercheCarte = [m.adresse, !villeDansAdresse && [m.codePostal, m.ville].filter(Boolean).join(' '), m.pays].filter(Boolean).join(' ')
  const lieuCarte = rechercheCarte ? `V and B ${rechercheCarte}` : m.lat !== null && m.lon !== null ? `${m.lat},${m.lon}` : null
  const lienPlan = adresseComplete ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`V and B ${m.nom} ${adresseComplete}`)}` : null
  const actions = actionsDuMagasin(reseau, m.nom)
  const ouvertes = actions.filter((x) => !x.a.faite)
  const enRetardNb = ouvertes.filter((x) => enRetard(x.a, reseau.jour)).length
  const a = anneeDe(reseau.jour)
  const rythme = suiviRythme(reseau, a).find((l) => l.magasin.nom === m.nom)
  const alerte = analyser(reseau, m.nom)
  const saisirVisite = () => { setTypeVisite('terrain'); setVisite(null) }
  const nonLus = useNonLusMagasin(m.nom)
  const { referentiels } = useDroits()
  const rubriques = rubriquesFiche.map((r) => (r.vue === 'messages' ? { ...r, pastille: nonLus } : r))
  return (
    <>
      <Button startIcon={<ArrowBack />} onClick={() => (window.history.length > 1 ? naviguer(-1) : naviguer('/magasins'))} sx={{ mb: 1, ml: -1, display: { xs: 'none', md: 'inline-flex' } }}>Magasins</Button>
      <ProfilMagasin retour={{ libelle: 'Magasins', aller: () => (window.history.length > 1 ? naviguer(-1) : naviguer('/magasins')) }} m={m} reseau={reseau} alerte={alerte} enRetardNb={enRetardNb} ouvertes={ouvertes.length} alerteVisite={rythme?.alerte ? libellePasVu(rythme) : ''}
        appeler={m.telephone || m.responsable?.telephone || ''} message={() => changerVue('messages')} visite={saisirVisite} planifier={() => setPlanifier(true)}
        modifier={referentiels ? () => setEdition(true) : undefined} />
      <Onglets valeur={vue} onChange={changerVue} rubriques={rubriques} libelle={`Rubriques de ${m.nom}`} fiche />
      <ContenuOnglet>

        {vue === 'fil' && <FilMagasin reseau={reseau} m={m} />}

        {vue === 'fiche' && (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
            <Section titre="Équipe" action={referentiels ? <Button startIcon={<SwapHoriz />} onClick={() => setReaffectation(true)} sx={{ minHeight: 48 }}>Réaffecter</Button> : undefined}>
              <Contact role="Coach" p={coach} lien={m.coach ? lienCoach(m.coach) : undefined} sousTitre={m.coach ? undefined : 'Aucun Coach affecté à ce jour'} />
              <Contact role={m.rr?.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional'} p={m.rr} lien={m.rr ? lienRR(m.rr.id) : undefined} sousTitre={m.rrEnDirect ? 'Gère ce magasin en direct' : undefined} />
              {!m.franchise && <Contact role={libelleResponsable(m)} p={m.responsable} lien={m.responsable ? lienFranchise(m.responsable.nom) : undefined} sousTitre={m.responsable ? undefined : m.responsableARecruter ? 'En cours de recrutement' : undefined} />}
              {m.franchise && m.responsableARecruter && <Contact role={libelleResponsable(m)} p={null} sousTitre="En cours de recrutement" />}
              <ListeAssocies reseau={reseau} m={m} signaler={setConfirmation} />
            </Section>
            <Section titre="Magasin">
              <Ligne libelle="Ouverture">{m.ouvertureConnue ? dateLongue(m.ouverture) : null}</Ligne>
              <Ligne libelle="Adresse">
                {adresseComplete && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <span>{adresseComplete}</span>
                    {lienPlan && <Chip icon={<PlaceOutlined />} label="Itinéraire" size="small" component="a" href={lienPlan} target="_blank" rel="noopener" clickable sx={{ fontSize: '0.75rem' }} />}
                  </Box>
                )}
              </Ligne>
              <Ligne libelle="Téléphone">{m.telephone && <Link href={telLien(m.telephone)}>{m.telephone}</Link>}</Ligne>
              <Ligne libelle="Email">{m.email && <Link href={`mailto:${m.email}`}>{m.email}</Link>}</Ligne>
            </Section>
            {lieuCarte && (
              <Card sx={{ gridColumn: { lg: 'span 2' }, overflow: 'hidden' }}>
                <Box component="iframe" title={`Carte Google de ${m.nom}`} src={`https://www.google.com/maps?q=${encodeURIComponent(lieuCarte)}&output=embed&hl=fr`}
                  loading="lazy" referrerPolicy="no-referrer-when-downgrade" sx={{ display: 'block', width: '100%', height: 300, border: 0 }} />
              </Card>
            )}
          </Box>
        )}

        {vue === 'actions' && (
          <Section titre="Actions en cours" action={<BoutonAjouterAction reseau={reseau} magasins={[m.nom]} signaler={setConfirmation} />}>
            <ListeActions reseau={reseau} actions={actions} signaler={setConfirmation} libelle={`Actions en cours de ${m.nom}`} magasins={[m.nom]} />
          </Section>
        )}

        {vue === 'messages' && <SectionMessages reseau={reseau} m={m} signaler={setConfirmation} />}

        {vue === 'visites' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <SectionAudits reseau={reseau} m={m} />
            <SectionVisites reseau={reseau} m={m} saisir={saisirVisite} modifier={setVisite} />
          </Box>
        )}

        {vue === 'chiffres' && <SectionChiffres reseau={reseau} m={m} saisir={(mois) => setSaisieChiffres(mois ?? null)} appeler={() => { setTypeVisite('appel'); setVisite(null) }} />}

        {vue === 'sante' && (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
            <SectionSante reseau={reseau} m={m} modifier={() => setEdition(true)} />
            <SectionDeploiements reseau={reseau} m={m} modifier={() => setEdition(true)} />
          </Box>
        )}

        {vue === 'campagnes' && <Section titre="Campagnes"><CampagnesMagasin reseau={reseau} magasin={m.nom} signaler={setConfirmation} /></Section>}

        {vue === 'journal' && (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Journal reseau={reseau} m={m} signaler={setConfirmation} />
            <SectionPratiques reseau={reseau} m={m} signaler={setConfirmation} />
          </Box>
        )}

        {reaffectation && <ReaffecterDialog reseau={reseau} magasin={m} ouvert onFermer={(fait) => { setReaffectation(false); if (fait) setConfirmation(`${m.nom} est confié à ${fait}.`) }} />}
        {edition && <DialogMagasin reseau={reseau} magasin={m} onFermer={(msg, nom) => {
          setEdition(false)
          if (!msg) return
          if (msg.includes('supprimé')) { naviguer('/magasins', { replace: true }); return }
          setConfirmation(msg)
          if (nom && nom !== m.nom) naviguer(lienFiche(nom), { replace: true })
        }} />}
        {planifier && <DialogPlanifier reseau={reseau} magasins={[m.nom]} dateInitiale={reseau.jour}
          visite={reseau.visites.filter((v) => v.magasin === m.nom && v.date > reseau.jour && estVisite(v)).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null}
          onFermer={(msg) => { setPlanifier(false); if (msg) setConfirmation(msg) }} />}
        {visite !== undefined && <DialogVisite reseau={reseau} visite={visite} magasinsInitiaux={[m.nom]} typeInitial={typeVisite} onFermer={(msg) => { setVisite(undefined); if (msg) setConfirmation(msg) }} />}
        {saisieChiffres !== undefined && <DialogChiffres reseau={reseau} magasin={m.nom} mois={saisieChiffres ?? undefined} onFermer={(msg) => { setSaisieChiffres(undefined); if (msg) setConfirmation(msg) }} />}
        <Snackbar open={!!confirmation} autoHideDuration={5000} onClose={() => setConfirmation('')} message={confirmation} />
      </ContenuOnglet>
    </>
  )
}

// Rythme de visite de l'année et toutes les visites du magasin, de la plus récente à la plus ancienne
function SectionVisites({ reseau, m, saisir, modifier }: { reseau: Reseau; m: Magasin; saisir: () => void; modifier: (v: Visite) => void }) {
  const [toutes, setToutes] = useState(false)
  const vs = visitesDuMagasin(reseau, m.nom)
  const a = anneeDe(reseau.jour)
  const r = suiviRythme(reseau, a).find((l) => l.magasin.nom === m.nom)
  const MAXI = 15
  return (
    <Section titre="Visites" action={<Button startIcon={<AddOutlined />} onClick={saisir} sx={{ minHeight: 48 }}>Saisir</Button>}>
      {r && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="body2" color="text.secondary">{r.faites} visite{r.faites > 1 ? 's' : ''} en {a.court} · référence nine box {r.reference}</Typography>
        {r.alerte && <Chip size="small" color="warning" label={libellePasVu(r)} sx={{ fontSize: 12, fontWeight: 600 }} />}
      </Box>}
      {vs.length === 0 ? <Typography variant="body2" color="text.secondary">Aucune visite enregistrée.</Typography> : (toutes ? vs : vs.slice(0, MAXI)).map((v) => (
        <Box key={v.id ?? v.date} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
          <Typography variant="body2" color="text.secondary" sx={{ width: 110, flexShrink: 0 }}>{dateCourte(v.date)}</Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body1">{libelleTypeVisite(v.type)}{v.visiteurs.length ? ` · ${nomsVisiteurs(v)}` : ''}</Typography>
            {v.notes && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>{v.notes}</Typography>}
            {v.plan.length > 0 && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{v.plan.length} action{v.plan.length > 1 ? 's' : ''} au plan · {v.plan.filter((x) => x.faite).length} faite{v.plan.filter((x) => x.faite).length > 1 ? 's' : ''}</Typography>}
            <RangeePhotos photos={v.photos} />
          </Box>
          <Tooltip title="Compte rendu PDF"><IconButton component={RouterLink} to={lienCompteRendu(v)} aria-label={`Compte rendu du ${dateCourte(v.date)}`}><PictureAsPdfOutlined /></IconButton></Tooltip>
          <EnvoyerCompteRendu reseau={reseau} visite={v} icone />
          <Tooltip title="Modifier"><IconButton onClick={() => modifier(v)} aria-label={`Modifier la visite du ${dateCourte(v.date)}`}><EditOutlined /></IconButton></Tooltip>
        </Box>
      ))}
      {vs.length > MAXI && <Button onClick={() => setToutes((x) => !x)} sx={{ minHeight: 48, mt: 0.5 }}>{toutes ? 'Afficher moins' : `Voir les ${vs.length} visites`}</Button>}
    </Section>
  )
}

export function FicheMagasin() {
  const { nom = '' } = useParams()
  const naviguer = useNavigate()
  return (
    <AvecReseau>
      {(reseau) => {
        const m = reseau.magasins.find((x) => x.nom === nom)
        if (!m) {
          return <EmptyState icone={<StorefrontOutlined />} titre="Magasin introuvable" texte={`Aucun magasin ne s’appelle « ${nom} ». Il a peut-être été renommé.`} action={<Button variant="contained" onClick={() => naviguer('/magasins')}>Voir tous les magasins</Button>} />
        }
        return <Fiche m={m} reseau={reseau} />
      }}
    </AvecReseau>
  )
}

// Santé et déploiements : deux blocs en lecture, modifiables avec « Modifier »
function SectionSante({ reseau, m, modifier }: { reseau: Reseau; m: Magasin; modifier: () => void }) {
  const e = reseau.evaluations[m.nom]
  const c = caseDe(e)
  return (
    <Section titre="Santé" action={<Button startIcon={<EditOutlined />} onClick={modifier} aria-label="Modifier la santé" sx={{ minHeight: 48 }}>Modifier</Button>}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
        <PastilleCase c={c} />
        <PastilleTendance t={tendance(reseau.evaluations, m.nom)} />
        {c && <Typography variant="body2" color="text.secondary">Rythme de visite : {c.rythme} par an</Typography>}
      </Box>
      {(['resultats', 'franchise'] as Axe[]).map((axe) => {
        const niveau = niveauAxe(e, axe)
        // L'ancienne note unique du franchisé reste affichée tant qu'elle décide de la ligne
        const ancienne = axe === 'franchise' && scoreAxe(e, axe) === null ? e?.notes[ANCIENNE_NOTE_FRANCHISE] : undefined
        return (
          <Box key={axe} sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Typography variant="h4" component="h3" sx={{ flex: 1 }}>{libelleAxe(axe, !m.franchise)}</Typography>
              {niveau && <Chip size="small" label={libelleNote[niveau]} color={couleurNoteChip[niveau]} sx={{ fontSize: 12 }} />}
            </Box>
            {criteresAxe(axe).map((k) => {
              const n = e?.notes[k.id]
              return <Ligne key={k.id} libelle={k.libelle}>{n === undefined ? null : <Chip size="small" label={libelleNote[n]} color={n === 0 ? 'default' : couleurNoteChip[n]} sx={{ fontSize: 12 }} />}</Ligne>
            })}
            {ancienne !== undefined && <Ligne libelle={libelleAncienneNote}><Chip size="small" label={libelleNote[ancienne]} color={ancienne === 0 ? 'default' : couleurNoteChip[ancienne]} sx={{ fontSize: 12 }} /></Ligne>}
          </Box>
        )
      })}
      <EvolutionCases points={historiqueSante(reseau.evaluations, m.nom)} />
    </Section>
  )
}

// Cases successives, de la plus récente à la plus ancienne
function EvolutionCases({ points }: { points: { date: string; caseId: string }[] }) {
  const changements = points.filter((p, i) => p.caseId && p.caseId !== points.slice(0, i).filter((x) => x.caseId).at(-1)?.caseId)
  if (changements.length < 2) return null
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h4" component="h3" sx={{ mb: 1 }}>Évolution</Typography>
      {[...changements].reverse().map((p) => (
        <Box key={p.date + p.caseId} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 0.75 }}>
          <Typography variant="body2" color="text.secondary" sx={{ width: 110, flexShrink: 0 }}>{dateCourte(p.date)}</Typography>
          <PastilleCase c={nineBox.find((c) => c.id === p.caseId) ?? null} />
        </Box>
      ))}
    </Box>
  )
}

function SectionDeploiements({ reseau, m, modifier }: { reseau: Reseau; m: Magasin; modifier: () => void }) {
  return (
    <Section titre="Déploiements" action={<Button startIcon={<EditOutlined />} onClick={modifier} aria-label="Modifier les déploiements" sx={{ minHeight: 48 }}>Modifier</Button>}>
      {reseau.deploiements.thematiques.map((t) => {
        const v = reseau.deploiements.valeurs[m.nom]?.[t.id]
        const ton = tonDe(t, v)
        return <Ligne key={t.id} libelle={t.libelle}>{v ? <Chip size="small" label={v} color={ton ? couleurTon[ton] : 'default'} sx={{ fontSize: 12 }} /> : null}</Ligne>
      })}
    </Section>
  )
}

const couleurNoteChip = { 1: 'error', 2: 'warning', 3: 'success' } as const

// Derniers audits hygiène et excellence, avec leurs écarts
function SectionAudits({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const audits = [['hygiene', 'Dernier audit hygiène'], ['excellence', 'Dernier audit excellence']] as const
  return (
    <Section titre="Audits">
      {audits.map(([type, libelle]) => {
        const r = dernierAudit(reseau, m.nom, type)
        return <Fragment key={type}><Ligne libelle={libelle}>{r ? `${libelleAudit(r)} · ${dateCourte(r.date)}` : null}</Ligne>{r && <EcartsAudit reponses={r.reponses} />}</Fragment>
      })}
    </Section>
  )
}

// Chiffres du mois, alerte de décrochage, appel
function SectionChiffres({ reseau, m, saisir, appeler }: { reseau: Reseau; m: Magasin; saisir: (mois?: string) => void; appeler: () => void }) {
  const [tousLesMois, setTousLesMois] = useState(false)
  const a = analyser(reseau, m.nom)
  const suivi = suiviAlerte(reseau, m.nom, a)
  return (
    <Section titre="Chiffres" action={<Button startIcon={<EditOutlined />} onClick={() => saisir()} aria-label="Saisir les chiffres" sx={{ minHeight: 48 }}>Saisir</Button>}>
      {!a ? <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Aucun chiffre enregistré pour ce magasin.</Typography> : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <PastilleAlerte statut={a.statut} />
            <PastilleAppel s={suivi} />
            <Typography variant="body2" color="text.secondary">Chiffres à fin {libelleMois(a.mois)}</Typography>
          </Box>
          {a.raisons.length > 0 && <Typography variant="body2" sx={{ mb: 1 }}>{a.raisons.join(' · ').replace(/^./, (c) => c.toUpperCase())}</Typography>}
          {suivi && !suivi.contact && <Button variant="contained" startIcon={<PhoneInTalkOutlined />} onClick={appeler} sx={{ minHeight: 48, mb: 1 }}>Saisir un appel</Button>}
          <Ligne libelle={`CA cumulé de ${libelleMois(a.mois)}`}>{formatEuros(a.ca)}</Ligne>
          <Ligne libelle={`Écart vs ${libelleMois(a.reference)}`}>{a.ecart === null ? null : `${formatPourcent(a.ecart)} (${formatEuros(a.caReference)})`}</Ligne>
          <Ligne libelle="Flux cumulé">{a.chiffre.tickets === null ? null : formatValeur('tickets', a.chiffre.tickets)}</Ligne>
          <Ligne libelle="Panier moyen">{a.chiffre.panier === null ? null : formatValeur('panier', a.chiffre.panier)}</Ligne>
          <Ligne libelle="Marge">{a.chiffre.marge === null ? null : formatValeur('marge', a.chiffre.marge)}</Ligne>
          <Ligne libelle="CA marché extérieur">{a.chiffre.caExt === null ? null : formatEuros(a.chiffre.caExt)}</Ligne>
        </>
      )}
      <GraphiqueCA liste={chiffresDuMagasin(reseau, m.nom)} />
      {(() => {
        const liste = [...chiffresDuMagasin(reseau, m.nom)].reverse()
        if (!liste.length) return null
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>Mois enregistrés</Typography>
            {(tousLesMois ? liste : liste.slice(0, 6)).map((c) => (
              <Box key={c.mois} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                <Typography variant="body2" color="text.secondary" sx={{ width: 130, flexShrink: 0 }}>{libelleMois(c.mois)}</Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1">{formatEuros(caDe(c))}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {[c.tickets !== null && c.tickets !== undefined && `Flux ${formatValeur('tickets', c.tickets)}`, c.marge !== null && c.marge !== undefined && `Marge ${formatValeur('marge', c.marge)}`].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <Tooltip title="Modifier"><IconButton onClick={() => saisir(c.mois)} sx={{ width: 48, height: 48 }} aria-label={`Modifier les chiffres de ${libelleMois(c.mois)}`}><EditOutlined /></IconButton></Tooltip>
              </Box>
            ))}
            {liste.length > 6 && <Button onClick={() => setTousLesMois((v) => !v)} sx={{ minHeight: 48, mt: 0.5 }}>{tousLesMois ? 'Afficher moins' : `Voir les ${liste.length} mois`}</Button>}
          </Box>
        )
      })()}
    </Section>
  )
}

// Bonnes pratiques du magasin, et celles d'autres magasins qu'il a reprises
function SectionPratiques({ reseau, m, signaler }: { reseau: Reseau; m: Magasin; signaler: (msg: string) => void }) {
  const [edition, setEdition] = useState<BonnePratique | null | undefined>(undefined)
  const reactions = useReactionsPratiques()
  const siennes = reseau.pratiques.filter((p) => p.magasin === m.nom)
  const reprises = reseau.pratiques.filter((p) => p.reprises.includes(m.nom))
  return (
    <Section titre="Bonnes pratiques" action={<Button startIcon={<AddOutlined />} onClick={() => setEdition(null)} aria-label="Ajouter une bonne pratique" sx={{ minHeight: 48 }}>Ajouter</Button>}>
      {!siennes.length && !reprises.length && <Typography variant="body2" color="text.secondary">Aucune bonne pratique enregistrée.</Typography>}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {siennes.map((p) => <CartePratique key={p.id} p={p} sansMagasin modifier={() => setEdition(p)} reactions={reactions} signaler={signaler} />)}
      </Box>
      {reprises.length > 0 && (
        <Box sx={{ mt: siennes.length ? 2 : 0 }}>
          <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>Reprises d’autres magasins</Typography>
          {reprises.map((p) => (
            <Typography key={p.id} variant="body2" sx={{ py: 0.5 }}>{p.titre} · <Link component={RouterLink} to={lienFiche(p.magasin)}>{p.magasin}</Link></Typography>
          ))}
        </Box>
      )}
      {edition !== undefined && <DialogPratique reseau={reseau} pratique={edition} magasinInitial={m.nom} onFermer={(msg) => { setEdition(undefined); if (msg) signaler(msg) }} />}
    </Section>
  )
}

// Haut de fiche façon profil : initiales, nom, trois compteurs, puis Appeler, Message, Visite
function ProfilMagasin({ m, reseau, alerte, enRetardNb, ouvertes, alerteVisite, appeler, message, visite, planifier, modifier, retour }: {
  m: Magasin; reseau: Reseau; alerte: ReturnType<typeof analyser>; enRetardNb: number; ouvertes: number; alerteVisite: string
  appeler: string; message: () => void; visite: () => void; planifier: () => void; modifier?: () => void; retour: { libelle: string; aller: () => void }
}) {
  const c = caseDe(reseau.evaluations[m.nom])
  // Une seule pastille : la plus grave
  const pastille: { ton: Ton; libelle: string } | null = alerte?.statut === 'decroche' ? { ton: 'rouge', libelle: 'Décroche' }
    : enRetardNb ? { ton: 'rouge', libelle: `${enRetardNb} tâche${enRetardNb > 1 ? 's' : ''} en retard` }
    : alerte?.statut === 'surveiller' ? { ton: 'orange', libelle: 'À surveiller' }
    : alerteVisite ? { ton: 'orange', libelle: alerteVisite }
    : m.statut !== 'ouvert' ? { ton: m.statut === 'nouveau' ? 'bleu' : 'gris', libelle: statutLibelle[m.statut] } : null
  return (
    <ProfilPersonne nom={m.nom} retour={retour}
      lignes={[[m.franchise ? 'Franchisé' : 'Intégré', [m.ville, m.departement && `(${m.departement})`].filter(Boolean).join(' ')].filter(Boolean).join(' · '), [m.coach || 'Sans Coach', m.rr?.nom].filter(Boolean).join(' · ')]}
      pastille={pastille}
      compteurs={[
        { valeur: alerte ? formatKEuros(alerte.ca) : '—', libelle: alerte ? `CA ${libelleMois(alerte.mois).split(' ')[0]}` : 'CA du mois' },
        { valeur: alerte?.ecart === null || alerte?.ecart === undefined ? '—' : formatPourcent(alerte.ecart), libelle: 'vs l’an dernier', couleur: alerte?.ecart !== null && alerte?.ecart !== undefined && alerte.ecart < 0 ? 'error.main' : undefined },
        { valeur: ouvertes || '0', libelle: ouvertes > 1 ? 'tâches en cours' : 'tâche en cours' },
      ]}
      detail={c && <><Box component="span" sx={{ color: 'text.secondary' }}>Nine box : </Box><b>{c.libelle}</b> · {c.rythme} par an</>}
      telephone={appeler}
      icones={<AutresActions nom={m.nom} planifier={planifier} preparer={lienPreparation(m.nom)} modifier={modifier} />}
      actions={<>
        <Tooltip title="Message"><IconButton onClick={message} aria-label="Écrire un message" sx={rond}><ChatBubbleOutlineOutlined /></IconButton></Tooltip>
        <Tooltip title="Saisir une visite"><IconButton onClick={visite} aria-label="Saisir une visite" sx={rond}><AddOutlined /></IconButton></Tooltip>
      </>} />
  )
}

// Planifier, Préparer et Modifier dans un menu « ⋯ » : trois pictos seulement à côté du nom (Joseph, 21/10/2026)
function AutresActions({ nom, planifier, preparer, modifier }: { nom: string; planifier: () => void; preparer: string; modifier?: () => void }) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const favori = useSuivis().favoris.includes(nom)
  const fermer = () => setAncre(null)
  return (
    <>
      <Tooltip title="Autres actions"><IconButton onClick={(e) => setAncre(e.currentTarget)} aria-label="Autres actions" aria-haspopup="menu" aria-expanded={!!ancre} sx={{ width: 48, height: 48 }}><MoreHorizOutlined /></IconButton></Tooltip>
      <Menu anchorEl={ancre} open={!!ancre} onClose={fermer} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem onClick={() => { fermer(); planifier() }} sx={{ minHeight: { xs: 48, sm: 48 } }}><ListItemIcon><EventAvailableOutlined /></ListItemIcon>Planifier la visite</MenuItem>
        <MenuItem component={RouterLink} to={preparer} onClick={fermer} sx={{ minHeight: { xs: 48, sm: 48 } }}><ListItemIcon><AssignmentOutlined /></ListItemIcon>Préparer la visite</MenuItem>
        <MenuItem onClick={() => { fermer(); basculerFavori(nom) }} sx={{ minHeight: { xs: 48, sm: 48 } }}><ListItemIcon>{favori ? <StarOutlined /> : <StarBorderOutlined />}</ListItemIcon>{favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}</MenuItem>
        {modifier && <MenuItem onClick={() => { fermer(); modifier() }} sx={{ minHeight: { xs: 48, sm: 48 } }}><ListItemIcon><EditOutlined /></ListItemIcon>Modifier la fiche</MenuItem>}
      </Menu>
    </>
  )
}

// Fil du magasin : toutes les photos en grille, puis visites, tâches, messages, chiffres et journal du plus récent au plus ancien
function FilMagasin({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const { messagerie } = useMessagerie()
  const elements = useMemo(() => filDu(reseau, new Set([m.nom]), messagerie, 730), [reseau, m.nom, messagerie])
  const photos = elements.flatMap((e) => e.photos ?? [])
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 760 }}>
      {photos.length > 0 && <Box component="section" aria-label="Photos"><TitreSection nombre={photos.length}>Photos</TitreSection><GrillePhotos photos={photos} max={6} /></Box>}
      <FilActivite elements={elements} jour={reseau.jour} sansMagasin titre="Fil du magasin" />
    </Box>
  )
}
