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
import CelebrationOutlined from '@mui/icons-material/CelebrationOutlined'
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
import { chargerSimulations, garderSimulation, retirerSimulation, type SimulationGardee, type TypeSimulation } from '../data/pilotage'
import { categorieLibelle, type Categorie } from '../moteur/equipe'
import {
  caCorner, parametresSimulateurs, resteAFaire, simulerAchat, simulerCoupDur, simulerEmbauche, simulerInvestissement, simulerPrix,
  simulerSoiree, simulerVenteAdditionnelle, tempsFortDeSoiree, type CoupDur, type Mouvement,
} from '../moteur/simulateurs'
import type { AjustementCA, Budget, Emprunt, Hypotheses, Investissement, ParametresReseau, TempsFort, Univers } from '../moteur/types'
import { dateHeure, ecartMontant, ecartPts, montant, MOIS_LONGS, tauxCourt as taux } from '../lib/format'
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

  const garder = async () => {
    setOccupe(true); setMessage(null)
    try {
      await garderSimulation(magasin, choisi, nom.trim() || nomParDefaut, { ...etats[choisi] }, phrase)
      setNom(''); setMessage({ texte: 'Simulation gardée.', bon: true })
      await recharger()
    } catch { setMessage({ texte: 'La simulation n’a pas été gardée. Vérifie ta connexion, puis réessaie.', bon: false }) }
    finally { setOccupe(false) }
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
          <EtatVide titre={`Le budget ${annee} n’est pas encore proposé`} texte="Ce simulateur part du budget de l’année du magasin. Les simulateurs de promo, de soirée, d’achat en volume et d’investissement marchent déjà." />
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
