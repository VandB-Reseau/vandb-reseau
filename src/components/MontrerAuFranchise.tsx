import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import Typography from '@mui/material/Typography'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { GraphiqueCA } from './Chiffres'
import { analyser, chiffresDuMagasin, formatEuros, formatPourcent, formatValeur, libelleMois } from '../data/chiffres'
import type { Reseau } from '../data/modele'
import { phraseCADuMois } from '../pilotage/moteur/phrases'

// Montrer au franchisé (choix 116, Joseph 13/11/2026) : en visite, la fiche passe en présentation, plein écran et gros
// chiffres. Liste blanche : seuls les chiffres du magasin (ceux que le franchisé lit déjà dans son espace) et leur courbe
// sont repris. Notes, appréciation, santé, Nine box, objectifs chiffrés, tâches et médianes du réseau ne sont jamais lus ici.
export function MontrerAuFranchise({ reseau, magasin, fermer }: { reseau: Reseau; magasin: string; fermer: () => void }) {
  const a = analyser(reseau, magasin)
  const c = a?.chiffre
  const tuiles: [string, string][] = c ? ([
    ['Panier moyen HT Cave', c.pmCave === null ? null : formatValeur('pmCave', c.pmCave)],
    ['Panier moyen HT Bar', c.pmBar === null ? null : formatValeur('pmBar', c.pmBar)],
    ['Clients du mois', c.tickets === null ? null : formatValeur('tickets', c.tickets)],
    ['Marge', c.marge === null ? null : formatValeur('marge', c.marge)],
  ] as [string, string | null][]).filter((t): t is [string, string] => t[1] !== null) : []
  const liste = chiffresDuMagasin(reseau, magasin)
  const ecartCouleur = a?.ecart == null ? 'text.primary' : a.ecart < 0 ? 'error.main' : 'success.dark'
  return (
    <Dialog open fullScreen onClose={fermer} aria-labelledby="titre-montrer">
      <Box sx={{ maxWidth: 1200, width: '100%', mx: 'auto', px: { xs: 2, md: 5 }, py: { xs: 2, md: 4 }, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography component="h2" id="titre-montrer" sx={{ flex: 1, minWidth: 200, fontSize: { xs: '1.75rem', md: '2.5rem' }, fontWeight: 700, lineHeight: 1.15 }}>{magasin}</Typography>
          <Button variant="outlined" startIcon={<CloseOutlined />} onClick={fermer} sx={{ minHeight: 48 }}>Fermer</Button>
        </Box>
        {!a ? (
          <Typography sx={{ fontSize: '1.25rem' }}>Pas encore de chiffres enregistrés pour ce magasin.</Typography>
        ) : (
          <>
            <Box component="section" aria-label={`Chiffre d’affaires de ${libelleMois(a.mois)}`} sx={{ bgcolor: 'background.paper', borderRadius: '16px', p: { xs: 2, md: 4 } }}>
              <Typography color="text.secondary" sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>Chiffre d’affaires · {libelleMois(a.mois)}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: { xs: '2.75rem', md: '4.5rem' }, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{a.ca === null ? '—' : formatEuros(a.ca)}</Typography>
                {a.ecart !== null && <Typography sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 700, color: ecartCouleur }}>{formatPourcent(a.ecart)}</Typography>}
              </Box>
              <Typography sx={{ fontSize: { xs: '1.125rem', md: '1.5rem' }, mt: 1 }}>{phraseCADuMois({ mois: libelleMois(a.mois), reference: libelleMois(a.reference), ecartPct: a.ecart })}</Typography>
            </Box>
            {tuiles.length > 0 && (
              <Box component="section" aria-label="Les chiffres du mois" sx={{ display: 'grid', gap: { xs: 1.5, md: 2 }, gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${tuiles.length}, 1fr)` } }}>
                {tuiles.map(([l, v]) => (
                  <Box key={l} role="group" aria-label={l} sx={{ bgcolor: 'background.paper', borderRadius: '16px', p: { xs: 1.5, md: 3 }, minWidth: 0 }}>
                    <Typography color="text.secondary" sx={{ fontSize: { xs: '0.875rem', md: '1.125rem' } }}>{l}</Typography>
                    <Typography sx={{ fontSize: { xs: '1.75rem', md: '2.75rem' }, fontWeight: 700, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>{v}</Typography>
                  </Box>
                ))}
              </Box>
            )}
            {liste.length > 1 && (
              <Box component="section" aria-label="Évolution du chiffre d’affaires" sx={{ bgcolor: 'background.paper', borderRadius: '16px', p: { xs: 2, md: 3 } }}>
                <Typography component="h3" sx={{ fontSize: { xs: '1.125rem', md: '1.5rem' }, fontWeight: 700, mb: 1 }}>Évolution du chiffre d’affaires</Typography>
                <GraphiqueCA liste={liste} />
              </Box>
            )}
          </>
        )}
      </Box>
    </Dialog>
  )
}
