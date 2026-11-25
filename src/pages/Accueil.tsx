import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Badge from '@mui/material/Badge'
import Drawer from '@mui/material/Drawer'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { visuellementCache } from '../lib/accessibilite'
import FilterListOutlined from '@mui/icons-material/FilterListOutlined'
import Tooltip from '@mui/material/Tooltip'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import TodayOutlined from '@mui/icons-material/TodayOutlined'
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import CelebrationOutlined from '@mui/icons-material/CelebrationOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { FenetreCompteRendu, PieceJointe, useOuvrirCompteRendu } from '../components/ApercuCompteRendu'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import { CarteLignes, GrillePhotos, Initiales, LigneCompacte, Pastille, Puces, TitreSection } from '../components/Social'
import { useAuth } from '../auth/AuthContext'
import { useMessagerie } from '../data/MessagerieContext'
import { lienFiche } from '../lib/format'
import { type Reseau, type Visite } from '../data/modele'
import { DialogPlanifier } from '../components/DialogPlanifier'
import { marquerVisiteFaite } from '../data/chargement'
import { useReseau } from '../data/ReseauContext'
import { messageErreur } from '../components/EditionEquipe'
import { magasinsDu, perimetreDuProfil, type Perimetre } from '../data/perimetre'
import { AuMagasin } from '../components/AuMagasin'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import Collapse from '@mui/material/Collapse'
import { libelleTypeVisite } from '../data/modele'
import { PageHeader } from '../components/PageHeader'
import { SelecteurPerimetre } from '../components/SelecteurPerimetre'
import RateReviewOutlined from '@mui/icons-material/RateReviewOutlined'
import { monNomPorteur, type ActionSuivie } from '../data/actions'
import { useEcritureActions } from '../components/Actions'
import { filDu, quand, type ElementFil, type GenreFil } from '../data/fil'
import { useCommunicationsDuFil, type CommunicationsDuFil } from '../data/communications'
import { MarqueUne, ReactionsCommunication } from './Communications'
import { useApercu } from '../auth/Apercu'
import Snackbar from '@mui/material/Snackbar'
import { VisuelFil } from '../components/MiseEnForme'
import { ReactionsPratique } from '../components/BonnesPratiques'
import { useReactionsPratiques, type ReactionsPratiques } from '../data/reactionsPratiques'
import { basculerPouceVisite, commenterVisite, messageReactionVisite, supprimerCommentaireVisite, useReactionsVisites, type ReactionsVisites } from '../data/reactionsVisites'
import { Reactions, ReactionsEnAttente } from '../components/Reactions'
import { BandeCollante } from '../components/Collant'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { SondagesARepondre } from '../components/Questions'
import { brand } from '../theme/theme'
import { Blason } from '../components/Blason'
import { ALaUne, aLaUneDuJour } from '../components/ALaUne'
import { prendreConnaissance, useConnaissances, type Connaissance } from '../data/communications'
import { ActionsSimples, AJour, BarrePartager, BoutonConnaissance, CartePublication, estPublication, instantFil, useDernierPassage, useSuiteAutomatique } from '../components/Publication'
import { FAMILLES, pointDuJour, type Famille, type LignePoint, type PointDuJour } from '../data/pointDuJour'
import PanToolOutlined from '@mui/icons-material/PanToolOutlined'
import { modifierNoteMagasin } from '../data/chargement'

const APERCU = 5

// Cocher une tâche sans quitter l'accueil ; « Annuler » la remet en cours
function useCocherTache(reseau: Reseau) {
  const { recharger } = useReseau()
  const { cocher, lectureSeule } = useEcritureActions(reseau)
  const [fait, setFait] = useState<ActionSuivie | null>(null)
  const [erreur, setErreur] = useState('')
  const basculer = async (x: ActionSuivie, faite: boolean) => {
    try { await cocher(x, faite); await recharger(); setFait(faite ? x : null) } catch { setFait(null); setErreur('La tâche n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.') }
  }
  const bandeau = (
    <>
      <Snackbar open={!!fait} autoHideDuration={5000} onClose={() => setFait(null)} message={fait ? `Tâche faite : ${fait.a.action}` : ''}
        action={fait && <Button color="inherit" onClick={() => basculer(fait, false)} sx={{ minHeight: 48, color: brand.or, fontWeight: 700 }}>Annuler</Button>} />
      <Snackbar open={!!erreur} autoHideDuration={5000} onClose={() => setErreur('')} message={erreur} />
    </>
  )
  return { cocher: lectureSeule ? null : (x: ActionSuivie) => basculer(x, true), bandeau }
}

function LigneTache({ x, cocher, titre, detail, lien, fin }: { x: ActionSuivie; cocher: ((x: ActionSuivie) => void) | null; titre: string; detail: string; lien: string; fin?: ReactNode }) {
  if (!cocher) return <LigneCompacte lien={lien} avatar={<Initiales nom={titre} icone={<TaskAltOutlined />} />} titre={titre} detail={detail} fin={fin} />
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', pl: 1 }}>
      <Tooltip title="Faite"><IconButton onClick={() => cocher(x)} aria-label={`Tâche faite : ${titre}`} sx={{ width: 48, height: 48, flex: 'none', border: '2px solid', borderColor: 'text.primary', ml: 0.5 }}><CheckOutlined /></IconButton></Tooltip>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex' }}><LigneCompacte lien={lien} titre={titre} detail={detail} fin={fin} /></Box>
    </Box>
  )
}

const iconeFamille: Record<Famille, ReactNode> = { comptesrendus: <RateReviewOutlined />, taches: <TaskAltOutlined />, carnet: <LockOutlined />, visites: <EventNoteOutlined /> }

// 430 : ma journée, les visites d'aujourd'hui et de demain ; « Je suis au magasin » au-dessus
function MaJournee({ reseau, p, journee, encadrement }: { reseau: Reseau; p: Perimetre; journee: Visite[]; encadrement: boolean }) {
  const { recharger } = useReseau()
  const [reporter, setReporter] = useState<Visite | null>(null)
  const [message, setMessage] = useState('')
  const faite = async (v: Visite) => {
    try { await marquerVisiteFaite(v.id!); await recharger(); setMessage(`Visite de ${v.magasin} comptée faite.`) } catch (e) { setMessage(messageErreur(e)) }
  }
  return (
    <Box component="section" aria-label="Ma journée" sx={{ mb: 2 }}>
      <Box sx={{ mb: 1.5 }}><AuMagasin reseau={reseau} p={p} /></Box>
      {(journee.length > 0 || !encadrement) && <TitreSection nombre={journee.length || undefined}>Ma journée</TitreSection>}
      {journee.length > 0 ? (
        <CarteLignes>
          {journee.map((v) => (
            <LigneCompacte key={v.id ?? `${v.magasin}-${v.date}`} lien={v.prevue ? `${lienFiche(v.magasin)}/visite` : lienFiche(v.magasin)} avatar={<Blason magasin={reseau.magasins.find((m) => m.nom === v.magasin)} nom={v.magasin} />}
              titre={v.magasin} detail={[v.date === reseau.jour ? 'Aujourd’hui' : 'Demain', libelleTypeVisite(v.type), v.prevue ? 'prévue' : 'faite'].join(' · ')}
              actions={v.prevue && v.id !== null ? <Box sx={{ display: 'flex', gap: 0.5, flex: 'none' }}>
                {v.date === reseau.jour && <Button onClick={() => faite(v)} aria-label={`Visite de ${v.magasin} faite`} sx={{ minHeight: 48, minWidth: 0, px: 1.25 }}>Faite</Button>}
                <Button onClick={() => setReporter(v)} aria-label={`Reporter la visite de ${v.magasin}`} sx={{ minHeight: 48, minWidth: 0, px: 1.25 }}>Reporter</Button>
              </Box> : undefined} />
          ))}
        </CarteLignes>
      ) : !encadrement && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Aucune visite prévue aujourd’hui ni demain.</Typography>}
      {reporter && <DialogPlanifier reseau={reseau} magasins={[reporter.magasin]} dateInitiale={reseau.jour} visite={reporter} onFermer={(m) => { setReporter(null); if (m) setMessage(m) }} />}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </Box>
  )
}

// 435 : une section par famille (comptes rendus, tâches, carnet, magasins à visiter), cinq lignes, la suite se déplie
function SectionFamille({ reseau, famille, lignes, moi, cocher, lectureSeule, faite, reporter, prendre }: {
  reseau: Reseau; famille: (typeof FAMILLES)[number]; lignes: LignePoint[]; moi: string; cocher: ((x: ActionSuivie) => void) | null; lectureSeule: boolean
  faite: (v: Visite) => void; reporter: (v: Visite) => void; prendre: (x: NonNullable<LignePoint['note']>) => void
}) {
  const [tout, setTout] = useState(false)
  const vues = tout ? lignes : lignes.slice(0, APERCU)
  const fin = (x: LignePoint) => x.pastille && <Pastille ton={x.pastille.ton}>{x.pastille.libelle}</Pastille>
  const avatar = (x: LignePoint) => {
    const m = x.magasin ? reseau.magasins.find((y) => y.nom === x.magasin) : undefined
    return m ? <Blason magasin={m} /> : <Initiales nom={x.titre} icone={x.personne ? undefined : iconeFamille[x.famille]} />
  }
  const ligne = (x: LignePoint) => {
    if (x.visite) return (
      <LigneCompacte key={x.cle} lien={`${lienFiche(x.visite.magasin)}/visite`} avatar={avatar(x)} titre={x.titre} detail={x.detail}
        actions={<Box sx={{ display: 'flex', gap: 0.5, flex: 'none' }}>
          <Button onClick={() => faite(x.visite!)} aria-label={`Visite de ${x.titre} faite`} sx={{ minHeight: 48, minWidth: 0, px: 1.25 }}>Faite</Button>
          <Button onClick={() => reporter(x.visite!)} aria-label={`Reporter la visite de ${x.titre}`} sx={{ minHeight: 48, minWidth: 0, px: 1.25 }}>Reporter</Button>
        </Box>} />
    )
    if (x.tache) return <LigneTache key={x.cle} x={x.tache} cocher={cocher} lien={x.lien} titre={x.titre} detail={x.detail} fin={fin(x)} />
    if (x.note && !x.note.note.prise && moi && !lectureSeule) return (
      <LigneCompacte key={x.cle} lien={x.lien} avatar={avatar(x)} titre={x.titre} detail={x.detail}
        actions={<Tooltip title="Je m’en occupe"><IconButton onClick={() => prendre(x.note!)} aria-label={`Je m’en occupe : ${x.titre}`} sx={{ width: 48, height: 48, flex: 'none' }}><PanToolOutlined /></IconButton></Tooltip>} />
    )
    return <LigneCompacte key={x.cle} lien={x.lien} avatar={avatar(x)} titre={x.titre} detail={x.detail} fin={fin(x)} />
  }
  return (
    <Box component="section" aria-label={famille.libelle} sx={{ mb: 2 }}>
      <TitreSection nombre={lignes.length} action={<Button component={RouterLink} to={famille.lien} endIcon={<ArrowForwardOutlined />} sx={{ minHeight: 48 }}>Ouvrir</Button>}>{famille.libelle}</TitreSection>
      <CarteLignes>
        {vues.map(ligne)}
        {lignes.length > APERCU && (
          <ButtonBase onClick={() => setTout((v) => !v)} sx={{ width: '100%', minHeight: 48, fontWeight: 600, fontSize: '0.875rem' }}>{tout ? 'Afficher moins' : `Voir les ${lignes.length}`}</ButtonBase>
        )}
      </CarteLignes>
    </Box>
  )
}

function BlocPoint({ reseau, point, moi }: { reseau: Reseau; point: PointDuJour; moi: string }) {
  const { recharger } = useReseau()
  const taches = useCocherTache(reseau)
  const [reporter, setReporter] = useState<Visite | null>(null)
  const [message, setMessage] = useState('')
  const lectureSeule = !!useApercu().equipe
  const faite = async (v: Visite) => {
    try { await marquerVisiteFaite(v.id!); await recharger(); setMessage(`Visite de ${v.magasin} comptée faite.`) } catch (e) { setMessage(messageErreur(e)) }
  }
  const prendre = async ({ magasin, note }: NonNullable<LignePoint['note']>) => {
    try {
      await modifierNoteMagasin(magasin, note.id, (n) => ({ ...n, prise: { par: moi, quand: new Date().toISOString() } }))
      await recharger(); setMessage('C’est noté : tu t’en occupes.')
    } catch (e) { setMessage(messageErreur(e)) }
  }
  const familles = FAMILLES.map((f) => ({ f, lignes: point.lignes.filter((x) => x.famille === f.v) })).filter((x) => x.lignes.length)
  return (
    <Box component="section" aria-label="À traiter" sx={{ '& .MuiTypography-body2': { whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } }}>
      {!familles.length ? (
        <CarteLignes><LigneCompacte avatar={<Initiales nom="ok" icone={<TaskAltOutlined />} couleur={brand.vertFonce} />} titre="Rien en retard" detail="Comptes rendus, tâches, carnet et visites sont à jour." /></CarteLignes>
      ) : familles.map(({ f, lignes }) => (
        <SectionFamille key={f.v} reseau={reseau} famille={f} lignes={lignes} moi={moi} cocher={taches.cocher} lectureSeule={lectureSeule} faite={(v) => void faite(v)} reporter={setReporter} prendre={(x) => void prendre(x)} />
      ))}
      {reporter && <DialogPlanifier reseau={reseau} magasins={[reporter.magasin]} dateInitiale={reseau.jour} visite={reporter} onFermer={(m) => { setReporter(null); if (m) setMessage(m) }} />}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
      {taches.bandeau}
    </Box>
  )
}
type FiltreFil = 'tout' | GenreFil
const filtresFil: { v: FiltreFil; libelle: string }[] = [
  { v: 'tout', libelle: 'Tout' }, { v: 'visite', libelle: 'Visites' }, { v: 'tache', libelle: 'Tâches' },
  { v: 'message', libelle: 'Messages' }, { v: 'chiffres', libelle: 'Chiffres' }, { v: 'pratique', libelle: 'Bonnes pratiques' },
  { v: 'communication', libelle: 'Communications' }, { v: 'animation', libelle: 'Temps forts et campagnes' }, { v: 'journal', libelle: 'Journal' },
]
const PAS_FIL = 20
const AUCUNE: never[] = []

const iconeFil: Record<GenreFil, ReactNode> = { visite: <EventNoteOutlined />, tache: <TaskAltOutlined />, message: <ChatBubbleOutlineOutlined />, chiffres: <QueryStatsOutlined />, pratique: <TipsAndUpdatesOutlined />, communication: <CampaignOutlined />, journal: <HistoryOutlined />, animation: <CelebrationOutlined /> }

// Une publication du fil : qui, quoi, où, quand ; le texte et les photos en dessous
export function PublicationFil({ e, jour, sansMagasin = false, ouvrir }: { e: ElementFil; jour: string; sansMagasin?: boolean; ouvrir?: (e: ElementFil) => void }) {
  const qui = e.genre === 'chiffres' ? '' : e.auteur
  const action = qui ? e.action : e.action.charAt(0).toUpperCase() + e.action.slice(1)
  const ou = e.genre === 'communication' || e.genre === 'animation' ? e.cible : sansMagasin ? '' : e.magasin
  const tete = <>{qui && <><b>{qui}</b> · </>}{action}{ou ? <> · <b>{ou}</b></> : ''}</>
  // Compte rendu d'une visite : s'ouvre dans une fenêtre, le fil reste à sa place
  const ouvrirCR = useOuvrirCompteRendu()
  const cr = e.genre === 'visite' && e.visiteId ? () => ouvrirCR(e.visiteId!) : undefined
  return (
    <Box>
      <ButtonBase {...(ouvrir ? { onClick: () => ouvrir(e), 'aria-label': e.libelleOuvrir } : cr ? { onClick: cr } : { component: RouterLink, to: e.lien })} sx={{ display: 'block', textAlign: 'left', width: '100%', p: 2, color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Initiales nom={qui || e.magasin || e.genre} icone={qui && e.genre !== 'communication' ? undefined : iconeFil[e.genre]} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tete}</Typography>
            <Typography variant="body2" color="text.secondary">{quand(e.instant, jour)}</Typography>
          </Box>
          {e.valeur && (
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontWeight: 700 }}>{e.valeur}</Typography>
              {e.texte && <Typography variant="body2" sx={{ fontWeight: 600, color: e.ecart !== null && e.ecart !== undefined && e.ecart < 0 ? 'error.main' : 'text.secondary' }}>{e.texte}</Typography>}
            </Box>
          )}
        </Box>
        {e.visuel && <Box sx={{ mx: -2, mt: 1.5 }}><VisuelFil piece={e.visuel.piece} url={e.visuel.url} alt={e.titre ?? ''} /></Box>}
        {e.titre && <Typography sx={{ mt: 1.25, fontWeight: 600 }}>{e.titre}</Typography>}
        {e.texte && !e.valeur && <Typography {...(e.genre === 'visite' ? { variant: 'body2' as const, color: 'text.secondary' } : {})} sx={{ mt: e.titre ? 0.25 : 1.25, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-line' }}>{e.texte}</Typography>}
      </ButtonBase>
      {/* Les photos hors du lien : le toucher les ouvre en plein écran */}
      {(!!e.photos?.length || cr) && <Box sx={{ px: 2, pb: 2, mt: -0.75, display: 'flex', flexDirection: 'column', gap: 1 }}><GrillePhotos photos={e.photos} />
        {cr && <PieceJointe nom={`Compte rendu de ${e.magasin}`} libelle={`Ouvrir le compte rendu de ${e.magasin}`} onOuvrir={cr} />}</Box>}
    </Box>
  )
}

// Connaissances des communications, pour le geste « J'ai pris connaissance » du franchisé dans le fil
export interface ConnaissancesDuFil { carte: Map<number, Connaissance> | null; franchise: boolean; recharger: () => void }

export function FilActivite({ elements, jour, sansMagasin = false, sansFiltre = false, titre = 'Actualités', communications, reactionsPratiques, reactionsVisites, action, ouvrirJournal, limite, lienTout, social = false, partager, connaissances, telephone = false }: {
  elements: ElementFil[]; jour: string; sansMagasin?: boolean; sansFiltre?: boolean; titre?: string; communications?: CommunicationsDuFil; reactionsPratiques?: ReactionsPratiques | null
  // undefined : en cours de lecture (les deux écrans du fil les passent toujours)
  reactionsVisites?: ReactionsVisites | null
  action?: ReactNode; ouvrirJournal?: (e: ElementFil) => void
  // Vague 8 (Joseph, 11/11/2026, « les actus en premier plan, comme un réseau social ») : sur téléphone, l'accueil montre
  // les premières publications en tête, la suite dans Actualités
  limite?: number; lienTout?: string
  // social : fil d'actualité façon réseau social (Accueil, Actualités) : une carte par publication, repère « Nouveau »
  // depuis le dernier passage (211A) ; la fiche magasin garde son fil d'activité. 207A : « Partager » en tête ; 206A : prise de connaissance
  social?: boolean; partager?: ReactNode; connaissances?: ConnaissancesDuFil
  // Accueil téléphone (maquette 278, Joseph 17/11/2026) : pas de titre visible, Partager en un champ, filtres derrière un
  // picto, publications bord à bord séparées par un fin espace
  telephone?: boolean
}) {
  const { apercu, equipe } = useApercu()
  const [message, setMessage] = useState('')
  const [filtre, setFiltre] = useState<FiltreFil>('tout')
  const [nb, setNb] = useState(limite ?? PAS_FIL)
  const [ancreFiltre, setAncreFiltre] = useState<HTMLElement | null>(null)
  const vuAvant = useDernierPassage(social && !apercu)
  const vus = elements.filter((e) => filtre === 'tout' || e.genre === filtre)
  // Visite, photos, tâches et messages d'un même magasin le même jour : une seule carte (Joseph, 21/10/2026) ;
  // une publication garde toujours sa propre carte (204A, Joseph 15/11/2026)
  const groupes = useMemo(() => {
    const parCle = new Map<string, ElementFil[]>()
    for (const e of vus) {
      const cle = (social && estPublication(e)) || e.communication || e.pratique || e.journal || !e.magasin ? e.cle : `${e.magasin}|${e.instant.slice(0, 10)}`
      const g = parCle.get(cle)
      if (g) g.push(e); else parCle.set(cle, [e])
    }
    // Les communications à la une restent en tête
    const tous = [...parCle.values()]
    return [...tous.filter((g) => g[0].communication?.aLaUne), ...tous.filter((g) => !g[0].communication?.aLaUne)]
  }, [vus, social])
  const options = filtresFil.filter((f) => f.v === 'tout' || elements.some((e) => e.genre === f.v))
  const lectureSeule = !!apercu || !!equipe
  const plus = useCallback(() => setNb((n) => n + PAS_FIL), [])
  const suite = useSuiteAutomatique(plus, !lienTout && groupes.length > nb)
  const estNouveau = (e: ElementFil) => !!vuAvant && instantFil(e.instant) > vuAvant
  const affiches = groupes.slice(0, nb)
  // Le séparateur « Vous êtes à jour » suit la dernière nouveauté, s'il reste des publications plus anciennes
  const derniereNouvelle = affiches.reduce((d, g, i) => (estNouveau(g[0]) ? i : d), -1)
  const prendre = (id: number) => prendreConnaissance(id).then(() => { setMessage('C’est noté, merci.'); connaissances?.recharger() }, () => setMessage('La confirmation n’a pas pu partir. Réessayez dans un instant.'))
  const reactions = (e: ElementFil) => {
    if (e.communication && communications?.moi) {
      const k = connaissances?.franchise ? connaissances.carte?.get(e.communication.id) : undefined
      return <ReactionsCommunication c={e.communication} moi={communications.moi} jour={jour} lectureSeule={lectureSeule} apres={communications.recharger} signaler={setMessage}
        extra={k ? <BoutonConnaissance pris={!!k.moi} lectureSeule={lectureSeule} prendre={() => void prendre(e.communication!.id)} /> : undefined} />
    }
    if (e.pratique && reactionsPratiques) return <ReactionsPratique p={e.pratique} reactions={reactionsPratiques} lectureSeule={lectureSeule} signaler={setMessage} />
    if (e.visiteId && reactionsVisites) return (
      <Reactions titre={`le compte rendu de ${e.magasin}`} pouces={reactionsVisites.pouces[e.visiteId] ?? AUCUNE} commentaires={reactionsVisites.commentaires[e.visiteId] ?? AUCUNE}
        moi={reactionsVisites.moi} jour={jour} lectureSeule={lectureSeule} basculer={() => basculerPouceVisite(e.visiteId!)} commenter={(t) => commenterVisite(e.visiteId!, t)}
        supprimer={supprimerCommentaireVisite} message={messageReactionVisite} apres={reactionsVisites.recharger} signaler={setMessage} />
    )
    // Réactions encore en lecture : même barre, inactive, pour que la carte ne change pas de forme
    if ((e.visiteId && reactionsVisites === undefined) || (e.pratique && reactionsPratiques === undefined)) return <ReactionsEnAttente />
    return <ActionsSimples lien={e.lien} libelle={e.genre === 'visite' ? 'Voir le compte rendu' : 'Voir le détail'} />
  }
  return (
    <Box component="section" aria-label={titre}>
      {telephone ? <Typography component="h2" sx={visuellementCache}>{titre}</Typography> : <TitreSection action={action}>{titre}</TitreSection>}
      {telephone ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            {partager ?? <Box sx={{ flex: 1 }} />}
            {!sansFiltre && options.length > 2 && (
              <IconButton onClick={(ev) => setAncreFiltre(ev.currentTarget)} aria-label="Filtrer le fil" aria-haspopup="menu" sx={{ width: 48, height: 48, flexShrink: 0 }}>
                <Badge color="secondary" variant="dot" invisible={filtre === 'tout'}><FilterListOutlined /></Badge>
              </IconButton>
            )}
          </Box>
          <Menu anchorEl={ancreFiltre} open={!!ancreFiltre} onClose={() => setAncreFiltre(null)} slotProps={{ list: { 'aria-label': 'Filtrer le fil' } }}>
            {options.map((o) => <MenuItem key={o.v} selected={o.v === filtre} onClick={() => { setAncreFiltre(null); setFiltre(o.v); setNb(PAS_FIL) }} sx={{ minHeight: 48 }}>{o.libelle}</MenuItem>)}
          </Menu>
          {filtre !== 'tout' && <Box sx={{ mb: 1.5 }}><Button variant="outlined" color="inherit" endIcon={<CloseOutlined />} onClick={() => { setFiltre('tout'); setNb(PAS_FIL) }} aria-label={`Retirer le filtre ${options.find((o) => o.v === filtre)?.libelle ?? ''}`} sx={{ minHeight: 48, borderRadius: 999 }}>{options.find((o) => o.v === filtre)?.libelle}</Button></Box>}
        </>
      ) : <>
        {partager}
        {!sansFiltre && options.length > 2 && <BandeCollante><Puces valeur={filtre} options={options} onChange={(v) => { setFiltre(v); setNb(PAS_FIL) }} label="Filtrer le fil" /></BandeCollante>}
      </>}
      {!vus.length ? (
        <CarteLignes><LigneCompacte avatar={<Initiales nom="fil" icone={<HistoryOutlined />} />} titre="Rien de nouveau" detail="Les comptes rendus et les communications des dernières semaines s’afficheront ici." /></CarteLignes>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, ...(telephone ? { gap: 0.75, mx: -2, '& > .MuiCard-root': { borderRadius: 0, borderLeft: 0, borderRight: 0 }, '& > [role="separator"]': { px: 2 } } : {}) }}>
          {affiches.map(([e, ...reste], i) => {
            const carte = social && estPublication(e) ? (
              <CartePublication key={e.cle} e={e} jour={jour} sansMagasin={sansMagasin} nouveau={estNouveau(e)}
                entete={e.communication?.aLaUne && <Box sx={{ pt: 1.5 }}><MarqueUne jusquAu={e.communication.aLaUne} /></Box>}>
                {reactions(e)}
              </CartePublication>
            ) : (
              <Card key={e.cle} component={e.communication || e.pratique ? 'article' : 'div'}
                aria-label={e.communication?.titre ?? e.pratique?.titre} sx={{ border: 0, overflow: 'hidden', ...(reste.length ? { '& > * + *': { borderTop: '1px solid', borderColor: 'divider' } } : {}) }}>
                <PublicationFil e={e} jour={jour} sansMagasin={sansMagasin} ouvrir={e.libelleOuvrir && ouvrirJournal ? ouvrirJournal : undefined} />
                {reste.map((x) => <PublicationFil key={x.cle} e={x} jour={jour} sansMagasin={sansMagasin} ouvrir={x.libelleOuvrir && ouvrirJournal ? ouvrirJournal : undefined} />)}
              </Card>
            )
            return i === derniereNouvelle && i < affiches.length - 1 ? <Fragment key={e.cle}>{carte}<AJour /></Fragment> : carte
          })}
          {groupes.length > nb && (lienTout
            ? <Button component={RouterLink} to={lienTout} sx={{ alignSelf: 'center', minHeight: 48 }}>Voir toutes les actualités</Button>
            : <><Box ref={suite} aria-hidden /><Button onClick={plus} sx={{ alignSelf: 'center', minHeight: 48 }}>Voir plus</Button></>)}
        </Box>
      )}
      <FenetreCompteRendu />
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </Box>
  )
}

// Choix 278 (Joseph, 17/11/2026) : sur téléphone, le fil seul, façon LinkedIn. Le point du jour passe dans la barre du
// haut, en picto avec le nombre d'urgences (comme une notification) ; il ouvre une page pleine
function PointTelephone({ point, children }: { point: PointDuJour; children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false)
  const [cible, setCible] = useState<HTMLElement | null>(null)
  useEffect(() => { setCible(document.getElementById('entete-actions-page')) }, [])
  // Le nombre rouge ne compte que les urgences (pastille rouge) ; le reste attend dans la page (Joseph 17/11/2026)
  const urgences = point.lignes.filter((x) => x.pastille?.ton === 'rouge').length
  const n = point.lignes.length
  const resume = [point.journee.length ? `${point.journee.length} visite${point.journee.length > 1 ? 's' : ''} aujourd’hui et demain` : '', n ? `${n} à traiter` : '', urgences ? `dont ${urgences} urgence${urgences > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ') || 'rien en retard'
  const bouton = (
    <Tooltip title="Mon point du jour">
      <IconButton onClick={() => setOuvert(true)} aria-label={`Mon point du jour, ${resume}`} aria-haspopup="dialog" aria-expanded={ouvert} sx={{ width: 48, height: 48, flexShrink: 0 }}>
        <Badge color="error" badgeContent={urgences} max={99}><TodayOutlined /></Badge>
      </IconButton>
    </Tooltip>
  )
  return (
    <>
      {cible ? createPortal(bouton, cible) : <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>{bouton}</Box>}
      <Drawer anchor="right" open={ouvert} onClose={() => setOuvert(false)} sx={{ zIndex: (t) => t.zIndex.modal }} slotProps={{ paper: { role: 'dialog', 'aria-label': 'Mon point du jour', sx: { width: '100%', bgcolor: 'background.default' } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 'calc(8px + env(safe-area-inset-top))', pb: 1, position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
          <Typography component="h2" sx={{ fontWeight: 700, fontSize: '1.125rem', flex: 1 }}>Mon point du jour</Typography>
          <IconButton onClick={() => setOuvert(false)} aria-label="Fermer" sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
        </Box>
        <Box sx={{ px: 2, pt: 2, pb: 'calc(24px + env(safe-area-inset-bottom))' }}>{children}</Box>
      </Drawer>
    </>
  )
}

// Accueil (refonte vague 5, Joseph 10/11/2026, 43A) : l'actualité au centre, « Aujourd'hui » en colonne à droite sur PC.
// 429 à 436 (Joseph, 25/11/2026) : « Aujourd'hui » et « Mon point du jour » ne gardent que l'action terrain (ma journée,
// comptes rendus, tâches, carnet, magasins à visiter) ; plus de chiffre d'affaires ni de période à choisir.
function Tableau({ reseau, p }: { reseau: Reseau; p: Perimetre }) {
  const { profil } = useAuth()
  const { messagerie } = useMessagerie()
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const communications = useCommunicationsDuFil()
  const { connaissances, recharger: rechargerConnaissances } = useConnaissances()
  const moi = monNomPorteur(reseau, profil)
  const point = useMemo(() => pointDuJour(reseau, p, moi), [reseau, p, moi])
  const encadrement = p.type !== 'coach'
  const noms = useMemo(() => new Set(magasinsDu(reseau, p).map((m) => m.nom)), [reseau, p])
  const reactionsPratiques = useReactionsPratiques()
  const reactionsVisites = useReactionsVisites()
  // Les communications à la une sont dans le bandeau : le fil ne les répète pas
  const unes = useMemo(() => new Set(aLaUneDuJour(communications.liste, reseau.jour).map((c) => c.id)), [communications.liste, reseau.jour])
  const fil = useMemo(() => filDu(reseau, noms, messagerie, 120, communications.liste, true, true, true).filter((e) => !e.communication || !unes.has(e.communication.id)),
    [reseau, noms, messagerie, communications.liste, unes])
  const aLaUne = <ALaUne liste={communications.liste} jour={reseau.jour} connaissances={connaissances} franchise={false} lectureSeule apres={() => void rechargerConnaissances()}
    lien={(c) => `/infos?vue=communications&c=${c.id}`} />
  // Vague 8 (Joseph, 11/11/2026) : l'actualité d'abord, comme un réseau social. Sur téléphone, À la une puis les
  // dernières publications, ensuite le point du jour ; les indicateurs se déplient. Sur PC, le fil ouvre la page et les
  // indicateurs passent en tête de la colonne « Aujourd'hui ».
  // 15/11/2026 (204A à 211A) : le fil façon réseau social. « Partager » en tête du fil, une publication par carte, repère
  // « Nouveau » ; sur téléphone, le point du jour se replie en une bande au-dessus d'un fil qui défile sans fin.
  const peutPublier = profil?.role === 'directeur' || profil?.role === 'rr'
  const partager = <BarrePartager moi={monNomPorteur(reseau, profil) || profil?.nom || ''} franchise={false} communication={peutPublier} reseau={reseau} apres={communications.recharger} compact={!surPC} />
  // Choix 212 (15/11/2026) : l'Accueil porte seul le fil, avec ses filtres (l'onglet Fil d'Actualités est retiré)
  const filActu = <FilActivite elements={fil} jour={reseau.jour} titre="Actualités" social telephone={!surPC} partager={partager} communications={communications} reactionsPratiques={reactionsPratiques} reactionsVisites={reactionsVisites} />
  if (!surPC) return (
    <>
      {aLaUne}
      <PointTelephone point={point}>
        <MaJournee reseau={reseau} p={p} journee={point.journee} encadrement={encadrement} />
        <SondagesARepondre equipe aFaire titre="Sondages à remplir" />
        <BlocPoint reseau={reseau} point={point} moi={moi} />
      </PointTelephone>
      {filActu}
    </>
  )
  return (
    <>
      {aLaUne}
      {/* Choix 271 (Joseph, 17/11/2026) : le fil façon LinkedIn, la colonne « Aujourd'hui » à côté. 17/11 : aligné à gauche
          sous le titre, fil jusqu'à 760 px, la colonne de droite prend le reste (plus de vide sur les côtés) */}
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'minmax(0, 760px) minmax(360px, 1fr)', justifyContent: 'start', alignItems: 'start' }}>
        <Box sx={{ minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>{filActu}</Box>
        <Box component="aside" aria-label="Aujourd’hui" sx={{ minWidth: 0 }}>
          <MaJournee reseau={reseau} p={p} journee={point.journee} encadrement={encadrement} />
          <SondagesARepondre equipe aFaire titre="Sondages à remplir" />
          <BlocPoint reseau={reseau} point={point} moi={moi} />
        </Box>
      </Box>
    </>
  )
}

// Téléphone (209A) : une bande qui résume, le détail se déplie ; le fil passe juste dessous. Dépliée une fois, elle le
// reste sur l'appareil (confort de lecture, rien d'important n'y est rangé)
const cleBande = (titre: string) => `vandb-bande-${titre}`
export function BandeRepliable({ titre, resume, icone, children }: { titre: string; resume: string; icone: ReactNode; children: ReactNode }) {
  const [ouvert, setOuvertEtat] = useState(() => { try { return localStorage.getItem(cleBande(titre)) === '1' } catch { return false } })
  const setOuvert = (f: (o: boolean) => boolean) => setOuvertEtat((o) => {
    const v = f(o)
    try { localStorage.setItem(cleBande(titre), v ? '1' : '0') } catch { /* appareil sans stockage */ }
    return v
  })
  return (
    <Card component="section" aria-label={titre} sx={{ mb: 2 }}>
      <ButtonBase onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} sx={{ width: '100%', minHeight: 56, px: 2, py: 1, gap: 1.5, justifyContent: 'flex-start', textAlign: 'left', fontFamily: 'inherit' }}>
        <Box sx={{ color: 'secondary.main', display: 'flex' }}>{icone}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>{titre}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>{resume}</Typography>
        </Box>
        {ouvert ? <ExpandLessOutlined /> : <ExpandMoreOutlined />}
      </ButtonBase>
      <Collapse in={ouvert} unmountOnExit><Box sx={{ px: 2, pb: 2 }}>{children}</Box></Collapse>
    </Card>
  )
}

export function Accueil() {
  const { profil } = useAuth()
  // Le Directeur voit tout le réseau ; un Coach ou un RR, ses magasins
  const p = perimetreDuProfil(profil) ?? { type: 'reseau' as const }
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  return (
    <>
      {/* 278 (Joseph 17/11/2026) : sur téléphone, pas de titre visible, le périmètre en puce, le fil tout de suite */}
      {surPC ? <PageHeader titre="Accueil" /> : <>
        <Typography variant="h1" sx={visuellementCache}>Accueil</Typography>
        {!!profil && profil.role !== 'franchise' && <Box sx={{ mb: 1, '&:empty': { display: 'none' } }}><SelecteurPerimetre compact /></Box>}
      </>}
      <AvecReseau>{(r) => <Tableau reseau={r} p={p} />}</AvecReseau>
    </>
  )
}
