import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { BoutonOutil, useTelephone } from './Outils'
import { BandeCollante } from './Collant'

// Barre d'outils d'une page : recherche, filtres, puis les actions à droite.
// Sur téléphone, tout tient sur une ligne ; les filtres se déplient sous la ligne au besoin.
// La barre reste collée sous les onglets quand la page défile (Joseph, 21/10/2026).
export interface FiltreActif { cle: string; libelle: string; retirer: () => void }

// Téléphone : les filtres actifs restent visibles en puces sous la recherche, une croix pour chacun (Joseph, 21/10/2026)
export function PucesFiltresActifs({ filtres }: { filtres: FiltreActif[] }) {
  if (!filtres.length) return null
  return (
    <Box role="group" aria-label="Filtres actifs" sx={{ display: 'flex', gap: 1, overflowX: 'auto', mx: -2, px: 2, mt: 0.5, scrollbarWidth: 'none' }}>
      {filtres.map((f) => (
        <ButtonBase key={f.cle} onClick={f.retirer} aria-label={`Retirer le filtre ${f.libelle}`}
          sx={{ flexShrink: 0, minHeight: 48, px: 0.25, fontFamily: 'inherit', '& > span': { pl: 1.5, pr: 1, height: 36, display: 'flex', alignItems: 'center', gap: 0.5, borderRadius: 999, bgcolor: 'action.selected', fontSize: '0.875rem', fontWeight: 500, color: 'text.primary' } }}>
          <span>{f.libelle}<CloseOutlined sx={{ fontSize: 18 }} /></span>
        </ButtonBase>
      ))}
    </Box>
  )
}

export function RechercheFiltres({ recherche, actifs = 0, children, actions, pucesActives }: { recherche: ReactNode; actifs?: number; children?: ReactNode; actions?: ReactNode; pucesActives?: FiltreActif[] }) {
  const telephone = useTelephone()
  const [deplies, setDeplies] = useState(false)
  if (!telephone) {
    return (
      <BandeCollante sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        {recherche}{children}
        {actions && <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 'auto' }}>{actions}</Box>}
      </BandeCollante>
    )
  }
  return (
    <BandeCollante>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>{recherche}</Box>
        {children && <BoutonOutil libelle="Filtres" icone={<TuneOutlined />} onClick={() => setDeplies((v) => !v)} actif={deplies} badge={actifs} attributs={{ 'aria-expanded': deplies }} />}
        {actions}
      </Box>
      {!deplies && pucesActives && <PucesFiltresActifs filtres={pucesActives} />}
      {deplies && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.5, '& > .MuiTextField-root': { flex: '1 1 100%' } }}>{children}</Box>}
    </BandeCollante>
  )
}
