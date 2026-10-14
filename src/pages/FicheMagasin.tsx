import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ArrowBack from '@mui/icons-material/ArrowBack'
import CallOutlined from '@mui/icons-material/CallOutlined'
import MailOutlined from '@mui/icons-material/MailOutlined'
import PlaceOutlined from '@mui/icons-material/PlaceOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { PastilleStatut, PastilleType } from '../components/Pastilles'
import { dateCourte, dateLongue, telLien } from '../lib/format'
import type { Magasin, Personne, Reseau } from '../data/modele'

function Section({ titre, children, action }: { titre: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h3" component="h2" sx={{ flex: 1 }}>{titre}</Typography>
          {action}
        </Box>
        {children}
      </CardContent>
    </Card>
  )
}

function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' }, gap: { xs: 0.25, sm: 2 }, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
      <Box sx={{ typography: 'body1', minWidth: 0, overflowWrap: 'anywhere' }}>{children || <Typography color="text.secondary" variant="body2">Non renseigné</Typography>}</Box>
    </Box>
  )
}

function Contact({ role, p, sousTitre }: { role: string; p: Personne | null; sousTitre?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">{role}</Typography>
        <Typography variant="body1" sx={{ fontWeight: 500 }}>{p?.nom ?? 'Non renseigné'}</Typography>
        {sousTitre && <Typography variant="caption" color="text.secondary">{sousTitre}</Typography>}
      </Box>
      {p?.telephone && <Tooltip title={p.telephone}><IconButton href={telLien(p.telephone)} aria-label={`Appeler ${p.nom}`}><CallOutlined /></IconButton></Tooltip>}
      {p?.email && <Tooltip title={p.email}><IconButton href={`mailto:${p.email}`} aria-label={`Écrire à ${p.nom}`}><MailOutlined /></IconButton></Tooltip>}
    </Box>
  )
}

function Fiche({ m, reseau }: { m: Magasin; reseau: Reseau }) {
  const naviguer = useNavigate()
  const coach = m.coach ? reseau.coachs[m.coach] ?? { nom: m.coach } : null
  const adresseComplete = [m.adresse || [m.codePostal, m.ville].filter(Boolean).join(' '), m.pays].filter(Boolean).join(', ')
  const lienPlan = adresseComplete ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`V and B ${m.nom} ${adresseComplete}`)}` : null
  return (
    <>
      <Button startIcon={<ArrowBack />} onClick={() => (window.history.length > 1 ? naviguer(-1) : naviguer('/magasins'))} sx={{ mb: 2, ml: -1 }}>Magasins</Button>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Typography variant="h1" sx={{ mr: 1 }}>{m.nom}</Typography>
        <PastilleStatut statut={m.statut} />
        <PastilleType franchise={m.franchise} />
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {[m.ville || null, m.departement && `Département ${m.departement}`, m.pays || null, m.code && `Code ${m.code}`].filter(Boolean).join(' · ')}
      </Typography>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
        <Section titre="Équipe">
          <Contact role="Coach" p={coach} sousTitre={m.coach ? undefined : 'Aucun Coach affecté à ce jour'} />
          <Contact role={m.rr?.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional'} p={m.rr} sousTitre={m.rrEnDirect ? 'Gère ce magasin en direct' : undefined} />
          <Contact role="Responsable magasin" p={m.responsable} />
          <Contact role="Adjoint" p={m.adjoint} />
        </Section>

        <Section titre="Magasin">
          <Ligne libelle="Ouverture">{m.ouvertureConnue ? dateLongue(m.ouverture) : null}</Ligne>
          <Ligne libelle="Adresse">
            {adresseComplete && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <span>{adresseComplete}</span>
                {lienPlan && <Chip icon={<PlaceOutlined />} label="Itinéraire" size="small" component="a" href={lienPlan} target="_blank" rel="noopener" clickable sx={{ fontSize: '0.75rem' }} />}
              </Box>
            )}
          </Ligne>
          <Ligne libelle="Téléphone">{m.telephone && <Link href={telLien(m.telephone)}>{m.telephone}</Link>}</Ligne>
          <Ligne libelle="Email">{m.email && <Link href={`mailto:${m.email}`}>{m.email}</Link>}</Ligne>
          <Ligne libelle="Plateforme logistique">{m.plateforme}</Ligne>
        </Section>

        <Section titre="Historique des Coachs">
          {m.historiqueCoach.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Aucune affectation enregistrée.</Typography>
          ) : (
            [...m.historiqueCoach].reverse().map((h, i) => (
              <Box key={`${h.date}-${i}`} sx={{ display: 'flex', gap: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                <Typography variant="body2" color="text.secondary" sx={{ width: 110, flexShrink: 0 }}>{dateCourte(h.date)}</Typography>
                <Box>
                  <Typography variant="body1">{h.coach || 'Sans Coach'}</Typography>
                  {h.note && <Typography variant="caption" color="text.secondary">{h.note}</Typography>}
                </Box>
              </Box>
            ))
          )}
        </Section>

        <Section titre="Visites et performance">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', color: 'text.secondary' }}><EventNoteOutlined /><Typography variant="body2">Les visites de ce magasin s’afficheront ici au sprint 3.</Typography></Box>
            <Divider />
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', color: 'text.secondary' }}><QueryStatsOutlined /><Typography variant="body2">Le CA, l’EBITDA, le panier et la fréquentation s’afficheront ici au sprint 4.</Typography></Box>
          </Box>
        </Section>
      </Box>
    </>
  )
}

export function FicheMagasin() {
  const { nom = '' } = useParams()
  const naviguer = useNavigate()
  return (
    <AvecReseau>
      {(reseau) => {
        const m = reseau.magasins.find((x) => x.nom === nom)
        if (!m) {
          return <EmptyState icone={<StorefrontOutlined />} titre="Magasin introuvable" texte={`Aucun magasin ne s’appelle « ${nom} ». Il a peut-être été renommé.`} action={<Button variant="contained" onClick={() => naviguer('/magasins')}>Voir tous les magasins</Button>} />
        }
        return <Fiche m={m} reseau={reseau} />
      }}
    </AvecReseau>
  )
}
