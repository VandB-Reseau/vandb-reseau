// Parcours d'intégration d'un magasin qui vient d'ouvrir (refonte vague 5, Joseph 10/11/2026, 50A) : les étapes réglées
// par le Directeur dans Paramètres, datées depuis l'ouverture ; l'équipe coche celles qui sont faites (Annuler possible).
import { useState } from 'react'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Typography from '@mui/material/Typography'
import { Section } from './Section'
import { Pastille, type Ton } from './Social'
import { useMessageAnnulable } from './Annulable'
import { libellesEtat, libellesResponsable, parcoursDu, type EtatEtape } from '../data/integration'
import { enregistrerEtapeIntegration } from '../data/chargement'
import { useReseau } from '../data/ReseauContext'
import { useAuth } from '../auth/AuthContext'
import { useApercu } from '../auth/Apercu'
import { dateCourte } from '../lib/format'
import type { Magasin, Reseau } from '../data/modele'

const tonEtat: Record<EtatEtape, Ton> = { faite: 'vert', retard: 'rouge', bientot: 'bleu', avenir: 'gris' }

export function ParcoursIntegration({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const { recharger } = useReseau()
  const { profil } = useAuth()
  const { apercu } = useApercu()
  const { signaler, bandeau } = useMessageAnnulable()
  const [envoi, setEnvoi] = useState('')
  const pc = parcoursDu(reseau, m)
  if (!pc) return null
  const modifiable = !apercu && profil?.role !== 'franchise'
  const basculer = async (id: string, faite: boolean) => {
    setEnvoi(id)
    try {
      await enregistrerEtapeIntegration(m.nom, id, faite ? { faite: reseau.jour, par: profil?.nom ?? '' } : null)
      await recharger()
      if (faite) signaler('Étape faite.', () => void basculer(id, false))
    } catch { signaler('L’étape n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.') }
    setEnvoi('')
  }
  return (
    <Section titre={`Intégration · jour ${pc.jourParcours} · ${pc.faites} sur ${pc.etapes.length}`}>
      <Box component="ul" aria-label="Étapes de l’intégration" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {pc.etapes.map((x) => (
          <Box component="li" key={x.e.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 48, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
            {modifiable && <Checkbox checked={x.etat === 'faite'} disabled={envoi === x.e.id} onChange={(e) => void basculer(x.e.id, e.target.checked)}
              slotProps={{ input: { 'aria-label': `${x.e.libelle} faite` } }} sx={{ width: 48, height: 48 }} />}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{x.e.libelle}</Typography>
              <Typography variant="body2" color="text.secondary">
                {[`Jour ${x.e.jour} · ${dateCourte(x.echeance)}`, libellesResponsable[x.e.responsable], x.faite && `faite le ${dateCourte(x.faite.faite)}${x.faite.par ? ` par ${x.faite.par}` : ''}`].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
            <Pastille ton={tonEtat[x.etat]}>{libellesEtat[x.etat]}</Pastille>
          </Box>
        ))}
      </Box>
      {bandeau}
    </Section>
  )
}
