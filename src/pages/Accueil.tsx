import { useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import PersonSearchOutlined from '@mui/icons-material/PersonSearchOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import HandshakeOutlined from '@mui/icons-material/HandshakeOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { CarteLignes, GrillePhotos, Initiales, LigneCompacte, Pastille, Puces, TitreSection, type Ton } from '../components/Social'
import { analyser, suiviAlerte } from '../data/chiffres'
import { useAuth } from '../auth/AuthContext'
import { useMessagerie } from '../data/MessagerieContext'
import { caseDe, tendance } from '../data/sante'
import { anneeDe, suiviRythme, type LigneRythme } from '../data/visites'
import { chargeA, coachA, niveauCharge } from '../data/charge'
import { dateCourte, lienCoach, lienFiche } from '../lib/format'
import { ajouterJours, elementsDuMois, jourLong } from './Agenda'
import { libelleResponsable, type Magasin, type Reseau } from '../data/modele'
import { magasinsDu, perimetreDuProfil, personnesDu, type Perimetre } from '../data/perimetre'
import { PageHeader } from '../components/PageHeader'
import { actionsEnCours, echeanceDate, enRetard } from '../data/actions'
import { libellesEtatMandat, mandatsARenouveler } from '../data/associes'
import { bilan, magasinsConcernes, phase } from '../data/campagnes'
import { filDu, quand, type ElementFil, type GenreFil } from '../data/fil'
import { useCommunicationsDuFil, type CommunicationsDuFil } from '../data/communications'
import { MarqueUne, ReactionsCommunication } from './Communications'
import { useApercu } from '../auth/Apercu'
import Snackbar from '@mui/material/Snackbar'
import { VisuelFil } from '../components/MiseEnForme'
import { ReactionsPratique } from '../components/BonnesPratiques'
import { useReactionsPratiques, type ReactionsPratiques } from '../data/reactionsPratiques'
import { BandeCollante } from '../components/Collant'

// Ordre de priorité fixé par Joseph le 14/10/2026
const PRIORITAIRES = ['redressement', 'relance', 'renforcer']
const APERCU = 5

// Une ligne « À traiter » : un avatar, deux lignes de texte, une seule pastille (la plus grave)
interface ATraiter { cle: string; titre: string; detail: string; lien: string; avatar: string; icone?: ReactNode; pastille?: { ton: Ton; libelle: string } }

function aTraiter(reseau: Reseau, p: Perimetre, sansParametres: boolean): ATraiter[] {
  const j = reseau.jour
  const perimetre = magasinsDu(reseau, p)
  const noms = new Set(perimetre.map((m) => m.nom))
  const actifs = perimetre.filter((m) => m.statut !== 'avenir')
  const avecCoach = p.type !== 'coach'
  const coachDe = (m: Magasin) => (avecCoach ? `${coachA(m, j) || 'Sans Coach'} · ` : '')
  const items: ATraiter[] = []
  const vus = new Set<string>()
  // Démarche coach : les magasins qui décrochent d'abord (appel en retard en tête), puis ceux à surveiller
  const alertes = actifs.map((m) => { const an = analyser(reseau, m.nom); return { m, an, suivi: suiviAlerte(reseau, m.nom, an) } })
    .filter((x) => x.an?.statut === 'decroche' || x.an?.statut === 'surveiller')
    .sort((x, y) => (x.an!.statut === y.an!.statut ? 0 : x.an!.statut === 'decroche' ? -1 : 1) || (y.suivi?.retard ?? 0) - (x.suivi?.retard ?? 0) || (x.an!.ecart ?? 0) - (y.an!.ecart ?? 0))
  for (const { m, an, suivi } of alertes) {
    vus.add(m.nom)
    const appel = suivi && !suivi.contact ? (suivi.retard > 0 ? `appel en retard de ${suivi.retard} j` : `à appeler avant le ${dateCourte(suivi.limite)}`) : ''
    items.push({ cle: `a-${m.nom}`, titre: m.nom, avatar: m.nom, lien: lienFiche(m.nom), detail: coachDe(m) + [an!.raisons.join(' · '), appel].filter(Boolean).join(' · '),
      pastille: an!.statut === 'decroche' ? { ton: 'rouge', libelle: 'Décroche' } : { ton: 'orange', libelle: 'À surveiller' } })
  }
  // Tâches en retard ou à échéance dans les quinze jours
  const dans15j = ajouterJours(j, 15)
  for (const x of actionsEnCours(reseau, noms).filter((x) => echeanceDate(x.a) && echeanceDate(x.a) <= dans15j).sort((x, y) => echeanceDate(x.a).localeCompare(echeanceDate(y.a)))) {
    const retard = enRetard(x.a, j)
    items.push({ cle: `t-${x.cle}`, titre: x.a.action, avatar: x.a.action, icone: <TaskAltOutlined />, lien: `${lienFiche(x.magasin)}?vue=actions`,
      detail: [x.magasin, x.a.porteur, `pour le ${dateCourte(echeanceDate(x.a))}`].filter(Boolean).join(' · '), pastille: retard ? { ton: 'rouge', libelle: 'En retard' } : undefined })
  }
  const a = anneeDe(j)
  // Magasins pas vus depuis plus longtemps que le délai de leur case : les plus en dépassement d'abord
  const ecart = (l: LigneRythme) => (l.depuis === null ? Infinity : l.depuis - l.delai)
  for (const l of suiviRythme(reseau, a).filter((l) => l.alerte && noms.has(l.magasin.nom)).sort((x, y) => ecart(y) - ecart(x))) {
    items.push({ cle: `v-${l.magasin.nom}`, titre: l.magasin.nom, avatar: l.magasin.nom, lien: lienFiche(l.magasin.nom),
      detail: (avecCoach ? `${l.coach || 'Sans Coach'} · ` : '') + [l.case?.libelle ?? 'Non classé', l.derniere ? `pas vu depuis ${l.depuis} j` : 'jamais visité', l.dernierContact && `appel le ${dateCourte(l.dernierContact.date)}`].filter(Boolean).join(' · '), pastille: { ton: 'orange', libelle: 'Visite' } })
  }
  for (const { m, c } of actifs.map((m) => ({ m, c: caseDe(reseau.evaluations[m.nom]) })).filter((x) => x.c && PRIORITAIRES.includes(x.c.id) && !vus.has(x.m.nom))
    .sort((x, y) => PRIORITAIRES.indexOf(x.c!.id) - PRIORITAIRES.indexOf(y.c!.id))) {
    items.push({ cle: `s-${m.nom}`, titre: m.nom, avatar: m.nom, lien: lienFiche(m.nom), detail: coachDe(m) + `rythme conseillé ${c!.rythme}`, pastille: { ton: c!.id === 'redressement' ? 'rouge' : 'orange', libelle: c!.libelle } })
  }
  // Magasins qui ont reculé d'une case ces trois derniers mois
  const il3mois = ajouterJours(j, -92)
  for (const { m, t } of actifs.map((m) => ({ m, t: tendance(reseau.evaluations, m.nom) })).filter((x) => x.t?.precedente && x.t.depuis >= il3mois && x.t.sens === 'descend')) {
    items.push({ cle: `c-${m.nom}`, titre: m.nom, avatar: m.nom, lien: lienFiche(m.nom), detail: `${dateCourte(t!.depuis)} · ${t!.precedente!.libelle} vers ${t!.actuelle.libelle}`, pastille: { ton: 'gris', libelle: 'Recule' } })
  }
  if (p.type !== 'coach') {
    for (const x of mandatsARenouveler(reseau, perimetre)) {
      items.push({ cle: `m-${x.m.nom}-${x.a.id}`, titre: `${x.a.nom} · ${x.m.nom}`, avatar: x.m.nom, icone: <HandshakeOutlined />, lien: lienFiche(x.m.nom), detail: `Fin du mandat le ${dateCourte(x.mandat.fin)}`,
        pastille: x.etat === 'echu' ? { ton: 'rouge', libelle: libellesEtatMandat[x.etat] } : { ton: 'orange', libelle: 'Mandat' } })
    }
    const coachsVus = reseau.equipe.filter((c) => p.type === 'reseau' || (p.type === 'rr' && c.rr?.id === p.id))
    for (const x of coachsVus.filter((c) => !c.fictif).map((c) => ({ c, charge: chargeA(reseau, c.nom) })).filter((x) => ['depassement', 'complet'].includes(niveauCharge(reseau, x.charge))).sort((a, b) => b.charge - a.charge)) {
      items.push({ cle: `ch-${x.c.nom}`, titre: x.c.nom, avatar: x.c.nom, lien: lienCoach(x.c.nom), detail: `Charge ${x.charge} sur ${reseau.parametres.maxUnits}`, pastille: { ton: 'orange', libelle: 'Surchargé' } })
    }
    for (const c of coachsVus.filter((c) => c.fictif)) items.push({ cle: `pv-${c.nom}`, titre: c.nom, avatar: c.nom, icone: <PersonSearchOutlined />, lien: lienCoach(c.nom), detail: 'Poste de Coach à pourvoir', pastille: { ton: 'gris', libelle: 'Vacant' } })
    for (const m of actifs.filter((m) => !coachA(m, j))) items.push({ cle: `sc-${m.nom}`, titre: m.nom, avatar: m.nom, lien: lienFiche(m.nom), detail: 'Magasin sans Coach', pastille: { ton: 'gris', libelle: 'Sans Coach' } })
  }
  const dans6mois = ajouterJours(j, 183)
  for (const m of perimetre.filter((m) => m.ouverture > j && m.ouverture <= dans6mois).sort((a, b) => a.ouverture.localeCompare(b.ouverture))) {
    const manque = [!coachA(m, j) && 'Coach', !m.responsable && libelleResponsable(m), !m.ouvertureConnue && 'date confirmée'].filter(Boolean) as string[]
    if (!manque.length) continue
    items.push({ cle: `o-${m.nom}`, titre: m.nom, avatar: m.nom, icone: <StorefrontOutlined />, lien: lienFiche(m.nom), detail: `Ouvre le ${dateCourte(m.ouverture)} · manque : ${manque.join(', ')}`, pastille: { ton: 'bleu', libelle: 'Ouverture' } })
  }
  for (const { c, b } of reseau.campagnes.liste.filter((c) => phase(c, j) === 'encours')
    .map((c) => ({ c, b: bilan(reseau.campagnes, c, magasinsConcernes(reseau, c).filter((m) => noms.has(m.nom))) })).filter((x) => x.b.total > 0 && x.b.aConstater > 0)) {
    items.push({ cle: `cp-${c.id}`, titre: c.nom, avatar: c.nom, icone: <CampaignOutlined />, lien: `/visites?vue=campagnes&campagne=${encodeURIComponent(c.id)}`,
      detail: `${b.fait} sur ${b.total} magasin${b.total > 1 ? 's' : ''} exécuté${b.fait > 1 ? 's' : ''} · ${b.aConstater} à constater`, pastille: { ton: 'gris', libelle: b.taux === null ? 'Campagne' : `${b.taux} %` } })
  }
  void sansParametres
  return items
}

// Les urgences (pastille rouge) d'abord, puis le suivi, les visites à faire en dernier (Joseph, 21/10/2026)
type GroupeATraiter = 'urgent' | 'suivi' | 'visite'
const groupeDe = (x: ATraiter): GroupeATraiter => (x.pastille?.ton === 'rouge' ? 'urgent' : x.cle.startsWith('v-') ? 'visite' : 'suivi')
const GROUPES: { v: GroupeATraiter; libelle: string }[] = [{ v: 'urgent', libelle: 'Urgent' }, { v: 'suivi', libelle: 'Suivi' }, { v: 'visite', libelle: 'À voir' }]

function BlocATraiter({ items }: { items: ATraiter[] }) {
  const [tout, setTout] = useState(false)
  const [filtre, setFiltre] = useState<GroupeATraiter | 'tout'>('tout')
  const tries = GROUPES.flatMap((g) => items.filter((x) => groupeDe(x) === g.v))
  const presents = GROUPES.map((g) => ({ ...g, n: tries.filter((x) => groupeDe(x) === g.v).length })).filter((g) => g.n)
  const filtres = filtre === 'tout' ? tries : tries.filter((x) => groupeDe(x) === filtre)
  const vus = tout ? filtres : filtres.slice(0, APERCU)
  return (
    <Box component="section" aria-label="À traiter">
      <TitreSection nombre={items.length}>À traiter</TitreSection>
      {presents.length > 1 && (
        <Puces label="Éléments à traiter affichés" valeur={filtre} onChange={(v) => { setFiltre(v); setTout(false) }}
          options={[{ v: 'tout' as const, libelle: 'Tout' }, ...presents.map((g) => ({ v: g.v, libelle: `${g.libelle} · ${g.n}` }))]} />
      )}
      {!items.length ? <CarteLignes><LigneCompacte avatar={<Initiales nom="ok" icone={<TaskAltOutlined />} couleur="#2e7d32" />} titre="Rien d’urgent" detail="Aucun magasin ne décroche ni n’attend de visite, aucune tâche en retard." /></CarteLignes> : (
        <CarteLignes>
          {vus.map((x) => <LigneCompacte key={x.cle} lien={x.lien} avatar={<Initiales nom={x.avatar} icone={x.icone} />} titre={x.titre} detail={x.detail} fin={x.pastille && <Pastille ton={x.pastille.ton}>{x.pastille.libelle}</Pastille>} />)}
          {filtres.length > APERCU && (
            <ButtonBase onClick={() => setTout((v) => !v)} sx={{ width: '100%', minHeight: 48, fontWeight: 600, fontSize: '0.875rem' }}>{tout ? 'Afficher moins' : `Voir les ${filtres.length}`}</ButtonBase>
          )}
        </CarteLignes>
      )}
    </Box>
  )
}

function BlocSemaine({ reseau, p }: { reseau: Reseau; p: Perimetre }) {
  const j = reseau.jour
  const noms = new Set(magasinsDu(reseau, p).map((m) => m.nom))
  const personnes = personnesDu(reseau, p)
  const semaine = elementsDuMois(reseau, j, ajouterJours(j, 6)).filter((e) => {
    // Visites de la semaine : seulement celles à venir ; le Directeur garde les autres rubriques
    if (e.categorie === 'visite') return e.debut >= j && p.type !== 'reseau' && noms.has(e.magasin ?? '')
    if (p.type === 'reseau') return true
    if (e.categorie === 'ouverture') return noms.has(e.cle.slice(2))
    if (e.categorie === 'conge') return !!e.conge && personnes!.has(e.conge.personne)
    if (e.categorie === 'anniversaire') return [...personnes!].some((n) => e.cle.startsWith(`a-${n}-`))
    return true
  })
  if (!semaine.length) return null
  return (
    <Box component="section" aria-label="Cette semaine" sx={{ mt: 2 }}>
      <TitreSection action={<Button component={RouterLink} to="/plus/agenda" sx={{ minHeight: 40 }}>Agenda</Button>}>Cette semaine</TitreSection>
      <CarteLignes>
        {semaine.slice(0, 4).map((e) => <LigneCompacte key={e.cle} lien={e.lien} avatar={<Initiales nom={e.titre} icone={<CalendarMonthOutlined />} />} titre={e.titre} detail={[jourLong(e.debut < j ? j : e.debut), e.detail].filter(Boolean).join(' · ')} />)}
      </CarteLignes>
    </Box>
  )
}

type FiltreFil = 'tout' | GenreFil
const filtresFil: { v: FiltreFil; libelle: string }[] = [
  { v: 'tout', libelle: 'Tout' }, { v: 'visite', libelle: 'Visites' }, { v: 'tache', libelle: 'Tâches' },
  { v: 'message', libelle: 'Messages' }, { v: 'chiffres', libelle: 'Chiffres' }, { v: 'pratique', libelle: 'Bonnes pratiques' },
  { v: 'communication', libelle: 'Communications' },
]
const PAS_FIL = 20

const iconeFil: Record<GenreFil, ReactNode> = { visite: <EventNoteOutlined />, tache: <TaskAltOutlined />, message: <ChatBubbleOutlineOutlined />, chiffres: <QueryStatsOutlined />, pratique: <TipsAndUpdatesOutlined />, communication: <CampaignOutlined /> }

// Une publication du fil : qui, quoi, où, quand ; le texte et les photos en dessous
export function PublicationFil({ e, jour, sansMagasin = false }: { e: ElementFil; jour: string; sansMagasin?: boolean }) {
  const qui = e.genre === 'chiffres' ? '' : e.auteur
  const action = qui ? e.action : e.action.charAt(0).toUpperCase() + e.action.slice(1)
  const ou = e.genre === 'communication' ? e.cible : sansMagasin ? '' : e.magasin
  const tete = <>{qui && <><b>{qui}</b> · </>}{action}{ou ? <> · <b>{ou}</b></> : ''}</>
  return (
    <Box>
      <ButtonBase component={RouterLink} to={e.lien} sx={{ display: 'block', textAlign: 'left', width: '100%', p: 2, color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Initiales nom={qui || e.magasin} icone={qui && e.genre !== 'communication' ? undefined : iconeFil[e.genre]} />
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
        {e.texte && !e.valeur && <Typography sx={{ mt: e.titre ? 0.25 : 1.25, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-line' }}>{e.texte}</Typography>}
      </ButtonBase>
      {/* Les photos hors du lien : le toucher les ouvre en plein écran */}
      {!!e.photos?.length && <Box sx={{ px: 2, pb: 2, mt: -0.75 }}><GrillePhotos photos={e.photos} /></Box>}
    </Box>
  )
}

export function FilActivite({ elements, jour, sansMagasin = false, titre = 'Fil de mes magasins', communications, reactionsPratiques }: {
  elements: ElementFil[]; jour: string; sansMagasin?: boolean; titre?: string; communications?: CommunicationsDuFil; reactionsPratiques?: ReactionsPratiques | null
}) {
  const { apercu, equipe } = useApercu()
  const [message, setMessage] = useState('')
  const [filtre, setFiltre] = useState<FiltreFil>('tout')
  const [nb, setNb] = useState(PAS_FIL)
  const vus = elements.filter((e) => filtre === 'tout' || e.genre === filtre)
  // Visite, photos, tâches et messages d'un même magasin le même jour : une seule carte (Joseph, 21/10/2026)
  const groupes = useMemo(() => {
    const parCle = new Map<string, ElementFil[]>()
    for (const e of vus) {
      const cle = e.communication || e.pratique || !e.magasin ? e.cle : `${e.magasin}|${e.instant.slice(0, 10)}`
      const g = parCle.get(cle)
      if (g) g.push(e); else parCle.set(cle, [e])
    }
    // Les communications à la une restent en tête
    const tous = [...parCle.values()]
    return [...tous.filter((g) => g[0].communication?.aLaUne), ...tous.filter((g) => !g[0].communication?.aLaUne)]
  }, [vus])
  const options = filtresFil.filter((f) => f.v === 'tout' || elements.some((e) => e.genre === f.v))
  return (
    <Box component="section" aria-label={titre}>
      <TitreSection>{titre}</TitreSection>
      {options.length > 2 && <BandeCollante><Puces valeur={filtre} options={options} onChange={(v) => { setFiltre(v); setNb(PAS_FIL) }} label="Filtrer le fil" /></BandeCollante>}
      {!vus.length ? (
        <CarteLignes><LigneCompacte avatar={<Initiales nom="fil" icone={<HistoryOutlined />} />} titre="Rien de nouveau" detail="Les visites, tâches, messages, chiffres et communications des dernières semaines s’afficheront ici." /></CarteLignes>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {groupes.slice(0, nb).map(([e, ...suite]) => (
            <Card key={e.cle} component={e.communication || e.pratique ? 'article' : 'div'} aria-label={e.communication?.titre ?? e.pratique?.titre} sx={{ border: 0, overflow: 'hidden', ...(suite.length ? { '& > * + *': { borderTop: '1px solid', borderColor: 'divider' } } : {}) }}>
              {e.communication?.aLaUne && <Box sx={{ pt: 1.5 }}><MarqueUne jusquAu={e.communication.aLaUne} /></Box>}
              <PublicationFil e={e} jour={jour} sansMagasin={sansMagasin} />
              {suite.map((x) => <PublicationFil key={x.cle} e={x} jour={jour} sansMagasin={sansMagasin} />)}
              {e.communication && communications?.moi && (
                <ReactionsCommunication c={e.communication} moi={communications.moi} jour={jour} lectureSeule={!!apercu || !!equipe}
                  apres={communications.recharger} signaler={setMessage} />
              )}
              {e.pratique && reactionsPratiques && <ReactionsPratique p={e.pratique} reactions={reactionsPratiques} lectureSeule={!!apercu || !!equipe} signaler={setMessage} />}
            </Card>
          ))}
          {groupes.length > nb && <Button onClick={() => setNb(nb + PAS_FIL)} sx={{ alignSelf: 'center', minHeight: 48 }}>Voir plus</Button>}
        </Box>
      )}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </Box>
  )
}

function Tableau({ reseau, p, sansParametres = false }: { reseau: Reseau; p: Perimetre; sansParametres?: boolean }) {
  const { messagerie } = useMessagerie()
  const items = aTraiter(reseau, p, sansParametres)
  const noms = useMemo(() => new Set(magasinsDu(reseau, p).map((m) => m.nom)), [reseau, p])
  const communications = useCommunicationsDuFil()
  const reactionsPratiques = useReactionsPratiques()
  const fil = useMemo(() => filDu(reseau, noms, messagerie, 45, communications.liste, true), [reseau, noms, messagerie, communications.liste])
  return (
    <Box sx={{ display: 'grid', gap: { xs: 2, md: 4 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 380px' }, alignItems: 'start' }}>
      {/* PC : la colonne reste visible pendant qu'on fait défiler le fil, et défile seule si elle dépasse l'écran */}
      <Box component="aside" aria-label="À traiter et cette semaine" sx={{ order: { xs: 1, md: 2 }, position: { md: 'sticky' }, top: { md: 88 }, maxHeight: { md: 'calc(100vh - 104px)' }, overflowY: { md: 'auto' }, overscrollBehavior: 'contain', scrollbarWidth: 'thin', mx: { md: -1 }, px: { md: 1 }, pb: { md: 1 } }}>
        <BlocATraiter items={items} />
        <BlocSemaine reseau={reseau} p={p} />
      </Box>
      <Box sx={{ order: { xs: 2, md: 1 }, minWidth: 0 }}>
        <FilActivite elements={fil} jour={reseau.jour} communications={communications} reactionsPratiques={reactionsPratiques} />
      </Box>
    </Box>
  )
}

export function Accueil() {
  const { profil } = useAuth()
  // Le Directeur voit tout le réseau ; un Coach ou un RR, ses magasins
  const p = perimetreDuProfil(profil) ?? { type: 'reseau' as const }
  return (
    <>
      <PageHeader titre="Accueil" />
      <AvecReseau>{(r) => <Tableau reseau={r} p={p} sansParametres={p.type !== 'reseau'} />}</AvecReseau>
    </>
  )
}
