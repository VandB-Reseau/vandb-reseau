import { useEffect, useRef, useState, type ReactNode } from 'react'
import Button from '@mui/material/Button'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ViewAgendaOutlined from '@mui/icons-material/ViewAgendaOutlined'
import TableChartOutlined from '@mui/icons-material/TableChartOutlined'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import { alpha, type Theme } from '@mui/material/styles'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import { brand, styleSignal, type CouleurSignal } from '../theme/theme'
import { lienPhoto } from '../lib/photos'
import type { Photo } from '../data/grilles'

// Briques visuelles communes « façon app » : avatars à initiales, lignes compactes, une seule pastille par ligne,
// puces de filtre. Validées sur la maquette du 20/10/2026.

const TEINTES = [brand.or, brand.vert, brand.orange, brand.beige, brand.brique, brand.anthracite]

function teinte(nom: string): string {
  let h = 0
  for (const c of nom) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TEINTES[h % TEINTES.length]
}

// Deux premières lettres du nom : « Lyon Part-Dieu » → « LY » (« V and B » ignoré)
export function initialesDe(nom: string): string {
  const mots = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^v and b\s+/i, '').split(/[\s-]+/).filter((m) => /^[a-z0-9]/i.test(m))
  return (mots[0] ?? nom).slice(0, 2).toUpperCase()
}

export function Initiales({ nom, taille = 44, icone, couleur }: { nom: string; taille?: number; icone?: ReactNode; couleur?: string }) {
  const c = couleur ?? teinte(nom)
  return (
    <Box aria-hidden sx={{
      width: taille, height: taille, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
      bgcolor: alpha(c, 0.2), color: 'text.primary', fontWeight: 600, fontSize: taille >= 64 ? '1.5rem' : '0.9375rem',
      '& svg': { fontSize: taille * 0.5 },
    }}>
      {icone ?? initialesDe(nom)}
    </Box>
  )
}

export type Ton = 'rouge' | 'orange' | 'vert' | 'gris' | 'bleu'
const signaux: Record<Exclude<Ton, 'rouge' | 'gris'>, CouleurSignal> = { orange: 'warning', bleu: 'info', vert: 'success' }

// Pastille unique d'une ligne : la plus grave seulement. Seul le rouge est plein ;
// les autres tons sont un texte coloré précédé d'un point, pour que les alertes ressortent.
export function Pastille({ ton, children }: { ton: Ton; children: ReactNode }) {
  const forme = { flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 0.75, borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.5, whiteSpace: 'nowrap' } as const
  if (ton === 'rouge') return <Box component="span" sx={{ ...forme, px: 1.25, py: 0.5, bgcolor: '#c24119', color: '#ffffff' }}>{children}</Box>
  if (ton === 'gris') return <Box component="span" sx={{ ...forme, py: 0.5, color: 'text.secondary' }}>{children}</Box>
  return <Box component="span" sx={(t) => ({ ...forme, py: 0.5, ...styleSignal(t, signaux[ton]) })}>{children}</Box>
}

// Ligne compacte : avatar, titre, détail sur une ligne, puis une pastille ou une valeur à droite
// actions : boutons à droite, hors de la zone cliquable de la ligne
export function LigneCompacte({ avatar, titre, detail, fin, lien, onClick, label, actions }: { avatar?: ReactNode; titre: ReactNode; detail?: ReactNode; fin?: ReactNode; lien?: string; onClick?: () => void; label?: string; actions?: ReactNode }) {
  if (actions) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex' }}><LigneCompacte avatar={avatar} titre={titre} detail={detail} fin={fin} lien={lien} onClick={onClick} label={label} /></Box>
        {actions}
      </Box>
    )
  }
  const contenu = (
    <>
      {avatar}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titre}</Typography>
        {detail && <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</Typography>}
      </Box>
      {fin}
    </>
  )
  const sx = { display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, minHeight: 64, width: '100%', textAlign: 'left', justifyContent: 'flex-start', color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } } as const
  if (lien) return <ButtonBase component={RouterLink} to={lien} aria-label={label} sx={sx}>{contenu}</ButtonBase>
  if (onClick) return <ButtonBase onClick={onClick} aria-label={label} sx={sx}>{contenu}</ButtonBase>
  return <Box sx={{ ...sx, '&:hover': undefined }}>{contenu}</Box>
}

// Carte blanche aux coins arrondis, lignes séparées par un filet
export function CarteLignes({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <Card component="section" aria-label={label} sx={{ overflow: 'hidden', border: 0, '& > * + *': { borderTop: '1px solid', borderColor: 'divider' } }}>
      {children}
    </Card>
  )
}

// Intitulé en cartouche noir, lettres blanches en capitales, légèrement penché, comme les intitulés de la charte V and B
// En mode sombre, le cartouche passe en jaune-or, lettres noires, pour rester visible sur le fond noir
export const cartouche = (theme: Theme) => ({
  display: 'inline-block', px: 1, py: 0.25, bgcolor: '#1d1d1b', color: '#ffffff', fontSize: '0.8125rem', fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', transform: 'rotate(-1.5deg)',
  ...theme.applyStyles('dark', { bgcolor: brand.or, color: '#1d1d1b' }),
})

// Titre de section en cartouche, avec un nombre à droite
export function TitreSection({ children, nombre, action }: { children: ReactNode; nombre?: number; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, mb: 1, minHeight: 40 }}>
      <Typography component="h2" sx={cartouche}>{children}</Typography><Box sx={{ flex: 1 }} />
      {nombre !== undefined && <Typography sx={{ fontWeight: 600 }}>{nombre}</Typography>}
      {action}
    </Box>
  )
}

// Puces de filtre (une seule active), zone tactile de 48 px
export function Puces<V extends string>({ valeur, options, onChange, label }: { valeur: V; options: { v: V; libelle: string }[]; onChange: (v: V) => void; label: string }) {
  return (
    <Box role="group" aria-label={label} sx={{ display: 'flex', gap: 1, overflowX: 'auto', mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, mb: 1, scrollbarWidth: 'none' }}>
      {options.map((o) => {
        const actif = o.v === valeur
        return (
          <ButtonBase key={o.v} onClick={() => onChange(o.v)} aria-pressed={actif}
            sx={{ flexShrink: 0, minHeight: 48, px: 0.25, fontFamily: 'inherit', '& > span': { px: 1.75, height: 40, display: 'flex', alignItems: 'center', borderRadius: 999, border: '1px solid', fontSize: '0.875rem', fontWeight: actif ? 600 : 500, borderColor: actif ? 'primary.main' : 'divider', bgcolor: actif ? 'primary.main' : 'background.paper', color: actif ? 'primary.contrastText' : 'text.primary' } }}>
            <span>{o.libelle}</span>
          </ButtonBase>
        )
      })}
    </Box>
  )
}

// Mini-courbe (12 derniers mois par exemple), dessinée en SVG, sans axe
export function MiniCourbe({ valeurs, couleur, largeur = 96, hauteur = 32, label }: { valeurs: (number | null)[]; couleur: string; largeur?: number; hauteur?: number; label?: string }) {
  const pts = valeurs.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null)
  if (pts.length < 2) return <Box sx={{ width: largeur, height: hauteur, flexShrink: 0 }} />
  const min = Math.min(...pts.map((p) => p.v)), max = Math.max(...pts.map((p) => p.v))
  const ecart = max - min || 1
  const n = valeurs.length - 1 || 1
  const x = (i: number) => 2 + (i / n) * (largeur - 6)
  const y = (v: number) => hauteur - 3 - ((v - min) / ecart) * (hauteur - 6)
  const d = pts.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const der = pts[pts.length - 1]
  return (
    <Box component="svg" width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} sx={{ flexShrink: 0, display: 'block' }}>
      <polyline fill="none" stroke={couleur} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" points={d} />
      <circle cx={x(der.i)} cy={y(der.v)} r={3.5} fill={couleur} />
    </Box>
  )
}

// Liens des photos gardés une demi-heure : le fil ne redemande pas le même lien à chaque affichage
const liens = new Map<string, { quand: number; lien: Promise<string | null> }>()
function lienGarde(chemin: string) {
  const g = liens.get(chemin)
  if (g && Date.now() - g.quand < 30 * 60_000) return g.lien
  const lien = lienPhoto(chemin)
  liens.set(chemin, { quand: Date.now(), lien })
  return lien
}

function useLienPhoto(chemin: string) {
  const [lien, setLien] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let actif = true
    setLien(undefined)
    lienGarde(chemin).then((l) => { if (actif) setLien(l) })
    return () => { actif = false }
  }, [chemin])
  return lien
}

// Petites vignettes sur une ligne de liste (la ligne entière reste le lien) : au plus deux, puis « +n »
export function MiniPhotos({ photos }: { photos: Photo[] | undefined }) {
  if (!photos?.length) return null
  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
      {photos.slice(0, 2).map((p) => <MiniPhoto key={p.chemin} chemin={p.chemin} />)}
      {photos.length > 2 && <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>+{photos.length - 2}</Typography>}
    </Box>
  )
}
function MiniPhoto({ chemin }: { chemin: string }) {
  const lien = useLienPhoto(chemin)
  return lien
    ? <Box component="img" src={lien} alt="" sx={{ width: 40, height: 40, borderRadius: 1, objectFit: 'cover', display: 'block' }} />
    : <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: 'action.hover' }} />
}

function Vignette({ chemin, numero, reste, onOuvrir }: { chemin: string; numero: number; reste?: number; onOuvrir: () => void }) {
  const lien = useLienPhoto(chemin)
  return (
    <ButtonBase onClick={onOuvrir} aria-label={reste ? `Voir les photos, ${reste} de plus` : `Agrandir la photo ${numero}`}
      sx={{ position: 'relative', aspectRatio: '1 / 1', bgcolor: 'action.hover', display: 'grid', placeItems: 'center', color: 'text.secondary', overflow: 'hidden', borderRadius: 2 }}>
      {lien ? <Box component="img" src={lien} alt={`Photo ${numero}`} loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <ImageOutlined aria-hidden />}
      {!!reste && <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.5)', color: '#ffffff', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: '1.125rem' }}>+{reste}</Box>}
    </ButtonBase>
  )
}

// Photo en plein écran : flèches ou balayage pour passer d'une photo à l'autre
function PhotosPleinEcran({ photos, depart, onFermer }: { photos: Photo[]; depart: number; onFermer: () => void }) {
  const [i, setI] = useState(depart)
  const lien = useLienPhoto(photos[i].chemin)
  const doigt = useRef<number | null>(null)
  const aller = (d: number) => setI((n) => Math.min(photos.length - 1, Math.max(0, n + d)))
  const bouton = { color: '#ffffff', width: 48, height: 48, bgcolor: 'rgba(0,0,0,0.4)', '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' } }
  return (
    <Dialog open fullScreen onClose={onFermer} slotProps={{ paper: { 'aria-label': 'Photos', sx: { bgcolor: '#000000', color: '#ffffff' } } }}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft') aller(-1); if (e.key === 'ArrowRight') aller(1) }}>
      <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
        <Typography sx={{ fontWeight: 600, px: 1 }}>{i + 1} / {photos.length}</Typography>
        <IconButton aria-label="Fermer" onClick={onFermer} sx={bouton}><CloseOutlined /></IconButton>
      </Box>
      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', touchAction: 'pan-y', minHeight: 0 }}
        onPointerDown={(e) => { doigt.current = e.clientX }}
        onPointerUp={(e) => { if (doigt.current !== null && Math.abs(e.clientX - doigt.current) > 50) aller(e.clientX < doigt.current ? 1 : -1); doigt.current = null }}>
        {lien ? <Box component="img" src={lien} alt={`Photo ${i + 1}`} sx={{ maxWidth: '100%', maxHeight: '100vh', objectFit: 'contain', display: 'block', userSelect: 'none' }} draggable={false} /> : <ImageOutlined aria-hidden />}
      </Box>
      {i > 0 && <IconButton aria-label="Photo précédente" onClick={() => aller(-1)} sx={{ ...bouton, position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}><ChevronLeftOutlined /></IconButton>}
      {i < photos.length - 1 && <IconButton aria-label="Photo suivante" onClick={() => aller(1)} sx={{ ...bouton, position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}><ChevronRightOutlined /></IconButton>}
    </Dialog>
  )
}

// Photos toujours en vignettes carrées, même seules (Joseph, 21/10/2026) ; au-delà de max, la dernière annonce le reste.
// Le toucher ouvre la photo en plein écran.
// avant : vignette posée dans la première case (compte rendu d'une visite), qui prend la place d'une photo
export function GrillePhotos({ photos, max = 3, colonnes = 3, avant }: { photos: Photo[] | undefined; max?: number; colonnes?: number; avant?: ReactNode }) {
  const [ouverte, setOuverte] = useState<number | null>(null)
  if (!photos?.length && !avant) return null
  photos ??= []
  const vues = photos.slice(0, avant ? max - 1 : max)
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))`, gap: 0.5, maxWidth: 480 }}>
        {avant}
        {vues.map((p, i) => <Vignette key={p.chemin} chemin={p.chemin} numero={i + 1} reste={i === vues.length - 1 ? photos.length - vues.length : 0} onOuvrir={() => setOuverte(i)} />)}
      </Box>
      {ouverte !== null && photos.length > 0 && <PhotosPleinEcran photos={photos} depart={ouverte} onFermer={() => setOuverte(null)} />}
    </>
  )
}

// Lignes par défaut, tableau à la demande (PC) ; le choix est gardé par écran
export type Affichage = 'lignes' | 'tableau'
export function useAffichage(ecran: string): [Affichage, (a: Affichage) => void] {
  const cle = `vandb-affichage-${ecran}`
  const [a, setA] = useState<Affichage>(() => { try { return localStorage.getItem(cle) === 'tableau' ? 'tableau' : 'lignes' } catch { return 'lignes' } })
  return [a, (v) => { setA(v); try { localStorage.setItem(cle, v) } catch { /* stockage indisponible */ } }]
}

export function ChoixAffichage({ valeur, onChange }: { valeur: Affichage; onChange: (a: Affichage) => void }) {
  return (
    <ToggleButtonGroup exclusive size="small" value={valeur} onChange={(_e, v: Affichage | null) => v && onChange(v)} aria-label="Affichage">
      <ToggleButton value="lignes" sx={{ minHeight: 40, px: 1.5, gap: 0.75 }}><ViewAgendaOutlined fontSize="small" />Lignes</ToggleButton>
      <ToggleButton value="tableau" sx={{ minHeight: 40, px: 1.5, gap: 0.75 }}><TableChartOutlined fontSize="small" />Tableau</ToggleButton>
    </ToggleButtonGroup>
  )
}

// Glisser vers la gauche au doigt (téléphone) pour l'action rapide de la ligne : tâche faite, notification lue.
// Sans animation : la ligne suit le doigt et revient en place au lâcher ; la souris n'est pas concernée.
const SEUIL_GLISSER = 96
export function Glisser({ children, libelle, icone, onGlisser, actif = true, couleur = brand.vertFonce }: { children: ReactNode; libelle: string; icone: ReactNode; onGlisser: () => void; actif?: boolean; couleur?: string }) {
  const [dx, setDx] = useState(0)
  const depart = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null)
  const vientDeGlisser = useRef(false)
  if (!actif) return <>{children}</>
  const fin = () => {
    if (depart.current?.horizontal && dx <= -SEUIL_GLISSER) onGlisser()
    vientDeGlisser.current = !!depart.current?.horizontal
    depart.current = null
    setDx(0)
  }
  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', touchAction: 'pan-y' }}
      onPointerDown={(e) => { if (e.pointerType === 'touch') { depart.current = { x: e.clientX, y: e.clientY, horizontal: null }; vientDeGlisser.current = false } }}
      onPointerMove={(e) => {
        const d = depart.current
        if (!d) return
        const x = e.clientX - d.x, y = e.clientY - d.y
        if (d.horizontal === null && Math.abs(x) + Math.abs(y) > 10) d.horizontal = Math.abs(x) > Math.abs(y)
        if (d.horizontal) setDx(Math.min(0, Math.max(x, -160)))
      }}
      onPointerUp={fin} onPointerCancel={() => { depart.current = null; setDx(0) }}
      onClickCapture={(e) => { if (vientDeGlisser.current) { e.preventDefault(); e.stopPropagation(); vientDeGlisser.current = false } }}>
      {dx < 0 && (
        <Box aria-hidden sx={{ position: 'absolute', inset: 0, bgcolor: couleur, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, px: 2.5, fontWeight: 600 }}>
          {icone}{libelle}
        </Box>
      )}
      <Box sx={{ position: 'relative', bgcolor: 'background.paper', transform: dx ? `translateX(${dx}px)` : undefined }}>{children}</Box>
    </Box>
  )
}

// Longues listes affichées par tranches, avec « Voir plus » : le rendu de centaines de lignes bloquait le changement d'onglet.
// cle : change quand les filtres changent, pour revenir à la première tranche
// Nombre de lignes dépliées par liste, gardé le temps de la session : en revenant d'une fiche,
// la liste a la même longueur et le retour arrière retrouve la ligne quittée
const tranchesDepliees = new Map<string, number>()

export function useParTranches<T>(liste: T[], cle: string, tranche = 50) {
  const { pathname, search } = useLocation()
  const memo = `${pathname}${search}|${cle}`
  const [vu, setVu] = useState(() => ({ cle, nombre: tranchesDepliees.get(memo) ?? tranche }))
  const nombre = vu.cle === cle ? vu.nombre : tranchesDepliees.get(memo) ?? tranche
  const restantes = liste.length - nombre
  return {
    visibles: restantes > 0 ? liste.slice(0, nombre) : liste,
    suite: restantes > 0 && (
      <Box sx={{ textAlign: 'center', mt: 1.5 }}>
        <Button variant="outlined" onClick={() => { tranchesDepliees.set(memo, nombre + tranche); setVu({ cle, nombre: nombre + tranche }) }} sx={{ minHeight: 48 }}>Voir plus ({restantes})</Button>
      </Box>
    ),
  }
}
