// Liste des actions de la personne connectée : celles de ses magasins (tout le réseau pour le Directeur),
// à faire puis faites, avec qui les a faites et quand.
import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { BoutonAjouterAction, DialogAction, LigneAction, useEcritureActions } from '../components/Actions'
import { ChoixVue } from './Accueil'
import { useAuth } from '../auth/AuthContext'
import { useReseau } from '../data/ReseauContext'
import { actionsDes, enRetard, type ActionSuivie } from '../data/actions'
import { cleVue, lireVue, magasinsDu, perimetreDuProfil, type Perimetre } from '../data/perimetre'
import type { Reseau } from '../data/modele'
import { ErreurAction } from '../data/espaceFranchise'

const FAITES_VISIBLES = 10

function Bloc({ titre, nombre, couleur, children }: { titre: string; nombre: number; couleur: 'error' | 'success'; children: ReactNode }) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h3" component="h2">{titre}</Typography>
          <Chip size="small" color={nombre ? couleur : 'default'} label={nombre} sx={{ fontSize: 12, fontWeight: 700, minWidth: 28 }} />
        </Box>
        {children}
      </CardContent>
    </Card>
  )
}

function Liste({ reseau, p, signaler }: { reseau: Reseau; p: Perimetre; signaler: (m: string) => void }) {
  const { recharger } = useReseau()
  const ecriture = useEcritureActions(reseau)
  const [magasin, setMagasin] = useState<string | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [toutesFaites, setToutesFaites] = useState(false)
  const [edition, setEdition] = useState<ActionSuivie | null>(null)
  const noms = magasinsDu(reseau, p).map((m) => m.nom)
  const choix = magasin && noms.includes(magasin) ? magasin : null
  const actions = actionsDes(reseau, new Set(choix ? [choix] : noms))
  const aFaire = actions.filter((x) => !x.a.faite)
  const faites = actions.filter((x) => x.a.faite)
  const cocher = async (x: ActionSuivie, faite: boolean) => {
    setEnCours(x.cle)
    try {
      await ecriture.cocher(x, faite)
      await recharger()
      signaler(faite ? 'Action marquée faite.' : 'Action remise à faire.')
    } catch (e) { signaler(e instanceof ErreurAction ? e.message : 'L’action n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.') }
    finally { setEnCours(null) }
  }
  const ligne = (x: ActionSuivie) => (
    <LigneAction key={x.cle} reseau={reseau} x={x} avecMagasin={!choix && noms.length > 1} enCours={enCours === x.cle}
      cocher={ecriture.lectureSeule ? undefined : (f) => void cocher(x, f)}
      modifier={x.libre && !ecriture.franchise ? () => setEdition(x) : undefined} />
  )
  if (!noms.length) return <EmptyState icone={<TaskAltOutlined />} titre="Aucun magasin" texte="Aucun magasin n’est rattaché à ton accès pour le moment." />
  const retard = aFaire.filter((x) => enRetard(x.a, reseau.jour)).length
  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 2 }}>
        {noms.length > 1 && noms.length <= 6 && (
          <Box role="group" aria-label="Magasins affichés" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label="Tous" color={choix ? 'default' : 'primary'} variant={choix ? 'outlined' : 'filled'} onClick={() => setMagasin(null)} aria-pressed={!choix} sx={{ minHeight: 48 }} />
            {noms.map((n) => <Chip key={n} label={n} color={choix === n ? 'primary' : 'default'} variant={choix === n ? 'filled' : 'outlined'} onClick={() => setMagasin(n)} aria-pressed={choix === n} sx={{ minHeight: 48 }} />)}
          </Box>
        )}
        {noms.length > 6 && (
          <Autocomplete options={[...noms].sort((a, b) => a.localeCompare(b, 'fr'))} value={choix} onChange={(_e, v) => setMagasin(v)} sx={{ width: { xs: '100%', sm: 320 } }}
            renderInput={(params) => <TextField {...params} label="Magasin" placeholder="Tous les magasins" />} />
        )}
        <Typography variant="body2" color="text.secondary" sx={{ ml: { sm: 'auto' } }}>
          {retard ? `${retard} en retard` : aFaire.length ? 'Aucune en retard' : ''}
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Bloc titre="À faire" nombre={aFaire.length} couleur="error">
          {aFaire.length
            ? <Box component="ul" aria-label="Actions à faire" sx={{ listStyle: 'none', m: 0, p: 0 }}>{aFaire.map(ligne)}</Box>
            : <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>{faites.length ? 'Toutes les actions sont faites.' : 'Aucune action pour le moment.'}</Typography>}
        </Bloc>
        {faites.length > 0 && (
          <Bloc titre="Faites" nombre={faites.length} couleur="success">
            <Box component="ul" aria-label="Actions faites" sx={{ listStyle: 'none', m: 0, p: 0 }}>{(toutesFaites ? faites : faites.slice(0, FAITES_VISIBLES)).map(ligne)}</Box>
            {faites.length > FAITES_VISIBLES && (
              <Button onClick={() => setToutesFaites((v) => !v)} sx={{ minHeight: 48, mt: 1, ml: -1 }}>{toutesFaites ? 'Voir moins' : `Voir les ${faites.length} actions faites`}</Button>
            )}
          </Bloc>
        )}
      </Box>
      {edition && <DialogAction reseau={reseau} magasins={noms} action={edition} onFermer={(msg) => { setEdition(null); if (msg) signaler(msg) }} />}
    </>
  )
}

export function PageActions() {
  const { profil } = useAuth()
  const { reseau } = useReseau()
  const [params, setParams] = useSearchParams()
  const [message, setMessage] = useState('')
  const impose = perimetreDuProfil(profil)
  const franchise = !!reseau?.espace
  // Le Directeur choisit sa vue comme au Dashboard ; Coach, RR et franchisé voient leurs magasins
  const choisi: Perimetre = impose ?? (franchise ? { type: 'reseau' } : lireVue(params.get('vue')))
  const changer = (p: Perimetre) => setParams((x) => { const n = new URLSearchParams(x); if (p.type === 'reseau') n.delete('vue'); else n.set('vue', cleVue(p)); return n }, { replace: true })
  const magasins = reseau ? magasinsDu(reseau, choisi).map((m) => m.nom) : []
  return (
    <>
      <PageHeader titre={franchise ? 'Mes actions' : 'Actions'}
        actions={reseau && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {!impose && !franchise && <ChoixVue reseau={reseau} valeur={choisi} onChange={changer} />}
            <BoutonAjouterAction plein reseau={reseau} magasins={[...magasins].sort((a, b) => a.localeCompare(b, 'fr'))} signaler={setMessage} />
          </Box>
        )} />
      <AvecReseau>{(r) => <Liste reseau={r} p={choisi} signaler={setMessage} />}</AvecReseau>
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}
