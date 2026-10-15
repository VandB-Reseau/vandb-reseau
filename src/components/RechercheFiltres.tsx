import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import { BoutonOutil, useTelephone } from './Outils'

// Barre d'outils d'une page : recherche, filtres, puis les actions à droite.
// Sur téléphone, tout tient sur une ligne ; les filtres se déplient sous la ligne au besoin.
export function RechercheFiltres({ recherche, actifs = 0, children, actions }: { recherche: ReactNode; actifs?: number; children?: ReactNode; actions?: ReactNode }) {
  const telephone = useTelephone()
  const [deplies, setDeplies] = useState(false)
  if (!telephone) {
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
        {recherche}{children}
        {actions && <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 'auto' }}>{actions}</Box>}
      </Box>
    )
  }
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>{recherche}</Box>
        {children && <BoutonOutil libelle="Filtres" icone={<TuneOutlined />} onClick={() => setDeplies((v) => !v)} actif={deplies} badge={actifs} attributs={{ 'aria-expanded': deplies }} />}
        {actions}
      </Box>
      {deplies && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.5, '& > .MuiTextField-root': { flex: '1 1 100%' } }}>{children}</Box>}
    </Box>
  )
}
