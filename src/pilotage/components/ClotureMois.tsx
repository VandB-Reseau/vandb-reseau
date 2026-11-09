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
import { chargerStocks } from '../data/pilotage'

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

export function ClotureMois({ magasin, annee, reelMois, fraisRenseignes, quadrimestres, aller }: {
  magasin: string; annee: number; reelMois: number[]; fraisRenseignes: boolean; quadrimestres: number[]; aller: (cle: string) => void
}) {
  const dernier = Math.max(1, dernierMoisClos(annee))
  const [mois, setMois] = useState(dernier)
  const [stocks, setStocks] = useState<boolean[] | null>(null)
  useEffect(() => {
    let actif = true
    chargerStocks(magasin, annee).then((s) => actif && setStocks(s.map(Boolean))).catch(() => actif && setStocks(Array(12).fill(false)))
    return () => { actif = false }
  }, [magasin, annee])
  const etapes = etapesCloture({ mois, annee, reelMois, stockSaisi: !!stocks?.[mois - 1], fraisRenseignes, quadrimestres })
  const faits = etapes.filter((e) => e.fait).length
  const complet = faits === etapes.length
  return (
    <Box component="section" aria-label="Clôture du mois" sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <IconButton aria-label="Mois précédent" disabled={mois <= 1} onClick={() => setMois(mois - 1)} sx={{ width: 48, height: 48 }}><ChevronLeftOutlined /></IconButton>
        <Typography variant="h2" sx={{ minWidth: 190, textAlign: 'center' }}>{majuscule(MOIS[mois - 1])} {annee}</Typography>
        <IconButton aria-label="Mois suivant" disabled={mois >= dernier} onClick={() => setMois(mois + 1)} sx={{ width: 48, height: 48 }}><ChevronRightOutlined /></IconButton>
        <Typography variant="body2" sx={{ ml: { sm: 'auto' }, fontWeight: 700, color: complet ? 'success.main' : 'warning.main' }}>
          {complet ? 'Mois complet' : `${faits} sur ${etapes.length} fait${faits > 1 ? 's' : ''}`}
        </Typography>
      </Box>
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
  )
}
