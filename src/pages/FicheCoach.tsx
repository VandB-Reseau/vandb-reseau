import { useState } from 'react'
import Snackbar from '@mui/material/Snackbar'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { DialogCoach } from '../components/EditionEquipe'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import ArrowBack from '@mui/icons-material/ArrowBack'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { JaugeCharge, aideCharge } from '../components/Charge'
import { TableMagasins } from '../components/TableMagasins'
import { ListeMagasins } from '../components/ListeMagasins'
import { Contact, Section } from './FicheMagasin'
import { chargeA, libelleMois, magasinsDuCoach, moisAVenir } from '../data/charge'
import { dateCourte, lienCoach } from '../lib/format'
import type { Coach, Reseau } from '../data/modele'

interface Evenement { date: string; texte: string; note?: string }

export function historiqueCoach(reseau: Reseau, coach: Coach): Evenement[] {
  const ev: Evenement[] = []
  for (const m of reseau.magasins) {
    m.historiqueCoach.forEach((h, i) => {
      const avant = i > 0 ? m.historiqueCoach[i - 1].coach : ''
      if (h.coach === coach.nom && avant !== coach.nom) ev.push({ date: h.date, texte: `Prend en charge ${m.nom}${avant ? ` (après ${avant})` : ''}`, note: h.note })
      if (avant === coach.nom && h.coach !== coach.nom) ev.push({ date: h.date, texte: `Quitte ${m.nom}${h.coach ? `, repris par ${h.coach}` : ''}`, note: h.note })
    })
  }
  coach.historiqueRR.forEach((h) => ev.push({ date: h.date, texte: `Rattaché à ${h.rr?.nom ?? 'un Responsable Régional supprimé'}` }))
  return ev.filter((e) => e.date <= reseau.jour).sort((a, b) => b.date.localeCompare(a.date))
}

function Fiche({ coach, reseau }: { coach: Coach; reseau: Reseau }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const naviguer = useNavigate()
  const [edition, setEdition] = useState(false)
  const [message, setMessage] = useState('')
  const magasins = magasinsDuCoach(reseau, coach.nom)
  const charge = chargeA(reseau, coach.nom)
  const evenements = historiqueCoach(reseau, coach)
  const projection = moisAVenir(reseau.jour, 7).slice(1).map((mois) => ({ mois, charge: chargeA(reseau, coach.nom, mois) }))
  return (
    <>
      <Button startIcon={<ArrowBack />} onClick={() => (window.history.length > 1 ? naviguer(-1) : naviguer('/equipe'))} sx={{ mb: 2, ml: -1 }}>Équipe</Button>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h1" sx={{ flex: 1 }}>{coach.nom}</Typography>
        <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setEdition(true)} sx={{ minHeight: 48 }}>Modifier</Button>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Coach · {magasins.length} magasin{magasins.length > 1 ? 's' : ''}{coach.rr ? ` · ${coach.rr.nom}` : ''}
      </Typography>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start', mb: 2 }}>
        <Section titre="Charge">
          <JaugeCharge reseau={reseau} charge={charge} libelle="Aujourd’hui" />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>{aideCharge}</Typography>
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>Les six prochains mois</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {projection.map((p) => <JaugeCharge key={p.mois} reseau={reseau} charge={p.charge} libelle={libelleMois(p.mois)} />)}
          </Box>
        </Section>
        <Section titre="Contact">
          <Contact role="Coach" p={coach} />
          <Contact role={coach.rr?.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional'} p={coach.rr} sousTitre={coach.rr ? undefined : 'Non rattaché à ce jour'} />
        </Section>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>Magasins suivis</Typography>
        {magasins.length === 0
          ? <Typography variant="body2" color="text.secondary">Aucun magasin affecté aujourd’hui.</Typography>
          : surPC ? <TableMagasins magasins={magasins} /> : <ListeMagasins magasins={magasins} />}
      </Box>

      <Section titre="Historique">
        {evenements.length === 0 ? <Typography variant="body2" color="text.secondary">Aucun mouvement enregistré.</Typography> : evenements.map((e, i) => (
          <Box key={`${e.date}-${i}`} sx={{ display: 'flex', gap: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
            <Typography variant="body2" color="text.secondary" sx={{ width: 110, flexShrink: 0 }}>{dateCourte(e.date)}</Typography>
            <Box>
              <Typography variant="body1">{e.texte}</Typography>
              {e.note && <Typography variant="caption" color="text.secondary">{e.note}</Typography>}
            </Box>
          </Box>
        ))}
      </Section>
      {edition && <DialogCoach reseau={reseau} coach={coach} onFermer={(m, nom) => { setEdition(false); if (m?.includes('retiré')) naviguer('/equipe'); else if (m) { setMessage(m); if (nom && nom !== coach.nom) naviguer(lienCoach(nom), { replace: true }) } }} />}
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

export function FicheCoach() {
  const { nom = '' } = useParams()
  const naviguer = useNavigate()
  return (
    <AvecReseau>
      {(reseau) => {
        const coach = reseau.equipe.find((c) => c.nom === nom)
        if (!coach) return <EmptyState icone={<PersonOutlineOutlined />} titre="Coach introuvable" texte={`Aucun Coach ne s’appelle « ${nom} ».`} action={<Button variant="contained" onClick={() => naviguer('/equipe')}>Voir toute l’équipe</Button>} />
        return <Fiche coach={coach} reseau={reseau} />
      }}
    </AvecReseau>
  )
}
