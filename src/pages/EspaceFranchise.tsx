import { useEffect, useState, type ReactNode } from 'react'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ArrowBack from '@mui/icons-material/ArrowBack'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import Snackbar from '@mui/material/Snackbar'
import { SectionMessages, useNonLusMagasin } from '../components/Messages'
import { useMessagerie } from '../data/MessagerieContext'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { Onglets, type Rubrique } from '../components/Onglets'
import { PastilleStatut, PastilleType } from '../components/Pastilles'
import { GraphiqueCA } from '../components/Chiffres'
import { VuePratiques } from '../components/BonnesPratiques'
import { RangeePhotos } from '../components/GrilleAudit'
import { Contact, Ligne, Section } from './FicheMagasin'
import { useAuth } from '../auth/AuthContext'
import { useApercu } from '../auth/Apercu'
import { dateCourte, dateLongue, lienFiche, telLien } from '../lib/format'
import { actionsDes, echeanceDate, enRetard } from '../data/actions'
import { analyser, caDe, chiffresDuMagasin, decalerMois, dernierAudit, formatEuros, formatPourcent, formatValeur, libelleAudit, libelleMois, type ChampChiffre } from '../data/chiffres'
import { campagnesDuMagasin, executionMagasin, libellesExecution, magasinsConcernes, phase, libellesPhase, type Execution } from '../data/campagnes'
import { associesEnPlace, mandatActuel } from '../data/associes'
import { lienCompteRendu, visitesDuMagasin } from '../data/visites'
import { libelleTypeVisite, nomsVisiteurs, type Magasin, type Personne, type Reseau } from '../data/modele'
import type { IndicateurRepere } from '../data/espaceFranchise'

const couleurExecution: Record<Execution, 'success' | 'warning' | 'error' | 'default'> = { fait: 'success', partiel: 'warning', non: 'error', aConstater: 'default' }
const pastille = { fontSize: 12, fontWeight: 600 }

function salutation(): string {
  return new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir'
}

// ── Bandeau de l'aperçu (Directeur de réseau) ──
export function BandeauApercu() {
  const { apercu, quitter } = useApercu()
  const naviguer = useNavigate()
  if (!apercu) return null
  return (
    <Box role="region" aria-label="Aperçu" sx={{ bgcolor: 'secondary.main', color: 'secondary.contrastText', px: { xs: 2, md: 5 }, py: 1, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      <VisibilityOutlined />
      <Typography variant="body1" sx={{ flex: 1, fontWeight: 600, minWidth: 0 }}>Espace de {apercu.franchise}</Typography>
      <Button variant="outlined" color="inherit" onClick={() => { const nom = apercu.franchise; quitter(); naviguer(`/equipe/franchise/${encodeURIComponent(nom)}`, { replace: true }) }} sx={{ minHeight: 48 }}>Quitter l’aperçu</Button>
    </Box>
  )
}

// ── Petits éléments ──
function Tuile({ libelle, valeur, detail }: { libelle: string; valeur: string; detail?: string }) {
  return (
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
      <Typography variant="h3" component="p" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>{valeur}</Typography>
      {detail && <Typography variant="body2" color="text.secondary">{detail}</Typography>}
    </Box>
  )
}

function LigneSimple({ titre, detail, fin, lien }: { titre: ReactNode; detail?: ReactNode; fin?: ReactNode; lien?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {lien ? <Link component={RouterLink} to={lien} variant="body1" sx={{ fontWeight: 500 }}>{titre}</Link> : <Typography variant="body1" sx={{ fontWeight: 500 }}>{titre}</Typography>}
        {detail && <Typography variant="body2" color="text.secondary">{detail}</Typography>}
      </Box>
      {fin}
    </Box>
  )
}

const Vide = ({ children }: { children: ReactNode }) => <Typography variant="body2" color="text.secondary">{children}</Typography>

// Coachs et Responsables Régionaux des magasins, sans doublon
function contacts(reseau: Reseau, magasins: Magasin[]): { role: string; p: Personne }[] {
  const vus = new Set<string>()
  const res: { role: string; p: Personne }[] = []
  for (const m of magasins) {
    if (m.coach && !vus.has(`c:${m.coach}`)) { vus.add(`c:${m.coach}`); res.push({ role: 'Coach', p: reseau.coachs[m.coach] ?? { nom: m.coach } }) }
    if (m.rr && !vus.has(`r:${m.rr.id}`)) { vus.add(`r:${m.rr.id}`); res.push({ role: m.rr.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional', p: m.rr }) }
  }
  return res
}

// ── Repères réseau ──
const libellesReperes: Record<IndicateurRepere, string> = {
  evolution: 'Évolution du CA vs N-1', pmCave: 'Panier moyen HT cave', pmBar: 'Panier moyen HT bar',
  fluxCave: 'Flux cave', fluxBar: 'Flux bar', panier: 'Panier moyen', marge: 'Marge',
}
const ordreReperes: IndicateurRepere[] = ['evolution', 'pmCave', 'pmBar', 'fluxCave', 'fluxBar', 'panier', 'marge']
const formatRepere = (i: IndicateurRepere, n: number | null) => (i === 'evolution' ? formatPourcent(n) : formatValeur(i as ChampChiffre, n))

function valeurRepere(reseau: Reseau, magasin: string, mois: string, i: IndicateurRepere): number | null {
  const liste = chiffresDuMagasin(reseau, magasin)
  const c = liste.find((x) => x.mois === mois)
  if (i !== 'evolution') return c?.[i] ?? null
  const ca = caDe(c), ref = caDe(liste.find((x) => x.mois === decalerMois(mois, -12)))
  return ca !== null && ref ? ((ca - ref) / ref) * 100 : null
}

function Position({ v, mediane, quartHaut }: { v: number | null; mediane: number; quartHaut: number }) {
  if (v === null) return null
  const [libelle, couleur] = v >= quartHaut ? ['Quart supérieur', 'success'] as const : v >= mediane ? ['Au-dessus de la médiane', 'info'] as const : ['Sous la médiane', 'warning'] as const
  return <Chip size="small" color={couleur} variant="outlined" label={libelle} sx={pastille} />
}

function SectionReperes({ reseau, magasins }: { reseau: Reseau; magasins: Magasin[] }) {
  const r = reseau.espace?.reperes
  const indicateurs = r ? ordreReperes.filter((i) => r.indicateurs[i]) : []
  return (
    <Section titre={r ? `Repères réseau · ${libelleMois(r.mois)}` : 'Repères réseau'}>
      {!indicateurs.length ? <Vide>Pas encore assez de magasins avec des chiffres ce mois-ci pour comparer.</Vide> : indicateurs.map((i) => {
        const x = r!.indicateurs[i]!
        return (
          <Box key={i} role="group" aria-label={libellesReperes[i]} sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>{libellesReperes[i]}</Typography>
            <Typography variant="body2" color="text.secondary">Médiane du réseau {formatRepere(i, x.mediane)} · quart supérieur {formatRepere(i, x.quartHaut)}</Typography>
            {magasins.map((m) => {
              const v = valeurRepere(reseau, m.nom, r!.mois, i)
              return (
                <Box key={m.nom} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{magasins.length > 1 ? `${m.nom} : ` : ''}{formatRepere(i, v)}</Typography>
                  <Position v={v} mediane={x.mediane} quartHaut={x.quartHaut} />
                </Box>
              )
            })}
          </Box>
        )
      })}
    </Section>
  )
}

// ── Chiffres ──
function SectionChiffresDuMois({ reseau, magasins }: { reseau: Reseau; magasins: Magasin[] }) {
  if (magasins.length > 1) {
    return (
      <Section titre="Mes chiffres">
        {magasins.map((m) => {
          const a = analyser(reseau, m.nom)
          return <LigneSimple key={m.nom} titre={m.nom} lien={`${lienFiche(m.nom)}?vue=chiffres`}
            detail={a ? `${libelleMois(a.mois)} · CA ${formatEuros(a.ca)}${a.ecart === null ? '' : ` · ${formatPourcent(a.ecart)} vs ${libelleMois(a.reference)}`}` : 'Aucun chiffre enregistré'} />
        })}
      </Section>
    )
  }
  const m = magasins[0]
  const a = analyser(reseau, m.nom)
  if (!a) return <Section titre="Mes chiffres"><Vide>Aucun chiffre enregistré pour ce magasin.</Vide></Section>
  const c = a.chiffre
  return (
    <Section titre={`Mes chiffres · ${libelleMois(a.mois)}`}>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, mb: 1 }}>
        <Tuile libelle="CA cumulé" valeur={formatEuros(a.ca)} />
        <Tuile libelle={`Écart vs ${libelleMois(a.reference)}`} valeur={formatPourcent(a.ecart)} detail={a.caReference === null ? undefined : formatEuros(a.caReference)} />
        <Tuile libelle="Marge" valeur={formatValeur('marge', c.marge)} />
        <Tuile libelle="Panier moyen HT cave" valeur={formatValeur('pmCave', c.pmCave)} />
        <Tuile libelle="Panier moyen HT bar" valeur={formatValeur('pmBar', c.pmBar)} />
        <Tuile libelle="Flux cumulé" valeur={formatValeur('tickets', c.tickets)} detail={c.fluxCave !== null || c.fluxBar !== null ? `Cave ${formatValeur('fluxCave', c.fluxCave)} · bar ${formatValeur('fluxBar', c.fluxBar)}` : undefined} />
      </Box>
      <GraphiqueCA liste={chiffresDuMagasin(reseau, m.nom)} />
    </Section>
  )
}

// ── Plan d'action ──
function SectionPlan({ reseau, magasins }: { reseau: Reseau; magasins: Magasin[] }) {
  const ouvertes = actionsDes(reseau, new Set(magasins.map((m) => m.nom))).filter((x) => !x.a.faite)
    .sort((x, y) => Number(enRetard(y.a, reseau.jour)) - Number(enRetard(x.a, reseau.jour)) || (echeanceDate(x.a) || '9999').localeCompare(echeanceDate(y.a) || '9999'))
  return (
    <Section titre="Mon plan d’action">
      {!ouvertes.length ? <Vide>Aucune action en cours.</Vide> : (
        <Box component="ul" aria-label="Actions en cours" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {ouvertes.map((x) => (
            <Box component="li" key={x.cle}>
              <LigneSimple titre={x.a.action}
                detail={[magasins.length > 1 && x.magasin, x.a.porteur, echeanceDate(x.a) ? `Échéance ${dateCourte(echeanceDate(x.a))}` : x.a.echeance].filter(Boolean).join(' · ')}
                fin={enRetard(x.a, reseau.jour) ? <Chip size="small" color="error" label="En retard" sx={pastille} /> : undefined} />
            </Box>
          ))}
        </Box>
      )}
    </Section>
  )
}

// ── Visites et audits ──
function SectionVisitesAudits({ reseau, magasins }: { reseau: Reseau; magasins: Magasin[] }) {
  return (
    <Section titre="Visites et audits">
      {magasins.map((m) => {
        const vs = visitesDuMagasin(reseau, m.nom)
        const faite = vs.find((v) => v.date <= reseau.jour)
        const prevue = vs.filter((v) => v.date > reseau.jour).at(-1)
        const audits = (['hygiene', 'excellence'] as const).map((t) => [t, dernierAudit(reseau, m.nom, t)] as const)
        return (
          <Box key={m.nom} sx={{ '& + &': { mt: 2 } }}>
            {magasins.length > 1 && <Typography variant="subtitle2" component="h3">{m.nom}</Typography>}
            <Ligne libelle="Dernière visite">
              {faite && <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>{dateCourte(faite.date)} · {libelleTypeVisite(faite.type)}{faite.visiteurs.length ? ` · ${nomsVisiteurs(faite)}` : ''}</span>
                {faite.id !== null && <Tooltip title="Compte rendu"><IconButton component={RouterLink} to={lienCompteRendu(faite)} aria-label={`Compte rendu du ${dateCourte(faite.date)}`}><PictureAsPdfOutlined /></IconButton></Tooltip>}
              </Box>}
            </Ligne>
            <Ligne libelle="Prochaine visite">{prevue ? `${dateLongue(prevue.date)}${prevue.visiteurs.length ? ` · ${nomsVisiteurs(prevue)}` : ''}` : null}</Ligne>
            {audits.map(([t, r]) => <Ligne key={t} libelle={t === 'hygiene' ? 'Dernier audit hygiène' : 'Dernier audit excellence'}>{r ? `${libelleAudit(r)} · ${dateCourte(r.date)}` : null}</Ligne>)}
          </Box>
        )
      })}
    </Section>
  )
}

function SectionCampagnesEnCours({ reseau, magasins }: { reseau: Reseau; magasins: Magasin[] }) {
  const lignes = magasins.flatMap((m) => campagnesDuMagasin(reseau, m.nom, reseau.jour).map((c) => ({ m, c, e: executionMagasin(reseau.campagnes, c, m.nom) })))
  return (
    <Section titre="Campagnes en cours">
      {!lignes.length ? <Vide>Aucune campagne en cours.</Vide> : lignes.map(({ m, c, e }) => (
        <LigneSimple key={`${c.id}|${m.nom}`} titre={c.nom} lien={`${lienFiche(m.nom)}?vue=campagnes`}
          detail={`${magasins.length > 1 ? `${m.nom} · ` : ''}Jusqu’au ${dateCourte(c.fin)}`}
          fin={<Chip size="small" color={couleurExecution[e]} label={libellesExecution[e]} sx={pastille} />} />
      ))}
    </Section>
  )
}

function SectionContacts({ reseau, magasins }: { reseau: Reseau; magasins: Magasin[] }) {
  const l = contacts(reseau, magasins)
  return (
    <Section titre="Mon équipe V and B">
      {!l.length ? <Vide>Aucun Coach affecté à ce jour.</Vide> : l.map((x) => <Contact key={`${x.role}|${x.p.nom}`} role={x.role} p={x.p} />)}
    </Section>
  )
}

// ── Dashboard du franchisé ──
export function TableauFranchise() {
  const { profil } = useAuth()
  const { apercu } = useApercu()
  const [choix, setChoix] = useState<string | null>(null)
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <AvecReseau>
      {(reseau) => {
        const nom = apercu?.franchise ?? reseau.espace?.franchise ?? profil?.nom ?? ''
        const tous = reseau.magasins
        if (!tous.length) return <><PageHeader titre={`${salutation()} ${nom}`} /><EmptyState icone={<StorefrontOutlined />} titre="Aucun magasin rattaché" texte="Ton Coach ou ton Responsable Régional peut rattacher tes magasins à ton accès." /></>
        const magasins = choix ? tous.filter((m) => m.nom === choix) : tous
        return (
          <>
            <PageHeader titre={`${salutation()} ${nom}`} sousTitre={`${date.charAt(0).toUpperCase() + date.slice(1)} · ${tous.length === 1 ? tous[0].nom : `${tous.length} magasins`}`} />
            {tous.length > 1 && (
              <Box role="group" aria-label="Magasins affichés" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip label="Tous mes magasins" color={choix ? 'default' : 'primary'} variant={choix ? 'outlined' : 'filled'} onClick={() => setChoix(null)} aria-pressed={!choix} sx={{ minHeight: 40 }} />
                {tous.map((m) => <Chip key={m.nom} label={m.nom} color={choix === m.nom ? 'primary' : 'default'} variant={choix === m.nom ? 'filled' : 'outlined'} onClick={() => setChoix(m.nom)} aria-pressed={choix === m.nom} sx={{ minHeight: 40 }} />)}
              </Box>
            )}
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
              <SectionChiffresDuMois reseau={reseau} magasins={magasins} />
              <SectionReperes reseau={reseau} magasins={magasins} />
              <SectionPlan reseau={reseau} magasins={magasins} />
              <SectionVisitesAudits reseau={reseau} magasins={magasins} />
              <SectionCampagnesEnCours reseau={reseau} magasins={magasins} />
              <SectionContacts reseau={reseau} magasins={magasins} />
            </Box>
          </>
        )
      }}
    </AvecReseau>
  )
}

// ── Mes magasins ──
export function MagasinsFranchise() {
  return (
    <>
      <PageHeader titre="Mes magasins" />
      <AvecReseau>
        {(reseau) => !reseau.magasins.length
          ? <EmptyState icone={<StorefrontOutlined />} titre="Aucun magasin rattaché" texte="Ton Coach ou ton Responsable Régional peut rattacher tes magasins à ton accès." />
          : (
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr' } }}>
              {reseau.magasins.map((m) => {
                const a = analyser(reseau, m.nom)
                return (
                  <Card key={m.nom}>
                    <CardActionArea component={RouterLink} to={lienFiche(m.nom)} sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="h3" component="h2">{m.nom}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{[m.ville, m.coach && `Coach ${m.coach}`].filter(Boolean).join(' · ')}</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: a ? 1 : 0 }}><PastilleStatut statut={m.statut} /><PastilleType franchise={m.franchise} /></Box>
                        {a && <Typography variant="body2">{libelleMois(a.mois)} · CA {formatEuros(a.ca)}{a.ecart === null ? '' : ` · ${formatPourcent(a.ecart)}`}</Typography>}
                      </CardContent>
                    </CardActionArea>
                  </Card>
                )
              })}
            </Box>
          )}
      </AvecReseau>
    </>
  )
}

// ── Fiche magasin du franchisé : lecture seule ──
type VueFiche = 'fiche' | 'messages' | 'chiffres' | 'visites' | 'campagnes'
const rubriques: Rubrique<VueFiche>[] = [
  { vue: 'fiche', libelle: 'Fiche', icone: <StorefrontOutlined /> },
  { vue: 'messages', libelle: 'Messages', icone: <ForumOutlined /> },
  { vue: 'chiffres', libelle: 'Chiffres', icone: <QueryStatsOutlined /> },
  { vue: 'visites', libelle: 'Visites', icone: <EventNoteOutlined /> },
  { vue: 'campagnes', libelle: 'Campagnes', icone: <CampaignOutlined /> },
]

function OngletFiche({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const adresse = [m.adresse || [m.codePostal, m.ville].filter(Boolean).join(' '), m.pays].filter(Boolean).join(', ')
  const associes = associesEnPlace(reseau, m)
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
      <Section titre="Mon équipe V and B">
        {contacts(reseau, [m]).map((x) => <Contact key={x.role} role={x.role} p={x.p} />)}
        {!m.coach && <Contact role="Coach" p={null} sousTitre="Aucun Coach affecté à ce jour" />}
      </Section>
      <Section titre="Magasin">
        <Ligne libelle="Ouverture">{m.ouvertureConnue ? dateLongue(m.ouverture) : null}</Ligne>
        <Ligne libelle="Adresse">{adresse}</Ligne>
        <Ligne libelle="Téléphone">{m.telephone && <Link href={telLien(m.telephone)}>{m.telephone}</Link>}</Ligne>
        <Ligne libelle="Email">{m.email && <Link href={`mailto:${m.email}`}>{m.email}</Link>}</Ligne>
        {m.franchise && associes.map((a) => {
          const mandat = mandatActuel(a, reseau.jour)
          return <Ligne key={a.id} libelle="Franchisé associé">{`${a.nom}${mandat?.fin ? ` · mandat jusqu’au ${dateCourte(mandat.fin)}` : ''}`}</Ligne>
        })}
      </Section>
    </Box>
  )
}

function OngletChiffres({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const [tous, setTous] = useState(false)
  const liste = [...chiffresDuMagasin(reseau, m.nom)].reverse()
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
      <SectionChiffresDuMois reseau={reseau} magasins={[m]} />
      <SectionReperes reseau={reseau} magasins={[m]} />
      {liste.length > 0 && (
        <Section titre="Mois enregistrés">
          {(tous ? liste : liste.slice(0, 12)).map((c) => (
            <LigneSimple key={c.mois} titre={libelleMois(c.mois)}
              detail={[`CA ${formatEuros(caDe(c))}`, c.tickets !== null && `Flux ${formatValeur('tickets', c.tickets)}`, c.panier !== null && `Panier ${formatValeur('panier', c.panier)}`, c.marge !== null && `Marge ${formatValeur('marge', c.marge)}`].filter(Boolean).join(' · ')} />
          ))}
          {liste.length > 12 && <Button onClick={() => setTous((v) => !v)} sx={{ minHeight: 48, mt: 0.5 }}>{tous ? 'Afficher moins' : `Voir les ${liste.length} mois`}</Button>}
        </Section>
      )}
    </Box>
  )
}

function OngletVisites({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const vs = visitesDuMagasin(reseau, m.nom)
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
      <Section titre="Visites">
        {!vs.length ? <Vide>Aucune visite enregistrée.</Vide> : vs.map((v) => {
          const faites = v.plan.filter((x) => x.faite).length
          return (
            <Box key={v.id ?? v.date} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 100, flexShrink: 0 }}>{dateCourte(v.date)}</Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body1">{libelleTypeVisite(v.type)}{v.visiteurs.length ? ` · ${nomsVisiteurs(v)}` : ''}</Typography>
                {v.plan.length > 0 && <Typography variant="body2" color="text.secondary">{v.plan.length} action{v.plan.length > 1 ? 's' : ''} au plan · {faites} faite{faites > 1 ? 's' : ''}</Typography>}
                <RangeePhotos photos={v.photos} />
              </Box>
              {v.date > reseau.jour
                ? <Chip size="small" variant="outlined" label="Prévue" sx={pastille} />
                : v.id !== null && <Tooltip title="Compte rendu"><IconButton component={RouterLink} to={lienCompteRendu(v)} aria-label={`Compte rendu du ${dateCourte(v.date)}`}><PictureAsPdfOutlined /></IconButton></Tooltip>}
            </Box>
          )
        })}
      </Section>
      <SectionPlan reseau={reseau} magasins={[m]} />
    </Box>
  )
}

function OngletCampagnes({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const liste = reseau.campagnes.liste.filter((c) => phase(c, reseau.jour) !== 'avenir' && magasinsConcernes(reseau, c).some((x) => x.nom === m.nom))
    .sort((a, b) => b.debut.localeCompare(a.debut))
  if (!liste.length) return <Section titre="Campagnes"><Vide>Aucune campagne ne concerne ce magasin.</Vide></Section>
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
      {liste.map((c) => {
        const e = executionMagasin(reseau.campagnes, c, m.nom)
        const k = reseau.campagnes.constats[c.id]?.[m.nom] ?? {}
        return (
          <Section key={c.id} titre={c.nom} action={<Chip size="small" color={couleurExecution[e]} label={libellesExecution[e]} sx={pastille} />}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{libellesPhase[phase(c, reseau.jour)]} · du {dateCourte(c.debut)} au {dateCourte(c.fin)}</Typography>
            {c.points.map((p) => {
              const x = k[p.id]
              return <LigneSimple key={p.id} titre={p.libelle} detail={x?.date ? `Constaté le ${dateCourte(x.date)}` : undefined}
                fin={<Chip size="small" variant={x ? 'filled' : 'outlined'} color={!x ? 'default' : x.fait ? 'success' : 'error'} label={!x ? 'À constater' : x.fait ? 'Fait' : 'Pas fait'} sx={pastille} />} />
            })}
          </Section>
        )
      })}
    </Box>
  )
}

// Ouvrir l'onglet Visites lit les nouveaux comptes rendus (pas pendant l'aperçu du Directeur de réseau)
function LireVisites({ magasin }: { magasin: string }) {
  const { apercu } = useApercu()
  const { marquerLu, messagerie } = useMessagerie()
  const pret = !!messagerie
  useEffect(() => { if (pret && !apercu) marquerLu(magasin, 'visites') }, [pret, apercu, marquerLu, magasin])
  return null
}

export function FicheMagasinFranchise() {
  const { nom = '' } = useParams()
  const naviguer = useNavigate()
  const { apercu } = useApercu()
  const [confirmation, setConfirmation] = useState('')
  const [params, setParams] = useSearchParams()
  const vue = (rubriques.find((r) => r.vue === params.get('vue'))?.vue ?? 'fiche') as VueFiche
  const changerVue = (v: VueFiche) => setParams((p) => { const n = new URLSearchParams(p); if (v === 'fiche') n.delete('vue'); else n.set('vue', v); return n }, { replace: true })
  const nonLus = useNonLusMagasin(nom)
  const onglets = rubriques.map((r) => (r.vue === 'messages' ? { ...r, pastille: apercu ? 0 : nonLus } : r))
  return (
    <AvecReseau>
      {(reseau) => {
        const m = reseau.magasins.find((x) => x.nom === nom)
        if (!m) return <EmptyState icone={<StorefrontOutlined />} titre="Magasin introuvable" texte="Ce magasin ne fait pas partie de tes magasins." action={<Button variant="contained" onClick={() => naviguer('/magasins')}>Voir mes magasins</Button>} />
        return (
          <>
            {reseau.magasins.length > 1 && <Button startIcon={<ArrowBack />} onClick={() => naviguer('/magasins')} sx={{ mb: 2, ml: -1, minHeight: 48 }}>Mes magasins</Button>}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Typography variant="h1" sx={{ mr: 1 }}>{m.nom}</Typography>
              <PastilleStatut statut={m.statut} />
              <PastilleType franchise={m.franchise} />
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>{[m.ville, m.coach && `Coach ${m.coach}`].filter(Boolean).join(' · ')}</Typography>
            <Onglets valeur={vue} onChange={changerVue} rubriques={onglets} libelle={`Rubriques de ${m.nom}`} />
            {vue === 'fiche' && <OngletFiche reseau={reseau} m={m} />}
            {vue === 'messages' && <SectionMessages reseau={reseau} m={m} signaler={setConfirmation} lectureSeule={!!apercu} />}
            {vue === 'chiffres' && <OngletChiffres reseau={reseau} m={m} />}
            {vue === 'visites' && <><LireVisites magasin={m.nom} /><OngletVisites reseau={reseau} m={m} /></>}
            {vue === 'campagnes' && <OngletCampagnes reseau={reseau} m={m} />}
            <Snackbar open={!!confirmation} autoHideDuration={5000} onClose={() => setConfirmation('')} message={confirmation} />
          </>
        )
      }}
    </AvecReseau>
  )
}

export function PratiquesFranchise() {
  return (
    <>
      <PageHeader titre="Bonnes pratiques" />
      <AvecReseau>{(reseau) => <VuePratiques reseau={reseau} />}</AvecReseau>
    </>
  )
}
