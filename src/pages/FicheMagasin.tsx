import { EcartsAudit, RangeePhotos } from '../components/GrilleAudit'
import { CartePratique, DialogPratique } from '../components/BonnesPratiques'
import { useReactionsPratiques } from '../data/reactionsPratiques'
import type { BonnePratique } from '../data/bonnesPratiques'
import { Fragment, useEffect, useMemo, useState } from 'react'
import StarOutlined from '@mui/icons-material/StarOutlined'
import StarBorderOutlined from '@mui/icons-material/StarBorderOutlined'
import { basculerFavori, noterRecent, useSuivis } from '../lib/suivis'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import type { Ton } from '../components/Social'
import { ProfilPersonne, rond } from '../components/Portefeuille'
import { Blason } from '../components/Blason'
import { FilActivite } from './Accueil'
import { statutLibelle } from '../data/modele'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ArrowBack from '@mui/icons-material/ArrowBack'
import PlaceOutlined from '@mui/icons-material/PlaceOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import { PastilleCase, PastilleTendance } from '../components/Sante'
import { journalDansLeFil, useEditionJournal } from '../components/Journal'
import { ANCIENNE_NOTE_FRANCHISE, caseDe, couleurTon, criteresAxe, historiqueSante, libelleAncienneNote, libelleAxe, libelleNote, niveauAxe, nineBox, scoreAxe, tendance, tonDe, type Axe, type Ton as TonDeploiement } from '../data/sante'
import { AvecReseau } from '../components/EtatDonnees'
import { ReaffecterDialog } from '../components/ReaffecterDialog'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import DoNotDisturbOnOutlined from '@mui/icons-material/DoNotDisturbOnOutlined'
import { DialogFermeture } from '../components/DialogFermeture'
import SwapHoriz from '@mui/icons-material/SwapHoriz'
import { EmptyState } from '../components/EmptyState'
import { dateCourte, dateLongue, lienCoach, lienFiche, lienFranchise, lienPreparation, lienRR, telLien } from '../lib/format'
import { DialogMagasin } from '../components/EditionMagasin'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { libelleFermeture, libelleResponsable, libelleTypeVisite, nomsVisiteurs, type Magasin, type Reseau, type Visite } from '../data/modele'
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
import { lienFil } from '../data/messagerie'
import { anneeDe, libellePasVu, lienCompteRendu, suiviRythme, visitesDuMagasin } from '../data/visites'
import AddOutlined from '@mui/icons-material/AddOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import PhoneInTalkOutlined from '@mui/icons-material/PhoneInTalkOutlined'
import { ContenuLeviers, ListeInspirations } from '../components/Leviers'
import { inspirationsDu, leviersDuMagasin, libellesLevier, useReperesReseau } from '../data/leviers'
import { DialogChiffres, GraphiqueCA, PastilleAlerte, PastilleAppel } from '../components/Chiffres'
import { Contact, Ligne, Section } from '../components/Section'
import { SectionReunionsMagasin } from '../components/Reunions'
import { analyser, caDe, chiffresDuMagasin, dernierAudit, formatEuros, formatKEuros, formatPourcent, estVisite, formatValeur, libelleAudit, libelleMois, suiviAlerte } from '../data/chiffres'
import { cartouche } from '../components/Social'

// Plus de fil, redondant avec les onglets (Joseph, 22/10/2026) ; le journal et les bonnes pratiques ont chacun leur onglet
// (Joseph, 22/10/2026), la santé va avec les chiffres, les campagnes avec les tâches. Plus d'onglet Messages (sprint 22,
// S2) : le picto message de l'en-tête ouvre le groupe du magasin dans Messages
type VueFiche = 'fiche' | 'actions' | 'visites' | 'chiffres' | 'journal' | 'pratiques'
const rubriquesFiche: Rubrique<VueFiche>[] = [
  { vue: 'fiche', libelle: 'Fiche', icone: <StorefrontOutlined /> },
  { vue: 'actions', libelle: 'Tâches et campagnes', court: 'Tâches', icone: <TaskAltOutlined /> },
  { vue: 'visites', libelle: 'Visites', icone: <EventNoteOutlined /> },
  { vue: 'chiffres', libelle: 'Chiffres et santé', court: 'Chiffres', icone: <QueryStatsOutlined /> },
  { vue: 'journal', libelle: 'Journal', icone: <HistoryOutlined /> },
  { vue: 'pratiques', libelle: 'Bonnes pratiques', court: 'Pratiques', icone: <TipsAndUpdatesOutlined /> },
]
// Anciens liens vers un onglet regroupé : l'onglet qui l'accueille, ouvert sur sa partie
const anciennesVues: Record<string, VueFiche> = { sante: 'chiffres', campagnes: 'actions', fil: 'journal' }

function Fiche({ m, reseau }: { m: Magasin; reseau: Reseau }) {
  const naviguer = useNavigate()
  const [params, setParams] = useSearchParams()
  const demandee = params.get('vue') ?? ''
  const vue = (anciennesVues[demandee] ?? rubriquesFiche.find((r) => r.vue === demandee)?.vue ?? 'fiche') as VueFiche
  const versMessages = demandee === 'messages'
  useEffect(() => { if (versMessages) naviguer(lienFil({ genre: 'magasin', magasin: m.nom, equipe: false }), { replace: true }) }, [versMessages, naviguer, m.nom])
  useEffect(() => { if (anciennesVues[demandee]) document.getElementById(`partie-${demandee}`)?.scrollIntoView({ block: 'start' }) }, [demandee])
  const changerVue = (v: VueFiche) => setParams((p) => { const n = new URLSearchParams(p); if (v === 'fiche') n.delete('vue'); else n.set('vue', v); return n }, { replace: true })
  const [reaffectation, setReaffectation] = useState(false)
  const [edition, setEdition] = useState(false)
  const [visite, setVisite] = useState<Visite | null | undefined>(undefined)
  const [planifier, setPlanifier] = useState(false)
  const [typeVisite, setTypeVisite] = useState('terrain')
  const [saisieChiffres, setSaisieChiffres] = useState<string | null | undefined>(undefined)
  const [confirmation, setConfirmation] = useState('')
  const [fermeture, setFermeture] = useState(false)
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
  const { referentiels } = useDroits()
  return (
    <>
      <Button startIcon={<ArrowBack />} onClick={() => (window.history.length > 1 ? naviguer(-1) : naviguer('/magasins'))} sx={{ mb: 1, ml: -1, display: { xs: 'none', md: 'inline-flex' } }}>Magasins</Button>
      <ProfilMagasin retour={{ libelle: 'Magasins', aller: () => (window.history.length > 1 ? naviguer(-1) : naviguer('/magasins')) }} m={m} reseau={reseau} alerte={alerte} enRetardNb={enRetardNb} ouvertes={ouvertes.length} alerteVisite={rythme?.alerte ? libellePasVu(rythme) : ''}
        appeler={m.telephone || m.responsable?.telephone || ''} message={() => naviguer(lienFil({ genre: 'magasin', magasin: m.nom, equipe: false }))} visite={saisirVisite} planifier={() => setPlanifier(true)}
        modifier={referentiels ? () => setEdition(true) : undefined} fermer={referentiels ? () => setFermeture(true) : undefined} />
      {m.fermeture && (
        <Alert severity={m.fermeture.date <= reseau.jour ? 'warning' : 'info'} sx={{ mb: 2 }}
          action={referentiels ? <Button color="inherit" onClick={() => setFermeture(true)} sx={{ minHeight: 48 }}>Modifier</Button> : undefined}>
          {libelleFermeture[m.fermeture.type]} {m.fermeture.date <= reseau.jour ? 'le' : 'prévue le'} {dateLongue(m.fermeture.date)}
          {m.fermeture.repreneur ? ` · repris par ${m.fermeture.repreneur}` : ''}{m.fermeture.motif ? ` · ${m.fermeture.motif}` : ''}
        </Alert>
      )}
      <Onglets valeur={vue} onChange={changerVue} rubriques={rubriquesFiche} libelle={`Rubriques de ${m.nom}`} fiche />
      <ContenuOnglet>

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
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <Section titre="Tâches en cours" action={<BoutonAjouterAction reseau={reseau} magasins={[m.nom]} signaler={setConfirmation} />}>
              <ListeActions reseau={reseau} actions={actions} signaler={setConfirmation} libelle={`Tâches en cours de ${m.nom}`} magasins={[m.nom]} />
            </Section>
            <Box id="partie-campagnes" sx={{ scrollMarginTop: 160 }}><Section titre="Campagnes"><CampagnesMagasin reseau={reseau} magasin={m.nom} signaler={setConfirmation} /></Section></Box>
          </Box>
        )}

        {vue === 'visites' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <SectionAudits reseau={reseau} m={m} />
            <SectionVisites reseau={reseau} m={m} saisir={saisirVisite} modifier={setVisite} />
            <SectionReunionsMagasin reseau={reseau} magasin={m.nom} />
          </Box>
        )}

        {vue === 'journal' && <JournalMagasin reseau={reseau} m={m} signaler={setConfirmation} />}

        {vue === 'pratiques' && <SectionPratiques reseau={reseau} m={m} signaler={setConfirmation} />}

        {vue === 'chiffres' && (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <SectionChiffres reseau={reseau} m={m} saisir={(mois) => setSaisieChiffres(mois ?? null)} appeler={() => { setTypeVisite('appel'); setVisite(null) }} />
            <SectionLeviers reseau={reseau} m={m} />
            <Box id="partie-sante" sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start', scrollMarginTop: 160 }}>
              <SectionSante reseau={reseau} m={m} modifier={() => setEdition(true)} />
              <SectionDeploiements reseau={reseau} m={m} modifier={() => setEdition(true)} />
            </Box>
          </Box>
        )}

        {fermeture && <DialogFermeture magasin={m} jour={reseau.jour} onFermer={(msg) => { setFermeture(false); if (msg) setConfirmation(msg) }} />}
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
            {v.plan.length > 0 && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{v.plan.length} tâche{v.plan.length > 1 ? 's' : ''} au plan · {v.plan.filter((x) => x.faite).length} faite{v.plan.filter((x) => x.faite).length > 1 ? 's' : ''}</Typography>}
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
        const m = reseau.magasins.find((x) => x.nom === nom) ?? reseau.fermes.find((x) => x.nom === nom)
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
              <Typography component="h3" sx={[cartouche, { mr: 'auto' }]}>{libelleAxe(axe, !m.franchise)}</Typography>
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
      <Box><Typography component="h3" sx={[cartouche, { mb: 1 }]}>Évolution</Typography></Box>
      {[...changements].reverse().map((p) => (
        <Box key={p.date + p.caseId} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 0.75 }}>
          <Typography variant="body2" color="text.secondary" sx={{ width: 110, flexShrink: 0 }}>{dateCourte(p.date)}</Typography>
          <PastilleCase c={nineBox.find((c) => c.id === p.caseId) ?? null} />
        </Box>
      ))}
    </Box>
  )
}

// Une vingtaine de thématiques possibles : l'avancement en tête, puis les thématiques rangées par état (Joseph, 22/10/2026)
const etatsDeploiement: { ton: TonDeploiement | null; titre: string }[] = [
  { ton: 'negatif', titre: 'Pas déployé' }, { ton: 'partiel', titre: 'En partie' }, { ton: 'positif', titre: 'Déployé' }, { ton: null, titre: 'Non renseigné' },
]

function SectionDeploiements({ reseau, m, modifier }: { reseau: Reseau; m: Magasin; modifier: () => void }) {
  const ths = reseau.deploiements.thematiques
  const valeurs = reseau.deploiements.valeurs[m.nom] ?? {}
  const groupes = etatsDeploiement.map((g) => ({ ...g, ths: ths.filter((t) => tonDe(t, valeurs[t.id]) === g.ton) })).filter((g) => g.ths.length)
  const n = (ton: TonDeploiement) => groupes.find((g) => g.ton === ton)?.ths.length ?? 0
  const part = (ton: TonDeploiement) => (ths.length ? (n(ton) / ths.length) * 100 : 0)
  return (
    <Section titre="Déploiements" action={<Button startIcon={<EditOutlined />} onClick={modifier} aria-label="Modifier les déploiements" sx={{ minHeight: 48 }}>Modifier</Button>}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.1 }}>{n('positif')}</Typography>
        <Typography variant="body2" color="text.secondary">sur {ths.length} thématique{ths.length > 1 ? 's' : ''} déployée{n('positif') > 1 ? 's' : ''}</Typography>
      </Box>
      <Box role="img" aria-label={`${n('positif')} déployées, ${n('partiel')} en partie, ${n('negatif')} pas déployées sur ${ths.length}`}
        sx={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', bgcolor: 'action.hover', mt: 1, mb: 1 }}>
        <Box sx={{ width: `${part('positif')}%`, bgcolor: 'success.main' }} />
        <Box sx={{ width: `${part('partiel')}%`, bgcolor: 'warning.main' }} />
        <Box sx={{ width: `${part('negatif')}%`, bgcolor: 'error.light' }} />
      </Box>
      {groupes.map((g) => (
        <Box key={g.titre} component="section" aria-label={g.titre} sx={{ mt: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>{g.titre} · {g.ths.length}</Typography>
          <Box role="list" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {g.ths.map((t) => {
              const v = valeurs[t.id]
              // La valeur n'est précisée que si l'état seul ne la dit pas (« En cours », « Partiellement »…)
              const precise = v && g.ton && t.options.filter((o) => o.ton === g.ton).length > 1
              return <Chip key={t.id} role="listitem" size="small" variant="outlined" color={g.ton ? couleurTon[g.ton] : 'default'}
                label={precise ? `${t.libelle} · ${v}` : t.libelle} aria-label={`${t.libelle} : ${v || 'non renseigné'}`}
                sx={{ fontSize: 13, height: 28, maxWidth: '100%', ...(g.ton ? {} : { color: 'text.secondary' }) }} />
            })}
          </Box>
        </Box>
      ))}
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
// Leviers du CA : panier et flux, cave et bar, face au réseau du même mois et à N-1
function SectionLeviers({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const reperes = useReperesReseau([m.nom])
  if (reperes === undefined) return null
  const lev = leviersDuMagasin(reseau, m.nom, reperes)
  if (!lev) return null
  const insp = lev.levier ? inspirationsDu(reseau, m, lev.levier, lev.mois) : null
  return (
    <>
      <Section titre={`Leviers · ${libelleMois(lev.mois)}`}><ContenuLeviers lev={lev} /></Section>
      {/* S'inspirer d'un magasin qui réussit (sprint 22, A1) : équipe seule, la fiche n'existe pas pour le franchisé */}
      {lev.levier && insp && (
        <Section titre={`S’inspirer de · ${libellesLevier[lev.levier].toLowerCase()}`}
          action={<Typography variant="body2" color="text.secondary">{insp.portee === 'region' && m.rr ? m.rr.nom : 'Réseau'} · 3 mois</Typography>}>
          <ListeInspirations reseau={reseau} levier={lev.levier} insp={insp} />
        </Section>
      )}
    </>
  )
}

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
function ProfilMagasin({ m, reseau, alerte, enRetardNb, ouvertes, alerteVisite, appeler, message, visite, planifier, modifier, fermer, retour }: {
  m: Magasin; reseau: Reseau; alerte: ReturnType<typeof analyser>; enRetardNb: number; ouvertes: number; alerteVisite: string
  appeler: string; message: () => void; visite: () => void; planifier: () => void; modifier?: () => void; fermer?: () => void; retour: { libelle: string; aller: () => void }
}) {
  const c = caseDe(reseau.evaluations[m.nom])
  // Une seule pastille : la plus grave
  const ferme = !!m.fermeture && m.fermeture.date <= reseau.jour
  const pastille: { ton: Ton; libelle: string } | null = ferme ? { ton: 'gris', libelle: m.fermeture?.type === 'cession' ? 'Cédé' : 'Fermé' }
    : alerte?.statut === 'decroche' ? { ton: 'rouge', libelle: 'Décroche' }
    : enRetardNb ? { ton: 'rouge', libelle: `${enRetardNb} tâche${enRetardNb > 1 ? 's' : ''} en retard` }
    : alerte?.statut === 'surveiller' ? { ton: 'orange', libelle: 'À surveiller' }
    : alerteVisite ? { ton: 'orange', libelle: alerteVisite }
    : m.statut !== 'ouvert' ? { ton: m.statut === 'nouveau' ? 'bleu' : 'gris', libelle: statutLibelle[m.statut] } : null
  return (
    <ProfilPersonne nom={m.nom} retour={retour} avatar={(taille) => <Blason magasin={m} taille={taille} />}
      lignes={[[m.franchise ? 'Franchisé' : 'Intégré', [m.ville, m.departement && `(${m.departement})`].filter(Boolean).join(' ')].filter(Boolean).join(' · '), [m.coach || 'Sans Coach', m.rr?.nom].filter(Boolean).join(' · ')]}
      pastille={pastille}
      compteurs={[
        // Compteurs sans valeur retirés plutôt qu'affichés en tiret
        ...(alerte && alerte.ca !== null ? [{ valeur: formatKEuros(alerte.ca), libelle: `CA ${libelleMois(alerte.mois).split(' ')[0]}` }] : []),
        ...(alerte?.ecart !== null && alerte?.ecart !== undefined ? [{ valeur: formatPourcent(alerte.ecart), libelle: 'vs l’an dernier', couleur: alerte.ecart < 0 ? 'error.main' : undefined }] : []),
        { valeur: ouvertes || '0', libelle: ouvertes > 1 ? 'tâches en cours' : 'tâche en cours' },
      ]}
      detail={c && <><Box component="span" sx={{ color: 'text.secondary' }}>Nine box : </Box><b>{c.libelle}</b> · {c.rythme} par an</>}
      telephone={appeler}
      icones={<AutresActions nom={m.nom} planifier={planifier} preparer={lienPreparation(m.nom)} modifier={modifier} fermer={fermer} />}
      actions={<>
        <Tooltip title="Message"><IconButton onClick={message} aria-label="Écrire un message" sx={rond}><ChatBubbleOutlineOutlined /></IconButton></Tooltip>
        <Tooltip title="Saisir une visite"><IconButton onClick={visite} aria-label="Saisir une visite" sx={rond}><AddOutlined /></IconButton></Tooltip>
      </>} />
  )
}

// Planifier, Préparer et Modifier dans un menu « ⋯ » : trois pictos seulement à côté du nom (Joseph, 21/10/2026)
function AutresActions({ nom, planifier, preparer, modifier, fermer: fermerMagasin }: { nom: string; planifier: () => void; preparer: string; modifier?: () => void; fermer?: () => void }) {
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
        {fermerMagasin && <MenuItem onClick={() => { fermer(); fermerMagasin() }} sx={{ minHeight: { xs: 48, sm: 48 } }}><ListItemIcon><DoNotDisturbOnOutlined /></ListItemIcon>Fermer ou céder le magasin</MenuItem>}
      </Menu>
    </>
  )
}

// Journal du magasin : notes, santé, déploiements, Coachs et ouverture, du plus récent au plus ancien
// (visites, tâches, messages et chiffres ont leurs onglets)
function JournalMagasin({ reseau, m, signaler }: { reseau: Reseau; m: Magasin; signaler: (message: string) => void }) {
  const elements = useMemo(() => journalDansLeFil(reseau, m)
    .sort((a, b) => (b.instant.length === 10 ? `${b.instant}T00:00:00` : b.instant).localeCompare(a.instant.length === 10 ? `${a.instant}T00:00:00` : a.instant)), [reseau, m])
  const edition = useEditionJournal(reseau, m, signaler)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <FilActivite elements={elements} jour={reseau.jour} sansMagasin titre="Journal" ouvrirJournal={edition.ouvrir}
        action={<Button startIcon={<AddOutlined />} onClick={edition.nouvelleNote} sx={{ minHeight: 48 }}>Note</Button>} />
      {edition.fenetres}
    </Box>
  )
}
