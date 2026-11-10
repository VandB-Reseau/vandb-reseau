// Paramètres › Animation (refonte vague 4, Joseph 10/11/2026) : rituels d'animation suivis (33A) et interlocuteur de
// chaque thème des demandes des franchisés (37A). Réglés par le Directeur seul.
import { useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { cartouche } from './Social'
import { useReseau } from '../data/ReseauContext'
import { enregistrerInterlocuteurs, enregistrerRituels } from '../data/chargement'
import { quiRituel, rituelsParDefaut, type Rituel } from '../data/rituels'
import { themesDemande } from '../data/demandes'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import { enregistrerParcours, enregistrerTempsForts } from '../data/chargement'
import { ANNONCE_PAR_DEFAUT, type TempsFort } from '../data/tempsForts'
import { libellesResponsable, parcoursParDefaut, type EtapeParcours, type ResponsableEtape } from '../data/integration'
import type { Reseau } from '../data/modele'

function Pied({ modifie, envoi, annuler, enregistrer }: { modifie: boolean; envoi: boolean; annuler: () => void; enregistrer: () => void }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, mt: 3, justifyContent: 'flex-end' }}>
      <Button disabled={!modifie || envoi} onClick={annuler} sx={{ minHeight: 48 }}>Annuler</Button>
      <Button variant="contained" disabled={!modifie || envoi} onClick={enregistrer} sx={{ minHeight: 48 }}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
    </Box>
  )
}

export function RegleRituels({ reseau, signaler }: { reseau: Reseau; signaler: (m: string) => void }) {
  const { recharger } = useReseau()
  const initiaux = () => reseau.rituels ?? rituelsParDefaut
  const [liste, setListe] = useState<Rituel[]>(initiaux)
  const [envoi, setEnvoi] = useState(false)
  const modifie = JSON.stringify(liste) !== JSON.stringify(initiaux())
  const changer = (i: number, f: Partial<Rituel>) => setListe((l) => l.map((r, j) => (j === i ? { ...r, ...f } : r)))
  const enregistrer = async () => {
    setEnvoi(true)
    try { await enregistrerRituels(liste.map((r) => ({ ...r, libelle: r.libelle.trim() || rituelsParDefaut.find((d) => d.type === r.type)!.libelle }))); await recharger(); signaler('Rituels enregistrés.') }
    catch { signaler('Les rituels n’ont pas pu être enregistrés. Vérifie ta connexion et réessaie.') }
    finally { setEnvoi(false) }
  }
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography component="h2" sx={[cartouche, { mb: 1.5 }]}>Rituels d’animation</Typography>
        {liste.map((r, i) => (
          <Box key={r.type} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 1.25, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 }, flexWrap: 'wrap' }}>
            <TextField label={`Rituel du ${quiRituel[r.type]}`} value={r.libelle} onChange={(e) => changer(i, { libelle: e.target.value })} disabled={!r.actif} sx={{ flex: 1, minWidth: 240 }} slotProps={{ htmlInput: { maxLength: 120 } }} />
            <Box component="label" sx={{ display: 'flex', alignItems: 'center', minHeight: 48 }}>
              <Switch checked={r.actif} onChange={(e) => changer(i, { actif: e.target.checked })} slotProps={{ input: { 'aria-label': `Suivre : ${r.libelle}` } }} />
              <Typography variant="body2">{r.actif ? 'Suivi' : 'Pas suivi'}</Typography>
            </Box>
          </Box>
        ))}
        <Pied modifie={modifie} envoi={envoi} annuler={() => setListe(initiaux())} enregistrer={() => void enregistrer()} />
      </CardContent>
    </Card>
  )
}

export function RegleInterlocuteurs({ reseau, signaler }: { reseau: Reseau; signaler: (m: string) => void }) {
  const { recharger } = useReseau()
  const initiaux = () => ({ ...(reseau.interlocuteursDemandes ?? {}) })
  const [valeurs, setValeurs] = useState<Record<string, string>>(initiaux)
  const [envoi, setEnvoi] = useState(false)
  const personnes = [reseau.directeur.nom, ...reseau.rrs.map((r) => r.nom), ...reseau.equipe.filter((c) => !c.fictif).map((c) => c.nom)].filter(Boolean)
  const propre = (v: Record<string, string>) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()]).filter(([, x]) => x))
  const modifie = JSON.stringify(propre(valeurs)) !== JSON.stringify(propre(initiaux()))
  const enregistrer = async () => {
    setEnvoi(true)
    try { await enregistrerInterlocuteurs(propre(valeurs)); await recharger(); signaler('Interlocuteurs enregistrés.') }
    catch { signaler('Les interlocuteurs n’ont pas pu être enregistrés. Vérifie ta connexion et réessaie.') }
    finally { setEnvoi(false) }
  }
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography component="h2" sx={[cartouche, { mb: 1.5 }]}>Interlocuteur par thème</Typography>
        <Box sx={{ display: 'grid', gap: 2 }}>
          {themesDemande.map((t) => (
            <Autocomplete key={t.v} freeSolo options={personnes} value={valeurs[t.v] ?? ''} onInputChange={(_, v) => setValeurs((x) => ({ ...x, [t.v]: v }))}
              renderInput={(p) => <TextField {...p} label={t.libelle} placeholder="Personne ou service" />} />
          ))}
        </Box>
        <Pied modifie={modifie} envoi={envoi} annuler={() => setValeurs(initiaux())} enregistrer={() => void enregistrer()} />
      </CardContent>
    </Card>
  )
}

const nouvelId = (prefixe: string) => `${prefixe}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
const ligneReglage = { display: 'flex', gap: 1.5, alignItems: 'center', py: 1.25, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap' } as const

// Temps forts de l'année (refonte vague 5, 48A) : nom, dates, annonce aux franchisés N jours avant (45 par défaut)
export function RegleTempsForts({ reseau, signaler }: { reseau: Reseau; signaler: (m: string) => void }) {
  const { recharger } = useReseau()
  const initiaux = () => reseau.tempsForts ?? []
  const [liste, setListe] = useState<TempsFort[]>(initiaux)
  const [envoi, setEnvoi] = useState(false)
  const modifie = JSON.stringify(liste) !== JSON.stringify(initiaux())
  const changer = (i: number, f: Partial<TempsFort>) => setListe((l) => l.map((t, j) => (j === i ? { ...t, ...f } : t)))
  const valide = liste.every((t) => t.nom.trim() && /^\d{4}-\d{2}-\d{2}$/.test(t.debut) && (!t.fin || t.fin >= t.debut))
  const enregistrer = async () => {
    setEnvoi(true)
    try {
      await enregistrerTempsForts(liste.map((t) => ({ ...t, nom: t.nom.trim(), detail: t.detail.trim(), fin: t.fin || t.debut })).sort((a, b) => a.debut.localeCompare(b.debut)))
      await recharger(); signaler('Temps forts enregistrés.')
    } catch { signaler('Les temps forts n’ont pas pu être enregistrés. Vérifie ta connexion et réessaie.') }
    finally { setEnvoi(false) }
  }
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography component="h2" sx={[cartouche, { mb: 1.5 }]}>Temps forts de l’année</Typography>
        {!liste.length && <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>Aucun temps fort. Noël, Beaujolais nouveau, Fête des pères : chacun s’annonce aux franchisés quelques semaines avant.</Typography>}
        {liste.map((t, i) => (
          <Box key={t.id} sx={ligneReglage}>
            <TextField label="Temps fort" value={t.nom} onChange={(e) => changer(i, { nom: e.target.value })} sx={{ flex: 2, minWidth: 200 }} slotProps={{ htmlInput: { maxLength: 80 } }} />
            <TextField type="date" label="Début" value={t.debut} onChange={(e) => changer(i, { debut: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 170 }} />
            <TextField type="date" label="Fin" value={t.fin} onChange={(e) => changer(i, { fin: e.target.value })} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: t.debut } }} sx={{ width: 170 }} />
            <TextField type="number" label="Annoncé (jours avant)" value={t.annonce} onChange={(e) => changer(i, { annonce: Math.max(0, Math.min(180, Math.round(Number(e.target.value) || 0))) })} sx={{ width: 170 }} slotProps={{ htmlInput: { min: 0, max: 180 } }} />
            <TextField label="À préparer" value={t.detail} onChange={(e) => changer(i, { detail: e.target.value })} sx={{ flex: 3, minWidth: 240 }} slotProps={{ htmlInput: { maxLength: 500 } }} />
            <Tooltip title="Retirer"><IconButton aria-label={`Retirer ${t.nom || 'ce temps fort'}`} onClick={() => setListe((l) => l.filter((_x, j) => j !== i))} sx={{ width: 48, height: 48 }}><DeleteOutlineOutlined /></IconButton></Tooltip>
          </Box>
        ))}
        <Button startIcon={<AddOutlined />} onClick={() => setListe((l) => [...l, { id: nouvelId('tf'), nom: '', debut: '', fin: '', annonce: ANNONCE_PAR_DEFAUT, detail: '' }])} sx={{ minHeight: 48, mt: 1 }}>Ajouter un temps fort</Button>
        <Pied modifie={modifie && valide} envoi={envoi} annuler={() => setListe(initiaux())} enregistrer={() => void enregistrer()} />
      </CardContent>
    </Card>
  )
}

// Parcours d'intégration (refonte vague 5, 50A) : les étapes des 6 premiers mois d'un magasin, réglables par le Directeur
export function RegleParcours({ reseau, signaler }: { reseau: Reseau; signaler: (m: string) => void }) {
  const { recharger } = useReseau()
  const initiaux = () => reseau.parcoursIntegration ?? parcoursParDefaut
  const [liste, setListe] = useState<EtapeParcours[]>(initiaux)
  const [envoi, setEnvoi] = useState(false)
  const modifie = JSON.stringify(liste) !== JSON.stringify(initiaux())
  const changer = (i: number, f: Partial<EtapeParcours>) => setListe((l) => l.map((e, j) => (j === i ? { ...e, ...f } : e)))
  const valide = liste.every((e) => e.libelle.trim())
  const enregistrer = async () => {
    setEnvoi(true)
    try { await enregistrerParcours(liste.map((e) => ({ ...e, libelle: e.libelle.trim() })).sort((a, b) => a.jour - b.jour)); await recharger(); signaler('Parcours d’intégration enregistré.') }
    catch { signaler('Le parcours n’a pas pu être enregistré. Vérifie ta connexion et réessaie.') }
    finally { setEnvoi(false) }
  }
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography component="h2" sx={[cartouche, { mb: 1.5 }]}>Parcours d’intégration</Typography>
        {liste.map((e, i) => (
          <Box key={e.id} sx={ligneReglage}>
            <TextField type="number" label="Jour" value={e.jour} onChange={(x) => changer(i, { jour: Math.max(0, Math.min(365, Math.round(Number(x.target.value) || 0))) })} sx={{ width: 110 }} slotProps={{ htmlInput: { min: 0, max: 365 } }} />
            <TextField label="Étape" value={e.libelle} onChange={(x) => changer(i, { libelle: x.target.value })} sx={{ flex: 1, minWidth: 240 }} slotProps={{ htmlInput: { maxLength: 120 } }} />
            <TextField select label="Qui" value={e.responsable} onChange={(x) => changer(i, { responsable: x.target.value as ResponsableEtape })} sx={{ width: 220 }}>
              {(Object.keys(libellesResponsable) as ResponsableEtape[]).map((r) => <MenuItem key={r} value={r}>{libellesResponsable[r]}</MenuItem>)}
            </TextField>
            <Tooltip title="Retirer"><IconButton aria-label={`Retirer ${e.libelle || 'cette étape'}`} onClick={() => setListe((l) => l.filter((_x, j) => j !== i))} sx={{ width: 48, height: 48 }}><DeleteOutlineOutlined /></IconButton></Tooltip>
          </Box>
        ))}
        <Button startIcon={<AddOutlined />} onClick={() => setListe((l) => [...l, { id: nouvelId('e'), libelle: '', jour: (l.at(-1)?.jour ?? 0) + 15, responsable: 'coach' }])} sx={{ minHeight: 48, mt: 1 }}>Ajouter une étape</Button>
        <Pied modifie={modifie && valide} envoi={envoi} annuler={() => setListe(initiaux())} enregistrer={() => void enregistrer()} />
      </CardContent>
    </Card>
  )
}
