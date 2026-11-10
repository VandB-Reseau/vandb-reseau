import { useCallback, useMemo, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'
import FilterAlt from '@mui/icons-material/FilterAlt'
import FilterAltOutlined from '@mui/icons-material/FilterAltOutlined'
import SearchIcon from '@mui/icons-material/SearchOutlined'
import { normaliser } from '../data/filtres'

// Tableaux harmonisés (Joseph, 10/11/2026, sur le modèle de la liste des magasins) : chaque colonne se trie d'un clic
// sur son titre (flèche à côté du libellé) et se filtre par l'entonnoir qui apparaît au survol (toujours visible sur
// écran tactile, et dès qu'un filtre est posé). Un seul moteur de tri et de filtre pour tous les tableaux de listes ;
// les tableaux de chiffres (compte de résultat, mois par mois) gardent l'ordre de leurs lignes.

export type Valeur = string | number | null | undefined
export type Sens = 'asc' | 'desc'
export interface ColonneTri<T> {
  cle: string
  libelle: string
  // Clé de tri ; null ou vide = sans valeur, toujours en fin de liste
  valeur: (l: T) => Valeur
  // Libellé de la valeur dans le filtre en liste (par défaut, la valeur elle-même)
  texte?: (l: T) => string
  // « liste » : valeurs à cocher ; « nombre » : bornes au moins / au plus ; false : pas de filtre.
  // Par défaut : « nombre » si toutes les valeurs sont des nombres, sinon « liste »
  filtre?: 'liste' | 'nombre' | false
  // Nombre comparé aux bornes, dans l'unité affichée (k€, %…) ; par défaut la valeur
  nombre?: (l: T) => number | null | undefined
  unite?: string
  tri?: false
  // Sens du premier clic : A à Z pour un texte, du plus haut au plus bas pour un nombre
  premier?: Sens
}
export type Filtre = { valeurs: string[] } | { min?: number; max?: number }
export type Tri = { cle: string; sens: Sens } | null

const SANS = '__sans__'
const texteDe = <T,>(c: ColonneTri<T>, l: T) => {
  const t = c.texte ? c.texte(l) : c.valeur(l)
  return t === null || t === undefined || t === '' ? SANS : String(t)
}
const nombreDe = <T,>(c: ColonneTri<T>, l: T) => {
  const n = c.nombre ? c.nombre(l) : c.valeur(l)
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}
const actifFiltre = (f: Filtre | undefined) => !!f && ('valeurs' in f ? f.valeurs.length > 0 : f.min !== undefined || f.max !== undefined)

function lire(memoire: string | undefined) {
  if (!memoire) return null
  try { const x = sessionStorage.getItem(`tableau:${memoire}`); return x ? JSON.parse(x) as { tri: Tri; filtres: Record<string, Filtre> } : null } catch { return null }
}

export function useTableau<T>(lignes: T[], colonnes: ColonneTri<T>[], reglages: { tri?: Tri; memoire?: string; controle?: { tri: Tri; changer: (t: Tri) => void } } = {}) {
  const depart = reglages.tri ?? null
  const [etatLocal, setEtat] = useState<{ tri: Tri; filtres: Record<string, Filtre> }>(() => lire(reglages.memoire) ?? { tri: depart, filtres: {} })
  // Tri tenu par la page (dans l'adresse, par exemple) : le tableau le lit et le lui renvoie
  const controle = reglages.controle
  const etat = controle ? { ...etatLocal, tri: controle.tri } : etatLocal
  const ranger = useCallback((e: { tri: Tri; filtres: Record<string, Filtre> }) => {
    if (controle && JSON.stringify(e.tri) !== JSON.stringify(controle.tri)) controle.changer(e.tri)
    setEtat(e)
    if (reglages.memoire) try { sessionStorage.setItem(`tableau:${reglages.memoire}`, JSON.stringify(e)) } catch { /* navigateur sans stockage */ }
  }, [reglages.memoire, controle])
  const parCle = useMemo(() => new Map(colonnes.map((c) => [c.cle, c])), [colonnes])
  const genre = useCallback((c: ColonneTri<T>): 'liste' | 'nombre' | false => {
    if (c.filtre !== undefined) return c.filtre
    const vals = lignes.map((l) => (c.nombre ? c.nombre(l) : c.valeur(l))).filter((v) => v !== null && v !== undefined && v !== '')
    return vals.length && vals.every((v) => typeof v === 'number') ? 'nombre' : 'liste'
  }, [lignes])
  const premierDe = useCallback((c: ColonneTri<T>): Sens => c.premier ?? (genre(c) === 'nombre' ? 'desc' : 'asc'), [genre])
  const passe = useCallback((l: T, sauf?: string) => Object.entries(etat.filtres).every(([cle, f]) => {
    const c = parCle.get(cle)
    if (!c || cle === sauf || !actifFiltre(f)) return true
    if ('valeurs' in f) return f.valeurs.includes(texteDe(c, l))
    const n = nombreDe(c, l)
    return n !== null && (f.min === undefined || n >= f.min) && (f.max === undefined || n <= f.max)
  }), [etat.filtres, parCle])
  const resultat = useMemo(() => {
    const filtrees = lignes.filter((l) => passe(l))
    const c = etat.tri && parCle.get(etat.tri.cle)
    if (!c || !etat.tri) return filtrees
    const s = etat.tri.sens === 'asc' ? 1 : -1
    return filtrees.map((l, i) => ({ l, i, v: c.valeur(l) })).sort((a, b) => {
      const va = a.v === '' ? null : a.v, vb = b.v === '' ? null : b.v
      const sa = va === null || va === undefined, sb = vb === null || vb === undefined
      if (sa || sb) return sa && sb ? a.i - b.i : sa ? 1 : -1
      const d = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'fr', { numeric: true, sensitivity: 'base' })
      return d * s || a.i - b.i
    }).map((x) => x.l)
  }, [lignes, passe, etat.tri, parCle])
  // Premier clic : sens naturel de la colonne ; deuxième : l'inverse ; troisième : retour à l'ordre de départ
  const trier = useCallback((cle: string) => {
    const c = parCle.get(cle); if (!c) return
    const p = premierDe(c)
    const t = etat.tri
    const suivant: Tri = !t || t.cle !== cle ? { cle, sens: p } : t.sens === p ? { cle, sens: p === 'asc' ? 'desc' : 'asc' } : depart && depart.cle !== cle ? depart : null
    ranger({ ...etat, tri: suivant })
  }, [parCle, premierDe, etat, depart, ranger])
  const filtrer = useCallback((cle: string, f: Filtre | null) => {
    const filtres = { ...etat.filtres }
    if (f && actifFiltre(f)) filtres[cle] = f; else delete filtres[cle]
    ranger({ ...etat, filtres })
  }, [etat, ranger])
  const effacer = useCallback(() => ranger({ tri: depart, filtres: {} }), [depart, ranger])
  const nbFiltres = Object.values(etat.filtres).filter(actifFiltre).length
  const triModifie = JSON.stringify(etat.tri) !== JSON.stringify(depart)
  // Valeurs proposées dans le filtre d'une colonne, avec leur nombre de lignes compte tenu des autres filtres
  const options = useCallback((cle: string) => {
    const c = parCle.get(cle); if (!c) return []
    const compte = new Map<string, number>()
    for (const l of lignes) { const v = texteDe(c, l); if (!compte.has(v)) compte.set(v, 0); if (passe(l, cle)) compte.set(v, compte.get(v)! + 1) }
    return [...compte.entries()].map(([valeur, n]) => ({ valeur, libelle: valeur === SANS ? '(vide)' : valeur, n }))
      .sort((a, b) => (a.valeur === SANS ? 1 : b.valeur === SANS ? -1 : a.libelle.localeCompare(b.libelle, 'fr', { numeric: true })))
  }, [lignes, parCle, passe])
  return {
    lignes: resultat, total: lignes.length, tri: etat.tri, filtres: etat.filtres, trier, filtrer, effacer, nbFiltres,
    modifie: nbFiltres > 0 || triModifie, colonne: (cle: string) => parCle.get(cle), genre, premierDe, options,
  }
}
export type Tableau<T> = ReturnType<typeof useTableau<T>>

// Rendu commun des listes en tableau, celui de la liste des magasins : lignes de 44 px, texte à 14 px
export const styleListe = {
  '& td, & th': { py: 0.75, px: 1.5, fontSize: '0.875rem' },
  '& th': { fontWeight: 700, color: 'text.secondary', whiteSpace: 'nowrap' },
  '& tbody tr': { height: 44 },
} as const

// Titre de colonne : libellé et flèche de tri (comme la liste des magasins), entonnoir de filtre à droite
export function Entete<T>({ t, cle, children, align, sx, sansFiltre, avant }: { t: Tableau<T>; cle: string; children?: ReactNode; align?: 'left' | 'right' | 'center'; sx?: SxProps<Theme>; sansFiltre?: boolean; avant?: ReactNode }) {
  const c = t.colonne(cle)
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  if (!c) return <TableCell align={align} sx={sx}>{children}</TableCell>
  const actif = t.tri?.cle === cle
  const genre = sansFiltre ? false : t.genre(c)
  const filtre = t.filtres[cle]
  const filtreActif = actifFiltre(filtre)
  const libelle = children ?? c.libelle
  return (
    <TableCell align={align} sortDirection={actif ? t.tri!.sens : false}
      sx={[{ position: 'relative', '&:hover .filtre-colonne, & .filtre-colonne:focus-visible': { opacity: 1 }, '@media (hover: none)': { '& .filtre-colonne': { opacity: 1 } } }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, flexDirection: align === 'right' ? 'row-reverse' : 'row', maxWidth: '100%' }}>
        {avant}
        {c.tri === false ? <span>{libelle}</span> : (
          <TableSortLabel active={actif} direction={actif ? t.tri!.sens : t.premierDe(c)} onClick={() => t.trier(cle)} aria-label={`Trier par ${c.libelle}`}
            sx={{ minHeight: { xs: 48, md: 'auto' }, '&.MuiTableSortLabel-root': { color: actif ? 'text.primary' : 'inherit' }, flexDirection: align === 'right' ? 'row-reverse' : 'row', '& .MuiTableSortLabel-icon': { mx: 0.5 } }}>
            {libelle}
          </TableSortLabel>
        )}
        {genre && (
          <Tooltip title={filtreActif ? 'Filtre posé' : 'Filtrer'}>
            <IconButton className="filtre-colonne pas-a-l-impression" aria-label={`Filtrer ${c.libelle}`} onClick={(e) => setAncre(e.currentTarget)}
              // Sur PC, l'entonnoir caché ne prend pas de place : il se pose au bord du titre au survol, et ne prend sa
              // place dans le titre qu'une fois un filtre posé (la largeur des colonnes ne bouge pas)
              sx={{ width: { xs: 48, md: 28 }, height: { xs: 48, md: 28 }, my: { xs: -1, md: filtreActif ? -1 : 0 }, color: filtreActif ? 'text.primary' : 'text.secondary',
                opacity: filtreActif || ancre ? 1 : 0, transition: 'opacity 120ms',
                ...(!filtreActif && { position: { md: 'absolute' }, top: { md: '50%' }, transform: { md: 'translateY(-50%)' }, [align === 'right' ? 'left' : 'right']: { md: 2 }, bgcolor: { md: 'background.paper' } }) }}>
              {filtreActif ? <FilterAlt sx={{ fontSize: 18 }} /> : <FilterAltOutlined sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {ancre && genre === 'liste' && <MenuListe t={t} c={c} ancre={ancre} fermer={() => setAncre(null)} />}
      {ancre && genre === 'nombre' && <MenuNombre t={t} c={c} ancre={ancre} fermer={() => setAncre(null)} />}
    </TableCell>
  )
}

function MenuListe<T>({ t, c, ancre, fermer }: { t: Tableau<T>; c: ColonneTri<T>; ancre: HTMLElement; fermer: () => void }) {
  const [q, setQ] = useState('')
  const toutes = t.options(c.cle)
  const f = t.filtres[c.cle]
  const choisis = f && 'valeurs' in f ? f.valeurs : []
  const recherche = toutes.length > 8
  const options = q ? toutes.filter((o) => normaliser(o.libelle).includes(normaliser(q))) : toutes
  const basculer = (v: string) => t.filtrer(c.cle, { valeurs: choisis.includes(v) ? choisis.filter((x) => x !== v) : [...choisis, v] })
  return (
    <Menu anchorEl={ancre} open onClose={fermer} autoFocus={!recherche} slotProps={{ paper: { sx: { maxHeight: 440, minWidth: 260 } } }}>
      {recherche && (
        <Box sx={{ px: 1.5, pb: 1 }} onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation() }}>
          <TextField size="small" fullWidth autoFocus placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)}
            slotProps={{ htmlInput: { 'aria-label': `Rechercher dans ${c.libelle}` }, input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
        </Box>
      )}
      {options.map((o) => (
        <MenuItem key={o.valeur} dense sx={{ minHeight: 44 }} onClick={() => basculer(o.valeur)}>
          <Checkbox checked={choisis.includes(o.valeur)} size="small" sx={{ p: 0.5, mr: 1 }} tabIndex={-1} />
          <ListItemText primary={o.libelle} />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2, fontVariantNumeric: 'tabular-nums' }}>{o.n}</Typography>
        </MenuItem>
      ))}
      {options.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>Aucune valeur ne correspond.</Typography>}
      {choisis.length > 0 && <Divider />}
      {choisis.length > 0 && <MenuItem onClick={() => { t.filtrer(c.cle, null); fermer() }} sx={{ justifyContent: 'center', minHeight: 44 }}><Button size="small">Tout afficher</Button></MenuItem>}
    </Menu>
  )
}

function MenuNombre<T>({ t, c, ancre, fermer }: { t: Tableau<T>; c: ColonneTri<T>; ancre: HTMLElement; fermer: () => void }) {
  const f = t.filtres[c.cle]
  const borne = f && !('valeurs' in f) ? f : {}
  const [min, setMin] = useState(borne.min?.toString().replace('.', ',') ?? '')
  const [max, setMax] = useState(borne.max?.toString().replace('.', ',') ?? '')
  const lireNombre = (s: string) => { const n = Number(s.replace(/\s/g, '').replace(',', '.')); return s.trim() === '' || !Number.isFinite(n) ? undefined : n }
  const appliquer = (a: string, b: string) => t.filtrer(c.cle, { min: lireNombre(a), max: lireNombre(b) })
  const suffixe = c.unite ? { input: { endAdornment: <InputAdornment position="end">{c.unite}</InputAdornment> } } : undefined
  return (
    <Menu anchorEl={ancre} open onClose={fermer} autoFocus={false} slotProps={{ paper: { sx: { minWidth: 260 } } }}>
      <Box sx={{ px: 2, pt: 0.5, pb: 1.5, display: 'grid', gap: 1.5 }} onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation() }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.libelle}</Typography>
        <TextField size="small" label="Au moins" value={min} autoFocus onChange={(e) => { setMin(e.target.value); appliquer(e.target.value, max) }} slotProps={{ htmlInput: { inputMode: 'decimal' }, ...suffixe }} />
        <TextField size="small" label="Au plus" value={max} onChange={(e) => { setMax(e.target.value); appliquer(min, e.target.value) }} slotProps={{ htmlInput: { inputMode: 'decimal' }, ...suffixe }} />
        {actifFiltre(f) && <Button size="small" onClick={() => { t.filtrer(c.cle, null); fermer() }}>Tout afficher</Button>}
      </Box>
    </Menu>
  )
}

// Ligne affichée quand les filtres ne laissent plus rien : le dit et propose de tout réafficher
export function LigneSansResultat<T>({ t, colSpan, quoi = 'Aucune ligne ne correspond' }: { t: Tableau<T>; colSpan: number; quoi?: string }) {
  if (t.lignes.length || !t.total) return null
  return (
    <TableRow>
      <TableCell colSpan={colSpan} sx={{ py: 3, textAlign: 'center', '&&': { position: 'static' } }}>
        <Typography sx={{ mb: 1 }}>{quoi} à ces filtres.</Typography>
        <Button variant="outlined" onClick={t.effacer}>Effacer les filtres</Button>
      </TableCell>
    </TableRow>
  )
}

// Bouton « Effacer tri et filtres », visible dès qu'un tri ou un filtre a été posé
export function EffacerTriFiltres<T>({ t, sx }: { t: Tableau<T>; sx?: SxProps<Theme> }) {
  if (!t.modifie) return null
  return <Button onClick={t.effacer} className="pas-a-l-impression" sx={[{ minHeight: 40 }, ...(Array.isArray(sx) ? sx : [sx])]}>{t.nbFiltres ? `Effacer tri et filtres (${t.nbFiltres})` : 'Effacer tri et filtres'}</Button>
}
