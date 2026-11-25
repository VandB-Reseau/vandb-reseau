import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useDroits } from '../auth/Droits'
import { associesDu, mandatEffectif } from '../data/associes'
import { SectionAcces } from '../components/AccesFranchise'
import { SectionAccesEquipe } from '../components/AccesEquipe'
import { useAuth } from '../auth/AuthContext'
import { PastilleMandat, periode } from '../components/Associes'
import { PastilleCase } from '../components/Sante'
import { caseDe } from '../data/sante'
import { useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import { RevueRR } from '../components/RevueRR'
import { ContenuOnglet, Onglets, type Rubrique } from '../components/Onglets'
import { BlocPortefeuille, ProfilPersonne, rond } from '../components/Portefeuille'
import { portefeuilleDe } from '../data/portefeuille'
import { lienPersonne } from '../data/messagerie'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import EditOutlined from '@mui/icons-material/EditOutlined'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { echelle } from '../theme/theme'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { DialogDirecteur, DialogFranchise, DialogRR } from '../components/EditionEquipe'
import { PastilleStatut } from '../components/Pastilles'
import { ListeMagasins } from '../components/ListeMagasins'
import { Ligne, Section, LigneVide } from '../components/Section'
import { SectionEngagement } from '../components/Engagement'
import { useEngagement } from '../data/engagement'
import { chargeA, magasinsDuCoach } from '../data/charge'
import { BoutonDepart } from '../components/DepartCollaborateur'
import { ageDepuis, departDe, estFrance, fichePersonne, franchises, libelleDepartement, libelleRole, type RefPersonne } from '../data/personnes'
import { dateCourte, dateLongue, lienCoach, lienFiche, lienFranchise, lienRR, telLien } from '../lib/format'
import type { Magasin, Reseau } from '../data/modele'
import { cartouche } from '../components/Social'
import { FilAriane } from '../components/FilAriane'
import { EnsembleEquipe, LignesCoachs, TableauMagasinsEquipe } from '../components/FicheEquipe'
import { anneeDe, suiviRythme } from '../data/visites'
import { actionsDes } from '../data/actions'

// Bloc « Fiche personnelle » commun aux quatre rôles
export function SectionFichePersonnelle({ reseau, r, action, titre = 'Fiche personnelle' }: { reseau: Reseau; r: RefPersonne; action?: ReactNode; titre?: string }) {
  const f = fichePersonne(reseau, r)
  const age = ageDepuis(f.naissance, reseau.jour)
  const anciennete = ageDepuis(f.arrivee, reseau.jour)
  const futur = !!f.arrivee && f.arrivee > reseau.jour
  const champs: [string, ReactNode][] = [
    ['Prénom', f.prenom],
    ['Nom', f.nom],
    ['Date de naissance', f.naissance && `${dateLongue(f.naissance)}${age !== null ? ` · ${age} ans` : ''}`],
    [futur ? 'Arrivée prévue' : 'Date d’arrivée', f.arrivee && `${dateLongue(f.arrivee)}${!futur && anciennete !== null ? (anciennete < 1 ? ' · moins d’un an' : ` · ${anciennete} an${anciennete > 1 ? 's' : ''}`) : ''}`],
    ...(estFrance(f.pays) ? [['Code postal', f.codePostal] as [string, ReactNode]] : []),
    ['Département', f.departement && (estFrance(f.pays) ? libelleDepartement(f.departement) : f.departement)],
    ['Ville', f.ville],
    ['Pays', f.pays],
    ['Email', f.email && <Link href={`mailto:${f.email}`}>{f.email}</Link>],
    ['Téléphone', f.telephone && <Link href={telLien(f.telephone)}>{f.telephone}</Link>],
  ]
  const vides = champs.filter(([, v]) => !v).length
  return (
    // 315 (18/11/2026) : les champs vides ne prennent plus une ligne chacun, ils se comptent en une seule
    <Section titre={titre} action={action}>
      {champs.map(([libelle, valeur]) => <Ligne key={libelle} libelle={libelle} compacte>{valeur}</Ligne>)}
      {vides > 0 && <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>{vides} information{vides > 1 ? 's' : ''} à compléter</Typography>}
    </Section>
  )
}

// Joseph (25/11/2026) : sur la fiche d'un Coach ou d'un RR, la fiche personnelle s'ouvre par le picto (i) de l'en-tête,
// dans un panneau à droite, comme « Infos du magasin »
export function BoutonFichePersonnelle({ reseau, r }: { reseau: Reseau; r: RefPersonne }) {
  const [ouvert, setOuvert] = useState(false)
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  return (
    <>
      {surPC
        ? <Button variant="outlined" startIcon={<InfoOutlined />} onClick={() => setOuvert(true)} sx={{ minHeight: 48, borderRadius: 999, whiteSpace: 'nowrap', ml: 0.5 }}>Fiche personnelle</Button>
        : <Tooltip title="Fiche personnelle"><IconButton onClick={() => setOuvert(true)} aria-label="Fiche personnelle" sx={rond}><InfoOutlined /></IconButton></Tooltip>}
      <Drawer anchor="right" open={ouvert} onClose={() => setOuvert(false)} sx={{ zIndex: (t) => t.zIndex.modal }}
        slotProps={{ paper: { role: 'dialog', 'aria-label': 'Fiche personnelle', sx: { width: { xs: '100%', sm: 440 }, bgcolor: 'background.default' } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Typography component="h2" sx={{ fontWeight: 700, fontSize: echelle.section, mr: 'auto' }}>Fiche personnelle</Typography>
          <IconButton onClick={() => setOuvert(false)} aria-label="Fermer" sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
        </Box>
        <Box sx={{ p: 2 }}><SectionFichePersonnelle reseau={reseau} r={r} titre="Informations" /></Box>
      </Drawer>
    </>
  )
}

function Entete({ retour, titre, sousTitre, onModifier }: { retour?: string; titre: string; sousTitre: string; onModifier: () => void }) {
  const { referentiels } = useDroits()
  return (
    <>
      <FilAriane etapes={[{ libelle: 'Équipe', lien: retour ?? '/equipe' }]} ici={titre} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h1" sx={{ flex: 1 }}>{titre}</Typography>
        {referentiels && <Button variant="outlined" startIcon={<EditOutlined />} onClick={onModifier} sx={{ minHeight: 48 }}>Modifier</Button>}
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>{sousTitre}</Typography>
    </>
  )
}

const Rangee = ({ children }: { children: ReactNode }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 52, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>{children}</Box>
)

function ListeMagasinsAdaptee({ magasins, vide }: { magasins: Magasin[]; vide: string }) {
  if (!magasins.length) return <Typography variant="body2" color="text.secondary">{vide}</Typography>
  return <ListeMagasins magasins={magasins} />
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

// Vague 3 (Joseph, 09/11/2026, 28A) : même gabarit que la fiche du Coach, trois onglets ; anciennes adresses reprises
type VueRR = 'ensemble' | 'magasins' | 'activite'
const rubriquesRR: Rubrique<VueRR>[] = [
  { vue: 'ensemble', libelle: 'Vue d’ensemble', icone: <InsightsOutlined /> },
  { vue: 'magasins', libelle: 'Coachs et magasins', court: 'Magasins', icone: <StorefrontOutlined /> },
  { vue: 'activite', libelle: 'Revue du mois', court: 'Revue', icone: <EventNoteOutlined /> },
]
const anciennesVuesRR: Record<string, VueRR> = { portefeuille: 'ensemble', fiche: 'ensemble', coachs: 'magasins', revue: 'activite' }

function PageRR({ reseau, id }: { reseau: Reseau; id: string }) {
  const naviguer = useNavigate()
  const [params, setParams] = useSearchParams()
  const demandee = params.get('vue') ?? ''
  const vue = (rubriquesRR.find((r) => r.vue === demandee)?.vue ?? anciennesVuesRR[demandee] ?? 'ensemble') as VueRR
  const changerVue = (v: VueRR) => setParams((p) => { const n = new URLSearchParams(p); n.delete('mois'); if (v === 'ensemble') n.delete('vue'); else n.set('vue', v); return n }, { replace: true })
  const [edition, setEdition] = useState(false)
  const [message, setMessage] = useState('')
  const rr = (reseau.rrs.find((r) => r.id === id) ?? reseau.anciens?.rrs.find((r) => r.id === id))!
  const depart = departDe(reseau, { type: 'rr', cle: id })
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  // Vitesse (comme #261) : listes et calculs gardés tant que les données ne changent pas (le portefeuille était refait à chaque affichage)
  const coachs = useMemo(() => reseau.equipe.filter((c) => c.rr?.id === id), [reseau, id])
  const magasins = useMemo(() => reseau.magasins.filter((m) => m.rr?.id === id), [reseau, id])
  const directs = useMemo(() => magasins.filter((m) => m.rrEnDirect), [magasins])
  const role = rr.integres ? 'Responsable Magasins Intégrés' : libelleRole('rr')
  const { referentiels } = useDroits()
  const noms = useMemo(() => new Set(magasins.map((m) => m.nom)), [magasins])
  const rythmeAn = useMemo(() => suiviRythme(reseau, anneeDe(reseau.jour)), [reseau])
  const rythme = useMemo(() => rythmeAn.filter((l) => noms.has(l.magasin.nom)), [rythmeAn, noms])
  const p = useMemo(() => portefeuilleDe(reseau, magasins.filter((m) => m.statut !== 'avenir'), rythme), [reseau, magasins, rythme])
  const actions = useMemo(() => actionsDes(reseau, noms), [reseau, noms])
  // 418 : chaque Coach rattaché avec sa charge et son rythme de visite de l'année
  const lignesCoachs = useMemo(() => coachs.map((c) => {
    const ms = new Set(magasinsDuCoach(reseau, c.nom).map((m) => m.nom))
    const l = rythmeAn.filter((x) => ms.has(x.magasin.nom))
    return { nom: c.nom, lien: lienCoach(c.nom), magasins: ms.size, charge: chargeA(reseau, c.nom), faites: l.reduce((t, x) => t + x.faites, 0), reference: l.reduce((t, x) => t + x.reference, 0) }
  }), [reseau, coachs, rythmeAn])
  return (
    <>
      <FilAriane pcSeulement etapes={[{ libelle: 'Équipe', lien: '/equipe' }]} ici={rr.nom} />
      <ProfilPersonne retour={{ libelle: 'Équipe', aller: () => (window.history.length > 1 ? naviguer(-1) : naviguer('/equipe')) }} nom={rr.nom} lignes={[role]}
        pastille={depart ? { ton: depart < reseau.jour ? 'gris' : 'orange', libelle: `${depart < reseau.jour ? 'Parti' : 'Part'} le ${dateCourte(depart)}` } : p.decroche ? { ton: 'rouge', libelle: `${p.decroche} magasin${p.decroche > 1 ? 's' : ''} en Décroche` } : null}
        actions={surPC && referentiels ? <BoutonDepart reseau={reseau} personne={{ type: 'rr', cle: id }} nom={rr.nom} signaler={setMessage} /> : undefined}
        compteurs={[
          { valeur: coachs.length, libelle: coachs.length > 1 ? 'Coachs' : 'Coach' },
          { valeur: magasins.length, libelle: magasins.length > 1 ? 'magasins' : 'magasin' },
          { valeur: p.visitesFaites, libelle: `visites ${reseau.jour.slice(0, 4)}` },
        ]}
        icones={<BoutonFichePersonnelle reseau={reseau} r={{ type: 'rr', cle: id }} />}
        telephone={fichePersonne(reseau, { type: 'rr', cle: id }).telephone || rr.telephone} lienMessage={lienPersonne(`rr:${id}`)} modifier={referentiels ? () => setEdition(true) : undefined} />
      <Onglets valeur={vue} onChange={changerVue} rubriques={rubriquesRR} libelle={`Rubriques de ${rr.nom}`} fiche />
      <ContenuOnglet>
        {vue === 'ensemble' && (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' }, alignItems: 'start' }}>
            <EnsembleEquipe reseau={reseau} magasins={magasins} rythme={rythme} p={p} carte={<BlocPortefeuille reseau={reseau} p={p} />} />
            <Box sx={{ display: 'grid', gap: 2 }}>
              {!surPC && referentiels && <BoutonDepart bouton reseau={reseau} personne={{ type: 'rr', cle: id }} nom={rr.nom} signaler={setMessage} />}
              {referentiels && <SectionAccesEquipe role="rr" cle={id} nom={rr.nom} signaler={setMessage} />}
            </Box>
          </Box>
        )}
        {vue === 'activite' && <RevueRR reseau={reseau} nom={rr.nom} magasins={magasins} />}
        {vue === 'magasins' && <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
            <Section titre="Coachs rattachés">
              {coachs.length === 0 ? <LigneVide>Aucun Coach rattaché.</LigneVide> : <LignesCoachs reseau={reseau} coachs={lignesCoachs} />}
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
          {surPC && magasins.length > 0
            ? <TableauMagasinsEquipe reseau={reseau} magasins={magasins} rythme={rythme} actions={actions} avecCoach />
            : <ListeMagasinsAdaptee magasins={magasins} vide="Aucun magasin dans son périmètre." />}
        </Box>}
        {edition && <DialogRR reseau={reseau} rr={rr} onFermer={(m) => { setEdition(false); if (m?.includes('supprimé')) naviguer('/equipe', { replace: true }); else if (m) setMessage(m) }} />}
        <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
      </ContenuOnglet>
    </>
  )
}

function PageDirecteur({ reseau }: { reseau: Reseau }) {
  const [edition, setEdition] = useState(false)
  const [message, setMessage] = useState('')
  const d = reseau.directeur
  const naviguer = useNavigate()
  const { referentiels } = useDroits()
  return (
    <>
      {/* 317 (Joseph, 18/11/2026) : même en-tête que les fiches Coach et Responsable Régional */}
      <FilAriane pcSeulement etapes={[{ libelle: 'Équipe', lien: '/equipe' }]} ici={d.nom} />
      <ProfilPersonne retour={{ libelle: 'Équipe', aller: () => (window.history.length > 1 ? naviguer(-1) : naviguer('/equipe')) }} nom={d.nom} lignes={[d.titre]}
        compteurs={[
          { valeur: reseau.rrs.length, libelle: reseau.rrs.length > 1 ? 'Responsables Régionaux' : 'Responsable Régional' },
          { valeur: reseau.equipe.length, libelle: reseau.equipe.length > 1 ? 'Coachs' : 'Coach' },
          { valeur: reseau.magasins.length, libelle: reseau.magasins.length > 1 ? 'magasins' : 'magasin' },
        ]}
        telephone={fichePersonne(reseau, { type: 'directeur', cle: '' }).telephone} modifier={referentiels ? () => setEdition(true) : undefined} />
      <Box sx={{ mt: 2 }} />
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
  const { profil } = useAuth()
  const { referentiels } = useDroits()
  const [edition, setEdition] = useState(false)
  const [message, setMessage] = useState('')
  const f = franchises(reseau).find((x) => x.nom === nom)!
  const coachs = [...new Set(f.magasins.map((m) => m.coach).filter(Boolean))]
  const engagement = useEngagement(reseau)
  return (
    <>
      <Entete retour="/equipe?vue=franchises" titre={nom} sousTitre={`${libelleRole('franchise', f.integresSeulement)} · ${pluriel(f.magasins.length, 'magasin')}${coachs.length ? ` · suivi par ${coachs.join(', ')}` : ''}`} onModifier={() => setEdition(true)} />
      <Box sx={{ mb: 2, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
        {engagement && <SectionEngagement e={engagement(nom, f.magasins.map((m) => m.nom))} jour={reseau.jour} lectures={profil?.role !== 'coach'} />}
        <SectionFichePersonnelle reseau={reseau} r={{ type: 'franchise', cle: nom }} />
        {profil?.role === 'directeur' && referentiels && <SectionAcces nom={nom} magasins={f.magasins.map((m) => m.nom)} emailFiche={fichePersonne(reseau, { type: 'franchise', cle: nom }).email} signaler={setMessage} />}
      </Box>
      {f.magasins.some((m) => m.franchise) && (
        <Box sx={{ mb: 2 }}>
          <Section titre="Mandats">
            {f.magasins.filter((m) => m.franchise).map((m) => {
              const a = associesDu(reseau, m).find((x) => x.nom === nom)
              const x = a ? mandatEffectif(reseau, m, a) : null
              const mandat = x?.mandat ?? null
              return (
                <Rangee key={m.nom}>
                  <Box sx={{ flex: 1, minWidth: 0, py: 1 }}>
                    <Link component={RouterLink} to={lienFiche(m.nom)} sx={{ fontWeight: 500 }}>{m.nom}</Link>
                    <Typography variant="body2" color="text.secondary">
                      {[mandat ? `Mandat ${periode(mandat)}` : 'Mandat non renseigné', x?.calcule && (x.numero === 1 ? '1er mandat' : `${x.numero}e mandat`), a && a.mandats.length > 1 && `${a.mandats.length} mandats depuis le ${dateCourte(a.mandats[0].debut || a.mandats[0].fin)}`].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <PastilleCase c={caseDe(reseau.evaluations[m.nom])} />
                    <PastilleMandat e={x?.etat ?? null} />
                  </Box>
                </Rangee>
              )
            })}
          </Section>
        </Box>
      )}
      <Typography component="h2" sx={[cartouche, { mb: 1.5 }]}>Ses magasins</Typography>
      <ListeMagasinsAdaptee magasins={f.magasins} vide="Aucun magasin." />
      {edition && <DialogFranchise reseau={reseau} nom={nom} onFermer={(m, nouveau) => {
        setEdition(false)
        if (!m) return
        if (m.includes('retiré')) { naviguer('/equipe?vue=franchises', { replace: true }); return }
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
  return <AvecReseau>{(reseau) => [...reseau.rrs, ...(reseau.anciens?.rrs ?? [])].some((r) => r.id === id) ? <PageRR reseau={reseau} id={id} /> : <Introuvable texte="Ce Responsable Régional n’existe plus. Il a peut-être été supprimé." />}</AvecReseau>
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
        : <EmptyState icone={<StorefrontOutlined />} titre="Franchisé introuvable" texte={`Aucun magasin n’est rattaché à « ${nom} ». Le nom a peut-être changé.`} action={<Button variant="contained" onClick={() => naviguer('/equipe?vue=franchises')}>Voir les franchisés</Button>} />}
    </AvecReseau>
  )
}
