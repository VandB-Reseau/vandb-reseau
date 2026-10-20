// Une conversation : initiales, nom, dernier message, non lus (page Messages et aperçu de l'en-tête)
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import ListItemButton from '@mui/material/ListItemButton'
import Typography from '@mui/material/Typography'
import { apercuDe, heureCourte, type Contact, type ConversationPersonne, type Messagerie } from '../data/messagerie'

const initiales = (nom: string) => nom.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase()
export const detailContact = (c: Contact) => [c.role, c.magasins.length > 3 ? `${c.magasins.length} magasins` : c.magasins.map((m) => m.nom).join(', ')].filter(Boolean).join(' · ')

export function LigneConversation({ c, mg, actif, ouvrir }: { c: ConversationPersonne; mg: Messagerie; actif: boolean; ouvrir: () => void }) {
  const d = c.dernier
  const apercu = d ? `${d.auteur === mg.moi ? 'Moi : ' : ''}${apercuDe(d)}` : detailContact(c.contact)
  const fort = c.nonLus > 0
  return (
    <ListItemButton selected={actif} onClick={ouvrir} aria-current={actif ? 'true' : undefined}
      aria-label={`${c.contact.nom}${fort ? ` : ${c.nonLus} message${c.nonLus > 1 ? 's' : ''} non lu${c.nonLus > 1 ? 's' : ''}` : ''}`}
      sx={{ borderRadius: 3, mx: 1, mb: 0.25, minHeight: 72, gap: 1.5, alignItems: 'center' }}>
      <Avatar sx={{ width: 44, height: 44, fontSize: '0.9375rem', fontWeight: 600, bgcolor: fort ? 'secondary.main' : 'action.selected', color: fort ? 'secondary.contrastText' : 'text.secondary' }}>{initiales(c.contact.nom)}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="body1" sx={{ flex: 1, minWidth: 0, fontWeight: fort ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.contact.nom}</Typography>
          {d && <Typography variant="caption" color={fort ? 'text.primary' : 'text.secondary'} sx={{ flexShrink: 0, fontWeight: fort ? 600 : 400 }}>{heureCourte(d.creeLe)}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color={fort ? 'text.primary' : 'text.secondary'} sx={{ flex: 1, minWidth: 0, fontWeight: fort ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apercu}</Typography>
          {fort && <Box aria-hidden sx={{ flexShrink: 0, minWidth: 22, height: 22, px: 0.75, borderRadius: 999, bgcolor: 'error.main', color: 'error.contrastText', fontSize: '0.75rem', fontWeight: 700, display: 'grid', placeItems: 'center' }}>{c.nonLus > 99 ? '99+' : c.nonLus}</Box>}
        </Box>
      </Box>
    </ListItemButton>
  )
}

