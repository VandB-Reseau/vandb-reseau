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
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { CarteLignes, GrillePhotos, Initiales, LigneCompacte, Pastille, Puces, TitreSection, type Ton } from '../components/Social'
import { analyser, decalerMois, formatPourcent, libelleMoisCourt, suiviAlerte } from '../data/chiffres'
import { useAuth } from '../auth/AuthContext'
import { useMessagerie } from '../data/MessagerieContext'
import { caseDe, nineBox, tendance } from '../data/sante'
import { anneeDe, suiviRythme, type LigneRythme } from '../data/visites'
import { chargeA, coachA, niveauCharge } from '../data/charge'
import { dateCourte, lienCoach, lienFiche } from '../lib/format'
import { ajouterJours, elementsDuMois, jourLong } from './Agenda'
import { libelleResponsable, nomsVisiteurs, type Magasin, type Reseau, type Visite } from '../data/modele'
import { estVisite } from '../data/chiffres'
import { DialogVisite } from '../components/DialogVisite'
import { DialogPlanifier } from '../components/DialogPlanifier'
import { marquerVisiteFaite } from '../data/chargement'
import { useReseau } from '../data/ReseauContext'
import { messageErreur } from '../components/EditionEquipe'
import { magasinsDu, perimetreDuProfil, personnesDu, type Perimetre } from '../data/perimetre'
import { PageHeader } from '../components/PageHeader'
import { actionsDes, actionsEnCours, echeanceDate, enRetard, monNomPorteur, portePar } from '../data/actions'
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
import { basculerPouceVisite, commenterVisite, messageReactionVisite, supprimerCommentaireVisite, useReactionsVisites, type ReactionsVisites } from '../data/reactionsVisites'
import { Reactions } from '../components/Reactions'
import { BandeCollante } from '../components/Collant'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

// Ordre de priorité fixé par Joseph le 14/10/2026
const PRIORITAIRES = ['redressement', 'relance', 'renforcer']
const APERCU = 5
// Téléphone : le bloc reste court pour laisser la place aux actualités (Joseph, 22/10/2026)
const APERCU_COMPACT = 2

// Une ligne « À traiter » : un avatar, deux lignes de texte, une seule pastille (la plus grave)
interface ATraiter { cle: string; titre: string; detail: string; lien: string; avatar: string; icone?: ReactNode; pastille?: { ton: Ton; libelle: string }; visite?: Visite }

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
  // Visites planifiées dont la date est passée sans compte rendu : faites ou à reporter
  for (const v of reseau.visites.filter((v) => v.prevue && v.date < j && v.id !== null && noms.has(v.magasin) && estVisite(v)).sort((x, y) => x.date.localeCompare(y.date))) {
    items.push({ cle: `vp-${v.id}`, titre: v.magasin, avatar: v.magasin, icone: <EventAvailableOutlined />, lien: '', visite: v,
      detail: [`Prévue le ${dateCourte(v.date)}`, nomsVisiteurs(v)].filter(Boolean).join(' · '), pastille: { ton: 'bleu', libelle: 'À confirmer' } })
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
    items.push({ cle: `cp-${c.id}`, titre: c.nom, avatar: c.nom, icone: <CampaignOutlined />, lien: `/plus/sante?vue=campagnes&campagne=${encodeURIComponent(c.id)}`,
      detail: `${b.fait} sur ${b.total} magasin${b.total > 1 ? 's' : ''} exécuté${b.fait > 1 ? 's' : ''} · ${b.aConstater} à constater`, pastille: { ton: 'gris', libelle: b.taux === null ? 'Campagne' : `${b.taux} %` } })
  }
  void sansParametres
  return items
}

// Les urgences (pastille rouge) d'abord, puis le suivi, les visites à faire en dernier (Joseph, 21/10/2026)
type GroupeATraiter = 'urgent' | 'suivi' | 'visite'
const groupeDe = (x: ATraiter): GroupeATraiter => (x.pastille?.ton === 'rouge' ? 'urgent' : x.cle.startsWith('v-') ? 'visite' : 'suivi')
const GROUPES: { v: GroupeATraiter; libelle: string }[] = [{ v: 'urgent', libelle: 'Urgent' }, { v: 'suivi', libelle: 'Suivi' }, { v: 'visite', libelle: 'À voir' }]

function BlocATraiter({ reseau, items, compact = false }: { reseau: Reseau; items: ATraiter[]; compact?: boolean }) {
  const { recharger } = useReseau()
  const [compteRendu, setCompteRendu] = useState<Visite | null>(null)
  const [reporter, setReporter] = useState<Visite | null>(null)
  const [message, setMessage] = useState('')
  const faite = async (v: Visite) => {
    try { await marquerVisiteFaite(v.id!); await recharger(); setMessage(`Visite de ${v.magasin} comptée faite.`) } catch (e) { setMessage(messageErreur(e)) }
  }
  const [tout, setTout] = useState(false)
  const [filtre, setFiltre] = useState<GroupeATraiter | 'tout'>('tout')
  const tries = GROUPES.flatMap((g) => items.filter((x) => groupeDe(x) === g.v))
  const presents = GROUPES.map((g) => ({ ...g, n: tries.filter((x) => groupeDe(x) === g.v).length })).filter((g) => g.n)
  const filtres = filtre === 'tout' ? tries : tries.filter((x) => groupeDe(x) === filtre)
  const apercu = compact ? APERCU_COMPACT : APERCU
  const vus = tout ? filtres : filtres.slice(0, apercu)
  return (
    <Box component="section" aria-label="À traiter">
      {!compact && <TitreSection nombre={items.length}>À traiter</TitreSection>}
      {/* Téléphone : les puces n'apparaissent qu'une fois la liste dépliée */}
      {(!compact || tout) && presents.length > 1 && (
        <Puces label="Éléments à traiter affichés" valeur={filtre} onChange={(v) => { setFiltre(v); setTout(compact) }}
          options={[{ v: 'tout' as const, libelle: 'Tout' }, ...presents.map((g) => ({ v: g.v, libelle: `${g.libelle} · ${g.n}` }))]} />
      )}
      {!items.length ? <CarteLignes><LigneCompacte avatar={<Initiales nom="ok" icone={<TaskAltOutlined />} couleur="#2e7d32" />} titre="Rien d’urgent" detail="Aucun magasin ne décroche ni n’attend de visite, aucune tâche en retard." /></CarteLignes> : (
        <CarteLignes>
          {vus.map((x) => x.visite
            ? <LigneCompacte key={x.cle} onClick={() => setCompteRendu(x.visite!)} label={`Compte rendu de ${x.titre}`} avatar={<Initiales nom={x.avatar} icone={x.icone} />} titre={x.titre} detail={x.detail}
              actions={<Box sx={{ display: 'flex', gap: 0.5, flex: 'none' }}>
                <Button onClick={() => faite(x.visite!)} aria-label={`Visite de ${x.titre} faite`} sx={{ minHeight: 48, minWidth: 0, px: 1.25 }}>Faite</Button>
                <Button onClick={() => setReporter(x.visite!)} aria-label={`Reporter la visite de ${x.titre}`} sx={{ minHeight: 48, minWidth: 0, px: 1.25 }}>Reporter</Button>
              </Box>} />
            : <LigneCompacte key={x.cle} lien={x.lien} avatar={<Initiales nom={x.avatar} icone={x.icone} />} titre={x.titre} detail={x.detail} fin={x.pastille && <Pastille ton={x.pastille.ton}>{x.pastille.libelle}</Pastille>} />)}
          {filtres.length > apercu && (
            <ButtonBase onClick={() => setTout((v) => !v)} sx={{ width: '100%', minHeight: 48, fontWeight: 600, fontSize: '0.875rem' }}>{tout ? 'Afficher moins' : `Voir les ${filtres.length}`}</ButtonBase>
          )}
        </CarteLignes>
      )}
      {compteRendu && <DialogVisite reseau={reseau} visite={compteRendu} onFermer={(m) => { setCompteRendu(null); if (m) setMessage(m) }} />}
      {reporter && <DialogPlanifier reseau={reseau} magasins={[reporter.magasin]} dateInitiale={reseau.jour} visite={reporter} onFermer={(m) => { setReporter(null); if (m) setMessage(m) }} />}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </Box>
  )
}

function BlocSemaine({ reseau, p, compact = false }: { reseau: Reseau; p: Perimetre; compact?: boolean }) {
  const j = reseau.jour
  const noms = new Set(magasinsDu(reseau, p).map((m) => m.nom))
  const personnes = personnesDu(reseau, p)
  const semaine = elementsDuMois(reseau, j, ajouterJours(j, 6)).filter((e) => {
    // Visites de la semaine : seulement celles à venir ; le Directeur garde les autres rubriques
    if (e.categorie === 'visite') return e.debut >= j && p.type !== 'reseau' && noms.has(e.magasin ?? '')
    if (p.type === 'reseau') return true
    if (e.categorie === 'ouverture') return noms.has(e.cle.slice(2))
    if (e.categorie === 'anniversaire') return [...personnes!].some((n) => e.cle.startsWith(`a-${n}-`))
    return true
  })
  if (!semaine.length && !compact) return null
  const lignes = semaine.slice(0, compact ? APERCU_COMPACT : 4).map((e) => <LigneCompacte key={e.cle} lien={e.lien} avatar={<Initiales nom={e.titre} icone={<CalendarMonthOutlined />} />} titre={e.titre} detail={[jourLong(e.debut < j ? j : e.debut), e.detail].filter(Boolean).join(' · ')} />)
  if (compact) {
    return (
      <Box component="section" aria-label="Cette semaine">
        <CarteLignes>
          {semaine.length ? lignes : <LigneCompacte avatar={<Initiales nom="semaine" icone={<CalendarMonthOutlined />} />} titre="Rien de prévu cette semaine" />}
          <ButtonBase component={RouterLink} to="/plus/agenda" sx={{ width: '100%', minHeight: 48, fontWeight: 600, fontSize: '0.875rem' }}>Ouvrir l’agenda</ButtonBase>
        </CarteLignes>
      </Box>
    )
  }
  return (
    <Box component="section" aria-label="Cette semaine" sx={{ mt: 2 }}>
      <TitreSection action={<Button component={RouterLink} to="/plus/agenda" sx={{ minHeight: 40 }}>Agenda</Button>}>Cette semaine</TitreSection>
      <CarteLignes>{lignes}</CarteLignes>
    </Box>
  )
}

// Mes tâches : celles dont je suis le porteur, les plus pressées d'abord
function mesTaches(reseau: Reseau, p: Perimetre, moi: string) {
  if (!moi) return []
  const noms = p.type === 'reseau' ? null : new Set(magasinsDu(reseau, p).map((m) => m.nom))
  return actionsDes(reseau, noms).filter((x) => !x.a.faite && portePar(x.a, moi))
    .sort((x, y) => (echeanceDate(x.a) || '9999').localeCompare(echeanceDate(y.a) || '9999'))
}

function BlocMesTaches({ reseau, taches, compact = false }: { reseau: Reseau; taches: ReturnType<typeof mesTaches>; compact?: boolean }) {
  const lignes = taches.slice(0, compact ? APERCU_COMPACT : 4).map((x) => (
    <LigneCompacte key={x.cle} lien={`${lienFiche(x.magasin)}?vue=actions`} avatar={<Initiales nom={x.a.action} icone={<TaskAltOutlined />} />} titre={x.a.action}
      detail={[x.magasin, echeanceDate(x.a) && `pour le ${dateCourte(echeanceDate(x.a))}`].filter(Boolean).join(' · ')}
      fin={enRetard(x.a, reseau.jour) ? <Pastille ton="rouge">En retard</Pastille> : undefined} />
  ))
  const vide = <LigneCompacte avatar={<Initiales nom="ok" icone={<TaskAltOutlined />} couleur="#2e7d32" />} titre="Aucune tâche en cours" />
  const toutes = `/echanges?vue=taches`
  return (
    <Box component="section" aria-label="Mes tâches" sx={{ mt: compact ? 0 : 2 }}>
      {!compact && <TitreSection nombre={taches.length} action={<Button component={RouterLink} to={toutes} sx={{ minHeight: 40 }}>Toutes</Button>}>Mes tâches</TitreSection>}
      <CarteLignes>
        {taches.length ? lignes : vide}
        {compact && taches.length > APERCU_COMPACT && <ButtonBase component={RouterLink} to={toutes} sx={{ width: '100%', minHeight: 48, fontWeight: 600, fontSize: '0.875rem' }}>{`Voir les ${taches.length}`}</ButtonBase>}
      </CarteLignes>
    </Box>
  )
}

// Quatre repères de pilotage, calculés sur le périmètre de la personne (Joseph, 22/10/2026)
function Indicateurs({ reseau, p }: { reseau: Reseau; p: Perimetre }) {
  const theme = useTheme()
  const j = reseau.jour
  const actifs = magasinsDu(reseau, p).filter((m) => m.statut !== 'avenir')
  const noms = new Set(actifs.map((m) => m.nom))
  const analyses = actifs.map((m) => analyser(reseau, m.nom)).filter((a) => !!a)
  // CA : le dernier mois connu, comparé sur les magasins qui ont les deux mois
  const mois = analyses.reduce((max, a) => (a.mois > max ? a.mois : max), '')
  const comparables = analyses.filter((a) => a.mois === mois && a.ca !== null && a.caReference)
  const ca = comparables.reduce((t, a) => t + a.ca!, 0)
  const caRef = comparables.reduce((t, a) => t + a.caReference!, 0)
  const ecart = caRef ? ((ca - caRef) / caRef) * 100 : null
  const reference = comparables[0]?.reference
  const decrochent = analyses.filter((a) => a.statut === 'decroche').length
  const surveiller = analyses.filter((a) => a.statut === 'surveiller').length
  const rythme = suiviRythme(reseau, anneeDe(j)).filter((l) => noms.has(l.magasin.nom))
  const refVisites = rythme.reduce((t, l) => t + l.reference, 0)
  const faites = rythme.reduce((t, l) => t + l.faites, 0)
  const tauxVisites = refVisites ? Math.round((faites / refVisites) * 100) : null
  const cases = actifs.map((m) => caseDe(reseau.evaluations[m.nom])).filter((c) => !!c)
  const prioritaires = cases.filter((c) => PRIORITAIRES.includes(c.id)).length
  const repartition = nineBox.map((c) => ({ c, n: cases.filter((x) => x.id === c.id).length })).filter((x) => x.n)
  const tuiles: { cle: string; libelle: string; valeur: string; detail: string; lien: string; couleur?: string; barre?: ReactNode }[] = [
    { cle: 'ca', libelle: mois ? `CA de ${libelleMoisCourt(mois)}` : 'CA du mois', valeur: ecart === null ? '—' : formatPourcent(ecart),
      detail: ecart === null ? 'Pas encore de chiffres' : reference === decalerMois(mois, -12) ? 'vs N-1' : `vs ${libelleMoisCourt(reference!)}`, lien: '/plus/sante?vue=chiffres',
      couleur: ecart === null ? undefined : ecart < 0 ? theme.palette.error.main : theme.palette.success.dark },
    { cle: 'decroche', libelle: 'Décrochent', valeur: String(decrochent), detail: surveiller ? `${surveiller} à surveiller` : 'aucun à surveiller', lien: '/plus/sante?vue=chiffres', couleur: decrochent ? theme.palette.error.main : undefined },
    { cle: 'visites', libelle: 'Visites de l’année', valeur: tauxVisites === null ? '—' : `${tauxVisites} %`, detail: `${faites} sur ${Math.round(refVisites)} de référence`, lien: '/visites?vue=rythme',
      barre: tauxVisites === null ? undefined : <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', mt: 0.75 }}><Box sx={{ width: `${Math.min(100, tauxVisites)}%`, height: 6, borderRadius: 3, bgcolor: 'warning.main' }} /></Box> },
    { cle: 'sante', libelle: 'Santé du parc', valeur: String(prioritaires), detail: `prioritaires sur ${cases.length} classés`, lien: '/plus/sante', couleur: prioritaires ? theme.palette.warning.dark : undefined,
      barre: repartition.length ? <Box sx={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', mt: 0.75 }}>{repartition.map((x) => <Box key={x.c.id} sx={{ flex: x.n, bgcolor: x.c.couleur }} />)}</Box> : undefined },
  ]
  return (
    // Téléphone : quatre petites cartes égales en 2 × 2, sans défilement de côté (Joseph, 22/10/2026)
    <Box component="section" aria-label="Pilotage" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: { xs: 1, md: 2 }, mb: { xs: 2, md: 3 } }}>
      {tuiles.map((t) => (
        <ButtonBase key={t.cle} component={RouterLink} to={t.lien} aria-label={`${t.libelle} : ${t.valeur}, ${t.detail}`}
          sx={{ display: 'block', minWidth: 0, textAlign: 'left', px: { xs: 1.5, md: 2 }, py: { xs: 1, md: 2 }, borderRadius: '14px', bgcolor: 'background.paper', color: 'text.primary', fontFamily: 'inherit',
            // Pas de survol sur un écran tactile : la carte touchée ne reste pas grisée
            '@media (hover: hover)': { '&:hover': { bgcolor: 'action.hover' } } }}>
          <Typography color="text.secondary" noWrap sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}>{t.libelle}</Typography>
          <Typography sx={{ fontSize: { xs: '1.25rem', md: '1.75rem' }, fontWeight: 700, lineHeight: 1.3, color: t.couleur }}>{t.valeur}</Typography>
          <Typography color="text.secondary" noWrap sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>{t.detail}</Typography>
          {t.barre && <Box aria-hidden>{t.barre}</Box>}
        </ButtonBase>
      ))}
    </Box>
  )
}

// Téléphone : À traiter, tâches et semaine dans une seule carte à onglets, courte (Joseph, 22/10/2026)
type Onglet = 'traiter' | 'taches' | 'semaine'
function PointCompact({ reseau, p, items, taches }: { reseau: Reseau; p: Perimetre; items: ATraiter[]; taches: ReturnType<typeof mesTaches> }) {
  const [onglet, setOnglet] = useState<Onglet>('traiter')
  const options: { v: Onglet; libelle: string }[] = [
    { v: 'traiter', libelle: items.length ? `À traiter · ${items.length}` : 'À traiter' },
    { v: 'taches', libelle: taches.length ? `Tâches · ${taches.length}` : 'Tâches' },
    { v: 'semaine', libelle: 'Semaine' },
  ]
  return (
    <Box sx={{ mb: 2, '& .MuiCard-root .MuiButtonBase-root': { minHeight: 56, py: 0.5 } }}>
      <Box role="tablist" aria-label="Mon point" sx={{ display: 'flex', p: 0.25, borderRadius: 999, bgcolor: 'action.hover', mb: 1 }}>
        {options.map((o) => (
          <ButtonBase key={o.v} role="tab" aria-selected={onglet === o.v} onClick={() => setOnglet(o.v)}
            sx={{ fontFamily: 'inherit', flex: 1, minHeight: 48, borderRadius: 999, fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', color: onglet === o.v ? 'text.primary' : 'text.secondary', ...(onglet === o.v ? { bgcolor: 'background.paper', boxShadow: 1 } : {}) }}>
            {o.libelle}
          </ButtonBase>
        ))}
      </Box>
      <Box role="tabpanel" aria-label={options.find((o) => o.v === onglet)!.libelle}>
        {onglet === 'traiter' && <BlocATraiter reseau={reseau} items={items} compact />}
        {onglet === 'taches' && <BlocMesTaches reseau={reseau} taches={taches} compact />}
        {onglet === 'semaine' && <BlocSemaine reseau={reseau} p={p} compact />}
      </Box>
    </Box>
  )
}

type FiltreFil = 'tout' | GenreFil
const filtresFil: { v: FiltreFil; libelle: string }[] = [
  { v: 'tout', libelle: 'Tout' }, { v: 'visite', libelle: 'Visites' }, { v: 'tache', libelle: 'Tâches' },
  { v: 'message', libelle: 'Messages' }, { v: 'chiffres', libelle: 'Chiffres' }, { v: 'pratique', libelle: 'Bonnes pratiques' },
  { v: 'communication', libelle: 'Communications' }, { v: 'journal', libelle: 'Journal' },
]
const PAS_FIL = 20
const AUCUNE: never[] = []

const iconeFil: Record<GenreFil, ReactNode> = { visite: <EventNoteOutlined />, tache: <TaskAltOutlined />, message: <ChatBubbleOutlineOutlined />, chiffres: <QueryStatsOutlined />, pratique: <TipsAndUpdatesOutlined />, communication: <CampaignOutlined />, journal: <HistoryOutlined /> }

// Une publication du fil : qui, quoi, où, quand ; le texte et les photos en dessous
export function PublicationFil({ e, jour, sansMagasin = false, ouvrir }: { e: ElementFil; jour: string; sansMagasin?: boolean; ouvrir?: (e: ElementFil) => void }) {
  const qui = e.genre === 'chiffres' ? '' : e.auteur
  const action = qui ? e.action : e.action.charAt(0).toUpperCase() + e.action.slice(1)
  const ou = e.genre === 'communication' ? e.cible : sansMagasin ? '' : e.magasin
  const tete = <>{qui && <><b>{qui}</b> · </>}{action}{ou ? <> · <b>{ou}</b></> : ''}</>
  return (
    <Box>
      <ButtonBase {...(ouvrir ? { onClick: () => ouvrir(e), 'aria-label': e.libelleOuvrir } : { component: RouterLink, to: e.lien })} sx={{ display: 'block', textAlign: 'left', width: '100%', p: 2, color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }}>
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

export function FilActivite({ elements, jour, sansMagasin = false, titre = 'Actualités', communications, reactionsPratiques, reactionsVisites, action, ouvrirJournal }: {
  elements: ElementFil[]; jour: string; sansMagasin?: boolean; titre?: string; communications?: CommunicationsDuFil; reactionsPratiques?: ReactionsPratiques | null
  reactionsVisites?: ReactionsVisites | null
  action?: ReactNode; ouvrirJournal?: (e: ElementFil) => void
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
      // Un compte rendu qu'on aime et commente garde sa propre carte
      const cle = e.communication || e.pratique || e.journal || !e.magasin || (reactionsVisites && e.visiteId) ? e.cle : `${e.magasin}|${e.instant.slice(0, 10)}`
      const g = parCle.get(cle)
      if (g) g.push(e); else parCle.set(cle, [e])
    }
    // Les communications à la une restent en tête
    const tous = [...parCle.values()]
    return [...tous.filter((g) => g[0].communication?.aLaUne), ...tous.filter((g) => !g[0].communication?.aLaUne)]
  }, [vus, reactionsVisites])
  const options = filtresFil.filter((f) => f.v === 'tout' || elements.some((e) => e.genre === f.v))
  return (
    <Box component="section" aria-label={titre}>
      <TitreSection action={action}>{titre}</TitreSection>
      {options.length > 2 && <BandeCollante><Puces valeur={filtre} options={options} onChange={(v) => { setFiltre(v); setNb(PAS_FIL) }} label="Filtrer le fil" /></BandeCollante>}
      {!vus.length ? (
        <CarteLignes><LigneCompacte avatar={<Initiales nom="fil" icone={<HistoryOutlined />} />} titre="Rien de nouveau" detail="Les comptes rendus et les communications des dernières semaines s’afficheront ici." /></CarteLignes>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {groupes.slice(0, nb).map(([e, ...suite]) => (
            <Card key={e.cle} component={e.communication || e.pratique || (reactionsVisites && e.visiteId) ? 'article' : 'div'}
              aria-label={e.communication?.titre ?? e.pratique?.titre ?? (reactionsVisites && e.visiteId ? `Compte rendu de ${e.magasin}` : undefined)} sx={{ border: 0, overflow: 'hidden', ...(suite.length ? { '& > * + *': { borderTop: '1px solid', borderColor: 'divider' } } : {}) }}>
              {e.communication?.aLaUne && <Box sx={{ pt: 1.5 }}><MarqueUne jusquAu={e.communication.aLaUne} /></Box>}
              <PublicationFil e={e} jour={jour} sansMagasin={sansMagasin} ouvrir={e.libelleOuvrir && ouvrirJournal ? ouvrirJournal : undefined} />
              {suite.map((x) => <PublicationFil key={x.cle} e={x} jour={jour} sansMagasin={sansMagasin} ouvrir={x.libelleOuvrir && ouvrirJournal ? ouvrirJournal : undefined} />)}
              {e.communication && communications?.moi && (
                <ReactionsCommunication c={e.communication} moi={communications.moi} jour={jour} lectureSeule={!!apercu || !!equipe}
                  apres={communications.recharger} signaler={setMessage} />
              )}
              {e.pratique && reactionsPratiques && <ReactionsPratique p={e.pratique} reactions={reactionsPratiques} lectureSeule={!!apercu || !!equipe} signaler={setMessage} />}
              {e.visiteId && reactionsVisites && (
                <Reactions titre={`le compte rendu de ${e.magasin}`} pouces={reactionsVisites.pouces[e.visiteId] ?? AUCUNE} commentaires={reactionsVisites.commentaires[e.visiteId] ?? AUCUNE}
                  moi={reactionsVisites.moi} jour={jour} lectureSeule={!!apercu || !!equipe} basculer={() => basculerPouceVisite(e.visiteId!)} commenter={(t) => commenterVisite(e.visiteId!, t)}
                  supprimer={supprimerCommentaireVisite} message={messageReactionVisite} apres={reactionsVisites.recharger} signaler={setMessage} />
              )}
            </Card>
          ))}
          {groupes.length > nb && <Button onClick={() => setNb(nb + PAS_FIL)} sx={{ alignSelf: 'center', minHeight: 48 }}>Voir plus</Button>}
        </Box>
      )}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </Box>
  )
}

// Accueil (maquette A, Joseph 22/10/2026) : quatre repères en tête, les actualités en colonne principale,
// À traiter, Mes tâches et Cette semaine à droite ; sur téléphone, ces trois blocs en onglets au-dessus des actualités
function Tableau({ reseau, p, sansParametres = false }: { reseau: Reseau; p: Perimetre; sansParametres?: boolean }) {
  const { profil } = useAuth()
  const { messagerie } = useMessagerie()
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const items = aTraiter(reseau, p, sansParametres)
  const taches = mesTaches(reseau, p, monNomPorteur(reseau, profil))
  const noms = useMemo(() => new Set(magasinsDu(reseau, p).map((m) => m.nom)), [reseau, p])
  const communications = useCommunicationsDuFil()
  const reactionsPratiques = useReactionsPratiques()
  const reactionsVisites = useReactionsVisites()
  const fil = useMemo(() => filDu(reseau, noms, messagerie, 45, communications.liste, true, true), [reseau, noms, messagerie, communications.liste])
  const actualites = <FilActivite elements={fil} jour={reseau.jour} titre="Actualités" communications={communications} reactionsPratiques={reactionsPratiques} reactionsVisites={reactionsVisites} />
  if (!surPC) {
    return (
      <>
        <Indicateurs reseau={reseau} p={p} />
        <PointCompact reseau={reseau} p={p} items={items} taches={taches} />
        {actualites}
      </>
    )
  }
  return (
    <>
      <Indicateurs reseau={reseau} p={p} />
      <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: 'minmax(0, 1fr) 400px', alignItems: 'start' }}>
        <Box sx={{ minWidth: 0 }}>{actualites}</Box>
        {/* La colonne reste visible pendant qu'on fait défiler les actualités, et défile seule si elle dépasse l'écran */}
        <Box component="aside" aria-label="À traiter, mes tâches et cette semaine" sx={{ position: 'sticky', top: 88, maxHeight: 'calc(100vh - 104px)', overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin', mx: -1, px: 1, pb: 1 }}>
          <BlocATraiter reseau={reseau} items={items} />
          <BlocMesTaches reseau={reseau} taches={taches} />
          <BlocSemaine reseau={reseau} p={p} />
        </Box>
      </Box>
    </>
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
