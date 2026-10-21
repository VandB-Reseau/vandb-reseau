import { useCallback, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import ExpandMore from '@mui/icons-material/ExpandMore'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { sousBandes, useBande } from './Collant'

// pastille : nombre de nouveautés (messages non lus)
export interface Rubrique<V extends string> { vue: V; libelle: string; court?: string; icone: ReactElement; pastille?: number }

// Onglets des pages en puces, comme dans une app : la rubrique ouverte en noir, les autres cerclées.
// PC : icône et libellé complet ; téléphone : libellé court seul. La bande défile quand elle déborde.
// Chaque puce garde une zone tactile de 48 px de haut.
// La bande reste sous la barre du haut quand la page défile, partout (Joseph, 21/10/2026) ;
// libres : onglets dans une carte, qui défilent avec elle.
// fiche : changer d'onglet garde la position (RetourEnHaut) au lieu de remonter tout en haut.
// Téléphone : autant de rubriques que la largeur en tient, puis « Plus », qui ouvre les autres dans un panneau du bas
// et prend le nom de la rubrique ouverte quand elle en fait partie (aucun onglet coupé au bord de l'écran ;
// largeur comptée d'après le plus long nom que « Plus » peut prendre, pour que les onglets ne bougent pas, Joseph 21/10/2026).
const PLUS = '__plus'
const VISIBLES_TELEPHONE = 3
const ECART = 0 // puces bord à bord, l'espace est dessiné dans la zone tactile
const MARGE_PUCE = 28 // px de chaque côté (14) d'une puce sur téléphone
const MARGE_PLUS = 46 // 14 à gauche, 10 à droite, flèche de 20 et son écart

let pinceau: CanvasRenderingContext2D | null | undefined
function largeurTexte(texte: string, police: string) {
  if (pinceau === undefined) pinceau = document.createElement('canvas').getContext('2d')
  if (!pinceau) return texte.length * 9
  pinceau.font = police
  return Math.ceil(pinceau.measureText(texte).width) + 2
}

// Nombre de rubriques affichées avant « Plus » pour une bande de largeur donnée (jamais moins de 3, comme avant)
export function combienVisibles(noms: string[], largeur: number, mesure: (t: string) => number) {
  if (noms.length <= VISIBLES_TELEPHONE + 1) return noms.length
  const w = noms.map((n) => mesure(n) + MARGE_PUCE)
  if (w.reduce((a, b) => a + b, 0) + ECART * (w.length - 1) <= largeur) return noms.length
  for (let k = noms.length - 1; k > VISIBLES_TELEPHONE; k--) {
    const plus = MARGE_PLUS + Math.max(mesure('Plus'), ...noms.slice(k).map(mesure))
    if (w.slice(0, k).reduce((a, b) => a + b, 0) + plus + ECART * k <= largeur) return k
  }
  return Math.min(VISIBLES_TELEPHONE, noms.length)
}

export function Onglets<V extends string>({ valeur, onChange, rubriques, libelle, fiche, libres }: { valeur: V; onChange: (v: V) => void; rubriques: Rubrique<V>[]; libelle: string; fiche?: boolean; libres?: boolean }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [panneau, setPanneau] = useState(false)
  const publierBande = useBande('--onglets', !libres)
  const [place, setPlace] = useState<{ largeur: number; police: string } | null>(null)
  const suivi = useRef<ResizeObserver | null>(null)
  const bande = useCallback((e: HTMLElement | null) => {
    publierBande(e)
    suivi.current?.disconnect()
    suivi.current = null
    if (!e) return
    const mesurer = () => {
      const st = getComputedStyle(e)
      const largeur = e.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight)
      setPlace((p) => (p && p.largeur === largeur ? p : { largeur, police: `600 14px ${st.fontFamily}` }))
    }
    mesurer()
    suivi.current = new ResizeObserver(mesurer)
    suivi.current.observe(e)
  }, [publierBande])
  const noms = rubriques.map((r) => r.court ?? r.libelle).join('|')
  const nbVisibles = useMemo(() => {
    if (surPC) return rubriques.length
    if (!place) return rubriques.length > VISIBLES_TELEPHONE + 1 ? VISIBLES_TELEPHONE : rubriques.length
    return combienVisibles(noms.split('|'), place.largeur, (t) => largeurTexte(t, place.police))
  }, [surPC, place, noms, rubriques.length])
  const replier = nbVisibles < rubriques.length
  const visibles = replier ? rubriques.slice(0, nbVisibles) : rubriques
  const autres = replier ? rubriques.slice(nbVisibles) : []
  const ouverteAilleurs = autres.find((r) => r.vue === valeur)
  const pastilleAutres = autres.reduce((n, r) => n + (r.pastille ?? 0), 0)
  return (
    <>
    {fiche && <Box className="onglets-repere" aria-hidden />}
    <Tabs ref={bande} className={fiche ? 'onglets-fiche' : undefined} value={ouverteAilleurs ? PLUS : valeur} onChange={(_e, v) => { if (v !== PLUS) onChange(v as V) }} variant="scrollable" scrollButtons={false} aria-label={libelle}
      slotProps={{ indicator: { sx: { display: 'none' } } }}
      sx={{
        mb: { xs: 1.5, md: 2.5 }, minHeight: 48, mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, '& .MuiTabs-flexContainer': { gap: 1 },
        // Sous la barre du haut (64 px téléphone, 72 px PC), sur le fond de la page
        ...(libres ? {} : { position: 'sticky', top: sousBandes(), zIndex: 4, bgcolor: 'background.default' }),
      }}>
      {visibles.map((r) => (
        <Tab key={r.vue} value={r.vue} icon={surPC ? r.icone : undefined} iconPosition="start" aria-label={r.libelle} disableRipple
          label={r.pastille ? <Badge color="error" badgeContent={r.pastille} sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none', ml: 0.75, fontSize: '0.75rem' } }}>{surPC ? r.libelle : r.court ?? r.libelle}</Badge> : surPC ? r.libelle : r.court ?? r.libelle}
          sx={styleOnglet} />
      ))}
      {replier && (
        <Tab value={PLUS} aria-label={ouverteAilleurs ? `${ouverteAilleurs.libelle}, autres rubriques` : 'Autres rubriques'} aria-haspopup="dialog" disableRipple
          onClick={() => setPanneau(true)} icon={<ExpandMore />} iconPosition="end"
          label={pastilleAutres && !ouverteAilleurs ? <Badge color="error" badgeContent={pastilleAutres} sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none', ml: 0.75, fontSize: '0.75rem' } }}>Plus</Badge> : ouverteAilleurs ? ouverteAilleurs.court ?? ouverteAilleurs.libelle : 'Plus'}
          sx={{ ...styleOnglet, gap: 0.25, pl: 1.75, pr: 1.25, '& .MuiTab-icon': { mb: 0, ml: 0, fontSize: 20 } }} />
      )}
    </Tabs>
    {replier && (
      <Dialog open={panneau} onClose={() => setPanneau(false)} aria-labelledby="titre-autres-rubriques" fullWidth>
        <DialogTitle id="titre-autres-rubriques" sx={{ pb: 1 }}>{libelle}</DialogTitle>
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, pb: 2 }}>
          {autres.map((r) => (
            <li key={r.vue}>
              <ButtonBase onClick={() => { setPanneau(false); onChange(r.vue) }} aria-current={r.vue === valeur ? 'page' : undefined}
                sx={{ width: '100%', minHeight: 56, px: 3, gap: 2, justifyContent: 'flex-start', fontFamily: 'inherit', fontSize: '1rem', fontWeight: r.vue === valeur ? 700 : 500, bgcolor: r.vue === valeur ? 'action.selected' : undefined, '& svg': { fontSize: 22, color: 'text.secondary' } }}>
                {r.icone}
                <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>{r.libelle}</Box>
                {!!r.pastille && <Badge color="error" badgeContent={r.pastille} sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none', fontSize: '0.75rem' } }} />}
              </ButtonBase>
            </li>
          ))}
        </Box>
      </Dialog>
    )}
    </>
  )
}

// Puce de 40 px dessinée dans la zone tactile de 48 px
const styleOnglet = {
  minHeight: 48, minWidth: 0, px: { xs: 1.75, md: 2 }, py: 0, gap: 0.75, position: 'relative', zIndex: 0, color: 'text.primary', opacity: 1,
  fontSize: '0.875rem', fontWeight: 500,
  '& .MuiTab-icon': { mb: 0, mr: 0, fontSize: 20 },
  '&::before': { content: '""', position: 'absolute', inset: '4px 0', borderRadius: 999, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', zIndex: -1 },
  '&.Mui-selected': { color: 'primary.contrastText', fontWeight: 600 },
  '&.Mui-selected::before': { bgcolor: 'primary.main', borderColor: 'primary.main' },
  '&.Mui-focusVisible::before': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 1 },
} as const

// Contenu sous des onglets collants : toujours assez haut pour que les onglets restent en haut
// de l'écran quand l'onglet ouvert est court (sinon la page remonte et l'en-tête réapparaît)
export function ContenuOnglet({ children }: { children: ReactNode }) {
  return <Box sx={{ minHeight: { xs: 'calc(100dvh - 216px)', md: 'calc(100dvh - 168px)' } }}>{children}</Box>
}
