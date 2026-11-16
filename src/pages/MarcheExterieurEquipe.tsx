import { useMemo, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { AvecReseau } from '../components/EtatDonnees'
import { MarcheExterieur } from '../components/MarcheExterieur'
import { lienFiche } from '../lib/format'
import type { Reseau } from '../data/modele'

// Marché extérieur depuis le menu (Joseph, 16/11/2026) : comme les Simulateurs, on choisit le magasin puis on bâtit
// son plan d'action ; c'est le même plan que l'onglet de la fiche magasin
const CLE_MAGASIN = 'vandb-exterieur-magasin'
const lireDernier = () => { try { return localStorage.getItem(CLE_MAGASIN) } catch { return null } }
const ecrireDernier = (nom: string) => { try { localStorage.setItem(CLE_MAGASIN, nom) } catch { /* stockage indisponible */ } }
const bouton = { sx: { width: 48, height: 48 } }

export function PageMarcheExterieur() {
  return (
    <Box>
      <PageHeader titre="Marché extérieur" />
      <AvecReseau>{(reseau) => <Contenu reseau={reseau} />}</AvecReseau>
    </Box>
  )
}

function Contenu({ reseau }: { reseau: Reseau }) {
  const [, setParams] = useSearchParams()
  const noms = useMemo(() => reseau.magasins.filter((m) => m.statut !== 'avenir').map((m) => m.nom).sort((a, b) => a.localeCompare(b, 'fr')), [reseau])
  const [choisi, setChoisi] = useState<string | null>(() => lireDernier())
  const nom = choisi && noms.includes(choisi) ? choisi : noms[0]
  const m = reseau.magasins.find((x) => x.nom === nom)
  if (!m) return <EmptyState icone={<StorefrontOutlined />} titre="Aucun magasin dans ton périmètre" texte="Le plan marché extérieur s’ouvre sur les magasins qui te sont rattachés. Le Directeur de réseau peut les rattacher depuis ta fiche." />
  const choisir = (x: string | null) => {
    if (!x) return
    setChoisi(x); ecrireDernier(x)
    setParams((p) => { const n = new URLSearchParams(p); n.delete('etape'); return n }, { replace: true })
  }
  return (
    <Stack spacing={3}>
      <Box className="pas-a-l-impression" sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Autocomplete options={noms} value={nom} disableClearable onChange={(_, x) => choisir(x)}
          openText="Ouvrir la liste" closeText="Fermer la liste" noOptionsText="Aucun magasin de ce nom"
          slotProps={{ popupIndicator: bouton }} sx={{ minWidth: 260, flex: '1 1 260px', maxWidth: 400 }}
          renderInput={(x) => <TextField {...x} label="Magasin" sx={{ '& .MuiInputBase-root': { py: 0 }, '& input': { height: 48, boxSizing: 'border-box' } }} />} />
        <Button component={RouterLink} to={lienFiche(nom)} startIcon={<StorefrontOutlined />} sx={{ minHeight: 48 }}>Fiche du magasin</Button>
      </Box>
      <MarcheExterieur key={m.nom} reseau={reseau} m={m} />
    </Stack>
  )
}
