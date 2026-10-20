import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import FormatAlignCenter from '@mui/icons-material/FormatAlignCenter'
import FormatBold from '@mui/icons-material/FormatBold'
import FormatItalic from '@mui/icons-material/FormatItalic'
import FormatListBulleted from '@mui/icons-material/FormatListBulleted'
import FormatUnderlined from '@mui/icons-material/FormatUnderlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import Title from '@mui/icons-material/Title'
import { useAuth } from '../auth/AuthContext'
import { nettoyerHtml } from '../lib/html'
import { envoyerPiece, lienPiece, messagePiece, retirerPiece, type Piece } from '../lib/pieces'
import { Bulle } from './Outils'

// Rendu « papier » : fond blanc et texte foncé dans les deux thèmes, comme un courriel
const papier = {
  bgcolor: '#ffffff', color: '#1b1b1f', borderRadius: 2, p: { xs: 1.5, sm: 2 }, overflowX: 'auto', overflowWrap: 'anywhere', lineHeight: 1.5,
  '& > :first-of-type': { mt: 0 }, '& > :last-child': { mb: 0 },
  '& p': { mt: 0, mb: 1.25 }, '& h1': { fontSize: '1.5rem', lineHeight: 1.25, mt: 1, mb: 1.25 }, '& h2': { fontSize: '1.25rem', lineHeight: 1.3, mt: 1, mb: 1 },
  '& h3, & h4, & h5, & h6': { fontSize: '1.0625rem', mt: 1, mb: 0.75 }, '& sub, & sup': { fontSize: '0.75em' },
  '& img': { maxWidth: '100%', height: 'auto' }, '& table': { maxWidth: '100%', borderCollapse: 'collapse' },
  '& a': { color: '#1b6fce' }, '& ul, & ol': { pl: 3, my: 1 }, '& blockquote': { borderLeft: '4px solid #eaa400', m: 0, my: 1, pl: 1.5 },
} as const

// Communication mise en forme, nettoyée à chaque affichage
export function ContenuMisEnForme({ html }: { html: string }) {
  const propre = useMemo(() => nettoyerHtml(html), [html])
  if (!propre) return null
  return <Box className="contenu-mis-en-forme" sx={papier} dangerouslySetInnerHTML={{ __html: propre }} />
}

// Photo d'en-tête (pièce jointe lue par lien temporaire)
export function BanniereEntete({ piece, children }: { piece: Piece; children?: ReactNode }) {
  const [lien, setLien] = useState<string | null>(null)
  useEffect(() => {
    let actif = true
    void lienPiece(piece.chemin).then((l) => { if (actif) setLien(l) })
    return () => { actif = false }
  }, [piece.chemin])
  return (
    <Box sx={{ position: 'relative', bgcolor: '#ffffff', minHeight: lien ? 0 : 120 }}>
      {lien && <Box component="img" src={lien} alt={piece.nom} sx={{ display: 'block', mx: 'auto', maxWidth: '100%', maxHeight: { xs: 220, sm: 320 }, objectFit: 'contain' }} />}
      {children}
    </Box>
  )
}

// Choix de la photo d'en-tête : envoyée aussitôt, retirable
export function ChampEntete({ piece, changer, signaler }: { piece: Piece | null; changer: (p: Piece | null) => void; signaler: (m: string) => void }) {
  const { profil } = useAuth()
  const [envoi, setEnvoi] = useState(false)
  const entree = useRef<HTMLInputElement | null>(null)
  const choisir = async (f: File | undefined) => {
    if (!f || !profil) return
    if (!f.type.startsWith('image/')) { signaler(`« ${f.name} » n’est pas une photo.`); return }
    setEnvoi(true)
    try { changer(await envoyerPiece(f, profil.id)) } catch (e) { signaler(messagePiece(e)) } finally { setEnvoi(false) }
  }
  return (
    <Box>
      <input ref={entree} type="file" accept="image/*" hidden aria-label="Photo d’en-tête"
        onChange={(e) => { void choisir(e.target.files?.[0]); e.target.value = '' }} />
      {piece ? (
        <Box sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <BanniereEntete piece={piece}>
            <IconButton aria-label="Retirer la photo d’en-tête" onClick={() => { changer(null); void retirerPiece(piece.chemin) }}
              sx={{ position: 'absolute', top: 8, right: 8, width: 48, height: 48, bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}>
              <DeleteOutlined />
            </IconButton>
          </BanniereEntete>
        </Box>
      ) : (
        <Button startIcon={envoi ? <CircularProgress size={18} /> : <ImageOutlined />} onClick={() => entree.current?.click()} disabled={envoi} sx={{ minHeight: 48, ml: -1 }}>
          {envoi ? 'Envoi de la photo…' : 'Photo d’en-tête'}
        </Button>
      )}
    </Box>
  )
}

const OUTILS: { commande: string; valeur?: string; libelle: string; icone: ReactNode }[] = [
  { commande: 'bold', libelle: 'Gras', icone: <FormatBold /> },
  { commande: 'italic', libelle: 'Italique', icone: <FormatItalic /> },
  { commande: 'underline', libelle: 'Souligné', icone: <FormatUnderlined /> },
  { commande: 'formatBlock', valeur: 'h2', libelle: 'Titre', icone: <Title /> },
  { commande: 'insertUnorderedList', libelle: 'Liste', icone: <FormatListBulleted /> },
  { commande: 'justifyCenter', libelle: 'Centrer', icone: <FormatAlignCenter /> },
]

// Saisie mise en forme : un collage depuis un courriel ou une page garde la mise en forme, nettoyée.
// Le contenu n'est injecté qu'une fois nettoyé ; la zone n'est pas réécrite pendant la frappe.
export function EditeurMiseEnForme({ html, changer, libelle }: { html: string; changer: (html: string) => void; libelle: string }) {
  const zone = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (zone.current) zone.current.innerHTML = nettoyerHtml(html)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const relever = () => changer(zone.current?.innerHTML ?? '')
  const coller = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const riche = e.clipboardData.getData('text/html')
    const brut = e.clipboardData.getData('text/plain')
    if (!riche && !brut) return
    e.preventDefault()
    if (riche) document.execCommand('insertHTML', false, nettoyerHtml(riche))
    else document.execCommand('insertText', false, brut)
    relever()
  }
  return (
    <Box>
      <Box role="toolbar" aria-label="Mise en forme" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mb: 0.5 }}>
        {OUTILS.map((o) => (
          <Bulle key={o.libelle} titre={o.libelle}>
            <IconButton aria-label={o.libelle} onMouseDown={(e) => e.preventDefault()}
              onClick={() => { zone.current?.focus(); document.execCommand(o.commande, false, o.valeur); relever() }} sx={{ width: 48, height: 48 }}>
              {o.icone}
            </IconButton>
          </Bulle>
        ))}
      </Box>
      <Box ref={zone} role="textbox" aria-multiline="true" aria-label={libelle} contentEditable suppressContentEditableWarning
        onInput={relever} onBlur={relever} onPaste={coller}
        sx={{ ...papier, minHeight: 240, maxHeight: '60vh', overflowY: 'auto', border: '1px solid', borderColor: 'divider', outline: 'none', '&:focus': { borderColor: 'primary.main', boxShadow: (t) => `0 0 0 1px ${t.palette.primary.main}` } }} />
    </Box>
  )
}

// Code HTML collé tel quel (nettoyé à l'enregistrement et à l'affichage)
export function ChampCodeHtml({ html, changer }: { html: string; changer: (html: string) => void }) {
  return (
    <TextField label="Code HTML" value={html} onChange={(e) => changer(e.target.value)} multiline minRows={10} maxRows={20} fullWidth
      slotProps={{ htmlInput: { spellCheck: false, style: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 14 } } }} />
  )
}

export function AlerteTaille({ visible }: { visible: boolean }) {
  return visible ? <Typography color="error" variant="body2">La communication est trop lourde : retire des images ou du contenu.</Typography> : null
}
