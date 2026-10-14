import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import InputBase from '@mui/material/InputBase'
import Typography from '@mui/material/Typography'
import SearchIcon from '@mui/icons-material/Search'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import PersonOutline from '@mui/icons-material/PersonOutlineOutlined'
import SupervisorAccountOutlined from '@mui/icons-material/SupervisorAccountOutlined'
import { useReseau } from '../data/ReseauContext'
import { normaliser } from '../data/filtres'
import { lienCoach, lienFiche } from '../lib/format'

interface Resultat { type: 'Magasins' | 'Coachs' | 'Responsables Régionaux'; libelle: string; detail: string; cible: string; cle: string }

const icones = { Magasins: <StorefrontOutlined />, Coachs: <PersonOutline />, 'Responsables Régionaux': <SupervisorAccountOutlined /> }

export function RechercheGlobale({ surFonce, onChoix }: { surFonce?: boolean; onChoix?: () => void }) {
  const { reseau } = useReseau()
  const naviguer = useNavigate()
  const options = useMemo<Resultat[]>(() => {
    if (!reseau) return []
    const nbCoach = (c: string) => reseau.magasins.filter((m) => m.coach === c).length
    return [
      ...reseau.magasins.map((m) => ({ type: 'Magasins' as const, libelle: m.nom, detail: [m.ville, m.departement && `Dépt ${m.departement}`, m.coach].filter(Boolean).join(' · '), cible: lienFiche(m.nom), cle: `m-${m.nom}` })),
      ...Object.keys(reseau.coachs).filter((c) => nbCoach(c) > 0).sort((a, b) => a.localeCompare(b, 'fr')).map((c) => ({ type: 'Coachs' as const, libelle: c, detail: `${nbCoach(c)} magasins`, cible: lienCoach(c), cle: `c-${c}` })),
      ...reseau.rrs.map((r) => ({ type: 'Responsables Régionaux' as const, libelle: r.nom, detail: `${reseau.magasins.filter((m) => m.rr?.id === r.id).length} magasins`, cible: `/magasins?rr=${encodeURIComponent(r.id)}`, cle: `r-${r.id}` })),
    ]
  }, [reseau])

  return (
    <Autocomplete
      options={options}
      groupBy={(o) => o.type}
      getOptionLabel={(o) => o.libelle}
      getOptionKey={(o) => o.cle}
      filterOptions={(opts, { inputValue }) => {
        const t = normaliser(inputValue)
        if (!t) return []
        return opts.filter((o) => normaliser(`${o.libelle} ${o.detail}`).includes(t)).slice(0, 12)
      }}
      noOptionsText="Aucun résultat"
      value={null}
      blurOnSelect
      clearOnBlur
      onChange={(_e, o) => { if (o) { naviguer(o.cible); onChoix?.() } }}
      renderOption={({ key, ...props }, o) => (
        <Box component="li" key={key} {...props} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', minHeight: 48 }}>
          <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icones[o.type]}</Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{o.libelle}</Typography>
            <Typography variant="caption" color="text.secondary">{o.detail}</Typography>
          </Box>
        </Box>
      )}
      sx={{ width: '100%', maxWidth: 560 }}
      slotProps={{ paper: { sx: { mt: 1 } } }}
      renderInput={(p) => (
        <Box ref={p.slotProps.input.ref} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, height: 44, borderRadius: 999, bgcolor: surFonce ? 'rgba(255,255,255,0.12)' : 'action.hover' }}>
          <SearchIcon sx={{ color: surFonce ? '#ffffff' : 'text.secondary' }} />
          <InputBase
            inputProps={{ ...p.slotProps.htmlInput, 'aria-label': 'Recherche globale' }}
            placeholder="Rechercher un magasin, une personne, une ville"
            sx={{ flex: 1, fontSize: '0.875rem', color: surFonce ? '#ffffff' : 'text.primary', '& input::placeholder': { color: surFonce ? 'rgba(255,255,255,0.78)' : 'text.secondary', opacity: 1 } }}
          />
        </Box>
      )}
    />
  )
}
