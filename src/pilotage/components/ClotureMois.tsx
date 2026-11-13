import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import CheckCircle from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedOutlined from '@mui/icons-material/RadioButtonUncheckedOutlined'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import { chargerStocks, enregistrerStock } from '../data/pilotage'
import { nombre } from '../import/caisse'
import { enChiffres } from '../lib/format'
import type { StockSaisi } from '../moteur/stock'
import { CausesEcartsMois } from './CausesEcarts'

// Clôture du mois (refonte vague 2, Joseph 09/11/2026, 12A) : les saisies d'un mois en liste de contrôle, au lieu de
// quatre écrans en puces. Chaque ligne dit si c'est fait et ouvre la saisie ; un mois est complet quand tout est fait.
// Le CA arrive seul de la caisse ; le stock se saisit chaque mois ; les comptes, à la fin de chaque quadrimestre.
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

// Dernier mois terminé de l'année (1 à 12), 0 si aucun
export function dernierMoisClos(annee: number, aujourdhui = new Date()) {
  if (annee < aujourdhui.getFullYear()) return 12
  if (annee > aujourdhui.getFullYear()) return 0
  return aujourdhui.getMonth()
}

export interface EtapeCloture { cle: string; libelle: string; detail: string; fait: boolean }

export function etapesCloture({ mois, annee, reelMois, stockSaisi, fraisRenseignes, quadrimestres }: {
  mois: number; annee: number; reelMois: number[]; stockSaisi: boolean; fraisRenseignes: boolean; quadrimestres: number[]
}): EtapeCloture[] {
  const q = mois % 4 === 0 ? mois / 4 : null
  return [
    { cle: 'reel', libelle: 'Réel du mois', detail: reelMois.includes(mois) ? 'CA et tickets de la caisse reçus' : 'CA et tickets de la caisse, importés chaque mois ou saisis à la main', fait: reelMois.includes(mois) },
    { cle: 'saisieStock', libelle: 'Stock de fin de mois', detail: stockSaisi ? 'Cave, Bar et Extérieur saisis' : 'Cave, Bar et Extérieur au prix d’achat HT', fait: stockSaisi },
    { cle: 'frais', libelle: `Frais ${annee}`, detail: fraisRenseignes ? 'Renseignés pour l’année' : 'Charges de l’année, à renseigner une fois', fait: fraisRenseignes },
    ...(q ? [{ cle: 'quadrimestres', libelle: 'Comptes du quadrimestre', detail: quadrimestres.includes(q) ? 'Achats, variation de stock, charges et trésorerie saisis' : 'Achats, variation de stock, charges et trésorerie, à la fin du quadrimestre', fait: quadrimestres.includes(q) }] : []),
  ]
}

export function ClotureMois({ magasin, annee, reelMois, fraisRenseignes, quadrimestres, aller, peutSaisir = false }: {
  magasin: string; annee: number; reelMois: number[]; fraisRenseignes: boolean; quadrimestres: number[]; aller: (cle: string) => void; peutSaisir?: boolean
}) {
  const dernier = Math.max(1, dernierMoisClos(annee))
  const [mois, setMois] = useState(dernier)
  const [valeurs, setValeurs] = useState<{ n: (StockSaisi | null)[]; decembre: StockSaisi | null } | null>(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let actif = true
    Promise.all([chargerStocks(magasin, annee), chargerStocks(magasin, annee - 1).catch(() => null)])
      .then(([n, n1]) => actif && setValeurs({ n, decembre: n1?.[11] ?? null }))
      .catch(() => actif && setValeurs({ n: Array(12).fill(null), decembre: null }))
    return () => { actif = false }
  }, [magasin, annee, version])
  const stocks = valeurs?.n.map(Boolean) ?? null
  const etapes = etapesCloture({ mois, annee, reelMois, stockSaisi: !!stocks?.[mois - 1], fraisRenseignes, quadrimestres })
  const faits = etapes.filter((e) => e.fait).length
  const complet = faits === etapes.length
  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
    <Box component="section" aria-label="Clôture du mois" sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <IconButton aria-label="Mois précédent" disabled={mois <= 1} onClick={() => setMois(mois - 1)} sx={{ width: 48, height: 48 }}><ChevronLeftOutlined /></IconButton>
        <Typography variant="h2" sx={{ minWidth: 190, textAlign: 'center' }}>{majuscule(MOIS[mois - 1])} {annee}</Typography>
        <IconButton aria-label="Mois suivant" disabled={mois >= dernier} onClick={() => setMois(mois + 1)} sx={{ width: 48, height: 48 }}><ChevronRightOutlined /></IconButton>
        <Typography variant="body2" sx={{ ml: { sm: 'auto' }, fontWeight: 700, color: complet ? 'success.main' : 'warning.main' }}>
          {complet ? 'Mois complet' : `${faits} sur ${etapes.length} fait${faits > 1 ? 's' : ''}`}
        </Typography>
      </Box>
      {/* Choix 120 : le stock se saisit ici même, prérempli du mois précédent */}
      {peutSaisir && valeurs && !valeurs.n[mois - 1] && (
        <StockRapide key={`${annee}-${mois}`} magasin={magasin} annee={annee} mois={mois} precedent={mois > 1 ? valeurs.n[mois - 2] : valeurs.decembre}
          enregistre={() => setVersion((v) => v + 1)} />
      )}
      <Card component="ul" aria-label="Saisies du mois" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {etapes.map((e, i) => (
          <Box component="li" key={e.cle} sx={{ borderTop: i ? 1 : 0, borderColor: 'divider' }}>
            <ButtonBase onClick={() => aller(e.cle)} aria-label={e.libelle}
              sx={{ width: '100%', minHeight: 64, px: 2, py: 1.25, gap: 1.75, justifyContent: 'flex-start', textAlign: 'left', fontFamily: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}>
              {e.fait ? <CheckCircle sx={{ color: 'success.main' }} /> : <RadioButtonUncheckedOutlined sx={{ color: 'text.secondary' }} />}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }}>{e.libelle}</Typography>
                <Typography variant="body2" color="text.secondary">{e.detail}</Typography>
              </Box>
              <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: e.fait ? 'text.secondary' : 'text.primary', whiteSpace: 'nowrap' }}>{e.fait ? 'Voir' : 'Saisir'}</Typography>
              <ChevronRightOutlined sx={{ color: 'text.secondary' }} />
            </ButtonBase>
          </Box>
        ))}
      </Card>
    </Box>
      <CausesEcartsMois key={`${annee}-${mois}`} magasin={magasin} annee={annee} mois={mois} peutSaisir={peutSaisir} />
    </Box>
  )
}

// Clôture en deux minutes sur téléphone (choix 120, Joseph 13/11/2026) : Cave, Bar et Extérieur repris du mois précédent,
// en gris tant qu'ils ne sont pas confirmés (on corrige un chiffre, ou on confirme tout d'un geste), pour ne pas valider
// sans compter. Un champ vide au mois précédent reste vide.
const UNIVERS = [['cave', 'Cave'], ['bar', 'Bar'], ['exterieur', 'Extérieur']] as const
function StockRapide({ magasin, annee, mois, precedent, enregistre }: { magasin: string; annee: number; mois: number; precedent: StockSaisi | null; enregistre: () => void }) {
  const depart = (u: typeof UNIVERS[number][0]) => (precedent?.[u] != null ? enChiffres(precedent[u]!) : '')
  const [champs, setChamps] = useState({ cave: depart('cave'), bar: depart('bar'), exterieur: depart('exterieur') })
  const [touches, setTouches] = useState<Set<string>>(new Set())
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const nomPrecedent = mois > 1 ? MOIS[mois - 2] : `décembre ${annee - 1}`
  const valider = async () => {
    const lire = (t: string) => (t.trim() === '' ? null : nombre(t))
    const s: StockSaisi = { cave: lire(champs.cave), bar: lire(champs.bar), exterieur: lire(champs.exterieur) }
    if (UNIVERS.some(([k]) => (champs[k].trim() && s[k] === null) || (s[k] ?? 0) < 0)) { setErreur('Saisis des montants en euros, sans signe moins (par exemple 85 000).'); return }
    if (UNIVERS.every(([k]) => s[k] === null)) { setErreur('Saisis au moins le stock d’un univers.'); return }
    setOccupe(true)
    try {
      await enregistrerStock(magasin, annee, mois, s)
      enregistre()
    } catch {
      setErreur('L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.')
      setOccupe(false)
    }
  }
  return (
    <Card component="section" aria-label={`Stock de fin ${MOIS[mois - 1]}`} sx={{ p: { xs: 2, md: 2.5 }, display: 'grid', gap: 1.5 }}>
      <Box>
        <Typography variant="h3" component="h3">Stock de fin {MOIS[mois - 1]}</Typography>
        {precedent && <Typography variant="body2" color="text.secondary">Repris de fin {nomPrecedent}, en gris tant que non confirmé.</Typography>}
      </Box>
      {erreur && <Alert severity="error">{erreur}</Alert>}
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
        {UNIVERS.map(([k, l]) => {
          const gris = !touches.has(k) && champs[k] !== ''
          return (
            <TextField key={k} label={`Stock ${l}`} value={champs[k]} inputMode="decimal"
              onChange={(e) => { setChamps((c) => ({ ...c, [k]: e.target.value })); setTouches((t) => new Set(t).add(k)) }}
              slotProps={{ htmlInput: { inputMode: 'decimal', 'data-prerempli': gris ? 'oui' : undefined }, input: { endAdornment: <Typography color="text.secondary">€</Typography> } }}
              sx={{ '& input': { height: 48, boxSizing: 'border-box', py: 0, fontSize: '1.125rem', color: gris ? 'text.secondary' : 'text.primary', fontStyle: gris ? 'italic' : 'normal' } }} />
          )
        })}
      </Box>
      <Box>
        <Button variant="contained" onClick={() => void valider()} disabled={occupe} sx={{ minHeight: 48, width: { xs: '100%', sm: 'auto' } }}>
          {precedent && touches.size === 0 ? 'Confirmer ces stocks' : 'Enregistrer le stock'}
        </Button>
      </Box>
    </Card>
  )
}
