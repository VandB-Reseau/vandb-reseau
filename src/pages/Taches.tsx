// Tâches : actions attribuées à la personne connectée (son nom en porteur), à faire puis faites,
// avec qui les a faites et quand. Le Directeur peut ouvrir la liste d'un RR ou d'un Coach.
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
import MenuItem from '@mui/material/MenuItem'
import ListSubheader from '@mui/material/ListSubheader'
import { useAuth } from '../auth/AuthContext'
import { useReseau } from '../data/ReseauContext'
import { actionsDes, enRetard, monNomPorteur, porteursDu, type ActionSuivie } from '../data/actions'
import { magasinsDu, perimetreDuProfil } from '../data/perimetre'
import { libelleResponsable, type Reseau } from '../data/modele'
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

// Liste des tâches des franchisés des magasins affichés
const FRANCHISES = '@franchises'

// L'équipe ouvre sa liste ou celle des franchisés de ses magasins ; le Directeur aussi celle d'un RR ou d'un Coach
function ChoixPorteur({ reseau, moi, valeur, directeur, onChange }: { reseau: Reseau; moi: string; valeur: string; directeur: boolean; onChange: (nom: string) => void }) {
  return (
    <TextField select size="small" label="Liste de" value={valeur} onChange={(e) => onChange(e.target.value)} sx={{ minWidth: 240, '& .MuiInputBase-root': { minHeight: 48 } }}>
      <MenuItem value={moi}>Mes tâches</MenuItem>
      <MenuItem value={FRANCHISES}>{directeur ? 'Franchisés du réseau' : 'Franchisés de mes magasins'}</MenuItem>
      {directeur && <ListSubheader>Responsables Régionaux</ListSubheader>}
      {directeur && reseau.rrs.map((r) => <MenuItem key={r.id} value={r.nom}>{r.nom}</MenuItem>)}
      {directeur && <ListSubheader>Coachs</ListSubheader>}
      {directeur && reseau.equipe.filter((c) => !c.fictif).map((c) => <MenuItem key={c.nom} value={c.nom}>{c.nom}</MenuItem>)}
    </TextField>
  )
}

// La tâche est-elle portée par un franchisé (ou le responsable) de son magasin ?
function porteeParFranchise(reseau: Reseau, x: ActionSuivie, cache: Map<string, Set<string>>): boolean {
  if (!x.a.porteur) return false
  let noms = cache.get(x.magasin)
  if (!noms) {
    const m = reseau.magasins.find((y) => y.nom === x.magasin)
    noms = new Set(m ? porteursDu(reseau, x.magasin).filter((p) => p.role === libelleResponsable(m)).map((p) => p.nom) : [])
    noms.add('Franchisé').add('Responsable du magasin')
    cache.set(x.magasin, noms)
  }
  return noms.has(x.a.porteur)
}

function Liste({ reseau, noms, porteur, signaler }: { reseau: Reseau; noms: string[]; porteur: string; signaler: (m: string) => void }) {
  const { recharger } = useReseau()
  const ecriture = useEcritureActions(reseau)
  const [magasin, setMagasin] = useState<string | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [toutesFaites, setToutesFaites] = useState(false)
  const [edition, setEdition] = useState<ActionSuivie | null>(null)
  const choix = magasin && noms.includes(magasin) ? magasin : null
  const cache = new Map<string, Set<string>>()
  const actions = actionsDes(reseau, new Set(choix ? [choix] : noms)).filter((x) => (porteur === FRANCHISES ? porteeParFranchise(reseau, x, cache) : x.a.porteur === porteur))
  const aFaire = actions.filter((x) => !x.a.faite)
  const faites = actions.filter((x) => x.a.faite)
  const cocher = async (x: ActionSuivie, faite: boolean) => {
    setEnCours(x.cle)
    try {
      await ecriture.cocher(x, faite)
      await recharger()
      signaler(faite ? 'Tâche marquée faite.' : 'Tâche remise à faire.')
    } catch (e) { signaler(e instanceof ErreurAction ? e.message : 'L’action n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.') }
    finally { setEnCours(null) }
  }
  const ligne = (x: ActionSuivie) => (
    <LigneAction key={x.cle} reseau={reseau} x={x} avecMagasin={!choix && noms.length > 1} avecPorteur={porteur === FRANCHISES} enCours={enCours === x.cle}
      cocher={ecriture.lectureSeule ? undefined : (f) => void cocher(x, f)}
      modifier={x.libre && !ecriture.franchise ? () => setEdition(x) : undefined} />
  )
  if (!noms.length) return <EmptyState icone={<TaskAltOutlined />} titre="Aucun magasin" texte="Aucun magasin n’est rattaché à ton accès pour le moment." />
  if (!porteur) return <EmptyState icone={<TaskAltOutlined />} titre="Aucune liste" texte="Ton nom n’est pas encore relié à ton accès. Contacte la direction du réseau." />
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
            ? <Box component="ul" aria-label="Tâches à faire" sx={{ listStyle: 'none', m: 0, p: 0 }}>{aFaire.map(ligne)}</Box>
            : <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>{faites.length ? 'Toutes tes tâches sont faites.' : 'Aucune tâche attribuée pour le moment.'}</Typography>}
        </Bloc>
        {faites.length > 0 && (
          <Bloc titre="Faites" nombre={faites.length} couleur="success">
            <Box component="ul" aria-label="Tâches faites" sx={{ listStyle: 'none', m: 0, p: 0 }}>{(toutesFaites ? faites : faites.slice(0, FAITES_VISIBLES)).map(ligne)}</Box>
            {faites.length > FAITES_VISIBLES && (
              <Button onClick={() => setToutesFaites((v) => !v)} sx={{ minHeight: 48, mt: 1, ml: -1 }}>{toutesFaites ? 'Voir moins' : `Voir les ${faites.length} tâches faites`}</Button>
            )}
          </Bloc>
        )}
      </Box>
      {edition && <DialogAction reseau={reseau} magasins={noms} action={edition} tache onFermer={(msg) => { setEdition(null); if (msg) signaler(msg) }} />}
    </>
  )
}

export function PageTaches() {
  const { profil } = useAuth()
  const { reseau } = useReseau()
  const [params, setParams] = useSearchParams()
  const [message, setMessage] = useState('')
  const impose = perimetreDuProfil(profil)
  const franchise = !!reseau?.espace
  const moi = reseau ? monNomPorteur(reseau, profil) : ''
  // Franchisé : sa liste ; l'équipe ajoute celle des franchisés, le Directeur celle de chacun
  const choixPossible = !!reseau && !franchise && !!moi
  const demande = choixPossible ? params.get('de') : null
  const porteur = (demande && (!impose || demande === FRANCHISES) ? demande : '') || moi
  const changer = (nom: string) => setParams((x) => { const n = new URLSearchParams(x); if (nom === moi) n.delete('de'); else n.set('de', nom); return n }, { replace: true })
  const noms = reseau ? (impose ? magasinsDu(reseau, impose) : reseau.magasins).map((m) => m.nom).sort((a, b) => a.localeCompare(b, 'fr')) : []
  return (
    <>
      <PageHeader titre={!porteur || porteur === moi ? 'Mes tâches' : porteur === FRANCHISES ? 'Tâches des franchisés' : `Tâches de ${porteur}`}
        actions={reseau && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {choixPossible && <ChoixPorteur reseau={reseau} moi={moi} valeur={porteur} directeur={!impose} onChange={changer} />}
            <BoutonAjouterAction plein reseau={reseau} magasins={noms} porteur={porteur === FRANCHISES ? '' : porteur} tache signaler={setMessage} />
          </Box>
        )} />
      <AvecReseau>{(r) => <Liste reseau={r} noms={noms} porteur={porteur} signaler={setMessage} />}</AvecReseau>
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}
