import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import TextField from '@mui/material/TextField'
import BookmarkAddOutlined from '@mui/icons-material/BookmarkAddOutlined'
import BookmarkRemoveOutlined from '@mui/icons-material/BookmarkRemoveOutlined'
import { Fenetre } from './EditionEquipe'
import { adresseDeVue, enregistrerVue, retirerVue, useVues, PARAMETRES_VUE } from '../lib/vues'

// Vues enregistrées en puces au-dessus de la liste ; la vue affichée s'enregistre ou se retire d'un geste
export function VuesMagasins({ params, appliquer, nomPropose }: { params: URLSearchParams; appliquer: (p: URLSearchParams) => void; nomPropose: string }) {
  const vues = useVues()
  const courante = adresseDeVue(params)
  const active = vues.find((v) => v.adresse === courante)
  const [nommer, setNommer] = useState(false)
  const [nom, setNom] = useState('')
  if (!vues.length && !courante) return null
  const ouvrir = (adresse: string) => {
    const p = new URLSearchParams(params)
    PARAMETRES_VUE.forEach((k) => p.delete(k))
    new URLSearchParams(adresse).forEach((v, k) => p.set(k, v))
    appliquer(p)
  }
  return (
    <Box role="group" aria-label="Vues enregistrées" sx={{ display: 'flex', alignItems: 'center', gap: 1, overflowX: 'auto', mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, mb: 1, scrollbarWidth: 'none' }}>
      {vues.map((v) => {
        const actif = v === active
        return (
          <ButtonBase key={v.adresse} onClick={() => ouvrir(actif ? '' : v.adresse)} aria-pressed={actif}
            sx={{ flexShrink: 0, minHeight: 48, px: 0.25, fontFamily: 'inherit', '& > span': { px: 1.75, height: 40, display: 'flex', alignItems: 'center', borderRadius: 999, border: '1px solid', fontSize: '0.875rem', fontWeight: actif ? 600 : 500, borderColor: actif ? 'primary.main' : 'divider', bgcolor: actif ? 'primary.main' : 'background.paper', color: actif ? 'primary.contrastText' : 'text.primary', whiteSpace: 'nowrap' } }}>
            <span>{v.nom}</span>
          </ButtonBase>
        )
      })}
      {active
        ? <Button startIcon={<BookmarkRemoveOutlined />} onClick={() => retirerVue(active.adresse)} sx={{ flexShrink: 0, minHeight: 48, whiteSpace: 'nowrap' }}>Retirer cette vue</Button>
        : courante && <Button startIcon={<BookmarkAddOutlined />} onClick={() => { setNom(nomPropose); setNommer(true) }} sx={{ flexShrink: 0, minHeight: 48, whiteSpace: 'nowrap' }}>Enregistrer la vue</Button>}
      {nommer && (
        <Fenetre titre="Enregistrer la vue" ouvert sansRechargement onFermer={() => setNommer(false)} valide={!!nom.trim()}
          enregistrer={async () => { enregistrerVue(nom.trim(), courante); return '' }}>
          <TextField label="Nom de la vue" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus slotProps={{ htmlInput: { maxLength: 40 } }} />
        </Fenetre>
      )}
    </Box>
  )
}
