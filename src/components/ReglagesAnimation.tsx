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
