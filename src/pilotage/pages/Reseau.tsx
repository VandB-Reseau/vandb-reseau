import { Entete, LigneSansResultat, styleListe, useTableau, type ColonneTri } from '../../components/TableauTri'
import { CausesEcartsReseau } from '../components/CausesEcarts'
import { useNomsPerimetre } from '../../data/perimetreChoisi'
import { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import PrintOutlined from '@mui/icons-material/PrintOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import EuroOutlined from '@mui/icons-material/EuroOutlined'
import PercentOutlined from '@mui/icons-material/PercentOutlined'
import RequestQuoteOutlined from '@mui/icons-material/RequestQuoteOutlined'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import { RechercheFiltres } from '../../components/RechercheFiltres'
import { FiltreMenu } from '../../components/FiltreMenu'
import { BoutonOutil, useTelephone } from '../../components/Outils'
import { Indicateur, grilleIndicateurs, sensDe } from '../../components/Indicateur'
import { evolPoints, evolPourcent } from '../../components/TableauDeBord'
import { BoutonCouleurs, BoutonPresenter, Lecture, Presentation, fondEcart, fondsMediane } from '../../components/Visuel'
import type { PointCarte } from '../../components/CarteValeurs'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import MapOutlined from '@mui/icons-material/MapOutlined'
import TableChartOutlined from '@mui/icons-material/TableChartOutlined'
import { MaSemaine } from '../components/MaSemaine'
import { useAuth } from '../auth/AuthContext'
import { EtatVide } from '../components/EtatVide'
import { Panne } from '../components/Panne'
import { chargerActions, chargerAlertes, chargerBudgets, chargerParametres, chargerQuadrimestres, chargerReelDuCompte, chargerStocksReseau, hypothesesDe, parametresDuBudget, type SaisiesQuadrimestres } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { feuilleReseau } from '../lib/exports'
import { ecartPts, ecartTaux, lienMagasin, milliers, MOIS, MOIS_LONGS, taux } from '../lib/format'
import { lectureEcarts } from '../lib/lecture'
import { classeur, nomFichier, telecharger } from '../lib/xlsx'
import { fraisDepuisLignes } from '../moteur/atterrissage'
import { calculerBudget } from '../moteur/budget'
import { medianes, ratiosDuReel, RATIOS, type CleRatio } from '../moteur/comparaison'
import { maSemaine, parCoach } from '../moteur/semaine'
import { ligneReseau, totalReseau, type LigneReseau, type MoisReel } from '../moteur/suivi'
import { ficheVisite } from '../moteur/visite'
import { styleTableau } from '../theme/tableau'
import { niveauEcart, type NiveauEcart } from '../moteur/visuel'
import { Pastille } from '../components/Tableau'
import { anneeSuivi } from '../data/annees'
import { stockParDefaut, stockReseau, type EtatStock } from '../moteur/stock'

type Cle = 'magasin' | 'moisRealises' | 'ca' | 'evolution' | 'ecartBudget' | 'ecartMarge' | 'ecartEbe' | 'ecartFP' | 'tauxMarge' | 'panierCave' | 'ticketsCave' | 'panierBar' | 'ticketsBar' | 'pctFP' | 'caParHeure' | 'loyerSurCA' | 'ebeSurCA' | 'moisStock' | 'cibleStock'
// fond (393) : écart signé (plein = couleur la plus franche), ou place face à la médiane ; inverse : plus bas = mieux
type Colonne = { cle: Exclude<Cle, 'magasin'>; libelle: string; texte: (v: number) => string; rouge?: (v: number) => boolean; fond?: { ecart?: number; inverse?: boolean } }

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const COLONNES: Colonne[] = [
  { cle: 'moisRealises', libelle: 'Réel à fin', texte: (v) => (v ? MOIS[v - 1] : 'Aucun') },
  { cle: 'ca', libelle: 'CA HT', texte: milliers },
  { cle: 'evolution', libelle: 'Évolution sur l’an dernier', texte: ecartTaux, rouge: (v) => v < 0, fond: { ecart: 0.15 } },
  { cle: 'ecartBudget', libelle: 'Écart au budget', texte: ecartTaux, rouge: (v) => v < 0, fond: { ecart: 0.15 } },
  // 397 (Joseph, 24/11/2026) : marge, EBE et frais de personnel face au budget des mêmes mois, en points
  { cle: 'ecartMarge', libelle: 'Marge face au budget', texte: ecartPts, rouge: (v) => v < 0, fond: { ecart: 0.03 } },
  { cle: 'ecartEbe', libelle: 'EBE / CA face au budget', texte: ecartPts, rouge: (v) => v < 0, fond: { ecart: 0.03 } },
  { cle: 'ecartFP', libelle: '% FP face au budget', texte: ecartPts, rouge: (v) => v > 0, fond: { ecart: 0.03, inverse: true } },
  { cle: 'tauxMarge', libelle: 'Taux de marge', texte: taux, fond: {} },
  { cle: 'panierCave', libelle: 'Panier Cave TTC', texte: (v) => euros.format(v), fond: {} },
  { cle: 'ticketsCave', libelle: 'Tickets Cave sur l’an dernier', texte: ecartTaux, rouge: (v) => v < 0, fond: { ecart: 0.15 } },
  { cle: 'panierBar', libelle: 'Panier Bar TTC', texte: (v) => euros.format(v), fond: {} },
  { cle: 'ticketsBar', libelle: 'Tickets Bar sur l’an dernier', texte: ecartTaux, rouge: (v) => v < 0, fond: { ecart: 0.15 } },
  { cle: 'pctFP', libelle: '% FP', texte: taux, fond: { inverse: true } },
  { cle: 'caParHeure', libelle: 'CA par heure travaillée', texte: (v) => euros.format(v), fond: {} },
  { cle: 'loyerSurCA', libelle: 'Loyer / CA', texte: taux, fond: { inverse: true } },
  { cle: 'ebeSurCA', libelle: 'EBE / CA', texte: taux, rouge: (v) => v < 0, fond: {} },
  // 245 : mois d'achats à venir que couvre le stock Cave + Bar du dernier mois saisi, face à la cible pondérée
  { cle: 'moisStock', libelle: 'Stock en mois d’achats', texte: (v) => `${unMois.format(v)} mois` },
  { cle: 'cibleStock', libelle: 'Cible du stock', texte: (v) => `${unMois.format(v)} mois` },
]
const unMois = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const valeurDe = (m: object, cle: string) => ((m as Record<string, unknown>)[cle] as number | null | undefined) ?? null
const MILLIERS = new Set(['ca']), POURCENTS = new Set(['evolution', 'ecartBudget', 'tauxMarge', 'ticketsCave', 'ticketsBar', 'pctFP', 'loyerSurCA', 'ebeSurCA']), POINTS = new Set(['ecartMarge', 'ecartEbe', 'ecartFP'])
const colonnesTri: ColonneTri<LigneReseau & { coach: string }>[] = [
  { cle: 'magasin', libelle: 'Magasin', valeur: (m) => m.magasin },
  { cle: 'coach', libelle: 'Coach', valeur: (m) => m.coach || null },
  ...COLONNES.map((c): ColonneTri<LigneReseau & { coach: string }> => {
    const v = (m: LigneReseau & { coach: string }) => (c.cle === 'moisRealises' ? m.moisRealises || null : valeurDe(m, c.cle))
    if (c.cle === 'moisRealises') return { cle: c.cle, libelle: c.libelle, valeur: v, texte: (m) => c.texte(m.moisRealises), filtre: 'liste' }
    const echelle = MILLIERS.has(c.cle) ? 1 / 1000 : POURCENTS.has(c.cle) || POINTS.has(c.cle) ? 100 : 1
    return { cle: c.cle, libelle: c.libelle, valeur: v, filtre: 'nombre', nombre: (m) => { const x = v(m); return x === null ? null : x * echelle }, unite: MILLIERS.has(c.cle) ? 'k€' : POURCENTS.has(c.cle) ? '%' : POINTS.has(c.cle) ? 'pt' : '€' }
  }),
]
// Allègement (Joseph, 03/11/2026) : le classement se lit par vue de 4 à 5 colonnes ; l'export Excel garde tout
type Vue = 'ventes' | 'budget' | 'clients' | 'equipe' | 'stock'
const VUES: { cle: Vue; libelle: string; colonnes: Colonne['cle'][] }[] = [
  { cle: 'ventes', libelle: 'Ventes', colonnes: ['moisRealises', 'ca', 'evolution', 'ecartBudget', 'tauxMarge'] },
  { cle: 'budget', libelle: 'Face au budget', colonnes: ['moisRealises', 'ecartBudget', 'ecartMarge', 'ecartEbe', 'ecartFP'] },
  { cle: 'clients', libelle: 'Clients', colonnes: ['panierCave', 'ticketsCave', 'panierBar', 'ticketsBar'] },
  { cle: 'equipe', libelle: 'Équipe et frais', colonnes: ['pctFP', 'caParHeure', 'loyerSurCA', 'ebeSurCA'] },
  { cle: 'stock', libelle: 'Stock', colonnes: ['moisRealises', 'moisStock', 'cibleStock'] },
]
const ETAT_STOCK: Record<EtatStock, { niveau: 'favorable' | 'fort'; texte: string }> = {
  ok: { niveau: 'favorable', texte: 'dans la cible' }, haut: { niveau: 'fort', texte: 'au-dessus de la cible' }, bas: { niveau: 'fort', texte: 'sous la cible' },
}
const CarteValeurs = lazy(() => import('../../components/CarteValeurs'))
const douze = (): MoisReel[] => Array.from({ length: 12 }, () => ({ caHT: 0, margeHT: 0, caAvecMarge: 0, caTTC: 0, tickets: 0 }))
// Sur téléphone, les chiffres d'abord : Coach, RR et groupe restent dans les filtres
const surPC = { display: { xs: 'none', md: 'table-cell' } }
const simple = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

// Chaque magasin à la fin de son dernier mois réalisé, face à l'an dernier et à son budget (aussi lu par le rapport du mois, 29A)
export async function chargerSuiviReseau(annee: number) {
  // Stocks lus en même temps que le reste, plus après (Joseph, 23/11/2026 : ouverture plus rapide)
  const [d, { parametres }, reel, alertes, actions, quadrimestres, stocks] = await Promise.all([chargerBudgets(annee), chargerParametres(annee), chargerReelDuCompte(annee), chargerAlertes(), chargerActions().catch(() => []), chargerQuadrimestres(annee).catch(() => ({} as SaisiesQuadrimestres)),
    chargerStocksReseau(annee).catch(() => ({} as Awaited<ReturnType<typeof chargerStocksReseau>>))])
  const pStock = parametres.tresorerie.stock ?? stockParDefaut
  const groupes = new Map(d.groupes.map((g) => [g.id, g.nom]))
  const p = { tauxRedevance: parametres.tauxRedevance, tauxPublicite: parametres.tauxPublicite, charges: parametres.charges, annee }
  const magasins = d.magasins.map((l) => {
    const h = l.statut ? hypothesesDe(l, d) : null
    const frais = d.frais[l.magasin]
    const n = reel.magasins[l.magasin]?.n ?? douze(), n1 = reel.magasins[l.magasin]?.n1 ?? douze()
    const budget = h ? calculerBudget(h.hypotheses, parametresDuBudget(l, parametres)) : null
    const stock = stocks[l.magasin] ? stockReseau(n, reel.magasins[l.magasin]?.n1 ?? [], stocks[l.magasin], pStock) : null
    return {
      moisStock: stock?.moisCouverts ?? null, cibleStock: stock?.cible ?? null, etatStock: stock?.etat ?? null,
      // Fiche de visite du magasin (lot 28), pour « Ma semaine » (lot 29)
      fiche: ficheVisite({ n, n1, budget }, parametres.tvaPanier),
      ...ligneReseau({
        magasin: l.magasin, n, n1,
        budget,
        equipe: d.equipes[l.magasin], frais: frais?.length ? fraisDepuisLignes(frais).frais : undefined,
        quadrimestres: quadrimestres[l.magasin] ?? {},
      }, p),
      groupeId: l.groupeId, groupe: l.groupeId ? groupes.get(l.groupeId) ?? '' : '', coach: reel.coachs[l.magasin] ?? '', rrs: reel.rrs[l.magasin] ?? [],
    }
  })
  const trie = (l: string[]) => [...new Set(l)].sort((a, b) => a.localeCompare(b, 'fr'))
  return { magasins, alertes, actions, seuil: parametres.alertes.ecartCA, groupes: d.groupes, coachs: trie(Object.values(reel.coachs)), rrs: trie(Object.values(reel.rrs).flat()) }
}

// Vue réseau : chaque magasin à la fin de son dernier mois réalisé, face à l'an dernier, à son budget et au total du réseau
// integre : vue « Écarts au budget » de la page Performance (refonte vague 2, 15A), titre de niveau 2
export function Reseau({ integre }: { integre?: boolean } = {}) {
  const { profil } = useAuth()
  const annee = anneeSuivi()
  const { donnees, erreur, chargement, recharger } = useChargement(() => chargerSuiviReseau(annee), [annee])

  // Filtres et tri gardés dans l'adresse : le retour depuis une fiche les retrouve
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const changer = (valeurs: Record<string, string | null>) => setParams((p) => {
    const n = new URLSearchParams(p)
    for (const [k, v] of Object.entries(valeurs)) if (v) n.set(k, v); else n.delete(k)
    return n
  }, { replace: true })
  const recherche = params.get('q') ?? ''
  // Plusieurs choix par filtre, comme dans « Chiffres des magasins » (Joseph, 23/11/2026) ; gardés dans l'adresse
  const liste = (texte: string | null) => (texte ?? '').split('|').filter(Boolean)
  const pGroupe = params.get('groupe'), pCoach = params.get('coach'), pRr = params.get('rr'), pEcart = params.get('ecart')
  const groupes = useMemo(() => liste(pGroupe).map(Number), [pGroupe])
  const coachs = useMemo(() => liste(pCoach), [pCoach])
  const rrs = useMemo(() => liste(pRr), [pRr])
  const ecarts = useMemo(() => liste(pEcart) as (NiveauEcart | 'sans')[], [pEcart])
  const telephone = useTelephone()
  // Dans Performance, « vue » choisit l'onglet de la page : le classement prend son propre paramètre
  const PARAM_VUE = integre ? 'classement' : 'vue'
  const vue = VUES.find((v) => v.cle === params.get(PARAM_VUE)) ?? VUES[0]
  const colonnes = COLONNES.filter((c) => vue.colonnes.includes(c.cle))
  const tri = ([...COLONNES.map((c) => c.cle), 'magasin', 'coach'] as string[]).includes(params.get('tri') ?? '') ? params.get('tri') as Cle : 'ca'
  const sens = params.get('sens') === 'asc' ? 'asc' : params.get('sens') === 'desc' ? 'desc' : tri === 'magasin' ? 'asc' : 'desc'
  // 393 : tableau en couleurs (interrupteur) ; 399 : affichage Carte ; 398 : regroupé par RR ou par Coach, un clic creuse
  const couleurs = params.get('couleurs') !== 'non'
  const carte = params.get('affichage') === 'carte'
  const par = params.get('par') === 'rr' ? 'rr' : params.get('par') === 'coach' ? 'coach' : null
  const creuse = params.get('creuse') === '1'
  const [presenter, setPresenter] = useState(false)

  // Vague 3 (21A) : le périmètre choisi dans le menu
  const noms = useNomsPerimetre()
  const choisis = useMemo(() => {
    const q = simple(recherche)
    return (donnees?.magasins ?? []).filter((m) => (!noms || noms.has(m.magasin)) && (!groupes.length || (m.groupeId !== null && m.groupeId !== undefined && groupes.includes(m.groupeId)))
      && (!coachs.length || coachs.includes(m.coach)) && (!rrs.length || m.rrs.some((r) => rrs.includes(r))) && (!q || simple(m.magasin).includes(q)))
  }, [donnees, noms, recherche, groupes, coachs, rrs])
  // Tuiles de l'écart au budget (même geste que les alertes de « Chiffres des magasins ») : un clic filtre la liste
  const seuil = donnees?.seuil ?? 0.05
  const niveauDe = useCallback((m: LigneReseau) => (m.ecartBudget === null ? 'sans' : niveauEcart(1 + m.ecartBudget, 1, seuil) ?? 'sans'), [seuil])
  const parEcart = useMemo(() => (ecarts.length ? choisis.filter((m) => ecarts.includes(niveauDe(m))) : choisis), [choisis, ecarts, niveauDe])
  // Harmonisation des tableaux (10/11/2026) : chaque colonne se trie et se filtre ; le tri reste dans l'adresse.
  // Valeur absente toujours en bas, quel que soit le sens ; bornes des filtres dans l'unité affichée (k€, %, €)
  const tableau = useTableau(parEcart, colonnesTri, {
    tri: { cle: 'ca', sens: 'desc' }, memoire: 'suivi-reseau',
    controle: { tri: { cle: tri, sens }, changer: (x) => changer({ tri: x && x.cle !== 'ca' ? x.cle : null, sens: x && !(x.cle === 'ca' && x.sens === 'desc') ? x.sens : null }) },
  })
  const visibles = tableau.lignes
  const total = totalReseau(visibles)
  // Médiane de la sélection : un groupe filtré donne la médiane du groupe
  const mediane = medianes(visibles.filter((m) => m.moisRealises > 0).map(ratiosDuReel))
  const filtre = visibles.length !== (donnees?.magasins.length ?? 0)
  const etat = { liste: visibles.map((m) => m.magasin), retour: params.toString(), depuis: { chemin: '/budgets/suivi', nom: `Suivi ${annee}` } }
  const sousBudget = visibles.filter((m) => m.ecartBudget !== null && m.ecartBudget < 0).length
  const avecBudget = visibles.filter((m) => m.ecartBudget !== null).length
  // Sélection en clair, reprise dans l'export et sur la page imprimée
  const selection = [
    ...groupes.map((g) => donnees?.groupes.find((x) => x.id === g)?.nom ?? ''), ...coachs, ...rrs, recherche.trim() ? `« ${recherche.trim()} »` : '',
  ].filter(Boolean).join(' · ') || 'Tout le réseau'
  const exporter = () => {
    if (!donnees) return
    const avec = { coach: donnees.coachs.length > 0, rr: donnees.rrs.length > 0, groupe: donnees.groupes.length > 0 }
    telecharger(nomFichier(`Réseau ${annee}${selection === 'Tout le réseau' ? '' : ` - ${selection.replace(/[«»]/g, '')}`}`),
      classeur([feuilleReseau({ annee, selection, lignes: visibles, total, avec })]))
  }

  // Joseph (23/11/2026) : même structure que « Chiffres des magasins » : barre de recherche et filtres, cartes chiffrées,
  // tuiles qui filtrent, tableau ; le titre « Suivi » ne reste qu'à l'impression
  const entete = (
    <Typography className="impression-seule" variant="body1" color="text.secondary" sx={{ mb: 2 }}>
      {`Suivi ${annee} · réel magasin par magasin · ${selection} · imprimé le ${new Date().toLocaleDateString('fr-FR')}`}
    </Typography>
  )
  if (chargement && !donnees) return <Box>{entete}<Stack spacing={2}><Skeleton variant="rounded" height={120} /><Skeleton variant="rounded" height={320} /></Stack></Box>
  if (erreur || !donnees) return <Box>{entete}<Panne quoi={`Le réel ${annee} du réseau`} recharger={recharger} /></Box>
  if (!donnees.magasins.some((m) => m.moisRealises > 0)) {
    return <Box>{entete}<EtatVide titre={`Pas encore de réel ${annee}`} texte={`La vue réseau compare les magasins à partir des chiffres réels ${annee}, importés chaque mois depuis la caisse.`} /></Box>
  }

  const cellule = (c: Colonne, v: number | null, fort = false, etat: EtatStock | null = null, fond?: string) => (
    <TableCell key={c.cle} align="right" data-fond={fond ? '' : undefined}
      sx={{ whiteSpace: 'nowrap', fontWeight: fort ? 700 : 400, color: v !== null && c.rouge?.(v) ? 'error.main' : v === null ? 'text.disabled' : undefined, ...(fond ? { bgcolor: fond } : {}) }}>
      {v === null ? '–' : c.cle === 'ecartBudget' ? (
        // Refonte T2 (2/11/2026) : pastille de l'écart au budget, mêmes couleurs que dans la fiche du magasin
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Pastille niveau={niveauEcart(1 + v, 1, donnees.seuil)} />{c.texte(v)}</Box>
      ) : etat && c.cle === 'moisStock' ? (
        <Box component="span" title={ETAT_STOCK[etat].texte} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Pastille niveau={ETAT_STOCK[etat].niveau} />{c.texte(v)}</Box>
      ) : c.texte(v)}
    </TableCell>
  )
  // Le tableau « Par Coach » de Ma semaine passe dans le menu Coach : magasins et magasins à suivre de chaque Coach
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const parCoachTous = new Map(parCoach(maSemaine(donnees.magasins.filter((m) => m.moisRealises > 0 || donnees.alertes.some((a) => a.magasin === m.magasin)),
    donnees.alertes, donnees.actions, aujourdhui)).map((c) => [c.coach, c]))

  const filtrer = (cle: string, valeurs: string[]) => changer({ [cle]: valeurs.join('|') || null })
  const nbFiltres = groupes.length + coachs.length + rrs.length + ecarts.length
  const compte = (n: NiveauEcart | 'sans') => choisis.filter((m) => niveauDe(m) === n).length
  const seuilTexte = `${Math.round(donnees.seuil * 100)} %`
  const tuiles: { id: NiveauEcart | 'sans'; titre: string; detail: string; couleur?: string }[] = [
    { id: 'fort', titre: 'Sous le budget', detail: `Plus de ${seuilTexte} sous le budget`, couleur: 'error.main' },
    { id: 'leger', titre: 'Léger retard', detail: `Moins de ${seuilTexte} sous le budget`, couleur: 'warning.dark' },
    { id: 'favorable', titre: 'Au budget ou au-dessus', detail: 'Réel au niveau du budget', couleur: 'success.dark' },
    { id: 'sans', titre: 'Sans comparaison', detail: `Pas de budget ${annee} ou pas de réel` },
  ]
  // 398 : un total par Responsable Régional ou par Coach, sur les magasins filtrés ; un clic descend d'un niveau
  const groupesAffiches = par ? (() => {
    const cles = [...new Set(visibles.flatMap((m) => (par === 'rr' ? (m.rrs.length ? m.rrs : ['']) : [m.coach])))]
    return cles.map((k) => {
      const l = visibles.filter((m) => (par === 'rr' ? (k ? m.rrs.includes(k) : !m.rrs.length) : m.coach === k))
      return { cle: k, nom: k || (par === 'rr' ? 'Sans Responsable Régional' : 'Sans Coach'), n: l.length, t: totalReseau(l) }
    }).sort((a, b) => b.t.ca - a.t.ca)
  })() : null
  const creuser = (k: string) => {
    if (!k) return
    if (par === 'rr') changer({ rr: k, par: 'coach', creuse: '1' })
    else if (par === 'coach') changer({ coach: k, par: null, creuse: '1' })
  }
  const revenir = () => {
    if (!par && coachs.length === 1) changer({ coach: null, par: 'coach', creuse: rrs.length === 1 ? '1' : null })
    else if (par === 'coach' && rrs.length === 1) changer({ rr: null, par: 'rr', creuse: null })
    else changer({ creuse: null })
  }
  const peutRevenir = creuse && ((!par && coachs.length === 1) || (par === 'coach' && rrs.length === 1))
  // 393 : fond de chaque cellule, colonne par colonne, sur les lignes affichées (magasins ou groupes)
  const valeursAffichees = groupesAffiches ? groupesAffiches.map((g) => g.t) : visibles
  const fonds = new Map(couleurs ? colonnes.filter((c) => c.fond).map((c) => {
    const v = valeursAffichees.map((m) => valeurDe(m, c.cle))
    return [c.cle, c.fond!.ecart ? v.map((x) => fondEcart(x, c.fond!.ecart!, c.fond!.inverse)) : fondsMediane(v, c.fond!.inverse)] as const
  }) : [])
  const fondDe = (cle: string, k: number) => fonds.get(cle as Colonne['cle'])?.[k]
  // 394 : la phrase de lecture, sur l'écart au budget des magasins affichés
  const dernier = Math.max(0, ...visibles.map((m) => m.moisRealises))
  const lecture = lectureEcarts({
    quoi: `CA HT${dernier ? ` à fin ${MOIS_LONGS[dernier - 1]}` : ''}`, total: total.ecartBudget, ref: 'le budget', seuil: donnees.seuil,
    lignes: groupesAffiches ? groupesAffiches.map((g) => ({ nom: g.nom, e: g.t.ecartBudget })) : visibles.map((m) => ({ nom: m.magasin, e: m.ecartBudget })),
    unite: par === 'rr' ? ['Responsable Régional', 'Responsables Régionaux'] : par === 'coach' ? ['Coach', 'Coachs'] : undefined,
  })
  const points: PointCarte[] = visibles.map((m) => ({
    nom: m.magasin, lien: lienMagasin(m.magasin), bon: m.ecartBudget === null ? null : m.ecartBudget >= 0,
    texte: m.ecartBudget === null ? 'pas de comparaison au budget' : `${ecartTaux(m.ecartBudget)} sur le budget (CA HT ${milliers(m.ca)})`,
  }))
  const choixRegrouper = (
    <ToggleButtonGroup exclusive size="small" value={par ?? 'magasins'} aria-label="Regrouper"
      onChange={(_, v: string | null) => v && changer({ par: v === 'magasins' ? null : v, creuse: null })}
      className="pas-a-l-impression" sx={{ '& .MuiToggleButton-root': { minHeight: { xs: 48, md: 40 }, px: 1.5, textTransform: 'none', fontWeight: 600 } }}>
      <ToggleButton value="magasins">Magasins</ToggleButton>
      {donnees.rrs.length > 0 && <ToggleButton value="rr">Par RR</ToggleButton>}
      {donnees.coachs.length > 0 && <ToggleButton value="coach">Par Coach</ToggleButton>}
    </ToggleButtonGroup>
  )
  const choixAffichage = (
    <ToggleButtonGroup exclusive size="small" value={carte ? 'carte' : 'tableau'} aria-label="Affichage"
      onChange={(_, v: string | null) => v && changer({ affichage: v === 'carte' ? 'carte' : null })}
      className="pas-a-l-impression" sx={{ '& .MuiToggleButton-root': { minHeight: { xs: 48, md: 40 }, px: 1.5, gap: 0.75, textTransform: 'none', fontWeight: 600 } }}>
      <ToggleButton value="tableau"><TableChartOutlined fontSize="small" />Tableau</ToggleButton>
      <ToggleButton value="carte"><MapOutlined fontSize="small" />Carte</ToggleButton>
    </ToggleButtonGroup>
  )
  const choixVue = (
    <ToggleButtonGroup exclusive size="small" value={vue.cle} onChange={(_, v: Vue | null) => v && changer({ [PARAM_VUE]: v === 'ventes' ? null : v })} aria-label="Vue du classement"
      className="pas-a-l-impression" sx={{ '& .MuiToggleButton-root': { minHeight: { xs: 48, md: 40 }, px: 1.5, textTransform: 'none', fontWeight: 600 } }}>
      {VUES.map((v) => <ToggleButton key={v.cle} value={v.cle}>{v.libelle}</ToggleButton>)}
    </ToggleButtonGroup>
  )
  const champRecherche = (
    <TextField size="small" value={recherche} onChange={(e) => changer({ q: e.target.value })} placeholder="Magasin…"
      slotProps={{ htmlInput: { 'aria-label': 'Filtrer la liste des magasins' }, input: { startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> } }}
      sx={{ width: { xs: '100%', sm: 320 }, '& .MuiOutlinedInput-root': { borderRadius: 2, minHeight: 48 }, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }} />
  )

  const avecCoach = donnees.coachs.length > 0 && !par
  const corps = (
    <>
      <Box component="section" aria-label={`Réseau ${annee} en chiffres`} sx={{ ...grilleIndicateurs, mb: { xs: 1, md: 1.5 } }}>
        <Indicateur bordee icone={<EuroOutlined />} libelle={`CA HT cumulé ${annee}`} valeur={milliers(total.ca)}
          evolution={total.evolution === null ? null : evolPourcent(total.evolution * 100, `vs ${annee - 1} · ${total.magasins} magasin${total.magasins > 1 ? 's' : ''} avec du réel`)}
          detail={total.evolution === null ? `${total.magasins} magasin${total.magasins > 1 ? 's' : ''} avec du réel` : undefined} />
        <Indicateur bordee icone={<RequestQuoteOutlined />} libelle="Écart au budget" valeur={total.ecartBudget === null ? 'Pas de budget' : ecartTaux(total.ecartBudget)}
          couleur={total.ecartBudget !== null && total.ecartBudget < 0 ? 'error.main' : undefined}
          detail={avecBudget ? `${sousBudget} magasin${sousBudget > 1 ? 's' : ''} sous le budget sur ${avecBudget}` : `Aucun budget ${annee} dans l’app`} />
        <Indicateur bordee icone={<PercentOutlined />} libelle="Taux de marge" valeur={total.tauxMarge === null ? 'Non connu' : taux(total.tauxMarge)}
          evolution={total.ecartMarge === null ? null : { ...evolPoints(total.ecartMarge * 100, 'face au budget')!, sens: sensDe(total.ecartMarge * 100) }}
          detail={[total.panierCave === null ? '' : `Panier Cave ${euros.format(total.panierCave)}`, total.panierBar === null ? '' : `Bar ${euros.format(total.panierBar)}`].filter(Boolean).join(' · ') || undefined} />
        <Indicateur bordee icone={<GroupsOutlined />} libelle="Frais de personnel / CA" valeur={total.pctFP === null ? 'À renseigner' : taux(total.pctFP)}
          evolution={total.ecartFP === null ? null : { ...evolPoints(total.ecartFP * 100, 'face au budget')!, bon: total.ecartFP <= 0 }}
          detail={total.ebeSurCA === null ? 'Équipe et frais à renseigner' : `EBE à date : ${taux(total.ebeSurCA)} du CA`} />
      </Box>
      <Lecture texte={lecture} />
      {peutRevenir && (
        <Button startIcon={<ArrowBackOutlined />} onClick={revenir} className="pas-a-l-impression" sx={{ minHeight: 48, mb: 1 }}>
          {`Revenir ${par === 'coach' ? 'aux Responsables Régionaux' : 'aux Coachs'}`}
        </Button>
      )}
      <Box role="group" aria-label="Magasins par écart au budget" className="pas-a-l-impression" sx={{ ...grilleIndicateurs, mb: 2 }}>
        {tuiles.map((t) => {
          const actif = ecarts.length === 1 && ecarts[0] === t.id
          return <Indicateur key={t.id} libelle={t.titre} valeur={String(compte(t.id))} detail={t.detail} couleur={t.couleur} actif={actif}
            onClick={() => filtrer('ecart', actif ? [] : [t.id])} />
        })}
      </Box>

      <Box className="pas-a-l-impression" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
        {telephone && <Box sx={{ overflowX: 'auto', maxWidth: '100%' }}>{choixVue}</Box>}
        {choixRegrouper}
        {!par && choixAffichage}
        {!(carte && !par) && <BoutonCouleurs actif={couleurs} basculer={() => changer({ couleurs: couleurs ? 'non' : null })} />}
      </Box>

      {parEcart.length === 0 ? (
        <EtatVide titre="Aucun magasin ne correspond" texte="Change de filtre ou de recherche pour retrouver les magasins." />
      ) : carte && !par ? (
        <Suspense fallback={<Skeleton variant="rounded" height={420} />}>
          <CarteValeurs points={points} titre={`Carte de l’écart au budget ${annee}`} mieux="Au budget ou au-dessus" moins="Sous le budget" surPC={!telephone} />
        </Suspense>
      ) : (
        <Card>
          <TableContainer>
            <Table size="small" className="colonne-fixe" aria-label={`Réel ${annee} par magasin`} sx={[styleTableau, styleListe]}>
              <TableHead>
                <TableRow>
                  {par ? <TableCell sx={{ minWidth: 180, fontWeight: 700 }}>{par === 'rr' ? 'Responsable Régional' : 'Coach'}</TableCell> : <Entete t={tableau} cle="magasin" sx={{ minWidth: 180 }}>Magasin</Entete>}
                  {avecCoach && <Entete t={tableau} cle="coach" sx={surPC}>Coach</Entete>}
                  {colonnes.map((c) => (
                    <Entete key={c.cle} t={tableau} cle={c.cle} align="right" sx={{ whiteSpace: 'normal', minWidth: 96, verticalAlign: 'bottom' }}>
                      {c.cle === 'pctFP' ? <abbr title="Frais de personnel ÷ CA HT" style={{ textDecoration: 'none' }}>{c.libelle}</abbr> : c.libelle}
                    </Entete>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow className="ligne-forte" sx={{ '& td': { fontWeight: 700 } }}>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{filtre ? 'Total de la sélection' : 'Total du réseau'}</TableCell>
                  {avecCoach && <TableCell sx={surPC} />}
                  {colonnes.map((c) => (c.cle === 'moisRealises'
                    ? <TableCell key={c.cle} align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{total.magasins} magasin{total.magasins > 1 ? 's' : ''}</TableCell>
                    : cellule(c, valeurDe(total, c.cle), true)))}
                </TableRow>
                <TableRow sx={{ '& td': { color: 'text.secondary' } }}>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{filtre ? 'Médiane de la sélection' : 'Médiane du réseau'}</TableCell>
                  {avecCoach && <TableCell sx={surPC} />}
                  {colonnes.map((c) => ((RATIOS as string[]).includes(c.cle)
                    ? cellule(c, mediane[c.cle as CleRatio])
                    : <TableCell key={c.cle} />))}
                </TableRow>
                <LigneSansResultat t={tableau} colSpan={colonnes.length + (avecCoach ? 2 : 1)} quoi="Aucun magasin ne correspond" />
                {groupesAffiches ? groupesAffiches.map((g, k) => (
                  <TableRow key={g.cle || 'sans'} hover={!!g.cle} onClick={() => creuser(g.cle)} sx={{ cursor: g.cle ? 'pointer' : undefined }} data-groupe={g.nom}>
                    <TableCell>
                      {g.cle ? <ButtonBase onClick={(e) => { e.stopPropagation(); creuser(g.cle) }} sx={{ fontFamily: 'inherit', fontWeight: 600, fontSize: 'inherit', color: 'primary.main', minHeight: 48, textAlign: 'left' }}>{g.nom}</ButtonBase>
                        : <Typography component="span" sx={{ fontWeight: 600, fontSize: 'inherit' }}>{g.nom}</Typography>}
                    </TableCell>
                    {colonnes.map((c) => (c.cle === 'moisRealises'
                      ? <TableCell key={c.cle} align="right" sx={{ whiteSpace: 'nowrap' }}>{g.n} magasin{g.n > 1 ? 's' : ''}</TableCell>
                      : cellule(c, valeurDe(g.t, c.cle), false, null, fondDe(c.cle, k))))}
                  </TableRow>
                )) : visibles.map((m, k) => (
                  <TableRow key={m.magasin} hover onClick={() => navigate(lienMagasin(m.magasin), { state: etat })} sx={{ cursor: 'pointer' }}>
                    <TableCell>
                      <Link component={RouterLink} to={lienMagasin(m.magasin)} state={etat} onClick={(e) => e.stopPropagation()} sx={{ fontWeight: 600, display: 'inline-flex', minHeight: 48, alignItems: 'center' }}>{m.magasin}</Link>
                    </TableCell>
                    {avecCoach && <TableCell sx={{ whiteSpace: 'nowrap', ...surPC }}>{m.coach}</TableCell>}
                    {colonnes.map((c) => (c.cle === 'moisRealises'
                      ? cellule(c, m.moisRealises || null)
                      : cellule(c, valeurDe(m, c.cle), false, m.etatStock, fondDe(c.cle, k))))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

    </>
  )

  return (
    <Box>
      {entete}
      <Box className="pas-a-l-impression">
        <RechercheFiltres recherche={champRecherche} actifs={nbFiltres - ecarts.length} actions={<>
          {!telephone && choixVue}
          <BoutonPresenter onClick={() => setPresenter(true)} />
          <BoutonOutil libelle="Exporter en Excel" icone={<FileDownloadOutlined />} onClick={exporter} />
          {!telephone && <BoutonOutil libelle="Imprimer" icone={<PrintOutlined />} onClick={() => window.print()} />}
        </>}>
          {donnees.groupes.length > 0 && <FiltreMenu libelle="Groupe" choisis={groupes.map(String)} onChange={(l) => filtrer('groupe', l)}
            options={donnees.groupes.map((g) => ({ valeur: String(g.id), libelle: g.nom }))} />}
          {/* Lot 41 (proposition 6) : les filtres (Coach, RR, groupe) s'appliquent aussi aux magasins à appeler */}
          {donnees.coachs.length > 1 && <FiltreMenu libelle="Coach" choisis={coachs} onChange={(l) => filtrer('coach', l)}
            options={donnees.coachs.map((c) => { const x = parCoachTous.get(c); return { valeur: c, libelle: c, detail: x ? `${x.magasins} magasin${x.magasins > 1 ? 's' : ''}${x.aSuivre ? `, ${x.aSuivre} à suivre` : ''}` : undefined } })} />}
          {donnees.rrs.length > 1 && <FiltreMenu libelle="Responsable Régional" choisis={rrs} onChange={(l) => filtrer('rr', l)}
            options={donnees.rrs.map((r) => ({ valeur: r, libelle: r }))} />}
          {(nbFiltres > 0 || recherche) && <ButtonBase onClick={() => changer({ groupe: null, coach: null, rr: null, ecart: null, q: null })}
            sx={{ minHeight: { xs: 48, md: 36 }, px: 1, borderRadius: 2, fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', color: 'primary.main' }}>Retirer les filtres</ButtonBase>}
        </RechercheFiltres>
      </Box>

      {presenter ? (
        <Presentation titre={integre ? 'Face au budget' : `Suivi ${annee}`} periode={selection} lecture={lecture} fermer={() => setPresenter(false)}>{corps}</Presentation>
      ) : corps}

      {/* Sous le tableau : les causes données par les magasins (vague 6, 77A) et les magasins à appeler (lot 30, E3) */}
      <Box sx={{ mt: 4 }}><CausesEcartsReseau annee={annee} /></Box>
      <Box className="pas-a-l-impression">
        <MaSemaine
          lignes={maSemaine(visibles.filter((m) => m.moisRealises > 0 || donnees.alertes.some((a) => a.magasin === m.magasin)), donnees.alertes, donnees.actions, aujourdhui)}
          avecCoachs={donnees.coachs.length > 0} etat={etat} revue={(profil?.role === 'rr' || profil?.role === 'directeur') && !profil.apercu}
        />
      </Box>
    </Box>
  )
}
