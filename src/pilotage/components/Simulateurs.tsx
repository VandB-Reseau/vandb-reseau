import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Checkbox from '@mui/material/Checkbox'
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
  caCorner, parametresSimulateurs, resteAFaire, simulerAchat, simulerCoupDur, simulerEmbauche, simulerInvestissement, simulerPrix,
  simulerSoiree, simulerVenteAdditionnelle, tempsFortDeSoiree, type CoupDur, type Mouvement,
} from '../moteur/simulateurs'
import {
  cartePression, coutComposition, coutContrats, margePourPrix, nouveauBec, prixPourMarge, simulerExterieur, simulerOuverture, simulerParc,
  cibleProductivite, TAUX_MECENAT, type Bec, type Composant,
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
  { cle: 'embauche', titre: 'Embaucher', question: 'Si j’embauche, si quelqu’un part ?', icone: <PersonAddOutlined />, aide: 'simEmbauche', budget: true },
  { cle: 'prix', titre: 'Promo ou hausse de prix', question: 'Combien vendre en plus pour garder ma marge ?', icone: <SellOutlined />, aide: 'simPrix', budget: false },
  { cle: 'tresorerie', titre: 'Coup dur de trésorerie', question: 'Et si le CA baisse, si un client paie en retard ?', icone: <AccountBalanceWalletOutlined />, aide: 'simTresorerie', budget: true },
  { cle: 'vente_additionnelle', titre: 'Vente additionnelle', question: 'Un article de plus à un client sur dix ?', icone: <AddShoppingCartOutlined />, aide: 'simVente', budget: true },
  { cle: 'reste_a_faire', titre: 'Reste à faire du mois', question: 'Combien vendre par jour pour tenir mon budget ?', icone: <FlagOutlined />, aide: 'simReste', budget: true },
  { cle: 'soiree', titre: 'Soirée, dégustation', question: 'Combien de participants pour ne pas perdre d’argent ?', icone: <CelebrationOutlined />, aide: 'simSoiree', budget: false },
  { cle: 'achat', titre: 'Acheter en volume', question: 'La remise vaut-elle le stock bloqué ?', icone: <Inventory2Outlined />, aide: 'simAchat', budget: false },
  { cle: 'investissement', titre: 'Investir', question: 'Tireuse, terrasse, corner : en combien de temps remboursé ?', icone: <StorefrontOutlined />, aide: 'simInvestissement', budget: false },
  // Vague 9 (choix 138 à 146, Joseph 14/11/2026)
  { cle: 'exterieur', titre: 'Contrat extérieur', question: 'Ce contrat avec une association est-il rentable ?', icone: <LocalShippingOutlined />, aide: 'simExterieur', budget: false },
  { cle: 'tireuses', titre: 'Parc de tireuses', question: 'Faut-il racheter ou remplacer une tireuse ?', icone: <WarehouseOutlined />, aide: 'simTireuses', budget: false },
  { cle: 'pression', titre: 'Ma carte pression', question: 'Quels becs, à quel prix, quelle marge ?', icone: <SportsBarOutlined />, aide: 'simPression', budget: false },
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
  embauche: { mouvement: Mouvement['type']; poste: string; categorie: Categorie; heures: number; brut: number; mois: number; index: number; nouvellesHeures: number }
  prix: { type: 'remise' | 'hausse'; taux: number; marge: number }
  tresorerie: { baisse: boolean; tauxBaisse: number; de: number; a: number; depense: boolean; montantDepense: number; moisDepense: number; retard: boolean; montantRetard: number; moisRetard: number; duree: number }
  vente_additionnelle: { univers: 'cave' | 'bar'; unSur: number; prix: number; marge: number | null }
  reste_a_faire: { mois: number; jour: number; realise: number }
  soiree: { nom: string; mois: number; univers: Univers; prix: number; participants: number; marge: number | null; couts: number; extras: number }
  achat: { montant: number; remise: number; mois: number; invendu: number; taux: number }
  exterieur: {
    nom: string; futs: number; prixVente: number; remise: number; prixAchat: number; co2: number; gobelets: number
    tireuse: 'neuve' | 'parc'; prixTireuse: number; duree: number; entretien: number
    livraisons: number; km: number; prixKm: number; heures: number; coutHoraire: number
    don: 'aucun' | 'argent' | 'nature'; montantDon: number; futsDon: number; cerfa: boolean
  }
  tireuses: { tireuses: number; semaines: number; sortiesSaison: number; sortiesHors: number; refus: number; futsParSortie: number; net: number | null; prixNeuve: number; duree: number; entretien: number; vieilles: { nom: string; age: number; reparations: number }[] }
  pression: { becs: Bec[]; projet: boolean; mode: 'ajouter' | 'remplacer'; remplace: number; cout: number; cannibalisation: number; nouveau: Bec }
  calculette: { nom: string; composants: Composant[]; tva: 'normale' | 'intermediaire' | 'reduite'; mode: 'prix' | 'marge'; marge: number; prixTTC: number }
  ouverture: { jour: 'dimanche' | 'ferie'; caBar: number; caCave: number; margeBar: number | null; margeCave: number | null; report: number; heures: number; coutHoraire: number; frais: number }
  investissement: { modele: 'libre' | 'corner'; libelle: string; cout: number; duree: number; mois: number; ca: number; metres: number; marge: number; demarque: number; charges: number; financement: 'tresorerie' | 'pret'; tauxPret: number; dureePret: number; univers: Univers }
}

function margeUnivers(b: Budget | null, u: Univers): number | null {
  const f = b?.familles.filter((x) => x.univers === u) ?? []
  const ca = somme(f.map((x) => x.objectif))
  return ca > 0 ? Math.round(somme(f.map((x) => x.margeObjectif)) / ca * 100) / 100 : null
}

function etatsInitiaux(b: Budget | null, h: Hypotheses | null, p: ParametresReseau, aujourdhui: Date): Etats {
  const annee = h?.annee ?? aujourdhui.getFullYear()
  const moisSuivant = annee === aujourdhui.getFullYear() ? Math.min(12, aujourdhui.getMonth() + 2) : 1
  const s = parametresSimulateurs(p)
  return {
    embauche: { mouvement: 'embauche', poste: 'Vendeur', categorie: 'employe', heures: 35, brut: Math.round(p.charges.reduction.smicAnnuel / 12), mois: moisSuivant, index: 0, nouvellesHeures: 28 },
    prix: { type: 'remise', taux: 0.1, marge: b && b.ca > 0 ? Math.round(b.tauxMarge * 100) / 100 : 0.35 },
    tresorerie: { baisse: true, tauxBaisse: 0.15, de: 1, a: 3, depense: false, montantDepense: 10_000, moisDepense: 6, retard: false, montantRetard: 5_000, moisRetard: 7, duree: 2 },
    vente_additionnelle: { univers: b?.flux.cave?.objectif ? 'cave' : 'bar', unSur: 10, prix: 12, marge: null },
    reste_a_faire: { mois: aujourdhui.getMonth() + 1, jour: aujourdhui.getDate(), realise: 0 },
    soiree: { nom: 'Soirée dégustation', mois: 12, univers: 'bar', prix: 25, participants: 30, marge: null, couts: 200, extras: 150 },
    achat: { montant: 10_000, remise: 0.1, mois: 4, invendu: 0.05, taux: s.tauxDecouvert },
    exterieur: {
      nom: 'Fête du village', futs: 40, prixVente: 70, remise: 0, prixAchat: 42, co2: s.exterieur.co2ParFut, gobelets: 0,
      tireuse: 'neuve', prixTireuse: 1_500, duree: s.exterieur.dureeTireuse || 5, entretien: s.exterieur.entretienTireuse,
      livraisons: 10, km: 30, prixKm: s.exterieur.prixKm, heures: 1.5, coutHoraire: s.coutHoraire, don: 'aucun', montantDon: 500, futsDon: 5, cerfa: true,
    },
    tireuses: { tireuses: 2, semaines: 22, sortiesSaison: 30, sortiesHors: 8, refus: 0, futsParSortie: 3, net: null, prixNeuve: 1_500, duree: s.exterieur.dureeTireuse || 5, entretien: s.exterieur.entretienTireuse, vieilles: [] },
    pression: {
      becs: [{ biere: 'Blonde', prixFut: 90, litres: 30, perte: 0.1, prixDemi: 4.2, prixPinte: 7.8, demis: 80, pintes: 30 }],
      projet: false, mode: 'ajouter', remplace: 0, cout: 500, cannibalisation: 0.5,
      nouveau: { biere: 'Nouvelle bière', prixFut: 100, litres: 30, perte: 0.1, prixDemi: 4.5, prixPinte: 8.5, demis: 30, pintes: 10 },
    },
    calculette: { nom: 'Planche mixte', composants: [{ libelle: 'Charcuterie', cout: 3, quantite: 1 }, { libelle: 'Fromage', cout: 2.5, quantite: 1 }], tva: 'intermediaire', mode: 'prix', marge: 0.7, prixTTC: 18 },
    ouverture: { jour: 'dimanche', caBar: 800, caCave: 1_200, margeBar: null, margeCave: null, report: 0.2, heures: 14, coutHoraire: s.coutHoraire, frais: 0 },
    investissement: { modele: 'libre', libelle: 'Tireuse', cout: 15_000, duree: 5, mois: moisSuivant, ca: 20_000, metres: 6, marge: 0.35, demarque: 0, charges: 1_000, financement: 'tresorerie', tauxPret: 0.04, dureePret: 5, univers: 'bar' },
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
  const [etats, setEtats] = useState<Etats>(() => etatsInitiaux(b, h, p, aujourdhui))
  const maj = <K extends keyof Etats>(k: K, v: Partial<Etats[K]>) => setEtats((e) => ({ ...e, [k]: { ...e[k], ...v } }))
  const [gardees, setGardees] = useState<SimulationGardee[] | null>(null)
  const [nom, setNom] = useState('')
  const [message, setMessage] = useState<{ texte: string; bon: boolean } | null>(null)
  const [occupe, setOccupe] = useState(false)
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
    const mouvement: Mouvement | null = e.mouvement === 'embauche'
      ? { type: 'embauche', mois: e.mois, poste: { poste: e.poste || 'Poste', categorie: e.categorie, heuresHebdo: e.heures, brutMensuel: e.brut, primes: [] } }
      : equipe[e.index] ? (e.mouvement === 'depart' ? { type: 'depart', index: e.index, mois: e.mois } : { type: 'heures', index: e.index, mois: e.mois, heuresHebdo: e.nouvellesHeures }) : null
    saisies = (
      <>
        <Saisies>
          <Choix libelle="Mouvement" valeur={e.mouvement} onChange={(v) => maj('embauche', { mouvement: v })} options={[['embauche', 'Embauche'], ['depart', 'Départ'], ['heures', 'Heures']]} />
          <ChoixMois libelle={e.mouvement === 'embauche' ? 'Arrivée en' : e.mouvement === 'depart' ? 'Parti au 1er' : 'À partir de'} valeur={e.mois} onChange={(v) => maj('embauche', { mois: v })} />
        </Saisies>
        {e.mouvement === 'embauche' ? (
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
      const contrats = e.mouvement === 'embauche' && r.coutAnnee > 0 ? coutContrats(r.coutAnnee, e.brut, 13 - e.mois, s.coefInterim) : null
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
          {contrats && <Indicateur libelle="Le même poste en CDD" valeur={montant(contrats.cdd)} detail={`en ${annee}, avec 10 % de prime de fin de contrat${contrats.interim !== null ? ` · en intérim : ${montant(contrats.interim)}` : ''}`} />}
        </Resultats>
      )
    }
  }
  if (choisi === 'prix') {
    const e = etats.prix
    const r = simulerPrix(e.type, e.taux, e.marge)
    saisies = (
      <Saisies>
        <Choix libelle="Je fais" valeur={e.type} onChange={(v) => maj('prix', { type: v })} options={[['remise', 'Une remise'], ['hausse', 'Une hausse de prix']]} />
        <Taux libelle={e.type === 'remise' ? 'Remise' : 'Hausse'} valeur={e.taux} onChange={(v) => maj('prix', { taux: v })} />
        <Taux libelle="Taux de marge du produit" valeur={e.marge} onChange={(v) => maj('prix', { marge: v })} />
      </Saisies>
    )
    nomParDefaut = e.type === 'remise' ? `Remise de ${taux(e.taux)}` : `Hausse de ${taux(e.taux)}`
    if (e.type === 'remise') {
      phrase = r.ventesEnPlus === null ? `Une remise de ${taux(e.taux)} sur un produit margé à ${taux(e.marge)} fait vendre à perte.` : `Avec ${taux(e.taux)} de remise, il faut vendre ${taux(r.ventesEnPlus)} de plus pour garder la même marge.`
      resultats = (
        <Resultats>
          <Indicateur libelle="Ventes en plus nécessaires" valeur={r.ventesEnPlus === null ? 'Vente à perte' : `+ ${taux(r.ventesEnPlus)}`} detail={r.ventesEnPlus === null ? 'La remise dépasse la marge' : `Pour 100 ventes avant : ${entier(100 * (1 + r.ventesEnPlus))} après`} />
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
    const r = simulerSoiree({ prixTTC: e.prix, participants: e.participants, tva, tauxMarge: e.marge ?? margeU, couts: e.couts, extras: e.extras }, p)
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
          <Montant libelle="Coûts propres HT" valeur={e.couts} onChange={(v) => maj('soiree', { couts: v })} />
          <Montant libelle="Extras de personnel" valeur={e.extras} onChange={(v) => maj('soiree', { extras: v })} />
        </Saisies>
      </Stack>
    )
    nomParDefaut = `${e.nom || 'Soirée'} en ${MOIS_LONGS[e.mois - 1]}`
    phrase = `${nomParDefaut}, ${e.participants} participants à ${montant(e.prix)} : ${r.gain >= 0 ? `gain de ${montant(r.gain)}` : `perte de ${montant(-r.gain)}`}${r.seuil !== null ? `, à partir de ${r.seuil} participants on ne perd pas d’argent` : ''}.`
    resultats = (
      <Resultats>
        <Indicateur libelle={r.gain >= 0 ? 'Gain' : 'Perte'} valeur={montant(Math.abs(r.gain))} detail={`${montant(r.caHT)} de CA HT, ${montant(r.couts)} de coûts`} />
        <Indicateur libelle="Participants pour ne rien perdre" valeur={r.seuil !== null ? entier(r.seuil) : 'Jamais rentable'} detail={r.seuil !== null ? `${montant(r.gainParParticipant)} gagnés par participant` : 'La marge ne couvre pas la redevance'} />
      </Resultats>
    )
    ajout = { tempsForts: [tempsFortDeSoiree(e.nom || 'Soirée', e.mois, e.univers, r, e.couts)] }
    if (e.extras > 0) note = 'Les extras de personnel se saisissent dans l’Équipe du budget.'
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
    const ca = e.modele === 'corner' && s.corner.caParMetre > 0 ? caCorner(e.metres, s) : e.ca
    const marge = e.modele === 'corner' && s.corner.tauxMarge > 0 ? s.corner.tauxMarge : e.marge
    const demarque = e.modele === 'corner' ? s.corner.demarque || e.demarque : e.demarque
    const pret = e.financement === 'pret' ? { taux: e.tauxPret, duree: e.dureePret } : null
    const r = simulerInvestissement({ cout: e.cout, duree: e.duree, mois: e.mois, ca, tauxMarge: marge, demarque, charges: e.charges, pret }, p)
    const reperes = e.modele === 'corner' && s.corner.caParMetre > 0
    saisies = (
      <Stack spacing={2}>
        <Saisies>
          <Choix libelle="Projet" valeur={e.modele} onChange={(v) => maj('investissement', { modele: v, libelle: v === 'corner' ? 'Corner alimentaire' : e.libelle === 'Corner alimentaire' ? 'Tireuse' : e.libelle, univers: v === 'corner' ? 'cave' : e.univers })} options={[['libre', 'Libre'], ['corner', 'Corner alimentaire']]} />
          <Champ libelle="Nom"><TextField size="small" value={e.libelle} onChange={(x) => maj('investissement', { libelle: x.target.value })} slotProps={{ htmlInput: { 'aria-label': 'Nom du projet', maxLength: 60 } }} sx={{ ...champ, width: 200 }} /></Champ>
          <ChoixMois libelle="En service en" valeur={e.mois} onChange={(v) => maj('investissement', { mois: v })} />
        </Saisies>
        <Saisies>
          <Montant libelle="Coût HT" valeur={e.cout} onChange={(v) => maj('investissement', { cout: v })} />
          <Montant libelle="Amorti sur" valeur={e.duree} onChange={(v) => maj('investissement', { duree: v })} unite="ans" />
          {e.modele === 'corner' && reperes
            ? <Montant libelle="Mètres linéaires" valeur={e.metres} onChange={(v) => maj('investissement', { metres: v })} unite="m" />
            : <Montant libelle="CA HT en plus par an" valeur={e.ca} onChange={(v) => maj('investissement', { ca: v })} />}
          {!(e.modele === 'corner' && s.corner.tauxMarge > 0) && <Taux libelle="Taux de marge" valeur={e.marge} onChange={(v) => maj('investissement', { marge: v })} />}
          {!(e.modele === 'corner' && s.corner.demarque > 0) && <Taux libelle="Démarque" valeur={e.demarque} onChange={(v) => maj('investissement', { demarque: v })} />}
          <Montant libelle="Charges en plus par an HT" valeur={e.charges} onChange={(v) => maj('investissement', { charges: v })} />
        </Saisies>
        <Saisies>
          <Choix libelle="Financement" valeur={e.financement} onChange={(v) => maj('investissement', { financement: v })} options={[['tresorerie', 'Trésorerie'], ['pret', 'Prêt']]} />
          {e.financement === 'pret' && <><Taux libelle="Taux du prêt" valeur={e.tauxPret} onChange={(v) => maj('investissement', { tauxPret: v })} /><Montant libelle="Durée du prêt" valeur={e.dureePret} onChange={(v) => maj('investissement', { dureePret: v })} unite="ans" /></>}
        </Saisies>
        {reperes && <Typography color="text.secondary">Repères du siège : {montant(s.corner.caParMetre)} de CA HT par mètre et par an, soit {montant(ca)}{s.corner.tauxMarge > 0 ? `, marge ${taux(s.corner.tauxMarge)}` : ''}{s.corner.demarque > 0 ? `, démarque ${taux(s.corner.demarque)}` : ''}.</Typography>}
      </Stack>
    )
    nomParDefaut = `${e.libelle || 'Investissement'} de ${montant(e.cout)}`
    phrase = `${nomParDefaut} : ${montant(r.ebeAn)} d’EBE en plus par an${r.retourAnnees !== null ? `, remboursé en ${unChiffre(r.retourAnnees)} an${r.retourAnnees >= 2 ? 's' : ''}` : ', jamais remboursé'} ; trésorerie ${ecartMontant(r.annee1.tresorerie)} la 1re année.`
    resultats = (
      <Resultats>
        <Indicateur libelle="EBE en plus par an" valeur={montant(r.ebeAn)} detail={`sur ${montant(ca)} de CA HT`} />
        <Indicateur libelle="Remboursé en" valeur={r.retourAnnees !== null ? `${unChiffre(r.retourAnnees)} an${r.retourAnnees >= 2 ? 's' : ''}` : 'Jamais'} detail="coût ÷ EBE en plus" />
        <Indicateur libelle="Résultat en plus par an" valeur={montant(r.resultatAn)} detail={`après ${montant(r.amortissement)} d’amortissement${r.interets ? ` et ${montant(r.interets)} d’intérêts` : ''}`} />
        <Indicateur libelle="Trésorerie la 1re année" valeur={ecartMontant(r.annee1.tresorerie)} detail={`${r.annee1.mois} mois en service`} />
      </Resultats>
    )
    const univers: Univers = e.modele === 'corner' ? 'cave' : e.univers
    ajout = {
      investissements: [{ libelle: (e.libelle || 'Investissement').slice(0, 60), type: 'equipement', montant: Math.round(e.cout), mois: e.mois, duree: Math.max(1, Math.round(e.duree)) }],
      ...(pret ? { emprunts: [{ libelle: `Prêt ${e.libelle || ''}`.trim().slice(0, 60), montant: Math.round(e.cout), taux: e.tauxPret, duree: e.dureePret, premiereEcheance: Math.min(12, e.mois + 1) }] } : {}),
      ...(ca > 0 ? { ajustementsCA: [{ libelle: (e.libelle || 'Investissement').slice(0, 60), univers, de: e.mois, a: 12, montant: Math.round(ca / 12) }] } : {}),
    }
    note = `Au budget, le CA en plus entre dans la ${univers === 'cave' ? 'Cave' : univers === 'bar' ? 'Bar' : 'Extérieur'} à sa marge${e.charges > 0 ? ' ; les charges en plus se saisissent dans les Frais' : ''}.`
  }

  if (choisi === 'exterieur') {
    const e = etats.exterieur
    const r = simulerExterieur({
      futs: e.futs, prixVente: e.prixVente, remise: e.remise, prixAchat: e.prixAchat, co2: e.co2, gobelets: e.gobelets,
      tireuse: e.tireuse, prixTireuse: e.prixTireuse, dureeTireuse: e.duree, entretien: e.entretien,
      livraisons: e.livraisons, km: e.km, prixKm: e.prixKm, heures: e.heures, coutHoraire: e.coutHoraire,
      don: { type: e.don, montant: e.montantDon, futs: e.futsDon, cerfa: e.cerfa },
    }, p, s.donMecenat)
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
        </Saisies>
        <Typography component="h3" sx={{ fontWeight: 700 }}>Don ou sponsoring à l’association</Typography>
        <Saisies>
          <Choix libelle="Don" valeur={e.don} onChange={(v) => maj('exterieur', { don: v })} options={[['aucun', 'Aucun'], ['argent', 'En argent'], ['nature', 'En fûts']]} />
          {e.don === 'argent' && <Montant libelle="Montant du don" valeur={e.montantDon} onChange={m('montantDon')} />}
          {e.don === 'nature' && <Montant libelle="Fûts offerts" valeur={e.futsDon} onChange={(v) => maj('exterieur', { futsDon: Math.round(v) })} unite="" />}
          {e.don !== 'aucun' && s.donMecenat && <FormControlLabel control={<Checkbox sx={{ width: 48, height: 48 }} checked={e.cerfa} onChange={(x) => maj('exterieur', { cerfa: x.target.checked })} />} label="Reçu Cerfa demandé" sx={{ minHeight: 48, mr: 0 }} />}
        </Saisies>
      </Stack>
    )
    nomParDefaut = `${e.nom || 'Contrat extérieur'}, ${e.futs} fûts`
    phrase = r.netParFut <= 0
      ? `${nomParDefaut} : chaque fût fait perdre ${centimes(-r.netParFut)}, le prix ne couvre pas l’achat et la redevance.`
      : `${nomParDefaut} : ${centimes(r.netParFut)} nets par fût, ${montant(r.coutFixe)} de coûts fixes, équilibre à ${r.equilibre} fûts ; ${r.gain >= 0 ? `gain de ${montant(r.gain)}` : `perte de ${montant(-r.gain)}`} au volume prévu.`
    resultats = (
      <Resultats>
        <Indicateur libelle="Net par fût" valeur={centimes(r.netParFut)} detail={`après achat, CO2, gobelets et ${centimes(r.redevanceParFut)} de redevance et publicité`} />
        <Indicateur libelle="Coûts fixes de l’année" valeur={montant(r.coutFixe)} detail={`tireuse ${montant(r.tireuseAn)}, livraisons ${montant(r.livraisonsAn)}${r.don.valeur ? `, don ${montant(r.don.cout)}` : ''}`} />
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
    const netExterieur = simulerExterieur({ futs: x.futs, prixVente: x.prixVente, remise: x.remise, prixAchat: x.prixAchat, co2: x.co2, gobelets: x.gobelets, tireuse: 'parc', prixTireuse: 0, dureeTireuse: 1, entretien: 0, livraisons: 0, km: 0, prixKm: 0, heures: 0, coutHoraire: 0, don: { type: 'aucun', montant: 0, futs: 0, cerfa: false } }, p, false).netParFut
    const net = e.net ?? netExterieur
    const r = simulerParc({ tireuses: e.tireuses, semainesSaison: e.semaines, sortiesSaison: e.sortiesSaison, sortiesHorsSaison: e.sortiesHors, refus: e.refus, futsParSortie: e.futsParSortie, netParFut: net, prixNeuve: e.prixNeuve, dureeVie: e.duree, entretien: e.entretien, vieilles: e.vieilles })
    const m = (k: keyof Etats['tireuses']) => (v: number) => maj('tireuses', { [k]: v })
    const vieille = (i: number, v: Partial<Etats['tireuses']['vieilles'][number]>) => maj('tireuses', { vieilles: e.vieilles.map((y, j) => (j === i ? { ...y, ...v } : y)) })
    saisies = (
      <Stack spacing={2}>
        <Typography color="text.secondary">Chiffres de l’année, lus dans la plateforme de location des tireuses.</Typography>
        <Saisies>
          <Montant libelle="Tireuses" valeur={e.tireuses} onChange={(v) => maj('tireuses', { tireuses: Math.round(v) })} unite="" />
          <Montant libelle="Semaines de saison" valeur={e.semaines} onChange={(v) => maj('tireuses', { semaines: Math.round(v) })} unite="sem." />
          <Montant libelle="Sorties en saison" valeur={e.sortiesSaison} onChange={(v) => maj('tireuses', { sortiesSaison: Math.round(v) })} unite="" />
          <Montant libelle="Sorties hors saison" valeur={e.sortiesHors} onChange={(v) => maj('tireuses', { sortiesHors: Math.round(v) })} unite="" />
          <Montant libelle="Demandes refusées faute de tireuse" valeur={e.refus} onChange={(v) => maj('tireuses', { refus: Math.round(v) })} unite="" />
          <Montant libelle="Fûts par sortie" valeur={e.futsParSortie} onChange={m('futsParSortie')} unite="" />
          <Montant libelle="Net par fût" valeur={net} onChange={(v) => maj('tireuses', { net: v })} />
        </Saisies>
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
    phrase = `${e.refus ? `${e.refus} demandes refusées : ${montant(r.margePerdue)} de marge perdue, ${r.racheter ? 'plus que' : 'moins que'} les ${montant(r.coutAnnuelNeuve)} par an d’une tireuse neuve. ${r.racheter ? 'Racheter une tireuse.' : 'Pas besoin de racheter.'}` : 'Aucune demande refusée : pas besoin de racheter.'}${r.aRemplacer.length ? ` Remplacer ${r.aRemplacer.join(', ')} : ses réparations dépassent le coût d’une neuve.` : ''}`
    resultats = (
      <Resultats>
        <Indicateur libelle="Occupation en saison" valeur={r.occupationSaison === null ? '–' : taux(r.occupationSaison)} detail="une sortie par tireuse et par semaine au plus" />
        <Indicateur libelle="Occupation hors saison" valeur={r.occupationHorsSaison === null ? '–' : taux(r.occupationHorsSaison)} />
        <Indicateur libelle="Marge perdue sur les refus" valeur={montant(r.margePerdue)} detail={`${centimes(net)} nets par fût`} />
        <Indicateur libelle="Coût d’une tireuse neuve" valeur={montant(r.coutAnnuelNeuve)} detail="par an, amortissement et entretien" />
        <Indicateur libelle="Racheter une tireuse" valeur={r.racheter ? 'Oui' : 'Non'} detail={r.couverture !== null && r.margePerdue > 0 ? `la marge perdue couvre ${unChiffre(r.couverture)} fois son coût annuel` : 'aucune marge perdue sur des refus'} />
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
        <MontantDe libelle="Pinte TTC" aria={`Prix de la pinte TTC, ${quoi}`} valeur={b.prixPinte} onChange={(prixPinte) => changer({ prixPinte })} largeur={110} />
        <MontantDe libelle="Demis par semaine" aria={`Demis par semaine, ${quoi}`} valeur={b.demis} onChange={(demis) => changer({ demis: Math.round(demis) })} unite="" largeur={110} />
        <MontantDe libelle="Pintes par semaine" aria={`Pintes par semaine, ${quoi}`} valeur={b.pintes} onChange={(pintes) => changer({ pintes: Math.round(pintes) })} unite="" largeur={110} />
      </Saisies>
    )
    const projet = e.projet ? nouveauBec(e.becs, e.nouveau, { cout: e.cout, cannibalisation: e.cannibalisation, remplace: e.mode === 'remplacer' && e.becs[e.remplace] ? e.remplace : null }, tva) : null
    saisies = (
      <Stack spacing={2}>
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
  if (choisi === 'calculette') {
    const e = etats.calculette
    const tva = s.tva[e.tva]
    const cout = coutComposition(e.composants)
    const r = e.mode === 'prix' ? prixPourMarge(cout, e.marge, tva) : margePourPrix(cout, e.prixTTC, tva)
    const comp = (i: number, v: Partial<Composant>) => maj('calculette', { composants: e.composants.map((y, j) => (j === i ? { ...y, ...v } : y)) })
    saisies = (
      <Stack spacing={2}>
        <Saisies>
          <Texte libelle="Produit" aria="Nom du produit" valeur={e.nom} onChange={(v) => maj('calculette', { nom: v })} />
          <Choix libelle="TVA" valeur={e.tva} onChange={(v) => maj('calculette', { tva: v })} options={[['normale', taux(s.tva.normale)], ['intermediaire', taux(s.tva.intermediaire)], ['reduite', taux(s.tva.reduite)]]} />
          <Choix libelle="Je cherche" valeur={e.mode} onChange={(v) => maj('calculette', { mode: v })} options={[['prix', 'Le prix de vente'], ['marge', 'La marge']]} />
          {e.mode === 'prix' ? <Taux libelle="Marge visée" valeur={e.marge} onChange={(v) => maj('calculette', { marge: v })} /> : <Montant libelle="Prix de vente TTC" valeur={e.prixTTC} onChange={(v) => maj('calculette', { prixTTC: v })} />}
        </Saisies>
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
          <Indicateur libelle={e.mode === 'prix' ? 'Prix de vente TTC' : 'Taux de marge'} valeur={e.mode === 'prix' ? centimes(r.prixTTC) : r.tauxMarge === null ? '–' : taux(r.tauxMarge)} detail={e.mode === 'prix' ? `${centimes(r.prixHT)} HT` : `${centimes(r.marge)} par vente`} />
          <Indicateur libelle="Coût HT" valeur={centimes(r.cout)} detail={`${e.composants.length} composant${e.composants.length > 1 ? 's' : ''}`} />
          <Indicateur libelle="Coefficient" valeur={r.coefficient === null ? '–' : r.coefficient.toFixed(2).replace('.', ',')} detail="prix TTC ÷ coût HT" />
        </Resultats>
      )
    } else phrase = 'Une marge de 100 % ou plus ne donne aucun prix.'
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

      <Card sx={{ p: { xs: 2, md: 3 }, borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="h2">{simulateur.titre}</Typography>
          <Aide sujet={simulateur.aide} />
        </Box>
        {sansBudget ? (
          <EtatVide titre={`Le budget ${annee} n’est pas encore proposé`} texte="Ce simulateur part du budget de l’année du magasin. Les autres simulateurs (promo, soirée, achat en volume, investissement, extérieur, pression, prix) marchent déjà." />
        ) : (
          <>
            {saisies}
            {resultats}
            {phrase && <Typography role="status" sx={{ fontWeight: 600, fontSize: '1rem', maxWidth: '75ch' }}>{phrase}</Typography>}
            {phrase && (peutGarder && gardees !== null || ajout) && (
              <Box className="pas-a-l-impression" sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-end', pt: 1, borderTop: 1, borderColor: 'divider' }}>
                {peutGarder && gardees !== null && (
                  <>
                    <Champ libelle="Nom de la simulation">
                      <TextField size="small" value={nom} placeholder={nomParDefaut} onChange={(x) => setNom(x.target.value)} slotProps={{ htmlInput: { 'aria-label': 'Nom de la simulation', maxLength: 80 } }} sx={{ ...champ, width: { xs: '100%', sm: 320 } }} />
                    </Champ>
                    <Button variant="outlined" startIcon={<BookmarkAddOutlined />} onClick={() => void garder()} aria-disabled={occupe} sx={{ minHeight: 48 }}>Garder</Button>
                  </>
                )}
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
