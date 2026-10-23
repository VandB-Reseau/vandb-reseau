import { useState } from 'react'
import { Glisser } from './Social'
import { Link as RouterLink } from 'react-router-dom'
import { BoutonAction } from './Outils'
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
import { clesDesPorteurs, echeanceDate, enRetard, joindrePorteurs, porteursDe, porteursDu, type ActionSuivie } from '../data/actions'
import { mesCles } from '../data/messagerie'
import { notifierTache } from '../lib/notifications'
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

const messageErreur = (e: unknown) => (e instanceof ErreurAction ? e.message : 'La tâche n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.')

// Ligne d'une action ; sans « cocher », lecture seule
export function LigneAction({ reseau, x, avecMagasin, avecPorteur = true, cocher, enCours = false, modifier }: { reseau: Reseau; x: ActionSuivie; avecMagasin?: boolean; avecPorteur?: boolean; cocher?: (faite: boolean) => void; enCours?: boolean; modifier?: () => void }) {
  const retard = enRetard(x.a, reseau.jour)
  const echeance = x.a.echeance && (echeanceDate(x.a) ? dateCourte(x.a.echeance) : x.a.echeance)
  const auteur = x.libre?.auteur ? ` par ${x.libre.auteur}` : ''
  const origine = x.visite
    ? <Link component={RouterLink} to={lienCompteRendu(x.visite)}>visite du {dateCourte(x.visite.date)}</Link>
    : x.date ? `ajoutée le ${dateCourte(x.date)}${auteur}` : 'hors visite'
  // Échéance : à droite sur PC, sous le texte sur téléphone pour laisser la largeur au libellé
  const pastille = !x.a.faite && echeance && <Chip size="small" color={retard ? 'error' : 'default'} variant={retard ? 'filled' : 'outlined'} label={retard ? `En retard · ${echeance}` : echeance} sx={{ fontSize: 12, fontWeight: 600 }} />
  const faite = x.a.faite ? `faite le ${dateCourte(x.a.faite)}${x.a.faitePar ? ` par ${x.a.faitePar}` : ''}` : null
  return (
    <Box component="li" sx={{ borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
    <Glisser libelle="Faite" icone={<CheckCircle />} actif={!!cocher && !x.a.faite && !enCours} onGlisser={() => cocher?.(true)}>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.75 }}>
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
          {x.libre?.fil === 'equipe' && ' · Équipe seule'}
        </Typography>
        {pastille && <Box sx={{ display: { xs: 'block', sm: 'none' }, mt: 0.75 }}>{pastille}</Box>}
        {x.a.pieces && <ListePieces pieces={x.a.pieces} />}
      </Box>
      {pastille && <Box sx={{ display: { xs: 'none', sm: 'block' }, mt: 1.5, flexShrink: 0 }}>{pastille}</Box>}
      {modifier && <Tooltip title="Modifier"><IconButton onClick={modifier} aria-label={`Modifier la tâche ${x.a.action}`}><EditOutlined /></IconButton></Tooltip>}
    </Box>
    </Glisser>
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
      signaler(faite ? 'Tâche marquée faite.' : 'Tâche remise en cours.')
    } catch (e) { signaler(messageErreur(e)) }
    finally { setEnCours(null) }
  }
  const ligne = (x: ActionSuivie) => <LigneAction key={x.cle} reseau={reseau} x={x} avecMagasin={avecMagasin} enCours={enCours === x.cle}
    cocher={ecriture.lectureSeule ? undefined : (f) => void cocher(x, f)}
    modifier={x.libre && magasins.length && !ecriture.franchise ? () => setEdition(x) : undefined} />
  return (
    <>
      {ouvertes.length === 0
        ? <Typography variant="body2" color="text.secondary">{actions.length ? 'Toutes les tâches sont faites.' : 'Aucune tâche en cours.'}</Typography>
        : <Box component="ul" aria-label={libelle} sx={{ listStyle: 'none', m: 0, p: 0 }}>{ouvertes.map(ligne)}</Box>}
      {faites.length > 0 && (
        <>
          <Button onClick={() => setVoirFaites((v) => !v)} sx={{ minHeight: 48, mt: 1, ml: -1 }}>{voirFaites ? 'Masquer les tâches faites' : `Tâches faites (${faites.length})`}</Button>
          {voirFaites && <Box component="ul" aria-label={`${libelle} : faites`} sx={{ listStyle: 'none', m: 0, p: 0 }}>{faites.map(ligne)}</Box>}
        </>
      )}
      {edition !== undefined && <DialogAction reseau={reseau} magasins={magasins} action={edition} onFermer={(msg) => { setEdition(undefined); if (msg) signaler(msg) }} />}
    </>
  )
}

// Icône « Tâches » de l'en-tête : nombre de tâches à faire de la personne, aperçu des plus urgentes
// Bouton « Ajouter une tâche » et sa fenêtre, pour l'en-tête d'une section
// porteur : proposé d'office (liste d'une personne)
// barre : action d'une barre d'outils (bouton rond sur téléphone)
export function BoutonAjouterAction({ reseau, magasins, signaler, plein = false, barre = false, porteur, libelle = 'Ajouter une tâche' }: { reseau: Reseau; magasins: string[]; signaler: (m: string) => void; plein?: boolean; barre?: boolean; porteur?: string; libelle?: string }) {
  const [ouvert, setOuvert] = useState(false)
  if (useEcritureActions(reseau).lectureSeule || !magasins.length) return null
  return (
    <>
      {barre
        ? <BoutonAction libelle={libelle} onClick={() => setOuvert(true)} />
        : <Button variant={plein ? 'contained' : 'text'} startIcon={<AddOutlined />} onClick={() => setOuvert(true)} sx={{ minHeight: 48, ...(plein && { borderRadius: 999, px: 3 }) }}>{libelle}</Button>}
      {ouvert && <DialogAction reseau={reseau} magasins={magasins} action={null} porteurInitial={porteur} onFermer={(msg) => { setOuvert(false); if (msg) signaler(msg) }} />}
    </>
  )
}

// Porteurs choisis parmi les personnes du magasin (un ou plusieurs) ; un ancien porteur saisi à la main reste affiché
export function ChampPorteur({ reseau, magasin, valeur, changer, sx }: { reseau: Reseau; magasin: string; valeur: string; changer: (v: string) => void; sx?: SxProps<Theme> }) {
  const liste = porteursDu(reseau, magasin)
  const choisis = porteursDe({ porteur: valeur })
  const options = [...liste, ...choisis.filter((n) => !liste.some((p) => p.nom === n)).map((nom) => ({ nom, role: 'Autre' }))]
  const role = (n: string) => options.find((p) => p.nom === n)?.role ?? ''
  return (
    <Autocomplete multiple disableCloseOnSelect options={options.map((p) => p.nom)} value={choisis} onChange={(_e, v) => changer(joindrePorteurs(v))} groupBy={role} sx={sx}
      noOptionsText="Choisis d’abord le magasin"
      renderInput={(p) => <TextField {...p} label="Porteurs" />} />
  )
}

const dateValide = (d: string) => !d || /^\d{4}-\d{2}-\d{2}$/.test(d)

// Échéances proposées d'un geste : demain, vendredi qui vient, dans 15 jours
function echeancesRapides(jour: string): { libelle: string; date: string }[] {
  const d = (n: number) => { const x = new Date(`${jour}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
  const jusquAVendredi = (5 - new Date(`${jour}T12:00:00Z`).getUTCDay() + 7) % 7 || 7
  return [{ libelle: 'Demain', date: d(1) }, { libelle: 'Vendredi', date: d(jusquAVendredi) }, { libelle: 'Dans 15 jours', date: d(15) }]
}

// depuis : tâche née d'un message (texte proposé, fil « Équipe seule » ou non, message d'origine)
export function DialogAction({ reseau, magasins, action, porteurInitial = '', depuis, onFermer }: {
  reseau: Reseau; magasins: string[]; action: ActionSuivie | null; porteurInitial?: string; depuis?: { texte: string; equipe: boolean; message: number }; onFermer: (msg?: string) => void
}) {
  const { profil } = useAuth()
  const { franchise } = useEcritureActions(reseau)
  const a = action?.libre ?? null
  const [magasin, setMagasin] = useState(action?.magasin ?? (magasins.length === 1 ? magasins[0] : ''))
  const [texte, setTexte] = useState(a?.action ?? depuis?.texte ?? '')
  const [porteur, setPorteur] = useState(a?.porteur ?? porteurInitial)
  const [echeance, setEcheance] = useState(a ? echeanceDate(a) : '')
  const [pieces, setPieces] = useState<Piece[]>(a?.pieces ?? [])
  const [alerte, setAlerte] = useState('')
  const propre = texte.trim().replace(/\s+/g, ' ')
  return (
    <Fenetre titre={a ? 'Modifier la tâche' : 'Ajouter une tâche'} ouvert onFermer={onFermer}
      valide={!!propre && !!magasin && dateValide(echeance)}
      enregistrer={async () => {
        if (franchise) {
          await ajouterActionFranchise(magasin, propre, porteur.trim(), echeance, pieces)
          return 'Tâche ajoutée.'
        }
        const l: Omit<ActionLibre, 'id'> & { id?: string } = { id: a?.id, action: propre, porteur: porteur.trim(), echeance, ...(pieces.length ? { pieces } : {}), creeLe: a?.creeLe || reseau.jour, ...(a?.faite ? { faite: a.faite, ...(a.faitePar ? { faitePar: a.faitePar } : {}) } : {}), ...(a?.auteur || profil?.nom ? { auteur: a?.auteur || profil?.nom } : {}), ...(a?.fil ?? (depuis?.equipe ? 'equipe' : undefined) ? { fil: 'equipe' as const } : {}), ...(a?.message ?? depuis?.message ? { message: a?.message ?? depuis?.message } : {}) }
        const id = await enregistrerActionLibre(magasin, l)
        if (!a) notifierTache(magasin, id, clesDesPorteurs(reseau, magasin, porteursDe(l)).filter((c) => !mesCles(profil).includes(c)))
        return a ? 'Tâche mise à jour.' : 'Tâche ajoutée.'
      }}
      supprimer={a ? async () => { await supprimerActionLibre(magasin, a.id); return 'Tâche supprimée.' } : undefined}
      libelleSuppression={a ? `Supprimer la tâche « ${a.action} » ?` : undefined}>
      {magasins.length > 1 && !a && (
        <Autocomplete options={magasins} value={magasin || null} onChange={(_e, v) => setMagasin(v ?? '')}
          renderInput={(p) => <TextField {...p} label="Magasin" />} />
      )}
      <TextField label="Tâche" value={texte} onChange={(e) => setTexte(e.target.value)} autoFocus={!a} multiline minRows={2} />
      <ChampPorteur reseau={reseau} magasin={magasin} valeur={porteur} changer={setPorteur} />
      <TextField type="date" label="Échéance" value={echeance} onChange={(e) => setEcheance(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <Box role="group" aria-label="Échéance rapide" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: -1 }}>
        {echeancesRapides(reseau.jour).map((x) => (
          <Chip key={x.libelle} label={x.libelle} onClick={() => setEcheance(x.date)} aria-pressed={echeance === x.date}
            color={echeance === x.date ? 'primary' : 'default'} variant={echeance === x.date ? 'filled' : 'outlined'} sx={{ minHeight: 48, borderRadius: 999 }} />
        ))}
      </Box>
      <ChampPieces pieces={pieces} changer={(p) => { setPieces(p); setAlerte('') }} signaler={setAlerte} />
      {alerte && <Alert severity="warning">{alerte}</Alert>}
    </Fenetre>
  )
}
