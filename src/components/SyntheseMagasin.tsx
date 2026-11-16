// Vue d'ensemble d'un magasin (refonte vague 3, Joseph 09/11/2026, 22A) : au centre, où en est le magasin.
// Quatre indicateurs de la caisse (dernier mois connu, comparé à la référence des alertes), les prochaines étapes
// (visite, tâches, budget, clôture du mois) et le dernier compte rendu. Les informations du magasin sont à gauche.
// Choix 196 (Joseph, 15/11/2026) : sous les indicateurs, une seule bande « À faire maintenant » (visite, tâches en retard,
// prochaine échéance) ; les raccourcis Budget et Clôture du mois redoublaient les onglets, ils sont retirés.
import { Suspense, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import EventOutlined from '@mui/icons-material/EventOutlined'
import RequestQuoteOutlined from '@mui/icons-material/RequestQuoteOutlined'
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined'
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import { chargementDiffere } from '../lib/chargementDiffere'
import { MiniCourbe } from './Social'
import { brand } from '../theme/theme'
import { filDu, type ElementFil } from '../data/fil'
import { journalDansLeFil } from './Journal'
import { associesDu, enPlace, mandatEffectif } from '../data/associes'
import { caseDe, tendance } from '../data/sante'
import { iconeEtape } from './BoutonVisite'
import { prochaineEtape } from '../data/ordreDuJour'
import Typography from '@mui/material/Typography'
import { Section } from './Section'
import { Indicateur as CarteIndicateur } from './Indicateur'
import { useTheme } from '@mui/material/styles'
import { echelle } from '../theme/theme'
import { ParcoursIntegration } from './ParcoursIntegration'
import { analyser, caDe, chiffresDuMagasin, courbeCA, decalerMois, formatEuros, formatKEuros, formatPourcent, libelleMois, libelleMoisCourt } from '../data/chiffres'
import type { Magasin, Reseau } from '../data/modele'
import { actionsDuMagasin, echeanceDate, enRetard } from '../data/actions'
import { anneeDe, libellePasVu, suiviRythme } from '../data/visites'
import { dateCourte, lienFiche } from '../lib/format'

// Vague 5 (53A) : la carte d'indicateur commune ; ton : couleur de l'écart
export function Indicateur({ libelle, valeur, detail, ton, fin }: { libelle: string; valeur: string; detail?: string; ton?: 'bon' | 'mauvais'; fin?: ReactNode }) {
  const theme = useTheme()
  return <CarteIndicateur libelle={libelle} valeur={valeur} detail={detail} fin={fin} couleurDetail={ton === 'bon' ? theme.palette.success.dark : ton === 'mauvais' ? theme.palette.error.main : undefined} />
}

// Vague 7 (90A et retour de Joseph, 10/11/2026) : les prochaines étapes en tuiles cliquables, au lieu d'un tableau
function Tuile({ libelle, valeur, detail, lien, icone, alerte }: { libelle: string; valeur: string; detail?: string; lien: string; icone: ReactNode; alerte?: boolean }) {
  return (
    <ButtonBase component={RouterLink} to={lien} aria-label={`${libelle} : ${valeur}${detail ? `, ${detail}` : ''}`}
      sx={{ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr)', columnGap: 1.25, alignItems: 'start', justifyItems: 'start', textAlign: 'left', p: 1.75, minHeight: 88,
        bgcolor: 'background.paper', border: '1px solid', borderColor: alerte ? 'error.light' : 'divider', borderRadius: 2, fontFamily: 'inherit', '&:hover': { borderColor: 'text.primary' } }}>
      <Box sx={{ color: alerte ? 'error.main' : 'text.secondary', mt: 0.25, display: 'flex' }}>{icone}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">{libelle}</Typography>
        <Typography sx={{ fontWeight: 700, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{valeur}</Typography>
        {detail && <Typography variant="body2" sx={{ color: alerte ? 'error.main' : 'text.secondary' }}>{detail}</Typography>}
      </Box>
    </ButtonBase>
  )
}

// Choix 256 (Joseph, 16/11/2026) : le CA de l'année depuis janvier face aux mêmes mois de l'an passé (seulement les mois
// connus les deux années), avec la courbe des douze derniers mois
export function cumulAnnee(reseau: Reseau, nom: string, mois: string): { annee: number; ca: number | null; ecart: number | null } {
  const liste = chiffresDuMagasin(reseau, nom)
  const annee = Number(mois.slice(0, 4))
  let ca = 0, n = 0, caN = 0, caN1 = 0
  for (let k = 1; k <= Number(mois.slice(5, 7)); k++) {
    const m = `${annee}-${String(k).padStart(2, '0')}`
    const v = caDe(liste.find((c) => c.mois === m)), v1 = caDe(liste.find((c) => c.mois === decalerMois(m, -12)))
    if (v === null) continue
    ca += v; n++
    if (v1) { caN += v; caN1 += v1 }
  }
  return { annee, ca: n ? ca : null, ecart: caN1 ? ((caN - caN1) / caN1) * 100 : null }
}

// Choix 257 : ce qui demande l'attention, en une ligne chacun (caisse, santé, mandat, fiche incomplète) ; rien s'il n'y a rien
interface PointAttention { cle: string; ton: 'agir' | 'surveiller'; texte: string; lien?: string; onClick?: () => void; bouton?: string }
const RANG_FAIBLE = 3 // résultats + management : Redressement urgent, Relance commerciale, Management à renforcer

export function pointsAttention(reseau: Reseau, m: Magasin, manquants: number, completer?: () => void): PointAttention[] {
  const l: PointAttention[] = []
  const fiche = lienFiche(m.nom)
  const a = analyser(reseau, m.nom)
  if (a?.statut === 'decroche' || a?.statut === 'surveiller')
    l.push({ cle: 'caisse', ton: a.statut === 'decroche' ? 'agir' : 'surveiller', texte: `${a.statut === 'decroche' ? 'Décroche' : 'À surveiller'} : CA de ${libelleMois(a.mois)} ${formatPourcent(a.ecart)} vs ${libelleMois(a.reference)}`, lien: `${fiche}?vue=chiffres`, bouton: 'Voir les chiffres' })
  const c = caseDe(reseau.evaluations[m.nom])
  const t = tendance(reseau.evaluations, m.nom)
  if (c && c.resultats + c.management <= RANG_FAIBLE) l.push({ cle: 'sante', ton: 'agir', texte: `Nine box : ${c.libelle}`, lien: `${fiche}?vue=ninebox`, bouton: 'Voir la santé' })
  else if (t?.sens === 'descend' && t.precedente) l.push({ cle: 'sante', ton: 'surveiller', texte: `Santé en baisse : ${t.precedente.libelle} puis ${t.actuelle.libelle}`, lien: `${fiche}?vue=ninebox`, bouton: 'Voir la santé' })
  for (const x of associesDu(reseau, m).filter((x) => enPlace(x, reseau.jour))) {
    const e = mandatEffectif(reseau, m, x)
    if (e?.etat === 'echu') l.push({ cle: `mandat-${x.id}`, ton: 'agir', texte: `Mandat de ${x.nom} échu${e.mandat.fin ? ` le ${dateCourte(e.mandat.fin)}` : ''}` })
    else if (e?.etat === 'aRenouveler') l.push({ cle: `mandat-${x.id}`, ton: 'surveiller', texte: `Mandat de ${x.nom} : fin le ${dateCourte(e.mandat.fin)}` })
  }
  if (manquants > 0) l.push({ cle: 'fiche', ton: 'surveiller', texte: `${manquants} information${manquants > 1 ? 's' : ''} à compléter sur la fiche${completer ? '' : ' (par le Directeur de réseau)'}`, onClick: completer, bouton: 'Compléter' })
  return l.sort((x, y) => (x.ton === y.ton ? 0 : x.ton === 'agir' ? -1 : 1))
}

function PointsAttention({ points }: { points: PointAttention[] }) {
  if (!points.length) return null
  return (
    <Card component="section" aria-label="Points d’attention" sx={{ px: { xs: 2, md: 3 }, py: 1 }}>
      {points.map((p, i) => (
        <Box key={p.cle} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 48, borderTop: i ? '1px solid' : 0, borderColor: 'divider' }}>
          {p.ton === 'agir' ? <ErrorOutlineOutlined sx={{ color: 'error.main' }} /> : <WarningAmberOutlined sx={{ color: 'warning.dark' }} />}
          <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{p.texte}</Typography>
          {p.lien ? <Button component={RouterLink} to={p.lien} endIcon={<ChevronRightOutlined />} sx={{ minHeight: 48, flexShrink: 0, display: { xs: 'none', sm: 'inline-flex' } }}>{p.bouton}</Button>
            : p.onClick ? <Button onClick={p.onClick} sx={{ minHeight: 48, flexShrink: 0 }}>{p.bouton}</Button> : null}
          {p.lien && <Button component={RouterLink} to={p.lien} aria-label={p.bouton} sx={{ minWidth: 48, minHeight: 48, display: { xs: 'inline-flex', sm: 'none' } }}><ChevronRightOutlined /></Button>}
        </Box>
      ))}
    </Card>
  )
}

// Choix 259 : les trois derniers échanges avec le magasin (visites, appels, notes, messages, tâches faites), au lieu du
// seul dernier compte rendu ; les chiffres ont leurs tuiles
const GENRES_ECHANGES = new Set(['visite', 'message', 'journal', 'tache', 'pratique'])
const instantTri = (s: string) => (s.length === 10 ? `${s}T00:00:00` : s)

function DerniersEchanges({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const elements: ElementFil[] = [...filDu(reseau, new Set([m.nom]), null, 3650), ...journalDansLeFil(reseau, m)]
    .filter((e) => GENRES_ECHANGES.has(e.genre) && e.instant.slice(0, 10) <= reseau.jour)
    .sort((a, b) => instantTri(b.instant).localeCompare(instantTri(a.instant))).slice(0, 3)
  return (
    <Section titre="Derniers échanges" action={<Button component={RouterLink} to={`${lienFiche(m.nom)}?vue=activite`} sx={{ minHeight: 48 }}>Toute l’activité</Button>}>
      {!elements.length ? <Typography variant="body2" color="text.secondary">Aucun échange enregistré. Une visite, un appel ou une note s’ajoutent par le « + » de la fiche.</Typography> : (
        <Box sx={{ display: 'grid' }}>
          {elements.map((e, i) => (
            <ButtonBase key={e.cle} component={RouterLink} to={e.lien}
              sx={{ display: 'block', textAlign: 'left', py: 1.25, minHeight: 48, borderTop: i ? '1px solid' : 0, borderColor: 'divider', fontFamily: 'inherit', '@media (hover: hover)': { '&:hover': { bgcolor: 'action.hover' } } }}>
              <Typography variant="body2" color="text.secondary">{[dateCourte(e.instant.slice(0, 10)), e.action.charAt(0).toUpperCase() + e.action.slice(1), e.auteur].filter(Boolean).join(' · ')}</Typography>
              {(e.titre || e.texte) && <Typography sx={{ fontWeight: e.titre ? 700 : 400, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{e.titre ?? e.texte}</Typography>}
              {e.titre && e.texte && <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{e.texte}</Typography>}
            </ButtonBase>
          ))}
        </Box>
      )}
    </Section>
  )
}

// Choix 258 : où en est le budget de l'année, chargé avec le pilotage (à la demande)
const EtatBudgetMagasin = chargementDiffere(() => import('../pilotage/components/EtatBudgetMagasin'))

export function SituationMagasin({ reseau, m, objectifs, manquants = 0, completer, suite }: {
  reseau: Reseau; m: Magasin; objectifs?: ReactNode
  manquants?: number; completer?: () => void // informations de la fiche à compléter (Points d'attention)
  suite?: ReactNode // sous les derniers échanges (blocs repliés de la fiche, choix 255)
}) {
  const a = analyser(reseau, m.nom)
  const c = a?.chiffre
  const mois = a ? libelleMois(a.mois) : ''
  const cumul = a ? cumulAnnee(reseau, m.nom, a.mois) : null
  const rythme = suiviRythme(reseau, anneeDe(reseau.jour)).find((l) => l.magasin.nom === m.nom)
  const etape = prochaineEtape(reseau, m.nom)
  const ouvertes = actionsDuMagasin(reseau, m.nom).filter((x) => !x.a.faite)
  const retards = ouvertes.filter((x) => enRetard(x.a, reseau.jour)).length
  const prochaine = ouvertes.filter((x) => echeanceDate(x.a) >= reseau.jour).sort((x, y) => echeanceDate(x.a).localeCompare(echeanceDate(y.a)))[0]
  const lien = lienFiche(m.nom)
  const tuileBudget = (e: { libelle: string; valeur: string; detail?: string } | null) => (
    <Tuile libelle={e?.libelle ?? 'Budget'} valeur={e?.valeur ?? 'Ouvrir le budget'} detail={e?.detail} lien={`${lien}?vue=budget`} icone={<RequestQuoteOutlined />} />
  )
  return (
    <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <PointsAttention points={pointsAttention(reseau, m, manquants, completer)} />
      <Box component="section" aria-label="Indicateurs du magasin" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' } }}>
        <Indicateur libelle={cumul ? `CA ${cumul.annee} à fin ${libelleMoisCourt(a!.mois).split(' ')[0]}` : 'CA de l’année'} valeur={formatKEuros(cumul?.ca ?? null)}
          detail={cumul?.ecart != null ? `${formatPourcent(cumul.ecart)} vs ${cumul.annee - 1}` : a ? 'Pas de comparaison' : 'Pas encore de chiffres'} ton={cumul?.ecart != null ? (cumul.ecart >= 0 ? 'bon' : 'mauvais') : undefined}
          fin={a ? <MiniCourbe valeurs={courbeCA(reseau, m.nom, a.mois)} couleur={brand.vertFonce} largeur={72} hauteur={32} label="CA des douze derniers mois" /> : undefined} />
        <Indicateur libelle={a ? `CA de ${mois}` : 'CA du mois'} valeur={a?.ca != null ? formatKEuros(a.ca) : '—'}
          detail={a?.ecart != null ? `${formatPourcent(a.ecart)} vs ${libelleMois(a.reference)}` : a ? 'Pas de comparaison' : undefined} ton={a?.ecart != null ? (a.ecart >= 0 ? 'bon' : 'mauvais') : undefined} />
        <Indicateur libelle="Panier moyen HT" valeur={c?.panier != null ? formatEuros(c.panier) : '—'} detail={c?.tickets != null ? `${c.tickets.toLocaleString('fr-FR')} tickets` : undefined} />
        <Indicateur libelle="Taux de marge" valeur={c?.marge != null ? `${c.marge.toLocaleString('fr-FR')} %` : '—'} detail={a ? mois : undefined} />
      </Box>
      <Box component="section" aria-label="À faire maintenant">
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: echelle.section, mb: 1 }}>À faire maintenant</Typography>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' } }}>
          <Tuile libelle="Visite" valeur={etape.libelle} detail={etape.etape === 'planifier' && rythme?.alerte ? libellePasVu(rythme) : etape.detail} lien={etape.lien} icone={iconeEtape[etape.etape]} alerte={etape.etape === 'planifier' && !!rythme?.alerte} />
          <Tuile libelle="Tâches" valeur={retards ? `${retards} en retard` : ouvertes.length ? `${ouvertes.length} en cours` : 'Aucune en cours'} detail={retards ? `${ouvertes.length} en cours au total` : ouvertes.length ? 'Aucune en retard' : undefined}
            lien={`${lien}?vue=activite&fil=taches`} icone={<TaskAltOutlined />} alerte={retards > 0} />
          <Tuile libelle="Prochaine échéance" valeur={prochaine ? prochaine.a.action : 'Aucune'} detail={prochaine ? `Le ${dateCourte(echeanceDate(prochaine.a))}` : 'Pas de tâche datée à venir'}
            lien={`${lien}?vue=activite&fil=taches`} icone={<EventOutlined />} />
          <Suspense fallback={tuileBudget({ libelle: 'Budget', valeur: '…' })}>
            <EtatBudgetMagasin nom={m.nom} rendre={tuileBudget} />
          </Suspense>
        </Box>
      </Box>
      <ParcoursIntegration reseau={reseau} m={m} />
      {objectifs}
      <DerniersEchanges reseau={reseau} m={m} />
      {suite}
    </Box>
  )
}
