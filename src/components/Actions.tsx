import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Badge from '@mui/material/Badge'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import { Bulle } from './Outils'
import { ChampPieces, ListePieces } from './Pieces'
import Alert from '@mui/material/Alert'
import type { Piece } from '../lib/pieces'
import Autocomplete from '@mui/material/Autocomplete'
import type { SxProps, Theme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import CheckCircle from '@mui/icons-material/CheckCircle'
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked'
import { useReseau } from '../data/ReseauContext'
import { useAuth } from '../auth/AuthContext'
import { enregistrerActionLibre, marquerActions, supprimerActionLibre } from '../data/chargement'
import { actionsDes, echeanceDate, enRetard, monNomPorteur, porteursDu, type ActionSuivie } from '../data/actions'
import { ajouterActionFranchise, ErreurAction, marquerActionFranchise } from '../data/espaceFranchise'
import type { ActionLibre, Reseau } from '../data/modele'
import { dateCourte, lienFiche } from '../lib/format'
import { lienCompteRendu } from '../data/visites'
import { Fenetre } from './EditionEquipe'

// Écriture des actions : l'équipe écrit directement ; un franchisé passe par les fonctions de la base ;
// l'aperçu de l'espace d'un franchisé ne modifie rien
// eslint-disable-next-line react-refresh/only-export-components
export function useEcritureActions(reseau: Reseau) {
  const { profil } = useAuth()
  const franchise = !!reseau.espace
  const lectureSeule = franchise && profil?.role !== 'franchise'
  const cocher = async (x: ActionSuivie, faite: boolean) => {
    if (franchise) {
      if (x.libre) return marquerActionFranchise(x.magasin, faite, { libre: x.libre.id })
      if (x.visite?.id != null) return marquerActionFranchise(x.magasin, faite, { visite: x.visite.id, index: x.index, texte: x.a.action })
      return
    }
    const jour = faite ? reseau.jour : ''
    const cible = x.libre ? { libre: x.libre.id, magasin: x.magasin, faite: jour } : x.visite?.id != null ? { visite: x.visite.id, index: x.index, faite: jour } : null
    if (cible) await marquerActions([cible], profil?.nom ?? '')
  }
  return { franchise, lectureSeule, cocher }
}

const messageErreur = (e: unknown) => (e instanceof ErreurAction ? e.message : 'L’action n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.')

// Ligne d'une action ; sans « cocher », lecture seule
export function LigneAction({ reseau, x, avecMagasin, avecPorteur = true, cocher, enCours = false, modifier }: { reseau: Reseau; x: ActionSuivie; avecMagasin?: boolean; avecPorteur?: boolean; cocher?: (faite: boolean) => void; enCours?: boolean; modifier?: () => void }) {
  const retard = enRetard(x.a, reseau.jour)
  const echeance = x.a.echeance && (echeanceDate(x.a) ? dateCourte(x.a.echeance) : x.a.echeance)
  const auteur = x.libre?.auteur ? ` par ${x.libre.auteur}` : ''
  const origine = x.visite
    ? <Link component={RouterLink} to={lienCompteRendu(x.visite)}>visite du {dateCourte(x.visite.date)}</Link>
    : x.date ? `ajoutée le ${dateCourte(x.date)}${auteur}` : 'hors visite'
  const faite = x.a.faite ? `faite le ${dateCourte(x.a.faite)}${x.a.faitePar ? ` par ${x.a.faitePar}` : ''}` : null
  return (
    <Box component="li" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      {cocher
        ? <Checkbox checked={!!x.a.faite} disabled={enCours} onChange={(e) => cocher(e.target.checked)} sx={{ width: 48, height: 48, flexShrink: 0 }}
            slotProps={{ input: { 'aria-label': `${x.a.faite ? 'Remettre en cours' : 'Marquer faite'} : ${x.a.action}` } }} />
        : <Box sx={{ width: 48, height: 48, flexShrink: 0, display: 'grid', placeItems: 'center', color: x.a.faite ? 'success.main' : 'text.secondary' }}>
            {x.a.faite ? <CheckCircle aria-label="Faite" /> : <RadioButtonUnchecked aria-label="À faire" />}
          </Box>}
      <Box sx={{ flex: 1, minWidth: 0, py: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: 500, textDecoration: x.a.faite ? 'line-through' : undefined, color: x.a.faite ? 'text.secondary' : undefined, overflowWrap: 'anywhere' }}>{x.a.action}</Typography>
        <Typography variant="body2" color="text.secondary">
          {avecMagasin && <><Link component={RouterLink} to={lienFiche(x.magasin)}>{x.magasin}</Link> · </>}
          {[avecPorteur && x.a.porteur, faite].filter(Boolean).join(' · ')}
          {((avecPorteur && x.a.porteur) || faite) && ' · '}
          {origine}
        </Typography>
        {x.a.pieces && <ListePieces pieces={x.a.pieces} />}
      </Box>
      {!x.a.faite && echeance && <Chip size="small" color={retard ? 'error' : 'default'} variant={retard ? 'filled' : 'outlined'} label={retard ? `En retard · ${echeance}` : echeance} sx={{ fontSize: 12, fontWeight: 600, mt: 1.5, flexShrink: 0 }} />}
      {modifier && <Tooltip title="Modifier"><IconButton onClick={modifier} aria-label={`Modifier l’action ${x.a.action}`}><EditOutlined /></IconButton></Tooltip>}
    </Box>
  )
}

// Actions suivies : en cours (échéance la plus proche d'abord), puis celles déjà faites.
// magasins : magasins où une action hors visite peut être modifiée (aucun = lecture seule)
export function ListeActions({ reseau, actions, avecMagasin, signaler, libelle, magasins = [] }: { reseau: Reseau; actions: ActionSuivie[]; avecMagasin?: boolean; signaler: (m: string) => void; libelle: string; magasins?: string[] }) {
  const { recharger } = useReseau()
  const [enCours, setEnCours] = useState<string | null>(null)
  const [voirFaites, setVoirFaites] = useState(false)
  const [edition, setEdition] = useState<ActionSuivie | null | undefined>(undefined)
  const ouvertes = actions.filter((x) => !x.a.faite)
  const faites = actions.filter((x) => x.a.faite)
  const ecriture = useEcritureActions(reseau)
  const cocher = async (x: ActionSuivie, faite: boolean) => {
    setEnCours(x.cle)
    try {
      await ecriture.cocher(x, faite)
      await recharger()
      signaler(faite ? 'Action marquée faite.' : 'Action remise en cours.')
    } catch (e) { signaler(messageErreur(e)) }
    finally { setEnCours(null) }
  }
  const ligne = (x: ActionSuivie) => <LigneAction key={x.cle} reseau={reseau} x={x} avecMagasin={avecMagasin} enCours={enCours === x.cle}
    cocher={ecriture.lectureSeule ? undefined : (f) => void cocher(x, f)}
    modifier={x.libre && magasins.length && !ecriture.franchise ? () => setEdition(x) : undefined} />
  return (
    <>
      {ouvertes.length === 0
        ? <Typography variant="body2" color="text.secondary">{actions.length ? 'Toutes les actions sont faites.' : 'Aucune action en cours.'}</Typography>
        : <Box component="ul" aria-label={libelle} sx={{ listStyle: 'none', m: 0, p: 0 }}>{ouvertes.map(ligne)}</Box>}
      {faites.length > 0 && (
        <>
          <Button onClick={() => setVoirFaites((v) => !v)} sx={{ minHeight: 48, mt: 1, ml: -1 }}>{voirFaites ? 'Masquer les actions faites' : `Actions faites (${faites.length})`}</Button>
          {voirFaites && <Box component="ul" aria-label={`${libelle} : faites`} sx={{ listStyle: 'none', m: 0, p: 0 }}>{faites.map(ligne)}</Box>}
        </>
      )}
      {edition !== undefined && <DialogAction reseau={reseau} magasins={magasins} action={edition} onFermer={(msg) => { setEdition(undefined); if (msg) signaler(msg) }} />}
    </>
  )
}

// Icône « Tâches » de l'en-tête, avec le nombre de tâches à faire de la personne
export function BoutonTaches() {
  const { profil } = useAuth()
  const { reseau } = useReseau()
  const naviguer = useNavigate()
  const moi = reseau ? monNomPorteur(reseau, profil) : ''
  const nombre = reseau && moi ? actionsDes(reseau, null).filter((x) => !x.a.faite && x.a.porteur === moi).length : 0
  return (
    <Bulle titre="Tâches">
      <IconButton aria-label={nombre ? `Tâches : ${nombre} à faire` : 'Tâches'} onClick={() => naviguer('/taches')} sx={{ color: '#ffffff', width: 48, height: 48 }}>
        <Badge color="error" badgeContent={nombre} max={99} sx={{ '& .MuiBadge-badge': { fontSize: '0.75rem' } }}><TaskAltOutlined /></Badge>
      </IconButton>
    </Bulle>
  )
}

// Bouton « Ajouter une action » et sa fenêtre, pour l'en-tête d'une section
// porteur : proposé d'office (liste d'une personne)
// tache : libellés de l'écran Tâches
export function BoutonAjouterAction({ reseau, magasins, signaler, plein = false, porteur, tache = false }: { reseau: Reseau; magasins: string[]; signaler: (m: string) => void; plein?: boolean; porteur?: string; tache?: boolean }) {
  const [ouvert, setOuvert] = useState(false)
  if (useEcritureActions(reseau).lectureSeule || !magasins.length) return null
  return (
    <>
      <Button variant={plein ? 'contained' : 'text'} startIcon={<AddOutlined />} onClick={() => setOuvert(true)} sx={{ minHeight: 48 }}>{tache ? 'Ajouter une tâche' : 'Ajouter une action'}</Button>
      {ouvert && <DialogAction reseau={reseau} magasins={magasins} action={null} porteurInitial={porteur} tache={tache} onFermer={(msg) => { setOuvert(false); if (msg) signaler(msg) }} />}
    </>
  )
}

// Porteur choisi parmi les personnes du magasin ; un ancien porteur saisi à la main reste affiché
export function ChampPorteur({ reseau, magasin, valeur, changer, sx }: { reseau: Reseau; magasin: string; valeur: string; changer: (v: string) => void; sx?: SxProps<Theme> }) {
  const liste = porteursDu(reseau, magasin)
  const options = valeur && !liste.some((p) => p.nom === valeur) ? [...liste, { nom: valeur, role: 'Autre' }] : liste
  const role = (n: string) => options.find((p) => p.nom === n)?.role ?? ''
  return (
    <Autocomplete options={options.map((p) => p.nom)} value={valeur || null} onChange={(_e, v) => changer(v ?? '')} groupBy={role} sx={sx}
      noOptionsText="Choisis d’abord le magasin"
      renderInput={(p) => <TextField {...p} label="Porteur" />} />
  )
}

const dateValide = (d: string) => !d || /^\d{4}-\d{2}-\d{2}$/.test(d)

export function DialogAction({ reseau, magasins, action, porteurInitial = '', tache = false, onFermer }: { reseau: Reseau; magasins: string[]; action: ActionSuivie | null; porteurInitial?: string; tache?: boolean; onFermer: (msg?: string) => void }) {
  const [mot, Mot] = tache ? ['tâche', 'Tâche'] : ['action', 'Action']
  const { profil } = useAuth()
  const { franchise } = useEcritureActions(reseau)
  const a = action?.libre ?? null
  const [magasin, setMagasin] = useState(action?.magasin ?? (magasins.length === 1 ? magasins[0] : ''))
  const [texte, setTexte] = useState(a?.action ?? '')
  const [porteur, setPorteur] = useState(a?.porteur ?? porteurInitial)
  const [echeance, setEcheance] = useState(a ? echeanceDate(a) : '')
  const [pieces, setPieces] = useState<Piece[]>(a?.pieces ?? [])
  const [alerte, setAlerte] = useState('')
  const propre = texte.trim().replace(/\s+/g, ' ')
  return (
    <Fenetre titre={a ? `Modifier l’${mot}` : `Ajouter une ${mot}`} ouvert onFermer={onFermer}
      valide={!!propre && !!magasin && dateValide(echeance)}
      enregistrer={async () => {
        if (franchise) {
          await ajouterActionFranchise(magasin, propre, porteur.trim(), echeance, pieces)
          return `${Mot} ajoutée.`
        }
        const l: Omit<ActionLibre, 'id'> & { id?: string } = { id: a?.id, action: propre, porteur: porteur.trim(), echeance, ...(pieces.length ? { pieces } : {}), creeLe: a?.creeLe || reseau.jour, ...(a?.faite ? { faite: a.faite, ...(a.faitePar ? { faitePar: a.faitePar } : {}) } : {}), ...(a?.auteur || profil?.nom ? { auteur: a?.auteur || profil?.nom } : {}) }
        await enregistrerActionLibre(magasin, l)
        return a ? `${Mot} mise à jour.` : `${Mot} ajoutée.`
      }}
      supprimer={a ? async () => { await supprimerActionLibre(magasin, a.id); return `${Mot} supprimée.` } : undefined}
      libelleSuppression={a ? `Supprimer l’${mot} « ${a.action} » ?` : undefined}>
      {magasins.length > 1 && !a && (
        <Autocomplete options={magasins} value={magasin || null} onChange={(_e, v) => setMagasin(v ?? '')}
          renderInput={(p) => <TextField {...p} label="Magasin" />} />
      )}
      <TextField label={Mot} value={texte} onChange={(e) => setTexte(e.target.value)} autoFocus={!a} multiline minRows={2} />
      <ChampPorteur reseau={reseau} magasin={magasin} valeur={porteur} changer={setPorteur} />
      <TextField type="date" label="Échéance" value={echeance} onChange={(e) => setEcheance(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <ChampPieces pieces={pieces} changer={(p) => { setPieces(p); setAlerte('') }} signaler={setAlerte} />
      {alerte && <Alert severity="warning">{alerte}</Alert>}
    </Fenetre>
  )
}
