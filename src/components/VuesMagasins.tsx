import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import TextField from '@mui/material/TextField'
import BookmarkAddOutlined from '@mui/icons-material/BookmarkAddOutlined'
import BookmarkRemoveOutlined from '@mui/icons-material/BookmarkRemoveOutlined'
import { Fenetre } from './EditionEquipe'
import { adresseDeVue, enregistrerVue, retirerVue, useVues, PARAMETRES_VUE } from '../lib/vues'

// Vues au-dessus de la liste : d'abord les vues toutes prêtes (refonte, Joseph 09/11/2026, 5A : Tous, À surveiller…, avec
// leur nombre), puis les vues enregistrées ; la vue affichée s'enregistre ou se retire d'un geste
export interface VuePrete { nom: string; adresse: string; nombre: number }
export function VuesMagasins({ params, appliquer, nomPropose, pretes = [] }: { params: URLSearchParams; appliquer: (p: URLSearchParams) => void; nomPropose: string; pretes?: VuePrete[] }) {
  const vues = useVues()
  const courante = adresseDeVue(params)
  const active = vues.find((v) => v.adresse === courante)
  const prete = pretes.find((v) => v.adresse === courante)
  const [nommer, setNommer] = useState(false)
  const [nom, setNom] = useState('')
  if (!vues.length && !courante && !pretes.length) return null
  const ouvrir = (adresse: string) => {
    const p = new URLSearchParams(params)
    PARAMETRES_VUE.forEach((k) => p.delete(k))
    new URLSearchParams(adresse).forEach((v, k) => p.set(k, v))
    appliquer(p)
  }
  return (
    <Box role="group" aria-label="Vues enregistrées" sx={{ display: 'flex', alignItems: 'center', gap: 1, overflowX: 'auto', mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, mb: 1, scrollbarWidth: 'none' }}>
      {pretes.map((v) => {
        const actif = v === prete
        return (
          <ButtonBase key={`p-${v.nom}`} onClick={() => ouvrir(v.adresse)} aria-pressed={actif} aria-label={`${v.nom} : ${v.nombre}`}
            sx={{ flexShrink: 0, minHeight: 48, px: 0.25, fontFamily: 'inherit', '& > span': { px: 1.5, height: 36, display: 'flex', alignItems: 'center', gap: 0.75, borderRadius: 2, fontSize: '0.875rem', fontWeight: actif ? 700 : 600, bgcolor: actif ? 'action.selected' : 'transparent', color: actif ? 'text.primary' : 'text.secondary', whiteSpace: 'nowrap' }, '&:hover > span': { color: 'text.primary' } }}>
            <span>{v.nom}<Box component="span" sx={{ fontWeight: 500, color: 'text.secondary' }}>{v.nombre}</Box></span>
          </ButtonBase>
        )
      })}
      {pretes.length > 0 && vues.length > 0 && <Box aria-hidden sx={{ width: '1px', alignSelf: 'stretch', my: 1.5, bgcolor: 'divider', flexShrink: 0 }} />}
      {vues.map((v) => {
        const actif = v === active
        return (
          <ButtonBase key={v.adresse} onClick={() => ouvrir(actif ? '' : v.adresse)} aria-pressed={actif}
            sx={{ flexShrink: 0, minHeight: 48, px: 0.25, fontFamily: 'inherit', '& > span': { px: 1.5, height: 36, display: 'flex', alignItems: 'center', borderRadius: 2, fontSize: '0.875rem', fontWeight: actif ? 700 : 600, bgcolor: actif ? 'action.selected' : 'transparent', color: actif ? 'text.primary' : 'text.secondary', whiteSpace: 'nowrap' }, '&:hover > span': { color: 'text.primary' } }}>
            <span>{v.nom}</span>
          </ButtonBase>
        )
      })}
      {prete ? null : active
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
