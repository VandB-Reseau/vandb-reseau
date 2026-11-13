// À la une (refonte vague 5, 46A, Joseph 10/11/2026) : en tête des deux accueils, les communications épinglées.
// Celles qui demandent « J'ai pris connaissance » portent le bouton chez le franchisé (rappel au bout de 3 jours)
// et, pour l'équipe, le nombre de franchisés de ses magasins qui l'ont donnée.
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import PushPinOutlined from '@mui/icons-material/PushPinOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import { Pastille } from './Social'
import { prendreConnaissance, type Communication, type Connaissance } from '../data/communications'
import { brand } from '../theme/theme'

export const RAPPEL_CONNAISSANCE = 3 // jours avant le rappel chez le franchisé
export const RELANCE_CONNAISSANCE = 7 // jours avant que l'équipe la retrouve dans « À traiter »

const joursDepuis = (instant: string, jour: string) => Math.floor((Date.parse(`${jour}T12:00:00Z`) - Date.parse(`${instant.slice(0, 10)}T12:00:00Z`)) / 86_400_000)

// Communications à la une aujourd'hui (la date de fin est comprise)
export const aLaUneDuJour = (liste: Communication[], jour: string) => liste.filter((c) => c.aLaUne && c.aLaUne >= jour)

export function ALaUne({ liste, jour, connaissances, franchise, lectureSeule, apres, lien }: {
  liste: Communication[]; jour: string; connaissances: Map<number, Connaissance> | null; franchise: boolean; lectureSeule: boolean
  apres: () => void; lien: (c: Communication) => string
}) {
  const [message, setMessage] = useState('')
  const unes = aLaUneDuJour(liste, jour)
  if (!unes.length) return null
  const prendre = (id: number) => prendreConnaissance(id).then(() => { setMessage('C’est noté, merci.'); apres() }, () => setMessage('La confirmation n’a pas pu partir. Réessayez dans un instant.'))
  return (
    <Box component="section" aria-label="À la une" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
      {unes.map((c) => {
        const k = connaissances?.get(c.id)
        const rappel = franchise && k && !k.moi && joursDepuis(c.creeLe, jour) >= RAPPEL_CONNAISSANCE
        const total = k ? k.pris.length + k.manquants.length : 0
        return (
          <Card key={c.id} component="article" aria-label={`À la une : ${c.titre}`} sx={{ border: 0, borderLeft: `4px solid ${brand.or}`, p: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, alignItems: { sm: 'center' } }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.dark', fontWeight: 700, fontSize: '0.8125rem' }}>
                <PushPinOutlined sx={{ fontSize: 18 }} />À la une
                {rappel && <Pastille ton="orange">À relancer</Pastille>}
              </Box>
              <Typography component="h2" sx={{ fontWeight: 700, fontSize: '1rem', mt: 0.5 }}>{c.titre}</Typography>
              {c.texte && <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.texte}</Typography>}
              {k && !franchise && total > 0 && (
                <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>Pris connaissance : {k.pris.length} sur {total}</Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flex: 'none', flexWrap: 'wrap' }}>
              <Button component={RouterLink} to={lien(c)} sx={{ minHeight: 48 }}>Lire</Button>
              {k && franchise && (k.moi
                ? <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 48, color: 'success.dark', fontWeight: 600 }}><TaskAltOutlined fontSize="small" />Pris connaissance</Typography>
                : <Button variant="contained" startIcon={<TaskAltOutlined />} disabled={lectureSeule} onClick={() => prendre(c.id)} sx={{ minHeight: 48 }}>J’ai pris connaissance</Button>)}
            </Box>
          </Card>
        )
      })}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </Box>
  )
}

// Pour l'équipe : prises de connaissance demandées depuis 7 jours et plus, avec des franchisés de ses magasins qui manquent
export function connaissancesEnAttente(liste: Communication[], connaissances: Map<number, Connaissance> | null, jour: string) {
  if (!connaissances) return []
  return liste.filter((c) => c.id > 0 && joursDepuis(c.creeLe, jour) >= RELANCE_CONNAISSANCE && joursDepuis(c.creeLe, jour) <= 60)
    .map((c) => ({ c, k: connaissances.get(c.id) })).filter((x): x is { c: Communication; k: Connaissance } => !!x.k && x.k.manquants.length > 0)
}
