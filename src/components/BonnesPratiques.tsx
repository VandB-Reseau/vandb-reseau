import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import EditOutlined from '@mui/icons-material/EditOutlined'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import { Fenetre } from './EditionEquipe'
import { ChampDicte } from './SaisieCompteRendu'
import { ChampPhotos } from './GrilleAudit'
import { GrillePhotos, Initiales, TitreSection } from './Social'
import Favorite from '@mui/icons-material/Favorite'
import FavoriteBorderOutlined from '@mui/icons-material/FavoriteBorderOutlined'
import Snackbar from '@mui/material/Snackbar'
import { useReseau } from '../data/ReseauContext'
import { useApercu } from '../auth/Apercu'
import { Reactions } from './Reactions'
import { basculerPoucePratique, commenterPratique, messageReaction, supprimerCommentairePratique, useReactionsPratiques, type ReactionsPratiques } from '../data/reactionsPratiques'
import { useAuth } from '../auth/AuthContext'
import { monNomPorteur } from '../data/actions'
import { ChampRecherche } from './Outils'
import { FiltreMenu } from './FiltreMenu'
import { RechercheFiltres } from './RechercheFiltres'
import { EmptyState } from './EmptyState'
import { visiteurs } from './DialogVisite'
import { basculerJaime, enregistrerPratique } from '../data/chargement'
import { themesConnus, type BonnePratique } from '../data/bonnesPratiques'
import { nouvelId, type Photo } from '../data/grilles'
import { supprimerPhotos } from '../lib/photos'
import { dateCourte, lienFiche } from '../lib/format'
import type { Reseau } from '../data/modele'

export function DialogPratique({ reseau, pratique, magasinInitial = '', onFermer }: { reseau: Reseau; pratique: BonnePratique | null; magasinInitial?: string; onFermer: (m?: string) => void }) {
  const [magasin, setMagasin] = useState(pratique?.magasin ?? magasinInitial)
  const [date, setDate] = useState(pratique?.date ?? reseau.jour)
  const [titre, setTitre] = useState(pratique?.titre ?? '')
  const [theme, setTheme] = useState(pratique?.theme ?? '')
  const [texte, setTexte] = useState(pratique?.texte ?? '')
  const [par, setPar] = useState(pratique?.par ?? reseau.directeur.nom)
  const [photos, setPhotos] = useState<Photo[]>(pratique?.photos ?? [])
  const [reprises, setReprises] = useState<string[]>(pratique?.reprises ?? [])
  const [retirees, setRetirees] = useState<string[]>([])
  const noms = reseau.magasins.map((m) => m.nom)
  const valide = !!magasin && !!titre.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date)
  return (
    <Fenetre
      large ouvert onFermer={onFermer} valide={valide} titre={pratique ? 'Modifier la bonne pratique' : 'Nouvelle bonne pratique'}
      enregistrer={async () => {
        await enregistrerPratique(pratique?.id ?? '', { id: pratique?.id || nouvelId('bp'), magasin, date, titre: titre.trim(), theme: theme.trim(), texte: texte.trim(), par, photos, reprises: reprises.filter((r) => r !== magasin), jaime: pratique?.jaime ?? [] })
        const gardees = new Set(photos.map((p) => p.chemin))
        await supprimerPhotos([...new Set([...retirees, ...(pratique?.photos ?? []).map((p) => p.chemin)])].filter((c) => !gardees.has(c)))
        return pratique ? 'Bonne pratique mise à jour.' : 'Bonne pratique enregistrée.'
      }}
      supprimer={pratique ? async () => {
        await enregistrerPratique(pratique.id, null)
        await supprimerPhotos(pratique.photos.map((p) => p.chemin))
        return 'Bonne pratique supprimée.'
      } : undefined}
      libelleSuppression={pratique ? `Supprimer « ${pratique.titre} » ?` : undefined}
    >
      <TextField label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' } }}>
        <Autocomplete options={noms} value={magasin || null} onChange={(_e, v) => setMagasin(v ?? '')} renderInput={(p) => <TextField {...p} label="Magasin" />} noOptionsText="Aucun magasin ne correspond" />
        <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <Autocomplete freeSolo options={themesConnus(reseau.pratiques)} value={theme} onInputChange={(_e, v) => setTheme(v)} renderInput={(p) => <TextField {...p} label="Thème" />} />
        <Autocomplete options={visiteurs(reseau)} value={par || null} onChange={(_e, v) => setPar(v ?? '')} renderInput={(p) => <TextField {...p} label="Remontée par" />} noOptionsText="Aucune personne ne correspond" />
      </Box>
      <ChampDicte libelle="Ce que fait le magasin" valeur={texte} changer={setTexte} minRows={4} />
      <ChampPhotos photos={photos} onChange={setPhotos} onRetirer={(c) => setRetirees((x) => [...x, c])} />
      <Autocomplete multiple options={noms.filter((n) => n !== magasin)} value={reprises} onChange={(_e, v) => setReprises(v)} disableCloseOnSelect
        renderInput={(p) => <TextField {...p} label="Reprise par" />} noOptionsText="Aucun magasin ne correspond" />
    </Fenetre>
  )
}

// « J'aime » et commentaires d'une bonne pratique (anciens « J'aime » de l'équipe compris) : sur la page et dans le fil
export function ReactionsPratique({ p, reactions, lectureSeule, signaler }: { p: BonnePratique; reactions: ReactionsPratiques; lectureSeule: boolean; signaler: (m: string) => void }) {
  return (
    <Reactions titre={p.titre} pouces={reactions.pouces[p.id] ?? AUCUN} commentaires={reactions.commentaires[p.id] ?? AUCUN} autres={p.jaime} moi={reactions.moi}
      jour={new Date().toLocaleDateString('sv-SE')} lectureSeule={lectureSeule} basculer={() => basculerPoucePratique(p.id)} commenter={(t) => commenterPratique(p.id, t)}
      supprimer={supprimerCommentairePratique} message={messageReaction} apres={reactions.recharger} signaler={signaler} />
  )
}
const AUCUN: never[] = []

// Publication du fil des bonnes pratiques : magasin, photos en grand, texte, « J'aime » et reprises.
// modifier absent : lecture seule, sans lien vers les fiches des magasins (espace franchisé) ;
// ouvrables : magasins dont la fiche s'ouvre (ceux d'un Coach ou d'un RR), par défaut tous ;
// moi : nom de la personne de l'équipe qui réagit (absent : pas de bouton « J'aime ») ;
// reactions : « J'aime » et commentaires de la base, pour l'équipe et les franchisés (remplacent les anciens « J'aime »)
export function CartePratique({ p, modifier, sansMagasin, ouvrables, moi, reactions, lectureSeule = false, signaler = () => undefined }: {
  p: BonnePratique; modifier?: () => void; sansMagasin?: boolean; ouvrables?: Set<string>; moi?: string
  reactions?: ReactionsPratiques | null; lectureSeule?: boolean; signaler?: (m: string) => void
}) {
  const { recharger } = useReseau()
  const [jaime, setJaime] = useState(p.jaime ?? [])
  const [envoi, setEnvoi] = useState(false)
  useEffect(() => setJaime(p.jaime ?? []), [p.jaime])
  const aime = !!moi && jaime.includes(moi)
  const reagir = async () => {
    if (!moi || envoi) return
    setJaime(aime ? jaime.filter((n) => n !== moi) : [...jaime, moi])
    setEnvoi(true)
    try { await basculerJaime(p.id, moi); recharger() } catch { setJaime(p.jaime ?? []) } finally { setEnvoi(false) }
  }
  const nomMagasin = (nom: string, gras?: boolean) => (modifier && (!ouvrables || ouvrables.has(nom)) ? <Link component={RouterLink} to={lienFiche(nom)} color="inherit" sx={gras ? { fontWeight: 600 } : undefined}>{nom}</Link> : <Box component="span" sx={gras ? { fontWeight: 600 } : undefined}>{nom}</Box>)
  return (
    <Card component="article" aria-label={p.titre}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, pt: 1.5, pb: 1 }}>
        {!sansMagasin && <Initiales nom={p.magasin} taille={40} />}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {!sansMagasin && <Typography noWrap>{nomMagasin(p.magasin, true)}</Typography>}
          <Typography variant="body2" color="text.secondary" noWrap>{[dateCourte(p.date), p.par, p.theme].filter(Boolean).join(' · ')}</Typography>
        </Box>
        {modifier && <Tooltip title="Modifier"><IconButton onClick={modifier} aria-label={`Modifier la bonne pratique ${p.titre}`} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton></Tooltip>}
      </Box>
      {p.photos.length > 0 && <Box sx={{ px: 2 }}><GrillePhotos photos={p.photos} max={4} colonnes={2} /></Box>}
      <CardContent sx={{ pt: 1.5, pb: reactions ? '0 !important' : '8px !important' }}>
        <Typography variant="h4" component="h3">{p.titre}</Typography>
        {p.texte && <Typography variant="body1" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>{p.texte}</Typography>}
        {p.reprises.length > 0 && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            <Box component="span" color="text.secondary">Reprise par </Box>
            {p.reprises.map((r, i) => <span key={r}>{i ? ', ' : ''}{nomMagasin(r)}</span>)}
          </Typography>
        )}
        {!reactions && <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, ml: -1 }}>
          {moi ? (
            <Button onClick={reagir} aria-pressed={aime} startIcon={aime ? <Favorite /> : <FavoriteBorderOutlined />} color={aime ? 'error' : 'inherit'} sx={{ minHeight: 48, px: 1.5 }}>
              {jaime.length ? `J’aime · ${jaime.length}` : 'J’aime'}
            </Button>
          ) : jaime.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, minHeight: 40 }}><FavoriteBorderOutlined fontSize="small" />{jaime.length}</Typography>
          )}
          {jaime.length > 0 && moi && <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 0 }}>{jaime.slice(0, 3).join(', ')}{jaime.length > 3 ? ` et ${jaime.length - 3} autre${jaime.length > 4 ? 's' : ''}` : ''}</Typography>}
        </Box>}
      </CardContent>
      {reactions && <ReactionsPratique p={p} reactions={reactions} lectureSeule={lectureSeule} signaler={signaler} />}
    </Card>
  )
}

// filtre et integre : colonne de l'onglet Infos réseau, qui porte la recherche et les filtres communs
export function VuePratiques({ reseau, actions, modifier, filtre, integre = false }: { reseau: Reseau; actions?: ReactNode; modifier?: (p: BonnePratique) => void; filtre?: (p: BonnePratique) => boolean; integre?: boolean }) {
  const { profil } = useAuth()
  const { apercu, equipe } = useApercu()
  const reactions = useReactionsPratiques()
  const [message, setMessage] = useState('')
  // Réactions réservées à l'équipe : l'espace franchisé ne voit que le nombre
  const moi = modifier ? monNomPorteur(reseau, profil) || undefined : undefined
  const [recherche, setRecherche] = useState('')
  const [themes, setThemes] = useState<string[]>([])
  const presents = [...new Set(reseau.pratiques.map((p) => p.theme).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  const liste = useMemo(() => reseau.pratiques.filter((p) => (!themes.length || themes.includes(p.theme))
    && (!recherche || `${p.titre} ${p.magasin} ${p.texte}`.toLowerCase().includes(recherche.toLowerCase())) && (!filtre || filtre(p))), [reseau, themes, recherche, filtre])
  const reprises = reseau.pratiques.filter((p) => p.reprises.length > 0).length
  // Les pratiques de tout le réseau ; un Coach ou un RR ne modifie que celles de ses magasins
  const ouvrables = useMemo(() => new Set(reseau.magasins.map((m) => m.nom)), [reseau])
  return (
    <>
      {integre ? <TitreSection nombre={liste.length} action={actions}>Bonnes pratiques</TitreSection> : <RechercheFiltres actifs={themes.length ? 1 : 0} actions={actions}
        recherche={<ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher une pratique ou un magasin" />}>
        <FiltreMenu libelle="Thème" choisis={themes} onChange={setThemes} options={presents.map((t) => ({ valeur: t, libelle: t }))} />
        {(themes.length > 0 || recherche) && <Button onClick={() => { setThemes([]); setRecherche('') }} sx={{ minHeight: 36 }}>Effacer les filtres</Button>}
      </RechercheFiltres>}
      {!integre && <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {liste.length} bonne{liste.length > 1 ? 's' : ''} pratique{liste.length > 1 ? 's' : ''}{reseau.pratiques.length ? ` · ${reprises} reprise${reprises > 1 ? 's' : ''} ailleurs` : ''}
      </Typography>}
      {liste.length === 0
        ? <EmptyState icone={<TipsAndUpdatesOutlined />} titre="Aucune bonne pratique" texte={reseau.pratiques.length ? 'Aucune bonne pratique ne correspond à ces critères.' : 'Les initiatives réussies des magasins apparaîtront ici.'} />
        : <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 640, mx: 'auto' }}>{liste.map((p) => <CartePratique key={p.id} p={p} ouvrables={ouvrables} moi={moi} modifier={modifier && ouvrables.has(p.magasin) ? () => modifier(p) : undefined}
            reactions={reactions} lectureSeule={!!apercu || !!equipe} signaler={setMessage} />)}</Box>}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </>
  )
}
