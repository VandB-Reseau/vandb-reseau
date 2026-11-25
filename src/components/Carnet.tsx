// Carnet du magasin (Joseph, 24/11/2026, proposition A) : ce que l'équipe ne dit pas au franchisé. Une note a un ton
// (Alerte, À surveiller, Positif, Info), des thèmes, des collègues prévenus dans leur cloche, des réponses en dessous, et
// se clôt quand l'alerte est traitée. Les comptes rendus des visites se lisent dans le même fil, dans l'ordre.
// Jamais lu par le franchisé : la rubrique « notes » de suivi_magasins ne lui est pas renvoyée (contrôlé dans la base).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutlined'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined'
import PanToolOutlined from '@mui/icons-material/PanToolOutlined'
import ReplyOutlined from '@mui/icons-material/ReplyOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import { Initiales } from './Social'
import { VuesRapides, styleFiltre } from './VuesRapides'
import { SaisieNote, type ContenuNote } from './SaisieNote'
import { LigneVide, styleBloc } from './Section'
import { useMessageAnnulable } from './Annulable'
import { useAuth } from '../auth/AuthContext'
import { useReseau } from '../data/ReseauContext'
import { enregistrerNoteMagasin, modifierNoteMagasin, supprimerNoteMagasin } from '../data/chargement'
import { monNomPorteur } from '../data/actions'
import { aClore, collegues, instantNote, libelleTheme, libelleTon, lienNote, nouvelIdNote, ouverte, tonDe, TONS } from '../data/carnet'
import { lienCompteRendu, visitesDuMagasin } from '../data/visites'
import { libelleTypeVisite, type Magasin, type NoteMagasin, type Reseau, type TonNote, type Visite } from '../data/modele'
import { styleSignal } from '../theme/theme'
import { dateCourte } from '../lib/format'

const heure = (iso: string) => (iso.length > 10 ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '')
const quandLisible = (iso: string) => [dateCourte(iso.slice(0, 10)), heure(iso)].filter(Boolean).join(', ')
const mois = (iso: string) => new Date(`${iso.slice(0, 7)}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
const ilYASixMois = (jour: string) => { const d = new Date(`${jour}T12:00:00`); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10) }

// Couleur du ton : bord de la carte et puce, les 4 tons de l'app
export function useCouleurTon() {
  const theme = useTheme()
  return (t: TonNote) => {
    const s = TONS.find((x) => x.v === t)!.signal
    return { bord: s === 'info' ? theme.palette.text.secondary : theme.palette[s].main, puce: s === 'info' ? { bgcolor: 'action.hover', color: 'text.secondary', fontWeight: 600 } : styleSignal(theme, s) }
  }
}

// Rangée de puces à cocher (une seule ou plusieurs), 48 px de zone tactile
export function Choix<V extends string>({ label, options, valeurs, changer, multiple }: { label: string; options: { v: V; libelle: string; icone?: ReactNode }[]; valeurs: V[]; changer: (v: V[]) => void; multiple?: boolean }) {
  return (
    <Box role="group" aria-label={label} sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5, fontWeight: 600 }}>{label}</Typography>
      {options.map((o) => {
        const actif = valeurs.includes(o.v)
        return (
          <ButtonBase key={o.v} aria-pressed={actif} sx={styleFiltre(actif)}
            onClick={() => changer(multiple ? (actif ? valeurs.filter((x) => x !== o.v) : [...valeurs, o.v]) : [o.v])}>
            <span>{actif && <CheckOutlined sx={{ fontSize: 18 }} />}{o.icone}{o.libelle}</span>
          </ButtonBase>
        )
      })}
    </Box>
  )
}

export function Pastille({ couleur }: { couleur: string }) {
  return <Box component="span" aria-hidden sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: couleur, flexShrink: 0 }} />
}

type Filtre = 'tout' | 'notes' | 'ouvertes' | 'comptes'
type Element = { genre: 'note'; quand: string; note: NoteMagasin } | { genre: 'compte'; quand: string; visite: Visite }

export function Carnet({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const { profil } = useAuth()
  const { recharger } = useReseau()
  const { signaler, bandeau } = useMessageAnnulable()
  const [params] = useSearchParams()
  const couleur = useCouleurTon()
  const moi = monNomPorteur(reseau, profil) || profil?.nom || ''
  const notes = useMemo(() => reseau.notesMagasins[m.nom] ?? [], [reseau.notesMagasins, m.nom])
  const autres = collegues(reseau, m.nom, moi)
  const [occupe, setOccupe] = useState(false)
  const [filtre, setFiltre] = useState<Filtre>('tout')

  const visites = visitesDuMagasin(reseau, m.nom).filter((v) => v.id != null && !v.prevue && v.date <= reseau.jour)
  const elements: Element[] = [
    ...notes.map((note) => ({ genre: 'note' as const, quand: instantNote(note), note })),
    ...visites.map((visite) => ({ genre: 'compte' as const, quand: `${visite.date}T23:59:00`, visite })),
  ].sort((a, b) => b.quand.localeCompare(a.quand))
  const nOuvertes = notes.filter(ouverte).length
  const visibles = elements.filter((e) => filtre === 'tout' || (filtre === 'notes' && e.genre === 'note') || (filtre === 'comptes' && e.genre === 'compte') || (filtre === 'ouvertes' && e.genre === 'note' && ouverte(e.note)))

  // Lien d'une notification : la note vient à l'écran
  const demandee = params.get('note')
  useEffect(() => {
    if (!demandee) return
    const t = window.setTimeout(() => document.getElementById(`note-${demandee}`)?.scrollIntoView({ block: 'center' }), 150)
    return () => window.clearTimeout(t)
  }, [demandee])

  const agir = async (f: () => Promise<unknown>, ok: string, annuler?: () => void) => {
    setOccupe(true)
    try { await f(); await recharger(); signaler(ok, annuler); return true }
    catch { signaler('La note n’est pas enregistrée. Vérifie ta connexion, puis réessaie.'); return false }
    finally { setOccupe(false) }
  }
  const noter = ({ texte, ton, themes, mentions }: ContenuNote) => {
    const note: NoteMagasin = { id: nouvelIdNote(), date: reseau.jour, quand: new Date().toISOString(), texte, par: moi, ton, ...(themes.length ? { themes } : {}), ...(mentions.length ? { mentions } : {}) }
    return agir(() => enregistrerNoteMagasin(m.nom, note), mentions.length ? `Note enregistrée. ${mentions.join(', ')} ${mentions.length > 1 ? 'sont prévenus' : 'est prévenu'}.` : 'Note enregistrée.')
  }

  // 6 derniers mois, par ton
  const depuis = ilYASixMois(reseau.jour)
  const recentes = notes.filter((n) => n.date >= depuis)
  const alertes = notes.filter((n) => ouverte(n) && tonDe(n) === 'alerte')

  let moisPrecedent = ''
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 300px' }, alignItems: 'start' }}>
      <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <Card component="section" aria-label="Nouvelle note" sx={{ ...styleBloc, p: 1.5 }}>
          <SaisieNote label={`Note sur ${m.nom}`} autres={autres} envoyer={noter} occupe={occupe || !moi} />
        </Card>

        <Box sx={{ minWidth: 0 }}>
          <VuesRapides filtre label="Filtrer le carnet" valeur={filtre} onChange={setFiltre} options={[
            { v: 'tout', libelle: 'Tout', nombre: elements.length },
            { v: 'notes', libelle: 'Notes', nombre: notes.length },
            { v: 'ouvertes', libelle: 'À clore', nombre: nOuvertes },
            { v: 'comptes', libelle: 'Comptes rendus', nombre: visites.length },
          ]} />
          {visibles.length === 0 ? (
            <LigneVide>{filtre === 'ouvertes' ? 'Aucune alerte ni point à surveiller en cours.' : filtre === 'comptes' ? 'Aucun compte rendu de visite pour ce magasin.' : 'Aucune note sur ce magasin. Une alerte, un point de posture ou un bon échange se note juste au-dessus.'}</LigneVide>
          ) : (
            <Box component="ol" aria-label={`Carnet de ${m.nom}`} sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.25 }}>
              {visibles.map((e) => {
                const leMois = e.quand.slice(0, 7)
                const titreMois = leMois !== moisPrecedent ? mois(e.quand) : null
                moisPrecedent = leMois
                return (
                  <Box component="li" key={e.genre === 'note' ? e.note.id : `v${e.visite.id}`} sx={{ display: 'grid', gap: 1 }}>
                    {titreMois && <Typography component="h3" sx={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary', mt: 1 }}>{titreMois}</Typography>}
                    {e.genre === 'note'
                      ? <CarteNote reseau={reseau} magasin={m.nom} note={e.note} moi={moi} autres={autres} occupe={occupe} agir={agir} mise={e.note.id === demandee} />
                      : <LigneCompteRendu v={e.visite} />}
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>
      </Box>

      <Box component="aside" aria-label="En bref" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <Card sx={{ ...styleBloc, display: 'grid', gap: 1 }}>
          <Typography component="h3" sx={{ fontSize: '1rem', fontWeight: 700 }}>En bref, 6 mois</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(4, minmax(0, 1fr))', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 0.75 }}>
            {TONS.map((t) => (
              <Box key={t.v} sx={{ ...couleur(t.v).puce, borderRadius: '12px', py: 0.75, px: 0.5, textAlign: 'center' }} aria-label={`${libelleTon(t.v)} : ${recentes.filter((n) => tonDe(n) === t.v).length}`}>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', color: 'inherit' }}>{recentes.filter((n) => tonDe(n) === t.v).length}</Typography>
                <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'inherit' }}>{t.libelle}</Typography>
              </Box>
            ))}
          </Box>
          <Typography variant="body2" color="text.secondary">{visites.filter((v) => v.date >= depuis).length} compte{visites.filter((v) => v.date >= depuis).length > 1 ? 's' : ''} rendu{visites.filter((v) => v.date >= depuis).length > 1 ? 's' : ''} sur la période</Typography>
        </Card>
        {alertes.length > 0 && (
          <Card sx={{ ...styleBloc, display: 'grid', gap: 0.5 }}>
            <Typography component="h3" sx={{ fontSize: '1rem', fontWeight: 700 }}>{alertes.length > 1 ? `${alertes.length} alertes ouvertes` : 'Alerte ouverte'}</Typography>
            {alertes.map((n) => (
              <ButtonBase key={n.id} onClick={() => document.getElementById(`note-${n.id}`)?.scrollIntoView({ block: 'center' })} sx={{ justifyContent: 'flex-start', textAlign: 'left', minHeight: 48, borderRadius: 1 }}>
                <Typography variant="body2"><Box component="span" sx={{ fontWeight: 700 }}>{n.themes?.length ? n.themes.map(libelleTheme).join(', ') : 'Alerte'}</Box>{` · ${dateCourte(n.date)}${n.par ? ` · ${n.par}` : ''}`}</Typography>
              </ButtonBase>
            ))}
          </Card>
        )}
      </Box>
      {bandeau}
    </Box>
  )
}

function LigneCompteRendu({ v }: { v: Visite }) {
  return (
    <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 3, px: 1.5, py: 0.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minHeight: 48 }}>
      <DescriptionOutlined sx={{ color: 'text.secondary' }} aria-hidden />
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
        <Box component="span" sx={{ fontWeight: 700 }}>{`Compte rendu · ${libelleTypeVisite(v.type)} du ${dateCourte(v.date)}`}</Box>
        {v.visiteurs.length > 0 && <Box component="span" sx={{ color: 'text.secondary' }}>{` · ${v.visiteurs.join(', ')}`}</Box>}
      </Typography>
      <Button component={RouterLink} to={lienCompteRendu(v)} size="small" sx={{ minHeight: 48 }} aria-label={`Ouvrir le compte rendu du ${dateCourte(v.date)}`}>Ouvrir</Button>
    </Box>
  )
}

// avecMagasin : carte lue dans le carnet du réseau (page Carnet), le magasin en tête avec le lien vers son carnet
export function CarteNote({ reseau, magasin, note, moi, autres, occupe, agir, mise, avecMagasin }: {
  reseau: Reseau; magasin: string; note: NoteMagasin; moi: string; autres: { nom: string }[]; occupe: boolean
  agir: (f: () => Promise<unknown>, ok: string, annuler?: () => void) => Promise<boolean>; mise: boolean; avecMagasin?: boolean
}) {
  const couleur = useCouleurTon()
  const t = tonDe(note)
  const [repondant, setRepondant] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const visite = note.visite != null ? reseau.visites.find((v) => v.id === note.visite) : undefined
  const repondre = async ({ texte, mentions }: ContenuNote) => {
    const r = { id: nouvelIdNote(), quand: new Date().toISOString(), texte, par: moi, ...(mentions.length ? { mentions } : {}) }
    const fait = await agir(() => modifierNoteMagasin(magasin, note.id, (n) => ({ ...n, reponses: [...(n.reponses ?? []), r] })), mentions.length ? `Réponse envoyée. ${mentions.join(', ')} ${mentions.length > 1 ? 'sont prévenus' : 'est prévenu'}.` : 'Réponse envoyée.')
    if (fait) setRepondant(false)
    return fait
  }
  // Ceux qui ont écrit sur la note sont déjà prévenus d'une réponse : on propose les autres
  const dejaDansLeFil = new Set([note.par, ...(note.reponses ?? []).map((x) => x.par)])
  const aPrevenir = autres.filter((p) => !dejaDansLeFil.has(p.nom))
  return (
    <Card ref={ref} id={`note-${note.id}`} component="article" aria-label={`Note ${libelleTon(t).toLowerCase()} du ${dateCourte(note.date)}${note.par ? ` par ${note.par}` : ''}`}
      sx={{ ...styleBloc, display: 'grid', gap: 0.75, borderLeft: 4, borderLeftColor: couleur(t).bord, scrollMarginTop: 120, ...(mise ? { outline: 2, outlineStyle: 'solid', outlineColor: 'secondary.main' } : {}), opacity: note.close ? 0.85 : 1 }}>
      {avecMagasin && (
        <Link component={RouterLink} to={lienNote(magasin, note.id)} underline="hover" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', justifySelf: 'start', minHeight: { xs: 48, md: 'auto' }, display: 'inline-flex', alignItems: 'center' }}
          aria-label={`Carnet de ${magasin}`}>{magasin}</Link>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Initiales nom={note.par || '?'} taille={32} />
        <Typography sx={{ fontWeight: 700 }}>{note.par || 'Équipe'}</Typography>
        <Typography variant="body2" color="text.secondary">{quandLisible(note.quand ?? note.date)}</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', ml: { sm: 'auto' } }}>
          <Chip size="small" label={libelleTon(t)} sx={{ ...couleur(t).puce, fontSize: '0.75rem' }} />
          {(note.themes ?? []).map((x) => <Chip key={x} size="small" variant="outlined" label={libelleTheme(x)} sx={{ fontSize: '0.75rem' }} />)}
          {visite && <Chip size="small" variant="outlined" label={`Visite du ${dateCourte(visite.date)}`} component={RouterLink} to={lienCompteRendu(visite)} clickable sx={{ fontSize: '0.75rem' }} />}
          {note.close && <Chip size="small" icon={<TaskAltOutlined />} label="Close" sx={{ fontSize: '0.75rem' }} />}
        </Box>
      </Box>
      {note.texte && <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{note.texte}</Typography>}
      {!!note.mentions?.length && (
        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <NotificationsActiveOutlined sx={{ fontSize: 16 }} aria-hidden />{`Prévenu${note.mentions.length > 1 ? 's' : ''} : ${note.mentions.join(', ')}`}
        </Typography>
      )}
      {!!note.reponses?.length && (
        <Box component="ul" aria-label="Réponses" sx={{ listStyle: 'none', m: 0, p: 0, pl: { xs: 1, sm: 2 }, borderLeft: 2, borderColor: 'divider', display: 'grid', gap: 1 }}>
          {note.reponses.map((x) => (
            <Box component="li" key={x.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Initiales nom={x.par || '?'} taille={26} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2"><Box component="span" sx={{ fontWeight: 700 }}>{x.par || 'Équipe'}</Box><Box component="span" sx={{ color: 'text.secondary' }}>{` · ${quandLisible(x.quand)}`}</Box></Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{x.texte}</Typography>
                {!!x.mentions?.length && <Typography variant="body2" color="text.secondary">{`Prévenu${x.mentions.length > 1 ? 's' : ''} : ${x.mentions.join(', ')}`}</Typography>}
              </Box>
            </Box>
          ))}
        </Box>
      )}
      {note.prise && !note.close && <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>{note.prise.par === moi ? 'Tu t’en occupes' : `${note.prise.par || 'Un collègue'} s’en occupe`}{` depuis le ${dateCourte(note.prise.quand.slice(0, 10))}`}</Typography>}
      {note.close && <Typography variant="body2" color="text.secondary">{`Close par ${note.close.par || 'l’équipe'} le ${dateCourte(note.close.quand.slice(0, 10))}`}</Typography>}
      {repondant ? (
        <SaisieNote label="Ta réponse" libelleEnvoi="Répondre" sansTon autoFocus autres={aPrevenir} envoyer={repondre} occupe={occupe || !moi} annuler={() => setRepondant(false)} />
      ) : (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button size="small" startIcon={<ReplyOutlined />} onClick={() => setRepondant(true)} sx={{ minHeight: 48 }}>Répondre</Button>
          {ouverte(note) && (!note.prise || note.prise.par === moi) && (
            <Button size="small" startIcon={note.prise ? undefined : <PanToolOutlined />} disabled={occupe || !moi} sx={{ minHeight: 48 }}
              onClick={() => void agir(() => modifierNoteMagasin(magasin, note.id, (n) => { const { prise: _p, ...reste } = n; void _p; return note.prise ? reste : { ...reste, prise: { par: moi, quand: new Date().toISOString() } } }),
                note.prise ? 'Tu ne t’en occupes plus.' : 'C’est noté : tu t’en occupes.')}>
              {note.prise ? 'Ne plus m’en occuper' : 'Je m’en occupe'}
            </Button>
          )}
          {aClore(note) && (
            <Button size="small" startIcon={note.close ? undefined : <TaskAltOutlined />} disabled={occupe || !moi} sx={{ minHeight: 48 }}
              onClick={() => void agir(() => modifierNoteMagasin(magasin, note.id, (n) => { const { close: _c, ...reste } = n; void _c; return note.close ? reste : { ...reste, close: { par: moi, quand: new Date().toISOString() } } }),
                note.close ? 'Note rouverte.' : 'Note close.')}>
              {note.close ? 'Rouvrir' : t === 'alerte' ? 'Clore l’alerte' : 'Clore'}
            </Button>
          )}
          {note.par === moi && (
            <Tooltip title="Supprimer la note">
              <IconButton aria-label="Supprimer la note" disabled={occupe} sx={{ width: 48, height: 48, ml: 'auto' }}
                onClick={() => void agir(() => supprimerNoteMagasin(magasin, note.id), 'Note supprimée.', () => void agir(() => enregistrerNoteMagasin(magasin, note), 'Note rétablie.'))}>
                <DeleteOutline />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
    </Card>
  )
}
