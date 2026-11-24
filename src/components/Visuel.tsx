// Gestes visuels communs aux écrans à graphes (Joseph, 24/11/2026, choix 393 à 405), repris de l'onglet Pilotage (#258) :
// fond de cellule selon l'écart, interrupteur « Couleurs », phrase de lecture, mode présentation plein écran.
import { useEffect, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import ToggleButton from '@mui/material/ToggleButton'
import Typography from '@mui/material/Typography'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import PaletteOutlined from '@mui/icons-material/PaletteOutlined'
import SlideshowOutlined from '@mui/icons-material/SlideshowOutlined'
import { BoutonOutil } from './Outils'

const VERT = '48, 118, 114', BRIQUE = '194, 65, 25'
// Fond d'une cellule : vert si favorable, brique sinon ; plus foncé avec la force (0 à 1)
export const teinte = (favorable: boolean, force: number) => `rgba(${favorable ? VERT : BRIQUE}, ${(0.06 + Math.min(1, Math.max(0, force)) * 0.22).toFixed(3)})`

export function mediane(l: number[]): number | null {
  if (!l.length) return null
  const t = [...l].sort((a, b) => a - b), k = Math.floor(t.length / 2)
  return t.length % 2 ? t[k] : (t[k - 1] + t[k]) / 2
}

// Fond selon la place face à la médiane de la colonne (3 valeurs au moins) ; inverse : plus bas = mieux
export function fondsMediane(valeurs: (number | null)[], inverse = false): (string | undefined)[] {
  const nums = valeurs.filter((v): v is number => v !== null)
  if (nums.length < 3) return valeurs.map(() => undefined)
  const med = mediane(nums)!, haut = Math.max(...nums), bas = Math.min(...nums)
  return valeurs.map((v) => {
    if (v === null || v === med) return undefined
    const force = v > med ? (v - med) / (haut - med || 1) : (med - v) / (med - bas || 1)
    return teinte((v > med) !== inverse, force)
  })
}
// Fond selon un écart signé ; plein : écart qui donne la couleur la plus franche
export const fondEcart = (e: number | null, plein: number, inverse = false) => (e === null || e === 0 ? undefined : teinte((e > 0) !== inverse, Math.abs(e) / plein))

export function BoutonCouleurs({ actif, basculer }: { actif: boolean; basculer: () => void }) {
  return (
    <ToggleButton value="couleurs" size="small" selected={actif} onChange={basculer} aria-label="Couleurs du tableau"
      sx={{ minHeight: { xs: 48, md: 40 }, px: 1.5, gap: 0.75, textTransform: 'none', fontWeight: 600 }}><PaletteOutlined fontSize="small" />Couleurs</ToggleButton>
  )
}

export const BoutonPresenter = ({ onClick, quoi = 'Présenter' }: { onClick: () => void; quoi?: string }) => <BoutonOutil libelle={quoi} icone={<SlideshowOutlined />} onClick={onClick} />

export function Lecture({ texte }: { texte: string | null }) {
  if (!texte) return null
  return <Typography data-lecture sx={{ fontWeight: 600, maxWidth: 900, mb: 1.5 }}>{texte}</Typography>
}

// Plein écran pour un comité : titre, période et phrase de lecture en grand, puis le contenu de l'écran
export function Presentation({ titre, periode, lecture, fermer, children }: { titre: string; periode: string; lecture: string | null; fermer: () => void; children: ReactNode }) {
  useEffect(() => {
    // Plein écran du navigateur quand il l'accepte ; sinon la fenêtre occupe déjà toute la page
    const el = document.documentElement
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => undefined)
    return () => { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => undefined) }
  }, [])
  return (
    <Dialog open fullScreen onClose={fermer} aria-labelledby="titre-presentation" slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}>
      <Box sx={{ maxWidth: 1400, width: '100%', mx: 'auto', px: { xs: 2, md: 5 }, py: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography id="titre-presentation" component="h2" sx={{ fontSize: { xs: '1.5rem', md: '2.25rem' }, fontWeight: 700, lineHeight: 1.2 }}>{titre}</Typography>
            <Typography color="text.secondary" sx={{ fontSize: { xs: '1rem', md: '1.25rem' }, mt: 0.5 }}>{periode}</Typography>
            {lecture && <Typography sx={{ fontSize: { xs: '1.0625rem', md: '1.375rem' }, fontWeight: 600, mt: 1.5, maxWidth: 1100 }}>{lecture}</Typography>}
          </Box>
          <IconButton aria-label="Quitter la présentation" onClick={fermer} sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
        </Box>
        {children}
      </Box>
    </Dialog>
  )
}
