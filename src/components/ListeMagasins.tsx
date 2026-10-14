import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Typography from '@mui/material/Typography'
import { PastilleStatut, PastilleType } from './Pastilles'
import { lienFiche } from '../lib/format'
import type { Magasin } from '../data/modele'

const PAS = 40

// Version téléphone : cartes empilées, chargement progressif
export function ListeMagasins({ magasins }: { magasins: Magasin[] }) {
  const naviguer = useNavigate()
  const [nb, setNb] = useState(PAS)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {magasins.slice(0, nb).map((m) => (
        <Card key={m.nom}>
          <CardActionArea onClick={() => naviguer(lienFiche(m.nom))} sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h4" component="h2" noWrap>{m.nom}</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {[m.departement && `Dépt ${m.departement}`, m.coach ? `Coach ${m.coach}` : 'Sans Coach'].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              <PastilleType franchise={m.franchise} compacte />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <PastilleStatut statut={m.statut} />
              {m.rr && <Typography variant="caption" color="text.secondary">RR : {m.rr.nom}</Typography>}
            </Box>
          </CardActionArea>
        </Card>
      ))}
      {nb < magasins.length && (
        <Button variant="outlined" onClick={() => setNb(nb + PAS)} sx={{ alignSelf: 'center', minHeight: 48 }}>
          Afficher {Math.min(PAS, magasins.length - nb)} magasins de plus
        </Button>
      )}
    </Box>
  )
}
