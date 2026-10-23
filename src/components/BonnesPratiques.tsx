import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import CircularProgress from '@mui/material/CircularProgress'
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
import { basculerPoucePratique, commenterPratique, messageReaction, noterPratiquesLues, supprimerCommentairePratique, useLecturesPratiques, useReactionsPratiques, type LecturePratique, type ReactionsPratiques } from '../data/reactionsPratiques'
import { LigneLecture } from './LigneLecture'
import { useAuth } from '../auth/AuthContext'
import { monNomPorteur } from '../data/actions'
import { ChampRecherche } from './Outils'
import { FiltreMenu } from './FiltreMenu'
import { RechercheFiltres } from './RechercheFiltres'
import { EmptyState } from './EmptyState'
import { FilCanal } from './FilCanal'
import { visiteurs } from './DialogVisite'
import { basculerJaime, enregistrerPratique } from '../data/chargement'
import { themesConnus, type BonnePratique } from '../data/bonnesPratiques'
import { nouvelId, type Photo } from '../data/grilles'
import { envoyerPhoto, lienPhoto, messagePhoto, supprimerPhotos } from '../lib/photos'
import { dateCourte, lienFiche } from '../lib/format'
import type { Reseau } from '../data/modele'

// depart : proposition d'un franchisé reprise pour relecture ; apres : appelé avec l'identifiant de la pratique enregistrée
export function DialogPratique({ reseau, pratique, magasinInitial = '', depart, apres, onFermer }: {
  reseau: Reseau; pratique: BonnePratique | null; magasinInitial?: string; depart?: { magasin: string; titre: string; texte: string; par: string }
  apres?: (id: string) => Promise<void>; onFermer: (m?: string) => void
}) {
  const [magasin, setMagasin] = useState(pratique?.magasin ?? depart?.magasin ?? magasinInitial)
  const [date, setDate] = useState(pratique?.date ?? reseau.jour)
  const [titre, setTitre] = useState(pratique?.titre ?? depart?.titre ?? '')
  const [theme, setTheme] = useState(pratique?.theme ?? '')
  const [texte, setTexte] = useState(pratique?.texte ?? depart?.texte ?? '')
  const [par, setPar] = useState(pratique?.par ?? depart?.par ?? reseau.directeur.nom)
  // La photo d'en-tête est rangée avec les photos (les franchisés voient ainsi les mêmes), en tête de liste
  const [entete, setEntete] = useState<Photo | null>(pratique?.photos.find((ph) => ph.chemin === pratique.entete) ?? null)
  const [photos, setPhotos] = useState<Photo[]>(pratique?.photos.filter((ph) => ph.chemin !== pratique.entete) ?? [])
  const [reprises, setReprises] = useState<string[]>(pratique?.reprises ?? [])
  const [retirees, setRetirees] = useState<string[]>([])
  const noms = reseau.magasins.map((m) => m.nom)
  const valide = !!magasin && !!titre.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date)
  return (
    <Fenetre
      large ouvert onFermer={onFermer} valide={valide} titre={pratique ? 'Modifier la bonne pratique' : depart ? 'Relire et publier' : 'Nouvelle bonne pratique'}
      enregistrer={async () => {
        const toutes = entete ? [entete, ...photos] : photos
        const id = pratique?.id || nouvelId('bp')
        await enregistrerPratique(pratique?.id ?? '', { id, magasin, date, titre: titre.trim(), theme: theme.trim(), texte: texte.trim(), par, photos: toutes, entete: entete?.chemin ?? '', reprises: reprises.filter((r) => r !== magasin), jaime: pratique?.jaime ?? [] })
        const gardees = new Set(toutes.map((p) => p.chemin))
        await supprimerPhotos([...new Set([...retirees, ...(pratique?.photos ?? []).map((p) => p.chemin)])].filter((c) => !gardees.has(c)))
        if (apres) await apres(id)
        return pratique ? 'Bonne pratique mise à jour.' : depart ? 'Bonne pratique publiée.' : 'Bonne pratique enregistrée.'
      }}
      supprimer={pratique ? async () => {
        await enregistrerPratique(pratique.id, null)
        await supprimerPhotos(pratique.photos.map((p) => p.chemin))
        return 'Bonne pratique supprimée.'
      } : undefined}
      libelleSuppression={pratique ? `Supprimer « ${pratique.titre} » ?` : undefined}
    >
      <TextField label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
      <ChampEntetePhoto photo={entete} changer={(ph) => { if (entete && !ph) setRetirees((x) => [...x, entete.chemin]); setEntete(ph) }} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' } }}>
        <Autocomplete options={noms} value={magasin || null} onChange={(_e, v) => setMagasin(v ?? '')} renderInput={(p) => <TextField {...p} label="Magasin" />} noOptionsText="Aucun magasin ne correspond" />
        <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <Autocomplete freeSolo options={themesConnus(reseau.pratiques)} value={theme} onInputChange={(_e, v) => setTheme(v)} renderInput={(p) => <TextField {...p} label="Thème" />} />
        <Autocomplete options={[...new Set([...visiteurs(reseau), ...(depart?.par ? [depart.par] : [])])]} value={par || null} onChange={(_e, v) => setPar(v ?? '')} renderInput={(p) => <TextField {...p} label="Remontée par" />} noOptionsText="Aucune personne ne correspond" />
      </Box>
      <ChampDicte libelle="Ce que fait le magasin" valeur={texte} changer={setTexte} minRows={4} />
      <ChampPhotos photos={photos} onChange={setPhotos} onRetirer={(c) => setRetirees((x) => [...x, c])} />
      <Autocomplete multiple options={noms.filter((n) => n !== magasin)} value={reprises} onChange={(_e, v) => setReprises(v)} disableCloseOnSelect
        renderInput={(p) => <TextField {...p} label="Reprise par" />} noOptionsText="Aucun magasin ne correspond" />
    </Fenetre>
  )
}

// Photo d'en-tête : pleine largeur, proportions gardées, comme celle d'une communication
function BannierePhoto({ chemin, alt, children }: { chemin: string; alt: string; children?: ReactNode }) {
  const [lien, setLien] = useState<string | null>(null)
  useEffect(() => {
    let actif = true
    void lienPhoto(chemin).then((l) => { if (actif) setLien(l) })
    return () => { actif = false }
  }, [chemin])
  return (
    <Box sx={{ position: 'relative', bgcolor: '#ffffff', minHeight: lien ? 0 : 120 }}>
      {lien && <Box component="img" src={lien} alt={alt} sx={{ display: 'block', mx: 'auto', maxWidth: '100%', maxHeight: { xs: 220, sm: 320 }, objectFit: 'contain' }} />}
      {children}
    </Box>
  )
}

function ChampEntetePhoto({ photo, changer }: { photo: Photo | null; changer: (p: Photo | null) => void }) {
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const entree = useRef<HTMLInputElement | null>(null)
  const choisir = async (f: File | undefined) => {
    if (!f) return
    setEnvoi(true); setErreur('')
    try { changer(await envoyerPhoto(f)) } catch (e) { setErreur(messagePhoto(e)) } finally { setEnvoi(false) }
  }
  return (
    <Box>
      <input ref={entree} type="file" accept="image/*" hidden aria-label="Photo d’en-tête" onChange={(e) => { void choisir(e.target.files?.[0]); e.target.value = '' }} />
      {photo ? (
        <Box sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <BannierePhoto chemin={photo.chemin} alt="Photo d’en-tête">
            <IconButton aria-label="Retirer la photo d’en-tête" onClick={() => changer(null)}
              sx={{ position: 'absolute', top: 8, right: 8, width: 48, height: 48, bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}>
              <DeleteOutlined />
            </IconButton>
          </BannierePhoto>
        </Box>
      ) : (
        <Button startIcon={envoi ? <CircularProgress size={18} /> : <ImageOutlined />} onClick={() => entree.current?.click()} disabled={envoi} sx={{ minHeight: 48, ml: -1 }}>
          {envoi ? 'Envoi de la photo…' : 'Photo d’en-tête'}
        </Button>
      )}
      {erreur && <Typography color="error" variant="body2">{erreur}</Typography>}
    </Box>
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
export function CartePratique({ p, modifier, sansMagasin, ouvrables, moi, reactions, lectureSeule = false, signaler = () => undefined, lecture }: {
  p: BonnePratique; modifier?: () => void; sansMagasin?: boolean; ouvrables?: Set<string>; moi?: string
  reactions?: ReactionsPratiques | null; lectureSeule?: boolean; signaler?: (m: string) => void; lecture?: LecturePratique
}) {
  const { recharger } = useReseau()
  const [jaime, setJaime] = useState(p.jaime ?? [])
  const [envoi, setEnvoi] = useState(false)
  useEffect(() => setJaime(p.jaime ?? []), [p.jaime])
  const aime = !!moi && jaime.includes(moi)
  const autresPhotos = p.photos.filter((ph) => ph.chemin !== p.entete)
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
      {p.entete && <Box sx={{ mb: 1 }}><BannierePhoto chemin={p.entete} alt={`Photo d’en-tête de ${p.titre}`} /></Box>}
      {autresPhotos.length > 0 && <Box sx={{ px: 2 }}><GrillePhotos photos={autresPhotos} max={4} colonnes={2} /></Box>}
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
      {lecture && <LigneLecture l={lecture} vue />}
      {reactions && <ReactionsPratique p={p} reactions={reactions} lectureSeule={lectureSeule} signaler={signaler} />}
    </Card>
  )
}

// filtre et integre : colonne de l'onglet Infos réseau, qui porte la recherche et les filtres communs
// enFil : canal « Bonnes pratiques » des Messages, les pratiques défilent comme dans un groupe, actions en pied
export function VuePratiques({ reseau, actions, modifier, filtre, integre = false, enFil = false }: { reseau: Reseau; actions?: ReactNode; modifier?: (p: BonnePratique) => void; filtre?: (p: BonnePratique) => boolean; integre?: boolean; enFil?: boolean }) {
  const { profil } = useAuth()
  const { apercu, equipe } = useApercu()
  const reactions = useReactionsPratiques()
  // « Vu par » : le Directeur et les Responsables Régionaux suivent qui a vu chaque pratique ; un franchisé qui les affiche les a vues
  const lectures = useLecturesPratiques(!apercu && !equipe && (profil?.role === 'directeur' || profil?.role === 'rr'))
  const vuesParFranchise = !apercu && profil?.role === 'franchise' ? reseau.pratiques.map((p) => p.id).join(',') : ''
  useEffect(() => { if (vuesParFranchise) void noterPratiquesLues(vuesParFranchise.split(',')).catch(() => undefined) }, [vuesParFranchise])
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
  const carte = (p: BonnePratique) => <CartePratique key={p.id} p={p} ouvrables={ouvrables} moi={moi} modifier={modifier && ouvrables.has(p.magasin) ? () => modifier(p) : undefined}
    reactions={reactions} lectureSeule={!!apercu || !!equipe} signaler={setMessage} lecture={lectures?.get(p.id)} />
  const vide = <EmptyState icone={<TipsAndUpdatesOutlined />} titre="Aucune bonne pratique" texte={reseau.pratiques.length ? 'Aucune bonne pratique ne correspond à ces critères.' : 'Les initiatives réussies des magasins apparaîtront ici.'} />
  if (enFil) {
    return (
      <>
        <FilCanal libelle="Bonnes pratiques" publications={reseau.pratiques.map((p) => ({ cle: p.id, instant: `${p.date}T12:00:00`, contenu: carte(p) }))} vide={vide} pied={actions} />
        <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
      </>
    )
  }
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
      {liste.length === 0 ? vide
        : <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 640, mx: 'auto' }}>{liste.map(carte)}</Box>}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </>
  )
}
