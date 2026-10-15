import { useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import EditOutlined from '@mui/icons-material/EditOutlined'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import { Fenetre } from './EditionEquipe'
import { ChampDicte } from './SaisieCompteRendu'
import { ChampPhotos, RangeePhotos } from './GrilleAudit'
import { ChampRecherche } from './Outils'
import { FiltreMenu } from './FiltreMenu'
import { RechercheFiltres } from './RechercheFiltres'
import { EmptyState } from './EmptyState'
import { visiteurs } from './DialogVisite'
import { enregistrerPratique } from '../data/chargement'
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
        await enregistrerPratique(pratique?.id ?? '', { id: pratique?.id || nouvelId('bp'), magasin, date, titre: titre.trim(), theme: theme.trim(), texte: texte.trim(), par, photos, reprises: reprises.filter((r) => r !== magasin) })
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

export function CartePratique({ p, modifier, sansMagasin }: { p: BonnePratique; modifier: () => void; sansMagasin?: boolean }) {
  return (
    <Card component="article" aria-label={p.titre}>
      <CardContent sx={{ pb: '16px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h4" component="h3">{p.titre}</Typography>
            <Typography variant="body2" color="text.secondary">
              {!sansMagasin && <><Link component={RouterLink} to={lienFiche(p.magasin)} sx={{ fontWeight: 600 }}>{p.magasin}</Link> · </>}
              {dateCourte(p.date)}{p.par ? ` · ${p.par}` : ''}
            </Typography>
          </Box>
          <Tooltip title="Modifier"><IconButton onClick={modifier} aria-label={`Modifier la bonne pratique ${p.titre}`} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton></Tooltip>
        </Box>
        {p.theme && <Chip label={p.theme} size="small" sx={{ mt: 1, fontSize: '0.75rem' }} />}
        {p.texte && <Typography variant="body1" sx={{ mt: 1, whiteSpace: 'pre-line' }}>{p.texte}</Typography>}
        <RangeePhotos photos={p.photos} />
        {p.reprises.length > 0 && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            <Box component="span" color="text.secondary">Reprise par </Box>
            {p.reprises.map((r, i) => <span key={r}>{i ? ', ' : ''}<Link component={RouterLink} to={lienFiche(r)}>{r}</Link></span>)}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

export function VuePratiques({ reseau, actions, modifier }: { reseau: Reseau; actions: ReactNode; modifier: (p: BonnePratique) => void }) {
  const [recherche, setRecherche] = useState('')
  const [themes, setThemes] = useState<string[]>([])
  const presents = [...new Set(reseau.pratiques.map((p) => p.theme).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  const liste = useMemo(() => reseau.pratiques.filter((p) => (!themes.length || themes.includes(p.theme))
    && (!recherche || `${p.titre} ${p.magasin} ${p.texte}`.toLowerCase().includes(recherche.toLowerCase()))), [reseau, themes, recherche])
  const reprises = reseau.pratiques.filter((p) => p.reprises.length > 0).length
  return (
    <>
      <RechercheFiltres actifs={themes.length ? 1 : 0} actions={actions}
        recherche={<ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher une pratique ou un magasin" />}>
        <FiltreMenu libelle="Thème" choisis={themes} onChange={setThemes} options={presents.map((t) => ({ valeur: t, libelle: t }))} />
        {(themes.length > 0 || recherche) && <Button onClick={() => { setThemes([]); setRecherche('') }} sx={{ minHeight: 36 }}>Effacer les filtres</Button>}
      </RechercheFiltres>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {liste.length} bonne{liste.length > 1 ? 's' : ''} pratique{liste.length > 1 ? 's' : ''}{reseau.pratiques.length ? ` · ${reprises} reprise${reprises > 1 ? 's' : ''} ailleurs` : ''}
      </Typography>
      {liste.length === 0
        ? <EmptyState icone={<TipsAndUpdatesOutlined />} titre="Aucune bonne pratique" texte={reseau.pratiques.length ? 'Aucune bonne pratique ne correspond à ces filtres.' : 'Les initiatives réussies des magasins apparaîtront ici.'} />
        : <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>{liste.map((p) => <CartePratique key={p.id} p={p} modifier={() => modifier(p)} />)}</Box>}
    </>
  )
}
