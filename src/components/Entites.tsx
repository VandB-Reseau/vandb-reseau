// Composants d'entité (refonte vague 4, Joseph 10/11/2026, 41A) : un magasin s'écrit partout pareil (blason + nom
// cliquable, aperçu au survol sur PC), une personne aussi (initiales + nom qui mène à sa fiche).
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Blason } from './Blason'
import { Initiales } from './Social'
import { analyser, libelleAlerte } from '../data/chiffres'
import { coachA, libelleSuivi } from '../data/charge'
import { lienCoach, lienFiche, lienRR } from '../lib/format'
import type { Reseau } from '../data/modele'

export function NomMagasin({ reseau, nom, avecBlason = true }: { reseau: Reseau; nom: string; avecBlason?: boolean }) {
  const m = reseau.magasins.find((x) => x.nom === nom)
  const a = m ? analyser(reseau, m.nom) : null
  const apercu = m ? (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{m.nom}</Typography>
      <Typography variant="body2">{[m.ville, libelleSuivi(m, coachA(m, reseau.jour)) || 'Sans Coach'].filter(Boolean).join(' · ')}</Typography>
      {a?.statut && <Typography variant="body2">Chiffres : {libelleAlerte[a.statut]}</Typography>}
    </Box>
  ) : ''
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      {avecBlason && <Blason magasin={m} nom={nom} taille={28} />}
      <Tooltip title={apercu} enterDelay={400} disableTouchListener>
        <Link component={RouterLink} to={lienFiche(nom)} onClick={(e) => e.stopPropagation()} sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</Link>
      </Tooltip>
    </Box>
  )
}

export function Personne({ reseau, nom }: { reseau: Reseau; nom: string }) {
  const rr = reseau.rrs.find((r) => r.nom === nom)
  const coach = reseau.equipe.find((c) => c.nom === nom)
  const lien = rr ? lienRR(rr.id) : coach ? lienCoach(nom) : nom === reseau.directeur.nom ? '/equipe/directeur' : null
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Initiales nom={nom} taille={28} />
      {lien ? <Link component={RouterLink} to={lien} onClick={(e) => e.stopPropagation()} sx={{ fontWeight: 500 }}>{nom}</Link> : <Typography component="span">{nom}</Typography>}
    </Box>
  )
}
