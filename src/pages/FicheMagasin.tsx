import { useState, type ReactNode } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ArrowBack from '@mui/icons-material/ArrowBack'
import CallOutlined from '@mui/icons-material/CallOutlined'
import MailOutlined from '@mui/icons-material/MailOutlined'
import PlaceOutlined from '@mui/icons-material/PlaceOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { PastilleCase, PastilleTendance } from '../components/Sante'
import { Journal } from '../components/Journal'
import { caseDe, couleurTon, historiqueSante, libelleNote, nineBox, tendance, tonDe, tousCriteres } from '../data/sante'
import { AvecReseau } from '../components/EtatDonnees'
import { ReaffecterDialog } from '../components/ReaffecterDialog'
import Snackbar from '@mui/material/Snackbar'
import SwapHoriz from '@mui/icons-material/SwapHoriz'
import { EmptyState } from '../components/EmptyState'
import { PastilleStatut, PastilleType } from '../components/Pastilles'
import { dateCourte, dateLongue, lienCoach, lienFiche, lienFranchise, lienRR, telLien } from '../lib/format'
import { DialogMagasin } from '../components/EditionMagasin'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { libelleResponsable, libelleTypeVisite, nomsVisiteurs, type Magasin, type Personne, type Reseau, type Visite } from '../data/modele'
import { DialogVisite } from '../components/DialogVisite'
import { anneeDe, lienCompteRendu, suiviRythme, visitesDuMagasin } from '../data/visites'
import AddOutlined from '@mui/icons-material/AddOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import PhoneInTalkOutlined from '@mui/icons-material/PhoneInTalkOutlined'
import { DialogChiffres, GraphiqueCA, PastilleAlerte, PastilleAppel } from '../components/Chiffres'
import { analyser, caDe, chiffresDuMagasin, dernierAudit, formatEuros, formatPoints, formatPourcent, formatValeur, libelleAudit, libelleMois, suiviAlerte } from '../data/chiffres'

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
  const [typeVisite, setTypeVisite] = useState('terrain')
  const [saisieChiffres, setSaisieChiffres] = useState<string | null | undefined>(undefined)
  const [confirmation, setConfirmation] = useState('')
  const coach = m.coach ? reseau.coachs[m.coach] ?? { nom: m.coach } : null
  const adresseComplete = [m.adresse || [m.codePostal, m.ville].filter(Boolean).join(' '), m.pays].filter(Boolean).join(', ')
  const villeDansAdresse = !!m.ville && !!m.adresse?.toLowerCase().includes(m.ville.toLowerCase())
  const rechercheCarte = [m.adresse, !villeDansAdresse && [m.codePostal, m.ville].filter(Boolean).join(' '), m.pays].filter(Boolean).join(' ')
  const lieuCarte = rechercheCarte ? `V and B ${rechercheCarte}` : m.lat !== null && m.lon !== null ? `${m.lat},${m.lon}` : null
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
          <Contact role={m.rr?.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional'} p={m.rr} lien={m.rr ? lienRR(m.rr.id) : undefined} sousTitre={m.rrEnDirect ? 'Gère ce magasin en direct' : undefined} />
          <Contact role={libelleResponsable(m)} p={m.responsable} lien={m.responsable ? lienFranchise(m.responsable.nom) : undefined} sousTitre={m.responsable ? undefined : m.responsableARecruter ? 'En cours de recrutement' : undefined} />
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
        </Section>

        {lieuCarte && (
          <Card sx={{ gridColumn: { lg: 'span 2' }, overflow: 'hidden' }}>
            <Box component="iframe" title={`Carte Google de ${m.nom}`} src={`https://www.google.com/maps?q=${encodeURIComponent(lieuCarte)}&output=embed&hl=fr`}
              loading="lazy" referrerPolicy="no-referrer-when-downgrade" sx={{ display: 'block', width: '100%', height: 300, border: 0 }} />
          </Card>
        )}

        <SectionChiffres reseau={reseau} m={m} saisir={(mois) => setSaisieChiffres(mois ?? null)} appeler={() => { setTypeVisite('appel'); setVisite(null) }} />

        <Section titre="Visites" action={<Button startIcon={<AddOutlined />} onClick={() => { setTypeVisite('terrain'); setVisite(null) }} sx={{ minHeight: 48 }}>Saisir</Button>}>
          {(() => {
            const vs = visitesDuMagasin(reseau, m.nom)
            const a = anneeDe(reseau.jour)
            const r = suiviRythme(reseau, a).find((l) => l.magasin.nom === m.nom)
            return (
              <>
                {r && <Chip size="small" color={r.retard ? 'warning' : 'success'} variant={r.retard ? 'filled' : 'outlined'}
                  label={`${r.faites} visite${r.faites > 1 ? 's' : ''} sur ${r.objectif} en ${a.court} · ${r.retard ? `${r.retard} j de retard` : `prochaine avant le ${dateCourte(r.prochaine)}`}`}
                  sx={{ fontSize: '0.75rem', fontWeight: 600, mb: 1 }} />}
                {vs.length === 0 ? <Typography variant="body2" color="text.secondary">Aucune visite enregistrée.</Typography> : vs.slice(0, 6).map((v) => (
                  <Box key={v.id ?? v.date} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                    <Typography variant="body2" color="text.secondary" sx={{ width: 110, flexShrink: 0 }}>{dateCourte(v.date)}</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body1">{libelleTypeVisite(v.type)}{v.visiteurs.length ? ` · ${nomsVisiteurs(v)}` : ''}</Typography>
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

        <SectionSante reseau={reseau} m={m} modifier={() => setEdition(true)} />
        <SectionDeploiements reseau={reseau} m={m} modifier={() => setEdition(true)} />
        <Box sx={{ gridColumn: { lg: 'span 2' } }}><Journal reseau={reseau} m={m} signaler={setConfirmation} /></Box>
      </Box>
      {reaffectation && <ReaffecterDialog reseau={reseau} magasin={m} ouvert onFermer={(fait) => { setReaffectation(false); if (fait) setConfirmation(`${m.nom} est confié à ${fait}.`) }} />}
      {edition && <DialogMagasin reseau={reseau} magasin={m} onFermer={(msg, nom) => {
        setEdition(false)
        if (!msg) return
        if (msg.includes('supprimé')) { naviguer('/magasins', { replace: true }); return }
        setConfirmation(msg)
        if (nom && nom !== m.nom) naviguer(lienFiche(nom), { replace: true })
      }} />}
      {visite !== undefined && <DialogVisite reseau={reseau} visite={visite} magasinsInitiaux={[m.nom]} typeInitial={typeVisite} onFermer={(msg) => { setVisite(undefined); if (msg) setConfirmation(msg) }} />}
      {saisieChiffres !== undefined && <DialogChiffres reseau={reseau} magasin={m.nom} mois={saisieChiffres ?? undefined} onFermer={(msg) => { setSaisieChiffres(undefined); if (msg) setConfirmation(msg) }} />}
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

// Santé et déploiements : deux blocs en lecture, modifiables avec « Modifier »
function SectionSante({ reseau, m, modifier }: { reseau: Reseau; m: Magasin; modifier: () => void }) {
  const e = reseau.evaluations[m.nom]
  const c = caseDe(e)
  return (
    <Section titre="Santé" action={<Button startIcon={<EditOutlined />} onClick={modifier} aria-label="Modifier la santé" sx={{ minHeight: 48 }}>Modifier</Button>}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
        <PastilleCase c={c} />
        <PastilleTendance t={tendance(reseau.evaluations, m.nom)} />
        {c && <Typography variant="body2" color="text.secondary">Rythme de visite : {c.rythme} par an</Typography>}
      </Box>
      {tousCriteres.map((k) => {
        const n = e?.notes[k.id]
        return <Ligne key={k.id} libelle={k.libelle}>{n === undefined ? null : <Chip size="small" label={libelleNote[n]} color={n === 0 ? 'default' : couleurNoteChip[n]} sx={{ fontSize: 12 }} />}</Ligne>
      })}
      <EvolutionCases points={historiqueSante(reseau.evaluations, m.nom)} />
    </Section>
  )
}

// Cases successives, de la plus récente à la plus ancienne
function EvolutionCases({ points }: { points: { date: string; caseId: string }[] }) {
  const changements = points.filter((p, i) => p.caseId && p.caseId !== points.slice(0, i).filter((x) => x.caseId).at(-1)?.caseId)
  if (changements.length < 2) return null
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h4" component="h3" sx={{ mb: 1 }}>Évolution</Typography>
      {[...changements].reverse().map((p) => (
        <Box key={p.date + p.caseId} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 0.75 }}>
          <Typography variant="body2" color="text.secondary" sx={{ width: 110, flexShrink: 0 }}>{dateCourte(p.date)}</Typography>
          <PastilleCase c={nineBox.find((c) => c.id === p.caseId) ?? null} />
        </Box>
      ))}
    </Box>
  )
}

function SectionDeploiements({ reseau, m, modifier }: { reseau: Reseau; m: Magasin; modifier: () => void }) {
  return (
    <Section titre="Déploiements" action={<Button startIcon={<EditOutlined />} onClick={modifier} aria-label="Modifier les déploiements" sx={{ minHeight: 48 }}>Modifier</Button>}>
      {reseau.deploiements.thematiques.map((t) => {
        const v = reseau.deploiements.valeurs[m.nom]?.[t.id]
        const ton = tonDe(t, v)
        return <Ligne key={t.id} libelle={t.libelle}>{v ? <Chip size="small" label={v} color={ton ? couleurTon[ton] : 'default'} sx={{ fontSize: 12 }} /> : null}</Ligne>
      })}
    </Section>
  )
}

const couleurNoteChip = { 1: 'error', 2: 'warning', 3: 'success' } as const

// Chiffres du mois, alerte de décrochage, appel et derniers audits
function SectionChiffres({ reseau, m, saisir, appeler }: { reseau: Reseau; m: Magasin; saisir: (mois?: string) => void; appeler: () => void }) {
  const [tousLesMois, setTousLesMois] = useState(false)
  const a = analyser(reseau, m.nom)
  const suivi = suiviAlerte(reseau, m.nom, a)
  const audits = [['hygiene', 'Dernier audit hygiène'], ['excellence', 'Dernier audit excellence']] as const
  return (
    <Section titre="Chiffres" action={<Button startIcon={<EditOutlined />} onClick={() => saisir()} aria-label="Saisir les chiffres" sx={{ minHeight: 48 }}>Saisir</Button>}>
      {!a ? <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Aucun chiffre enregistré pour ce magasin.</Typography> : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <PastilleAlerte statut={a.statut} />
            <PastilleAppel s={suivi} />
            <Typography variant="body2" color="text.secondary">Chiffres à fin {libelleMois(a.mois)}</Typography>
          </Box>
          {a.raisons.length > 0 && <Typography variant="body2" sx={{ mb: 1 }}>{a.raisons.join(' · ').replace(/^./, (c) => c.toUpperCase())}</Typography>}
          {suivi && !suivi.contact && <Button variant="contained" startIcon={<PhoneInTalkOutlined />} onClick={appeler} sx={{ minHeight: 48, mb: 1 }}>Saisir un appel</Button>}
          <Ligne libelle="CA 3 mois vs an dernier">{formatPourcent(a.evol3)}</Ligne>
          <Ligne libelle="CA 12 mois vs an dernier">{formatPourcent(a.evol12)}</Ligne>
          <Ligne libelle="Rupture de tendance">{formatPoints(a.rupture)}</Ligne>
          {(() => {
            const c = chiffresDuMagasin(reseau, m.nom).find((x) => x.mois === a.mois)
            return <>
              <Ligne libelle={`CA cumulé de ${libelleMois(a.mois)}`}>{formatEuros(caDe(c))}</Ligne>
              <Ligne libelle="Flux cumulé">{c?.tickets === null || c?.tickets === undefined ? null : formatValeur('tickets', c.tickets)}</Ligne>
              <Ligne libelle="Marge">{c?.marge === null || c?.marge === undefined ? null : formatValeur('marge', c.marge)}</Ligne>
              <Ligne libelle="CA marché extérieur">{c?.caExt === null || c?.caExt === undefined ? null : formatEuros(c.caExt)}</Ligne>
            </>
          })()}
        </>
      )}
      {audits.map(([type, libelle]) => {
        const r = dernierAudit(reseau, m.nom, type)
        return <Ligne key={type} libelle={libelle}>{r ? `${libelleAudit(r)} · ${dateCourte(r.date)}` : null}</Ligne>
      })}
      <GraphiqueCA liste={chiffresDuMagasin(reseau, m.nom)} />
      {(() => {
        const liste = [...chiffresDuMagasin(reseau, m.nom)].reverse()
        if (!liste.length) return null
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>Mois enregistrés</Typography>
            {(tousLesMois ? liste : liste.slice(0, 6)).map((c) => (
              <Box key={c.mois} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                <Typography variant="body2" color="text.secondary" sx={{ width: 130, flexShrink: 0 }}>{libelleMois(c.mois)}</Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1">{formatEuros(caDe(c))}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {[c.tickets !== null && c.tickets !== undefined && `Flux ${formatValeur('tickets', c.tickets)}`, c.marge !== null && c.marge !== undefined && `Marge ${formatValeur('marge', c.marge)}`].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <Tooltip title="Modifier"><IconButton onClick={() => saisir(c.mois)} sx={{ width: 48, height: 48 }} aria-label={`Modifier les chiffres de ${libelleMois(c.mois)}`}><EditOutlined /></IconButton></Tooltip>
              </Box>
            ))}
            {liste.length > 6 && <Button onClick={() => setTousLesMois((v) => !v)} sx={{ minHeight: 48, mt: 0.5 }}>{tousLesMois ? 'Afficher moins' : `Voir les ${liste.length} mois`}</Button>}
          </Box>
        )
      })()}
    </Section>
  )
}
