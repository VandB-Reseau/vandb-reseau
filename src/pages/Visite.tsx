// Page d'une visite (refonte vague 3, 24A ; vague 7, Joseph 10/11/2026, 80A) : une frise en trois étapes, Préparer (date,
// ordre du jour, notes, fiche avant visite), Visite (la saisie guidée) et Après (compte rendu, signature, tâches).
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
import { EnvoyerCompteRendu } from '../components/EnvoyerCompteRendu'
import { FeuilleCompteRendu } from '../components/FeuilleCompteRendu'
import { ListeActions } from '../components/Actions'
import { Section } from '../components/Section'
import { Fiche } from './PreparationVisite'
import { styleImpression } from '../components/Feuille'
import { actionsDuMagasin } from '../data/actions'
import { estVisite } from '../data/chiffres'
import { preparationDe } from '../data/semaine'
import { etapeDuLien, etapesVisite, type IdEtapeVisite } from '../data/visites'
import { PreparerVisite } from '../components/PreparerVisite'
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
  const v = visiteChoisie(reseau, m.nom, params.get('id'))
  const faite = !!v && visiteFaite(v, reseau.jour)
  const preparee = faite ? null : preparationDe(reseau, m.nom)
  const etats = etapesVisite(v, reseau.jour, preparee)
  const enCours = etats.find((e) => !e.faite)?.id ?? 'suivi'
  const etape = etapeDuLien(params.get('etape')) ?? etapeParDefaut ?? enCours
  const choisir = (e: IdEtapeVisite) => setParams((p) => { const n = new URLSearchParams(p); n.set('etape', e); return n }, { replace: true })
  const ecrit = etats[1].faite
  const actions = v?.id != null ? actionsDuMagasin(reseau, m.nom).filter((x) => x.visite?.id === v.id) : []
  const meta = v ? [dateLongue(v.date), libelleTypeVisite(v.type), nomsVisiteurs(v)].filter(Boolean).join(' · ') : 'Pas encore planifiée'

  let contenu: ReactNode
  if (etape === 'preparer') {
    contenu = (
      <Box sx={{ display: 'grid', gap: 3 }}>
        {!faite && <PreparerVisite key={`${v?.id ?? 'x'}-${v?.date ?? ''}`} reseau={reseau} m={m} v={v} signaler={setMessage} />}
        <Box>
          <Typography component="h2" sx={{ fontWeight: 700, fontSize: '1rem', mb: 1 }} className="sans-impression">Fiche avant visite</Typography>
          <Fiche reseau={reseau} m={m} integre />
        </Box>
      </Box>
    )
  } else if (etape === 'surplace') {
    contenu = !v ? (
      <EmptyState icone={<EventAvailableOutlined />} titre="Visite à planifier" texte="Pose la date dans l’étape Préparer : la saisie s’ouvrira ici le jour venu."
        action={<Button variant="contained" onClick={() => choisir('preparer')} sx={{ minHeight: 48 }}>Préparer la visite</Button>} />
    ) : !faite ? (
      <Box sx={{ display: 'grid', gap: 2 }}>
        <EmptyState icone={<EventNoteOutlined />} titre={v.date <= reseau.jour ? 'C’est le jour de la visite' : `Visite prévue le ${dateLongue(v.date)}`} texte="La saisie suit l’ordre du jour préparé : sujets, plan d’action, constats, chiffres."
          action={<Button variant="contained" startIcon={<RateReviewOutlined />} onClick={() => setSaisie(true)} sx={{ minHeight: 48 }}>Commencer la visite</Button>} />
        <RemarquesInternes reseau={reseau} magasin={m.nom} visite={v} signaler={setMessage} />
      </Box>
    ) : (
      <Box sx={{ display: 'grid', gap: 2 }}>
      <Section titre="Ce qui a été noté pendant la visite" action={<Button startIcon={<EditOutlined />} onClick={() => setSaisie(true)} sx={{ minHeight: 48 }}>{ecrit ? 'Modifier' : 'Écrire le compte rendu'}</Button>}>
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
  } else {
    contenu = !v || !faite || v.id === null ? (
      <EmptyState icone={<RateReviewOutlined />} titre="Pas encore de compte rendu" texte="Le compte rendu se prépare tout seul à partir de la saisie de la visite." />
    ) : (
      <Box sx={{ display: 'grid', gap: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2, alignItems: 'center' }} className="sans-impression">
            <Typography component="h2" sx={{ fontWeight: 700, fontSize: '1rem', mr: 'auto' }}>Compte rendu</Typography>
            <EnvoyerCompteRendu reseau={reseau} visite={v} />
            <Button variant="outlined" startIcon={<PictureAsPdfOutlined />} onClick={() => window.print()} sx={{ minHeight: 48 }}>Télécharger en PDF</Button>
          </Box>
          {styleImpression}
          <FeuilleCompteRendu reseau={reseau} v={v} />
        </Box>
        <Box className="sans-impression">
          {actions.length
            ? <ListeActions reseau={reseau} actions={actions} signaler={setMessage} libelle="Tâches décidées pendant la visite" magasins={[m.nom]} />
            : <EmptyState icone={<CheckOutlined />} titre="Aucune tâche décidée" texte="Les tâches ajoutées pendant la visite se suivent ici."
                action={<Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setSaisie(true)} sx={{ minHeight: 48 }}>Modifier la visite</Button>} />}
        </Box>
      </Box>
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
        <Box component="nav" aria-label="Étapes de la visite" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper' }}>
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
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}
