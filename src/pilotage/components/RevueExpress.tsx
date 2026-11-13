import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import LinearProgress from '@mui/material/LinearProgress'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import AssignmentIndOutlined from '@mui/icons-material/AssignmentIndOutlined'
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined'
import { texteAlerte } from './AlertesMagasins'
import { texteSujet } from './FicheVisite'
import { confierAuCoach } from '../data/taches'
import { lienMagasin, milliers } from '../lib/format'
import type { Alerte } from '../moteur/alertes'
import type { LigneSemaine } from '../moteur/semaine'

// Revue express du portefeuille (choix 117, Joseph 13/11/2026) : pour le point du mois du RR avec ses Coachs, un magasin
// par écran, dans l'ordre de Ma semaine, et trois décisions en un geste. « Avancer la visite » et « Tâche au Coach »
// créent une tâche du Coach du magasin (échéance à 7 et 14 jours) ; « Rien à signaler » est noté pour la revue en cours.
// La revue PDF de l'équipe reste.
type Decision = 'ras' | 'visite' | 'tache'
const libelleDecision: Record<Decision, string> = { ras: 'Rien à signaler', visite: 'Visite à avancer', tache: 'Tâche au Coach' }
const dansJours = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export function RevueExpress({ lignes, fermer }: { lignes: LigneSemaine<Alerte>[]; fermer: () => void }) {
  const [i, setI] = useState(0)
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [tache, setTache] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const fin = i >= lignes.length
  const l = lignes[Math.min(i, lignes.length - 1)]
  const sujet = l?.sujet ? texteSujet(l.sujet) : null
  const suivant = () => { setTache(null); setErreur(''); setI((x) => x + 1) }
  const decider = async (d: Decision, intitule?: string) => {
    if (!l) return
    setErreur('')
    if (d !== 'ras') {
      setEnvoi(true)
      try {
        await confierAuCoach(l.magasin, intitule ?? `Avancer la visite de ${l.magasin}${sujet ? ` : ${sujet.constat}` : ''}`, dansJours(d === 'visite' ? 7 : 14))
      } catch {
        setEnvoi(false)
        setErreur('La tâche n’a pas pu être enregistrée. Vérifie la connexion et réessaie.')
        return
      }
      setEnvoi(false)
    }
    setDecisions((x) => ({ ...x, [l.magasin]: d }))
    suivant()
  }
  const compte = (d: Decision) => Object.values(decisions).filter((x) => x === d).length
  const bouton = { minHeight: 56, fontSize: '1rem', justifyContent: 'flex-start', px: 2 }

  return (
    <Dialog open fullScreen onClose={fermer} aria-labelledby="titre-revue" slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}>
      <Box sx={{ maxWidth: 760, width: '100%', mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 2, md: 4 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h2" id="titre-revue" sx={{ flex: 1 }}>Revue express</Typography>
          <Typography color="text.secondary">{fin ? `${lignes.length} sur ${lignes.length}` : `${i + 1} sur ${lignes.length}`}</Typography>
          <Button startIcon={<CloseOutlined />} onClick={fermer} sx={{ minHeight: 48 }}>Fermer</Button>
        </Box>
        <LinearProgress variant="determinate" value={lignes.length ? (Math.min(i, lignes.length) / lignes.length) * 100 : 100} aria-label="Avancement de la revue" />

        {fin ? (
          <Box component="section" aria-label="Bilan de la revue" sx={{ bgcolor: 'background.paper', borderRadius: '16px', p: { xs: 2, md: 3 }, display: 'grid', gap: 1 }}>
            <Typography variant="h3" component="h3">Revue terminée</Typography>
            <Typography>{compte('ras')} rien à signaler · {compte('visite')} visite{compte('visite') > 1 ? 's' : ''} à avancer · {compte('tache')} tâche{compte('tache') > 1 ? 's' : ''} au Coach · {lignes.length - Object.keys(decisions).length} passé{lignes.length - Object.keys(decisions).length > 1 ? 's' : ''}</Typography>
            <Box component="ul" aria-label="Décisions" sx={{ m: 0, pl: 2.5 }}>
              {lignes.filter((x) => decisions[x.magasin]).map((x) => <li key={x.magasin}><Typography><b>{x.magasin}</b> : {libelleDecision[decisions[x.magasin]]}</Typography></li>)}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              <Button variant="contained" onClick={fermer} sx={{ minHeight: 48 }}>Terminer</Button>
              <Button startIcon={<ArrowBackOutlined />} onClick={() => setI(lignes.length - 1)} sx={{ minHeight: 48 }}>Revenir au dernier magasin</Button>
            </Box>
          </Box>
        ) : l && (
          <Box component="section" aria-label={l.magasin} sx={{ bgcolor: 'background.paper', borderRadius: '16px', p: { xs: 2, md: 3 }, display: 'grid', gap: 1.5 }}>
            <Box>
              <Typography component="h3" sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 700, lineHeight: 1.2 }}>{l.magasin}</Typography>
              {l.coach && <Typography color="text.secondary">Coach : {l.coach}</Typography>}
              {decisions[l.magasin] && <Typography sx={{ fontWeight: 700, color: 'success.dark' }}>Déjà décidé : {libelleDecision[decisions[l.magasin]]}</Typography>}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.5 }}>
              <Box><Typography color="text.secondary">Marge en jeu</Typography><Typography sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{l.enJeu > 0 ? milliers(l.enJeu) : '–'}</Typography></Box>
              <Box><Typography color="text.secondary">Alertes</Typography><Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: l.alertes.length ? 'error.main' : undefined }}>{l.alertes.length}</Typography></Box>
              <Box><Typography color="text.secondary">Tâches en retard</Typography><Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: l.actionsEnRetard ? 'error.main' : undefined }}>{l.actionsEnRetard}</Typography></Box>
            </Box>
            <Typography><b>Premier sujet :</b> {sujet ? sujet.constat : 'rien ne recule'}</Typography>
            {l.alertes.length > 0 && (
              <Box component="ul" aria-label={`Alertes de ${l.magasin}`} sx={{ m: 0, pl: 2.5 }}>
                {l.alertes.map((a) => <li key={texteAlerte(a)}><Typography>{texteAlerte(a)}</Typography></li>)}
              </Box>
            )}
            <Box><Button component={RouterLink} to={lienMagasin(l.magasin)} target="_blank" sx={{ minHeight: 48, px: 0 }}>Ouvrir la fiche du magasin</Button></Box>

            {tache !== null ? (
              <Box component="form" onSubmit={(e) => { e.preventDefault(); if (tache.trim()) void decider('tache', tache) }} sx={{ display: 'grid', gap: 1 }}>
                <TextField label="Tâche pour le Coach" value={tache} onChange={(e) => setTache(e.target.value)} autoFocus multiline minRows={2} slotProps={{ htmlInput: { maxLength: 200 } }} />
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button type="submit" variant="contained" disabled={!tache.trim() || envoi} sx={{ minHeight: 48 }}>Confier au Coach</Button>
                  <Button onClick={() => setTache(null)} sx={{ minHeight: 48 }}>Annuler</Button>
                </Box>
              </Box>
            ) : (
              <Box role="group" aria-label="Décision" sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
                <Button variant="outlined" startIcon={<CheckCircleOutlineOutlined />} onClick={() => void decider('ras')} disabled={envoi} sx={bouton}>Rien à signaler</Button>
                <Button variant="outlined" startIcon={<EventRepeatOutlined />} onClick={() => void decider('visite')} disabled={envoi} sx={bouton}>Avancer la visite</Button>
                <Button variant="outlined" startIcon={<AssignmentIndOutlined />} onClick={() => setTache(sujet ? `${sujet.constat} : ${sujet.levier}` : '')} disabled={envoi} sx={bouton}>Tâche au Coach</Button>
              </Box>
            )}
            {erreur && <Typography role="alert" color="error.main">{erreur}</Typography>}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <Button startIcon={<ArrowBackOutlined />} onClick={() => { setTache(null); setI((x) => Math.max(0, x - 1)) }} disabled={i === 0} sx={{ minHeight: 48 }}>Précédent</Button>
              <Button endIcon={<ArrowForwardOutlined />} onClick={suivant} sx={{ minHeight: 48 }}>Suivant</Button>
            </Box>
          </Box>
        )}
      </Box>
    </Dialog>
  )
}
