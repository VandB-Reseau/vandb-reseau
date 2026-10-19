import { associesDu, mandatActuel } from '../data/associes'
import { PastilleMandat, periode } from '../components/Associes'
import { PastilleCase } from '../components/Sante'
import { caseDe } from '../data/sante'
import { useState, type ReactNode } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import ArrowBack from '@mui/icons-material/ArrowBack'
import EditOutlined from '@mui/icons-material/EditOutlined'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { DialogDirecteur, DialogFranchise, DialogRR } from '../components/EditionEquipe'
import { PastilleCharge } from '../components/Charge'
import { PastilleStatut } from '../components/Pastilles'
import { TableMagasins } from '../components/TableMagasins'
import { ListeMagasins } from '../components/ListeMagasins'
import { Ligne, Section } from './FicheMagasin'
import { chargeA, magasinsDuCoach } from '../data/charge'
import { ageDepuis, estFrance, fichePersonne, franchises, libelleDepartement, libelleRole, type RefPersonne } from '../data/personnes'
import { dateCourte, dateLongue, lienCoach, lienFiche, lienFranchise, lienRR, telLien } from '../lib/format'
import type { Magasin, Reseau } from '../data/modele'

// Bloc « Fiche personnelle » commun aux quatre rôles
export function SectionFichePersonnelle({ reseau, r, action }: { reseau: Reseau; r: RefPersonne; action?: ReactNode }) {
  const f = fichePersonne(reseau, r)
  const age = ageDepuis(f.naissance, reseau.jour)
  const anciennete = ageDepuis(f.arrivee, reseau.jour)
  const futur = !!f.arrivee && f.arrivee > reseau.jour
  return (
    <Section titre="Fiche personnelle" action={action}>
      <Ligne libelle="Prénom">{f.prenom}</Ligne>
      <Ligne libelle="Nom">{f.nom}</Ligne>
      <Ligne libelle="Date de naissance">{f.naissance && `${dateLongue(f.naissance)}${age !== null ? ` · ${age} ans` : ''}`}</Ligne>
      <Ligne libelle={futur ? 'Arrivée prévue' : 'Date d’arrivée'}>{f.arrivee && `${dateLongue(f.arrivee)}${!futur && anciennete !== null ? (anciennete < 1 ? ' · moins d’un an' : ` · ${anciennete} an${anciennete > 1 ? 's' : ''}`) : ''}`}</Ligne>
      {estFrance(f.pays) && <Ligne libelle="Code postal">{f.codePostal}</Ligne>}
      <Ligne libelle="Département">{f.departement && (estFrance(f.pays) ? libelleDepartement(f.departement) : f.departement)}</Ligne>
      <Ligne libelle="Ville">{f.ville}</Ligne>
      <Ligne libelle="Pays">{f.pays}</Ligne>
      <Ligne libelle="Email">{f.email && <Link href={`mailto:${f.email}`}>{f.email}</Link>}</Ligne>
      <Ligne libelle="Téléphone">{f.telephone && <Link href={telLien(f.telephone)}>{f.telephone}</Link>}</Ligne>
    </Section>
  )
}

function Entete({ retour, titre, sousTitre, onModifier }: { retour?: string; titre: string; sousTitre: string; onModifier: () => void }) {
  const naviguer = useNavigate()
  return (
    <>
      <Button startIcon={<ArrowBack />} onClick={() => (window.history.length > 1 ? naviguer(-1) : naviguer(retour ?? '/equipe'))} sx={{ mb: 2, ml: -1 }}>Équipe</Button>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h1" sx={{ flex: 1 }}>{titre}</Typography>
        <Button variant="outlined" startIcon={<EditOutlined />} onClick={onModifier} sx={{ minHeight: 48 }}>Modifier</Button>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>{sousTitre}</Typography>
    </>
  )
}

const Rangee = ({ children }: { children: ReactNode }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 52, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>{children}</Box>
)

function ListeMagasinsAdaptee({ magasins, vide }: { magasins: Magasin[]; vide: string }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  if (!magasins.length) return <Typography variant="body2" color="text.secondary">{vide}</Typography>
  return surPC ? <TableMagasins magasins={magasins} /> : <ListeMagasins magasins={magasins} />
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

function PageRR({ reseau, id }: { reseau: Reseau; id: string }) {
  const naviguer = useNavigate()
  const [edition, setEdition] = useState(false)
  const [message, setMessage] = useState('')
  const rr = reseau.rrs.find((r) => r.id === id)!
  const coachs = reseau.equipe.filter((c) => c.rr?.id === id)
  const magasins = reseau.magasins.filter((m) => m.rr?.id === id)
  const directs = magasins.filter((m) => m.rrEnDirect)
  const role = rr.integres ? 'Responsable Magasins Intégrés' : libelleRole('rr')
  return (
    <>
      <Entete titre={rr.nom} sousTitre={`${role} · ${pluriel(coachs.length, 'Coach')} · ${pluriel(magasins.length, 'magasin')}`} onModifier={() => setEdition(true)} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start', mb: 2 }}>
        <SectionFichePersonnelle reseau={reseau} r={{ type: 'rr', cle: id }} />
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Section titre="Coachs rattachés">
            {coachs.length === 0 ? <Typography variant="body2" color="text.secondary">Aucun Coach rattaché.</Typography> : coachs.map((c) => (
              <Rangee key={c.nom}>
                <Link component={RouterLink} to={lienCoach(c.nom)} sx={{ flex: 1, py: 1.5, fontWeight: 500 }}>{c.nom}</Link>
                <Typography variant="body2" color="text.secondary">{pluriel(magasinsDuCoach(reseau, c.nom).length, 'magasin')}</Typography>
                <PastilleCharge reseau={reseau} charge={chargeA(reseau, c.nom)} />
              </Rangee>
            ))}
          </Section>
          {directs.length > 0 && (
            <Section titre="Magasins gérés en direct">
              {directs.map((m) => (
                <Rangee key={m.nom}>
                  <Link component={RouterLink} to={lienFiche(m.nom)} sx={{ flex: 1, py: 1.5 }}>{m.nom}</Link>
                  <PastilleStatut statut={m.statut} />
                </Rangee>
              ))}
            </Section>
          )}
        </Box>
      </Box>
      <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>Magasins de son périmètre</Typography>
      <ListeMagasinsAdaptee magasins={magasins} vide="Aucun magasin dans son périmètre." />
      {edition && <DialogRR reseau={reseau} rr={rr} onFermer={(m) => { setEdition(false); if (m?.includes('supprimé')) naviguer('/equipe', { replace: true }); else if (m) setMessage(m) }} />}
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

function PageDirecteur({ reseau }: { reseau: Reseau }) {
  const [edition, setEdition] = useState(false)
  const [message, setMessage] = useState('')
  const d = reseau.directeur
  return (
    <>
      <Entete titre={d.nom} sousTitre={`${d.titre} · ${reseau.rrs.length} ${reseau.rrs.length > 1 ? 'Responsables Régionaux' : 'Responsable Régional'} · ${pluriel(reseau.equipe.length, 'Coach')} · ${pluriel(reseau.magasins.length, 'magasin')}`} onModifier={() => setEdition(true)} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
        <SectionFichePersonnelle reseau={reseau} r={{ type: 'directeur', cle: '' }} />
        <Section titre="Responsables Régionaux">
          {reseau.rrs.map((r) => (
            <Rangee key={r.id}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: r.couleur, flexShrink: 0 }} />
              <Link component={RouterLink} to={lienRR(r.id)} sx={{ flex: 1, py: 1.5, fontWeight: 500 }}>{r.nom}</Link>
              <Typography variant="body2" color="text.secondary">{r.integres ? 'Magasins intégrés' : pluriel(reseau.equipe.filter((c) => c.rr?.id === r.id).length, 'Coach')}</Typography>
            </Rangee>
          ))}
        </Section>
      </Box>
      {edition && <DialogDirecteur reseau={reseau} onFermer={(m) => { setEdition(false); if (m) setMessage(m) }} />}
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

function PageFranchise({ reseau, nom }: { reseau: Reseau; nom: string }) {
  const naviguer = useNavigate()
  const [edition, setEdition] = useState(false)
  const [message, setMessage] = useState('')
  const f = franchises(reseau).find((x) => x.nom === nom)!
  const coachs = [...new Set(f.magasins.map((m) => m.coach).filter(Boolean))]
  return (
    <>
      <Entete retour="/parametres/franchises" titre={nom} sousTitre={`${libelleRole('franchise', f.integresSeulement)} · ${pluriel(f.magasins.length, 'magasin')}${coachs.length ? ` · suivi par ${coachs.join(', ')}` : ''}`} onModifier={() => setEdition(true)} />
      <Box sx={{ mb: 2, maxWidth: { lg: '50%' } }}>
        <SectionFichePersonnelle reseau={reseau} r={{ type: 'franchise', cle: nom }} />
      </Box>
      {f.magasins.some((m) => m.franchise) && (
        <Box sx={{ mb: 2 }}>
          <Section titre="Mandats">
            {f.magasins.filter((m) => m.franchise).map((m) => {
              const a = associesDu(reseau, m).find((x) => x.nom === nom)
              const mandat = a ? mandatActuel(a, reseau.jour) : null
              return (
                <Rangee key={m.nom}>
                  <Box sx={{ flex: 1, minWidth: 0, py: 1 }}>
                    <Link component={RouterLink} to={lienFiche(m.nom)} sx={{ fontWeight: 500 }}>{m.nom}</Link>
                    <Typography variant="body2" color="text.secondary">
                      {[mandat ? `Mandat ${periode(mandat)}` : 'Mandat non renseigné', a && a.mandats.length > 1 && `${a.mandats.length} mandats depuis le ${dateCourte(a.mandats[0].debut || a.mandats[0].fin)}`].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <PastilleCase c={caseDe(reseau.evaluations[m.nom])} />
                    <PastilleMandat m={mandat} jour={reseau.jour} />
                  </Box>
                </Rangee>
              )
            })}
          </Section>
        </Box>
      )}
      <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>Ses magasins</Typography>
      <ListeMagasinsAdaptee magasins={f.magasins} vide="Aucun magasin." />
      {edition && <DialogFranchise reseau={reseau} nom={nom} onFermer={(m, nouveau) => {
        setEdition(false)
        if (!m) return
        if (m.includes('retiré')) { naviguer('/parametres/franchises', { replace: true }); return }
        setMessage(m)
        if (nouveau && nouveau !== nom) naviguer(lienFranchise(nouveau), { replace: true })
      }} />}
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

function Introuvable({ texte }: { texte: string }) {
  const naviguer = useNavigate()
  return <EmptyState icone={<PersonOutlineOutlined />} titre="Personne introuvable" texte={texte} action={<Button variant="contained" onClick={() => naviguer('/equipe')}>Voir toute l’équipe</Button>} />
}

export function FicheRR() {
  const { id = '' } = useParams()
  return <AvecReseau>{(reseau) => reseau.rrs.some((r) => r.id === id) ? <PageRR reseau={reseau} id={id} /> : <Introuvable texte="Ce Responsable Régional n’existe plus. Il a peut-être été supprimé." />}</AvecReseau>
}

export function FicheDirecteur() {
  return <AvecReseau>{(reseau) => <PageDirecteur reseau={reseau} />}</AvecReseau>
}

export function FicheFranchise() {
  const { nom = '' } = useParams()
  const naviguer = useNavigate()
  return (
    <AvecReseau>
      {(reseau) => franchises(reseau).some((f) => f.nom === nom)
        ? <PageFranchise reseau={reseau} nom={nom} />
        : <EmptyState icone={<StorefrontOutlined />} titre="Franchisé introuvable" texte={`Aucun magasin n’est rattaché à « ${nom} ». Le nom a peut-être changé.`} action={<Button variant="contained" onClick={() => naviguer('/parametres/franchises')}>Voir les franchisés</Button>} />}
    </AvecReseau>
  )
}
