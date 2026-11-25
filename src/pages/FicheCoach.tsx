import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useDroits } from '../auth/Droits'
import { useMemo, useState } from 'react'
import Snackbar from '@mui/material/Snackbar'
import { DialogCoach } from '../components/EditionEquipe'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { ListeMagasins } from '../components/ListeMagasins'
import { Contact, Section, LigneVide } from '../components/Section'
import { chargeA, magasinsDuCoach } from '../data/charge'
import { dateCourte, lienCoach, lienFiche, lienRR } from '../lib/format'
import { SectionFichePersonnelle } from './FichePersonne'
import { SectionAccesEquipe } from '../components/AccesEquipe'
import { libelleTypeVisite, visiteFaite, type Coach, type Reseau } from '../data/modele'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import { ContenuOnglet, Onglets, type Rubrique } from '../components/Onglets'
import { BoutonAjouterAction, ListeActions } from '../components/Actions'
import { BilanCampagnes } from '../components/Campagnes'
import { actionsDes, enRetard } from '../data/actions'
import { anneeDe, lienCompteRendu, suiviRythme, type LigneRythme } from '../data/visites'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import { OngletEntretiens } from '../components/Entretiens'
import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import { BlocPortefeuille, ProfilPersonne } from '../components/Portefeuille'
import { portefeuilleDe } from '../data/portefeuille'
import { lienPersonne } from '../data/messagerie'
import { departDe, fichePersonne } from '../data/personnes'
import { BoutonDepart } from '../components/DepartCollaborateur'
import { FilAriane } from '../components/FilAriane'
import { CartesTachesEquipe, EnsembleEquipe, GrapheVisitesEquipe, LignesPasVus, TableauMagasinsEquipe, libelleMoisAnnee } from '../components/FicheEquipe'

// Vague 3 (Joseph, 09/11/2026, 28A) : fiche d'une personne au gabarit de la fiche magasin, trois onglets.
// Les anciennes adresses (?vue=portefeuille|fiche|visites|actions|campagnes) mènent au bon onglet.
type VueCoach = 'ensemble' | 'magasins' | 'activite' | 'entretiens'
const rubriquesCoach: Rubrique<VueCoach>[] = [
  { vue: 'ensemble', libelle: 'Vue d’ensemble', icone: <InsightsOutlined /> },
  { vue: 'magasins', libelle: 'Magasins', icone: <StorefrontOutlined /> },
  { vue: 'activite', libelle: 'Activité', icone: <EventNoteOutlined /> },
  { vue: 'entretiens', libelle: 'Entretiens', icone: <ForumOutlined /> },
]
const anciennesVues: Record<string, VueCoach> = { portefeuille: 'ensemble', fiche: 'ensemble', visites: 'activite', actions: 'activite', campagnes: 'activite' }

function Fiche({ coach, reseau }: { coach: Coach; reseau: Reseau }) {
  const naviguer = useNavigate()
  const [params, setParams] = useSearchParams()
  const demandee = params.get('vue') ?? ''
  const vue = (rubriquesCoach.find((r) => r.vue === demandee)?.vue ?? anciennesVues[demandee] ?? 'ensemble') as VueCoach
  const changerVue = (v: VueCoach) => setParams((p) => { const n = new URLSearchParams(p); if (v === 'ensemble') n.delete('vue'); else n.set('vue', v); return n }, { replace: true })
  const [edition, setEdition] = useState(false)
  const [message, setMessage] = useState('')
  // Vitesse (comme #261) : chaque calcul ne se refait que si les données ou le Coach changent, pas à chaque affichage
  const magasins = useMemo(() => magasinsDuCoach(reseau, coach.nom), [reseau, coach.nom])
  const noms = useMemo(() => new Set(magasins.map((m) => m.nom)), [magasins])
  const charge = useMemo(() => chargeA(reseau, coach.nom), [reseau, coach.nom])
  const a = anneeDe(reseau.jour)
  const rythme = useMemo(() => suiviRythme(reseau, anneeDe(reseau.jour)).filter((l) => noms.has(l.magasin.nom)), [reseau, noms])
  const aVoir = useMemo(() => {
    const ecart = (l: LigneRythme) => (l.depuis === null ? Infinity : l.depuis - l.delai)
    return rythme.filter((l) => l.alerte).sort((x, y) => ecart(y) - ecart(x))
  }, [rythme])
  const visites = useMemo(() => reseau.visites.filter((v) => visiteFaite(v, reseau.jour) && (v.visiteurs.includes(coach.nom) || (noms.has(v.magasin) && !v.visiteurs.length)))
    .sort((x, y) => y.date.localeCompare(x.date)), [reseau, coach.nom, noms])
  const [toutes, setToutes] = useState(false)
  const [moisChoisi, setMoisChoisi] = useState<string | null>(null)
  const { referentiels } = useDroits()
  const depart = departDe(reseau, { type: 'coach', cle: coach.nom })
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const actions = useMemo(() => actionsDes(reseau, noms), [reseau, noms])
  const retards = useMemo(() => actions.filter((x) => !x.a.faite && enRetard(x.a, reseau.jour)).length, [actions, reseau.jour])
  const p = useMemo(() => portefeuilleDe(reseau, magasins.filter((m) => m.statut !== 'avenir'), rythme), [reseau, magasins, rythme])
  const faitesAn = p.visitesFaites, referenceAn = p.visitesReference
  const listees = useMemo(() => (moisChoisi ? visites.filter((v) => v.date.startsWith(moisChoisi)) : visites), [visites, moisChoisi])
  return (
    <>
      <FilAriane pcSeulement etapes={[{ libelle: 'Équipe', lien: '/equipe' }]} ici={coach.nom} />
      <ProfilPersonne retour={{ libelle: 'Équipe', aller: () => (window.history.length > 1 ? naviguer(-1) : naviguer('/equipe')) }} nom={coach.nom} lignes={[['Coach', coach.rr?.nom].filter(Boolean).join(' · ')]}
        pastille={depart ? { ton: depart < reseau.jour ? 'gris' : 'orange', libelle: `${depart < reseau.jour ? 'Parti' : 'Part'} le ${dateCourte(depart)}` } : retards ? { ton: 'rouge', libelle: `${retards} tâche${retards > 1 ? 's' : ''} en retard` } : null}
        actions={surPC && referentiels && !coach.fictif ? <BoutonDepart reseau={reseau} personne={{ type: 'coach', cle: coach.nom }} nom={coach.nom} signaler={setMessage} /> : undefined}
        compteurs={[
          { valeur: magasins.length, libelle: magasins.length > 1 ? 'magasins' : 'magasin' },
          { valeur: faitesAn, libelle: `visites ${a.court}` },
          { valeur: `${charge}/${reseau.parametres.maxUnits}`, libelle: 'charge', couleur: charge > reseau.parametres.maxUnits ? 'error.main' : undefined },
        ]}
        telephone={fichePersonne(reseau, { type: 'coach', cle: coach.nom }).telephone || coach.telephone} lienMessage={coach.fictif ? undefined : lienPersonne(`coach:${coach.nom}`)} modifier={referentiels ? () => setEdition(true) : undefined} />
      <Onglets valeur={vue} onChange={changerVue} rubriques={rubriquesCoach} libelle={`Rubriques de ${coach.nom}`} fiche />
      <ContenuOnglet>

        {vue === 'ensemble' && (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' }, alignItems: 'start' }}>
            <EnsembleEquipe reseau={reseau} magasins={magasins} rythme={rythme} p={p} carte={<BlocPortefeuille reseau={reseau} p={p} />} />
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Section titre="Rattachement">
                <Contact role={coach.rr?.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional'} p={coach.rr} lien={coach.rr ? lienRR(coach.rr.id) : undefined} sousTitre={coach.rr ? undefined : 'Non rattaché à ce jour'} />
              </Section>
              <SectionFichePersonnelle reseau={reseau} r={{ type: 'coach', cle: coach.nom }} />
              {!surPC && referentiels && !coach.fictif && <BoutonDepart bouton reseau={reseau} personne={{ type: 'coach', cle: coach.nom }} nom={coach.nom} signaler={setMessage} />}
              {referentiels && !coach.fictif && <SectionAccesEquipe role="coach" cle={coach.nom} nom={coach.nom} signaler={setMessage} />}
            </Box>
          </Box>
        )}

        {vue === 'magasins' && (magasins.length === 0
          ? <LigneVide>Aucun magasin affecté aujourd’hui.</LigneVide>
          : surPC ? <TableauMagasinsEquipe reseau={reseau} magasins={magasins} rythme={rythme} actions={actions} /> : <ListeMagasins magasins={magasins} />)}

        {vue === 'activite' && <Box sx={{ display: 'grid', gap: 2 }}>
          <CartesTachesEquipe reseau={reseau} actions={actions} />
          <Section titre="Tâches en cours de ses magasins" action={<BoutonAjouterAction reseau={reseau} magasins={[...noms].sort()} signaler={setMessage} />}><ListeActions reseau={reseau} actions={actions} avecMagasin signaler={setMessage} libelle={`Tâches en cours des magasins de ${coach.nom}`} magasins={[...noms]} /></Section>
          {visites.length > 0 && <GrapheVisitesEquipe reseau={reseau} visites={visites} larges={surPC} moisChoisi={moisChoisi} choisir={setMoisChoisi} />}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
            <Section titre="Pas vus depuis longtemps">
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{faitesAn} visite{faitesAn > 1 ? 's' : ''} en {a.court} · référence nine box {referenceAn}</Typography>
              {aVoir.length === 0 ? <Typography variant="body2" color="text.secondary">Tous ses magasins ont été vus dans le délai de leur case.</Typography> : <LignesPasVus lignes={aVoir} />}
            </Section>
            <Section titre="Dernières visites" action={moisChoisi ? <Button onClick={() => setMoisChoisi(null)} sx={{ minHeight: 48 }}>Tous les mois</Button> : undefined}>
              {moisChoisi && <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{`${listees.length} visite${listees.length > 1 ? 's' : ''} en ${libelleMoisAnnee(moisChoisi)}`}</Typography>}
              {listees.length === 0 ? <LigneVide>{moisChoisi ? 'Aucune visite ce mois-là.' : 'Aucune visite enregistrée.'}</LigneVide> : (toutes ? listees : listees.slice(0, 12)).map((v) => (
                <Box key={v.id ?? `${v.magasin}-${v.date}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                  <Typography variant="body2" color="text.secondary" sx={{ width: 100, flexShrink: 0 }}>{dateCourte(v.date)}</Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Link component={RouterLink} to={lienFiche(v.magasin)} sx={{ fontWeight: 500 }}>{v.magasin}</Link>
                    <Typography variant="body2" color="text.secondary">{libelleTypeVisite(v.type)}</Typography>
                  </Box>
                  <Tooltip title="Compte rendu PDF"><IconButton component={RouterLink} to={lienCompteRendu(v)} aria-label={`Compte rendu de ${v.magasin} du ${dateCourte(v.date)}`}><PictureAsPdfOutlined /></IconButton></Tooltip>
                </Box>
              ))}
              {listees.length > 12 && <Button onClick={() => setToutes((x) => !x)} sx={{ minHeight: 48, mt: 0.5 }}>{toutes ? 'Afficher moins' : `Voir les ${listees.length} visites`}</Button>}
            </Section>
          </Box>
          <Section titre="Campagnes"><BilanCampagnes reseau={reseau} magasins={magasins} /></Section>
        </Box>}
        {vue === 'entretiens' && <OngletEntretiens reseau={reseau} coach={coach} signaler={setMessage} />}
        {edition && <DialogCoach reseau={reseau} coach={coach} onFermer={(m, nom) => { setEdition(false); if (m?.includes('retiré')) naviguer('/equipe'); else if (m) { setMessage(m); if (nom && nom !== coach.nom) naviguer(lienCoach(nom), { replace: true }) } }} />}
        <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
      </ContenuOnglet>
    </>
  )
}

export function FicheCoach() {
  const { nom = '' } = useParams()
  const naviguer = useNavigate()
  return (
    <AvecReseau>
      {(reseau) => {
        const coach = reseau.equipe.find((c) => c.nom === nom) ?? reseau.anciens?.coachs.find((c) => c.nom === nom)
        if (!coach) return <EmptyState icone={<PersonOutlineOutlined />} titre="Coach introuvable" texte={`Aucun Coach ne s’appelle « ${nom} ».`} action={<Button variant="contained" onClick={() => naviguer('/equipe')}>Voir toute l’équipe</Button>} />
        return <Fiche coach={coach} reseau={reseau} />
      }}
    </AvecReseau>
  )
}
