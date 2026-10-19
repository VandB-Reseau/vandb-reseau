import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { Fenetre } from './EditionEquipe'
import { enregistrerAssocies } from '../data/chargement'
import { associesDu, enPlace, etatMandat, libelleAssocies, libellesEtatMandat, mandatActuel, type Associe, type Mandat } from '../data/associes'
import { fichePersonne, franchises } from '../data/personnes'
import CallOutlined from '@mui/icons-material/CallOutlined'
import MailOutlined from '@mui/icons-material/MailOutlined'
import type { Magasin, Reseau } from '../data/modele'
import { dateCourte, lienFranchise, telLien } from '../lib/format'

const periode = (m: Mandat) => (m.debut && m.fin ? `du ${dateCourte(m.debut)} au ${dateCourte(m.fin)}` : m.debut ? `depuis le ${dateCourte(m.debut)}` : `jusqu’au ${dateCourte(m.fin)}`)

function PastilleMandat({ m, jour }: { m: Mandat | null; jour: string }) {
  const e = etatMandat(m, jour)
  if (!e || e === 'enCours') return null
  return <Chip size="small" color={e === 'echu' ? 'error' : 'warning'} label={libellesEtatMandat[e]} sx={{ fontSize: 12, fontWeight: 600 }} />
}

function LigneAssocie({ reseau, m, a, modifier }: { reseau: Reseau; m: Magasin; a: Associe; modifier?: () => void }) {
  const mandat = mandatActuel(a, reseau.jour)
  const detail = m.franchise
    ? [mandat ? `Mandat ${periode(mandat)}` : 'Mandat non renseigné', a.mandats.length > 1 && `${a.mandats.length} mandats`, a.sortie && `sorti le ${dateCourte(a.sortie)}`]
    : [a.entree && `Associé depuis le ${dateCourte(a.entree)}`, a.sortie && `sorti le ${dateCourte(a.sortie)}`]
  const fiche = m.franchise && franchises(reseau).some((f) => f.nom === a.nom)
  const p = fiche ? fichePersonne(reseau, { type: 'franchise', cle: a.nom }) : null
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {fiche ? <Link component={RouterLink} to={lienFranchise(a.nom)} variant="body1" sx={{ fontWeight: 500, display: 'inline-flex', minHeight: 32, alignItems: 'center' }}>{a.nom}</Link>
          : <Typography variant="body1" sx={{ fontWeight: 500 }}>{a.nom}</Typography>}
        {detail.some(Boolean) && <Typography variant="body2" color="text.secondary">{detail.filter(Boolean).join(' · ')}</Typography>}
      </Box>
      {m.franchise && enPlace(a, reseau.jour) && <PastilleMandat m={mandat} jour={reseau.jour} />}
      {p?.telephone && <Tooltip title={p.telephone}><IconButton href={telLien(p.telephone)} aria-label={`Appeler ${a.nom}`}><CallOutlined /></IconButton></Tooltip>}
      {p?.email && <Tooltip title={p.email}><IconButton href={`mailto:${p.email}`} aria-label={`Écrire à ${a.nom}`}><MailOutlined /></IconButton></Tooltip>}
      {modifier && <Tooltip title="Modifier"><IconButton onClick={modifier} aria-label={`Modifier l’associé ${a.nom}`}><EditOutlined /></IconButton></Tooltip>}
    </Box>
  )
}

// Associés en place, puis anciens associés ; pour un intégré, V and B en tête
export function ListeAssocies({ reseau, m, signaler }: { reseau: Reseau; m: Magasin; signaler: (msg: string) => void }) {
  const [edition, setEdition] = useState<Associe | null | undefined>(undefined)
  const tous = associesDu(reseau, m)
  const enplace = tous.filter((a) => enPlace(a, reseau.jour))
  const anciens = tous.filter((a) => !enPlace(a, reseau.jour))
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
        <Typography variant="h4" component="h3" sx={{ flex: 1 }}>{libelleAssocies(m)}</Typography>
        <Button startIcon={<AddOutlined />} onClick={() => setEdition(null)} sx={{ minHeight: 48 }} aria-label="Ajouter un associé">Ajouter</Button>
      </Box>
      {!m.franchise && <Box sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}><Typography variant="body1" sx={{ fontWeight: 500 }}>V and B</Typography></Box>}
      {enplace.length === 0 && m.franchise && <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>Aucun franchisé associé renseigné.</Typography>}
      {enplace.map((a) => <LigneAssocie key={a.id} reseau={reseau} m={m} a={a} modifier={() => setEdition(a)} />)}
      {anciens.length > 0 && (
        <>
          <Typography variant="subtitle2" component="h4" color="text.secondary" sx={{ mt: 1.5 }}>Anciens associés</Typography>
          {anciens.map((a) => <LigneAssocie key={a.id} reseau={reseau} m={m} a={a} modifier={() => setEdition(a)} />)}
        </>
      )}
      {edition !== undefined && <DialogAssocie reseau={reseau} m={m} associe={edition} onFermer={(msg) => { setEdition(undefined); if (msg) signaler(msg) }} />}
    </Box>
  )
}

const dateValide = (d: string) => !d || /^\d{4}-\d{2}-\d{2}$/.test(d)

function DialogAssocie({ reseau, m, associe, onFermer }: { reseau: Reseau; m: Magasin; associe: Associe | null; onFermer: (msg?: string) => void }) {
  const tous = associesDu(reseau, m)
  const [nom, setNom] = useState(associe?.nom ?? '')
  const [entree, setEntree] = useState(associe?.entree ?? '')
  const [sortie, setSortie] = useState(associe?.sortie ?? '')
  const [mandats, setMandats] = useState<Mandat[]>(associe?.mandats.length ? associe.mandats : m.franchise ? [{ debut: '', fin: '' }] : [])
  const n = nom.trim().replace(/\s+/g, ' ')
  const doublon = tous.some((a) => a !== associe && a.nom.toLowerCase() === n.toLowerCase())
  const mandatsValides = mandats.every((x) => dateValide(x.debut) && dateValide(x.fin) && (!x.debut || !x.fin || x.debut <= x.fin))
  const connus = franchises(reseau).map((f) => f.nom)
  const changerMandat = (i: number, cle: keyof Mandat, v: string) => setMandats((l) => l.map((x, j) => (j === i ? { ...x, [cle]: v } : x)))
  const ecrire = (liste: Associe[]) => enregistrerAssocies(reseau, m.nom, liste)
  return (
    <Fenetre titre={associe ? `Modifier ${associe.nom}` : 'Ajouter un associé'} ouvert large onFermer={onFermer}
      valide={!!n && !doublon && mandatsValides && dateValide(entree) && dateValide(sortie)}
      enregistrer={async () => {
        const propre: Associe = { id: associe?.id ?? '', nom: n, entree: m.franchise ? '' : entree, sortie, mandats: mandats.filter((x) => x.debut || x.fin).sort((x, y) => (x.debut || x.fin).localeCompare(y.debut || y.fin)) }
        await ecrire(associe ? tous.map((a) => (a === associe ? propre : a)) : [...tous, propre])
        return associe ? `${n} est mis à jour.` : `${n} est ajouté aux associés.`
      }}
      supprimer={associe ? async () => { await ecrire(tous.filter((a) => a !== associe)); return `${associe.nom} est retiré des associés.` } : undefined}
      libelleSuppression={associe ? `Retirer ${associe.nom} des associés de ${m.nom} ? Ses mandats seront effacés.` : undefined}>
      <Autocomplete freeSolo options={m.franchise ? connus : []} value={nom} inputValue={nom} onInputChange={(_e, v) => setNom(v)}
        renderInput={(p) => <TextField {...p} label="Nom" autoFocus={!associe} error={doublon} helperText={doublon ? 'Déjà associé à ce magasin.' : ' '} />} />
      {m.franchise ? (
        <Box role="group" aria-label="Mandats">
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>Mandats</Typography>
          {mandats.map((x, i) => (
            <Box key={i} sx={{ display: 'grid', gap: 1, mb: 1.5, alignItems: 'center', gridTemplateColumns: '1fr 1fr 48px' }}>
              <TextField type="date" label="Début du mandat" value={x.debut} onChange={(e) => changerMandat(i, 'debut', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField type="date" label="Fin du mandat" value={x.fin} onChange={(e) => changerMandat(i, 'fin', e.target.value)} slotProps={{ inputLabel: { shrink: true } }}
                error={!!x.debut && !!x.fin && x.fin < x.debut} />
              <IconButton aria-label={`Retirer le mandat ${i + 1}`} onClick={() => setMandats((l) => l.filter((_y, j) => j !== i))}><CloseOutlined /></IconButton>
            </Box>
          ))}
          <Button startIcon={<AddOutlined />} sx={{ minHeight: 48 }} onClick={() => setMandats((l) => {
            const fin = l.at(-1)?.fin
            const debut = fin ? new Date(Date.parse(`${fin}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) : ''
            return [...l, { debut, fin: '' }]
          })}>{mandats.length ? 'Ajouter une reconduction' : 'Ajouter un mandat'}</Button>
        </Box>
      ) : (
        <TextField type="date" label="Associé depuis le" value={entree} onChange={(e) => setEntree(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      )}
      <TextField type="date" label="Date de sortie" value={sortie} onChange={(e) => setSortie(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
    </Fenetre>
  )
}

export { PastilleMandat, periode }
