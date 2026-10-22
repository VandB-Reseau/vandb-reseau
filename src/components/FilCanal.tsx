// Canaux « Réseau V and B » et « Bonnes pratiques » présentés comme un groupe (Joseph, 22/10/2026) :
// les publications défilent comme des messages, de la plus ancienne à la plus récente, la dernière en bas ;
// seuls ceux qui publient ont le bouton en pied, tout le monde aime et commente. Peu de publications : collées en bas, comme un fil de messages.
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { jourDuFil } from '../data/messagerie'

export interface PublicationCanal { cle: string; instant: string; contenu: ReactNode }
const MAXI = 30

export function FilCanal({ libelle, publications, vide, pied }: { libelle: string; publications: PublicationCanal[]; vide: ReactNode; pied?: ReactNode }) {
  const zone = useRef<HTMLDivElement | null>(null)
  const [tous, setTous] = useState(false)
  const triees = [...publications].sort((a, b) => a.instant.localeCompare(b.instant))
  const affichees = tous ? triees : triees.slice(-MAXI)
  // Aller à la dernière publication à l'ouverture et à chaque nouvelle
  const nombre = triees.length
  useEffect(() => {
    const id = requestAnimationFrame(() => { if (zone.current) zone.current.scrollTop = zone.current.scrollHeight })
    return () => cancelAnimationFrame(id)
  }, [nombre])
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box ref={zone} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2, pb: 1, display: 'flex', flexDirection: 'column' }}>
        {triees.length > MAXI && !tous && <Box sx={{ textAlign: 'center', pt: 1 }}><Button onClick={() => setTous(true)} sx={{ minHeight: 48 }}>Voir les {triees.length} publications</Button></Box>}
        {!triees.length ? vide : (
          <Box component="ul" aria-label={`Publications de ${libelle}`} sx={{ listStyle: 'none', m: 0, p: 0, width: '100%', maxWidth: 640, mx: 'auto', mt: 'auto' }}>
            {affichees.map((p, i) => {
              const nouveauJour = i === 0 || jourDuFil(affichees[i - 1].instant) !== jourDuFil(p.instant)
              return (
                <Fragment key={p.cle}>
                  {nouveauJour && <Box component="li" aria-hidden sx={{ textAlign: 'center', mt: 2, mb: 1 }}><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{jourDuFil(p.instant)}</Typography></Box>}
                  <Box component="li" sx={{ mb: 1.5, '& > .MuiCard-root': { border: '1px solid', borderColor: 'divider', borderRadius: 4 } }}>{p.contenu}</Box>
                </Fragment>
              )
            })}
          </Box>
        )}
      </Box>
      {pied && <Box data-composeur sx={{ px: 2, pt: 1, pb: 1, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'center' }}>{pied}</Box>}
    </Box>
  )
}
