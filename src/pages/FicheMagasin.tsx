import { useState, type ReactNode } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
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
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined'
import { PastilleCase, SelectDeploiement, SelectNote, useSaisieSante } from '../components/Sante'
import { caseDe, tousCriteres } from '../data/sante'
import { AvecReseau } from '../components/EtatDonnees'
import { ReaffecterDialog } from '../components/ReaffecterDialog'
import Snackbar from '@mui/material/Snackbar'
import SwapHoriz from '@mui/icons-material/SwapHoriz'
import { EmptyState } from '../components/EmptyState'
import { PastilleStatut, PastilleType } from '../components/Pastilles'
import { dateCourte, dateLongue, lienCoach, lienFiche, telLien } from '../lib/format'
import { DialogMagasin } from '../components/EditionMagasin'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { libelleTypeVisite, type Magasin, type Personne, type Reseau, type Visite } from '../data/modele'
import { DialogVisite } from '../components/DialogVisite'
import { lienCompteRendu, semestreDe, visitesDuMagasin } from '../data/visites'
import AddOutlined from '@mui/icons-material/AddOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'

export function Section({ titre, children, action }: { titre: string; children: ReactNode; action?: ReactNode }) {
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

export function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' }, gap: { xs: 0.25, sm: 2 }, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
      <Box sx={{ typography: 'body1', minWidth: 0, overflowWrap: 'anywhere' }}>{children || <Typography color="text.secondary" variant="body2">Non renseigné</Typography>}</Box>
    </Box>
  )
}

export function Contact({ role, p, sousTitre, lien }: { role: string; p: Personne | null; sousTitre?: string; lien?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">{role}</Typography>
        {p && lien
          ? <Link component={RouterLink} to={lien} variant="body1" sx={{ fontWeight: 500, display: 'inline-flex', minHeight: 32, alignItems: 'center' }}>{p.nom}</Link>
          : <Typography variant="body1" sx={{ fontWeight: 500 }}>{p?.nom ?? 'Non renseigné'}</Typography>}
        {sousTitre && <Typography variant="caption" color="text.secondary">{sousTitre}</Typography>}
      </Box>
      {p?.telephone && <Tooltip title={p.telephone}><IconButton href={telLien(p.telephone)} aria-label={`Appeler ${p.nom}`}><CallOutlined /></IconButton></Tooltip>}
      {p?.email && <Tooltip title={p.email}><IconButton href={`mailto:${p.email}`} aria-label={`Écrire à ${p.nom}`}><MailOutlined /></IconButton></Tooltip>}
    </Box>
  )
}

function Fiche({ m, reseau }: { m: Magasin; reseau: Reseau }) {
  const naviguer = useNavigate()
  const [reaffectation, setReaffectation] = useState(false)
  const [edition, setEdition] = useState(false)
  const [visite, setVisite] = useState<Visite | null | undefined>(undefined)
  const [confirmation, setConfirmation] = useState('')
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
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setEdition(true)} sx={{ minHeight: 48 }}>Modifier</Button>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {[m.ville || null, m.departement && `Département ${m.departement}`, m.pays || null, m.code && `Code ${m.code}`].filter(Boolean).join(' · ')}
      </Typography>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
        <Section titre="Équipe" action={<Button startIcon={<SwapHoriz />} onClick={() => setReaffectation(true)} sx={{ minHeight: 48 }}>Réaffecter</Button>}>
          <Contact role="Coach" p={coach} lien={m.coach ? lienCoach(m.coach) : undefined} sousTitre={m.coach ? undefined : 'Aucun Coach affecté à ce jour'} />
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

        <Section titre="Visites" action={<Button startIcon={<AddOutlined />} onClick={() => setVisite(null)} sx={{ minHeight: 48 }}>Saisir</Button>}>
          {(() => {
            const vs = visitesDuMagasin(reseau, m.nom)
            const s = semestreDe(reseau.jour)
            const ceSemestre = vs.some((v) => v.date >= s.debut && v.date <= s.fin)
            return (
              <>
                <Chip size="small" color={ceSemestre ? 'success' : 'warning'} variant={ceSemestre ? 'filled' : 'outlined'} label={ceSemestre ? `Visité sur ${s.court}` : `Pas encore visité sur ${s.court}`} sx={{ fontSize: '0.75rem', fontWeight: 600, mb: 1 }} />
                {vs.length === 0 ? <Typography variant="body2" color="text.secondary">Aucune visite enregistrée.</Typography> : vs.slice(0, 6).map((v) => (
                  <Box key={v.id ?? v.date} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                    <Typography variant="body2" color="text.secondary" sx={{ width: 110, flexShrink: 0 }}>{dateCourte(v.date)}</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body1">{libelleTypeVisite(v.type)}{v.visiteur ? ` · ${v.visiteur}` : ''}</Typography>
                      {v.notes && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>{v.notes}</Typography>}
                    </Box>
                    <Tooltip title="Compte rendu PDF"><IconButton component={RouterLink} to={lienCompteRendu(v)} aria-label={`Compte rendu du ${dateCourte(v.date)}`}><PictureAsPdfOutlined /></IconButton></Tooltip>
                    <Tooltip title="Modifier"><IconButton onClick={() => setVisite(v)} aria-label={`Modifier la visite du ${dateCourte(v.date)}`}><EditOutlined /></IconButton></Tooltip>
                  </Box>
                ))}
                {vs.length > 6 && <Link component={RouterLink} to={`/visites?vue=historique`} variant="body2">Voir les {vs.length} visites</Link>}
              </>
            )
          })()}
        </Section>

        <SectionSante reseau={reseau} m={m} signaler={setConfirmation} />
      </Box>
      {reaffectation && <ReaffecterDialog reseau={reseau} magasin={m} ouvert onFermer={(fait) => { setReaffectation(false); if (fait) setConfirmation(`${m.nom} est confié à ${fait}.`) }} />}
      {edition && <DialogMagasin reseau={reseau} magasin={m} onFermer={(msg, nom) => {
        setEdition(false)
        if (!msg) return
        if (msg.includes('supprimé')) { naviguer('/magasins', { replace: true }); return }
        setConfirmation(msg)
        if (nom && nom !== m.nom) naviguer(lienFiche(nom), { replace: true })
      }} />}
      {visite !== undefined && <DialogVisite reseau={reseau} visite={visite} magasinsInitiaux={[m.nom]} onFermer={(msg) => { setVisite(undefined); if (msg) setConfirmation(msg) }} />}
      <Snackbar open={!!confirmation} autoHideDuration={5000} onClose={() => setConfirmation('')} message={confirmation} />
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

// Santé du parc : notes nine box et état des déploiements, modifiables sur place
function SectionSante({ reseau, m, signaler }: { reseau: Reseau; m: Magasin; signaler: (s: string) => void }) {
  const saisie = useSaisieSante(reseau, signaler)
  const e = saisie.evaluation(m.nom)
  const c = caseDe(e)
  return (
    <Section titre="Santé et déploiements" action={<Button component={RouterLink} to="/plus/sante" startIcon={<QueryStatsOutlined />} sx={{ minHeight: 48 }}>Nine box</Button>}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <PastilleCase c={c} />
        <Typography variant="body2" color="text.secondary">{c ? `Rythme de visite conseillé : ${c.rythme}` : 'Note au moins un critère de résultats et le niveau du franchisé pour classer le magasin.'}</Typography>
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {tousCriteres.map((k) => <SelectNote key={k.id} libelle={k.libelle} valeur={e?.notes[k.id]} onChange={(n) => saisie.noter(m.nom, k.id, n)} />)}
      </Box>
      <Divider sx={{ my: 2 }} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {reseau.deploiements.thematiques.map((t) => <SelectDeploiement key={t.id} t={t} libelle={t.libelle} valeur={saisie.etat(m.nom, t.id)} onChange={(v) => saisie.deployer(m.nom, t.id, v)} />)}
      </Box>
    </Section>
  )
}
