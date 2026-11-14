import { EcartsAudit, RangeePhotos } from '../components/GrilleAudit'
import CalculateOutlined from '@mui/icons-material/CalculateOutlined'
import { suiviEtRR } from '../data/charge'
import { CartePratique, DialogPratique } from '../components/BonnesPratiques'
import { useReactionsPratiques } from '../data/reactionsPratiques'
import type { BonnePratique } from '../data/bonnesPratiques'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import RequestQuoteOutlined from '@mui/icons-material/RequestQuoteOutlined'
import { OngletBudget } from '../components/OngletBudget'
import { GroupeBudgetaire } from '../components/GroupeBudgetaire'
import StarOutlined from '@mui/icons-material/StarOutlined'
import StarBorderOutlined from '@mui/icons-material/StarBorderOutlined'
import { basculerFavori, noterRecent, useSuivis } from '../lib/suivis'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import ListItemIcon from '@mui/material/ListItemIcon'
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import type { Ton } from '../components/Social'
import { ProfilPersonne, rond } from '../components/Portefeuille'
import { Blason } from '../components/Blason'
import { FilActivite } from './Accueil'
import { filDu } from '../data/fil'
import { Puces } from '../components/Social'
import { SituationMagasin } from '../components/SyntheseMagasin'
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
import PlaceOutlined from '@mui/icons-material/PlaceOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import GridViewOutlined from '@mui/icons-material/GridViewOutlined'
import { texteSur } from '../theme/theme'
import { PastilleCase, PastilleTendance } from '../components/Sante'
import { journalDansLeFil, useEditionJournal } from '../components/Journal'
import { ANCIENNE_NOTE_FRANCHISE, caseDe, couleurTon, criteresAxe, historiqueSante, libelleAncienneNote, libelleAxe, libelleNote, niveauAxe, nineBox, scoreAxe, tendance, tonDe, type Axe, type Ton as TonDeploiement } from '../data/sante'
import { AvecReseau } from '../components/EtatDonnees'
import { ReaffecterDialog } from '../components/ReaffecterDialog'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import SwapHorizOutlined from '@mui/icons-material/SwapHorizOutlined'
import { DialogSituation } from '../components/DialogSituation'
import { enTravaux, etatSortie, situationsAffichees, texteSituation } from '../data/situations'
import SwapHoriz from '@mui/icons-material/SwapHoriz'
import { EmptyState } from '../components/EmptyState'
import { dateCourte, dateLongue, lienCoach, lienFiche, lienBilan, lienRR, telLien } from '../lib/format'
import { DialogMagasin } from '../components/EditionMagasin'
import EditOutlined from '@mui/icons-material/EditOutlined'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import { libelleResponsable, libelleTypeVisite, nomsVisiteurs, type Magasin, type Reseau, type Visite } from '../data/modele'
import { DialogVisite } from '../components/DialogVisite'
import { EnvoyerCompteRendu } from '../components/EnvoyerCompteRendu'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import { CampagnesMagasin } from '../components/Campagnes'
import { DialogAction, ListeActions } from '../components/Actions'
import { BoutonVisite } from '../components/BoutonVisite'
import { ListeAssocies } from '../components/Associes'
import { useDroits } from '../auth/Droits'
import { ContenuOnglet, Onglets, type Rubrique } from '../components/Onglets'
import { SectionOuverture } from '../components/Ouverture'
import { compteInstagram, libellesLicence, libellesTypologie, libellesZone, lienInstagram, resumeHoraires } from '../data/exploitation'
import { aOuvrir } from '../data/ouvertures'
import { actionsDuMagasin, enRetard } from '../data/actions'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined'
import { lienFil } from '../data/messagerie'
import { useConversationLaterale } from '../components/ConversationLaterale'
import { anneeDe, libellePasVu, lienCompteRendu, lienVisite, suiviRythme, visitesDuMagasin } from '../data/visites'
import AddOutlined from '@mui/icons-material/AddOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import PhoneInTalkOutlined from '@mui/icons-material/PhoneInTalkOutlined'
import AddTaskOutlined from '@mui/icons-material/AddTaskOutlined'
import RateReviewOutlined from '@mui/icons-material/RateReviewOutlined'
import { ContenuLeviers, ListeInspirations } from '../components/Leviers'
import { inspirationsDu, leviersDuMagasin, libellesLevier, useReperesReseau } from '../data/leviers'
import { DialogChiffres, GraphiqueCA, PastilleAlerte, PastilleAppel } from '../components/Chiffres'
import { Contact, Ligne, Section } from '../components/Section'
import { SectionExterieur, SectionRedressement } from '../components/ExterieurRedressement'
import { SectionReunionsMagasin } from '../components/Reunions'
import { SectionConcurrents } from '../components/Concurrents'
import { SectionEquipements } from '../components/Equipements'
import { SectionObjectifs } from '../components/Objectifs'
import { SectionPlan } from '../components/PlanAction'
import { MontrerAuFranchise } from '../components/MontrerAuFranchise'
import PresentToAllOutlined from '@mui/icons-material/PresentToAllOutlined'
import { analyser, caDe, chiffresDuMagasin, dernierAudit, formatEuros, formatKEuros, formatPourcent, formatValeur, libelleAudit, libelleMois, suiviAlerte } from '../data/chiffres'
import { cartouche } from '../components/Social'
import { FilAriane } from '../components/FilAriane'

// Refonte (Joseph, 09/11/2026, choix 3A) : cinq onglets, jamais plus de deux niveaux. Activité regroupe tâches et campagnes,
// visites et journal ; Chiffres regroupe le suivi face au budget, la santé, les leviers et les saisies (une seule source,
// la caisse) ; Budget ne garde que les étapes du budget. Les bonnes pratiques sont dans l'Activité (Joseph, 14/11/2026 :
// plus d'onglet « Ressources » ; anciens liens « ?vue=pratiques » ouverts sur le filtre Bonnes pratiques).
type VueFiche = 'fiche' | 'activite' | 'actions' | 'visites' | 'journal' | 'chiffres' | 'ninebox' | 'budget' | 'simulateurs' | 'pratiques'
type OngletFiche = 'fiche' | 'activite' | 'chiffres' | 'ninebox' | 'budget' | 'simulateurs'
const rubriquesFiche: Rubrique<OngletFiche>[] = [
  { vue: 'fiche', libelle: 'Vue d’ensemble', court: 'Aperçu', icone: <StorefrontOutlined /> },
  { vue: 'activite', libelle: 'Activité', icone: <TaskAltOutlined /> },
  { vue: 'chiffres', libelle: 'Chiffres', icone: <QueryStatsOutlined /> },
  { vue: 'budget', libelle: 'Budget', icone: <RequestQuoteOutlined /> },
  // Joseph (14/11/2026) : les simulateurs au même niveau que Chiffres et Budget, juste après eux
  { vue: 'simulateurs', libelle: 'Simulateurs', court: 'Simuler', icone: <CalculateOutlined /> },
  // Joseph (13/11/2026) : la nine box du magasin a son onglet, avec son évolution
  { vue: 'ninebox', libelle: 'Nine box', icone: <GridViewOutlined /> },
]
// Vague 3 (23A) : plus de sous-onglets dans Activité ; les anciennes adresses (actions, visites, journal) ouvrent le fil
// sur le bon filtre
const ongletDe = (v: VueFiche): OngletFiche => (v === 'actions' || v === 'visites' || v === 'journal' || v === 'activite' || v === 'pratiques' ? 'activite' : v)
const VUES: VueFiche[] = ['fiche', 'activite', 'actions', 'visites', 'journal', 'chiffres', 'ninebox', 'budget', 'simulateurs', 'pratiques']
// Anciens liens vers un onglet regroupé : l'onglet qui l'accueille, ouvert sur sa partie
const anciennesVues: Record<string, VueFiche> = { sante: 'ninebox', campagnes: 'actions', fil: 'journal' }
const filtreActivite = (v: VueFiche, fil: string | null): FiltreActivite =>
  (FILTRES_ACTIVITE.some((f) => f.v === fil) ? fil as FiltreActivite : v === 'visites' ? 'visites' : v === 'journal' ? 'journal' : v === 'pratiques' ? 'pratiques' : 'tout')
// Parties du pilotage rangées dans l'onglet Budget ; toutes les autres (suivi, santé, saisies) sont dans Chiffres
const PARTIES_BUDGET = ['budget', 'visualiser', 'echanges', 'depart', 'ventes', 'calendrier', 'investissements', 'equipe', 'fraisBudget', 'resultat', 'tresoBudget', 'travaux']

function Fiche({ m, reseau }: { m: Magasin; reseau: Reseau }) {
  const naviguer = useNavigate()
  const [params, setParams] = useSearchParams()
  const demandee = params.get('vue') ?? ''
  const partie = params.get('partie')
  const brute = (anciennesVues[demandee] ?? VUES.find((v) => v === demandee) ?? 'fiche') as VueFiche
  // Une partie du budget ouverte depuis Chiffres (ou l'inverse, anciens liens « vue=budget ») : l'onglet qui la porte
  // Anciens liens « vue=chiffres&partie=simulateurs » : l'onglet Simulateurs
  const vue: VueFiche = (brute === 'budget' || brute === 'chiffres') && partie ? (PARTIES_BUDGET.includes(partie) ? 'budget' : partie === 'simulateurs' ? 'simulateurs' : 'chiffres')
    : brute
  useEffect(() => {
    // Adresse lue au moment même : le suivi a pu la réécrire juste avant (ancienne partie, « tresorerie » → « comptes »)
    const actuelle = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '')
    if ((brute === 'budget' || brute === 'chiffres') && vue !== brute) setParams(() => { const n = actuelle(); n.set('vue', vue); return n }, { replace: true })
  }, [brute, vue, demandee, partie, setParams])
  const versMessages = demandee === 'messages'
  useEffect(() => { if (versMessages) naviguer(lienFil({ genre: 'magasin', magasin: m.nom, equipe: false }), { replace: true }) }, [versMessages, naviguer, m.nom])
  useEffect(() => { if (anciennesVues[demandee] && demandee !== 'sante') document.getElementById(`partie-${demandee}`)?.scrollIntoView({ block: 'start' }) }, [demandee])
  // Ancien lien « ?vue=sante » : la santé s'affiche une fois le suivi chargé, la page descend alors jusqu'à elle
  const versSante = useRef(demandee === 'sante')
  useEffect(() => {
    if (!versSante.current) return
    let essais = 0
    const minuterie = window.setInterval(() => {
      const e = document.getElementById('partie-sante')
      if (!e && ++essais < 50) return
      window.clearInterval(minuterie)
      versSante.current = false
      e?.scrollIntoView({ block: 'start' })
    }, 100)
    return () => window.clearInterval(minuterie)
  }, [])
  const changerOnglet = (o: OngletFiche) => setParams((p) => { const n = new URLSearchParams(p); n.delete('partie'); n.delete('fil'); if (o === 'fiche') n.delete('vue'); else n.set('vue', o); return n }, { replace: true })
  const [reaffectation, setReaffectation] = useState(false)
  const [edition, setEdition] = useState(false)
  const [visite, setVisite] = useState<Visite | null | undefined>(undefined)
  const [nouvelleTache, setNouvelleTache] = useState(false)
  const [nouvellePratique, setNouvellePratique] = useState(false)
  const [typeVisite, setTypeVisite] = useState('terrain')
  const [saisieChiffres, setSaisieChiffres] = useState<string | null | undefined>(undefined)
  const [confirmation, setConfirmation] = useState('')
  const [situation, setSituation] = useState(false)
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
  const ex = m.exploitation
  const conversation = useConversationLaterale(reseau, m.nom)
  const journal = useEditionJournal(reseau, m, setConfirmation)
  const manquants = [m.code, ex.implantation, m.ouvertureConnue, adresseComplete, m.telephone, m.email, ex.typologie, ex.zoneChalandise, ex.licence, ex.instagram, resumeHoraires(ex.horaires).length].filter((x) => !x).length
  return (
    <>
      <FilAriane pcSeulement etapes={[{ libelle: 'Magasins', lien: '/magasins' }]} ici={m.nom} />
      <ProfilMagasin retour={{ libelle: 'Magasins', aller: () => (window.history.length > 1 ? naviguer(-1) : naviguer('/magasins')) }} m={m} reseau={reseau} alerte={alerte} enRetardNb={enRetardNb} ouvertes={ouvertes.length} alerteVisite={rythme?.alerte ? libellePasVu(rythme) : ''}
        appeler={m.telephone || m.responsable?.telephone || ''} message={conversation.ouvrir}
        creer={{ visite: saisirVisite, tache: () => setNouvelleTache(true), appel: () => { setTypeVisite('appel'); setVisite(null) }, note: journal.nouvelleNote, pratique: () => setNouvellePratique(true) }}
        modifier={referentiels ? () => setEdition(true) : undefined} fermer={referentiels ? () => setSituation(true) : undefined} />
      {conversation.panneau}
      {situationsAffichees(m, reseau.jour).map((s) => (
        <Alert key={`${s.type}-${s.date}`} severity={s.type === 'sortie' || (s.type === 'travaux' && s.date <= reseau.jour) ? 'warning' : 'info'} sx={{ mb: 2 }}
          action={referentiels ? <Button color="inherit" onClick={() => setSituation(true)} sx={{ minHeight: 48 }}>Modifier</Button> : undefined}>
          {texteSituation(s)}
        </Alert>
      ))}
      <Onglets valeur={ongletDe(vue)} onChange={changerOnglet} rubriques={rubriquesFiche} libelle={`Rubriques de ${m.nom}`} fiche titre={m.nom} />
      <ContenuOnglet>

        {/* Vague 3 (22A) : les informations du magasin à gauche, où en est le magasin au centre */}
        {vue === 'fiche' && (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '360px minmax(0, 1fr)' }, alignItems: 'start' }}>
            <Box sx={{ display: 'grid', gap: 2, minWidth: 0, order: { xs: 2, lg: 1 } }}>
              <Section titre="Équipe" action={referentiels ? <Button startIcon={<SwapHoriz />} onClick={() => setReaffectation(true)} sx={{ minHeight: 48 }}>Réaffecter</Button> : undefined}>
                <Contact role="Coach" p={coach} lien={m.coach ? lienCoach(m.coach) : undefined} sousTitre={m.coach ? undefined : 'Aucun Coach affecté à ce jour'} />
                <Contact role={m.rr?.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional'} p={m.rr} lien={m.rr ? lienRR(m.rr.id) : undefined} sousTitre={m.rrEnDirect ? 'Gère ce magasin en direct' : undefined} />
                {m.franchise && m.responsableARecruter && <Contact role={libelleResponsable(m)} p={null} sousTitre="En cours de recrutement" />}
                <ListeAssocies reseau={reseau} m={m} signaler={setConfirmation} />
              </Section>
              <Section titre="Magasin">
                <Ligne compacte libelle="Code magasin">{m.code || null}</Ligne>
                <Ligne compacte libelle="Implantation des produits">{m.exploitation.implantation ? dateLongue(m.exploitation.implantation) : null}</Ligne>
                <Ligne compacte libelle="Ouverture">{m.ouvertureConnue ? dateLongue(m.ouverture) : null}</Ligne>
                <GroupeBudgetaire magasin={m.nom} modifiable={referentiels} />
                <Ligne compacte libelle="Adresse">
                  {adresseComplete && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <span>{adresseComplete}</span>
                      {lienPlan && <Chip icon={<PlaceOutlined />} label="Itinéraire" size="small" component="a" href={lienPlan} target="_blank" rel="noopener" clickable sx={{ fontSize: '0.75rem' }} />}
                    </Box>
                  )}
                </Ligne>
                <Ligne compacte libelle="Téléphone">{m.telephone && <Link href={telLien(m.telephone)}>{m.telephone}</Link>}</Ligne>
                <Ligne compacte libelle="Email">{m.email && <Link href={`mailto:${m.email}`}>{m.email}</Link>}</Ligne>
              </Section>
              <SectionExploitation m={m} />
              {manquants > 0 && <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 700, px: 1 }}>{manquants} information{manquants > 1 ? 's' : ''} à compléter{referentiels ? '' : ' par le Directeur de réseau'}
                {referentiels && <Button onClick={() => setEdition(true)} sx={{ minHeight: 48, ml: 1 }}>Compléter</Button>}</Typography>}
              <SectionEquipements reseau={reseau} m={m} signaler={setConfirmation} />
              <SectionConcurrents reseau={reseau} m={m} signaler={setConfirmation} />
            </Box>
            <Box sx={{ display: 'grid', gap: 2, minWidth: 0, order: { xs: 1, lg: 2 } }}>
              {aOuvrir(m, reseau.jour) && <SectionOuverture reseau={reseau} m={m} signaler={setConfirmation} />}
              <SituationMagasin reseau={reseau} m={m} objectifs={<><SectionPlan reseau={reseau} m={m} signaler={setConfirmation} /><SectionObjectifs reseau={reseau} m={m} signaler={setConfirmation} /></>} />
              {lieuCarte && (
                <Card sx={{ overflow: 'hidden' }}>
                  <Box component="iframe" title={`Carte Google de ${m.nom}`} src={`https://www.google.com/maps?q=${encodeURIComponent(lieuCarte)}&output=embed&hl=fr`}
                    loading="lazy" referrerPolicy="no-referrer-when-downgrade" sx={{ display: 'block', width: '100%', height: 260, border: 0 }} />
                </Card>
              )}
            </Box>
          </Box>
        )}

        {/* Vague 3 (23A) : l'activité du magasin en un seul fil, « À venir » en tête */}
        {ongletDe(vue) === 'activite' && (
          <ActiviteMagasin reseau={reseau} m={m} filtre={filtreActivite(vue, params.get('fil'))} filtrer={(f) => setParams((p) => { const n = new URLSearchParams(p); n.set('vue', 'activite'); if (f === 'tout') n.delete('fil'); else n.set('fil', f); return n }, { replace: true })}
            actions={actions} signaler={setConfirmation} saisirVisite={saisirVisite} modifierVisite={setVisite} ajouterPratique={() => setNouvellePratique(true)} />
        )}

        {vue === 'budget' && <OngletBudget nom={m.nom} mode="budget" />}
        {vue === 'simulateurs' && <OngletBudget nom={m.nom} mode="simulateurs" />}

        {vue === 'ninebox' && (
          <Box id="partie-sante" sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) minmax(0, 1fr)' }, alignItems: 'start' }}>
            <GrilleMagasin reseau={reseau} m={m} />
            <SectionSante reseau={reseau} m={m} modifier={() => naviguer(`/plus/sante?vue=evaluer&magasin=${encodeURIComponent(m.nom)}`)} />
            {/* Les déploiements des thématiques suivent la santé du magasin */}
            <Box sx={{ gridColumn: { lg: '1 / -1' } }}><SectionDeploiements reseau={reseau} m={m} modifier={() => naviguer(`/campagnes?vue=deploiements&magasin=${encodeURIComponent(m.nom)}`)} /></Box>
          </Box>
        )}

        {vue === 'chiffres' && <OngletBudget nom={m.nom} mode="chiffres" sante={
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <SectionChiffres reseau={reseau} m={m} saisir={(mois) => setSaisieChiffres(mois ?? null)} appeler={() => { setTypeVisite('appel'); setVisite(null) }} />
            <SectionRedressement reseau={reseau} m={m} />
            <SectionExterieur reseau={reseau} m={m} />
            <SectionLeviers reseau={reseau} m={m} />
          </Box>
        } />}

        {nouvellePratique && <DialogPratique reseau={reseau} pratique={null} magasinInitial={m.nom} onFermer={(msg) => { setNouvellePratique(false); if (msg) setConfirmation(msg) }} />}
        {situation && <DialogSituation magasin={m} jour={reseau.jour} onFermer={(msg) => { setSituation(false); if (msg) setConfirmation(msg) }} />}
        {reaffectation && <ReaffecterDialog reseau={reseau} magasin={m} ouvert onFermer={(fait) => { setReaffectation(false); if (fait) setConfirmation(`${m.nom} est confié à ${fait}.`) }} />}
        {edition && <DialogMagasin reseau={reseau} magasin={m} onFermer={(msg, nom) => {
          setEdition(false)
          if (!msg) return
          if (msg.includes('supprimé')) { naviguer('/magasins', { replace: true }); return }
          setConfirmation(msg)
          if (nom && nom !== m.nom) naviguer(lienFiche(nom), { replace: true })
        }} />}
        {nouvelleTache && <DialogAction reseau={reseau} magasins={[m.nom]} action={null} onFermer={(msg) => { setNouvelleTache(false); if (msg) setConfirmation(msg) }} />}
        {journal.fenetres}
        {visite !== undefined && <DialogVisite reseau={reseau} visite={visite} magasinsInitiaux={[m.nom]} typeInitial={typeVisite} onFermer={(msg) => { setVisite(undefined); if (msg) setConfirmation(msg) }} />}
        {saisieChiffres !== undefined && <DialogChiffres reseau={reseau} magasin={m.nom} mois={saisieChiffres ?? undefined} onFermer={(msg) => { setSaisieChiffres(undefined); if (msg) setConfirmation(msg) }} />}
        <Snackbar open={!!confirmation} autoHideDuration={5000} onClose={() => setConfirmation('')} message={confirmation} />
      </ContenuOnglet>
    </>
  )
}

// Rythme de visite de l'année et toutes les visites du magasin, de la plus récente à la plus ancienne
// Exploitation (0037) : typologie, zone de chalandise, licence, Instagram et horaires ; l'implantation des produits est avec l'ouverture
function SectionExploitation({ m }: { m: Magasin }) {
  const e = m.exploitation
  const horaires = resumeHoraires(e.horaires)
  // Vague 3 (22A) : rien de renseigné, la carte ne s'affiche pas (les champs comptent dans « informations à compléter »)
  if (!e.typologie && !e.zoneChalandise && !e.licence && !e.instagram && !horaires.length) return null
  return (
    <Section titre="Exploitation">
      <Ligne compacte libelle="Typologie">{e.typologie ? libellesTypologie[e.typologie] : null}</Ligne>
      <Ligne compacte libelle="Zone de chalandise">{e.zoneChalandise ? libellesZone[e.zoneChalandise] : null}</Ligne>
      <Ligne compacte libelle="Licence">{e.licence ? libellesLicence[e.licence] : null}</Ligne>
      <Ligne compacte libelle="Instagram">{e.instagram && <Link href={lienInstagram(e.instagram)} target="_blank" rel="noopener">{compteInstagram(e.instagram)}</Link>}</Ligne>
      <Ligne compacte libelle="Horaires">
        {horaires.length > 0 && (
          <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.25 }}>
            {horaires.map((h) => [
              <Box component="dt" key={`j${h.jours}`} sx={{ color: 'text.secondary' }}>{h.jours}</Box>,
              <Box component="dd" key={`h${h.jours}`} sx={{ m: 0 }}>{h.heures}</Box>,
            ])}
          </Box>
        )}
      </Ligne>
    </Section>
  )
}

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

// Onglet Nine box (Joseph, 13/11/2026) : la grille, la case actuelle en couleur, les cases passées numérotées
// du plus ancien (1) au plus récent : on voit le chemin du magasin
function GrilleMagasin({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const actuelle = caseDe(reseau.evaluations[m.nom])
  const points = historiqueSante(reseau.evaluations, m.nom).filter((p) => p.caseId)
  const chemin = points.filter((p, i) => i === 0 || p.caseId !== points[i - 1].caseId)
  const passages = (id: string) => chemin.map((p, i) => ({ ...p, n: i + 1 })).filter((p) => p.caseId === id && !(p === chemin.at(-1) && id === actuelle?.id))
  return (
    <Section titre="Nine box">
      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto repeat(3, minmax(0, 1fr))', gap: 0.75, alignItems: 'stretch' }}>
        {[3, 2, 1].map((mg) => [
          <Typography key={`l${mg}`} variant="caption" color="text.secondary" sx={{ alignSelf: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '0.75rem' }}>{['Faible', 'Moyen', 'Fort'][mg - 1]}</Typography>,
          ...[1, 2, 3].map((r) => {
            const c = nineBox.find((x) => x.resultats === r && x.management === mg)!
            const ici = actuelle?.id === c.id
            const avant = passages(c.id)
            return (
              <Box key={c.id} role="group" aria-label={`${c.libelle}${ici ? ', case actuelle' : ''}${avant.length ? `, passé le ${avant.map((p) => dateCourte(p.date)).join(', ')}` : ''}`}
                sx={{ minHeight: 76, p: 1, borderRadius: 2, border: '2px solid', borderColor: ici ? c.couleur : 'divider', bgcolor: ici ? c.couleur : 'transparent', color: ici ? texteSur(c.couleur) : 'text.primary', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: ici ? 700 : 600, lineHeight: 1.25 }}>{c.libelle}</Typography>
                {avant.length > 0 && <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>{avant.map((p) => (
                  <Box key={p.date} component="span" title={dateCourte(p.date)} sx={{ minWidth: 24, height: 24, px: 0.5, borderRadius: 999, bgcolor: 'background.paper', color: 'text.primary', border: '1px solid', borderColor: 'divider', fontSize: '0.75rem', fontWeight: 700, display: 'grid', placeItems: 'center' }}>{p.n}</Box>
                ))}</Box>}
              </Box>
            )
          }),
        ])}
        <Box />
        {['Faible', 'Moyen', 'Fort'].map((x) => <Typography key={x} variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontSize: '0.75rem' }}>{x}</Typography>)}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Résultats en colonnes, {m.franchise ? 'franchisé' : 'Associés'} en lignes.{chemin.length > 1 ? ' Les numéros donnent les cases passées, de la plus ancienne (1) à la plus récente.' : ''}</Typography>
      {!actuelle && <Typography sx={{ mt: 1 }}>Magasin pas encore classé.</Typography>}
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
        <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.1 }}>{n('positif')}</Typography>
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
    <Section titre="Chiffres" action={reseau.chiffresFermes ? undefined : <Button startIcon={<EditOutlined />} onClick={() => saisir()} aria-label="Saisir les chiffres" sx={{ minHeight: 48 }}>Saisir</Button>}>
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
                {!reseau.chiffresFermes && <Tooltip title="Modifier"><IconButton onClick={() => saisir(c.mois)} sx={{ width: 48, height: 48 }} aria-label={`Modifier les chiffres de ${libelleMois(c.mois)}`}><EditOutlined /></IconButton></Tooltip>}
              </Box>
            ))}
            {liste.length > 6 && <Button onClick={() => setTousLesMois((v) => !v)} sx={{ minHeight: 48, mt: 0.5 }}>{tousLesMois ? 'Afficher moins' : `Voir les ${liste.length} mois`}</Button>}
          </Box>
        )
      })()}
    </Section>
  )
}

// Filtre « Bonnes pratiques » de l'activité : celles du magasin en entier (modifier, J'aime, commentaires), et celles
// d'autres magasins qu'il a reprises. L'ajout passe par le « + » de l'en-tête ; l'état vide le propose aussi.
function SectionPratiques({ reseau, m, signaler, ajouter }: { reseau: Reseau; m: Magasin; signaler: (msg: string) => void; ajouter: () => void }) {
  const [edition, setEdition] = useState<BonnePratique | null | undefined>(undefined)
  const reactions = useReactionsPratiques()
  const siennes = reseau.pratiques.filter((p) => p.magasin === m.nom)
  const reprises = reseau.pratiques.filter((p) => p.reprises.includes(m.nom))
  return (
    <Section titre="Bonnes pratiques">
      {!siennes.length && !reprises.length && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">Aucune bonne pratique pour ce magasin.</Typography>
          <Button startIcon={<AddOutlined />} onClick={ajouter} sx={{ minHeight: 48 }}>Ajouter une bonne pratique</Button>
        </Box>
      )}
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
function ProfilMagasin({ m, reseau, alerte, enRetardNb, ouvertes, alerteVisite, appeler, message, creer, modifier, fermer, retour }: {
  m: Magasin; reseau: Reseau; alerte: ReturnType<typeof analyser>; enRetardNb: number; ouvertes: number; alerteVisite: string
  appeler: string; message: () => void; creer: MenuCreer; modifier?: () => void; fermer?: () => void; retour: { libelle: string; aller: () => void }
}) {
  const c = caseDe(reseau.evaluations[m.nom])
  // Une seule pastille : la plus grave
  const ferme = !!m.fermeture && m.fermeture.date <= reseau.jour
  const pastille: { ton: Ton; libelle: string } | null = ferme ? { ton: 'gris', libelle: etatSortie[m.fermeture!.type] }
    : enTravaux(m, reseau.jour) ? { ton: 'orange', libelle: `Fermé jusqu’au ${dateCourte(m.travaux!.fin)}` }
    : alerte?.statut === 'decroche' ? { ton: 'rouge', libelle: 'Décroche' }
    : enRetardNb ? { ton: 'rouge', libelle: `${enRetardNb} tâche${enRetardNb > 1 ? 's' : ''} en retard` }
    : alerte?.statut === 'surveiller' ? { ton: 'orange', libelle: 'À surveiller' }
    : alerteVisite ? { ton: 'orange', libelle: alerteVisite }
    : m.statut !== 'ouvert' ? { ton: m.statut === 'nouveau' ? 'bleu' : 'gris', libelle: statutLibelle[m.statut] } : null
  const concept = etatConcept20(reseau, m.nom)
  const [montrer, setMontrer] = useState(false)
  return (
    <>
    <ProfilPersonne nom={m.nom} retour={retour}
      insigne={concept && <Chip size="small" icon={<AutoAwesomeOutlined />} label={concept === 'fait' ? 'Concept 2.0' : 'Concept 2.0 en cours'}
        color={concept === 'fait' ? 'primary' : 'default'} variant={concept === 'fait' ? 'filled' : 'outlined'} sx={{ fontSize: 12, fontWeight: 700, flexShrink: 0 }} />} avatar={(taille) => <Blason magasin={m} taille={taille} />}
      lignes={[[m.franchise ? 'Franchisé' : 'Intégré', [m.ville, m.departement && `(${m.departement})`].filter(Boolean).join(' ')].filter(Boolean).join(' · '), suiviEtRR(m)]}
      pastille={pastille}
      compteurs={[
        // Compteurs sans valeur retirés plutôt qu'affichés en tiret
        ...(alerte && alerte.ca !== null ? [{ valeur: formatKEuros(alerte.ca), libelle: `CA ${libelleMois(alerte.mois).split(' ')[0]}` }] : []),
        ...(alerte?.ecart !== null && alerte?.ecart !== undefined ? [{ valeur: formatPourcent(alerte.ecart), libelle: 'vs l’an dernier', couleur: alerte.ecart < 0 ? 'error.main' : undefined }] : []),
        { valeur: ouvertes || '0', libelle: ouvertes > 1 ? 'tâches en cours' : 'tâche en cours' },
      ]}
      detail={c && <><Box component="span" sx={{ color: 'text.secondary' }}>Nine box : </Box><b>{c.libelle}</b> · {c.rythme} par an</>}
      telephone={appeler}
      icones={<AutresActions nom={m.nom} modifier={modifier} fermer={fermer} />}
      principal={<BoutonVisite reseau={reseau} magasin={m.nom} principal />}
      actions={<>
        <Tooltip title="Message"><IconButton onClick={message} aria-label="Écrire un message" sx={rond}><ChatBubbleOutlineOutlined /></IconButton></Tooltip>
        {/* Choix 116 : en visite, les chiffres du magasin en grand, sans rien d'interne */}
        <Tooltip title="Montrer au franchisé"><IconButton onClick={() => setMontrer(true)} aria-label="Montrer au franchisé" sx={rond}><PresentToAllOutlined /></IconButton></Tooltip>
        <MenuAjouter creer={creer} />
      </>} />
    {montrer && <MontrerAuFranchise reseau={reseau} magasin={m.nom} fermer={() => setMontrer(false)} />}
    </>
  )
}

// Concept 2.0 (Joseph, 26/10/2026) : passage au nouveau concept, montré à côté du nom ; suivi dans les déploiements
function etatConcept20(reseau: Reseau, magasin: string): 'fait' | 'enCours' | null {
  const t = reseau.deploiements.thematiques.find((x) => x.id === 'concept20') ?? reseau.deploiements.thematiques.find((x) => /2\.0/.test(x.libelle))
  if (!t) return null
  const ton = tonDe(t, reseau.deploiements.valeurs[magasin]?.[t.id])
  return ton === 'positif' ? 'fait' : ton === 'partiel' ? 'enCours' : null
}

// Vague 7 (79A et retour de Joseph, 10/11/2026) : un seul jeu d'actions dans l'en-tête. Le bouton « Visite » dit la prochaine
// étape ; « + » ajoute une visite non prévue, une tâche, un appel ou une note
interface MenuCreer { visite: () => void; tache: () => void; appel: () => void; note: () => void; pratique: () => void }
function MenuAjouter({ creer }: { creer: MenuCreer }) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const choisir = (f: () => void) => () => { setAncre(null); f() }
  return (
    <>
      <Tooltip title="Ajouter"><IconButton onClick={(e) => setAncre(e.currentTarget)} aria-label="Ajouter" aria-haspopup="menu" aria-expanded={!!ancre} sx={rond}><AddOutlined /></IconButton></Tooltip>
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem onClick={choisir(creer.tache)} sx={{ minHeight: 48 }}><ListItemIcon><AddTaskOutlined /></ListItemIcon>Tâche</MenuItem>
        <MenuItem onClick={choisir(creer.visite)} sx={{ minHeight: 48 }}><ListItemIcon><RateReviewOutlined /></ListItemIcon>Visite non prévue</MenuItem>
        <MenuItem onClick={choisir(creer.appel)} sx={{ minHeight: 48 }}><ListItemIcon><PhoneInTalkOutlined /></ListItemIcon>Appel</MenuItem>
        <MenuItem onClick={choisir(creer.note)} sx={{ minHeight: 48 }}><ListItemIcon><EditOutlined /></ListItemIcon>Note</MenuItem>
        {/* Joseph (13/11/2026) : la bonne pratique s'ajoute depuis le « + » du magasin */}
        <MenuItem onClick={choisir(creer.pratique)} sx={{ minHeight: 48 }}><ListItemIcon><TipsAndUpdatesOutlined /></ListItemIcon>Bonne pratique</MenuItem>
      </Menu>
    </>
  )
}

// Bilan de l'année (sprint 26, F1), favoris et Modifier dans un menu « ⋯ »
function AutresActions({ nom, modifier, fermer: fermerMagasin }: { nom: string; modifier?: () => void; fermer?: () => void }) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const favori = useSuivis().favoris.includes(nom)
  const fermer = () => setAncre(null)
  return (
    <>
      <Tooltip title="Autres actions"><IconButton onClick={(e) => setAncre(e.currentTarget)} aria-label="Autres actions" aria-haspopup="menu" aria-expanded={!!ancre} sx={{ width: 48, height: 48 }}><MoreHorizOutlined /></IconButton></Tooltip>
      <Menu anchorEl={ancre} open={!!ancre} onClose={fermer} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem component={RouterLink} to={lienBilan(nom)} onClick={fermer} sx={{ minHeight: { xs: 48, sm: 48 } }}><ListItemIcon><InsightsOutlined /></ListItemIcon>Bilan de l’année</MenuItem>
        <MenuItem onClick={() => { fermer(); basculerFavori(nom) }} sx={{ minHeight: { xs: 48, sm: 48 } }}><ListItemIcon>{favori ? <StarOutlined /> : <StarBorderOutlined />}</ListItemIcon>{favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}</MenuItem>
        {modifier && <MenuItem onClick={() => { fermer(); modifier() }} sx={{ minHeight: { xs: 48, sm: 48 } }}><ListItemIcon><EditOutlined /></ListItemIcon>Modifier la fiche</MenuItem>}
        {fermerMagasin && <MenuItem onClick={() => { fermer(); fermerMagasin() }} sx={{ minHeight: { xs: 48, sm: 48 } }}><ListItemIcon><SwapHorizOutlined /></ListItemIcon>Changer la situation</MenuItem>}
      </Menu>
    </>
  )
}

// Activité du magasin (refonte vague 3, Joseph 09/11/2026, 23A) : un seul fil, « À venir » en tête (visite prévue,
// tâches ouvertes, campagnes), puis le passé du plus récent au plus ancien : visites et comptes rendus, tâches, chiffres,
// bonnes pratiques et journal (notes, santé, déploiements, Coachs, ouverture). Filtres en puces ; « Visites » montre le
// détail des visites et audits (modifier, compte rendu, envoi).
type FiltreActivite = 'tout' | 'visites' | 'taches' | 'pratiques' | 'chiffres' | 'journal'
const FILTRES_ACTIVITE: { v: FiltreActivite; libelle: string; genres: string[] }[] = [
  { v: 'tout', libelle: 'Tout', genres: [] },
  { v: 'visites', libelle: 'Visites', genres: ['visite'] },
  { v: 'taches', libelle: 'Tâches', genres: ['tache'] },
  // Joseph (13/11/2026) : les bonnes pratiques du magasin ont leur filtre dans l'activité
  { v: 'pratiques', libelle: 'Bonnes pratiques', genres: ['pratique'] },
  { v: 'chiffres', libelle: 'Chiffres', genres: ['chiffres'] },
  { v: 'journal', libelle: 'Journal', genres: ['journal'] },
]
function ActiviteMagasin({ reseau, m, filtre, filtrer, actions, signaler, saisirVisite, modifierVisite, ajouterPratique }: {
  reseau: Reseau; m: Magasin; filtre: FiltreActivite; filtrer: (f: FiltreActivite) => void; actions: ReturnType<typeof actionsDuMagasin>
  signaler: (message: string) => void; saisirVisite: () => void; modifierVisite: (v: Visite) => void; ajouterPratique: () => void
}) {
  const edition = useEditionJournal(reseau, m, signaler)
  const tous = useMemo(() => [...filDu(reseau, new Set([m.nom]), null, 3650), ...journalDansLeFil(reseau, m)]
    .sort((a, b) => (b.instant.length === 10 ? `${b.instant}T00:00:00` : b.instant).localeCompare(a.instant.length === 10 ? `${a.instant}T00:00:00` : a.instant)), [reseau, m])
  const genres = FILTRES_ACTIVITE.find((f) => f.v === filtre)!.genres
  const elements = genres.length ? tous.filter((e) => genres.includes(e.genre)) : tous
  const prevues = reseau.visites.filter((v) => v.magasin === m.nom && v.date > reseau.jour).sort((a, b) => a.date.localeCompare(b.date))
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {/* Vague 7 (retour de Joseph, 10/11/2026) : un seul jeu d'actions, celles de l'en-tête de la fiche */}
      <Section titre="À venir">
        {prevues.map((v) => (
          <Box key={v.id ?? v.date} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 48, borderBottom: '1px solid', borderColor: 'divider' }}>
            <EventAvailableOutlined sx={{ color: 'text.secondary' }} />
            <Typography sx={{ flex: 1, minWidth: 0 }}><b>{libelleTypeVisite(v.type)} prévue</b> · {dateLongue(v.date)}{v.visiteurs.length ? ` · ${nomsVisiteurs(v)}` : ''}</Typography>
            <Button component={RouterLink} to={lienVisite(v)} sx={{ minHeight: 48 }}>Ouvrir</Button>
          </Box>
        ))}
        <ListeActions reseau={reseau} actions={actions} signaler={signaler} libelle={`Tâches en cours de ${m.nom}`} magasins={[m.nom]} />
        <Box id="partie-campagnes" sx={{ mt: 2, scrollMarginTop: 160 }}>
          <Typography component="h3" sx={{ fontWeight: 700, mb: 1 }}>Campagnes</Typography>
          <CampagnesMagasin reseau={reseau} magasin={m.nom} signaler={signaler} />
        </Box>
      </Section>
      <Box>
        <Puces label="Filtrer l’activité" valeur={filtre} onChange={filtrer} options={FILTRES_ACTIVITE.map((f) => ({ v: f.v, libelle: f.libelle }))} />
      </Box>
      {filtre === 'pratiques'
        ? <SectionPratiques reseau={reseau} m={m} signaler={signaler} ajouter={ajouterPratique} />
        : filtre === 'visites'
        ? <>
          <SectionAudits reseau={reseau} m={m} />
          <SectionVisites reseau={reseau} m={m} saisir={saisirVisite} modifier={modifierVisite} />
          <SectionReunionsMagasin reseau={reseau} magasin={m.nom} />
        </>
        : elements.length
          ? <FilActivite elements={elements} jour={reseau.jour} sansMagasin sansFiltre titre="Fil d’activité" ouvrirJournal={edition.ouvrir} />
          : <Typography variant="body2" color="text.secondary">Rien pour l’instant dans ce filtre.</Typography>}
      {edition.fenetres}
    </Box>
  )
}
