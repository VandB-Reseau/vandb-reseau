// Saisie d'une note du carnet en style messagerie (Joseph, 25/11/2026) : une barre d'écriture compacte (texte, micro,
// envoyer) ; le ton reste visible en une pastille, thèmes et collègues prévenus se choisissent dans des menus (ou en
// tapant « @ »). Sert dans l'onglet Carnet, sur la page d'une visite, dans la fenêtre « Nouvelle note » et pour répondre.
import { useRef, useState, type KeyboardEvent } from 'react'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AlternateEmailOutlined from '@mui/icons-material/AlternateEmailOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import LocalOfferOutlined from '@mui/icons-material/LocalOfferOutlined'
import SendOutlined from '@mui/icons-material/SendOutlined'
import { TexteDicte } from './Dictee'
import { Pastille, useCouleurTon } from './Carnet'
import { libelleTheme, libelleTon, THEMES, TONS } from '../data/carnet'
import type { TonNote } from '../data/modele'

const MAX = 3000

export interface ContenuNote { texte: string; ton: TonNote; themes: string[]; mentions: string[] }

// Ton, thèmes et collègues prévenus en trois boutons ; ce qui est choisi se lit sur une ligne en dessous
export function ReglagesNote({ ton, changerTon, themes, changerThemes, mentions, changerMentions, autres, mentionsOuvertes, ouvrirMentions, apresMention }: {
  ton?: TonNote; changerTon?: (t: TonNote) => void; themes?: string[]; changerThemes?: (t: string[]) => void
  mentions: string[]; changerMentions: (m: string[]) => void; autres: { nom: string }[]
  mentionsOuvertes?: boolean; ouvrirMentions?: (o: boolean) => void; apresMention?: () => void
}) {
  const couleur = useCouleurTon()
  const [ancreTon, setAncreTon] = useState<HTMLElement | null>(null)
  const [ancreThemes, setAncreThemes] = useState<HTMLElement | null>(null)
  const refMentions = useRef<HTMLButtonElement>(null)
  const [mentionsLocales, setMentionsLocales] = useState(false)
  const ouvertes = mentionsOuvertes ?? mentionsLocales
  const ouvrir = ouvrirMentions ?? setMentionsLocales
  const basculer = <T,>(liste: T[], v: T) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v])
  return (
    <>
      {ton && changerTon && (
        <>
          <Button size="small" color="inherit" onClick={(e) => setAncreTon(e.currentTarget)} aria-haspopup="menu" aria-label={`Ton : ${libelleTon(ton)}`}
            endIcon={<ExpandMoreOutlined />} sx={{ minHeight: 48, px: 1, gap: 0.25, fontWeight: 600, color: 'text.secondary', flexShrink: 0 }}>
            <Pastille couleur={couleur(ton).bord} /><Box component="span" sx={{ ml: 0.75 }}>{libelleTon(ton)}</Box>
          </Button>
          <Menu anchorEl={ancreTon} open={!!ancreTon} onClose={() => setAncreTon(null)} slotProps={{ list: { 'aria-label': 'Ton' } }}>
            {TONS.map((t) => (
              <MenuItem key={t.v} selected={t.v === ton} onClick={() => { changerTon(t.v); setAncreTon(null) }} sx={{ minHeight: 48 }}>
                <ListItemIcon><Pastille couleur={couleur(t.v).bord} /></ListItemIcon>
                <ListItemText>{t.libelle}</ListItemText>
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
      {themes && changerThemes && (
        <>
          <Tooltip title="Thèmes">
            <IconButton onClick={(e) => setAncreThemes(e.currentTarget)} aria-haspopup="menu" aria-label={themes.length ? `Thèmes : ${themes.map(libelleTheme).join(', ')}` : 'Thèmes'} sx={{ width: 48, height: 48, flexShrink: 0 }}>
              <Badge badgeContent={themes.length} color="secondary"><LocalOfferOutlined /></Badge>
            </IconButton>
          </Tooltip>
          <Menu anchorEl={ancreThemes} open={!!ancreThemes} onClose={() => setAncreThemes(null)} slotProps={{ list: { 'aria-label': 'Thèmes' } }}>
            {THEMES.map((t) => {
              const actif = themes.includes(t.v)
              return (
                <MenuItem key={t.v} role="menuitemcheckbox" aria-checked={actif} onClick={() => changerThemes(basculer(themes, t.v))} sx={{ minHeight: 48 }}>
                  <ListItemIcon>{actif && <CheckOutlined />}</ListItemIcon>
                  <ListItemText>{t.libelle}</ListItemText>
                </MenuItem>
              )
            })}
          </Menu>
        </>
      )}
      {autres.length > 0 && (
        <>
          <Tooltip title="Prévenir un collègue">
            <IconButton ref={refMentions} onClick={() => ouvrir(true)} aria-haspopup="menu" aria-label={mentions.length ? `Prévenir : ${mentions.join(', ')}` : 'Prévenir un collègue'} sx={{ width: 48, height: 48, flexShrink: 0 }}>
              <Badge badgeContent={mentions.length} color="secondary"><AlternateEmailOutlined /></Badge>
            </IconButton>
          </Tooltip>
          <Menu anchorEl={refMentions.current} open={ouvertes && !!refMentions.current} onClose={() => ouvrir(false)} slotProps={{ list: { 'aria-label': 'Prévenir' } }}>
            {autres.map((p) => {
              const actif = mentions.includes(p.nom)
              return (
                <MenuItem key={p.nom} role="menuitemcheckbox" aria-checked={actif} onClick={() => { changerMentions(basculer(mentions, p.nom)); if (!actif) apresMention?.() }} sx={{ minHeight: 48 }}>
                  <ListItemIcon>{actif && <CheckOutlined />}</ListItemIcon>
                  <ListItemText>{p.nom}</ListItemText>
                </MenuItem>
              )
            })}
          </Menu>
        </>
      )}
    </>
  )
}

// Ce qui est choisi en plus du ton, sur une ligne discrète
export function ResumeReglages({ themes = [], mentions }: { themes?: string[]; mentions: string[] }) {
  const morceaux = [...themes.map(libelleTheme), ...mentions.map((m) => `@${m}`)]
  if (!morceaux.length) return null
  return <Typography variant="body2" color="text.secondary" sx={{ px: 0.5, overflowWrap: 'anywhere' }}>{morceaux.join(' · ')}</Typography>
}

// La barre d'écriture : le texte, puis une rangée ton · thèmes · @ · envoyer. Ctrl+Entrée (ou Cmd+Entrée) envoie.
export function SaisieNote({ label, autres, envoyer, occupe, libelleEnvoi = 'Noter', sansTon, autoFocus, annuler }: {
  label: string; autres: { nom: string }[]; envoyer: (n: ContenuNote) => Promise<boolean>; occupe?: boolean
  libelleEnvoi?: string; sansTon?: boolean; autoFocus?: boolean; annuler?: () => void
}) {
  const [texte, setTexte] = useState('')
  const [ton, setTon] = useState<TonNote>('info')
  const [themes, setThemes] = useState<string[]>([])
  const [mentions, setMentions] = useState<string[]>([])
  const [mentionsOuvertes, setMentionsOuvertes] = useState(false)
  const pret = !!texte.trim() && !occupe
  const valider = async () => {
    if (!pret) return
    const fait = await envoyer({ texte: texte.trim(), ton, themes, mentions })
    if (fait) { setTexte(''); setTon('info'); setThemes([]); setMentions([]) }
  }
  const clavier = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void valider() } }
  // « @ » tapé après un espace (ou en début) ouvre la liste des collègues ; le choix retire le « @ » du texte
  const changer = (f: (v: string) => string) => setTexte((v) => {
    const n = f(v).slice(0, MAX)
    if (autres.length && n.length === v.length + 1 && n.endsWith('@') && /(^|\s)@$/.test(n)) window.setTimeout(() => setMentionsOuvertes(true), 0)
    return n
  })
  return (
    <Box sx={{ display: 'grid', gap: 0.5 }} onKeyDown={clavier}>
      <TexteDicte libelleDictee={label} valeur={texte} changer={changer} multiline minRows={1} maxRows={10} fullWidth autoFocus={autoFocus}
        placeholder={label} slotProps={{ htmlInput: { 'aria-label': label } }} />
      <ResumeReglages themes={sansTon ? [] : themes} mentions={mentions} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <ReglagesNote {...(sansTon ? {} : { ton, changerTon: setTon, themes, changerThemes: setThemes })} mentions={mentions} changerMentions={setMentions} autres={autres}
          mentionsOuvertes={mentionsOuvertes} ouvrirMentions={setMentionsOuvertes}
          apresMention={() => { setTexte((v) => v.replace(/@$/, '')); setMentionsOuvertes(false) }} />
        <Box sx={{ flex: 1 }} />
        {annuler && <Button onClick={annuler} sx={{ minHeight: 48 }}>Annuler</Button>}
        {/* Sur téléphone, l'envoi tient en une icône pour laisser la place au ton */}
        <Button variant="contained" disabled={!pret} onClick={() => void valider()} aria-label={libelleEnvoi}
          sx={{ minHeight: 48, minWidth: 48, flexShrink: 0, gap: 1, px: { xs: 1.5, sm: 2 } }}>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{libelleEnvoi}</Box><SendOutlined fontSize="small" />
        </Button>
      </Box>
    </Box>
  )
}
