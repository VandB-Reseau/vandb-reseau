import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useReseauSiDispo } from '../../data/ReseauContext'
import { equipementsDu, tireusesDu } from '../../data/equipements'
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
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined'
import PersonAddOutlined from '@mui/icons-material/PersonAddOutlined'
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
import { categorieLibelle, type Categorie } from '../moteur/equipe'
import {
  analyserRemises, caCorner, LIGNES_EVENEMENT, LIGNES_REMISES, margeMix, parametresSimulateurs, resteAFaire, simulerAchat, simulerCoupDur, simulerEmbauche,
  simulerInvestissement, simulerPrimes, simulerPrix, simulerSoiree, simulerVenteAdditionnelle, tempsFortDeSoiree,
  type CleRemise, type CoupDur, type LigneEvenement, type LigneMix, type Mouvement, type PalierPrime,
} from '../moteur/simulateurs'
import {
  auditPression, cartePression, margeFut, coutComposition, coutContrats, margePourPrix, nouveauBec, palierExterieur, prixLivraisonGrille, prixPourMarge,
  simulerExterieur, simulerOuverture, simulerParc, cibleProductivite, TAUX_MECENAT, type Bec, type Composant,
} from '../moteur/boiteOutils'
import type { AjustementCA, Budget, Emprunt, Hypotheses, Investissement, ParametresReseau, TempsFort, Univers } from '../moteur/types'
import { dateHeure, ecartMontant, ecartPts, montant, MOIS_LONGS, panier as centimes, tauxCourt as taux } from '../lib/format'
import type { SujetAide } from '../lib/aide'

// Simulateurs du franchisé (choix 125 à 135, Joseph 13/11/2026) : une puce « Simulateurs » dans les chiffres du magasin,
// pour le franchisé comme pour le Coach (on simule à deux en visite). Une carte par question ; rien n'est enregistré tant
// qu'on ne « garde » pas (126) ; « Mettre dans mon budget » reporte une soirée ou un investissement dans le budget tant
// qu'il n'est pas validé. Tous les calculs sont dans moteur/simulateurs.

export interface AjoutBudget { tempsForts?: TempsFort[]; investissements?: Investissement[]; emprunts?: Emprunt[]; ajustementsCA?: AjustementCA[] }

const SIMULATEURS: { cle: TypeSimulation; titre: string; question: string; icone: ReactNode; aide: SujetAide; budget: boolean }[] = [
  { cle: 'embauche', titre: 'Embaucher', question: 'Embauche, départ, heures, primes ?', icone: <PersonAddOutlined />, aide: 'simEmbauche', budget: true },
  { cle: 'prix', titre: 'Promo, prix, remises', question: 'Combien vendre en plus, mes remises sont-elles dans les repères ?', icone: <SellOutlined />, aide: 'simPrix', budget: false },
  { cle: 'tresorerie', titre: 'Coup dur de trésorerie', question: 'Et si le CA baisse, si un client paie en retard ?', icone: <AccountBalanceWalletOutlined />, aide: 'simTresorerie', budget: true },
  { cle: 'vente_additionnelle', titre: 'Vente additionnelle', question: 'Un article de plus à un client sur dix ?', icone: <AddShoppingCartOutlined />, aide: 'simVente', budget: true },
  { cle: 'reste_a_faire', titre: 'Reste à faire du mois', question: 'Combien vendre par jour pour tenir mon budget ?', icone: <FlagOutlined />, aide: 'simReste', budget: true },
  { cle: 'soiree', titre: 'Soirée, dégustation', question: 'Combien de participants pour ne pas perdre d’argent ?', icone: <CelebrationOutlined />, aide: 'simSoiree', budget: false },
  { cle: 'achat', titre: 'Acheter en volume', question: 'La remise vaut-elle le stock bloqué ?', icone: <Inventory2Outlined />, aide: 'simAchat', budget: false },
  { cle: 'investissement', titre: 'Investir', question: 'Tireuse, terrasse, corner : en combien de temps remboursé ?', icone: <StorefrontOutlined />, aide: 'simInvestissement', budget: false },
  // Vague 9 (choix 138 à 146, Joseph 14/11/2026)
  { cle: 'exterieur', titre: 'Contrat extérieur', question: 'Ce contrat avec une association est-il rentable ?', icone: <LocalShippingOutlined />, aide: 'simExterieur', budget: false },
  { cle: 'tireuses', titre: 'Parc de tireuses', question: 'Combien de week-ends pour payer une tireuse ?', icone: <WarehouseOutlined />, aide: 'simTireuses', budget: false },
  { cle: 'pression', titre: 'Ma carte pression', question: 'Quels becs, quelle marge, quelle perte ?', icone: <SportsBarOutlined />, aide: 'simPression', budget: false },
  { cle: 'calculette', titre: 'Prix et marge', question: 'À quel prix vendre pour ma marge ?', icone: <CalculateOutlined />, aide: 'simCalculette', budget: false },
  { cle: 'ouverture', titre: 'Dimanche ou jour férié', question: 'Ouvrir ce jour-là rapporte-t-il ?', icone: <EventAvailableOutlined />, aide: 'simOuverture', budget: false },
]
const libelleSimulation = (t: TypeSimulation) => SIMULATEURS.find((s) => s.cle === t)?.titre ?? 'Simulation'

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const entier = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v)).replace(/[  ]/g, ' ')
const unChiffre = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)
const champ = { '& .MuiInputBase-root': { minHeight: 48 }, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }

// Un champ avec son libellé visible au-dessus
function Champ({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
      <Typography component="span" sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>{libelle}</Typography>
      {children}
    </Box>
  )
}
const Montant = ({ libelle, valeur, onChange, unite = '€' }: { libelle: string; valeur: number; onChange: (v: number) => void; unite?: string }) => (
  <Champ libelle={libelle}><ChampMontant libelle={libelle} valeur={valeur} onChange={onChange} unite={unite} largeur={150} /></Champ>
)
const Taux = ({ libelle, valeur, onChange }: { libelle: string; valeur: number; onChange: (v: number) => void }) => (
  <Champ libelle={libelle}><ChampTaux libelle={libelle} valeur={valeur} onChange={(v) => onChange(v ?? 0)} largeur={130} pas={0.01} /></Champ>
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
const ecart = (v: number, favorable = v >= 0) => ({ texte: ecartMontant(v), hausse: v >= 0, favorable })

// État de chaque simulateur : ses saisies, gardées telles quelles avec une simulation (« Rouvrir » les reprend)
type Etats = {
  embauche: {
    mouvement: Mouvement['type'] | 'primes'; poste: string; categorie: Categorie; heures: number; brut: number; mois: number; index: number; nouvellesHeures: number
    salaries: number; partReversee: number; paliers: PalierPrime[] // 164 · primes
  }
  prix: { type: 'remise' | 'hausse' | 'remises'; taux: number; marge: number; cartons: number; mois: number; ca: number | null; montants: Record<CleRemise, number> }
  tresorerie: { baisse: boolean; tauxBaisse: number; de: number; a: number; depense: boolean; montantDepense: number; moisDepense: number; retard: boolean; montantRetard: number; moisRetard: number; duree: number }
  vente_additionnelle: { univers: 'cave' | 'bar'; unSur: number; prix: number; marge: number | null }
  reste_a_faire: { mois: number; jour: number; realise: number }
  soiree: {
    nom: string; mois: number; univers: Univers; prix: number; participants: number; marge: number | null; couts: number; extras: number
    achats: boolean; part: number; panier: number; bon: boolean                    // 152 · achats des participants
    lignes: Record<Exclude<LigneEvenement, 'divers'>, number>                     // 153 · coûts détaillés (Divers : « couts »)
    personnes: number; heuresEquipe: number; coutHoraire: number; majoration: number // 153 · heures de l'équipe en place
  }
  achat: { montant: number; remise: number; mois: number; invendu: number; taux: number }
  exterieur: {
    nom: string; futs: number; prixVente: number; remise: number; prixAchat: number; co2: number; gobelets: number
    tireuse: 'neuve' | 'parc'; prixTireuse: number; duree: number; entretien: number
    livraisons: number; km: number; prixKm: number; heures: number; coutHoraire: number
    don: 'aucun' | 'argent' | 'nature'; montantDon: number; futsDon: number; cerfa: boolean
    prixLivraison: number | null; sponsoring: boolean; sponsoMontant: number; sponsoParFut: number; materiel: number; astreinte: number; locations: number; prixLocation: number // 154, 162
  }
  tireuses: {
    tireuses: number; semaines: number; sortiesSaison: number; sortiesHors: number; refus: number; futsParSortie: number; prixVente: number | null; prixAchat: number | null; prixNeuve: number; duree: number; entretien: number; vieilles: { nom: string; age: number; reparations: number }[]
    saisie: 'occupation' | 'sorties'; occSaison: number; occHors: number // 155 · week-ends loués
  }
  pression: {
    becs: Bec[]; projet: boolean; mode: 'ajouter' | 'remplacer'; remplace: number; cout: number; cannibalisation: number; nouveau: Bec
    vue: 'carte' | 'audit'; audit: { futs: number; litres: number; prixFut: number; demis: number; verres33: number; pintes: number; litres1L: number; offerts: number; caTTC: number } // 161
  }
  calculette: { nom: string; composants: Composant[]; tva: 'normale' | 'intermediaire' | 'reduite'; mode: 'prix' | 'marge' | 'mix'; marge: number; prixTTC: number; famille: string; mix: LigneMix[] }
  ouverture: { jour: 'dimanche' | 'ferie'; caBar: number; caCave: number; margeBar: number | null; margeCave: number | null; report: number; heures: number; coutHoraire: number; frais: number }
  investissement: { modele: 'libre' | 'corner' | 'exterieur'; objectifExterieur: number; camion: boolean; libelle: string; cout: number; duree: number; mois: number; ca: number; metres: number; marge: number; demarque: number; charges: number; financement: 'tresorerie' | 'pret'; tauxPret: number; dureePret: number; univers: Univers }
}

function margeUnivers(b: Budget | null, u: Univers): number | null {
  const f = b?.familles.filter((x) => x.univers === u) ?? []
  const ca = somme(f.map((x) => x.objectif))
  return ca > 0 ? Math.round(somme(f.map((x) => x.margeObjectif)) / ca * 100) / 100 : null
}

// tireusesParc : tireuses saisies dans les équipements du magasin (Joseph, 14/11/2026)
function etatsInitiaux(b: Budget | null, h: Hypotheses | null, p: ParametresReseau, aujourdhui: Date, tireusesParc: number | null = null): Etats {
  const annee = h?.annee ?? aujourdhui.getFullYear()
  const moisSuivant = annee === aujourdhui.getFullYear() ? Math.min(12, aujourdhui.getMonth() + 2) : 1
  const s = parametresSimulateurs(p)
  return {
    embauche: {
      mouvement: 'embauche', poste: 'Vendeur', categorie: 'employe', heures: 35, brut: Math.round(p.charges.reduction.smicAnnuel / 12), mois: moisSuivant, index: 0, nouvellesHeures: 28,
      salaries: Math.max(1, h?.equipe?.filter((x) => x.categorie !== 'gerant_tns').length || 2), partReversee: 0,
      paliers: [{ progression: 0.05, prime: 150, primeGerant: 0 }, { progression: 0.1, prime: 200, primeGerant: 0 }, { progression: 0.15, prime: 250, primeGerant: 0 }],
    },
    prix: { type: 'remise', taux: 0.1, marge: b && b.ca > 0 ? Math.round(b.tauxMarge * 100) / 100 : 0.35, cartons: 0, mois: 12, ca: null, montants: { offerts: 0, persos: 0, prixSpeciaux: 0, remises: 0, fidelite: 0 } },
    tresorerie: { baisse: true, tauxBaisse: 0.15, de: 1, a: 3, depense: false, montantDepense: 10_000, moisDepense: 6, retard: false, montantRetard: 5_000, moisRetard: 7, duree: 2 },
    vente_additionnelle: { univers: b?.flux.cave?.objectif ? 'cave' : 'bar', unSur: 10, prix: 12, marge: null },
    reste_a_faire: { mois: aujourdhui.getMonth() + 1, jour: aujourdhui.getDate(), realise: 0 },
    soiree: {
      nom: 'Soirée dégustation', mois: 12, univers: 'bar', prix: 25, participants: 30, marge: null, couts: 0, extras: 150,
      achats: true, part: 0.3, panier: 40, bon: false,
      lignes: { produits: 0, securite: 0, deco: 50, animation: 150, communication: 0, location: 0 },
      personnes: 0, heuresEquipe: 3, coutHoraire: s.coutHoraire, majoration: 0.25,
    },
    achat: { montant: 10_000, remise: 0.1, mois: 4, invendu: 0.05, taux: s.tauxDecouvert },
    exterieur: {
      nom: 'Fête du village', futs: 40, prixVente: 70, remise: 0, prixAchat: 42, co2: s.exterieur.co2ParFut, gobelets: 0,
      tireuse: 'neuve', prixTireuse: 1_500, duree: s.exterieur.dureeTireuse || 5, entretien: s.exterieur.entretienTireuse,
      livraisons: 10, km: 30, prixKm: s.exterieur.prixKm, heures: 1.5, coutHoraire: s.coutHoraire, don: 'aucun', montantDon: 500, futsDon: 5, cerfa: true,
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
      vue: 'carte', audit: { futs: 6, litres: 30, prixFut: 90, demis: 400, verres33: 0, pintes: 120, litres1L: 0, offerts: 4, caTTC: 2_600 },
    },
    calculette: {
      nom: 'Planche mixte', composants: [{ libelle: 'Charcuterie', cout: 3, quantite: 1 }, { libelle: 'Fromage', cout: 2.5, quantite: 1 }], tva: 'intermediaire', mode: 'prix', marge: 0.7, prixTTC: 18, famille: '',
      mix: [{ libelle: 'Bouteille de vin', cout: 6, consigne: 0, prixTTC: 15, quantite: 1 }, { libelle: 'Coffret bois', cout: 3, consigne: 0, prixTTC: 8, quantite: 1 }],
    },
    ouverture: { jour: 'dimanche', caBar: 800, caCave: 1_200, margeBar: null, margeCave: null, report: 0.2, heures: 14, coutHoraire: s.coutHoraire, frais: 0 },
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
  const choisi = (SIMULATEURS.find((s) => s.cle === params.get('sim'))?.cle ?? 'embauche') as TypeSimulation
  const choisir = (cle: TypeSimulation) => setParams((x) => { const n = new URLSearchParams(x); n.set('sim', cle); return n }, { replace: true })
  const aujourdhui = useMemo(() => new Date(), [])
  const reseauDispo = useReseauSiDispo()
  const tireusesParc = tireusesDu(equipementsDu(reseauDispo?.reseau, magasin))
  const [etats, setEtats] = useState<Etats>(() => etatsInitiaux(b, h, p, aujourdhui, tireusesParc))
  const maj = <K extends keyof Etats>(k: K, v: Partial<Etats[K]>) => setEtats((e) => ({ ...e, [k]: { ...e[k], ...v } }))
  const [gardees, setGardees] = useState<SimulationGardee[] | null>(null)
  const [nom, setNom] = useState('')
  const [message, setMessage] = useState<{ texte: string; bon: boolean } | null>(null)
  const [occupe, setOccupe] = useState(false)
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
  const sansBudget = simulateur.budget && (!b || !h)
  if (!sansBudget && choisi === 'embauche' && b && h) {
    const e = etats.embauche
    const equipe = h.equipe ?? []
    const mouvement: Mouvement | null = e.mouvement === 'primes' ? null : e.mouvement === 'embauche'
      ? { type: 'embauche', mois: e.mois, poste: { poste: e.poste || 'Poste', categorie: e.categorie, heuresHebdo: e.heures, brutMensuel: e.brut, primes: [] } }
      : equipe[e.index] ? (e.mouvement === 'depart' ? { type: 'depart', index: e.index, mois: e.mois } : { type: 'heures', index: e.index, mois: e.mois, heuresHebdo: e.nouvellesHeures }) : null
    const palier = (i: number, v: Partial<PalierPrime>) => maj('embauche', { paliers: e.paliers.map((x, j) => (j === i ? { ...x, ...v } : x)) })
    saisies = (
      <>
        <Saisies>
          <Choix libelle="Mouvement" valeur={e.mouvement} onChange={(v) => maj('embauche', { mouvement: v })} options={[['embauche', 'Embauche'], ['depart', 'Départ'], ['heures', 'Heures'], ['primes', 'Primes']]} />
          {e.mouvement !== 'primes' && <ChoixMois libelle={e.mouvement === 'embauche' ? 'Arrivée en' : e.mouvement === 'depart' ? 'Parti au 1er' : 'À partir de'} valeur={e.mois} onChange={(v) => maj('embauche', { mois: v })} />}
        </Saisies>
        {e.mouvement === 'primes' ? (
          <Stack spacing={1.5}>
            <Saisies>
              <Montant libelle="Salariés concernés" valeur={e.salaries} onChange={(v) => maj('embauche', { salaries: Math.max(0, Math.round(v)) })} unite="" />
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
      </>
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
            <Montant libelle="Mois de la période" valeur={e.mois} onChange={(v) => maj('prix', { mois: Math.min(12, Math.max(1, Math.round(v))) })} unite="mois" />
            <Montant libelle="CA HT de la période" valeur={ca} onChange={(v) => maj('prix', { ca: v })} />
          </Saisies>
          <Saisies>
            {LIGNES_REMISES.map((l) => <Montant key={l.cle} libelle={`${l.libelle}, HT`} valeur={e.montants[l.cle] ?? 0} onChange={(v) => maj('prix', { montants: { ...e.montants, [l.cle]: v } })} />)}
          </Saisies>
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
          <Taux libelle={e.type === 'remise' ? 'Remise' : 'Hausse'} valeur={e.taux} onChange={(v) => maj('prix', { taux: v })} />
          <Taux libelle="Taux de marge du produit" valeur={e.marge} onChange={(v) => maj('prix', { marge: v })} />
          {e.type === 'remise' && <Montant libelle="Cartons vendus d’habitude" valeur={e.cartons} onChange={(v) => maj('prix', { cartons: Math.max(0, Math.round(v)) })} unite="" />}
        </Saisies>
        {e.type === 'remise' && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={() => offre(1, 5)} sx={{ minHeight: 48 }}>Offre 5 + 1</Button>
            <Button variant="outlined" onClick={() => offre(2, 4)} sx={{ minHeight: 48 }}>Offre 4 + 2</Button>
          </Box>
        )}
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
      <Stack spacing={1.5}>
        {coche('baisse', 'Baisse du CA')}
        {e.baisse && <Saisies><Taux libelle="Baisse" valeur={e.tauxBaisse} onChange={(v) => maj('tresorerie', { tauxBaisse: v })} /><ChoixMois libelle="De" valeur={e.de} onChange={(v) => maj('tresorerie', { de: v })} /><ChoixMois libelle="À" valeur={e.a} onChange={(v) => maj('tresorerie', { a: v })} /></Saisies>}
        {coche('depense', 'Dépense imprévue (réparation, matériel)')}
        {e.depense && <Saisies><Montant libelle="Montant HT" valeur={e.montantDepense} onChange={(v) => maj('tresorerie', { montantDepense: v })} /><ChoixMois libelle="Payée en" valeur={e.moisDepense} onChange={(v) => maj('tresorerie', { moisDepense: v })} /></Saisies>}
        {coche('retard', 'Client qui paie en retard')}
        {e.retard && <Saisies><Montant libelle="Montant TTC attendu" valeur={e.montantRetard} onChange={(v) => maj('tresorerie', { montantRetard: v })} /><ChoixMois libelle="Attendu en" valeur={e.moisRetard} onChange={(v) => maj('tresorerie', { moisRetard: v })} /><Montant libelle="Retard" valeur={e.duree} onChange={(v) => maj('tresorerie', { duree: Math.round(v) })} unite="mois" /></Saisies>}
      </Stack>
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
    const r = u ? simulerVenteAdditionnelle(b, p, { univers: u, unSur: e.unSur, prixTTC: e.prix, tauxMarge: e.marge ?? margeU }) : null
    saisies = u ? (
      <Saisies>
        {universDispo.length > 1 && <Choix libelle="Univers" valeur={u} onChange={(v) => maj('vente_additionnelle', { univers: v })} options={[['cave', 'Cave'], ['bar', 'Bar']]} />}
        <Montant libelle="Un client sur" valeur={e.unSur} onChange={(v) => maj('vente_additionnelle', { unSur: Math.max(1, Math.round(v)) })} unite="" />
        <Montant libelle="Prix de l’article TTC" valeur={e.prix} onChange={(v) => maj('vente_additionnelle', { prix: v })} />
        <Taux libelle="Taux de marge de l’article" valeur={e.marge ?? margeU} onChange={(v) => maj('vente_additionnelle', { marge: v })} />
      </Saisies>
    ) : <EtatVide titre="Pas de tickets visés au budget" texte="La vente additionnelle part des tickets de la Cave ou du Bar visés au budget. Ils arrivent avec la proposition du siège." />
    if (r) {
      nomParDefaut = `1 article de plus pour 1 client sur ${e.unSur} (${u === 'cave' ? 'Cave' : 'Bar'})`
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
      saisies = <Saisies><Montant libelle={`CA HT de ${MOIS_LONGS[e.mois - 1]} jusqu’à hier soir`} valeur={e.realise} onChange={(v) => maj('reste_a_faire', { realise: v })} /></Saisies>
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
      equipe: { personnes: e.personnes, heures: e.heuresEquipe, coutHoraire: e.coutHoraire, majoration: e.majoration },
    }, p)
    saisies = (
      <Stack spacing={2}>
        <Saisies>
          <Champ libelle="Nom"><TextField size="small" value={e.nom} onChange={(x) => maj('soiree', { nom: x.target.value })} slotProps={{ htmlInput: { 'aria-label': 'Nom de l’événement', maxLength: 60 } }} sx={{ ...champ, width: 220 }} /></Champ>
          <ChoixMois libelle="Mois" valeur={e.mois} onChange={(v) => maj('soiree', { mois: v })} />
          <Choix libelle="Univers" valeur={e.univers} onChange={(v) => maj('soiree', { univers: v })} options={[['bar', 'Bar'], ['cave', 'Cave']]} />
        </Saisies>
        <Saisies>
          <Montant libelle="Prix par participant TTC" valeur={e.prix} onChange={(v) => maj('soiree', { prix: v })} />
          <Montant libelle="Participants attendus" valeur={e.participants} onChange={(v) => maj('soiree', { participants: Math.round(v) })} unite="" />
          <Taux libelle="Taux de marge" valeur={e.marge ?? margeU} onChange={(v) => maj('soiree', { marge: v })} />
        </Saisies>
        <Typography component="h3" sx={{ fontWeight: 700 }}>Achats des participants</Typography>
        <Saisies>
          <FormControlLabel control={<Checkbox sx={{ width: 48, height: 48 }} checked={e.achats} onChange={(x) => maj('soiree', { achats: x.target.checked })} />} label="Les participants achètent en cave" sx={{ minHeight: 48, mr: 0 }} />
          {e.achats && <>
            <Taux libelle="Part qui achète" valeur={e.part} onChange={(v) => maj('soiree', { part: v })} />
            <Montant libelle="Panier moyen TTC" valeur={e.panier} onChange={(v) => maj('soiree', { panier: v })} />
            <FormControlLabel control={<Checkbox sx={{ width: 48, height: 48 }} checked={e.bon} onChange={(x) => maj('soiree', { bon: x.target.checked })} />} label="Entrée remboursée en bon d’achat" sx={{ minHeight: 48, mr: 0 }} />
          </>}
        </Saisies>
        <Typography component="h3" sx={{ fontWeight: 700 }}>Coûts HT</Typography>
        <Saisies>
          {LIGNES_EVENEMENT.map((l) => l.cle === 'divers'
            ? <Montant key={l.cle} libelle={l.libelle} valeur={e.couts} onChange={(v) => maj('soiree', { couts: v })} />
            : <Montant key={l.cle} libelle={l.libelle} valeur={lignes[l.cle]} onChange={(v) => maj('soiree', { lignes: { ...lignes, [l.cle]: v } })} />)}
          <Montant libelle="Extras de personnel" valeur={e.extras} onChange={(v) => maj('soiree', { extras: v })} />
        </Saisies>
        <Typography component="h3" sx={{ fontWeight: 700 }}>Heures en plus de l’équipe en place</Typography>
        <Saisies>
          <Montant libelle="Personnes" valeur={e.personnes} onChange={(v) => maj('soiree', { personnes: Math.max(0, Math.round(v)) })} unite="" />
          <Montant libelle="Heures chacune" valeur={e.heuresEquipe} onChange={(v) => maj('soiree', { heuresEquipe: v })} unite="h" />
          <Montant libelle="Coût d’une heure chargée" valeur={e.coutHoraire} onChange={(v) => maj('soiree', { coutHoraire: v })} />
          <Taux libelle="Majoration des heures" valeur={e.majoration} onChange={(v) => maj('soiree', { majoration: v })} />
        </Saisies>
      </Stack>
    )
    nomParDefaut = `${e.nom || 'Soirée'} en ${MOIS_LONGS[e.mois - 1]}`
    phrase = `${nomParDefaut}, ${e.participants} participants à ${montant(e.prix)} : ${r.gain >= 0 ? `gain de ${montant(r.gain)}` : `perte de ${montant(-r.gain)}`}${r.caAchats > 0 ? `, dont ${montant(r.caAchats - r.bon)} d’achats en cave` : ''}${r.seuil !== null ? `, à partir de ${r.seuil} participants on ne perd pas d’argent` : ''}.`
    resultats = (
      <Resultats>
        <Indicateur libelle={r.gain >= 0 ? 'Gain' : 'Perte'} valeur={montant(Math.abs(r.gain))} detail={`${montant(r.caHT)} de CA HT, ${montant(r.couts)} de coûts`} />
        <Indicateur libelle="Participants pour ne rien perdre" valeur={r.seuil !== null ? entier(r.seuil) : 'Jamais rentable'} detail={r.seuil !== null ? `${montant(r.gainParParticipant)} gagnés par participant` : 'La marge ne couvre pas la redevance'} />
        {r.caAchats > 0 && <Indicateur libelle="Achats des participants" valeur={montant(r.caAchats - r.bon)} detail={`HT, ${entier(r.acheteurs)} acheteurs${r.bon > 0 ? `, bons de ${montant(r.bon)} déduits` : ''}`} />}
        {r.equipeEnPlace > 0 && <Indicateur libelle="Heures de l’équipe en place" valeur={montant(r.equipeEnPlace)} detail="chargées, majoration comprise" />}
      </Resultats>
    )
    ajout = { tempsForts: tempsFortDeSoiree(e.nom || 'Soirée', e.mois, e.univers, r, coutsPropres) }
    if (e.extras > 0 || r.equipeEnPlace > 0) note = 'Les extras et les heures de l’équipe se saisissent dans l’Équipe du budget.'
  }
  if (choisi === 'achat') {
    const e = etats.achat
    const r = simulerAchat({ montant: e.montant, remise: e.remise, mois: e.mois, invendu: e.invendu, tauxAnnuel: e.taux, tvaAchats: p.tresorerie.tvaAchats })
    saisies = (
      <Saisies>
        <Montant libelle="Achat au prix habituel HT" valeur={e.montant} onChange={(v) => maj('achat', { montant: v })} />
        <Taux libelle="Remise du fournisseur" valeur={e.remise} onChange={(v) => maj('achat', { remise: v })} />
        <Montant libelle="Temps pour tout vendre" valeur={e.mois} onChange={(v) => maj('achat', { mois: v })} unite="mois" />
        <Taux libelle="Part qui risque de rester" valeur={e.invendu} onChange={(v) => maj('achat', { invendu: v })} />
        <Taux libelle="Coût annuel de l’argent" valeur={e.taux} onChange={(v) => maj('achat', { taux: v })} />
      </Saisies>
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
        <Saisies>
          {coutExt === null ? <Montant libelle="Coût HT" valeur={e.cout} onChange={(v) => maj('investissement', { cout: v })} /> : null}
          <Montant libelle="Amorti sur" valeur={e.duree} onChange={(v) => maj('investissement', { duree: v })} unite="ans" />
          {e.modele === 'corner' && reperes
            ? <Montant libelle="Mètres linéaires" valeur={e.metres} onChange={(v) => maj('investissement', { metres: v })} unite="m" />
            : e.modele === 'exterieur' ? null : <Montant libelle="CA HT en plus par an" valeur={e.ca} onChange={(v) => maj('investissement', { ca: v })} />}
          {!(e.modele === 'corner' && s.corner.tauxMarge > 0) && <Taux libelle="Taux de marge" valeur={e.marge} onChange={(v) => maj('investissement', { marge: v })} />}
          {!(e.modele === 'corner' && s.corner.demarque > 0) && <Taux libelle="Démarque" valeur={e.demarque} onChange={(v) => maj('investissement', { demarque: v })} />}
          {chargesExt === null && <Montant libelle="Charges en plus par an HT" valeur={e.charges} onChange={(v) => maj('investissement', { charges: v })} />}
        </Saisies>
        <Saisies>
          <Choix libelle="Financement" valeur={e.financement} onChange={(v) => maj('investissement', { financement: v })} options={[['tresorerie', 'Trésorerie'], ['pret', 'Prêt']]} />
          {e.financement === 'pret' && <><Taux libelle="Taux du prêt" valeur={e.tauxPret} onChange={(v) => maj('investissement', { tauxPret: v })} /><Montant libelle="Durée du prêt" valeur={e.dureePret} onChange={(v) => maj('investissement', { dureePret: v })} unite="ans" /></>}
        </Saisies>
        {e.modele === 'exterieur' && (pal
          ? <Typography color="text.secondary">Préconisation du siège pour {montant(e.objectifExterieur)} de CA : {entier(pal.tireuses)} tireuses, {montant(pal.investissement)} d’investissement{e.camion ? ` et ${montant(s.marcheExterieur.camion)} de camion` : ''}, {unChiffre(pal.heures)} h par semaine{s.coutHoraire > 0 ? `, soit ${montant(chargesExt ?? 0)} par an au coût horaire du siège` : ''}.</Typography>
          : <Typography color="text.secondary">Le siège n’a pas encore réglé la préconisation du marché extérieur : saisis le coût et les charges en mode Libre.</Typography>)}
        {reperes && <Typography color="text.secondary">Repères du siège : {montant(s.corner.caParMetre)} de CA HT par mètre et par an, soit {montant(ca)}{s.corner.tauxMarge > 0 ? `, marge ${taux(s.corner.tauxMarge)}` : ''}{s.corner.demarque > 0 ? `, démarque ${taux(s.corner.demarque)}` : ''}.</Typography>}
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
      futs: e.futs, prixVente: e.prixVente, remise: e.remise, prixAchat: e.prixAchat, co2: e.co2, gobelets: e.gobelets,
      tireuse: e.tireuse, prixTireuse: e.prixTireuse, dureeTireuse: e.duree, entretien: e.entretien,
      livraisons: e.livraisons, km: e.km, prixKm: e.prixKm, heures: e.heures, coutHoraire: e.coutHoraire,
      don: { type: e.don, montant: e.montantDon, futs: e.futsDon, cerfa: e.cerfa },
      prixLivraison, sponsoring: e.sponsoring ? { montant: e.sponsoMontant, parFut: e.sponsoParFut } : undefined,
      materiel: e.materiel, astreinte: e.astreinte, locations: { nombre: e.locations, prix: e.prixLocation },
    }, p, s.donMecenat)
    const margeExt = margeFut(Math.max(0, e.prixVente - e.remise), e.prixAchat)
    const m = (k: keyof Etats['exterieur']) => (v: number) => maj('exterieur', { [k]: v })
    saisies = (
      <Stack spacing={2}>
        <Saisies>
          <Texte libelle="Contrat" aria="Nom du contrat" valeur={e.nom} onChange={(v) => maj('exterieur', { nom: v })} />
          <Montant libelle="Fûts vendus par an" valeur={e.futs} onChange={(v) => maj('exterieur', { futs: Math.round(v) })} unite="" />
        </Saisies>
        <Typography component="h3" sx={{ fontWeight: 700 }}>Par fût, HT</Typography>
        <Saisies>
          <Montant libelle="Prix de vente du fût" valeur={e.prixVente} onChange={m('prixVente')} />
          <Montant libelle="Remise accordée" valeur={e.remise} onChange={m('remise')} />
          <Montant libelle="Prix d’achat du fût" valeur={e.prixAchat} onChange={m('prixAchat')} />
          <Montant libelle="CO2 par fût" valeur={e.co2} onChange={m('co2')} />
          <Montant libelle="Gobelets par fût" valeur={e.gobelets} onChange={m('gobelets')} />
        </Saisies>
        <Typography component="h3" sx={{ fontWeight: 700 }}>Tireuse et livraisons</Typography>
        <Saisies>
          <Choix libelle="Tireuse" valeur={e.tireuse} onChange={(v) => maj('exterieur', { tireuse: v })} options={[['neuve', 'À acheter'], ['parc', 'Déjà dans le parc']]} />
          {e.tireuse === 'neuve' && <><Montant libelle="Prix de la tireuse HT" valeur={e.prixTireuse} onChange={m('prixTireuse')} /><Montant libelle="Durée de vie" valeur={e.duree} onChange={m('duree')} unite="ans" /></>}
          <Montant libelle="Entretien par an" valeur={e.entretien} onChange={m('entretien')} />
        </Saisies>
        <Saisies>
          <Montant libelle="Livraisons par an" valeur={e.livraisons} onChange={(v) => maj('exterieur', { livraisons: Math.round(v) })} unite="" />
          <Montant libelle="Kilomètres aller-retour" valeur={e.km} onChange={m('km')} unite="km" />
          <Montant libelle="Prix du kilomètre" valeur={e.prixKm} onChange={m('prixKm')} unite="€/km" />
          <Montant libelle="Heures par livraison" valeur={e.heures} onChange={m('heures')} unite="h" />
          <Montant libelle="Coût d’une heure chargée" valeur={e.coutHoraire} onChange={m('coutHoraire')} />
          <Montant libelle="Livraison facturée HT" valeur={prixLivraison} onChange={(v) => maj('exterieur', { prixLivraison: v })} />
        </Saisies>
        {prixGrille !== null && e.prixLivraison === null && <Typography color="text.secondary">Livraison au prix de la grille du siège : {prixGrille ? montant(prixGrille) : 'offerte'} pour {unChiffre(e.km / 2)} km et {montant(commande)} commandés par livraison.</Typography>}
        {e.prixLivraison !== null && prixGrille !== null && <Box><Button onClick={() => maj('exterieur', { prixLivraison: null })} sx={{ minHeight: 48 }}>Reprendre le prix de la grille ({montant(prixGrille)})</Button></Box>}
        <Typography component="h3" sx={{ fontWeight: 700 }}>Matériel, astreinte, locations</Typography>
        <Saisies>
          <Montant libelle="Matériel prêté par an HT" valeur={e.materiel} onChange={m('materiel')} />
          <Montant libelle="Heures d’astreinte par an" valeur={e.astreinte} onChange={m('astreinte')} unite="h" />
          <Montant libelle="Locations de tireuse facturées" valeur={e.locations} onChange={(v) => maj('exterieur', { locations: Math.round(v) })} unite="" />
          {e.locations > 0 && <Montant libelle="Prix d’une location HT" valeur={e.prixLocation} onChange={m('prixLocation')} />}
        </Saisies>
        <Typography component="h3" sx={{ fontWeight: 700 }}>Don ou sponsoring à l’association</Typography>
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
            <Montant libelle="Rétrocession par fût" valeur={e.sponsoParFut} onChange={m('sponsoParFut')} />
          </>}
        </Saisies>
      </Stack>
    )
    nomParDefaut = `${e.nom || 'Contrat extérieur'}, ${e.futs} fûts`
    phrase = r.netParFut <= 0
      ? `${nomParDefaut} : chaque fût fait perdre ${centimes(-r.netParFut)}, le prix ne couvre pas l’achat et la redevance.`
      : `${nomParDefaut} : ${centimes(r.netParFut)} nets par fût, ${montant(r.coutFixe)} de coûts fixes${r.recettes ? `, ${montant(r.recettes)} de livraisons et locations facturées` : ''}, équilibre à ${r.equilibre} fûts ; ${r.gain >= 0 ? `gain de ${montant(r.gain)}` : `perte de ${montant(-r.gain)}`} au volume prévu.`
    resultats = (
      <Resultats>
        <Indicateur libelle="Marge par fût" valeur={centimes(margeExt.valeur)} detail={margeExt.taux !== null ? `${taux(margeExt.taux)} du prix de vente après remise` : 'pas de prix de vente'} />
        <Indicateur libelle="Net par fût" valeur={centimes(r.netParFut)} detail={`après achat, CO2, gobelets et ${centimes(r.redevanceParFut)} de redevance et publicité`} />
        <Indicateur libelle="Coûts fixes de l’année" valeur={montant(r.coutFixe)} detail={`tireuse ${montant(r.tireuseAn)}, livraisons ${montant(r.livraisonsAn)}${r.don.valeur ? `, don ${montant(r.don.cout)}` : ''}${r.sponsoring ? `, sponsoring ${montant(r.sponsoring)}` : ''}${r.materiel ? `, matériel ${montant(r.materiel)}` : ''}${r.astreinte ? `, astreinte ${montant(r.astreinte)}` : ''}`} />
        {r.recettes > 0 && <Indicateur libelle="Livraisons et locations facturées" valeur={montant(r.recettes)} detail={`HT, ${montant(r.recettesNettes)} après redevance et publicité`} />}
        <Indicateur libelle="Fûts pour l’équilibre" valeur={r.equilibre !== null ? entier(r.equilibre) : 'Jamais'} detail={r.equilibre !== null ? `${e.futs} prévus` : 'Le fût ne rapporte rien'} />
        <Indicateur libelle={r.gain >= 0 ? 'Gain de l’année' : 'Perte de l’année'} valeur={montant(Math.abs(r.gain))} detail={`sur ${montant(r.ca)} de CA HT`} />
        {r.remiseMax !== null && <Indicateur libelle="Remise maximale par fût" valeur={centimes(r.remiseMax)} detail={`au-delà, ${e.futs} fûts ne paient plus les coûts fixes`} />}
        {r.prixPlancherLivraison !== null && r.coutLivraison > 0 && <Indicateur libelle="Prix plancher d’une livraison" valeur={centimes(r.prixPlancherLivraison)} detail={`HT, pour couvrir ${centimes(r.coutLivraison)} de route et de temps`} />}
        {r.don.valeur > 0 && <Indicateur libelle="Coût réel du don" valeur={montant(r.don.cout)} detail={r.don.reduction ? `${montant(r.don.valeur)} moins ${taux(TAUX_MECENAT)} de réduction d’impôt` : s.donMecenat ? 'sans reçu Cerfa, pas de réduction' : 'sans réduction d’impôt'} />}
      </Resultats>
    )
  }
  if (choisi === 'tireuses') {
    const e = etats.tireuses
    const x = etats.exterieur
    // Prix de vente et d'achat du fût (Joseph, 14/11/2026) : repris du Contrat extérieur (prix après remise), modifiables ;
    // le net par fût en découle (moins redevance et publicité, CO2 et gobelets du contrat).
    const prixVente = e.prixVente ?? Math.max(0, x.prixVente - x.remise)
    const prixAchat = e.prixAchat ?? x.prixAchat
    const fut = simulerExterieur({ futs: x.futs, prixVente, remise: 0, prixAchat, co2: x.co2, gobelets: x.gobelets, tireuse: 'parc', prixTireuse: 0, dureeTireuse: 1, entretien: 0, livraisons: 0, km: 0, prixKm: 0, heures: 0, coutHoraire: 0, don: { type: 'aucun', montant: 0, futs: 0, cerfa: false } }, p, false)
    const net = fut.netParFut
    const marge = margeFut(prixVente, prixAchat)
    const occupation = e.saisie === 'occupation' ? { saison: e.occSaison, hors: e.occHors } : null
    const r = simulerParc({ tireuses: e.tireuses, semainesSaison: e.semaines, sortiesSaison: e.sortiesSaison, sortiesHorsSaison: e.sortiesHors, refus: e.refus, futsParSortie: e.futsParSortie, netParFut: net, prixNeuve: e.prixNeuve, dureeVie: e.duree, entretien: e.entretien, vieilles: e.vieilles, occupation, saturation: s.tireuses.saturation })
    const m = (k: keyof Etats['tireuses']) => (v: number) => maj('tireuses', { [k]: v })
    const vieille = (i: number, v: Partial<Etats['tireuses']['vieilles'][number]>) => maj('tireuses', { vieilles: e.vieilles.map((y, j) => (j === i ? { ...y, ...v } : y)) })
    saisies = (
      <Stack spacing={2}>
        <Saisies>
          <Montant libelle="Tireuses" valeur={e.tireuses} onChange={(v) => maj('tireuses', { tireuses: Math.round(v) })} unite="" />
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
        <Saisies>
          <Montant libelle="Prix de vente du fût HT" valeur={prixVente} onChange={(v) => maj('tireuses', { prixVente: v })} />
          <Montant libelle="Prix d’achat du fût HT" valeur={prixAchat} onChange={(v) => maj('tireuses', { prixAchat: v })} />
        </Saisies>
        <Typography color="text.secondary">Marge par fût : {centimes(marge.valeur)}{marge.taux !== null ? `, soit ${taux(marge.taux)} du prix de vente` : ''}. Net par fût : {centimes(net)}, après {centimes(fut.redevanceParFut)} de redevance et publicité, CO2 et gobelets.</Typography>
        <Saisies>
          <Montant libelle="Prix d’une tireuse neuve HT" valeur={e.prixNeuve} onChange={m('prixNeuve')} />
          <Montant libelle="Durée de vie" valeur={e.duree} onChange={m('duree')} unite="ans" />
          <Montant libelle="Entretien par an" valeur={e.entretien} onChange={m('entretien')} />
        </Saisies>
        <Typography component="h3" sx={{ fontWeight: 700 }}>Tireuses qui vieillissent</Typography>
        {e.vieilles.map((v, i) => (
          <Saisies key={i}>
            <Texte libelle="Tireuse" aria={`Nom de la tireuse ${i + 1}`} valeur={v.nom} onChange={(nom) => vieille(i, { nom })} largeur={160} />
            <MontantDe libelle="Âge" aria={`Âge de la tireuse ${i + 1}`} valeur={v.age} onChange={(age) => vieille(i, { age })} unite="ans" />
            <MontantDe libelle="Réparations de l’année" aria={`Réparations de la tireuse ${i + 1}`} valeur={v.reparations} onChange={(reparations) => vieille(i, { reparations })} />
            <Button color="inherit" startIcon={<DeleteOutlineOutlined />} onClick={() => maj('tireuses', { vieilles: e.vieilles.filter((_, j) => j !== i) })} aria-label={`Retirer la tireuse ${i + 1}`} sx={{ minHeight: 48 }}>Retirer</Button>
          </Saisies>
        ))}
        <Box><Button startIcon={<AddOutlined />} onClick={() => maj('tireuses', { vieilles: [...e.vieilles, { nom: `Tireuse ${e.vieilles.length + 1}`, age: 5, reparations: 0 }] })} sx={{ minHeight: 48 }}>Ajouter une tireuse</Button></Box>
      </Stack>
    )
    nomParDefaut = `Parc de ${e.tireuses} tireuse${e.tireuses > 1 ? 's' : ''}`
    const payer = r.futsPourPayer !== null && r.weekendsPourPayer !== null ? `Une tireuse de plus se paie avec ${entier(r.futsPourPayer)} fûts, soit ${entier(r.weekendsPourPayer)} week-ends loués par an. ` : ''
    phrase = `${payer}Chaque tireuse est louée environ ${entier(r.weekendsParTireuse)} week-ends par an. ${e.refus ? `${e.refus} week-ends refusés : ${r.racheter ? 'racheter une tireuse.' : 'pas assez pour racheter.'}` : r.sature ? 'Parc plein en saison : note les week-ends refusés pour décider.' : 'Aucun week-end refusé : pas besoin de racheter.'}${r.aRemplacer.length ? ` Remplacer ${r.aRemplacer.join(', ')} : ses réparations dépassent le coût d’une neuve.` : ''}`
    resultats = (
      <Resultats>
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
        {e.becs.map((b, i) => (
          <Box key={i} component="section" aria-label={`Bec ${i + 1}`} sx={{ display: 'grid', gap: 1, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography component="h3" sx={{ fontWeight: 700, flex: 1 }}>Bec {i + 1}</Typography>
              {e.becs.length > 1 && <Button color="inherit" startIcon={<DeleteOutlineOutlined />} onClick={() => maj('pression', { becs: e.becs.filter((_, j) => j !== i), remplace: 0 })} aria-label={`Retirer le bec ${i + 1}`} sx={{ minHeight: 48 }}>Retirer</Button>}
            </Box>
            {champsBec(b, `bec ${i + 1}`, (v) => bec(i, v))}
          </Box>
        ))}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {e.becs.length < 20 && <Button startIcon={<AddOutlined />} onClick={() => maj('pression', { becs: [...e.becs, { ...e.becs[e.becs.length - 1], biere: `Bière ${e.becs.length + 1}` }] })} sx={{ minHeight: 48 }}>Ajouter un bec</Button>}
          <FormControlLabel control={<Checkbox sx={{ width: 48, height: 48 }} checked={e.projet} onChange={(x) => maj('pression', { projet: x.target.checked })} />} label="Projet : ajouter ou remplacer un bec" sx={{ minHeight: 48, mr: 0 }} />
        </Box>
        {e.projet && (
          <Box component="section" aria-label="Projet de bec" sx={{ display: 'grid', gap: 1.5 }}>
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
          </Box>
        )}
      </Stack>
    )
    const faible = carte.faible !== null ? carte.lignes[carte.faible] : null
    const fb = carte.faible !== null ? e.becs[carte.faible] : null
    nomParDefaut = `Carte pression, ${e.becs.length} bec${e.becs.length > 1 ? 's' : ''}`
    phrase = faible && fb
      ? `Le bec ${carte.faible! + 1} (${fb.biere}) rapporte ${montant(faible.margeSemaine)} par semaine à ${faible.tauxMarge === null ? '–' : taux(faible.tauxMarge)} de marge${faible.joursPourVider !== null ? ` et met ${entier(faible.joursPourVider)} jours à vider un fût` : ''} : ${faible.sousCible && faible.prixDemiCible !== null ? `monte le demi à ${centimes(faible.prixDemiCible)}` : 'change de bière ou de taille de fût'}${faible.vieillit && faible.sousCible ? ', ou remplace-le' : ''}.`
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
            <TableHead><TableRow><TableCell>Bec</TableCell><TableCell align="right">Coût du demi</TableCell><TableCell align="right">Marge du demi</TableCell><TableCell align="right">Marge par semaine</TableCell><TableCell align="right">Jours pour vider un fût</TableCell><TableCell align="right">Fûts par mois</TableCell></TableRow></TableHead>
            <TableBody>
              {carte.lignes.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>{i + 1} · {e.becs[i].biere}</TableCell>
                  <TableCell align="right">{l.coutDemi === null ? '–' : centimes(l.coutDemi)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: l.sousCible ? 'error.main' : undefined }}>{l.tauxDemi === null ? '–' : taux(l.tauxDemi)}</TableCell>
                  <TableCell align="right">{montant(l.margeSemaine)}</TableCell>
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
    const perteCarte = e.becs.length ? somme(e.becs.map((x) => x.perte)) / e.becs.length : 0
    const r = auditPression({ futs: a.futs, litres: a.litres, prixFut: a.prixFut, demis: a.demis, verres33: a.verres33, pintes: a.pintes, litresVendus1L: a.litres1L, offerts: a.offerts, caTTC: a.caTTC, tva: s.tva.normale })
    const au = (k: keyof typeof a) => (v: number) => maj('pression', { audit: { ...a, [k]: v } })
    saisies = (
      <Stack spacing={2}>
        <Saisies><Choix libelle="Je regarde" valeur="audit" onChange={(v) => maj('pression', { vue: v })} options={[['carte', 'Ma carte pression'], ['audit', 'La perte sur une semaine']]} /></Saisies>
        <Typography component="h3" sx={{ fontWeight: 700 }}>Sorti du stock</Typography>
        <Saisies>
          <Montant libelle="Fûts vidés dans la semaine" valeur={a.futs} onChange={au('futs')} unite="" />
          <Montant libelle="Litres par fût" valeur={a.litres} onChange={au('litres')} unite="l" />
          <Montant libelle="Prix moyen du fût HT" valeur={a.prixFut} onChange={au('prixFut')} />
        </Saisies>
        <Typography component="h3" sx={{ fontWeight: 700 }}>Vendu et offert (caisse de la semaine)</Typography>
        <Saisies>
          <Montant libelle="Demis 25 cl" valeur={a.demis} onChange={(v) => au('demis')(Math.round(v))} unite="" />
          <Montant libelle="Verres 33 cl" valeur={a.verres33} onChange={(v) => au('verres33')(Math.round(v))} unite="" />
          <Montant libelle="Pintes 50 cl" valeur={a.pintes} onChange={(v) => au('pintes')(Math.round(v))} unite="" />
          <Montant libelle="Pichets et mètres (litres)" valeur={a.litres1L} onChange={au('litres1L')} unite="l" />
          <Montant libelle="Offerts (litres)" valeur={a.offerts} onChange={au('offerts')} unite="l" />
          <Montant libelle="CA pression de la semaine TTC" valeur={a.caTTC} onChange={au('caTTC')} />
        </Saisies>
      </Stack>
    )
    nomParDefaut = 'Audit pression d’une semaine'
    phrase = r.taux === null ? '' : `${unChiffre(r.perte)} litres perdus sur ${unChiffre(r.sortis)} sortis du stock, soit ${taux(r.taux)}${perteCarte > 0 ? ` (${taux(perteCarte)} prévus dans la carte)` : ''} : ${montant(r.coutAn)} de bière payée pour rien et ${montant(r.caManqueAn)} de CA HT manqué sur un an.`
    resultats = r.taux === null ? null : (
      <Resultats>
        <Indicateur libelle="Perte réelle" valeur={taux(r.taux)} detail={`${unChiffre(r.perte)} litres sur ${unChiffre(r.sortis)}, ${unChiffre(r.vendus)} vendus`}
          ecart={perteCarte > 0 ? { texte: ecartPts(r.taux - perteCarte), hausse: r.taux > perteCarte, favorable: r.taux <= perteCarte } : undefined} />
        <Indicateur libelle="Bière payée pour rien" valeur={montant(r.coutAn)} detail={`par an, ${montant(r.coutSemaine)} cette semaine`} />
        <Indicateur libelle="CA HT manqué" valeur={montant(r.caManqueAn)} detail="par an, au prix moyen du litre vendu" />
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
    )
    if (e.mode === 'mix') {
      const lignes = e.mix ?? []
      const r = margeMix(lignes, tva)
      const ligneMix = (i: number, v: Partial<LigneMix>) => maj('calculette', { mix: lignes.map((y, j) => (j === i ? { ...y, ...v } : y)) })
      saisies = (
        <Stack spacing={2}>
          {entete}
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
        <Typography component="h3" sx={{ fontWeight: 700 }}>Coût HT</Typography>
        {e.composants.map((c, i) => (
          <Saisies key={i}>
            <Texte libelle="Composant" aria={`Composant ${i + 1}`} valeur={c.libelle} onChange={(libelle) => comp(i, { libelle })} largeur={180} />
            <MontantDe libelle="Coût HT" aria={`Coût HT du composant ${i + 1}`} valeur={c.cout} onChange={(v) => comp(i, { cout: v })} />
            <MontantDe libelle="Quantité" aria={`Quantité du composant ${i + 1}`} valeur={c.quantite} onChange={(v) => comp(i, { quantite: v })} unite="" largeur={100} />
            {e.composants.length > 1 && <Button color="inherit" startIcon={<DeleteOutlineOutlined />} onClick={() => maj('calculette', { composants: e.composants.filter((_, j) => j !== i) })} aria-label={`Retirer le composant ${i + 1}`} sx={{ minHeight: 48 }}>Retirer</Button>}
          </Saisies>
        ))}
        <Box>{e.composants.length < 30 && <Button startIcon={<AddOutlined />} onClick={() => maj('calculette', { composants: [...e.composants, { libelle: '', cout: 0, quantite: 1 }] })} sx={{ minHeight: 48 }}>Ajouter un composant</Button>}</Box>
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
  if (choisi === 'ouverture') {
    const e = etats.ouverture
    const mBar = e.margeBar ?? margeUnivers(b, 'bar') ?? 0.6, mCave = e.margeCave ?? margeUnivers(b, 'cave') ?? 0.3
    const majoration = e.jour === 'dimanche' ? s.majorations.dimanche : s.majorations.ferie
    const r = simulerOuverture({ caBar: e.caBar, caCave: e.caCave, margeBar: mBar, margeCave: mCave, report: e.report, heures: e.heures, coutHoraire: e.coutHoraire, majoration, frais: e.frais }, p)
    saisies = (
      <Stack spacing={2}>
        <Saisies>
          <Choix libelle="Jour" valeur={e.jour} onChange={(v) => maj('ouverture', { jour: v })} options={[['dimanche', 'Un dimanche'], ['ferie', 'Un jour férié']]} />
          <Montant libelle="CA HT attendu au bar" valeur={e.caBar} onChange={(v) => maj('ouverture', { caBar: v })} />
          <Montant libelle="CA HT attendu en cave" valeur={e.caCave} onChange={(v) => maj('ouverture', { caCave: v })} />
          <Taux libelle="Marge du bar" valeur={mBar} onChange={(v) => maj('ouverture', { margeBar: v })} />
          <Taux libelle="Marge de la cave" valeur={mCave} onChange={(v) => maj('ouverture', { margeCave: v })} />
          <Taux libelle="Part qui serait venue un autre jour" valeur={e.report} onChange={(v) => maj('ouverture', { report: v })} />
        </Saisies>
        <Saisies>
          <Montant libelle="Heures payées" valeur={e.heures} onChange={(v) => maj('ouverture', { heures: v })} unite="h" />
          <Montant libelle="Coût d’une heure chargée" valeur={e.coutHoraire} onChange={(v) => maj('ouverture', { coutHoraire: v })} />
          <Montant libelle="Frais du jour HT" valeur={e.frais} onChange={(v) => maj('ouverture', { frais: v })} />
        </Saisies>
        <Typography color="text.secondary">Majoration des heures {e.jour === 'dimanche' ? 'du dimanche' : 'd’un jour férié'} : {taux(majoration)}{majoration ? ', réglée par le siège' : ', à régler par le siège selon la convention collective'}.</Typography>
      </Stack>
    )
    nomParDefaut = `Ouverture ${e.jour === 'dimanche' ? 'un dimanche' : 'un jour férié'}, ${montant(r.ca)} de CA`
    phrase = `${nomParDefaut} : ${r.gain >= 0 ? `gain de ${montant(r.gain)}` : `perte de ${montant(-r.gain)}`}${r.seuil !== null ? `, rentable à partir de ${montant(r.seuil)} de CA HT dans la journée` : ''}.`
    resultats = (
      <Resultats>
        <Indicateur libelle={r.gain >= 0 ? 'Gain du jour' : 'Perte du jour'} valeur={montant(Math.abs(r.gain))} detail={`marge ${montant(r.marge)}, équipe ${montant(r.personnel)}, frais et redevance ${montant(r.frais + r.redevance)}`} />
        <Indicateur libelle="CA nouveau" valeur={montant(r.caNouveau)} detail={`sur ${montant(r.ca)} attendus`} />
        <Indicateur libelle="CA pour ne rien perdre" valeur={r.seuil === null ? 'Jamais' : montant(r.seuil)} detail="HT, au même mélange bar et cave" />
      </Resultats>
    )
  }

  const garder = async () => {
    setOccupe(true); setMessage(null)
    try {
      await garderSimulation(magasin, choisi, nom.trim() || nomParDefaut, { ...etats[choisi] }, phrase)
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
    setEtats((e) => ({ ...e, [g.type]: { ...e[g.type], ...g.donnees } }))
    choisir(g.type)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const retirer = async (g: SimulationGardee) => {
    try { await retirerSimulation(g.id); await recharger() } catch { setMessage({ texte: 'La simulation n’a pas été retirée. Vérifie ta connexion, puis réessaie.', bon: false }) }
  }

  return (
    <Stack spacing={3} component="section" aria-label="Simulateurs" id="partie-simulateurs">
      <Box component="nav" aria-label="Choisir un simulateur" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' } }}>
        {SIMULATEURS.map((x) => {
          const actif = x.cle === choisi
          return (
            <ButtonBase key={x.cle} onClick={() => choisir(x.cle)} aria-current={actif ? 'true' : undefined} focusRipple
              sx={{ justifyContent: 'flex-start', textAlign: 'left', gap: 1.5, p: 1.5, minHeight: 64, borderRadius: '12px', border: 2, borderColor: actif ? 'text.primary' : 'divider', bgcolor: 'background.paper' }}>
              <Box sx={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: '10px', flex: 'none', bgcolor: actif ? 'secondary.main' : 'action.hover', color: actif ? 'secondary.contrastText' : 'text.primary' }}>{x.icone}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>{x.titre}</Typography>
                <Typography color="text.secondary" sx={{ fontSize: '0.875rem' }}>{x.question}</Typography>
              </Box>
            </ButtonBase>
          )
        })}
      </Box>

      <GlobalStyles styles={{ '@media print': {
        'body.simulation-seule *': { visibility: 'hidden' },
        'body.simulation-seule #carte-simulation, body.simulation-seule #carte-simulation *': { visibility: 'visible' },
        'body.simulation-seule #carte-simulation': { position: 'absolute', left: 0, top: 0, width: '100%', border: 'none !important' },
      } }} />
      <Card id="carte-simulation" sx={{ p: { xs: 2, md: 3 }, borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="h2">{simulateur.titre}<Box component="span" className="impression-seule"> · {magasin} · {aujourdhui.toLocaleDateString('fr-FR')}</Box></Typography>
          <Aide sujet={simulateur.aide} />
        </Box>
        {sansBudget ? (
          <EtatVide titre={`Le budget ${annee} n’est pas encore proposé`} texte="Ce simulateur part du budget de l’année du magasin. Les autres simulateurs (promo, soirée, achat en volume, investissement, extérieur, pression, prix) marchent déjà." />
        ) : (
          <>
            {saisies}
            {resultats}
            {phrase && <Typography role="status" sx={{ fontWeight: 600, fontSize: '1rem', maxWidth: '75ch' }}>{phrase}</Typography>}
            {phrase && (
              <Box className="pas-a-l-impression" sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-end', pt: 1, borderTop: 1, borderColor: 'divider' }}>
                {peutGarder && gardees !== null && (
                  <>
                    <Champ libelle="Nom de la simulation">
                      <TextField size="small" value={nom} placeholder={nomParDefaut} onChange={(x) => setNom(x.target.value)} slotProps={{ htmlInput: { 'aria-label': 'Nom de la simulation', maxLength: 80 } }} sx={{ ...champ, width: { xs: '100%', sm: 320 } }} />
                    </Champ>
                    <Button variant="outlined" startIcon={<BookmarkAddOutlined />} onClick={() => void garder()} aria-disabled={occupe} sx={{ minHeight: 48 }}>Garder</Button>
                  </>
                )}
                <Button variant="outlined" startIcon={<PictureAsPdfOutlined />} onClick={enPDF} sx={{ minHeight: 48 }}>PDF</Button>
                {ajout && mettreAuBudget && <Button variant="contained" startIcon={<PlaylistAddOutlined />} onClick={() => void versBudget()} aria-disabled={occupe} sx={{ minHeight: 48 }}>Mettre dans mon budget {annee}</Button>}
                {ajout && !mettreAuBudget && budgetValide && <Typography color="text.secondary" sx={{ alignSelf: 'center' }}>Le budget {annee} est validé : la simulation se garde sans le changer.</Typography>}
              </Box>
            )}
            {message && <Typography role="alert" sx={{ fontWeight: 600, color: message.bon ? 'success.dark' : 'error.main' }}>{message.texte}</Typography>}
          </>
        )}
      </Card>

      {gardees !== null && (
        <Stack spacing={1.5} component="section" aria-label="Simulations gardées">
          <Typography variant="h2">Simulations gardées</Typography>
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
                    <Button startIcon={<ReplayOutlined />} onClick={() => rouvrir(g)} sx={{ minHeight: 48 }}>Rouvrir</Button>
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
