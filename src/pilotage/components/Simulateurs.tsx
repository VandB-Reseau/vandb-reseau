import { Children, isValidElement, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useReseauSiDispo } from '../../data/ReseauContext'
import { chiffresDuMagasin } from '../../data/chiffres'
import IconButton from '@mui/material/IconButton'
import RemoveOutlined from '@mui/icons-material/RemoveOutlined'
import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined'
import DeleteSweepOutlined from '@mui/icons-material/DeleteSweepOutlined'
import Chip from '@mui/material/Chip'
import Autocomplete from '@mui/material/Autocomplete'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import { equipementsDu, tireusesDu } from '../../data/equipements'
import { actionsDuMagasin } from '../../data/actions'
import { DialogPriorite, type PrioriteProposee } from '../../components/PlanAction'
import { ecartMesure, indicateursMesure, placesLibres } from '../../data/planAction'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Checkbox from '@mui/material/Checkbox'
import GlobalStyles from '@mui/material/GlobalStyles'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined'
import AddShoppingCartOutlined from '@mui/icons-material/AddShoppingCartOutlined'
import BookmarkAddOutlined from '@mui/icons-material/BookmarkAddOutlined'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CalculateOutlined from '@mui/icons-material/CalculateOutlined'
import CelebrationOutlined from '@mui/icons-material/CelebrationOutlined'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined'
import SportsBarOutlined from '@mui/icons-material/SportsBarOutlined'
import WarehouseOutlined from '@mui/icons-material/WarehouseOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import FlagOutlined from '@mui/icons-material/FlagOutlined'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import PlaylistAddCheckOutlined from '@mui/icons-material/PlaylistAddCheckOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined'
import PersonAddOutlined from '@mui/icons-material/PersonAddOutlined'
import BusinessCenterOutlined from '@mui/icons-material/BusinessCenterOutlined'
import PlaylistAddOutlined from '@mui/icons-material/PlaylistAddOutlined'
import ReplayOutlined from '@mui/icons-material/ReplayOutlined'
import SellOutlined from '@mui/icons-material/SellOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { Aide } from './Aide'
import { ChampMontant } from './ChampMontant'
import { ChampTaux } from './ChampTaux'
import { EtatVide } from './EtatVide'
import { Indicateur } from './Indicateur'
import { useAuth } from '../auth/AuthContext'
import { chargerSimulations, garderSimulation, retirerSimulation, SimulationPasEncoreGardable, type SimulationGardee, type TypeSimulation } from '../data/pilotage'
import { categorieLibelle, coutHoraireEquipe, coutHoraireSmic, type Categorie } from '../moteur/equipe'
import {
  analyserRemises, caCorner, LIGNES_EVENEMENT, LIGNES_REMISES, margeMix, parametresSimulateurs, resteAFaire, simulerAchat, simulerCoupDur, simulerEmbauche,
  simulerInvestissement, simulerPrimes, simulerPrix, simulerSoiree, simulerSoireeAnimee, simulerVenteAdditionnelle, tempsFortDeSoiree,
  type CleRemise, type CoupDur, type LigneEvenement, type LigneMix, type Mouvement, type PalierPrime,
} from '../moteur/simulateurs'
import {
  auditPression, cartePression, margeFut, coutComposition, coutContrats, margePourPrix, nouveauBec, palierExterieur, prixLivraisonGrille, prixPourMarge,
  gainsSelonFuts, simulerExterieur, simulerHeuresSup, simulerOuverture, simulerParc, simulerProspection, simulerRemisesB2B, unitaireB2B, cibleProductivite, TAUX_MECENAT, type AlerteB2B, type Bec, type Composant, type LigneB2B, type PalierRemise,
} from '../moteur/boiteOutils'
import { baseCaisse, budgetSurCaisse, meilleursLeviers, type CleLevier } from '../moteur/leviers'
import type { AjustementCA, Budget, Emprunt, Hypotheses, Investissement, ParametresReseau, TempsFort, Univers } from '../moteur/types'
import { dateHeure, ecartMontant, ecartPts, montant, MOIS_LONGS, panier as centimes, tauxCourt as taux } from '../lib/format'
import type { SujetAide } from '../lib/aide'
import { LISTE_SIMULATEURS } from '../lib/listeSimulateurs'

// Simulateurs du franchisé (choix 125 à 135, Joseph 13/11/2026) : une puce « Simulateurs » dans les chiffres du magasin,
// pour le franchisé comme pour le Coach (on simule à deux en visite). Une carte par question ; rien n'est enregistré tant
// qu'on ne « garde » pas (126) ; « Mettre dans mon budget » reporte une soirée ou un investissement dans le budget tant
// qu'il n'est pas validé. Tous les calculs sont dans moteur/simulateurs.

export interface AjoutBudget { tempsForts?: TempsFort[]; investissements?: Investissement[]; emprunts?: Emprunt[]; ajustementsCA?: AjustementCA[] }

// gardable : faux tant que la base du pilotage ne connaît pas le type (« Mon meilleur levier » se garde en priorité, 184)
const DETAILS: Record<TypeSimulation, { icone: ReactNode; aide: SujetAide; budget: boolean; gardable?: false }> = {
  levier: { icone: <TrendingUpOutlined />, aide: 'simLevier', budget: true, gardable: false },
  embauche: { icone: <PersonAddOutlined />, aide: 'simEmbauche', budget: true },
  prix: { icone: <SellOutlined />, aide: 'simPrix', budget: false },
  tresorerie: { icone: <AccountBalanceWalletOutlined />, aide: 'simTresorerie', budget: true },
  vente_additionnelle: { icone: <AddShoppingCartOutlined />, aide: 'simVente', budget: true },
  reste_a_faire: { icone: <FlagOutlined />, aide: 'simReste', budget: true },
  soiree: { icone: <CelebrationOutlined />, aide: 'simSoiree', budget: false },
  achat: { icone: <Inventory2Outlined />, aide: 'simAchat', budget: false },
  investissement: { icone: <StorefrontOutlined />, aide: 'simInvestissement', budget: false },
  exterieur: { icone: <LocalShippingOutlined />, aide: 'simExterieur', budget: false },
  tireuses: { icone: <WarehouseOutlined />, aide: 'simTireuses', budget: false },
  pression: { icone: <SportsBarOutlined />, aide: 'simPression', budget: false },
  calculette: { icone: <CalculateOutlined />, aide: 'simCalculette', budget: false },
  ouverture: { icone: <EventAvailableOutlined />, aide: 'simOuverture', budget: false },
  remises_b2b: { icone: <BusinessCenterOutlined />, aide: 'simRemisesB2B', budget: false },
}
const SIMULATEURS = LISTE_SIMULATEURS.map((x) => ({ ...x, ...DETAILS[x.cle] }))

// 188 (Joseph, 15/11/2026) : les simulateurs rangés en 4 familles, en boutons compacts ; les 3 derniers utilisés en tête
type Famille = 'vendre' | 'evenements' | 'equipe' | 'investir'
const FAMILLES: [Famille, string][] = [['vendre', 'Vendre plus'], ['evenements', 'Événements et extérieur'], ['equipe', 'Équipe'], ['investir', 'Investir et trésorerie']]
const FAMILLE_DE: Record<TypeSimulation, Famille> = {
  levier: 'vendre', vente_additionnelle: 'vendre', reste_a_faire: 'vendre', prix: 'vendre', calculette: 'vendre',
  soiree: 'evenements', exterieur: 'evenements', tireuses: 'evenements', pression: 'evenements', remises_b2b: 'evenements', // Joseph 16/11 : avec le marché extérieur
  embauche: 'equipe', ouverture: 'equipe',
  investissement: 'investir', achat: 'investir', tresorerie: 'investir',
}
// Mémoire du navigateur (derniers simulateurs, brouillons) : jamais indispensable, toute erreur est ignorée
function lire<T>(cle: string): T | null { try { const t = localStorage.getItem(cle); return t ? JSON.parse(t) as T : null } catch { return null } }
function ecrire(cle: string, v: unknown) { try { if (v === null) localStorage.removeItem(cle); else localStorage.setItem(cle, JSON.stringify(v)) } catch { /* navigateur sans mémoire */ } }
const CLE_RECENTS = 'simulateurs-recents'
const cleBrouillon = (magasin: string) => `simulateurs-brouillon:${magasin}`

// 192 : chiffres clés d'une simulation, relevés sur ses cartes de résultat pour la comparer à d'autres
type IndicateurGarde = { libelle: string; valeur: string }
function indicateursDe(n: ReactNode, l: IndicateurGarde[] = []): IndicateurGarde[] {
  Children.forEach(n, (x) => {
    if (!isValidElement(x)) return
    const p = x.props as { libelle?: unknown; valeur?: unknown; children?: ReactNode }
    if (x.type === Indicateur && typeof p.libelle === 'string' && typeof p.valeur === 'string') l.push({ libelle: p.libelle, valeur: p.valeur })
    else if (p.children) indicateursDe(p.children, l)
  })
  return l
}
// 192 · Comparer 2 ou 3 simulations gardées : résumé et chiffres clés côte à côte (union des chiffres, dans l'ordre)
function Comparaison({ simulations }: { simulations: SimulationGardee[] }) {
  const ind = simulations.map((g) => (Array.isArray(g.donnees._indicateurs) ? g.donnees._indicateurs as IndicateurGarde[] : []))
  const libelles = [...new Set(ind.flat().map((x) => x.libelle))]
  const cellule = { verticalAlign: 'top', fontVariantNumeric: 'tabular-nums', minWidth: 180 }
  return (
    <Card component="section" aria-label="Comparaison des simulations" sx={{ borderRadius: '12px', overflowX: 'auto' }}>
      <Table size="small" aria-label="Simulations comparées" sx={{ minWidth: 200 + 200 * simulations.length }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 200 }} />
            {simulations.map((g) => <TableCell key={g.id} sx={{ ...cellule, fontWeight: 700 }}>{g.nom}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell component="th" scope="row">Simulateur</TableCell>
            {simulations.map((g) => <TableCell key={g.id} sx={cellule}>{libelleSimulation(g.type)}</TableCell>)}
          </TableRow>
          <TableRow>
            <TableCell component="th" scope="row">Résultat</TableCell>
            {simulations.map((g) => <TableCell key={g.id} sx={cellule}>{g.resume || '–'}</TableCell>)}
          </TableRow>
          {libelles.map((l) => (
            <TableRow key={l}>
              <TableCell component="th" scope="row">{l}</TableCell>
              {simulations.map((g, i) => <TableCell key={g.id} sx={{ ...cellule, fontWeight: 600 }}>{ind[i].find((x) => x.libelle === l)?.valeur ?? '–'}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

// Saisies reprises d'un brouillon, d'une simulation gardée ou d'un lien : seulement les clés connues, du même type
function fusionner<T extends object>(base: T, ajout: unknown): T {
  if (!ajout || typeof ajout !== 'object') return base
  const r = { ...base } as Record<string, unknown>
  for (const [k, v] of Object.entries(ajout as Record<string, unknown>)) {
    if (!(k in r) || k.startsWith('_')) continue
    const b = r[k]
    if (b === null || v === null || typeof b === typeof v) r[k] = v
  }
  return r as T
}
const libelleSimulation = (t: TypeSimulation) => SIMULATEURS.find((s) => s.cle === t)?.titre ?? 'Simulation'

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const entier = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v)).replace(/[  ]/g, ' ')
const unChiffre = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)
const champ = { '& .MuiInputBase-root': { minHeight: 48 }, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }

// Un champ avec son libellé visible au-dessus
// 191 : source, d'où vient le chiffre prérempli (« budget », « caisse »…), affichée tant qu'il n'est pas changé
function Champ({ libelle, source, children }: { libelle: string; source?: string | false | null; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
      <Typography component="span" sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
        {libelle}
        {source && <Box component="span" className="source-chiffre" sx={{ ml: 0.75, px: 0.75, py: 0.125, borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, bgcolor: 'action.hover', color: 'text.primary', whiteSpace: 'nowrap' }}>{source}</Box>}
      </Typography>
      {children}
    </Box>
  )
}
// 195 : sur téléphone, boutons − et + autour des valeurs qu'on ajuste souvent (pas : l'écart d'un appui)
function Pas({ valeur, pas, min = 0, onChange, children }: { valeur: number; pas?: number; min?: number; onChange: (v: number) => void; children: ReactNode }) {
  if (!pas) return <>{children}</>
  const arrondi = (v: number) => Math.round(v * 100) / 100
  const bouton = { display: { xs: 'inline-flex', md: 'none' }, width: 48, height: 48, border: 1, borderColor: 'divider', borderRadius: '10px' }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <IconButton aria-label="Diminuer" onClick={() => onChange(Math.max(min, arrondi(valeur - pas)))} sx={bouton}><RemoveOutlined /></IconButton>
      {children}
      <IconButton aria-label="Augmenter" onClick={() => onChange(arrondi(valeur + pas))} sx={bouton}><AddOutlined /></IconButton>
    </Box>
  )
}
const Montant = ({ libelle, valeur, onChange, unite = '€', source, pas, min }: { libelle: string; valeur: number; onChange: (v: number) => void; unite?: string; source?: string | false | null; pas?: number; min?: number }) => (
  <Champ libelle={libelle} source={source}><Pas valeur={valeur} pas={pas} min={min} onChange={onChange}><ChampMontant libelle={libelle} valeur={valeur} onChange={onChange} unite={unite} largeur={pas ? 110 : 150} /></Pas></Champ>
)
const Taux = ({ libelle, valeur, onChange, source }: { libelle: string; valeur: number; onChange: (v: number) => void; source?: string | false | null }) => (
  <Champ libelle={libelle} source={source}><ChampTaux libelle={libelle} valeur={valeur} onChange={(v) => onChange(v ?? 0)} largeur={130} pas={0.01} /></Champ>
)
function ChoixMois({ libelle, valeur, onChange }: { libelle: string; valeur: number; onChange: (v: number) => void }) {
  return (
    <Champ libelle={libelle}>
      <TextField select size="small" value={valeur} onChange={(e) => onChange(Number(e.target.value))} slotProps={{ htmlInput: { 'aria-label': libelle } }} sx={{ ...champ, width: 150 }}>
        {MOIS_LONGS.map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
      </TextField>
    </Champ>
  )
}
function Choix<T extends string>({ libelle, valeur, onChange, options }: { libelle: string; valeur: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <Champ libelle={libelle}>
      <ToggleButtonGroup exclusive size="small" value={valeur} onChange={(_, v: T | null) => v && onChange(v)} aria-label={libelle} sx={{ flexWrap: 'wrap' }}>
        {options.map(([v, l]) => <ToggleButton key={v} value={v} sx={{ minHeight: 48, px: 2 }}>{l}</ToggleButton>)}
      </ToggleButtonGroup>
    </Champ>
  )
}
// Variante dont le nom lu par le lecteur d'écran précise la ligne (« Prix du fût HT, bec 2 »)
const MontantDe = ({ libelle, aria, valeur, onChange, unite = '€', largeur = 130 }: { libelle: string; aria: string; valeur: number; onChange: (v: number) => void; unite?: string; largeur?: number }) => (
  <Champ libelle={libelle}><ChampMontant libelle={aria} valeur={valeur} onChange={onChange} unite={unite} largeur={largeur} /></Champ>
)
const TauxDe = ({ libelle, aria, valeur, onChange }: { libelle: string; aria: string; valeur: number; onChange: (v: number) => void }) => (
  <Champ libelle={libelle}><ChampTaux libelle={aria} valeur={valeur} onChange={(v) => onChange(v ?? 0)} largeur={120} pas={0.01} /></Champ>
)
const Texte = ({ libelle, aria = libelle, valeur, onChange, largeur = 200 }: { libelle: string; aria?: string; valeur: string; onChange: (v: string) => void; largeur?: number }) => (
  <Champ libelle={libelle}><TextField size="small" value={valeur} onChange={(x) => onChange(x.target.value)} slotProps={{ htmlInput: { 'aria-label': aria, maxLength: 60 } }} sx={{ ...champ, width: largeur }} /></Champ>
)
const Saisies = ({ children }: { children: ReactNode }) => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>{children}</Box>
const Resultats = ({ children }: { children: ReactNode }) => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>{children}</Box>
// Un bloc de saisies encadré, avec son sous-total à droite du titre (Joseph, 15/11/2026 : « on se repère mal dans les cases »).
// Ordre des simulateurs d'événement : recettes, puis coûts, puis le compte qui mène au résultat.
function Bloc({ titre, total, children }: { titre: string; total?: { libelle: string; valeur: string; negatif?: boolean }; children: ReactNode }) {
  return (
    <Box component="section" aria-label={titre} sx={{ border: 1, borderColor: 'divider', borderRadius: '12px', p: { xs: 1.5, md: 2 }, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5, minWidth: 0 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 2, rowGap: 0.5 }}>
        <Typography component="h3" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }}>{titre}</Typography>
        {total && <Typography className="sous-total" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          <Box component="span" sx={{ color: 'text.secondary', mr: 1 }}>{total.libelle}</Box>
          <Box component="span" sx={{ fontWeight: 700, color: total.negatif ? 'error.main' : 'text.primary' }}>{total.valeur}</Box>
        </Typography>}
      </Box>
      {children}
    </Box>
  )
}
// Le compte du simulateur, du chiffre d'affaires au résultat : une ligne par bloc, le total en gras (en tête du bloc Résultat)
function Compte({ titre, lignes, total }: { titre: string; lignes: { libelle: string; valeur: number; detail?: string }[]; total: { libelle: string; valeur: number } }) {
  const ligne = (libelle: string, valeur: number, detail: string | undefined, fort: boolean) => (
    <Box key={libelle} role="row" sx={{ display: 'flex', alignItems: 'baseline', gap: 2, py: 0.5, ...(fort ? { borderTop: 1, borderColor: 'divider', mt: 0.5, pt: 1 } : {}) }}>
      <Typography role="cell" sx={{ flex: 1, minWidth: 0, fontWeight: fort ? 700 : undefined }}>
        {libelle}{detail && <Box component="span" sx={{ color: 'text.secondary', ml: 1, fontSize: '0.875rem' }}>{detail}</Box>}
      </Typography>
      <Typography role="cell" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: fort ? 700 : undefined, color: fort && valeur < 0 ? 'error.main' : undefined }}>
        {valeur < 0 ? '− ' : fort ? '' : '+ '}{montant(Math.abs(valeur))}
      </Typography>
    </Box>
  )
  return (
    <Box role="table" aria-label={titre} sx={{ maxWidth: 560 }}>
      {lignes.filter((l, i) => i === 0 || Math.abs(l.valeur) >= 0.5).map((l) => ligne(l.libelle, l.valeur, l.detail, false))}
      {ligne(total.libelle, total.valeur, undefined, true)}
    </Box>
  )
}
const ecart = (v: number, favorable = v >= 0) => ({ texte: ecartMontant(v), hausse: v >= 0, favorable })

// État de chaque simulateur : ses saisies, gardées telles quelles avec une simulation (« Rouvrir » les reprend)
type Etats = {
  levier: { ticketsJour: number; panier: number; points: number; heures: number; jours: number; coutHoraire: number; modeHeure: ModeHeure; partSmic: number; base: BaseChiffres }
  embauche: {
    mouvement: Mouvement['type'] | 'primes' | 'heures_sup'; poste: string; categorie: Categorie; heures: number; brut: number; mois: number; index: number; nouvellesHeures: number
    heuresMois: number; heuresSup: number; majorationSup: number; coutHoraire: number; modeHeure: ModeHeure; partSmic: number // 242 · heures sup
    salaries: number; partReversee: number; paliers: PalierPrime[] // 164 · primes
  }
  prix: { type: 'remise' | 'hausse' | 'remises'; taux: number; marge: number; cartons: number; mois: number; ca: number | null; montants: Record<CleRemise, number> }
  tresorerie: { baisse: boolean; tauxBaisse: number; de: number; a: number; depense: boolean; montantDepense: number; moisDepense: number; retard: boolean; montantRetard: number; moisRetard: number; duree: number }
  vente_additionnelle: { univers: 'cave' | 'bar'; unSur: number; prix: number; marge: number | null; base: BaseChiffres }
  reste_a_faire: { mois: number; jour: number; realise: number }
  soiree: {
    nom: string; mois: number; univers: Univers; prix: number; participants: number; marge: number | null; couts: number; extras: number
    formule: 'billet' | 'animee'; caNormal: number; caSoir: number                // 241 · soirée animée sans billet
    achats: boolean; part: number; panier: number; bon: boolean                    // 152 · achats des participants
    lignes: Record<Exclude<LigneEvenement, 'divers'>, number>                     // 153 · coûts détaillés (Divers : « couts »)
    personnes: number; heuresEquipe: number; coutHoraire: number; majoration: number; modeHeure: ModeHeure; partSmic: number // 153 · heures de l'équipe en place
  }
  achat: { montant: number; remise: number; mois: number; invendu: number; taux: number }
  exterieur: {
    nom: string; futs: number; dureeContrat: number; prixVente: number; remise: number; prixAchat: number; co2: number; nbGobelets: number; prixGobelet: number
    tireuse: 'neuve' | 'parc'; prixTireuse: number; duree: number; entretien: number
    livraisons: number; km: number; prixKm: number; heures: number; coutHoraire: number; modeHeure: ModeHeure; partSmic: number
    don: 'aucun' | 'argent' | 'nature'; montantDon: number; futsDon: number; cerfa: boolean
    prixLivraison: number | null; sponsoring: boolean; sponsoMontant: number; sponsoParFut: number; materiel: number; astreinte: number; locations: number; prixLocation: number // 154, 162
  }
  tireuses: {
    tireuses: number; semaines: number; sortiesSaison: number; sortiesHors: number; refus: number; futsParSortie: number; prixVente: number | null; prixAchat: number | null; prixNeuve: number; duree: number; entretien: number; vieilles: { nom: string; age: number; reparations: number }[]
    saisie: 'occupation' | 'sorties'; occSaison: number; occHors: number // 155 · week-ends loués
  }
  pression: {
    becs: Bec[]; projet: boolean; mode: 'ajouter' | 'remplacer'; remplace: number; cout: number; cannibalisation: number; nouveau: Bec
    vue: 'carte' | 'audit'; audit: { futs: number; litres: number; prixFut: number; demis: number; verres33: number; pintes: number; litres1L: number; offerts: number; caHT: number; caTTC?: number; standard?: number | null } // 161 (standard absent ou null : perte standard réglée par le siège) (caTTC : simulations gardées avant le CA en HT)
  }
  calculette: { nom: string; composants: Composant[]; tva: 'normale' | 'intermediaire' | 'reduite'; mode: 'prix' | 'marge' | 'mix'; marge: number; prixTTC: number; famille: string; mix: LigneMix[] }
  ouverture: { jour: 'dimanche' | 'ferie'; caBar: number; caCave: number; margeBar: number | null; margeCave: number | null; report: number; heures: number; coutHoraire: number; modeHeure: ModeHeure; partSmic: number; frais: number }
  remises_b2b: {
    client: string; mode: 'famille' | 'produit'; plancher: number; paliers: PalierRemise[]; familles: LigneB2B[]; produits: LigneB2B[]
    // 238 · démarcher d'autres entreprises (marge null : celle de la commande simulée)
    prospection: boolean; heuresSemaine: number; semaines: number; entreprises: number; ticket: number; margeProspection: number | null
    coutHoraire: number; modeHeure: ModeHeure; partSmic: number
  }
  investissement: { modele: 'libre' | 'corner' | 'exterieur'; objectifExterieur: number; camion: boolean; libelle: string; cout: number; duree: number; mois: number; ca: number; metres: number; marge: number; demarque: number; charges: number; financement: 'tresorerie' | 'pret'; tauxPret: number; dureePret: number; univers: Univers }
}

// Coût d'une heure chargée des simulateurs (Joseph, 14/11/2026) : moyenne de l'équipe du magasin par défaut (repère du
// siège si l'équipe n'est pas saisie), ou une part du SMIC, ou un montant libre.
type ModeHeure = 'equipe' | 'smic' | 'libre'
// 191 : tickets et panier lus en caisse (12 derniers mois clos) ou visés au budget
type BaseChiffres = 'caisse' | 'budget'
const HEURE = { modeHeure: 'equipe' as ModeHeure, partSmic: 1.2 }
// Ni équipe saisie ni repère du siège : 120 % du SMIC, pour ne jamais compter une heure à 0 € (Joseph, 14/11/2026)
const PART_SMIC_DEFAUT = 1.2
function CoutHeure({ e, valeur, equipeSaisie, repere, onChange }: {
  e: { modeHeure: ModeHeure; partSmic: number; coutHoraire: number }; valeur: number; equipeSaisie: boolean; repere?: boolean
  onChange: (v: Partial<{ modeHeure: ModeHeure; partSmic: number; coutHoraire: number }>) => void
}) {
  return <>
    <Choix libelle="Coût horaire" valeur={e.modeHeure} onChange={(modeHeure) => onChange({ modeHeure })} options={[['equipe', 'Moyenne de l’équipe'], ['smic', 'En part du SMIC'], ['libre', 'Montant libre']]} />
    {e.modeHeure === 'smic' && <Taux libelle="Part du SMIC brut" valeur={e.partSmic} onChange={(partSmic) => onChange({ partSmic })} />}
    {e.modeHeure === 'libre' && <Montant libelle="Coût d’une heure chargée" valeur={e.coutHoraire} onChange={(coutHoraire) => onChange({ coutHoraire })} />}
    {e.modeHeure !== 'libre' && <Typography color="text.secondary" sx={{ alignSelf: 'center' }}>
      {centimes(valeur)} l’heure chargée{e.modeHeure === 'smic' ? '' : equipeSaisie ? ', moyenne de l’équipe' : repere === false ? ', 120 % du SMIC (équipe et repère du siège pas saisis)' : ', repère du siège (équipe pas saisie)'}
    </Typography>}
  </>
}

// 191 : le levier et la vente additionnelle partent de la caisse (12 derniers mois clos) ou du budget
const moisCourt = (m: string) => { const [a, mm] = m.split('-').map(Number); return `${MOIS_LONGS[mm - 1]} ${a}` }
function BaseDesChiffres({ valeur, annee, caisse, onChange }: { valeur: BaseChiffres; annee: number; caisse: { de: string; a: string }; onChange: (v: BaseChiffres) => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Choix libelle="Tickets et panier" valeur={valeur} onChange={onChange} options={[['caisse', 'Caisse, 12 derniers mois'], ['budget', `Budget ${annee}`]]} />
      {valeur === 'caisse' && <Typography color="text.secondary" sx={{ fontSize: '0.8125rem' }}>De {moisCourt(caisse.de)} à {moisCourt(caisse.a)}</Typography>}
    </Box>
  )
}

function margeUnivers(b: Budget | null, u: Univers): number | null {
  const f = b?.familles.filter((x) => x.univers === u) ?? []
  const ca = somme(f.map((x) => x.objectif))
  return ca > 0 ? Math.round(somme(f.map((x) => x.margeObjectif)) / ca * 100) / 100 : null
}

// Exemple chiffré de chaque simulateur (Joseph, 15/11/2026).
// Réalisé du mois en cours jusqu'à hier, en exemple : 95 % du rythme du budget
function exempleRealise(b: Budget | null, aujourdhui: Date): number {
  const budget = b?.mois[aujourdhui.getMonth()]?.ca ?? 0
  const fin = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + 1, 0).getDate()
  return Math.round(budget * (aujourdhui.getDate() - 1) / fin * 0.95 / 100) * 100
}

// « Effacer » (Joseph, 15/11/2026) : les saisies passent à zéro et les textes à blanc ; restent les choix (mois, modes),
// les réglages du siège et du magasin, et ce qui servirait de diviseur. Une liste garde une ligne vide.
const GARDES_AU_VIDE = new Set(['mois', 'moisDepense', 'moisRetard', 'de', 'a', 'jour', 'jours', 'index', 'salaries', 'coutHoraire', 'partSmic', 'majoration',
  'duree', 'dureePret', 'tauxPret', 'co2', 'prixKm', 'entretien', 'semaines', 'occSaison', 'occHors', 'litres', 'quantite', 'unSur', 'prix.marge', 'achat.taux', 'calculette.marge',
  'remises_b2b.paliers', 'remises_b2b.plancher', 'majorationSup'])
const TEXTES_AU_VIDE = new Set(['nom', 'poste', 'libelle', 'biere', 'client'])
function vider(v: unknown, cle: string, sim: string): unknown {
  if (GARDES_AU_VIDE.has(cle) || GARDES_AU_VIDE.has(`${sim}.${cle}`)) return v
  if (typeof v === 'number') return 0
  if (typeof v === 'string') return TEXTES_AU_VIDE.has(cle) ? '' : v
  if (Array.isArray(v)) {
    if (cle === 'vieilles' || !v.length) return []
    // 228 : les familles d'une commande gardent leur nom, sans chiffres
    if (sim === 'remises_b2b' && cle === 'familles') return v.map((x: LigneB2B) => ({ ...(vider(x, '', sim) as LigneB2B), libelle: x.libelle }))
    return [vider(v[0], '', sim)]
  }
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, vider(x, k, sim)]))
  return v
}
const etatVide = <K extends TypeSimulation>(k: K, e: Etats[K]): Etats[K] => vider(e, '', k) as Etats[K]

// tireusesParc : tireuses saisies dans les équipements du magasin (Joseph, 14/11/2026)
function etatsInitiaux(b: Budget | null, h: Hypotheses | null, p: ParametresReseau, aujourdhui: Date, tireusesParc: number | null = null): Etats {
  const annee = h?.annee ?? aujourdhui.getFullYear()
  const moisSuivant = annee === aujourdhui.getFullYear() ? Math.min(12, aujourdhui.getMonth() + 2) : 1
  const s = parametresSimulateurs(p)
  return {
    levier: { ticketsJour: 1, panier: 0.5, points: 1, heures: 2, jours: 307, coutHoraire: s.coutHoraire, ...HEURE, base: 'caisse' },
    embauche: {
      mouvement: 'embauche', poste: 'Vendeur', categorie: 'employe', heures: 35, brut: Math.round(p.charges.reduction.smicAnnuel / 12), mois: moisSuivant, index: 0, nouvellesHeures: 28,
      salaries: Math.max(1, h?.equipe?.filter((x) => x.categorie !== 'gerant_tns').length || 2), partReversee: 0,
      paliers: [{ progression: 0.05, prime: 150, primeGerant: 0 }, { progression: 0.1, prime: 200, primeGerant: 0 }, { progression: 0.15, prime: 250, primeGerant: 0 }],
      heuresMois: 600, heuresSup: 30, majorationSup: 0.25, coutHoraire: s.coutHoraire, ...HEURE,
    },
    prix: { type: 'remise', taux: 0.1, marge: b && b.ca > 0 ? Math.round(b.tauxMarge * 100) / 100 : 0.35, cartons: 0, mois: 12, ca: null, montants: { offerts: 0, persos: 0, prixSpeciaux: 0, remises: 0, fidelite: 0 } },
    tresorerie: { baisse: true, tauxBaisse: 0.15, de: 1, a: 3, depense: false, montantDepense: 10_000, moisDepense: 6, retard: false, montantRetard: 5_000, moisRetard: 7, duree: 2 },
    vente_additionnelle: { univers: b?.flux.cave?.objectif ? 'cave' : 'bar', unSur: 10, prix: 12, marge: null, base: 'caisse' },
    reste_a_faire: { mois: aujourdhui.getMonth() + 1, jour: aujourdhui.getDate(), realise: exempleRealise(b, aujourdhui) },
    soiree: {
      nom: 'Soirée dégustation', mois: 12, univers: 'bar', prix: 25, participants: 30, marge: null, couts: 0, extras: 150,
      formule: 'billet', caNormal: 1_500, caSoir: 3_500,
      achats: true, part: 0.3, panier: 40, bon: false,
      lignes: { produits: 0, securite: 0, deco: 50, animation: 150, communication: 0, location: 0 },
      personnes: 0, heuresEquipe: 3, coutHoraire: s.coutHoraire, majoration: 0.25, ...HEURE,
    },
    achat: { montant: 10_000, remise: 0.1, mois: 4, invendu: 0.05, taux: s.tauxDecouvert },
    exterieur: {
      nom: 'Fête du village', futs: 40, dureeContrat: 3, prixVente: 70, remise: 0, prixAchat: 42, co2: s.exterieur.co2ParFut, nbGobelets: 500, prixGobelet: 0.25,
      tireuse: 'neuve', prixTireuse: 1_500, duree: s.exterieur.dureeTireuse || 5, entretien: s.exterieur.entretienTireuse,
      livraisons: 10, km: 30, prixKm: s.exterieur.prixKm, heures: 1.5, coutHoraire: s.coutHoraire, ...HEURE, don: 'aucun', montantDon: 500, futsDon: 5, cerfa: true,
      prixLivraison: null, sponsoring: false, sponsoMontant: 0, sponsoParFut: 0, materiel: 0, astreinte: 0, locations: 0, prixLocation: 0,
    },
    tireuses: {
      tireuses: tireusesParc ?? 2, semaines: s.tireuses.semainesSaison, sortiesSaison: 30, sortiesHors: 8, refus: 0, futsParSortie: 2, prixVente: null, prixAchat: null, prixNeuve: 1_500, duree: s.exterieur.dureeTireuse || 5, entretien: s.exterieur.entretienTireuse, vieilles: [],
      saisie: 'occupation', occSaison: s.tireuses.occupationSaison, occHors: s.tireuses.occupationHors,
    },
    pression: {
      becs: [{ biere: 'Blonde', prixFut: 90, litres: 30, perte: 0.1, prixDemi: 4.2, prixPinte: 7.8, demis: 80, pintes: 30 }],
      projet: false, mode: 'ajouter', remplace: 0, cout: 500, cannibalisation: 0.5,
      nouveau: { biere: 'Nouvelle bière', prixFut: 100, litres: 30, perte: 0.1, prixDemi: 4.5, prixPinte: 8.5, demis: 30, pintes: 10 },
      vue: 'carte', audit: { futs: 6, litres: 30, prixFut: 90, demis: 400, verres33: 0, pintes: 120, litres1L: 0, offerts: 4, caHT: 2_170, standard: null },
    },
    calculette: {
      nom: 'Planche mixte', composants: [{ libelle: 'Charcuterie', cout: 3, quantite: 1 }, { libelle: 'Fromage', cout: 2.5, quantite: 1 }], tva: 'intermediaire', mode: 'prix', marge: 0.7, prixTTC: 18, famille: '',
      mix: [{ libelle: 'Bouteille de vin', cout: 6, consigne: 0, prixTTC: 15, quantite: 1 }, { libelle: 'Coffret bois', cout: 3, consigne: 0, prixTTC: 8, quantite: 1 }],
    },
    ouverture: { jour: 'dimanche', caBar: 800, caCave: 1_200, margeBar: null, margeCave: null, report: 0.2, heures: 14, coutHoraire: s.coutHoraire, ...HEURE, frais: 0 },
    // 228 : l'exemple du fichier de Joseph (paliers, plancher 25 %, prix fictifs)
    remises_b2b: {
      client: 'Comité d’entreprise', mode: 'famille', plancher: 0.25,
      paliers: [{ min: 0, remise: 0 }, { min: 50, remise: 0.05 }, { min: 100, remise: 0.08 }, { min: 200, remise: 0.1 }, { min: 500, remise: 0.12 }, { min: 1000, remise: 0.15 }],
      familles: [
        // % de marge sur le prix HT avant remise, arrondis depuis les achats du fichier (6,05 € ; 11,55 € ; 24,88 € ; 19,25 €)
        { libelle: 'Vin', quantite: 50, prixTTC: 12.2, achatHT: 0, taux: 0.4 }, { libelle: 'Effervescent', quantite: 20, prixTTC: 21.95, achatHT: 0, taux: 0.37 },
        { libelle: 'Spiritueux', quantite: 20, prixTTC: 40.4, achatHT: 0, taux: 0.26 }, { libelle: 'Bourriche', quantite: 10, prixTTC: 34.9, achatHT: 0, taux: 0.34 },
      ],
      produits: [
        { libelle: 'Côtes du Rhône rouge 75 cl', quantite: 30, prixTTC: 8.9, achatHT: 4.2 }, { libelle: 'Crémant de Loire brut 75 cl', quantite: 20, prixTTC: 11.9, achatHT: 5.6 },
        { libelle: 'Champagne brut 75 cl', quantite: 10, prixTTC: 32, achatHT: 17.5 }, { libelle: 'Gin artisanal 70 cl', quantite: 10, prixTTC: 39.9, achatHT: 23 },
        { libelle: 'Bourriche 6 bières', quantite: 10, prixTTC: 24.9, achatHT: 13.5 },
      ],
      // 238 : l'exemple de la fiche « Rentabilité Extérieur » (3 h par semaine pendant 6 mois, 15 entreprises à 330 €)
      prospection: true, heuresSemaine: 3, semaines: 26, entreprises: 15, ticket: 330, margeProspection: null, coutHoraire: s.coutHoraire, ...HEURE,
    },
    investissement: { modele: 'libre', objectifExterieur: 100_000, camion: false, libelle: 'Tireuse', cout: 15_000, duree: 5, mois: moisSuivant, ca: 20_000, metres: 6, marge: 0.35, demarque: 0, charges: 1_000, financement: 'tresorerie', tauxPret: 0.04, dureePret: 5, univers: 'bar' },
  }
}

export function Simulateurs({ magasin, budget: b, hypotheses: h, parametres: p, depart, peutGarder, mettreAuBudget, budgetValide }: {
  magasin: string
  budget: Budget | null
  hypotheses: Hypotheses | null
  parametres: ParametresReseau
  depart: number
  peutGarder: boolean
  mettreAuBudget: ((a: AjoutBudget) => Promise<void>) | null
  budgetValide: boolean
}) {
  const { profil } = useAuth()
  const [params, setParams] = useSearchParams()
  const choisi = (SIMULATEURS.find((s) => s.cle === params.get('sim'))?.cle ?? 'levier') as TypeSimulation
  const choisir = (cle: TypeSimulation) => setParams((x) => { const n = new URLSearchParams(x); n.set('sim', cle); n.delete('pre'); return n }, { replace: true })
  // 188 : les 3 derniers simulateurs ouverts par un appui, en tête
  const [recents, setRecents] = useState<TypeSimulation[]>(() => (lire<string[]>(CLE_RECENTS) ?? []).filter((x): x is TypeSimulation => SIMULATEURS.some((y) => y.cle === x)).slice(0, 3))
  const ouvrir = (cle: TypeSimulation) => {
    choisir(cle)
    const l = [cle, ...recents.filter((x) => x !== cle)].slice(0, 3)
    setRecents(l); ecrire(CLE_RECENTS, l)
    // Sur téléphone, la carte du simulateur vient sous les doigts
    if (window.matchMedia('(max-width: 899.95px)').matches) requestAnimationFrame(() => document.getElementById('carte-simulation')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const aujourdhui = useMemo(() => new Date(), [])
  const reseauDispo = useReseauSiDispo()
  const tireusesParc = tireusesDu(equipementsDu(reseauDispo?.reseau, magasin))
  const initiaux = useMemo(() => etatsInitiaux(b, h, p, aujourdhui, tireusesParc), [b, h, p, aujourdhui, tireusesParc])
  // 190 : brouillon du navigateur, simulateur par simulateur, seulement ceux qu'on a touchés (les autres suivent le budget)
  // 194 : un lien (depuis une alerte) préremplit le simulateur ouvert (paramètre « pre »)
  const [touches, setTouches] = useState<TypeSimulation[]>(() => {
    const l = Object.keys(lire<Partial<Etats>>(cleBrouillon(magasin)) ?? {}).filter((k): k is TypeSimulation => k in initiaux)
    return params.get('pre') && !l.includes(choisi) ? [...l, choisi] : l
  })
  const [etats, setEtats] = useState<Etats>(() => {
    const e = { ...initiaux }
    const brouillon = lire<Partial<Etats>>(cleBrouillon(magasin)) ?? {}
    for (const k of Object.keys(brouillon) as TypeSimulation[]) if (k in e) (e as Record<string, unknown>)[k] = fusionner(e[k], brouillon[k])
    let pre: unknown = null
    try { pre = JSON.parse(params.get('pre') ?? 'null') } catch { pre = null }
    if (pre) (e as Record<string, unknown>)[choisi] = fusionner(e[choisi], pre)
    return e
  })
  useEffect(() => {
    if (!params.get('pre')) return
    setParams((x) => { const n = new URLSearchParams(x); n.delete('pre'); return n }, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const l = Object.fromEntries(touches.map((k) => [k, etats[k]]))
    ecrire(cleBrouillon(magasin), touches.length ? l : null)
  }, [etats, touches, magasin])
  const toucher = (k: TypeSimulation) => setTouches((t) => (t.includes(k) ? t : [...t, k]))
  const effacer = (k: TypeSimulation) => { toucher(k); setEtats((e) => ({ ...e, [k]: etatVide(k, e[k]) })) }
  const revenir = (k: TypeSimulation) => { setEtats((e) => ({ ...e, [k]: initiaux[k] })); setTouches((t) => t.filter((x) => x !== k)) }
  // 191 : tickets et panier de la caisse, 12 derniers mois clos (null : pas assez de mois)
  const caisse = useMemo(() => (reseauDispo?.reseau ? baseCaisse(chiffresDuMagasin(reseauDispo.reseau, magasin)) : null), [reseauDispo, magasin])
  const surCaisse = (base: BaseChiffres) => (b && caisse && base === 'caisse' ? budgetSurCaisse(b, caisse, p.tvaPanier) : b)
  const heureEquipe = useMemo(() => (h?.equipe?.length ? coutHoraireEquipe(h.equipe, p.charges, h.annee, h.hausseSalaires ?? 0) : null), [h, p])
  const heure = (x: { modeHeure?: ModeHeure; partSmic: number; coutHoraire: number }) =>
    x.modeHeure === 'libre' ? x.coutHoraire : x.modeHeure === 'smic' ? coutHoraireSmic(x.partSmic, p.charges) : heureEquipe ?? (parametresSimulateurs(p).coutHoraire || coutHoraireSmic(PART_SMIC_DEFAUT, p.charges))
  const maj = <K extends keyof Etats>(k: K, v: Partial<Etats[K]>) => { toucher(k); setEtats((e) => ({ ...e, [k]: { ...e[k], ...v } })) }
  const [gardees, setGardees] = useState<SimulationGardee[] | null>(null)
  const [compares, setCompares] = useState<number[]>([]) // 192 : 2 ou 3 simulations gardées côte à côte
  const comparees = compares.map((id) => gardees?.find((g) => g.id === id)).filter((g): g is SimulationGardee => !!g)
  const [nom, setNom] = useState('')
  const [message, setMessage] = useState<{ texte: string; bon: boolean } | null>(null)
  const [occupe, setOccupe] = useState(false)
  // 184 · Du simulateur à la priorité : l'équipe (pas le franchisé, pas en aperçu) pose la priorité depuis la simulation
  const [priorite, setPriorite] = useState<PrioriteProposee | null>(null)
  const reseauFiche = reseauDispo?.reseau ?? null
  const ficheMagasin = reseauFiche?.magasins.find((x) => x.nom === magasin) ?? null
  const peutPrioriser = !!reseauFiche && !!ficheMagasin && !!profil && ['directeur', 'rr', 'coach'].includes(profil.role) && !profil.apercu
  // PDF d'une simulation (Joseph, 14/11/2026) : seule la carte du simulateur s'imprime, avec le magasin et la date
  useEffect(() => {
    const fin = () => document.body.classList.remove('simulation-seule')
    window.addEventListener('afterprint', fin)
    return () => { window.removeEventListener('afterprint', fin); fin() }
  }, [])
  const enPDF = () => { document.body.classList.add('simulation-seule'); window.print() }
  const recharger = () => chargerSimulations(magasin).then(setGardees).catch(() => setGardees(null))
  useEffect(() => { void recharger() }, [magasin]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setNom(''); setMessage(null) }, [choisi])
  const s = parametresSimulateurs(p)
  const simulateur = SIMULATEURS.find((x) => x.cle === choisi)!
  const annee = h?.annee ?? aujourdhui.getFullYear()

  // ── Calcul et rendu du simulateur choisi : saisies, résultats, phrase gardée avec la simulation
  let saisies: ReactNode = null, resultats: ReactNode = null, phrase = '', nomParDefaut = simulateur.titre, ajout: AjoutBudget | null = null, note: string | null = null
  let mesure: PrioriteProposee['mesure'] = null // 184 : ce que la caisse dira chaque mois, quand le simulateur le sait
  const sansBudget = simulateur.budget && (!b || !h)
  if (!sansBudget && choisi === 'levier' && b) {
    const e = etats.levier
    const coutHeure = heure(e)
    const lignes = meilleursLeviers(surCaisse(e.base) ?? b, p, { ticketsJour: e.ticketsJour, panierTTC: e.panier, pointsMarge: e.points, heuresSemaine: e.heures, coutHeure, joursParAn: e.jours })
    const titreLigne = (c: CleLevier) => ({
      tickets_cave: `${unChiffre(e.ticketsJour)} ticket${e.ticketsJour > 1 ? 's' : ''} de plus par jour en Cave`,
      tickets_bar: `${unChiffre(e.ticketsJour)} ticket${e.ticketsJour > 1 ? 's' : ''} de plus par jour au Bar`,
      panier_cave: `${centimes(e.panier)} TTC de plus par panier en Cave`,
      panier_bar: `${centimes(e.panier)} TTC de plus par panier au Bar`,
      marge: `${unChiffre(e.points)} point${e.points >= 2 ? 's' : ''} de marge en plus`,
      heures: `${unChiffre(e.heures)} heure${e.heures >= 2 ? 's' : ''} payée${e.heures >= 2 ? 's' : ''} de moins par semaine`,
    })[c]
    saisies = (
      <Stack spacing={2}>
        <Bloc titre="1. Point de départ">
          <Saisies>
            {caisse && <BaseDesChiffres valeur={e.base} annee={annee} caisse={caisse} onChange={(base) => maj('levier', { base })} />}
            <Montant libelle="Jours d’ouverture par an" valeur={e.jours} onChange={(v) => maj('levier', { jours: Math.min(366, Math.max(1, Math.round(v))) })} unite="j" />
          </Saisies>
          <Saisies><CoutHeure e={e} valeur={coutHeure} equipeSaisie={heureEquipe !== null} repere={parametresSimulateurs(p).coutHoraire > 0} onChange={(v) => maj('levier', v)} /></Saisies>
        </Bloc>
        <Bloc titre="2. Les petits efforts à comparer">
        <Saisies>
          <Montant libelle="Tickets de plus par jour" valeur={e.ticketsJour} onChange={(v) => maj('levier', { ticketsJour: Math.max(0, v) })} unite="" pas={1} />
          <Montant libelle="Euros de plus par panier, TTC" valeur={e.panier} onChange={(v) => maj('levier', { panier: Math.max(0, v) })} pas={0.5} />
          <Montant libelle="Points de marge en plus" valeur={e.points} onChange={(v) => maj('levier', { points: Math.max(0, v) })} unite="pt" pas={0.5} />
          <Montant libelle="Heures payées de moins par semaine" valeur={e.heures} onChange={(v) => maj('levier', { heures: Math.max(0, v) })} unite="h" pas={1} />
        </Saisies>
        </Bloc>
      </Stack>
    )
    const premier = lignes[0]
    nomParDefaut = premier ? titreLigne(premier.cle) : simulateur.titre
    phrase = premier && premier.ebe > 0
      ? `Pour ${magasin}, le levier qui rapporte le plus est : ${titreLigne(premier.cle).toLowerCase()}, soit ${montant(premier.ebe)} d’EBE par an${lignes[1] ? `, devant ${titreLigne(lignes[1].cle).toLowerCase()} (${montant(lignes[1].ebe)})` : ''}.`
      : ''
    if (premier?.mesure) mesure = premier.mesure
    resultats = lignes.length ? (
      <Box component="ol" aria-label="Leviers du plus au moins rentable" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {lignes.map((l, i) => (
          <Box component="li" key={l.cle} aria-label={`${i + 1}. ${titreLigne(l.cle)}`} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', py: 1.25, borderTop: i ? 1 : 0, borderColor: 'divider' }}>
            <Box aria-hidden sx={{ width: 28, height: 28, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.8125rem', bgcolor: i === 0 ? 'secondary.main' : 'action.hover', color: i === 0 ? 'secondary.contrastText' : 'text.primary' }}>{i + 1}</Box>
            <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }}>{titreLigne(l.cle)}</Typography>
              <Typography color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                {l.cle === 'heures' ? 'sans perte de CA, à productivité égale' : l.cle === 'marge' ? 'sur le CA prévu, sans vendre plus' : `${montant(l.ca)} de CA HT en plus par an`}
                {l.mesure ? ` · en caisse : ${ecartMesure(l.mesure.indicateur, l.mesure.attendu)} par mois sur ${indicateursMesure[l.mesure.indicateur].sur}` : ''}
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.125rem', fontVariantNumeric: 'tabular-nums', minWidth: 110, textAlign: 'right' }}>{ecartMontant(l.ebe)}<Box component="span" sx={{ display: 'block', fontWeight: 400, fontSize: '0.8125rem', color: 'text.secondary' }}>d’EBE par an</Box></Typography>
            {peutPrioriser && <Button size="small" className="pas-a-l-impression" startIcon={<PlaylistAddCheckOutlined />} onClick={() => setPriorite({ titre: titreLigne(l.cle), mesure: l.mesure, source: `${titreLigne(l.cle)} : ${montant(l.ebe)} d’EBE par an` })}
              aria-label={`En faire une priorité : ${titreLigne(l.cle)}`} sx={{ minHeight: 48 }}>En faire une priorité</Button>}
          </Box>
        ))}
      </Box>
    ) : <EtatVide titre="Aucun levier à comparer" texte="Mets au moins un effort au-dessus de zéro. Les tickets et le panier partent des tickets visés au budget de la Cave et du Bar." />
  }
  if (!sansBudget && choisi === 'embauche' && b && h) {
    const e = etats.embauche
    const equipe = h.equipe ?? []
    const mouvement: Mouvement | null = e.mouvement === 'primes' || e.mouvement === 'heures_sup' ? null : e.mouvement === 'embauche'
      ? { type: 'embauche', mois: e.mois, poste: { poste: e.poste || 'Poste', categorie: e.categorie, heuresHebdo: e.heures, brutMensuel: e.brut, primes: [] } }
      : equipe[e.index] ? (e.mouvement === 'depart' ? { type: 'depart', index: e.index, mois: e.mois } : { type: 'heures', index: e.index, mois: e.mois, heuresHebdo: e.nouvellesHeures }) : null
    const palier = (i: number, v: Partial<PalierPrime>) => maj('embauche', { paliers: e.paliers.map((x, j) => (j === i ? { ...x, ...v } : x)) })
    saisies = (
      <Stack spacing={2}>
        <Bloc titre="1. Le mouvement">
        <Saisies>
          <Choix libelle="Mouvement" valeur={e.mouvement} onChange={(v) => maj('embauche', { mouvement: v })} options={[['embauche', 'Embauche'], ['depart', 'Départ'], ['heures', 'Heures'], ['heures_sup', 'Heures sup'], ['primes', 'Primes']]} />
          {e.mouvement !== 'primes' && e.mouvement !== 'heures_sup' && <ChoixMois libelle={e.mouvement === 'embauche' ? 'Arrivée en' : e.mouvement === 'depart' ? 'Parti au 1er' : 'À partir de'} valeur={e.mois} onChange={(v) => maj('embauche', { mois: v })} />}
        </Saisies>
        </Bloc>
        <Bloc titre={e.mouvement === 'primes' ? '2. Les paliers de primes' : e.mouvement === 'heures_sup' ? '2. Les heures du mois' : e.mouvement === 'embauche' ? '2. Le poste' : '2. La personne'}>
        {e.mouvement === 'heures_sup' ? (
          <Stack spacing={1.5}>
            <Saisies>
              <Montant libelle="Heures payées du mois" valeur={e.heuresMois} onChange={(v) => maj('embauche', { heuresMois: v })} unite="h" pas={10} />
              <Montant libelle="Dont heures sup" valeur={e.heuresSup} onChange={(v) => maj('embauche', { heuresSup: v })} unite="h" />
              <Taux libelle="Majoration des heures sup" valeur={e.majorationSup} onChange={(v) => maj('embauche', { majorationSup: v })} />
            </Saisies>
            <Saisies><CoutHeure e={e} valeur={heure(e)} equipeSaisie={heureEquipe !== null} repere={s.coutHoraire > 0} onChange={(v) => maj('embauche', v)} /></Saisies>
          </Stack>
        ) : e.mouvement === 'primes' ? (
          <Stack spacing={1.5}>
            <Saisies>
              <Montant libelle="Salariés concernés" valeur={e.salaries} onChange={(v) => maj('embauche', { salaries: Math.max(0, Math.round(v)) })} unite="" source={!!h?.equipe?.length && e.salaries === initiaux.embauche.salaries && 'équipe'} />
              <Taux libelle="Part de la progression reversée" valeur={e.partReversee} onChange={(v) => maj('embauche', { partReversee: v })} />
            </Saisies>
            {e.paliers.map((l, i) => (
              <Saisies key={i}>
                <TauxDe libelle="Progression du CA" aria={`Progression du CA, palier ${i + 1}`} valeur={l.progression} onChange={(v) => palier(i, { progression: v })} />
                <MontantDe libelle="Prime par salarié" aria={`Prime par salarié, palier ${i + 1}`} valeur={l.prime} onChange={(v) => palier(i, { prime: v })} />
                <MontantDe libelle="Prime du gérant" aria={`Prime du gérant, palier ${i + 1}`} valeur={l.primeGerant} onChange={(v) => palier(i, { primeGerant: v })} />
                {e.paliers.length > 1 && <Button color="inherit" startIcon={<DeleteOutlineOutlined />} onClick={() => maj('embauche', { paliers: e.paliers.filter((_, j) => j !== i) })} aria-label={`Retirer le palier ${i + 1}`} sx={{ minHeight: 48 }}>Retirer</Button>}
              </Saisies>
            ))}
            <Box>{e.paliers.length < 8 && <Button startIcon={<AddOutlined />} onClick={() => maj('embauche', { paliers: [...e.paliers, { progression: (e.paliers.at(-1)?.progression ?? 0) + 0.05, prime: e.paliers.at(-1)?.prime ?? 0, primeGerant: e.paliers.at(-1)?.primeGerant ?? 0 }] })} sx={{ minHeight: 48 }}>Ajouter un palier</Button>}</Box>
          </Stack>
        ) : e.mouvement === 'embauche' ? (
          <Saisies>
            <Champ libelle="Poste"><TextField size="small" value={e.poste} onChange={(x) => maj('embauche', { poste: x.target.value })} slotProps={{ htmlInput: { 'aria-label': 'Poste', maxLength: 40 } }} sx={{ ...champ, width: 180 }} /></Champ>
            <Champ libelle="Catégorie">
              <TextField select size="small" value={e.categorie} onChange={(x) => maj('embauche', { categorie: x.target.value as Categorie })} slotProps={{ htmlInput: { 'aria-label': 'Catégorie' } }} sx={{ ...champ, width: 190 }}>
                {(['employe', 'agent_maitrise', 'cadre', 'apprenti'] as Categorie[]).map((c) => <MenuItem key={c} value={c}>{categorieLibelle[c]}</MenuItem>)}
              </TextField>
            </Champ>
            <Montant libelle="Heures par semaine" valeur={e.heures} onChange={(v) => maj('embauche', { heures: v })} unite="h" />
            <Montant libelle="Salaire brut mensuel" valeur={e.brut} onChange={(v) => maj('embauche', { brut: v })} />
          </Saisies>
        ) : equipe.length ? (
          <Saisies>
            <Champ libelle="Personne">
              <TextField select size="small" value={Math.min(e.index, equipe.length - 1)} onChange={(x) => maj('embauche', { index: Number(x.target.value) })} slotProps={{ htmlInput: { 'aria-label': 'Personne' } }} sx={{ ...champ, width: 240 }}>
                {equipe.map((x, i) => <MenuItem key={i} value={i}>{x.poste} · {x.heuresHebdo} h</MenuItem>)}
              </TextField>
            </Champ>
            {e.mouvement === 'heures' && <Montant libelle="Nouvelles heures par semaine" valeur={e.nouvellesHeures} onChange={(v) => maj('embauche', { nouvellesHeures: v })} unite="h" />}
          </Saisies>
        ) : <EtatVide titre="Aucune équipe saisie" texte="Un départ ou un changement d’heures se choisit dans l’équipe du magasin. Saisis-la dans Saisies, Équipe, puis reviens ici." />}
        </Bloc>
      </Stack>
    )
    if (mouvement) {
      const r = simulerEmbauche({ h, p, depart }, mouvement, s.aideApprenti)
      // 145 : productivité face à la cible du réseau (part du bar du budget) ; 145 bis : le même poste en CDD ou en intérim
      const caBar = somme(b.familles.filter((x) => x.univers === 'bar').map((x) => x.objectif))
      const cible = s.productivite.length && b.ca > 0 ? { cible: cibleProductivite(s.productivite, caBar / b.ca) ?? 0, partBar: caBar / b.ca } : null
      const contrats = e.mouvement === 'embauche' && r.coutAnnee > 0 ? coutContrats(r.coutAnnee, e.brut, 13 - e.mois, s.coefInterim, s.contrat) : null
      const qui = e.mouvement === 'embauche' ? `${e.poste || 'Poste'} ${e.heures} h` : equipe[e.index]?.poste ?? ''
      nomParDefaut = e.mouvement === 'embauche' ? `Embauche ${qui} en ${MOIS_LONGS[e.mois - 1]}` : e.mouvement === 'depart' ? `Départ ${qui} en ${MOIS_LONGS[e.mois - 1]}` : `${qui} à ${e.nouvellesHeures} h`
      const coutTexte = r.coutAnnee >= 0 ? `coûte ${montant(r.coutAnnee)} en ${annee}` : `économise ${montant(-r.coutAnnee)} en ${annee}`
      phrase = `${nomParDefaut} : ${coutTexte} (${montant(Math.abs(r.coutPlein))} sur 12 mois), EBE ${ecartMontant(r.ecart.ebe)}, frais de personnel ${taux(r.apres.pctFP)} du CA.${r.caNecessaire !== null && r.coutPlein > 0 ? ` Il faut ${montant(r.caNecessaire)} de CA HT en plus par an pour le payer.` : ''}`
      resultats = (
        <Resultats>
          <Indicateur libelle={r.coutAnnee >= 0 ? `Coût en ${annee}` : `Économie en ${annee}`} valeur={montant(Math.abs(r.coutAnnee))} detail={`${montant(Math.abs(r.coutPlein))} sur 12 mois${r.aide ? `, aide de ${montant(r.aide)} déduite de l’EBE` : ''}`} />
          <Indicateur libelle="EBE de l’année" valeur={montant(r.apres.ebe)} ecart={ecart(r.ecart.ebe)} />
          <Indicateur libelle="% frais de personnel" valeur={taux(r.apres.pctFP)} detail={`${taux(r.avant.pctFP)} avant, ${ecartPts(r.ecart.pctFP)}`} />
          <Indicateur libelle="Trésorerie fin décembre" valeur={montant(r.apres.fin)} ecart={ecart(r.ecart.fin)} />
          {r.caNecessaire !== null && r.coutPlein > 0 && <Indicateur libelle="CA HT en plus pour le payer" valeur={montant(r.caNecessaire)} detail="par an, à marge sur coûts variables égale" />}
          {cible && r.apres.heures > 0 && (
            <Indicateur libelle="Productivité après" valeur={`${entier(r.apres.ca / r.apres.heures)} € par heure`}
              detail={`cible ${entier(cible.cible)} € avec ${taux(cible.partBar)} de bar${r.avant.heures > 0 ? `, ${entier(r.avant.ca / r.avant.heures)} € avant` : ''}`}
              ecart={{ texte: r.apres.ca / r.apres.heures >= cible.cible ? 'Au-dessus de la cible' : 'Sous la cible', hausse: r.apres.ca / r.apres.heures >= cible.cible, favorable: r.apres.ca / r.apres.heures >= cible.cible }} />
          )}
          {contrats && <Indicateur libelle="Le même poste en CDD" valeur={montant(contrats.cdd)} detail={`en ${annee}, avec 10 % de prime de fin de contrat${contrats.fraisCDD ? ` et ${montant(contrats.fraisCDD)} de contrat et de paie` : ''}`} />}
          {contrats && contrats.interim !== null && <Indicateur libelle="Le même poste en intérim" valeur={montant(contrats.interim)} detail={`en ${annee}, salaire brut × ${unChiffre(s.coefInterim)}`} />}
        </Resultats>
      )
    }
    if (e.mouvement === 'heures_sup') {
      const r = simulerHeuresSup({ heures: e.heuresMois, heuresSup: e.heuresSup, coutHoraire: heure(e), majoration: e.majorationSup, paieExtraMois: s.contrat.paieParMois })
      nomParDefaut = `${unChiffre(e.heuresSup)} heures sup par mois`
      phrase = `${unChiffre(e.heuresSup)} heures sup sur ${unChiffre(e.heuresMois)} heures payées${r.part !== null ? ` (${taux(r.part)})` : ''} : ${montant(r.coutMois)} par mois chargés, dont ${montant(r.majorationMois)} de majoration${r.gainExtraMois > 0 ? `. Faites par un extra, ${montant(r.gainExtraMois)} d’économie par mois` : ''}.`
      resultats = (
        <Resultats>
          <Indicateur libelle="Part des heures sup" valeur={r.part !== null ? taux(r.part) : '–'} detail={`${unChiffre(e.heuresSup)} heures sur ${unChiffre(e.heuresMois)} payées`} />
          <Indicateur libelle="Coût des heures sup" valeur={`${montant(r.coutMois)} par mois`} detail={`chargé, majoration comprise, ${montant(r.coutAn)} sur 12 mois`} />
          <Indicateur libelle="Dont majoration" valeur={`${montant(r.majorationMois)} par mois`} detail="ce que coûtent les heures sup de plus que des heures normales" />
          <Indicateur libelle="Les mêmes heures par un extra" valeur={r.gainExtraMois >= 0 ? `${montant(r.gainExtraMois)} d’économie` : `${montant(-r.gainExtraMois)} de plus`}
            detail={r.seuilHeures !== null && s.contrat.paieParMois > 0 ? `par mois, paie de l’extra (${montant(s.contrat.paieParMois)}) déduite ; rentable au-delà de ${unChiffre(r.seuilHeures)} heures sup par mois` : 'par mois, sans majoration'} />
        </Resultats>
      )
    }
    if (e.mouvement === 'primes') {
      const r = simulerPrimes({ caBase: b.ca, tauxMarge: b.ca > 0 ? b.tauxMarge : 0, salaries: e.salaries, tauxCharges: p.charges.taux.employe ?? 0, partReversee: e.partReversee, paliers: e.paliers }, p)
      const dernier = r.dernierRentable !== null ? r.paliers[r.dernierRentable] : null
      const premierPerdant = r.paliers.find((l) => !l.rentable)
      nomParDefaut = `Primes sur ${e.paliers.length} palier${e.paliers.length > 1 ? 's' : ''}`
      phrase = !r.paliers.length ? '' : dernier
        ? `Sur ${montant(b.ca)} de CA HT, les primes paient jusqu’à + ${taux(dernier.progression)} de CA (gain net ${montant(dernier.gain)})${premierPerdant ? ` ; à + ${taux(premierPerdant.progression)}, elles coûtent plus que la marge gagnée` : ''}.`
        : `Aucun palier ne paie : les primes coûtent plus que la marge gagnée. Baisse les primes ou relève les paliers.`
      resultats = r.paliers.length ? (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" aria-label="Primes par palier" sx={{ minWidth: 560, '& td, & th': { fontVariantNumeric: 'tabular-nums' } }}>
            <TableHead><TableRow><TableCell>Progression</TableCell><TableCell align="right">CA HT en plus</TableCell><TableCell align="right">Marge en plus</TableCell><TableCell align="right">Coût chargé des primes</TableCell><TableCell align="right">Gain net</TableCell></TableRow></TableHead>
            <TableBody>
              {r.paliers.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>+ {taux(l.progression)}</TableCell>
                  <TableCell align="right">{montant(l.caEnPlus)}</TableCell>
                  <TableCell align="right">{montant(l.margeEnPlus)}</TableCell>
                  <TableCell align="right">{montant(l.cout)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: l.rentable ? 'success.dark' : 'error.main' }}>{ecartMontant(l.gain)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : null
    }
  }
  if (choisi === 'prix') {
    const e = etats.prix
    if (e.type === 'remises') {
      // 163 · Remises et offerts face aux repères du siège (montants HT de la période, saisis : la caisse ne les envoie pas)
      const ca = e.ca ?? (b ? Math.round(b.ca * e.mois / 12) : 0)
      const r = analyserRemises(ca, e.mois, e.montants, s.remises)
      const reperes = LIGNES_REMISES.some((l) => s.remises[l.cle] > 0)
      saisies = (
        <Stack spacing={2}>
          <Saisies>
            <Choix libelle="Je regarde" valeur={e.type} onChange={(v) => maj('prix', { type: v })} options={[['remise', 'Une remise'], ['hausse', 'Une hausse de prix'], ['remises', 'Remises et offerts']]} />
          </Saisies>
          <Bloc titre="1. La période" total={{ libelle: 'CA HT', valeur: montant(ca) }}>
            <Saisies>
              <Montant libelle="Mois de la période" valeur={e.mois} onChange={(v) => maj('prix', { mois: Math.min(12, Math.max(1, Math.round(v))) })} unite="mois" />
              <Montant libelle="CA HT de la période" valeur={ca} onChange={(v) => maj('prix', { ca: v })} />
            </Saisies>
          </Bloc>
          <Bloc titre="2. Remises et offerts accordés" total={{ libelle: 'Total HT', valeur: montant(r.total) }}>
            <Saisies>
              {LIGNES_REMISES.map((l) => <Montant key={l.cle} libelle={`${l.libelle}, HT`} valeur={e.montants[l.cle] ?? 0} onChange={(v) => maj('prix', { montants: { ...e.montants, [l.cle]: v } })} />)}
            </Saisies>
          </Bloc>
        </Stack>
      )
      nomParDefaut = `Remises et offerts sur ${e.mois} mois`
      phrase = ca > 0 ? `${montant(r.total)} de remises et d’offerts, soit ${taux(r.part ?? 0)} du CA${reperes ? (r.ecart > 0 ? ` : ${montant(r.ecart)} au-dessus des repères, ${montant(r.ecartAn)} d’EBE à récupérer sur un an` : ' : dans les repères') : ''}.` : ''
      resultats = ca > 0 ? (
        <Stack spacing={2}>
          <Resultats>
            <Indicateur libelle="Remises et offerts" valeur={taux(r.part ?? 0)} detail={`${montant(r.total)} sur ${montant(ca)} de CA HT`} />
            {reperes && <Indicateur libelle="Au-dessus des repères" valeur={montant(r.ecart)} detail={`soit ${montant(r.ecartAn)} d’EBE par an`} ecart={{ texte: r.ecart > 0 ? 'À réduire' : 'Dans les repères', hausse: r.ecart <= 0, favorable: r.ecart <= 0 }} />}
          </Resultats>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label="Remises et offerts" sx={{ minWidth: 480, '& td, & th': { fontVariantNumeric: 'tabular-nums' } }}>
              <TableHead><TableRow><TableCell>Ligne</TableCell><TableCell align="right">Montant HT</TableCell><TableCell align="right">Part du CA</TableCell><TableCell align="right">Repère</TableCell><TableCell align="right">Écart</TableCell></TableRow></TableHead>
              <TableBody>
                {r.lignes.map((l) => (
                  <TableRow key={l.cle}>
                    <TableCell>{l.libelle}</TableCell>
                    <TableCell align="right">{montant(l.montant)}</TableCell>
                    <TableCell align="right">{l.part === null ? '–' : taux(l.part)}</TableCell>
                    <TableCell align="right">{l.repere > 0 ? taux(l.repere) : '–'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: l.ecart !== null && l.ecart > 0 ? 'error.main' : undefined }}>{l.ecart === null ? '–' : ecartMontant(l.ecart)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Stack>
      ) : null
    } else {
    const r = simulerPrix(e.type, e.taux, e.marge)
    // 165 · offres en produits gratuits : « 5 + 1 » = 1 gratuit sur 6, « 4 + 2 » = 2 sur 6
    const offre = (gratuits: number, payes: number) => maj('prix', { type: 'remise', taux: Math.round(gratuits / (gratuits + payes) * 10000) / 10000 })
    saisies = (
      <Stack spacing={2}>
        <Saisies>
          <Choix libelle="Je regarde" valeur={e.type} onChange={(v) => maj('prix', { type: v })} options={[['remise', 'Une remise'], ['hausse', 'Une hausse de prix'], ['remises', 'Remises et offerts']]} />
        </Saisies>
        <Bloc titre="1. Le produit aujourd’hui">
          <Saisies>
            <Taux libelle="Taux de marge du produit" valeur={e.marge} onChange={(v) => maj('prix', { marge: v })} source={!!b && b.ca > 0 && e.marge === initiaux.prix.marge && 'budget'} />
            {e.type === 'remise' && <Montant libelle="Cartons vendus d’habitude" valeur={e.cartons} onChange={(v) => maj('prix', { cartons: Math.max(0, Math.round(v)) })} unite="" />}
          </Saisies>
        </Bloc>
        <Bloc titre={e.type === 'remise' ? '2. La remise envisagée' : '2. La hausse envisagée'}>
          <Saisies>
            <Taux libelle={e.type === 'remise' ? 'Remise' : 'Hausse'} valeur={e.taux} onChange={(v) => maj('prix', { taux: v })} />
          </Saisies>
          {e.type === 'remise' && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="outlined" onClick={() => offre(1, 5)} sx={{ minHeight: 48 }}>Offre 5 + 1</Button>
              <Button variant="outlined" onClick={() => offre(2, 4)} sx={{ minHeight: 48 }}>Offre 4 + 2</Button>
            </Box>
          )}
        </Bloc>
      </Stack>
    )
    nomParDefaut = e.type === 'remise' ? `Remise de ${taux(e.taux)}` : `Hausse de ${taux(e.taux)}`
    if (e.type === 'remise') {
      const cartons = r.ventesEnPlus !== null && e.cartons > 0 ? Math.ceil(e.cartons * (1 + r.ventesEnPlus) - 1e-9) : null
      phrase = r.ventesEnPlus === null ? `Une remise de ${taux(e.taux)} sur un produit margé à ${taux(e.marge)} fait vendre à perte.` : `Avec ${taux(e.taux)} de remise, il faut vendre ${taux(r.ventesEnPlus)} de plus pour garder la même marge${cartons !== null ? `, soit ${entier(cartons)} cartons au lieu de ${entier(e.cartons)}` : ''}.`
      resultats = (
        <Resultats>
          <Indicateur libelle="Ventes en plus nécessaires" valeur={r.ventesEnPlus === null ? 'Vente à perte' : `+ ${taux(r.ventesEnPlus)}`} detail={r.ventesEnPlus === null ? 'La remise dépasse la marge' : `Pour 100 ventes avant : ${entier(100 * (1 + r.ventesEnPlus))} après`} />
          {cartons !== null && <Indicateur libelle="Cartons à vendre" valeur={entier(cartons)} detail={`au lieu de ${entier(e.cartons)}, pour la même marge`} />}
          <Indicateur libelle="Taux de marge pendant la promo" valeur={taux(r.nouveauTauxMarge)} detail={`${taux(e.marge)} avant`} />
        </Resultats>
      )
    } else {
      phrase = `Avec ${taux(e.taux)} de hausse, on garde la même marge tant qu’on ne perd pas plus de ${taux(r.ventesPerdables ?? 0)} des ventes.`
      resultats = (
        <Resultats>
          <Indicateur libelle="Ventes qu’on peut perdre" valeur={taux(r.ventesPerdables ?? 0)} detail={`Pour 100 ventes avant : au moins ${entier(100 * (1 - (r.ventesPerdables ?? 0)))} après`} />
          <Indicateur libelle="Nouveau taux de marge" valeur={taux(r.nouveauTauxMarge)} detail={`${taux(e.marge)} avant`} />
        </Resultats>
      )
    }
    }
  }
  if (!sansBudget && choisi === 'tresorerie' && h) {
    const e = etats.tresorerie
    const coups: CoupDur[] = [
      ...(e.baisse ? [{ type: 'baisse' as const, taux: e.tauxBaisse, de: e.de, a: Math.max(e.de, e.a) }] : []),
      ...(e.depense ? [{ type: 'depense' as const, montant: e.montantDepense, mois: e.moisDepense }] : []),
      ...(e.retard ? [{ type: 'retard' as const, montant: e.montantRetard, mois: e.moisRetard, retard: e.duree }] : []),
    ]
    const r = simulerCoupDur({ h, p, depart }, coups)
    const coche = (cle: 'baisse' | 'depense' | 'retard', libelle: string) => (
      <FormControlLabel control={<Checkbox checked={e[cle]} onChange={(x) => maj('tresorerie', { [cle]: x.target.checked })} />} label={libelle} sx={{ minHeight: 48, mr: 0 }} />
    )
    saisies = (
      <Bloc titre="Les coups durs à tester">
      <Stack spacing={1.5}>
        {coche('baisse', 'Baisse du CA')}
        {e.baisse && <Saisies><Taux libelle="Baisse" valeur={e.tauxBaisse} onChange={(v) => maj('tresorerie', { tauxBaisse: v })} /><ChoixMois libelle="De" valeur={e.de} onChange={(v) => maj('tresorerie', { de: v })} /><ChoixMois libelle="À" valeur={e.a} onChange={(v) => maj('tresorerie', { a: v })} /></Saisies>}
        {coche('depense', 'Dépense imprévue (réparation, matériel)')}
        {e.depense && <Saisies><Montant libelle="Montant HT" valeur={e.montantDepense} onChange={(v) => maj('tresorerie', { montantDepense: v })} /><ChoixMois libelle="Payée en" valeur={e.moisDepense} onChange={(v) => maj('tresorerie', { moisDepense: v })} /></Saisies>}
        {coche('retard', 'Client qui paie en retard')}
        {e.retard && <Saisies><Montant libelle="Montant TTC attendu" valeur={e.montantRetard} onChange={(v) => maj('tresorerie', { montantRetard: v })} /><ChoixMois libelle="Attendu en" valeur={e.moisRetard} onChange={(v) => maj('tresorerie', { moisRetard: v })} /><Montant libelle="Retard" valeur={e.duree} onChange={(v) => maj('tresorerie', { duree: Math.round(v) })} unite="mois" /></Saisies>}
      </Stack>
      </Bloc>
    )
    nomParDefaut = coups.length ? coups.map((c) => (c.type === 'baisse' ? `CA − ${taux(c.taux)}` : c.type === 'depense' ? `dépense de ${montant(c.montant)}` : `retard de ${c.retard} mois`)).join(', ') : 'Coup dur'
    const neg = r.apres.premierMoisNegatif
    phrase = `${nomParDefaut} : point bas ${montant(r.apres.pointBas.montant)} en ${MOIS_LONGS[r.apres.pointBas.mois]} (${montant(r.avant.pointBas.montant)} prévu)${neg !== null ? `, sous zéro dès ${MOIS_LONGS[neg]}` : ', jamais sous zéro'}.`
    resultats = (
      <Stack spacing={2}>
        <Resultats>
          <Indicateur libelle="Point bas" valeur={montant(r.apres.pointBas.montant)} detail={`en ${MOIS_LONGS[r.apres.pointBas.mois]}, ${montant(r.avant.pointBas.montant)} prévu`} ecart={ecart(r.ecart.pointBas)} />
          <Indicateur libelle="Sous zéro" valeur={neg !== null ? `dès ${MOIS_LONGS[neg]}` : 'Jamais'} detail={r.avant.premierMoisNegatif !== null ? `Prévu : dès ${MOIS_LONGS[r.avant.premierMoisNegatif]}` : 'Prévu : jamais'} />
          <Indicateur libelle="Trésorerie fin décembre" valeur={montant(r.apres.fin)} ecart={ecart(r.ecart.fin)} />
          <Indicateur libelle="EBE de l’année" valeur={montant(r.apres.ebe)} ecart={ecart(r.ecart.ebe)} />
        </Resultats>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" aria-label="Trésorerie de fin de mois" sx={{ minWidth: 420, '& td, & th': { fontVariantNumeric: 'tabular-nums' } }}>
            <TableHead><TableRow><TableCell>Fin de mois</TableCell><TableCell align="right">Prévu</TableCell><TableCell align="right">Avec le coup dur</TableCell><TableCell align="right">Écart</TableCell></TableRow></TableHead>
            <TableBody>
              {r.apres.soldes.map((x, i) => (
                <TableRow key={i}>
                  <TableCell>{MOIS_LONGS[i]}</TableCell>
                  <TableCell align="right">{montant(r.avant.soldes[i])}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: x < 0 ? 'error.main' : undefined }}>{montant(x)}</TableCell>
                  <TableCell align="right">{ecartMontant(x - r.avant.soldes[i])}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Stack>
    )
  }
  if (!sansBudget && choisi === 'vente_additionnelle' && b) {
    const e = etats.vente_additionnelle
    const universDispo = (['cave', 'bar'] as const).filter((u) => (b.flux[u]?.objectif ?? 0) > 0)
    const u = universDispo.includes(e.univers) ? e.univers : universDispo[0]
    const margeU = u ? margeUnivers(b, u) ?? 0 : 0
    const r = u ? simulerVenteAdditionnelle(surCaisse(e.base) ?? b, p, { univers: u, unSur: e.unSur, prixTTC: e.prix, tauxMarge: e.marge ?? margeU }) : null
    saisies = u ? (
      <Stack spacing={2}>
      {(universDispo.length > 1 || caisse) && <Bloc titre="1. Point de départ">
      <Saisies>
        {universDispo.length > 1 && <Choix libelle="Univers" valeur={u} onChange={(v) => maj('vente_additionnelle', { univers: v })} options={[['cave', 'Cave'], ['bar', 'Bar']]} />}
        {caisse && <BaseDesChiffres valeur={e.base} annee={annee} caisse={caisse} onChange={(base) => maj('vente_additionnelle', { base })} />}
      </Saisies>
      </Bloc>}
      <Bloc titre={universDispo.length > 1 || caisse ? '2. L’article proposé' : 'L’article proposé'}>
      <Saisies>
        <Montant libelle="Un client sur" valeur={e.unSur} onChange={(v) => maj('vente_additionnelle', { unSur: Math.max(1, Math.round(v)) })} unite="" pas={1} min={1} />
        <Montant libelle="Prix de l’article TTC" valeur={e.prix} onChange={(v) => maj('vente_additionnelle', { prix: v })} pas={1} />
        <Taux libelle="Taux de marge de l’article" valeur={e.marge ?? margeU} onChange={(v) => maj('vente_additionnelle', { marge: v })} source={e.marge === null && u && margeUnivers(b, u) !== null && 'budget'} />
      </Saisies>
      </Bloc>
      </Stack>
    ) : <EtatVide titre="Pas de tickets visés au budget" texte="La vente additionnelle part des tickets de la Cave ou du Bar visés au budget. Ils arrivent avec la proposition du siège." />
    if (r) {
      nomParDefaut = `1 article de plus pour 1 client sur ${e.unSur} (${u === 'cave' ? 'Cave' : 'Bar'})`
      mesure = { indicateur: u === 'cave' ? 'pmCave' : 'pmBar', attendu: r.panierEnPlus / (1 + (p.tvaPanier[r.univers] ?? 0)) }
      phrase = `Un article à ${montant(e.prix)} vendu à 1 client sur ${e.unSur} : ${entier(r.articles)} articles par an (${unChiffre(r.articlesParJour)} par jour), ${montant(r.caHT)} de CA HT et ${montant(r.ebe)} d’EBE en plus.`
      resultats = (
        <Resultats>
          <Indicateur libelle="Articles en plus" valeur={entier(r.articles)} detail={`par an, soit ${unChiffre(r.articlesParJour)} par jour d’ouverture`} />
          <Indicateur libelle="CA en plus" valeur={montant(r.caHT)} detail={`HT par an (${montant(r.caTTC)} TTC), panier + ${montant(r.panierEnPlus)}`} />
          <Indicateur libelle="EBE en plus" valeur={montant(r.ebe)} detail="par an, redevance et publicité déduites" />
        </Resultats>
      )
    }
  }
  if (!sansBudget && choisi === 'reste_a_faire' && b && h) {
    const e = etats.reste_a_faire
    if (h.annee !== aujourdhui.getFullYear()) {
      saisies = <EtatVide titre={`Disponible en ${h.annee}`} texte={`Le reste à faire se calcule sur le budget du mois en cours. Le budget ${h.annee} servira dès janvier ${h.annee}.`} />
    } else {
      const r = resteAFaire(b, h.annee, e.mois, e.jour, e.realise)
      saisies = <Bloc titre="Où j’en suis" total={{ libelle: `Budget de ${MOIS_LONGS[e.mois - 1]}`, valeur: montant(r.budget) }}><Saisies><Montant libelle={`CA HT de ${MOIS_LONGS[e.mois - 1]} jusqu’à hier soir`} valeur={e.realise} onChange={(v) => maj('reste_a_faire', { realise: v })} /></Saisies></Bloc>
      nomParDefaut = `Reste à faire au ${e.jour} ${MOIS_LONGS[e.mois - 1]}`
      phrase = r.atteint ? `Budget de ${MOIS_LONGS[e.mois - 1]} atteint (${montant(r.budget)}).` : `Il reste ${montant(r.reste)} à faire en ${r.joursRestants} jours, soit ${montant(r.parJour ?? 0)} par jour${r.rythme !== null ? ` contre ${montant(r.rythme)} jusqu’ici` : ''}.`
      resultats = (
        <Resultats>
          <Indicateur libelle={`Budget de ${MOIS_LONGS[e.mois - 1]}`} valeur={montant(r.budget)} detail={`${montant(r.realise)} faits`} />
          <Indicateur libelle="Par jour d’ouverture restant" valeur={r.atteint ? 'Atteint' : montant(r.parJour ?? 0)} detail={`${r.joursRestants} jours du lundi au samedi, aujourd’hui compris`} />
          {r.rythme !== null && <Indicateur libelle="Rythme actuel" valeur={montant(r.rythme)} detail="par jour ouvert depuis le 1er" ecart={r.ecartParJour !== null && !r.atteint ? { texte: ecartMontant(r.ecartParJour), hausse: r.ecartParJour >= 0, favorable: r.ecartParJour <= 0 } : undefined} />}
        </Resultats>
      )
    }
  }
  if (choisi === 'soiree') {
    const e = etats.soiree
    const margeU = margeUnivers(b, e.univers) ?? 0.6
    const tva = e.univers === 'cave' ? p.tvaPanier.cave : p.tvaPanier.bar
    const margeCave = margeUnivers(b, 'cave') ?? 0.3
    const lignes = { ...{ produits: 0, securite: 0, deco: 0, animation: 0, communication: 0, location: 0 }, ...e.lignes }
    const coutsPropres = somme(Object.values(lignes)) + e.couts
    const r = simulerSoiree({
      prixTTC: e.prix, participants: e.participants, tva, tauxMarge: e.marge ?? margeU, couts: coutsPropres, extras: e.extras,
      achats: e.achats ? { part: e.part, panierTTC: e.panier, tva: p.tvaPanier.cave, tauxMarge: margeCave, bon: e.bon } : null,
      equipe: { personnes: e.personnes, heures: e.heuresEquipe, coutHoraire: heure(e), majoration: e.majoration },
    }, p)
    const extrasEtCouts = coutsPropres + e.extras
    // 241 : soirée animée sans billet, payée par le CA du bar en plus d'un soir normal
    const animee = e.formule === 'animee'
    const ra = simulerSoireeAnimee({ caNormal: e.caNormal, caAttendu: e.caSoir, tauxMarge: e.marge ?? margeU, couts: coutsPropres, extras: e.extras,
      equipe: { personnes: e.personnes, heures: e.heuresEquipe, coutHoraire: heure(e), majoration: e.majoration } }, p)
    const n = (i: number) => (animee ? i - 1 : i)
    saisies = (
      <Stack spacing={2}>
        <Bloc titre="L’événement">
          <Saisies>
            <Champ libelle="Nom"><TextField size="small" value={e.nom} onChange={(x) => maj('soiree', { nom: x.target.value })} slotProps={{ htmlInput: { 'aria-label': 'Nom de l’événement', maxLength: 60 } }} sx={{ ...champ, width: 220 }} /></Champ>
            <ChoixMois libelle="Mois" valeur={e.mois} onChange={(v) => maj('soiree', { mois: v })} />
            <Choix libelle="Formule" valeur={e.formule} onChange={(v) => maj('soiree', { formule: v, ...(v === 'animee' ? { univers: 'bar' as Univers } : {}) })} options={[['billet', 'Entrée payante'], ['animee', 'Soirée animée sans billet']]} />
            {!animee && <Choix libelle="Univers" valeur={e.univers} onChange={(v) => maj('soiree', { univers: v })} options={[['bar', 'Bar'], ['cave', 'Cave']]} />}
          </Saisies>
        </Bloc>
        {animee ? (
          <Bloc titre="1. Le bar ce soir-là" total={{ libelle: 'CA HT en plus', valeur: montant(ra.caEnPlus) }}>
            <Saisies>
              <Montant libelle="CA HT du bar un soir normal" valeur={e.caNormal} onChange={(v) => maj('soiree', { caNormal: v })} pas={100} />
              <Montant libelle="CA HT du bar attendu ce soir-là" valeur={e.caSoir} onChange={(v) => maj('soiree', { caSoir: v })} pas={100} />
              <Taux libelle="Taux de marge du bar" valeur={e.marge ?? margeU} onChange={(v) => maj('soiree', { marge: v })} source={e.marge === null && margeUnivers(b, 'bar') !== null && 'budget'} />
            </Saisies>
          </Bloc>
        ) : <>
        <Bloc titre="1. Entrées" total={{ libelle: 'CA HT', valeur: montant(r.caEntree) }}>
          <Saisies>
            <Montant libelle="Prix par participant TTC" valeur={e.prix} onChange={(v) => maj('soiree', { prix: v })} />
            <Montant libelle="Participants attendus" valeur={e.participants} onChange={(v) => maj('soiree', { participants: Math.round(v) })} unite="" pas={5} />
            <Taux libelle="Taux de marge" valeur={e.marge ?? margeU} onChange={(v) => maj('soiree', { marge: v })} source={e.marge === null && margeUnivers(b, e.univers) !== null && 'budget'} />
          </Saisies>
        </Bloc>
        <Bloc titre="2. Achats des participants en cave" total={r.caAchats > 0 ? { libelle: 'CA HT', valeur: montant(r.caAchats - r.bon) } : undefined}>
          <Saisies>
            <FormControlLabel control={<Checkbox sx={{ width: 48, height: 48 }} checked={e.achats} onChange={(x) => maj('soiree', { achats: x.target.checked })} />} label="Les participants achètent en cave" sx={{ minHeight: 48, mr: 0 }} />
            {e.achats && <>
              <Taux libelle="Part qui achète" valeur={e.part} onChange={(v) => maj('soiree', { part: v })} />
              <Montant libelle="Panier moyen TTC" valeur={e.panier} onChange={(v) => maj('soiree', { panier: v })} />
              <FormControlLabel control={<Checkbox sx={{ width: 48, height: 48 }} checked={e.bon} onChange={(x) => maj('soiree', { bon: x.target.checked })} />} label="Entrée remboursée en bon d’achat" sx={{ minHeight: 48, mr: 0 }} />
            </>}
          </Saisies>
        </Bloc>
        </>}
        <Bloc titre={`${n(3)}. Coûts de l’événement HT`} total={{ libelle: 'Total', valeur: `− ${montant(extrasEtCouts)}` }}>
          <Saisies>
            {LIGNES_EVENEMENT.map((l) => l.cle === 'divers'
              ? <Montant key={l.cle} libelle={l.libelle} valeur={e.couts} onChange={(v) => maj('soiree', { couts: v })} />
              : <Montant key={l.cle} libelle={l.libelle} valeur={lignes[l.cle]} onChange={(v) => maj('soiree', { lignes: { ...lignes, [l.cle]: v } })} />)}
            <Montant libelle="Extras de personnel" valeur={e.extras} onChange={(v) => maj('soiree', { extras: v })} />
          </Saisies>
        </Bloc>
        <Bloc titre={`${n(4)}. Heures en plus de l’équipe en place`} total={{ libelle: 'Total', valeur: `− ${montant(r.equipeEnPlace)}` }}>
          <Saisies>
            <Montant libelle="Personnes" valeur={e.personnes} onChange={(v) => maj('soiree', { personnes: Math.max(0, Math.round(v)) })} unite="" />
            <Montant libelle="Heures chacune" valeur={e.heuresEquipe} onChange={(v) => maj('soiree', { heuresEquipe: v })} unite="h" />
            <Taux libelle="Majoration des heures" valeur={e.majoration} onChange={(v) => maj('soiree', { majoration: v })} />
          </Saisies>
          <Saisies>
            <CoutHeure e={e} valeur={heure(e)} equipeSaisie={heureEquipe !== null} repere={parametresSimulateurs(p).coutHoraire > 0} onChange={(v) => maj('soiree', v)} />
          </Saisies>
        </Bloc>
      </Stack>
    )
    nomParDefaut = `${e.nom || 'Soirée'} en ${MOIS_LONGS[e.mois - 1]}`
    if (animee) {
      phrase = `${nomParDefaut}, ${montant(ra.caEnPlus)} de CA HT en plus d’un soir normal : ${ra.gain >= 0 ? `gain de ${montant(ra.gain)}` : `perte de ${montant(-ra.gain)}`}${ra.caAViser !== null ? `. Pour ne rien perdre, viser ${montant(ra.caAViser)} de CA HT au bar` : ''}.`
      resultats = (
        <Stack spacing={2}>
          <Compte titre="Compte de la soirée" lignes={[
            { libelle: 'Marge sur le CA en plus', valeur: ra.marge, detail: `${montant(ra.caEnPlus)} de CA HT en plus` },
            { libelle: 'Redevance et publicité', valeur: -ra.redevance },
            { libelle: 'Coûts de l’événement', valeur: -extrasEtCouts },
            { libelle: 'Heures de l’équipe en place', valeur: -ra.equipeEnPlace },
          ]} total={{ libelle: ra.gain >= 0 ? 'Gain' : 'Perte', valeur: ra.gain }} />
          <Resultats>
            <Indicateur libelle={ra.gain >= 0 ? 'Gain' : 'Perte'} valeur={montant(Math.abs(ra.gain))} detail={`${montant(ra.caEnPlus)} de CA HT en plus, ${montant(ra.couts)} de coûts`} />
            <Indicateur libelle="CA du bar à viser pour ne rien perdre" valeur={ra.caAViser !== null ? montant(ra.caAViser) : 'Jamais rentable'}
              detail={ra.caEnPlusAViser !== null ? `HT, soit ${montant(ra.caEnPlusAViser)} de plus qu’un soir normal` : 'La marge ne couvre pas la redevance'} />
          </Resultats>
        </Stack>
      )
      ajout = { tempsForts: tempsFortDeSoiree(e.nom || 'Soirée', e.mois, 'bar', { caHT: ra.caEnPlus }, coutsPropres) }
    } else {
    phrase = `${nomParDefaut}, ${e.participants} participants à ${montant(e.prix)} : ${r.gain >= 0 ? `gain de ${montant(r.gain)}` : `perte de ${montant(-r.gain)}`}${r.caAchats > 0 ? `, dont ${montant(r.caAchats - r.bon)} d’achats en cave` : ''}${r.seuil !== null ? `, à partir de ${r.seuil} participants on ne perd pas d’argent` : ''}.`
    resultats = (
      <Stack spacing={2}>
      <Compte titre="Compte de l’événement" lignes={[
          { libelle: 'Marge sur les ventes', valeur: r.marge, detail: `${montant(r.caHT)} de CA HT` },
          { libelle: 'Redevance et publicité', valeur: -r.redevance },
          { libelle: 'Coûts de l’événement', valeur: -extrasEtCouts },
          { libelle: 'Heures de l’équipe en place', valeur: -r.equipeEnPlace },
        ]} total={{ libelle: r.gain >= 0 ? 'Gain' : 'Perte', valeur: r.gain }} />
      <Resultats>
        <Indicateur libelle={r.gain >= 0 ? 'Gain' : 'Perte'} valeur={montant(Math.abs(r.gain))} detail={`${montant(r.caHT)} de CA HT, ${montant(r.couts)} de coûts`} />
        <Indicateur libelle="Participants pour ne rien perdre" valeur={r.seuil !== null ? entier(r.seuil) : 'Jamais rentable'} detail={r.seuil !== null ? `${montant(r.gainParParticipant)} gagnés par participant` : 'La marge ne couvre pas la redevance'} />
        {r.caAchats > 0 && <Indicateur libelle="Achats des participants" valeur={montant(r.caAchats - r.bon)} detail={`HT, ${entier(r.acheteurs)} acheteurs${r.bon > 0 ? `, bons de ${montant(r.bon)} déduits` : ''}`} />}
        {r.equipeEnPlace > 0 && <Indicateur libelle="Heures de l’équipe en place" valeur={montant(r.equipeEnPlace)} detail="chargées, majoration comprise" />}
      </Resultats>
      </Stack>
    )
    ajout = { tempsForts: tempsFortDeSoiree(e.nom || 'Soirée', e.mois, e.univers, r, coutsPropres) }
    }
    if (e.extras > 0 || r.equipeEnPlace > 0) note = 'Les extras et les heures de l’équipe se saisissent dans l’Équipe du budget.'
  }
  if (choisi === 'achat') {
    const e = etats.achat
    const r = simulerAchat({ montant: e.montant, remise: e.remise, mois: e.mois, invendu: e.invendu, tauxAnnuel: e.taux, tvaAchats: p.tresorerie.tvaAchats })
    saisies = (
      <Stack spacing={2}>
        <Bloc titre="1. L’offre du fournisseur" total={{ libelle: 'Remise gagnée', valeur: montant(r.remise) }}>
          <Saisies>
            <Montant libelle="Achat au prix habituel HT" valeur={e.montant} onChange={(v) => maj('achat', { montant: v })} />
            <Taux libelle="Remise du fournisseur" valeur={e.remise} onChange={(v) => maj('achat', { remise: v })} />
          </Saisies>
        </Bloc>
        <Bloc titre="2. Ce que ça coûte de stocker" total={{ libelle: 'Total', valeur: `− ${montant(r.perteInvendu + r.coutArgent)}` }}>
          <Saisies>
            <Montant libelle="Temps pour tout vendre" valeur={e.mois} onChange={(v) => maj('achat', { mois: v })} unite="mois" />
            <Taux libelle="Part qui risque de rester" valeur={e.invendu} onChange={(v) => maj('achat', { invendu: v })} />
            <Taux libelle="Coût annuel de l’argent" valeur={e.taux} onChange={(v) => maj('achat', { taux: v })} />
          </Saisies>
        </Bloc>
      </Stack>
    )
    nomParDefaut = `Achat de ${montant(e.montant)} à ${taux(e.remise)} de remise`
    phrase = `${nomParDefaut}, vendu en ${unChiffre(e.mois)} mois : ${r.gain >= 0 ? `gain de ${montant(r.gain)}` : `perte de ${montant(-r.gain)}`}${r.moisMaximum !== null ? `, la remise vaut le coup si tout part en moins de ${unChiffre(r.moisMaximum)} mois` : ''}.`
    resultats = (
      <Resultats>
        <Indicateur libelle={r.gain >= 0 ? 'Gain net' : 'Perte nette'} valeur={montant(Math.abs(r.gain))} detail={`remise ${montant(r.remise)}, invendu ${montant(r.perteInvendu)}, argent bloqué ${montant(r.coutArgent)}`} />
        <Indicateur libelle="Sortie de trésorerie à la commande" valeur={montant(r.payeTTC)} detail="TTC, revient au fil des ventes" />
        <Indicateur libelle="Durée maximale pour tout vendre" valeur={r.moisMaximum === null ? 'Sans limite' : `${unChiffre(r.moisMaximum)} mois`} detail={r.moisMaximum === null ? 'Règle le coût de l’argent pour la calculer' : 'au-delà, la remise ne paie plus le stock bloqué'} />
      </Resultats>
    )
  }
  if (choisi === 'investissement') {
    const e = etats.investissement
    // 156 · Marché extérieur : préconisation du siège selon l'objectif de CA (tireuses, investissement, heures par semaine)
    const pal = e.modele === 'exterieur' ? palierExterieur(s.marcheExterieur.paliers, e.objectifExterieur) : null
    const coutExt = pal ? pal.investissement + (e.camion ? s.marcheExterieur.camion : 0) : null
    const chargesExt = pal ? pal.heures * 52 * s.coutHoraire : null
    const cout = coutExt ?? e.cout
    const charges = chargesExt ?? e.charges
    const ca = e.modele === 'corner' && s.corner.caParMetre > 0 ? caCorner(e.metres, s) : e.modele === 'exterieur' ? e.objectifExterieur : e.ca
    const marge = e.modele === 'corner' && s.corner.tauxMarge > 0 ? s.corner.tauxMarge : e.marge
    const demarque = e.modele === 'corner' ? s.corner.demarque || e.demarque : e.demarque
    const pret = e.financement === 'pret' ? { taux: e.tauxPret, duree: e.dureePret } : null
    const r = simulerInvestissement({ cout, duree: e.duree, mois: e.mois, ca, tauxMarge: marge, demarque, charges, pret }, p)
    const reperes = e.modele === 'corner' && s.corner.caParMetre > 0
    saisies = (
      <Stack spacing={2}>
        <Bloc titre="1. Le projet">
        <Saisies>
          <Choix libelle="Projet" valeur={e.modele} onChange={(v) => maj('investissement', { modele: v, libelle: v === 'corner' ? 'Corner alimentaire' : v === 'exterieur' ? 'Marché extérieur' : ['Corner alimentaire', 'Marché extérieur'].includes(e.libelle) ? 'Tireuse' : e.libelle, univers: v === 'corner' ? 'cave' : v === 'exterieur' ? 'exterieur' : e.univers })} options={[['libre', 'Libre'], ['corner', 'Corner alimentaire'], ['exterieur', 'Marché extérieur']]} />
          <Champ libelle="Nom"><TextField size="small" value={e.libelle} onChange={(x) => maj('investissement', { libelle: x.target.value })} slotProps={{ htmlInput: { 'aria-label': 'Nom du projet', maxLength: 60 } }} sx={{ ...champ, width: 200 }} /></Champ>
          <ChoixMois libelle="En service en" valeur={e.mois} onChange={(v) => maj('investissement', { mois: v })} />
        </Saisies>
        {e.modele === 'exterieur' && (
          <Saisies>
            <Montant libelle="Objectif de CA HT extérieur par an" valeur={e.objectifExterieur} onChange={(v) => maj('investissement', { objectifExterieur: v })} />
            {s.marcheExterieur.camion > 0 && <FormControlLabel control={<Checkbox sx={{ width: 48, height: 48 }} checked={e.camion} onChange={(x) => maj('investissement', { camion: x.target.checked })} />} label={`Avec un camion (${montant(s.marcheExterieur.camion)})`} sx={{ minHeight: 48, mr: 0 }} />}
          </Saisies>
        )}
        {e.modele === 'exterieur' && (pal
          ? <Typography color="text.secondary">Préconisation du siège pour {montant(e.objectifExterieur)} de CA : {entier(pal.tireuses)} tireuses, {montant(pal.investissement)} d’investissement{e.camion ? ` et ${montant(s.marcheExterieur.camion)} de camion` : ''}, {unChiffre(pal.heures)} h par semaine{s.coutHoraire > 0 ? `, soit ${montant(chargesExt ?? 0)} par an au coût horaire du siège` : ''}.</Typography>
          : <Typography color="text.secondary">Le siège n’a pas encore réglé la préconisation du marché extérieur : saisis le coût et les charges en mode Libre.</Typography>)}
        </Bloc>
        <Bloc titre="2. L’investissement" total={{ libelle: 'Coût HT', valeur: montant(cout) }}>
        <Saisies>
          {coutExt === null ? <Montant libelle="Coût HT" valeur={e.cout} onChange={(v) => maj('investissement', { cout: v })} /> : null}
          <Montant libelle="Amorti sur" valeur={e.duree} onChange={(v) => maj('investissement', { duree: v })} unite="ans" />
          <Choix libelle="Financement" valeur={e.financement} onChange={(v) => maj('investissement', { financement: v })} options={[['tresorerie', 'Trésorerie'], ['pret', 'Prêt']]} />
          {e.financement === 'pret' && <><Taux libelle="Taux du prêt" valeur={e.tauxPret} onChange={(v) => maj('investissement', { tauxPret: v })} /><Montant libelle="Durée du prêt" valeur={e.dureePret} onChange={(v) => maj('investissement', { dureePret: v })} unite="ans" /></>}
        </Saisies>
        </Bloc>
        <Bloc titre="3. Ce qu’il rapporte et coûte chaque année" total={{ libelle: 'EBE en plus', valeur: ecartMontant(r.ebeAn), negatif: r.ebeAn < 0 }}>
        <Saisies>
          {e.modele === 'corner' && reperes
            ? <Montant libelle="Mètres linéaires" valeur={e.metres} onChange={(v) => maj('investissement', { metres: v })} unite="m" />
            : e.modele === 'exterieur' ? null : <Montant libelle="CA HT en plus par an" valeur={e.ca} onChange={(v) => maj('investissement', { ca: v })} />}
          {!(e.modele === 'corner' && s.corner.tauxMarge > 0) && <Taux libelle="Taux de marge" valeur={e.marge} onChange={(v) => maj('investissement', { marge: v })} />}
          {!(e.modele === 'corner' && s.corner.demarque > 0) && <Taux libelle="Démarque" valeur={e.demarque} onChange={(v) => maj('investissement', { demarque: v })} />}
          {chargesExt === null && <Montant libelle="Charges en plus par an HT" valeur={e.charges} onChange={(v) => maj('investissement', { charges: v })} />}
        </Saisies>
        {reperes && <Typography color="text.secondary">Repères du siège : {montant(s.corner.caParMetre)} de CA HT par mètre et par an, soit {montant(ca)}{s.corner.tauxMarge > 0 ? `, marge ${taux(s.corner.tauxMarge)}` : ''}{s.corner.demarque > 0 ? `, démarque ${taux(s.corner.demarque)}` : ''}.</Typography>}
        </Bloc>
      </Stack>
    )
    nomParDefaut = `${e.libelle || 'Investissement'} de ${montant(cout)}`
    phrase = `${nomParDefaut} : ${montant(r.ebeAn)} d’EBE en plus par an${r.retourAnnees !== null ? `, remboursé en ${unChiffre(r.retourAnnees)} an${r.retourAnnees >= 2 ? 's' : ''}` : ', jamais remboursé'} ; trésorerie ${ecartMontant(r.annee1.tresorerie)} la 1re année.`
    resultats = (
      <Resultats>
        <Indicateur libelle="EBE en plus par an" valeur={montant(r.ebeAn)} detail={`sur ${montant(ca)} de CA HT`} />
        <Indicateur libelle="Remboursé en" valeur={r.retourAnnees !== null ? `${unChiffre(r.retourAnnees)} an${r.retourAnnees >= 2 ? 's' : ''}` : 'Jamais'} detail="coût ÷ EBE en plus" />
        <Indicateur libelle="Résultat en plus par an" valeur={montant(r.resultatAn)} detail={`après ${montant(r.amortissement)} d’amortissement${r.interets ? ` et ${montant(r.interets)} d’intérêts` : ''}`} />
        <Indicateur libelle="Trésorerie la 1re année" valeur={ecartMontant(r.annee1.tresorerie)} detail={`${r.annee1.mois} mois en service`} />
      </Resultats>
    )
    const univers: Univers = e.modele === 'corner' ? 'cave' : e.modele === 'exterieur' ? 'exterieur' : e.univers
    ajout = {
      investissements: [{ libelle: (e.libelle || 'Investissement').slice(0, 60), type: 'equipement', montant: Math.round(cout), mois: e.mois, duree: Math.max(1, Math.round(e.duree)) }],
      ...(pret ? { emprunts: [{ libelle: `Prêt ${e.libelle || ''}`.trim().slice(0, 60), montant: Math.round(cout), taux: e.tauxPret, duree: e.dureePret, premiereEcheance: Math.min(12, e.mois + 1) }] } : {}),
      ...(ca > 0 ? { ajustementsCA: [{ libelle: (e.libelle || 'Investissement').slice(0, 60), univers, de: e.mois, a: 12, montant: Math.round(ca / 12) }] } : {}),
    }
    note = `Au budget, le CA en plus entre dans ${univers === 'cave' ? 'la Cave' : univers === 'bar' ? 'le Bar' : 'l’Extérieur'} à sa marge${charges > 0 ? ' ; les charges en plus se saisissent dans les Frais ou l’Équipe' : ''}.`
  }

  if (choisi === 'exterieur') {
    const e = etats.exterieur
    // 162 · prix de livraison de la grille du siège (km aller simple, commande moyenne d'une livraison), modifiable
    const commande = e.livraisons > 0 ? e.futs / e.livraisons * Math.max(0, e.prixVente - e.remise) : 0
    const prixGrille = s.livraison.length ? prixLivraisonGrille(s.livraison, e.km / 2, commande) : null
    const prixLivraison = e.prixLivraison ?? prixGrille ?? 0
    const r = simulerExterieur({
      futs: e.futs, prixVente: e.prixVente, remise: e.remise, prixAchat: e.prixAchat, co2: e.co2, gobelets: 0, gobeletsContrat: { nombre: e.nbGobelets, prix: e.prixGobelet },
      tireuse: e.tireuse, prixTireuse: e.prixTireuse, dureeTireuse: e.duree, entretien: e.entretien,
      livraisons: e.livraisons, km: e.km, prixKm: e.prixKm, heures: e.heures, coutHoraire: heure(e),
      don: { type: e.don, montant: e.montantDon, futs: e.futsDon, cerfa: e.cerfa },
      prixLivraison, sponsoring: e.sponsoring ? { montant: e.sponsoMontant, parFut: e.sponsoParFut } : undefined,
      materiel: e.materiel, astreinte: e.astreinte, locations: { nombre: e.locations, prix: e.prixLocation }, dureeContrat: e.dureeContrat,
    }, p, s.donMecenat)
    const ans = (v: number) => `${unChiffre(v)} an${v >= 2 ? 's' : ''}`
    const contratCourt = r.resteNonAmorti > 0
    const margeExt = margeFut(Math.max(0, e.prixVente - e.remise), e.prixAchat)
    const m = (k: keyof Etats['exterieur']) => (v: number) => maj('exterieur', { [k]: v })
    // Facturé à un organisateur (B2B) : tout en HT (Joseph, 14/11/2026). Le TTC ne sert qu'à la vente au client final.
    const moins = (v: number) => ({ valeur: `− ${montant(v)}`, negatif: false })
    const donSponso = r.don.cout + r.sponsoring + r.retrocession
    saisies = (
      <Stack spacing={2}>
        <Bloc titre="Le contrat">
          <Saisies>
            <Texte libelle="Contrat" aria="Nom du contrat" valeur={e.nom} onChange={(v) => maj('exterieur', { nom: v })} />
            <Montant libelle="Fûts vendus par an" valeur={e.futs} onChange={(v) => maj('exterieur', { futs: Math.round(v) })} unite="" />
            <Montant libelle="Durée du contrat" valeur={e.dureeContrat} onChange={m('dureeContrat')} unite="ans" />
          </Saisies>
        </Bloc>
        <Bloc titre="1. Recettes" total={{ libelle: 'CA HT de l’année', valeur: montant(r.ca) }}>
          <Saisies>
            <Montant libelle="Prix de vente du fût HT" valeur={e.prixVente} onChange={m('prixVente')} />
            <Montant libelle="Remise accordée HT" valeur={e.remise} onChange={m('remise')} />
            <Montant libelle="Livraison facturée HT" valeur={prixLivraison} onChange={(v) => maj('exterieur', { prixLivraison: v })} />
            <Montant libelle="Locations de tireuse facturées" valeur={e.locations} onChange={(v) => maj('exterieur', { locations: Math.round(v) })} unite="" />
            {e.locations > 0 && <Montant libelle="Prix d’une location HT" valeur={e.prixLocation} onChange={m('prixLocation')} />}
          </Saisies>
          <Typography color="text.secondary">
            {entier(e.futs)} fûts à {centimes(r.caParFut)} : {montant(e.futs * r.caParFut)}{r.livraisonsFacturees > 0 ? `, ${entier(e.livraisons)} livraisons facturées : ${montant(r.livraisonsFacturees)}` : ''}{r.recettes - r.livraisonsFacturees > 0 ? `, locations : ${montant(r.recettes - r.livraisonsFacturees)}` : ''}.
            {prixGrille !== null && e.prixLivraison === null && ` Livraison au prix de la grille du siège : ${prixGrille ? montant(prixGrille) : 'offerte'} pour ${unChiffre(e.km / 2)} km et ${montant(commande)} commandés par livraison.`}
          </Typography>
          {e.prixLivraison !== null && prixGrille !== null && <Box><Button onClick={() => maj('exterieur', { prixLivraison: null })} sx={{ minHeight: 48 }}>Reprendre le prix de la grille ({montant(prixGrille)})</Button></Box>}
        </Bloc>
        <Bloc titre="2. Fûts" total={{ libelle: 'Coût de l’année', ...moins(r.coutFuts) }}>
          <Saisies>
            <Montant libelle="Prix d’achat du fût HT" valeur={e.prixAchat} onChange={m('prixAchat')} />
            <Montant libelle="CO2 par fût HT" valeur={e.co2} onChange={m('co2')} source={e.co2 > 0 && e.co2 === initiaux.exterieur.co2 && 'siège'} />
          </Saisies>
          <Typography color="text.secondary">Marge par fût : {centimes(margeExt.valeur)}{margeExt.taux !== null ? ` (${taux(margeExt.taux)} du prix de vente)` : ''}. Net par fût : {centimes(r.netParFut)}, après CO2{e.sponsoring && e.sponsoParFut ? ', rétrocession' : ''} et {centimes(r.redevanceParFut)} de redevance et publicité.</Typography>
        </Bloc>
        <Bloc titre="3. Tireuse" total={{ libelle: 'Par an', ...moins(r.tireuseAn) }}>
          <Saisies>
            <Choix libelle="Tireuse" valeur={e.tireuse} onChange={(v) => maj('exterieur', { tireuse: v })} options={[['neuve', 'À acheter'], ['parc', 'Déjà dans le parc']]} />
            {e.tireuse === 'neuve' && <><Montant libelle="Prix de la tireuse HT" valeur={e.prixTireuse} onChange={m('prixTireuse')} /><Montant libelle="Durée de vie" valeur={e.duree} onChange={m('duree')} unite="ans" /></>}
            <Montant libelle="Entretien par an HT" valeur={e.entretien} onChange={m('entretien')} />
          </Saisies>
          {contratCourt && <Typography color="text.secondary">Contrat de {ans(e.dureeContrat)} pour une tireuse de {ans(e.duree)} : elle est payée sur le contrat, {montant(r.tireuseAn)} par an au lieu de {montant(r.tireuseAnDureeVie)}. Si le client part à la fin, il reste {montant(r.resteNonAmorti)} non amortis.</Typography>}
        </Bloc>
        <Bloc titre="4. Livraisons" total={{ libelle: 'Par an', ...moins(r.livraisonsAn) }}>
          <Saisies>
            <Montant libelle="Livraisons par an" valeur={e.livraisons} onChange={(v) => maj('exterieur', { livraisons: Math.round(v) })} unite="" />
            <Montant libelle="Kilomètres aller-retour" valeur={e.km} onChange={m('km')} unite="km" />
            <Montant libelle="Prix du kilomètre HT" valeur={e.prixKm} onChange={m('prixKm')} unite="€/km" source={e.prixKm > 0 && e.prixKm === initiaux.exterieur.prixKm && 'siège'} />
            <Montant libelle="Heures par livraison" valeur={e.heures} onChange={m('heures')} unite="h" />
          </Saisies>
          <Saisies>
            <CoutHeure e={e} valeur={heure(e)} equipeSaisie={heureEquipe !== null} repere={parametresSimulateurs(p).coutHoraire > 0} onChange={(v) => maj('exterieur', v)} />
          </Saisies>
          <Typography color="text.secondary">
            Une livraison coûte {centimes(r.coutLivraison)} HT : {centimes(r.kmLivraison)} d’indemnités kilométriques ({unChiffre(e.km)} km à {centimes(e.prixKm)}) et {centimes(r.tempsLivraison)} de temps ({unChiffre(e.heures)} h à {centimes(heure(e))}).{r.livraisonsFacturees > 0 ? ` Facturées : ${montant(r.livraisonsFacturees)}, net ${r.netLivraisons >= 0 ? '' : 'de − '}${montant(Math.abs(r.netLivraisons))} après redevance et publicité.` : ' Rien de facturé.'}
          </Typography>
        </Bloc>
        <Bloc titre="5. Matériel, gobelets et astreinte" total={{ libelle: 'Par an', ...moins(r.materiel + r.gobeletsAn + r.astreinte) }}>
          <Saisies>
            <Montant libelle="Matériel prêté par an HT" valeur={e.materiel} onChange={m('materiel')} />
            <Montant libelle="Gobelets fournis par an" valeur={e.nbGobelets} onChange={(v) => maj('exterieur', { nbGobelets: Math.round(v) })} unite="" />
            <Montant libelle="Prix d’un gobelet HT" valeur={e.prixGobelet} onChange={m('prixGobelet')} />
            <Montant libelle="Heures d’astreinte par an" valeur={e.astreinte} onChange={m('astreinte')} unite="h" />
          </Saisies>
        </Bloc>
        <Bloc titre="6. Don ou sponsoring à l’association" total={{ libelle: 'Par an', ...moins(donSponso) }}>
          <Saisies>
            <Choix libelle="Don" valeur={e.don} onChange={(v) => maj('exterieur', { don: v })} options={[['aucun', 'Aucun'], ['argent', 'En argent'], ['nature', 'En fûts']]} />
            {e.don === 'argent' && <Montant libelle="Montant du don" valeur={e.montantDon} onChange={m('montantDon')} />}
            {e.don === 'nature' && <Montant libelle="Fûts offerts" valeur={e.futsDon} onChange={(v) => maj('exterieur', { futsDon: Math.round(v) })} unite="" />}
            {e.don !== 'aucun' && s.donMecenat && <FormControlLabel control={<Checkbox sx={{ width: 48, height: 48 }} checked={e.cerfa} onChange={(x) => maj('exterieur', { cerfa: x.target.checked })} />} label="Reçu Cerfa demandé" sx={{ minHeight: 48, mr: 0 }} />}
          </Saisies>
          <Saisies>
            <FormControlLabel control={<Checkbox sx={{ width: 48, height: 48 }} checked={e.sponsoring} onChange={(x) => maj('exterieur', { sponsoring: x.target.checked })} />} label="Sponsoring (contrepartie publicitaire)" sx={{ minHeight: 48, mr: 0 }} />
            {e.sponsoring && <>
              <Montant libelle="Somme versée HT" valeur={e.sponsoMontant} onChange={m('sponsoMontant')} />
              <Montant libelle="Rétrocession par fût HT" valeur={e.sponsoParFut} onChange={m('sponsoParFut')} />
            </>}
          </Saisies>
        </Bloc>
      </Stack>
    )
    nomParDefaut = `${e.nom || 'Contrat extérieur'}, ${e.futs} fûts`
    phrase = r.netParFut <= 0
      ? `${nomParDefaut} : chaque fût fait perdre ${centimes(-r.netParFut)}, le prix ne couvre pas l’achat et la redevance.`
      : `${nomParDefaut} : ${centimes(r.netParFut)} nets par fût, ${montant(r.coutFixe)} de coûts fixes${r.recettes ? `, ${montant(r.recettes)} de livraisons et locations facturées` : ''}, équilibre à ${r.equilibre} fûts ; ${r.gain >= 0 ? `gain de ${montant(r.gain)}` : `perte de ${montant(-r.gain)}`} au volume prévu.${contratCourt ? ` Tireuse payée sur les ${ans(e.dureeContrat)} du contrat : ${montant(r.resteNonAmorti)} non amortis si le client part${r.equilibreDureeVie !== null ? `, équilibre à ${r.equilibreDureeVie} fûts si elle ressert ailleurs` : ''}.` : ''}`
    resultats = (
      <Stack spacing={2}>
      <Compte titre="Compte de l’année" lignes={[
          { libelle: 'Recettes', valeur: r.ca, detail: 'CA HT' },
          { libelle: 'Fûts', valeur: -r.coutFuts, detail: 'achat et CO2' },
          { libelle: 'Redevance et publicité', valeur: -r.redevance },
          { libelle: 'Tireuse', valeur: -r.tireuseAn },
          { libelle: 'Livraisons', valeur: -r.livraisonsAn },
          { libelle: 'Matériel, gobelets et astreinte', valeur: -(r.materiel + r.gobeletsAn + r.astreinte) },
          { libelle: 'Don ou sponsoring', valeur: -donSponso, detail: r.don.reduction ? 'réduction d’impôt déduite' : undefined },
        ]} total={{ libelle: r.gain >= 0 ? 'Gain de l’année' : 'Perte de l’année', valeur: r.gain }} />
      <Resultats>
        <Indicateur libelle="Marge par fût" valeur={centimes(margeExt.valeur)} detail={margeExt.taux !== null ? `HT, ${taux(margeExt.taux)} du prix de vente HT après remise` : 'pas de prix de vente'} />
        <Indicateur libelle="Net par fût" valeur={centimes(r.netParFut)} detail={`HT, après achat, CO2 et ${centimes(r.redevanceParFut)} de redevance et publicité`} />
        <Indicateur libelle="Coûts fixes de l’année" valeur={montant(r.coutFixe)} detail={`tireuse ${montant(r.tireuseAn)}, livraisons ${montant(r.livraisonsAn)}${r.don.valeur ? `, don ${montant(r.don.cout)}` : ''}${r.sponsoring ? `, sponsoring ${montant(r.sponsoring)}` : ''}${r.materiel ? `, matériel ${montant(r.materiel)}` : ''}${r.gobeletsAn ? `, gobelets ${montant(r.gobeletsAn)}` : ''}${r.astreinte ? `, astreinte ${montant(r.astreinte)}` : ''}`} />
        {r.recettes > 0 && <Indicateur libelle="Livraisons et locations facturées" valeur={montant(r.recettes)} detail={`HT, ${montant(r.recettesNettes)} après redevance et publicité`} />}
        <Indicateur libelle="Fûts pour l’équilibre" valeur={r.equilibre !== null ? entier(r.equilibre) : 'Jamais'} detail={r.equilibre !== null ? `${e.futs} prévus` : 'Le fût ne rapporte rien'} />
        <Indicateur libelle={r.gain >= 0 ? 'Gain de l’année' : 'Perte de l’année'} valeur={montant(Math.abs(r.gain))} detail={`sur ${montant(r.ca)} de CA HT`} />
        {r.gainContrat !== null && <Indicateur libelle={r.gainContrat >= 0 ? 'Gain sur la durée du contrat' : 'Perte sur la durée du contrat'} valeur={montant(Math.abs(r.gainContrat))} detail={`${ans(e.dureeContrat)} au volume prévu`} />}
        {contratCourt && <Indicateur libelle="Reste non amorti en fin de contrat" valeur={montant(r.resteNonAmorti)} detail={`tireuse de ${ans(e.duree)}, à payer dans les ${ans(e.dureeContrat)} du contrat ; perdu si elle ne ressert pas`} />}
        {contratCourt && r.equilibreDureeVie !== null && <Indicateur libelle="Équilibre si la tireuse ressert" valeur={entier(r.equilibreDureeVie)} detail={`fûts par an, tireuse amortie sur ${ans(e.duree)}`} />}
        {r.remiseMax !== null && <Indicateur libelle="Remise maximale par fût" valeur={centimes(r.remiseMax)} detail={`HT ; au-delà, ${e.futs} fûts ne paient plus les coûts fixes`} />}
        {r.prixPlancherLivraison !== null && r.coutLivraison > 0 && <Indicateur libelle="Prix plancher d’une livraison" valeur={centimes(r.prixPlancherLivraison)} detail={`HT, pour couvrir ${centimes(r.coutLivraison)} de route et de temps`} />}
        {r.don.valeur > 0 && <Indicateur libelle="Coût réel du don" valeur={montant(r.don.cout)} detail={r.don.reduction ? `${montant(r.don.valeur)} moins ${taux(TAUX_MECENAT)} de réduction d’impôt` : s.donMecenat ? 'sans reçu Cerfa, pas de réduction' : 'sans réduction d’impôt'} />}
      </Resultats>
      {/* 239 : le gain selon le nombre de fûts, comme dans la fiche « Rentabilité Extérieur » */}
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Gain selon le nombre de fûts" sx={{ minWidth: 420, maxWidth: 560, '& td, & th': { fontVariantNumeric: 'tabular-nums' } }}>
          <TableHead><TableRow><TableCell>Fûts vendus</TableCell><TableCell align="right">CA HT</TableCell><TableCell align="right">Gain de l’année</TableCell></TableRow></TableHead>
          <TableBody>
            {gainsSelonFuts(r, e.futs).map((l) => (
              <TableRow key={l.futs} selected={l.prevu}>
                <TableCell sx={{ fontWeight: l.prevu || l.seuil ? 700 : undefined }}>{entier(l.futs)}{l.prevu ? ', prévus' : ''}{l.seuil ? ', équilibre' : ''}</TableCell>
                <TableCell align="right">{montant(l.ca)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: l.gain < 0 ? 'error.main' : 'success.dark' }}>{l.gain < 0 ? '− ' : '+ '}{montant(Math.abs(l.gain))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      </Stack>
    )
  }
  if (choisi === 'tireuses') {
    const e = etats.tireuses
    const x = etats.exterieur
    // Prix de vente TTC (PVC) et prix d'achat HT du fût (Joseph, 14/11/2026) : repris du Contrat extérieur (prix après remise), modifiables ;
    // le net par fût en découle (moins redevance et publicité et CO2 du contrat).
    const tvaFut = s.tva.normale
    const prixVenteTTC = e.prixVente ?? Math.round(Math.max(0, x.prixVente - x.remise) * (1 + tvaFut) * 100) / 100
    const prixVente = prixVenteTTC / (1 + tvaFut)
    const prixAchat = e.prixAchat ?? x.prixAchat
    const fut = simulerExterieur({ futs: x.futs, prixVente, remise: 0, prixAchat, co2: x.co2, gobelets: 0, tireuse: 'parc', prixTireuse: 0, dureeTireuse: 1, entretien: 0, livraisons: 0, km: 0, prixKm: 0, heures: 0, coutHoraire: 0, don: { type: 'aucun', montant: 0, futs: 0, cerfa: false } }, p, false)
    const net = fut.netParFut
    const marge = margeFut(prixVente, prixAchat)
    const occupation = e.saisie === 'occupation' ? { saison: e.occSaison, hors: e.occHors } : null
    const r = simulerParc({ tireuses: e.tireuses, semainesSaison: e.semaines, sortiesSaison: e.sortiesSaison, sortiesHorsSaison: e.sortiesHors, refus: e.refus, futsParSortie: e.futsParSortie, netParFut: net, prixNeuve: e.prixNeuve, dureeVie: e.duree, entretien: e.entretien, vieilles: e.vieilles, occupation, saturation: s.tireuses.saturation, prixVenteHT: prixVente, margeParFut: marge.valeur })
    const m = (k: keyof Etats['tireuses']) => (v: number) => maj('tireuses', { [k]: v })
    const vieille = (i: number, v: Partial<Etats['tireuses']['vieilles'][number]>) => maj('tireuses', { vieilles: e.vieilles.map((y, j) => (j === i ? { ...y, ...v } : y)) })
    saisies = (
      <Stack spacing={2}>
        <Bloc titre="1. Mon parc et ses locations">
        <Saisies>
          <Montant libelle="Tireuses" valeur={e.tireuses} onChange={(v) => maj('tireuses', { tireuses: Math.round(v) })} unite="" source={tireusesParc !== null && e.tireuses === tireusesParc && 'équipements'} />
          <Montant libelle="Week-ends de saison" valeur={e.semaines} onChange={(v) => maj('tireuses', { semaines: Math.min(52, Math.max(0, Math.round(v))) })} unite="" />
          <Choix libelle="Occupation" valeur={e.saisie} onChange={(v) => maj('tireuses', { saisie: v })} options={[['occupation', 'En part des week-ends'], ['sorties', 'En sorties de l’année']]} />
        </Saisies>
        <Saisies>
          {e.saisie === 'occupation' ? <>
            <Taux libelle="Week-ends loués en saison" valeur={e.occSaison} onChange={(v) => maj('tireuses', { occSaison: Math.min(1, v) })} />
            <Taux libelle="Week-ends loués le reste de l’année" valeur={e.occHors} onChange={(v) => maj('tireuses', { occHors: Math.min(1, v) })} />
          </> : <>
            <Montant libelle="Sorties en saison" valeur={e.sortiesSaison} onChange={(v) => maj('tireuses', { sortiesSaison: Math.round(v) })} unite="" />
            <Montant libelle="Sorties hors saison" valeur={e.sortiesHors} onChange={(v) => maj('tireuses', { sortiesHors: Math.round(v) })} unite="" />
          </>}
          <Montant libelle="Week-ends refusés faute de tireuse" valeur={e.refus} onChange={(v) => maj('tireuses', { refus: Math.round(v) })} unite="" />
          <Montant libelle="Fûts par week-end loué" valeur={e.futsParSortie} onChange={m('futsParSortie')} unite="" />
        </Saisies>
        </Bloc>
        <Bloc titre="2. Ce que rapporte un fût" total={{ libelle: 'Net par fût', valeur: centimes(net), negatif: net < 0 }}>
        <Saisies>
          <Montant libelle="Prix de vente du fût TTC" valeur={prixVenteTTC} onChange={(v) => maj('tireuses', { prixVente: v })} />
          <Montant libelle="Prix d’achat du fût HT" valeur={prixAchat} onChange={(v) => maj('tireuses', { prixAchat: v })} />
        </Saisies>
        <Typography color="text.secondary">Marge par fût : {centimes(marge.valeur)} HT{marge.taux !== null ? `, soit ${taux(marge.taux)} du prix de vente HT (${centimes(prixVente)})` : ''}. Net par fût : {centimes(net)}, après {centimes(fut.redevanceParFut)} de redevance et publicité, et CO2.</Typography>
        </Bloc>
        <Bloc titre="3. Ce que coûte une tireuse de plus" total={{ libelle: 'Par an', valeur: `− ${montant(r.coutAnnuelNeuve)}` }}>
        <Saisies>
          <Montant libelle="Prix d’une tireuse neuve HT" valeur={e.prixNeuve} onChange={m('prixNeuve')} />
          <Montant libelle="Durée de vie" valeur={e.duree} onChange={m('duree')} unite="ans" />
          <Montant libelle="Entretien par an HT" valeur={e.entretien} onChange={m('entretien')} />
        </Saisies>
        </Bloc>
        <Bloc titre="4. Tireuses qui vieillissent">
        {e.vieilles.map((v, i) => (
          <Saisies key={i}>
            <Texte libelle="Tireuse" aria={`Nom de la tireuse ${i + 1}`} valeur={v.nom} onChange={(nom) => vieille(i, { nom })} largeur={160} />
            <MontantDe libelle="Âge" aria={`Âge de la tireuse ${i + 1}`} valeur={v.age} onChange={(age) => vieille(i, { age })} unite="ans" />
            <MontantDe libelle="Réparations de l’année HT" aria={`Réparations de la tireuse ${i + 1}`} valeur={v.reparations} onChange={(reparations) => vieille(i, { reparations })} />
            <Button color="inherit" startIcon={<DeleteOutlineOutlined />} onClick={() => maj('tireuses', { vieilles: e.vieilles.filter((_, j) => j !== i) })} aria-label={`Retirer la tireuse ${i + 1}`} sx={{ minHeight: 48 }}>Retirer</Button>
          </Saisies>
        ))}
        <Box><Button startIcon={<AddOutlined />} onClick={() => maj('tireuses', { vieilles: [...e.vieilles, { nom: `Tireuse ${e.vieilles.length + 1}`, age: 5, reparations: 0 }] })} sx={{ minHeight: 48 }}>Ajouter une tireuse</Button></Box>
        </Bloc>
      </Stack>
    )
    nomParDefaut = `Parc de ${e.tireuses} tireuse${e.tireuses > 1 ? 's' : ''}`
    const payer = r.futsPourPayer !== null && r.weekendsPourPayer !== null ? `Une tireuse de plus se paie avec ${entier(r.futsPourPayer)} fûts, soit ${entier(r.weekendsPourPayer)} week-ends loués par an. ` : ''
    const parc = r.futsParc > 0 ? `Le parc vend environ ${entier(r.futsParc)} fûts par an : ${montant(r.caParc)} de CA HT, ${montant(r.margeParc)} de marge. ` : ''
    phrase = `${parc}${payer}Chaque tireuse est louée environ ${entier(r.weekendsParTireuse)} week-ends par an. ${e.refus ? `${e.refus} week-ends refusés : ${r.racheter ? 'racheter une tireuse.' : 'pas assez pour racheter.'}` : r.sature ? 'Parc plein en saison : note les week-ends refusés pour décider.' : 'Aucun week-end refusé : pas besoin de racheter.'}${r.aRemplacer.length ? ` Remplacer ${r.aRemplacer.join(', ')} : ses réparations dépassent le coût d’une neuve.` : ''}`
    resultats = (
      <Resultats>
        <Indicateur libelle="Ce que rapporte le parc" valeur={`${montant(r.caParc)} HT`} detail={`par an, ${entier(r.futsParc)} fûts, marge ${montant(r.margeParc)}, net ${montant(r.netParc)} après redevance et CO2`} />
        <Indicateur libelle="Pour payer une tireuse de plus" valeur={r.futsPourPayer === null ? '–' : `${entier(r.futsPourPayer)} fûts par an`} detail={r.weekendsPourPayer === null ? 'le fût ne rapporte rien' : `soit ${entier(r.weekendsPourPayer)} week-ends loués, ${montant(r.coutAnnuelNeuve)} par an d’amortissement et d’entretien`} />
        <Indicateur libelle="Week-ends loués par tireuse" valeur={`${entier(r.weekendsParTireuse)} par an`} detail={`${r.occupationSaison === null ? '–' : taux(r.occupationSaison)} en saison, ${r.occupationHorsSaison === null ? '–' : taux(r.occupationHorsSaison)} le reste de l’année`}
          ecart={r.sature ? { texte: 'Plein en saison', hausse: true, favorable: true } : undefined} />
        <Indicateur libelle="Gain d’une tireuse" valeur={montant(r.gainParTireuse)} detail="par an, à cette occupation" />
        <Indicateur libelle="Racheter une tireuse" valeur={r.racheter ? 'Oui' : 'Non'} detail={e.refus ? `${montant(r.margePerdue)} de marge perdue sur ${e.refus} week-ends refusés` : r.sature ? `au-delà de ${taux(s.tireuses.saturation)} des week-ends en saison, on refuse des clients` : 'aucun week-end refusé'} />
      </Resultats>
    )
  }
  if (choisi === 'pression') {
    const e = etats.pression
    const tva = s.tva.normale
    const carte = cartePression(e.becs, tva, s.pression.cibleMarge, s.pression.joursFraicheur)
    const bec = (i: number, v: Partial<Bec>) => maj('pression', { becs: e.becs.map((y, j) => (j === i ? { ...y, ...v } : y)) })
    const nouveau = (v: Partial<Bec>) => maj('pression', { nouveau: { ...e.nouveau, ...v } })
    const champsBec = (b: Bec, quoi: string, changer: (v: Partial<Bec>) => void) => (
      <Saisies>
        <Texte libelle="Bière" aria={`Bière, ${quoi}`} valeur={b.biere} onChange={(biere) => changer({ biere })} largeur={170} />
        <MontantDe libelle="Prix du fût HT" aria={`Prix du fût HT, ${quoi}`} valeur={b.prixFut} onChange={(prixFut) => changer({ prixFut })} />
        <MontantDe libelle="Litres" aria={`Litres du fût, ${quoi}`} valeur={b.litres} onChange={(litres) => changer({ litres })} unite="l" largeur={100} />
        <TauxDe libelle="Perte" aria={`Perte, ${quoi}`} valeur={b.perte} onChange={(perte) => changer({ perte })} />
        <MontantDe libelle="Demi TTC" aria={`Prix du demi TTC, ${quoi}`} valeur={b.prixDemi} onChange={(prixDemi) => changer({ prixDemi })} largeur={110} />
        <MontantDe libelle="33 cl TTC" aria={`Prix du 33 cl TTC, ${quoi}`} valeur={b.prix33 ?? 0} onChange={(prix33) => changer({ prix33 })} largeur={110} />
        <MontantDe libelle="Pinte TTC" aria={`Prix de la pinte TTC, ${quoi}`} valeur={b.prixPinte} onChange={(prixPinte) => changer({ prixPinte })} largeur={110} />
        <MontantDe libelle="Demis par semaine" aria={`Demis par semaine, ${quoi}`} valeur={b.demis} onChange={(demis) => changer({ demis: Math.round(demis) })} unite="" largeur={110} />
        <MontantDe libelle="33 cl par semaine" aria={`Verres de 33 cl par semaine, ${quoi}`} valeur={b.verres33 ?? 0} onChange={(verres33) => changer({ verres33: Math.round(verres33) })} unite="" largeur={110} />
        <MontantDe libelle="Pintes par semaine" aria={`Pintes par semaine, ${quoi}`} valeur={b.pintes} onChange={(pintes) => changer({ pintes: Math.round(pintes) })} unite="" largeur={110} />
      </Saisies>
    )
    const vueChoix = <Saisies><Choix libelle="Je regarde" valeur={e.vue ?? 'carte'} onChange={(v) => maj('pression', { vue: v })} options={[['carte', 'Ma carte pression'], ['audit', 'La perte sur une semaine']]} /></Saisies>
    const projet = e.projet ? nouveauBec(e.becs, e.nouveau, { cout: e.cout, cannibalisation: e.cannibalisation, remplace: e.mode === 'remplacer' && e.becs[e.remplace] ? e.remplace : null }, tva) : null
    saisies = (
      <Stack spacing={2}>
        {vueChoix}
        {e.becs.map((b, i) => {
          const l = carte.lignes[i]
          return (
            <Bloc key={i} titre={`Bec ${i + 1}`} total={{ libelle: 'Marge du bec', valeur: `${l.tauxMarge === null ? '–' : taux(l.tauxMarge)} · ${montant(l.margeSemaine)} par semaine`, negatif: l.sousCible }}>
              {champsBec(b, `bec ${i + 1}`, (v) => bec(i, v))}
              {e.becs.length > 1 && <Box><Button color="inherit" startIcon={<DeleteOutlineOutlined />} onClick={() => maj('pression', { becs: e.becs.filter((_, j) => j !== i), remplace: 0 })} aria-label={`Retirer le bec ${i + 1}`} sx={{ minHeight: 48 }}>Retirer ce bec</Button></Box>}
            </Bloc>
          )
        })}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {e.becs.length < 20 && <Button startIcon={<AddOutlined />} onClick={() => maj('pression', { becs: [...e.becs, { ...e.becs[e.becs.length - 1], biere: `Bière ${e.becs.length + 1}` }] })} sx={{ minHeight: 48 }}>Ajouter un bec</Button>}
          <FormControlLabel control={<Checkbox sx={{ width: 48, height: 48 }} checked={e.projet} onChange={(x) => maj('pression', { projet: x.target.checked })} />} label="Projet : ajouter ou remplacer un bec" sx={{ minHeight: 48, mr: 0 }} />
        </Box>
        {e.projet && (
          <Bloc titre="Projet de bec" total={projet ? { libelle: 'Gain', valeur: `${ecartMontant(projet.gainSemaine)} par semaine`, negatif: projet.gainSemaine < 0 } : undefined}>
            <Saisies>
              <Choix libelle="Je veux" valeur={e.mode} onChange={(v) => maj('pression', { mode: v })} options={[['ajouter', 'Ajouter un bec'], ['remplacer', 'Remplacer un bec']]} />
              {e.mode === 'remplacer' && (
                <Champ libelle="Bec remplacé">
                  <TextField select size="small" value={Math.min(e.remplace, e.becs.length - 1)} onChange={(x) => maj('pression', { remplace: Number(x.target.value) })} slotProps={{ htmlInput: { 'aria-label': 'Bec remplacé' } }} sx={{ ...champ, width: 200 }}>
                    {e.becs.map((b, i) => <MenuItem key={i} value={i}>Bec {i + 1} · {b.biere}</MenuItem>)}
                  </TextField>
                </Champ>
              )}
              <Montant libelle="Coût d’installation HT" valeur={e.cout} onChange={(v) => maj('pression', { cout: v })} />
              <Taux libelle="Part prise aux autres becs" valeur={e.cannibalisation} onChange={(v) => maj('pression', { cannibalisation: v })} />
            </Saisies>
            {champsBec(e.nouveau, 'nouveau bec', nouveau)}
          </Bloc>
        )}
      </Stack>
    )
    const faible = carte.faible !== null ? carte.lignes[carte.faible] : null
    const fb = carte.faible !== null ? e.becs[carte.faible] : null
    nomParDefaut = `Carte pression, ${e.becs.length} bec${e.becs.length > 1 ? 's' : ''}`
    phrase = faible && fb
      ? `Le bec ${carte.faible! + 1} (${fb.biere}) rapporte ${montant(faible.margeSemaine)} par semaine à ${faible.tauxMarge === null ? '–' : taux(faible.tauxMarge)} de marge${faible.joursPourVider !== null ? ` et met ${entier(faible.joursPourVider)} jours à vider un fût` : ''} : ${faible.sousCible && faible.hausseCible !== null ? `monte ses prix de ${taux(faible.hausseCible)} (demi à ${centimes(fb.prixDemi * (1 + faible.hausseCible))})` : 'change de bière ou de taille de fût'}${faible.vieillit && faible.sousCible ? ', ou remplace-le' : ''}.`
      : `${montant(carte.margeSemaine)} de marge par semaine sur la pression${carte.tauxMarge !== null ? `, ${taux(carte.tauxMarge)}` : ''}, ${unChiffre(carte.futsParMois)} fûts par mois.`
    if (projet) phrase += ` ${e.mode === 'ajouter' ? 'Ajouter' : 'Remplacer par'} ${e.nouveau.biere || 'le nouveau bec'} : ${ecartMontant(projet.gainSemaine)} par semaine${projet.semainesRetour !== null ? `, installation remboursée en ${entier(projet.semainesRetour)} semaines` : ', jamais remboursé'}.`
    resultats = (
      <Stack spacing={2}>
        <Resultats>
          <Indicateur libelle="Marge par semaine" valeur={montant(carte.margeSemaine)} detail={`sur ${montant(carte.caSemaine)} de CA HT`} />
          <Indicateur libelle="Taux de marge pression" valeur={carte.tauxMarge === null ? '–' : taux(carte.tauxMarge)} detail={s.pression.cibleMarge > 0 ? `cible du réseau ${taux(s.pression.cibleMarge)}` : 'TVA ' + taux(tva)}
            ecart={s.pression.cibleMarge > 0 && carte.tauxMarge !== null ? { texte: ecartPts(carte.tauxMarge - s.pression.cibleMarge), hausse: carte.tauxMarge >= s.pression.cibleMarge, favorable: carte.tauxMarge >= s.pression.cibleMarge } : undefined} />
          <Indicateur libelle="Fûts à commander" valeur={`${unChiffre(carte.futsParMois)} par mois`} detail="au rythme des ventes saisies" />
          {projet && <Indicateur libelle="Gain du projet" valeur={`${ecartMontant(projet.gainSemaine)} par semaine`} detail={`${montant(projet.margeNouveau)} de marge, ${montant(projet.perteCannibalisation + projet.perteRemplace)} pris aux autres becs`} />}
        </Resultats>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" aria-label="Becs de la carte pression" sx={{ minWidth: 640, '& td, & th': { fontVariantNumeric: 'tabular-nums' } }}>
            <TableHead><TableRow><TableCell>Bec</TableCell><TableCell align="right">CA HT par semaine</TableCell><TableCell align="right">Marge par semaine</TableCell><TableCell align="right">Taux de marge</TableCell><TableCell align="right">Coût du litre servi</TableCell><TableCell align="right">Jours pour vider un fût</TableCell><TableCell align="right">Fûts par mois</TableCell></TableRow></TableHead>
            <TableBody>
              {carte.lignes.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>{i + 1} · {e.becs[i].biere}</TableCell>
                  <TableCell align="right">{montant(l.caSemaine)}</TableCell>
                  <TableCell align="right">{montant(l.margeSemaine)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: l.sousCible ? 'error.main' : undefined }}>{l.tauxMarge === null ? '–' : taux(l.tauxMarge)}</TableCell>
                  <TableCell align="right">{l.coutLitre === null ? '–' : centimes(l.coutLitre)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: l.vieillit ? 700 : undefined, color: l.vieillit ? 'error.main' : undefined }}>{l.joursPourVider === null ? '–' : `${entier(l.joursPourVider)} j`}</TableCell>
                  <TableCell align="right">{l.futsParMois === null ? '–' : unChiffre(l.futsParMois)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Stack>
    )
  }
  // 161 · Perte réelle sur la pression, audit d'une semaine (remplace l'affichage de la carte)
  if (choisi === 'pression' && etats.pression.vue === 'audit') {
    const e = etats.pression
    const a = e.audit
    // CA toujours en HT (Joseph, 14/11/2026) ; une simulation gardée avant en TTC est ramenée au HT
    // Perte standard (Joseph, 14/11/2026) : 7 % par défaut, réglée dans Paramètres, modifiable ici
    const standard = a.standard ?? s.pression.perteStandard
    const caPression = a.caTTC !== undefined ? a.caTTC / (1 + s.tva.normale) : a.caHT
    const r = auditPression({ futs: a.futs, litres: a.litres, prixFut: a.prixFut, demis: a.demis, verres33: a.verres33, pintes: a.pintes, litresVendus1L: a.litres1L, offerts: a.offerts, caHT: caPression, standard })
    const au = (k: keyof typeof a) => (v: number) => maj('pression', { audit: { ...a, [k]: v } })
    saisies = (
      <Stack spacing={2}>
        <Saisies><Choix libelle="Je regarde" valeur="audit" onChange={(v) => maj('pression', { vue: v })} options={[['carte', 'Ma carte pression'], ['audit', 'La perte sur une semaine']]} /></Saisies>
        <Bloc titre="1. Sorti du stock" total={{ libelle: 'Litres', valeur: unChiffre(r.sortis) }}>
        <Saisies>
          <Montant libelle="Fûts vidés dans la semaine" valeur={a.futs} onChange={au('futs')} unite="" />
          <Montant libelle="Litres par fût" valeur={a.litres} onChange={au('litres')} unite="l" />
          <Montant libelle="Prix moyen du fût HT" valeur={a.prixFut} onChange={au('prixFut')} />
        </Saisies>
        </Bloc>
        <Bloc titre="2. Vendu et offert (caisse de la semaine)" total={{ libelle: 'Litres', valeur: unChiffre(r.vendus + a.offerts) }}>
        <Saisies>
          <Montant libelle="Demis 25 cl" valeur={a.demis} onChange={(v) => au('demis')(Math.round(v))} unite="" />
          <Montant libelle="Verres 33 cl" valeur={a.verres33} onChange={(v) => au('verres33')(Math.round(v))} unite="" />
          <Montant libelle="Pintes 50 cl" valeur={a.pintes} onChange={(v) => au('pintes')(Math.round(v))} unite="" />
          <Montant libelle="Pichets et mètres (litres)" valeur={a.litres1L} onChange={au('litres1L')} unite="l" />
          <Montant libelle="Offerts (litres)" valeur={a.offerts} onChange={au('offerts')} unite="l" />
          <Montant libelle="CA pression de la semaine HT" valeur={Math.round(caPression * 100) / 100} onChange={(v) => maj('pression', { audit: { ...a, caHT: v, caTTC: undefined } })} />
        </Saisies>
        </Bloc>
        <Bloc titre="3. Perte normale" total={{ libelle: 'Litres', valeur: unChiffre(r.perteStandard) }}>
        <Saisies>
          <Taux libelle="Perte standard" valeur={standard} onChange={(v) => maj('pression', { audit: { ...a, standard: Math.min(1, v) } })} />
          {a.standard != null && Math.abs(a.standard - s.pression.perteStandard) > 1e-9 && <Button onClick={() => maj('pression', { audit: { ...a, standard: null } })} sx={{ minHeight: 48 }}>Reprendre le standard du siège ({taux(s.pression.perteStandard)})</Button>}
        </Saisies>
        </Bloc>
      </Stack>
    )
    nomParDefaut = 'Audit pression d’une semaine'
    phrase = r.taux === null ? '' : r.ecart <= 0
      ? `${unChiffre(r.perte)} litres perdus sur ${unChiffre(r.sortis)} sortis du stock, soit ${taux(r.taux)} : dans la perte standard de ${taux(standard)}, rien à redresser.`
      : `${unChiffre(r.perte)} litres perdus sur ${unChiffre(r.sortis)} sortis, soit ${taux(r.taux)} pour ${taux(standard)} de perte standard : ${unChiffre(r.ecart)} litres de trop, ${montant(r.coutAn)} de bière payée pour rien et ${montant(r.caManqueAn)} de CA HT manqué sur un an.`
    resultats = r.taux === null ? null : (
      <Resultats>
        <Indicateur libelle="Écart à la perte standard" valeur={`${unChiffre(r.ecart)} litres`} detail={`${r.tauxEcart === null ? '–' : taux(r.tauxEcart)} des litres sortis, ${montant(r.coutSemaine)} HT cette semaine`}
          ecart={{ texte: ecartPts(r.taux - standard), hausse: r.taux > standard, favorable: r.taux <= standard }} />
        <Indicateur libelle="Perte réelle" valeur={`${unChiffre(r.perte)} litres`} detail={`${taux(r.taux)} sur ${unChiffre(r.sortis)} sortis, ${montant(r.coutPerte)} HT`} />
        <Indicateur libelle="Perte standard" valeur={`${unChiffre(r.perteStandard)} litres`} detail={`${taux(standard)} des litres sortis, ${montant(r.coutStandard)} HT`} />
        <Indicateur libelle="Bière payée pour rien" valeur={montant(r.coutAn)} detail="HT par an, sur l’écart seulement" />
        <Indicateur libelle="CA HT manqué" valeur={montant(r.caManqueAn)} detail="par an, sur l’écart, au prix moyen du litre vendu" />
      </Resultats>
    )
  }
  if (choisi === 'calculette') {
    const e = etats.calculette
    const tva = s.tva[e.tva]
    const cout = coutComposition(e.composants)
    // 160 · marge visée par famille, réglée par le siège : choisir la famille remplit la marge et la TVA
    const choisirFamille = (libelle: string) => {
      const f = s.familles.find((x) => `${x.univers}|${x.libelle}` === libelle)
      maj('calculette', f ? { famille: libelle, marge: f.marge, tva: f.tva, mode: e.mode === 'mix' ? 'mix' : 'prix' } : { famille: '' })
    }
    const famille = s.familles.find((x) => `${x.univers}|${x.libelle}` === e.famille) ?? null
    const entete = (
      <Bloc titre="1. Le produit">
      <Saisies>
        <Texte libelle="Produit" aria="Nom du produit" valeur={e.nom} onChange={(v) => maj('calculette', { nom: v })} />
        <Choix libelle="TVA" valeur={e.tva} onChange={(v) => maj('calculette', { tva: v })} options={[['normale', taux(s.tva.normale)], ['intermediaire', taux(s.tva.intermediaire)], ['reduite', taux(s.tva.reduite)]]} />
        <Choix libelle="Je cherche" valeur={e.mode} onChange={(v) => maj('calculette', { mode: v })} options={[['prix', 'Le prix de vente'], ['marge', 'La marge'], ['mix', 'La marge de plusieurs produits']]} />
        {s.familles.length > 0 && (
          <Champ libelle="Famille">
            <TextField select size="small" value={e.famille ?? ''} onChange={(x) => choisirFamille(x.target.value)} slotProps={{ htmlInput: { 'aria-label': 'Famille' } }} sx={{ ...champ, width: 220 }}>
              <MenuItem value="">Aucune</MenuItem>
              {s.familles.map((f) => <MenuItem key={`${f.univers}|${f.libelle}`} value={`${f.univers}|${f.libelle}`}>{f.univers === 'bar' ? 'Bar' : 'Cave'} · {f.libelle} ({taux(f.marge)})</MenuItem>)}
            </TextField>
          </Champ>
        )}
        {e.mode === 'prix' ? <Taux libelle="Marge visée" valeur={e.marge} onChange={(v) => maj('calculette', { marge: v })} /> : e.mode === 'marge' ? <Montant libelle="Prix de vente TTC" valeur={e.prixTTC} onChange={(v) => maj('calculette', { prixTTC: v })} /> : null}
      </Saisies>
      </Bloc>
    )
    if (e.mode === 'mix') {
      const lignes = e.mix ?? []
      const r = margeMix(lignes, tva)
      const ligneMix = (i: number, v: Partial<LigneMix>) => maj('calculette', { mix: lignes.map((y, j) => (j === i ? { ...y, ...v } : y)) })
      saisies = (
        <Stack spacing={2}>
          {entete}
          <Bloc titre="2. Les produits vendus ensemble">
          {lignes.map((l, i) => (
            <Saisies key={i}>
              <Texte libelle="Produit" aria={`Produit ${i + 1}`} valeur={l.libelle} onChange={(libelle) => ligneMix(i, { libelle })} largeur={180} />
              <MontantDe libelle="Coût HT" aria={`Coût HT du produit ${i + 1}`} valeur={l.cout} onChange={(v) => ligneMix(i, { cout: v })} />
              <MontantDe libelle="Consigne non reprise" aria={`Consigne du produit ${i + 1}`} valeur={l.consigne} onChange={(v) => ligneMix(i, { consigne: v })} />
              <MontantDe libelle="Prix TTC" aria={`Prix TTC du produit ${i + 1}`} valeur={l.prixTTC} onChange={(v) => ligneMix(i, { prixTTC: v })} />
              <MontantDe libelle="Quantité" aria={`Quantité du produit ${i + 1}`} valeur={l.quantite} onChange={(v) => ligneMix(i, { quantite: v })} unite="" largeur={100} />
              {lignes.length > 1 && <Button color="inherit" startIcon={<DeleteOutlineOutlined />} onClick={() => maj('calculette', { mix: lignes.filter((_, j) => j !== i) })} aria-label={`Retirer le produit ${i + 1}`} sx={{ minHeight: 48 }}>Retirer</Button>}
            </Saisies>
          ))}
          <Box>{lignes.length < 30 && <Button startIcon={<AddOutlined />} onClick={() => maj('calculette', { mix: [...lignes, { libelle: '', cout: 0, consigne: 0, prixTTC: 0, quantite: 1 }] })} sx={{ minHeight: 48 }}>Ajouter un produit</Button>}</Box>
          </Bloc>
        </Stack>
      )
      nomParDefaut = e.nom || 'Plusieurs produits'
      phrase = r.taux === null ? '' : `${nomParDefaut} : ${centimes(r.prixTTC)} TTC pour ${centimes(r.cout)} de coût HT, marge ${centimes(r.marge)} soit ${taux(r.taux)}${famille ? ` (${taux(famille.marge)} visés pour ${famille.libelle})` : ''}.`
      resultats = r.taux === null ? null : (
        <Resultats>
          <Indicateur libelle="Taux de marge" valeur={taux(r.taux)} detail={`${centimes(r.marge)} sur ${centimes(r.ca)} HT`}
            ecart={famille ? { texte: ecartPts(r.taux - famille.marge), hausse: r.taux >= famille.marge, favorable: r.taux >= famille.marge } : undefined} />
          <Indicateur libelle="Prix de l’ensemble TTC" valeur={centimes(r.prixTTC)} detail={`${lignes.length} produit${lignes.length > 1 ? 's' : ''}`} />
          <Indicateur libelle="Coût HT" valeur={centimes(r.cout)} detail="consignes comprises" />
        </Resultats>
      )
    } else {
    const r = e.mode === 'prix' ? prixPourMarge(cout, e.marge, tva) : margePourPrix(cout, e.prixTTC, tva)
    const comp = (i: number, v: Partial<Composant>) => maj('calculette', { composants: e.composants.map((y, j) => (j === i ? { ...y, ...v } : y)) })
    saisies = (
      <Stack spacing={2}>
        {entete}
        <Bloc titre="2. Ce qu’il coûte" total={{ libelle: 'Coût HT', valeur: centimes(cout) }}>
        {e.composants.map((c, i) => (
          <Saisies key={i}>
            <Texte libelle="Composant" aria={`Composant ${i + 1}`} valeur={c.libelle} onChange={(libelle) => comp(i, { libelle })} largeur={180} />
            <MontantDe libelle="Coût HT" aria={`Coût HT du composant ${i + 1}`} valeur={c.cout} onChange={(v) => comp(i, { cout: v })} />
            <MontantDe libelle="Quantité" aria={`Quantité du composant ${i + 1}`} valeur={c.quantite} onChange={(v) => comp(i, { quantite: v })} unite="" largeur={100} />
            {e.composants.length > 1 && <Button color="inherit" startIcon={<DeleteOutlineOutlined />} onClick={() => maj('calculette', { composants: e.composants.filter((_, j) => j !== i) })} aria-label={`Retirer le composant ${i + 1}`} sx={{ minHeight: 48 }}>Retirer</Button>}
          </Saisies>
        ))}
        <Box>{e.composants.length < 30 && <Button startIcon={<AddOutlined />} onClick={() => maj('calculette', { composants: [...e.composants, { libelle: '', cout: 0, quantite: 1 }] })} sx={{ minHeight: 48 }}>Ajouter un composant</Button>}</Box>
        </Bloc>
      </Stack>
    )
    nomParDefaut = e.nom || 'Prix et marge'
    if (r) {
      phrase = `${nomParDefaut} : ${centimes(r.cout)} de coût HT, vendu ${centimes(r.prixTTC)} TTC (${centimes(r.prixHT)} HT), marge ${centimes(r.marge)}${r.tauxMarge !== null ? ` soit ${taux(r.tauxMarge)}` : ''}${r.coefficient !== null ? `, coefficient ${r.coefficient.toFixed(2).replace('.', ',')}` : ''}.`
      resultats = (
        <Resultats>
          <Indicateur libelle={e.mode === 'prix' ? 'Prix de vente TTC' : 'Taux de marge'} valeur={e.mode === 'prix' ? centimes(r.prixTTC) : r.tauxMarge === null ? '–' : taux(r.tauxMarge)} detail={e.mode === 'prix' ? `${centimes(r.prixHT)} HT` : `${centimes(r.marge)} par vente`}
            ecart={e.mode === 'marge' && famille && r.tauxMarge !== null ? { texte: ecartPts(r.tauxMarge - famille.marge), hausse: r.tauxMarge >= famille.marge, favorable: r.tauxMarge >= famille.marge } : undefined} />
          <Indicateur libelle="Coût HT" valeur={centimes(r.cout)} detail={`${e.composants.length} composant${e.composants.length > 1 ? 's' : ''}`} />
          <Indicateur libelle="Coefficient" valeur={r.coefficient === null ? '–' : r.coefficient.toFixed(2).replace('.', ',')} detail="prix TTC ÷ coût HT" />
        </Resultats>
      )
    } else phrase = 'Une marge de 100 % ou plus ne donne aucun prix.'
    }
  }
  if (choisi === 'remises_b2b') {
    // 228 · Remises entreprise par paliers (fichier « Simulateur remises B2B » de Joseph, 16/11/2026). Facturé en HT ;
    // paliers, remises et plancher en exemple, modifiables à chaque simulation (pas de réglage du siège).
    const e = etats.remises_b2b
    const parFamille = e.mode === 'famille'
    const lignes = parFamille ? e.familles : e.produits
    const cleLignes = parFamille ? 'familles' : 'produits'
    const r = simulerRemisesB2B({ paliers: e.paliers, lignes, tva: s.tva.normale, plancher: e.plancher }, p)
    const margeProsp = e.margeProspection ?? (r.taux !== null ? Math.round(r.taux * 1000) / 1000 : 0.35)
    const pr = simulerProspection({ heuresSemaine: e.heuresSemaine, semaines: e.semaines, coutHoraire: heure(e), entreprises: e.entreprises, ticket: e.ticket, marge: margeProsp }, p)
    const nomPalier = (i: number) => `Palier ${i}`
    const majLigne = (i: number, v: Partial<LigneB2B>) => maj('remises_b2b', { [cleLignes]: lignes.map((y, j) => (j === i ? { ...y, ...v } : y)) })
    const majPalier = (i: number, v: Partial<PalierRemise>) => maj('remises_b2b', { paliers: e.paliers.map((y, j) => (j === i ? { ...y, ...v } : y)) })
    const unite = (n: number) => `${entier(n)} unité${n > 1 ? 's' : ''}`
    const lecture = (a: AlerteB2B | null) => (a === 'perte' ? 'Vente à perte' : a === 'plancher' ? 'Sous le plancher' : a === 'ok' ? 'Au-dessus du plancher' : '–')
    const couleur = (a: AlerteB2B | null) => (a === 'perte' ? 'error.main' : a === 'plancher' ? 'warning.dark' : a === 'ok' ? 'success.dark' : 'text.secondary')
    const quantites = (x: { min: number; max: number | null }) => (x.max === null ? `${entier(x.min)} et plus` : `${entier(x.min)} à ${entier(x.max)}`)
    const tableau = { minWidth: 640, '& td, & th': { fontVariantNumeric: 'tabular-nums' } }
    saisies = (
      <Stack spacing={2}>
        <Bloc titre="1. La commande" total={{ libelle: 'Unités', valeur: entier(r.unites) }}>
          <Saisies>
            <Texte libelle="Client ou projet" valeur={e.client} onChange={(client) => maj('remises_b2b', { client })} largeur={240} />
            <Choix libelle="Je simule" valeur={e.mode} onChange={(mode) => maj('remises_b2b', { mode })} options={[['famille', 'Par famille'], ['produit', 'Produit par produit']]} />
            <Taux libelle="Marge plancher" valeur={e.plancher} onChange={(plancher) => maj('remises_b2b', { plancher })} />
          </Saisies>
        </Bloc>
        <Bloc titre="2. Les paliers de remise" total={{ libelle: 'Remise appliquée', valeur: `${nomPalier(r.palier)}, ${taux(r.remise)}` }}>
          {e.paliers.map((x, i) => (
            <Saisies key={i}>
              <Typography sx={{ fontWeight: 700, minWidth: 72, alignSelf: 'center' }}>{nomPalier(i)}</Typography>
              {i === 0
                ? <Typography color="text.secondary" sx={{ alignSelf: 'center', minWidth: 130 }}>Dès la première unité</Typography>
                : <MontantDe libelle="À partir de" aria={`À partir de, palier ${i}`} valeur={x.min} onChange={(v) => majPalier(i, { min: Math.max(1, Math.round(v)) })} unite="u" largeur={130} />}
              <TauxDe libelle="Remise" aria={`Remise, palier ${i}`} valeur={x.remise} onChange={(v) => majPalier(i, { remise: v })} />
              {i > 0 && <Button color="inherit" startIcon={<DeleteOutlineOutlined />} onClick={() => maj('remises_b2b', { paliers: e.paliers.filter((_, j) => j !== i) })} aria-label={`Retirer le palier ${i}`} sx={{ minHeight: 48 }}>Retirer</Button>}
            </Saisies>
          ))}
          <Box>{e.paliers.length < 8 && <Button startIcon={<AddOutlined />} onClick={() => maj('remises_b2b', { paliers: [...e.paliers, { min: Math.max(1, (e.paliers.at(-1)?.min ?? 0) * 2), remise: Math.min(1, (e.paliers.at(-1)?.remise ?? 0) + 0.02) }] })} sx={{ minHeight: 48 }}>Ajouter un palier</Button>}</Box>
        </Bloc>
        <Bloc titre={parFamille ? '3. Les familles commandées' : '3. Les produits commandés'} total={{ libelle: 'CA HT avant remise', valeur: montant(r.caBrut) }}>
          {lignes.map((l, i) => {
            const nomLigne = l.libelle || `${parFamille ? 'Famille' : 'Produit'} ${i + 1}`
            const u = unitaireB2B(l, s.tva.normale)
            return (
              <Saisies key={i}>
                <Texte libelle={parFamille ? 'Famille' : 'Produit'} aria={`${parFamille ? 'Famille' : 'Produit'} ${i + 1}`} valeur={l.libelle} onChange={(libelle) => majLigne(i, { libelle })} largeur={parFamille ? 160 : 240} />
                <MontantDe libelle="Unités" aria={`Unités, ${nomLigne}`} valeur={l.quantite} onChange={(v) => majLigne(i, { quantite: Math.max(0, Math.round(v)) })} unite="" largeur={100} />
                <MontantDe libelle={parFamille ? 'Prix public moyen TTC' : 'Prix public TTC'} aria={`Prix public TTC, ${nomLigne}`} valeur={l.prixTTC} onChange={(v) => majLigne(i, { prixTTC: v })} />
                {parFamille
                  ? <TauxDe libelle="% de marge" aria={`% de marge, ${nomLigne}`} valeur={u.taux ?? 0} onChange={(v) => majLigne(i, { taux: v })} />
                  : <MontantDe libelle="Achat HT, accises comprises" aria={`Achat HT, ${nomLigne}`} valeur={l.achatHT} onChange={(v) => majLigne(i, { achatHT: v })} />}
                <Champ libelle={parFamille ? 'Marge HT par unité' : 'Marge unitaire HT'}>
                  <Typography aria-label={`Marge HT par unité, ${nomLigne}`} sx={{ minHeight: 48, minWidth: 110, display: 'flex', alignItems: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: u.marge < 0 ? 'error.main' : 'text.primary' }}>
                    {u.prixHT > 0 ? `${centimes(u.marge)}${parFamille || u.taux === null ? '' : ` · ${taux(u.taux)}`}` : '–'}
                  </Typography>
                </Champ>
                {lignes.length > 1 && <Button color="inherit" startIcon={<DeleteOutlineOutlined />} onClick={() => maj('remises_b2b', { [cleLignes]: lignes.filter((_, j) => j !== i) })} aria-label={`Retirer ${nomLigne}`} sx={{ minHeight: 48 }}>Retirer</Button>}
              </Saisies>
            )
          })}
          <Box>{lignes.length < 40 && <Button startIcon={<AddOutlined />} onClick={() => maj('remises_b2b', { [cleLignes]: [...lignes, parFamille ? { libelle: '', quantite: 0, prixTTC: 0, achatHT: 0, taux: 0 } : { libelle: '', quantite: 0, prixTTC: 0, achatHT: 0 }] })} sx={{ minHeight: 48 }}>{parFamille ? 'Ajouter une famille' : 'Ajouter un produit'}</Button>}</Box>
          {parFamille && <Typography color="text.secondary" sx={{ fontSize: '0.875rem' }}>Par famille, les prix moyens donnent une première idée ; produit par produit, la commande réelle.</Typography>}
        </Bloc>
        <Bloc titre="4. Démarcher d’autres entreprises" total={e.prospection ? { libelle: 'Temps passé', valeur: `− ${montant(pr.coutTemps)}` } : undefined}>
          <Saisies>
            <Choix libelle="Prospection" valeur={e.prospection ? 'oui' : 'non'} onChange={(v) => maj('remises_b2b', { prospection: v === 'oui' })} options={[['oui', 'À chiffrer'], ['non', 'Sans']]} />
            {e.prospection && <>
              <Montant libelle="Heures par semaine" valeur={e.heuresSemaine} onChange={(v) => maj('remises_b2b', { heuresSemaine: Math.max(0, v) })} unite="h" />
              <Montant libelle="Semaines de test" valeur={e.semaines} onChange={(v) => maj('remises_b2b', { semaines: Math.max(0, Math.round(v)) })} unite="" />
              <Montant libelle="Entreprises visées" valeur={e.entreprises} onChange={(v) => maj('remises_b2b', { entreprises: Math.max(0, Math.round(v)) })} unite="" />
              <Montant libelle="Ticket moyen par entreprise HT" valeur={e.ticket} onChange={(v) => maj('remises_b2b', { ticket: Math.max(0, v) })} />
              <Taux libelle="Marge sur ces ventes" valeur={margeProsp} onChange={(v) => maj('remises_b2b', { margeProspection: v })} source={e.margeProspection === null && r.taux !== null && 'commande'} />
            </>}
          </Saisies>
          {e.prospection && <Saisies><CoutHeure e={e} valeur={heure(e)} equipeSaisie={heureEquipe !== null} repere={parametresSimulateurs(p).coutHoraire > 0} onChange={(v) => maj('remises_b2b', v)} /></Saisies>}
        </Bloc>
      </Stack>
    )
    nomParDefaut = `${e.client || 'Commande'}, ${unite(r.unites)}`
    const prospectionTexte = e.prospection && pr.ca > 0 ? ` Démarcher ${entier(e.entreprises)} entreprises : ${pr.gain >= 0 ? `gain de ${montant(pr.gain)}` : `perte de ${montant(-pr.gain)}`}${pr.seuil !== null ? `, le temps est payé dès ${entier(pr.seuil)} entreprise${pr.seuil > 1 ? 's' : ''}` : ''}.` : ''
    const prochain = r.suivant ? ` Encore ${unite(r.suivant.manque)} pour passer au ${nomPalier(r.suivant.index).toLowerCase()} (${taux(r.suivant.remise)}).` : r.unites > 0 ? ' Dernier palier atteint.' : ''
    const plancherTexte = r.taux === null ? '' : r.marge < 0 ? ' Vente à perte sur l’ensemble.' : r.taux < e.plancher ? ` Sous le plancher de ${taux(e.plancher)}.` : r.alertes ? ` ${r.alertes} ligne${r.alertes > 1 ? 's' : ''} sous le plancher.` : ''
    phrase = r.unites > 0 && r.caNet > 0
      ? `${e.client || 'Commande'} : ${unite(r.unites)}, ${nomPalier(r.palier).toLowerCase()} à ${taux(r.remise)} de remise, ${montant(r.caNet)} HT, marge ${montant(r.marge)} soit ${r.taux === null ? '–' : taux(r.taux)}.${plancherTexte}${prochain}${prospectionTexte}`
      : ''
    const actuel = r.paliers[r.palier]
    resultats = phrase ? (
      <Stack spacing={2}>
        <Compte titre="Compte de la commande" lignes={[
          { libelle: 'CA HT avant remise', valeur: r.caBrut, detail: unite(r.unites) },
          { libelle: 'Remise cédée au client', valeur: -r.margeCedee, detail: taux(r.remise) },
          { libelle: 'Achats HT', valeur: -r.cout, detail: 'accises comprises' },
          { libelle: 'Redevance et publicité', valeur: -r.redevance },
        ]} total={{ libelle: 'Ce qu’il reste au magasin', valeur: r.reste }} />
        <Resultats>
          <Indicateur libelle="Taux de marge" valeur={r.taux === null ? '–' : taux(r.taux)} detail={`${montant(r.marge)} sur ${montant(r.caNet)} HT`}
            ecart={r.taux === null ? undefined : { texte: ecartPts(r.taux - e.plancher), hausse: r.taux >= e.plancher, favorable: r.taux >= e.plancher }} />
          <Indicateur libelle="Marge cédée au client" valeur={montant(r.margeCedee)} detail={`${montant(r.margeSansRemise)} de marge sans remise`} />
          <Indicateur libelle="Remise appliquée" valeur={taux(r.remise)} detail={`${nomPalier(r.palier)}, ${quantites(actuel)} unités`} />
          <Indicateur libelle="Palier suivant" valeur={r.suivant ? unite(r.suivant.manque) : 'Atteint'} detail={r.suivant ? `de plus pour ${taux(r.suivant.remise)}` : 'dernier palier'} />
        </Resultats>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" aria-label="Remises par palier" sx={tableau}>
            <TableHead><TableRow>
              <TableCell>Palier</TableCell><TableCell>Unités</TableCell><TableCell align="right">Remise</TableCell><TableCell align="right">Marge par unité</TableCell><TableCell align="right">Taux de marge</TableCell><TableCell>Lecture</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {r.paliers.map((x, i) => (
                <TableRow key={i} selected={i === r.palier} aria-current={i === r.palier ? 'true' : undefined}>
                  <TableCell sx={{ fontWeight: i === r.palier ? 700 : undefined }}>{nomPalier(i)}{i === r.palier ? ', la commande' : ''}</TableCell>
                  <TableCell>{quantites(x)}</TableCell>
                  <TableCell align="right">{taux(x.remise)}</TableCell>
                  <TableCell align="right">{x.margeUnite === null ? '–' : centimes(x.margeUnite)}</TableCell>
                  <TableCell align="right">{x.taux === null ? '–' : taux(x.taux)}</TableCell>
                  <TableCell sx={{ color: x.margeRetrouveeA !== null && x.alerte === 'ok' ? 'warning.dark' : couleur(x.alerte), fontWeight: 600 }}>
                    {x.alerte === 'ok' && x.margeRetrouveeA !== null ? `Creux : moins de marge qu’au palier d’avant jusqu’à ${entier(x.margeRetrouveeA - 1)} unités` : lecture(x.alerte)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" aria-label={parFamille ? 'Détail par famille' : 'Détail par produit'} sx={tableau}>
            <TableHead><TableRow>
              <TableCell>{parFamille ? 'Famille' : 'Produit'}</TableCell><TableCell align="right">Unités</TableCell><TableCell align="right">CA HT net</TableCell><TableCell align="right">Marge</TableCell><TableCell align="right">Taux</TableCell><TableCell align="right">Remise maximale</TableCell><TableCell>Lecture</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {r.lignes.map((l, i) => l.quantite > 0 && (
                <TableRow key={i}>
                  <TableCell>{l.libelle || `${parFamille ? 'Famille' : 'Produit'} ${i + 1}`}</TableCell>
                  <TableCell align="right">{entier(l.quantite)}</TableCell>
                  <TableCell align="right">{montant(l.caNet)}</TableCell>
                  <TableCell align="right">{montant(l.marge)}</TableCell>
                  <TableCell align="right">{l.taux === null ? '–' : taux(l.taux)}</TableCell>
                  <TableCell align="right">{l.remiseMax === null ? '–' : taux(l.remiseMax)}</TableCell>
                  <TableCell sx={{ color: couleur(l.alerte), fontWeight: 600 }}>{lecture(l.alerte)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        {e.prospection && pr.ca > 0 && (
          <Compte titre="Compte de la prospection" lignes={[
            { libelle: 'Marge des ventes attendues', valeur: pr.marge, detail: `${entier(e.entreprises)} entreprises, ${montant(pr.ca)} HT` },
            { libelle: 'Redevance et publicité', valeur: -pr.redevance },
            { libelle: 'Temps passé à démarcher', valeur: -pr.coutTemps, detail: `${entier(pr.heures)} h` },
          ]} total={{ libelle: pr.gain >= 0 ? 'Gain de la prospection' : 'Perte de la prospection', valeur: pr.gain }} />
        )}
        {e.prospection && pr.ca > 0 && (
          <Resultats>
            <Indicateur libelle="Entreprises pour payer le temps" valeur={pr.seuil === null ? 'Jamais' : entier(pr.seuil)} detail={pr.seuil === null ? 'la marge ne couvre pas la redevance' : `sur ${entier(e.entreprises)} visées, à ${montant(e.ticket)} HT chacune`} />
          </Resultats>
        )}
      </Stack>
    ) : null
  }
  if (choisi === 'ouverture') {
    const e = etats.ouverture
    const mBar = e.margeBar ?? margeUnivers(b, 'bar') ?? 0.6, mCave = e.margeCave ?? margeUnivers(b, 'cave') ?? 0.3
    const majoration = e.jour === 'dimanche' ? s.majorations.dimanche : s.majorations.ferie
    const r = simulerOuverture({ caBar: e.caBar, caCave: e.caCave, margeBar: mBar, margeCave: mCave, report: e.report, heures: e.heures, coutHoraire: heure(e), majoration, frais: e.frais }, p)
    saisies = (
      <Stack spacing={2}>
        <Bloc titre="1. Ce que la journée ferait vendre" total={{ libelle: 'CA nouveau HT', valeur: montant(r.caNouveau) }}>
        <Saisies>
          <Choix libelle="Jour" valeur={e.jour} onChange={(v) => maj('ouverture', { jour: v })} options={[['dimanche', 'Un dimanche'], ['ferie', 'Un jour férié']]} />
          <Montant libelle="CA HT attendu au bar" valeur={e.caBar} onChange={(v) => maj('ouverture', { caBar: v })} />
          <Montant libelle="CA HT attendu en cave" valeur={e.caCave} onChange={(v) => maj('ouverture', { caCave: v })} />
          <Taux libelle="Marge du bar" valeur={mBar} onChange={(v) => maj('ouverture', { margeBar: v })} source={e.margeBar === null && margeUnivers(b, 'bar') !== null && 'budget'} />
          <Taux libelle="Marge de la cave" valeur={mCave} onChange={(v) => maj('ouverture', { margeCave: v })} source={e.margeCave === null && margeUnivers(b, 'cave') !== null && 'budget'} />
          <Taux libelle="Part qui serait venue un autre jour" valeur={e.report} onChange={(v) => maj('ouverture', { report: v })} />
        </Saisies>
        </Bloc>
        <Bloc titre="2. Ce qu’elle coûte" total={{ libelle: 'Total', valeur: `− ${montant(r.personnel + r.frais)}` }}>
        <Saisies>
          <Montant libelle="Heures payées" valeur={e.heures} onChange={(v) => maj('ouverture', { heures: v })} unite="h" />
          <CoutHeure e={e} valeur={heure(e)} equipeSaisie={heureEquipe !== null} repere={parametresSimulateurs(p).coutHoraire > 0} onChange={(v) => maj('ouverture', v)} />
          <Montant libelle="Frais du jour HT" valeur={e.frais} onChange={(v) => maj('ouverture', { frais: v })} />
        </Saisies>
        <Typography color="text.secondary">Majoration des heures {e.jour === 'dimanche' ? 'du dimanche' : 'd’un jour férié'} : {taux(majoration)}{majoration ? ', réglée par le siège' : ', à régler par le siège selon la convention collective'}.</Typography>
        </Bloc>
      </Stack>
    )
    nomParDefaut = `Ouverture ${e.jour === 'dimanche' ? 'un dimanche' : 'un jour férié'}, ${montant(r.ca)} de CA`
    phrase = `${nomParDefaut} : ${r.gain >= 0 ? `gain de ${montant(r.gain)}` : `perte de ${montant(-r.gain)}`}${r.seuil !== null ? `, rentable à partir de ${montant(r.seuil)} de CA HT dans la journée` : ''}.`
    resultats = (
      <Stack spacing={2}>
        <Compte titre="Compte de la journée" lignes={[
          { libelle: 'Marge sur les ventes', valeur: r.marge, detail: `${montant(r.caNouveau)} de CA HT nouveau` },
          { libelle: 'Redevance et publicité', valeur: -r.redevance },
          { libelle: 'Heures de l’équipe', valeur: -r.personnel, detail: 'majorées' },
          { libelle: 'Frais du jour', valeur: -r.frais },
        ]} total={{ libelle: r.gain >= 0 ? 'Gain du jour' : 'Perte du jour', valeur: r.gain }} />
      <Resultats>
        <Indicateur libelle={r.gain >= 0 ? 'Gain du jour' : 'Perte du jour'} valeur={montant(Math.abs(r.gain))} detail={`marge ${montant(r.marge)}, équipe ${montant(r.personnel)}, frais et redevance ${montant(r.frais + r.redevance)}`} />
        <Indicateur libelle="CA nouveau" valeur={montant(r.caNouveau)} detail={`sur ${montant(r.ca)} attendus`} />
        <Indicateur libelle="CA pour ne rien perdre" valeur={r.seuil === null ? 'Jamais' : montant(r.seuil)} detail="HT, au même mélange bar et cave" />
      </Resultats>
      </Stack>
    )
  }

  const garder = async () => {
    setOccupe(true); setMessage(null)
    try {
      await garderSimulation(magasin, choisi, nom.trim() || nomParDefaut, { ...etats[choisi], _indicateurs: indicateursDe(resultats).slice(0, 12) } as Record<string, unknown>, phrase)
      setNom(''); setMessage({ texte: 'Simulation gardée.', bon: true })
      await recharger()
    } catch (e) {
      setMessage({ texte: e instanceof SimulationPasEncoreGardable ? 'Ce simulateur se gardera après la prochaine mise à jour de la base par le siège. Le calcul reste juste.' : 'La simulation n’a pas été gardée. Vérifie ta connexion, puis réessaie.', bon: false })
    } finally { setOccupe(false) }
  }
  const versBudget = async () => {
    if (!mettreAuBudget || !ajout) return
    setOccupe(true); setMessage(null)
    try {
      await mettreAuBudget(ajout)
      setMessage({ texte: `Ajouté au budget ${annee}.${note ? ` ${note}` : ''} Pense à l’envoyer au siège.`, bon: true })
    } catch { setMessage({ texte: 'Le budget n’a pas été modifié. Vérifie ta connexion, puis réessaie.', bon: false }) }
    finally { setOccupe(false) }
  }
  const rouvrir = (g: SimulationGardee) => {
    // Simulation gardée avant le choix du coût horaire : son montant saisi reste en montant libre
    const d = g.donnees as Record<string, unknown>
    const donnees = 'coutHoraire' in d && !('modeHeure' in d) ? { ...d, modeHeure: 'libre' } : d
    setEtats((e) => ({ ...e, [g.type]: fusionner(e[g.type], donnees) }))
    toucher(g.type)
    choisir(g.type)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  // 235 (Joseph, 16/11/2026) : une simulation gardée se copie telle quelle vers un autre magasin du périmètre
  const [copie, setCopie] = useState<SimulationGardee | null>(null)
  const [cible, setCible] = useState<string | null>(null)
  const [messageCopie, setMessageCopie] = useState<{ texte: string; bon: boolean } | null>(null)
  const autresMagasins = (reseauFiche?.magasins ?? []).map((x) => x.nom).filter((n) => n !== magasin).sort((a, c) => a.localeCompare(c, 'fr'))
  const peutCopier = peutGarder && !profil?.apercu && autresMagasins.length > 0
  const copier = async () => {
    if (!copie || !cible) return
    setOccupe(true)
    try {
      await garderSimulation(cible, copie.type, copie.nom, copie.donnees, copie.resume)
      setMessageCopie({ texte: `« ${copie.nom} » est copiée dans les simulations gardées de ${cible}.`, bon: true })
      setCopie(null); setCible(null)
    } catch (x) {
      setMessageCopie({ texte: x instanceof SimulationPasEncoreGardable ? 'Ce simulateur se gardera après la prochaine mise à jour de la base par le siège.' : 'La simulation n’a pas été copiée. Vérifie ta connexion, puis réessaie.', bon: false })
      setCopie(null); setCible(null)
    } finally { setOccupe(false) }
  }
  const retirer = async (g: SimulationGardee) => {
    try { await retirerSimulation(g.id); await recharger() } catch { setMessage({ texte: 'La simulation n’a pas été retirée. Vérifie ta connexion, puis réessaie.', bon: false }) }
  }

  const tuile = (x: (typeof SIMULATEURS)[number]) => {
    const actif = x.cle === choisi
    return (
      <ButtonBase key={x.cle} onClick={() => ouvrir(x.cle)} aria-current={actif ? 'true' : undefined} focusRipple
        sx={{ justifyContent: 'flex-start', textAlign: 'left', gap: 1, px: 1, py: 0.75, minHeight: 52, borderRadius: '10px', border: 2, borderColor: actif ? 'text.primary' : 'divider', bgcolor: 'background.paper', minWidth: 0 }}>
        <Box sx={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: '8px', flex: 'none', bgcolor: actif ? 'secondary.main' : 'action.hover', color: actif ? 'secondary.contrastText' : 'text.primary', '& svg': { fontSize: 20 } }}>{x.icone}</Box>
        <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', lineHeight: 1.25, minWidth: 0 }}>{x.titre}</Typography>
      </ButtonBase>
    )
  }
  return (
    <Stack spacing={3} component="section" aria-label="Simulateurs" id="partie-simulateurs">
      {recents.length > 0 && (
        <Box component="nav" aria-label="Derniers simulateurs utilisés" className="pas-a-l-impression" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography color="text.secondary" sx={{ fontSize: '0.875rem', mr: 0.5 }}>Derniers utilisés</Typography>
          {recents.map((c) => {
            const x = SIMULATEURS.find((y) => y.cle === c)!
            return <Button key={c} size="small" variant={c === choisi ? 'contained' : 'outlined'} color="inherit" startIcon={x.icone} onClick={() => ouvrir(c)} sx={{ minHeight: 48, borderRadius: '24px', textTransform: 'none' }}>{x.titre}</Button>
          })}
        </Box>
      )}
      <Box component="nav" aria-label="Choisir un simulateur" className="pas-a-l-impression" sx={{ display: 'grid', columnGap: 2, rowGap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' } }}>
        {FAMILLES.map(([f, libelle]) => (
          <Box key={f} component="section" aria-label={libelle} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
            <Typography component="h3" sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{libelle}</Typography>
            <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(2, minmax(0, 1fr))', xl: '1fr' } }}>
              {SIMULATEURS.filter((x) => FAMILLE_DE[x.cle] === f).map(tuile)}
            </Box>
          </Box>
        ))}
      </Box>

      <GlobalStyles styles={{ '@media print': {
        'body.simulation-seule *': { visibility: 'hidden' },
        'body.simulation-seule #carte-simulation, body.simulation-seule #carte-simulation *': { visibility: 'visible' },
        'body.simulation-seule #carte-simulation': { position: 'absolute', left: 0, top: 0, width: '100%', border: 'none !important' },
      } }} />
      <Card id="carte-simulation" sx={{ p: { xs: 2, md: 3 }, borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: 2.5, overflow: 'visible', scrollMarginTop: { xs: 72, md: 'calc(var(--onglets, 0px) + 8px)' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', order: { md: -2 } }}>
          <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="h2">{simulateur.titre}<Box component="span" className="impression-seule"> · {magasin} · {aujourdhui.toLocaleDateString('fr-FR')}</Box></Typography>
              <Aide sujet={simulateur.aide} />
            </Box>
            <Typography color="text.secondary" sx={{ fontSize: '0.875rem' }}>{simulateur.question}</Typography>
          </Box>
          {!sansBudget && !!phrase && !touches.includes(choisi) && <Chip label="Exemple" size="small" className="pas-a-l-impression" sx={{ fontWeight: 600, fontSize: '0.8125rem' }} />}
          {!sansBudget && !!phrase && <Button color="inherit" className="pas-a-l-impression" startIcon={<DeleteSweepOutlined />} onClick={() => effacer(choisi)} sx={{ minHeight: 48 }}>Effacer</Button>}
          {touches.includes(choisi) && (
            <Button color="inherit" className="pas-a-l-impression" startIcon={<RestartAltOutlined />} onClick={() => revenir(choisi)} sx={{ minHeight: 48 }}>Revenir à l’exemple</Button>
          )}
        </Box>
        {sansBudget ? (
          <EtatVide titre={`Le budget ${annee} n’est pas encore proposé`} texte="Ce simulateur part du budget de l’année du magasin. Les autres simulateurs (promo, soirée, achat en volume, investissement, extérieur, pression, prix) marchent déjà." />
        ) : (
          <>
            {saisies}
            {resultats && <Bloc titre="Résultat">{resultats}</Bloc>}
            {/* 189 : le résultat reste en vue pendant la saisie, en haut de la carte sur PC, en bas de l'écran sur téléphone */}
            {phrase && (
              <Box role="status" sx={{
                order: { md: -1 }, position: 'sticky', zIndex: 2, top: { xs: 'auto', md: 'calc(var(--onglets, 0px) + 8px)' }, bottom: { xs: 'calc(var(--barre-basse, 0px) + 8px)', md: 'auto' },
                bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderLeft: 4, borderLeftColor: 'secondary.main', borderRadius: '10px', boxShadow: 3, px: 2, py: 1.25,
                '@media print': { position: 'static', boxShadow: 'none' },
              }}>
                <Typography sx={{ fontWeight: 600, fontSize: '1rem', maxWidth: '75ch' }}>{phrase}</Typography>
              </Box>
            )}
            {phrase && (
              <Box className="pas-a-l-impression" sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-end', pt: 1, borderTop: 1, borderColor: 'divider' }}>
                {peutGarder && gardees !== null && simulateur.gardable !== false && (
                  <>
                    <Champ libelle="Nom de la simulation">
                      <TextField size="small" value={nom} placeholder={nomParDefaut} onChange={(x) => setNom(x.target.value)} slotProps={{ htmlInput: { 'aria-label': 'Nom de la simulation', maxLength: 80 } }} sx={{ ...champ, width: { xs: '100%', sm: 320 } }} />
                    </Champ>
                    <Button variant="outlined" startIcon={<BookmarkAddOutlined />} onClick={() => void garder()} aria-disabled={occupe} sx={{ minHeight: 48 }}>Garder</Button>
                  </>
                )}
                <Button variant="outlined" startIcon={<PictureAsPdfOutlined />} onClick={enPDF} sx={{ minHeight: 48 }}>PDF</Button>
                {peutPrioriser && choisi !== 'levier' && <Button variant="outlined" startIcon={<PlaylistAddCheckOutlined />} onClick={() => setPriorite({ titre: (nom.trim() || nomParDefaut).slice(0, 200), mesure, source: phrase })} sx={{ minHeight: 48 }}>En faire une priorité</Button>}
                {ajout && mettreAuBudget && <Button variant="contained" startIcon={<PlaylistAddOutlined />} onClick={() => void versBudget()} aria-disabled={occupe} sx={{ minHeight: 48 }}>Mettre dans mon budget {annee}</Button>}
                {ajout && !mettreAuBudget && budgetValide && <Typography color="text.secondary" sx={{ alignSelf: 'center' }}>Le budget {annee} est validé : la simulation se garde sans le changer.</Typography>}
              </Box>
            )}
            {message && <Typography role="alert" sx={{ fontWeight: 600, color: message.bon ? 'success.dark' : 'error.main' }}>{message.texte}</Typography>}
          </>
        )}
      </Card>

      {priorite && ficheMagasin && reseauFiche && (
        <DialogPriorite reseau={reseauFiche} m={ficheMagasin} priorite={null} objectifInitial={placesLibres(reseauFiche, magasin).find((x) => x) ?? ''} actions={actionsDuMagasin(reseauFiche, magasin)} proposee={priorite}
          onFermer={(msg) => { setPriorite(null); if (msg) setMessage({ texte: `${msg} Elle est dans les objectifs et priorités de la fiche du magasin.`, bon: true }) }} />
      )}
      <Dialog open={!!copie} onClose={() => setCopie(null)} maxWidth="xs" fullWidth aria-labelledby="titre-copie-simulation">
        <DialogTitle id="titre-copie-simulation">Copier vers un autre magasin</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>{copie?.nom}, avec ses saisies, rangée dans les simulations gardées du magasin choisi.</Typography>
          <Autocomplete options={autresMagasins} value={cible} onChange={(_, v) => setCible(v)} openText="Ouvrir la liste" closeText="Fermer la liste" noOptionsText="Aucun magasin de ce nom"
            renderInput={(x) => <TextField {...x} label="Magasin" slotProps={{ ...x.slotProps, htmlInput: { ...x.slotProps.htmlInput, 'aria-label': 'Magasin de destination' } }} sx={{ '& .MuiInputBase-root': { minHeight: 48 } }} />} />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setCopie(null)} sx={{ minHeight: 48 }}>Annuler</Button>
          <Button variant="contained" startIcon={<ContentCopyOutlined />} onClick={() => void copier()} disabled={!cible || occupe} sx={{ minHeight: 48 }}>Copier</Button>
        </DialogActions>
      </Dialog>
      {gardees !== null && (
        <Stack spacing={1.5} component="section" aria-label="Simulations gardées">
          <Typography variant="h2">Simulations gardées</Typography>
          {messageCopie && <Typography role="status" sx={{ fontWeight: 600, color: messageCopie.bon ? 'success.dark' : 'error.main' }}>{messageCopie.texte}</Typography>}
          {comparees.length >= 2 && <Comparaison simulations={comparees} />}
          {gardees.length === 0 ? (
            <EtatVide titre="Aucune simulation gardée" texte="Une simulation gardée reste ici, avec son résultat, pour en reparler avec ton Coach ou ton franchisé." />
          ) : (
            <Card sx={{ borderRadius: '12px' }}>
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {gardees.map((g, i) => (
                  <Box component="li" key={g.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', px: 2, py: 1.5, borderTop: i ? 1 : 0, borderColor: 'divider' }}>
                    <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }}>{g.nom}</Typography>
                      <Typography color="text.secondary" sx={{ fontSize: '0.875rem' }}>{libelleSimulation(g.type)} · {g.auteurNom ?? 'Siège'} · {dateHeure(g.creeLe)}</Typography>
                      {g.resume && <Typography sx={{ fontSize: '0.875rem', mt: 0.5 }}>{g.resume}</Typography>}
                    </Box>
                    {gardees.length > 1 && (
                      <FormControlLabel label="Comparer" sx={{ minHeight: 48, mr: 0 }} control={
                        <Checkbox sx={{ width: 48, height: 48 }} checked={compares.includes(g.id)} disabled={!compares.includes(g.id) && compares.length >= 3}
                          onChange={(x) => setCompares((l) => (x.target.checked ? [...l, g.id] : l.filter((y) => y !== g.id)))} slotProps={{ input: { 'aria-label': `Comparer ${g.nom}` } }} />
                      } />
                    )}
                    <Button startIcon={<ReplayOutlined />} onClick={() => rouvrir(g)} sx={{ minHeight: 48 }}>Rouvrir</Button>
                    {peutCopier && <Button startIcon={<ContentCopyOutlined />} onClick={() => { setCopie(g); setCible(null) }} aria-label={`Copier ${g.nom} vers un autre magasin`} sx={{ minHeight: 48 }}>Copier vers…</Button>}
                    {(g.auteur === profil?.id || profil?.role === 'directeur') && !profil?.apercu && (
                      <Button color="inherit" startIcon={<DeleteOutlineOutlined />} onClick={() => void retirer(g)} aria-label={`Retirer ${g.nom}`} sx={{ minHeight: 48 }}>Retirer</Button>
                    )}
                  </Box>
                ))}
              </Box>
            </Card>
          )}
        </Stack>
      )}
    </Stack>
  )
}
