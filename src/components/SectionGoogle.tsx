import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import OpenInNew from '@mui/icons-material/OpenInNew'
import StarRounded from '@mui/icons-material/StarRounded'
import { Ligne, Section } from '../pages/FicheMagasin'
import { googleActif, infosGoogle, type InfosGoogle } from '../lib/google'
import type { Magasin } from '../data/modele'

type Etat = { m: Magasin; infos: InfosGoogle | null } | { m: Magasin; erreur: true }

// Note et horaires lus en direct sur Google ; rien n'est affiché sans clé Google
export function SectionGoogle({ m, lienRecherche }: { m: Magasin; lienRecherche: string | null }) {
  const [etat, setEtat] = useState<Etat | null>(null)
  useEffect(() => {
    if (!googleActif) return
    let actif = true
    infosGoogle(m).then((infos) => { if (actif) setEtat({ m, infos }) }, () => { if (actif) setEtat({ m, erreur: true }) })
    return () => { actif = false }
  }, [m])
  if (!googleActif) return null
  const pret = etat && etat.m === m ? etat : null
  const infos = pret && 'infos' in pret ? pret.infos : null
  const lien = infos?.lien || lienRecherche
  return (
    <Section titre="Google" action={lien ? <Button href={lien} target="_blank" rel="noopener" startIcon={<OpenInNew />} sx={{ minHeight: 48 }}>Google Maps</Button> : undefined}>
      {!pret ? (
        <Box aria-label="Chargement des informations Google">
          <Skeleton variant="rounded" height={40} sx={{ mb: 1 }} />
          <Skeleton variant="rounded" height={160} />
        </Box>
      ) : 'erreur' in pret ? (
        <Typography variant="body2" color="text.secondary">Google ne répond pas pour le moment. Les informations reviendront à la prochaine ouverture de la fiche.</Typography>
      ) : !infos ? (
        <Typography variant="body2" color="text.secondary">
          Aucune fiche Google trouvée pour ce magasin.{lienRecherche && <> <Link href={lienRecherche} target="_blank" rel="noopener">Chercher sur Google Maps</Link></>}
        </Typography>
      ) : (
        <>
          <Ligne libelle="Note">
            {infos.note !== null && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                <StarRounded sx={{ color: '#eaa400' }} aria-hidden />
                <Typography component="span" sx={{ fontWeight: 600 }}>{infos.note.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</Typography>
                <Typography component="span" variant="body2" color="text.secondary">sur 5 · {infos.avis.toLocaleString('fr-FR')} avis</Typography>
              </Box>
            )}
          </Ligne>
          <Ligne libelle="Horaires">
            {(infos.horaires.length > 0 || infos.fermeture || infos.ouvert !== null) && (
              <Box>
                {infos.fermeture
                  ? <Chip size="small" color="error" label={infos.fermeture === 'temporaire' ? 'Fermé temporairement' : 'Fermé définitivement'} sx={{ fontSize: 12, mb: 1 }} />
                  : infos.ouvert !== null && <Chip size="small" color={infos.ouvert ? 'success' : 'default'} variant="outlined" label={infos.ouvert ? 'Ouvert en ce moment' : 'Fermé en ce moment'} sx={{ fontSize: 12, mb: 1 }} />}
                <Box component="ul" aria-label="Horaires d’ouverture" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {infos.horaires.map((h, i) => {
                    const [jour, ...reste] = h.split(': ')
                    const aujourdhui = i === (new Date().getDay() + 6) % 7
                    return (
                      <Box component="li" key={h} sx={{ display: 'flex', gap: 2, py: 0.25, fontWeight: aujourdhui ? 600 : 400 }}>
                        <Box component="span" sx={{ width: 90, flexShrink: 0, '&::first-letter': { textTransform: 'uppercase' } }}>{jour}</Box>
                        <span>{reste.join(': ')}</span>
                      </Box>
                    )
                  })}
                </Box>
              </Box>
            )}
          </Ligne>
        </>
      )}
    </Section>
  )
}
