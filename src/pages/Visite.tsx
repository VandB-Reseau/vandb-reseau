// Page d'une visite (refonte vague 3, Joseph 09/11/2026, 24A) : une frise en quatre étapes, Préparer, Sur place,
// Compte rendu, Suivi. Les écrans existaient (fiche avant visite, saisie, compte rendu, tâches) : ils changent de cadre.
import { RemarquesInternes } from '../components/RemarquesInternes'
import { useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import ArrowBack from '@mui/icons-material/ArrowBack'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import RateReviewOutlined from '@mui/icons-material/RateReviewOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { DialogVisite } from '../components/DialogVisite'
import { DialogPlanifier } from '../components/DialogPlanifier'
import { EnvoyerCompteRendu } from '../components/EnvoyerCompteRendu'
import { FeuilleCompteRendu } from '../components/FeuilleCompteRendu'
import { ListeActions } from '../components/Actions'
import { Section } from '../components/Section'
import { Fiche } from './PreparationVisite'
import { styleImpression } from '../components/Feuille'
import { actionsDuMagasin } from '../data/actions'
import { estVisite } from '../data/chiffres'
import { preparationDe } from '../data/semaine'
import { ETAPES_VISITE, etapesVisite, type IdEtapeVisite } from '../data/visites'
import { libelleTypeVisite, nomsVisiteurs, visiteFaite, type Magasin, type Reseau, type Visite } from '../data/modele'
import { PARTIES } from '../data/compteRendu'
import { dateLongue, lienFiche } from '../lib/format'
import { useConversationLaterale } from '../components/ConversationLaterale'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'

// La visite ouverte : celle demandée, sinon la prochaine prévue, sinon la dernière faite
function visiteChoisie(reseau: Reseau, nom: string, id: string | null): Visite | null {
  const du = reseau.visites.filter((v) => v.magasin === nom && estVisite(v))
  if (id) return du.find((v) => String(v.id) === id) ?? null
  const prevue = du.filter((v) => v.prevue && v.date >= reseau.jour).sort((a, b) => a.date.localeCompare(b.date))[0]
  return prevue ?? null
}

export function PageVisite({ etapeParDefaut }: { etapeParDefaut?: IdEtapeVisite }) {
  const { nom = '' } = useParams()
  const naviguer = useNavigate()
  return (
    <AvecReseau>
      {(reseau) => {
        const m = reseau.magasins.find((x) => x.nom === nom)
        if (!m) return <EmptyState icone={<StorefrontOutlined />} titre="Magasin introuvable" texte="Ce magasin a peut-être été renommé ou retiré du réseau." action={<Button variant="contained" onClick={() => naviguer('/magasins')} sx={{ minHeight: 48 }}>Voir les magasins</Button>} />
        return <Parcours reseau={reseau} m={m} etapeParDefaut={etapeParDefaut} />
      }}
    </AvecReseau>
  )
}

function Parcours({ reseau, m, etapeParDefaut }: { reseau: Reseau; m: Magasin; etapeParDefaut?: IdEtapeVisite }) {
  const naviguer = useNavigate()
  const [params, setParams] = useSearchParams()
  const [message, setMessage] = useState('')
  const conversation = useConversationLaterale(reseau, m.nom)
  const [saisie, setSaisie] = useState(false)
  const [planif, setPlanif] = useState(false)
  const v = visiteChoisie(reseau, m.nom, params.get('id'))
  const faite = !!v && visiteFaite(v, reseau.jour)
  const preparee = faite ? null : preparationDe(reseau, m.nom)
  const etats = etapesVisite(v, reseau.jour, preparee)
  const enCours = etats.find((e) => !e.faite)?.id ?? 'suivi'
  const etape = ETAPES_VISITE.find((e) => e.id === params.get('etape'))?.id ?? etapeParDefaut ?? enCours
  const choisir = (e: IdEtapeVisite) => setParams((p) => { const n = new URLSearchParams(p); n.set('etape', e); return n }, { replace: true })
  const actions = v?.id != null ? actionsDuMagasin(reseau, m.nom).filter((x) => x.visite?.id === v.id) : []
  const meta = v ? [dateLongue(v.date), libelleTypeVisite(v.type), nomsVisiteurs(v)].filter(Boolean).join(' · ') : 'Pas encore planifiée'

  let contenu: ReactNode
  if (etape === 'preparer') {
    contenu = (
      <>
        {!faite && (
          <Box className="sans-impression" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Button variant="outlined" startIcon={v ? <EditOutlined /> : <EventAvailableOutlined />} onClick={() => setPlanif(true)} sx={{ minHeight: 48 }}>
              {v ? (preparee?.notes ? 'Modifier mes notes' : 'Écrire mes notes de préparation') : 'Planifier la visite'}
            </Button>
          </Box>
        )}
        <Fiche reseau={reseau} m={m} integre />
      </>
    )
  } else if (etape === 'surplace') {
    contenu = !v ? (
      <EmptyState icone={<EventAvailableOutlined />} titre="Visite à planifier" texte="Pose la date de la visite : la saisie sur place s’ouvrira ici le jour venu."
        action={<Button variant="contained" onClick={() => setPlanif(true)} sx={{ minHeight: 48 }}>Planifier la visite</Button>} />
    ) : !faite ? (
      <Box sx={{ display: 'grid', gap: 2 }}>
        <EmptyState icone={<EventNoteOutlined />} titre={`Visite prévue le ${dateLongue(v.date)}`} texte="Le jour de la visite, saisis la grille, tes notes et tes photos depuis le magasin."
          action={<Button variant="contained" startIcon={<RateReviewOutlined />} onClick={() => setSaisie(true)} sx={{ minHeight: 48 }}>Saisir la visite</Button>} />
        <RemarquesInternes reseau={reseau} magasin={m.nom} visite={v} signaler={setMessage} />
      </Box>
    ) : (
      <Box sx={{ display: 'grid', gap: 2 }}>
      <Section titre="Ce qui a été noté sur place" action={<Button startIcon={<EditOutlined />} onClick={() => setSaisie(true)} sx={{ minHeight: 48 }}>Modifier</Button>}>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {v.notes.trim() ? <Typography sx={{ whiteSpace: 'pre-wrap' }}>{v.notes}</Typography> : <Typography color="text.secondary">Aucune note générale.</Typography>}
          {PARTIES.map((p, i) => ({ titre: p.titre, texte: v.parties[i]?.trim() ?? '' })).filter((p) => p.texte).map((p) => (
            <Box key={p.titre}>
              <Typography variant="body2" color="text.secondary">{p.titre}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{p.texte}</Typography>
            </Box>
          ))}
          {!!v.photos?.length && <Typography variant="body2" color="text.secondary">{`${v.photos.length} photo${v.photos.length > 1 ? 's' : ''}`}</Typography>}
        </Box>
      </Section>
      <RemarquesInternes reseau={reseau} magasin={m.nom} visite={v} signaler={setMessage} />
      </Box>
    )
  } else if (etape === 'compterendu') {
    contenu = !v || !faite || v.id === null ? (
      <EmptyState icone={<RateReviewOutlined />} titre="Pas encore de compte rendu" texte="Le compte rendu se prépare tout seul à partir de la saisie sur place." />
    ) : (
      <>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2, justifyContent: 'flex-end' }} className="sans-impression">
          <EnvoyerCompteRendu reseau={reseau} visite={v} />
          <Button variant="outlined" startIcon={<PictureAsPdfOutlined />} onClick={() => window.print()} sx={{ minHeight: 48 }}>Télécharger en PDF</Button>
        </Box>
        {styleImpression}
        <FeuilleCompteRendu reseau={reseau} v={v} />
      </>
    )
  } else {
    contenu = !v || !faite ? (
      <EmptyState icone={<CheckOutlined />} titre="Rien à suivre pour l’instant" texte="Les actions décidées pendant la visite apparaîtront ici, avec leur avancement." />
    ) : !actions.length ? (
      <EmptyState icone={<CheckOutlined />} titre="Aucune action décidée" texte="Ajoute un plan d’action à la saisie de la visite pour le suivre ici."
        action={<Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setSaisie(true)} sx={{ minHeight: 48 }}>Modifier la visite</Button>} />
    ) : (
      <ListeActions reseau={reseau} actions={actions} signaler={setMessage} libelle="Actions de la visite" magasins={[m.nom]} />
    )
  }

  return (
    <>
      <Box className="sans-impression">
        <Button startIcon={<ArrowBack />} onClick={() => naviguer(lienFiche(m.nom))} sx={{ mb: 1, ml: -1, minHeight: 48 }}>{m.nom}</Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h2" component="h1" sx={{ mb: 0.5, flex: 1, minWidth: 0 }}>{`Visite de ${m.nom}`}</Typography>
          <Button startIcon={<ChatBubbleOutlineOutlined />} onClick={conversation.ouvrir} sx={{ minHeight: 48 }}>Conversation</Button>
        </Box>
        {conversation.panneau}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{meta}</Typography>
        <Box component="nav" aria-label="Étapes de la visite" sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper' }}>
          {etats.map((e, i) => {
            const actif = e.id === etape
            return (
              <ButtonBase key={e.id} onClick={() => choisir(e.id)} aria-current={actif ? 'step' : undefined} aria-label={`${i + 1} ${e.libelle} : ${e.faite ? 'fait' : e.detail}`}
                sx={{ display: 'grid', justifyItems: 'start', alignContent: 'start', gap: 0.25, textAlign: 'left', px: { xs: 1, sm: 2 }, py: 1.25, minHeight: 64, fontFamily: 'inherit',
                  borderLeft: i ? '1px solid' : 0, borderColor: 'divider', bgcolor: e.faite ? 'rgba(48,118,114,0.10)' : e.id === enCours ? 'rgba(248,187,9,0.16)' : undefined,
                  boxShadow: actif ? 'inset 0 -3px 0 #1d1d1b' : undefined }}>
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 700, fontSize: { xs: '0.8125rem', sm: '0.9375rem' } }}>
                  {e.faite ? <CheckOutlined sx={{ fontSize: 16, color: 'success.main' }} /> : <Box component="span" sx={{ color: 'text.secondary' }}>{i + 1}</Box>}
                  {e.libelle}
                </Box>
                <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{e.detail}</Box>
              </ButtonBase>
            )
          })}
        </Box>
      </Box>
      {contenu}
      {saisie && v && <DialogVisite reseau={reseau} visite={v} onFermer={(t) => { setSaisie(false); if (t) setMessage(t) }} />}
      {planif && <DialogPlanifier reseau={reseau} magasins={[m.nom]} dateInitiale={v && v.date >= reseau.jour ? v.date : reseau.jour} visite={v && !faite ? v : null} onFermer={(t) => { setPlanif(false); if (t) setMessage(t) }} />}
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}
