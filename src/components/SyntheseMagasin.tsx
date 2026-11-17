// Vue d'ensemble d'un magasin (refonte vague 3, Joseph 09/11/2026, 22A) : au centre, où en est le magasin.
// Quatre indicateurs de la caisse (dernier mois connu, comparé à la référence des alertes), les prochaines étapes
// (visite, tâches, budget, clôture du mois) et le dernier compte rendu. Les informations du magasin sont à gauche.
// Choix 196 (Joseph, 15/11/2026) : sous les indicateurs, une seule bande « À faire maintenant » (visite, tâches en retard,
// prochaine échéance) ; les raccourcis Budget et Clôture du mois redoublaient les onglets, ils sont retirés.
import { Suspense, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
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
import { prochaineEtape } from '../data/ordreDuJour'
import Typography from '@mui/material/Typography'
import { Indicateur as CarteIndicateur } from './Indicateur'
import { useTheme } from '@mui/material/styles'
import { echelle } from '../theme/theme'
import { ParcoursIntegration } from './ParcoursIntegration'
import { analyser, caDe, chiffresDuMagasin, courbeCA, decalerMois, formatKEuros, formatPourcent, libelleMois, libelleMoisCourt } from '../data/chiffres'
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

// Maquette 264 (Joseph, 17/11/2026) : la vue d'ensemble en deux colonnes à rôle clair. À gauche ce qu'il faut faire
// (une seule liste : visite, tâches, mandats, fiche à compléter) et les objectifs ; à droite comment va le magasin
// (CA de l'année et du mois, alertes de caisse et de santé), le budget et le dernier échange. Les informations fixes du
// magasin passent dans le panneau « Infos du magasin » de l'en-tête.
type TonLigne = 'agir' | 'surveiller' | 'neutre'
interface LigneAFaire { cle: string; ton: TonLigne; titre: string; detail?: string; lien?: string; onClick?: () => void }
const RANG_TON: Record<TonLigne, number> = { agir: 0, surveiller: 1, neutre: 2 }
const MAX_TACHES = 3

function Bloc({ titre, action, children }: { titre: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card component="section" aria-label={titre} sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 1.5, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 48, mb: 0.5 }}>
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: echelle.section, mr: 'auto' }}>{titre}</Typography>
        {action}
      </Box>
      {children}
    </Card>
  )
}

function Puce({ ton }: { ton: TonLigne }) {
  if (ton === 'agir') return <ErrorOutlineOutlined sx={{ color: 'error.main', flexShrink: 0 }} />
  if (ton === 'surveiller') return <WarningAmberOutlined sx={{ color: 'warning.dark', flexShrink: 0 }} />
  return <Box aria-hidden sx={{ width: 24, display: 'flex', justifyContent: 'center', flexShrink: 0 }}><Box sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: 'text.disabled' }} /></Box>
}

function Lignes({ lignes }: { lignes: LigneAFaire[] }) {
  return (
    <Box sx={{ display: 'grid' }}>
      {lignes.map((l, i) => {
        const contenu = (
          <>
            <Puce ton={l.ton} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{l.titre}</Typography>
              {l.detail && <Typography variant="body2" sx={{ color: l.ton === 'agir' ? 'error.main' : 'text.secondary' }}>{l.detail}</Typography>}
            </Box>
            {(l.lien || l.onClick) && <ChevronRightOutlined sx={{ color: 'text.secondary', flexShrink: 0 }} />}
          </>
        )
        const sx = { display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', textAlign: 'left', py: 1, minHeight: 56, borderTop: i ? '1px solid' : 0, borderColor: 'divider', fontFamily: 'inherit',
          '@media (hover: hover)': { '&:hover': { bgcolor: 'action.hover' } } } as const
        return l.lien ? <ButtonBase key={l.cle} component={RouterLink} to={l.lien} sx={sx}>{contenu}</ButtonBase>
          : l.onClick ? <ButtonBase key={l.cle} onClick={l.onClick} sx={sx}>{contenu}</ButtonBase>
          : <Box key={l.cle} sx={{ ...sx, '@media (hover: hover)': {} }}>{contenu}</Box>
      })}
    </Box>
  )
}

function AFaire({ reseau, m, manquants, completer }: { reseau: Reseau; m: Magasin; manquants: number; completer?: () => void }) {
  const lien = lienFiche(m.nom)
  const etape = prochaineEtape(reseau, m.nom)
  const rythme = suiviRythme(reseau, anneeDe(reseau.jour)).find((l) => l.magasin.nom === m.nom)
  const pasVu = etape.etape === 'planifier' && !!rythme?.alerte
  const ouvertes = actionsDuMagasin(reseau, m.nom).filter((x) => !x.a.faite)
  const lignes: LigneAFaire[] = [
    { cle: 'visite', ton: (pasVu ? 'surveiller' : 'neutre') as TonLigne, titre: `Visite : ${etape.libelle}`, detail: pasVu && rythme ? libellePasVu(rythme) : etape.detail || undefined, lien: etape.lien },
    ...[...ouvertes].sort((x, y) => (echeanceDate(x.a) || '9999').localeCompare(echeanceDate(y.a) || '9999')).slice(0, MAX_TACHES).map((x): LigneAFaire => {
      const date = echeanceDate(x.a)
      const retard = enRetard(x.a, reseau.jour)
      return { cle: `tache-${x.a.id}`, ton: retard ? 'agir' : 'neutre', titre: x.a.action,
        detail: retard ? `En retard depuis le ${dateCourte(date)}` : date ? `Pour le ${dateCourte(date)}` : 'Sans échéance', lien: `${lien}?vue=activite&fil=taches` }
    }),
    // Mandats et fiche à compléter (points d'attention 257) : des choses à faire
    ...pointsAttention(reseau, m, manquants, completer).filter((p) => p.cle.startsWith('mandat-') || p.cle === 'fiche')
      .map((p): LigneAFaire => ({ cle: p.cle, ton: p.ton, titre: p.texte, lien: p.lien, onClick: p.onClick })),
  ].sort((x, y) => RANG_TON[x.ton] - RANG_TON[y.ton])
  const autres = ouvertes.length - Math.min(ouvertes.length, MAX_TACHES)
  return (
    <Bloc titre="À faire" action={<Button component={RouterLink} to={`${lien}?vue=activite&fil=taches`} sx={{ minHeight: 48 }}>
      {ouvertes.length ? `Toutes les tâches (${ouvertes.length})` : 'Tâches'}</Button>}>
      <Lignes lignes={lignes} />
      {autres > 0 && <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>{`Et ${autres} autre${autres > 1 ? 's' : ''} tâche${autres > 1 ? 's' : ''} en cours`}</Typography>}
    </Bloc>
  )
}

function CommentVa({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const a = analyser(reseau, m.nom)
  const cumul = a ? cumulAnnee(reseau, m.nom, a.mois) : null
  const alertes = pointsAttention(reseau, m, 0).filter((p) => p.cle === 'caisse' || p.cle === 'sante')
    .map((p): LigneAFaire => ({ cle: p.cle, ton: p.ton, titre: p.texte, lien: p.lien }))
  return (
    <Bloc titre="Comment va le magasin" action={<Button component={RouterLink} to={`${lienFiche(m.nom)}?vue=chiffres`} sx={{ minHeight: 48 }}>Chiffres</Button>}>
      {!a ? <Typography variant="body2" color="text.secondary" sx={{ pb: 1 }}>Pas encore de chiffres de caisse pour ce magasin. Ils arrivent avec l’import mensuel.</Typography> : (
        <Box role="group" aria-label="Indicateurs du magasin" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', mx: { xs: -1.5, md: -2 } }}>
          <Indicateur libelle={cumul ? `CA ${cumul.annee} à fin ${libelleMoisCourt(a.mois).split(' ')[0]}` : 'CA de l’année'} valeur={formatKEuros(cumul?.ca ?? null)}
            detail={cumul?.ecart != null ? `${formatPourcent(cumul.ecart)} vs ${cumul.annee - 1}` : 'Pas de comparaison'} ton={cumul?.ecart != null ? (cumul.ecart >= 0 ? 'bon' : 'mauvais') : undefined}
            fin={<MiniCourbe valeurs={courbeCA(reseau, m.nom, a.mois)} couleur={brand.vertFonce} largeur={72} hauteur={32} label="CA des douze derniers mois" />} />
          <Indicateur libelle={`CA de ${libelleMois(a.mois)}`} valeur={a.ca != null ? formatKEuros(a.ca) : '—'}
            detail={a.ecart != null ? `${formatPourcent(a.ecart)} vs ${libelleMois(a.reference)}` : 'Pas de comparaison'} ton={a.ecart != null ? (a.ecart >= 0 ? 'bon' : 'mauvais') : undefined} />
        </Box>
      )}
      {alertes.length > 0 && <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 1 }}><Lignes lignes={alertes} /></Box>}
    </Bloc>
  )
}

// Le dernier échange avec le magasin (visite, appel, note, message, tâche faite) ; tout le reste dans l'Activité
const GENRES_ECHANGES = new Set(['visite', 'message', 'journal', 'tache', 'pratique'])
const instantTri = (s: string) => (s.length === 10 ? `${s}T00:00:00` : s)

function DernierEchange({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const e = [...filDu(reseau, new Set([m.nom]), null, 3650), ...journalDansLeFil(reseau, m)]
    .filter((x) => GENRES_ECHANGES.has(x.genre) && x.instant.slice(0, 10) <= reseau.jour)
    .sort((x, y) => instantTri(y.instant).localeCompare(instantTri(x.instant)))[0] as ElementFil | undefined
  return (
    <Bloc titre="Dernier échange" action={<Button component={RouterLink} to={`${lienFiche(m.nom)}?vue=activite`} sx={{ minHeight: 48 }}>Toute l’activité</Button>}>
      {!e ? <Typography variant="body2" color="text.secondary" sx={{ pb: 1 }}>Aucun échange enregistré. Une visite, un appel ou une note s’ajoutent par le « + » de la fiche.</Typography> : (
        <ButtonBase component={RouterLink} to={e.lien}
          sx={{ display: 'block', width: '100%', textAlign: 'left', py: 1, minHeight: 48, fontFamily: 'inherit', '@media (hover: hover)': { '&:hover': { bgcolor: 'action.hover' } } }}>
          <Typography variant="body2" color="text.secondary">{[dateCourte(e.instant.slice(0, 10)), e.action.charAt(0).toUpperCase() + e.action.slice(1), e.auteur].filter(Boolean).join(' · ')}</Typography>
          {(e.titre || e.texte) && <Typography sx={{ fontWeight: e.titre ? 700 : 400, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{e.titre ?? e.texte}</Typography>}
        </ButtonBase>
      )}
    </Bloc>
  )
}

// Choix 258 : où en est le budget de l'année, chargé avec le pilotage (à la demande)
const EtatBudgetMagasin = chargementDiffere(() => import('../pilotage/components/EtatBudgetMagasin'))

export function SituationMagasin({ reseau, m, objectifs, manquants = 0, completer, avant }: {
  reseau: Reseau; m: Magasin; objectifs?: ReactNode
  manquants?: number; completer?: () => void // informations de la fiche à compléter (dans « À faire »)
  avant?: ReactNode // en tête de la colonne « À faire » (ouverture d'un nouveau magasin)
}) {
  const tuileBudget = (e: { libelle: string; valeur: string; detail?: string } | null) => (
    <Tuile libelle={e?.libelle ?? 'Budget'} valeur={e?.valeur ?? 'Ouvrir le budget'} detail={e?.detail} lien={`${lienFiche(m.nom)}?vue=budget`} icone={<RequestQuoteOutlined />} />
  )
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'start' }}>
      <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
        {avant}
        <AFaire reseau={reseau} m={m} manquants={manquants} completer={completer} />
        <ParcoursIntegration reseau={reseau} m={m} />
        {objectifs}
      </Box>
      <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <CommentVa reseau={reseau} m={m} />
        <Box role="group" aria-label="Budget du magasin" sx={{ display: 'grid' }}>
          <Suspense fallback={tuileBudget({ libelle: 'Budget', valeur: '…' })}>
            <EtatBudgetMagasin nom={m.nom} rendre={tuileBudget} />
          </Suspense>
        </Box>
        <DernierEchange reseau={reseau} m={m} />
      </Box>
    </Box>
  )
}
