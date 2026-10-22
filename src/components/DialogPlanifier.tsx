import { useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import { Fenetre } from './EditionEquipe'
import { useAuth } from '../auth/AuthContext'
import { monNomPorteur } from '../data/actions'
import { coachA } from '../data/charge'
import { magasinsDu, perimetreDuProfil } from '../data/perimetre'
import { enregistrerPreparation, enregistrerVisites, supprimerVisite } from '../data/chargement'
import { partiesVides } from '../data/compteRendu'
import { preparationDe } from '../data/semaine'
import { lienGoogleAgenda } from '../lib/agenda'
import { dateCourte } from '../lib/format'
import type { Reseau, Visite } from '../data/modele'

// Planifier une visite (ou une tournée le même jour) : date, notes de préparation, puis Google Agenda prérempli.
// Sans magasin donné, la personne choisit parmi les siens, dus ou non
export function DialogPlanifier({ reseau, magasins: initiaux, coach: coachDonne, dateInitiale, visite, onFermer }: {
  reseau: Reseau; magasins: string[]; coach?: string; dateInitiale: string; visite?: Visite | null; onFermer: (m?: string) => void
}) {
  const { profil } = useAuth()
  const [choix] = useState(!initiaux.length)
  const [noms, setNoms] = useState(initiaux)
  const options = choix ? magasinsDu(reseau, coachDonne ? { type: 'coach', nom: coachDonne } : perimetreDuProfil(profil) ?? { type: 'reseau' }).map((m) => m.nom).sort((a, b) => a.localeCompare(b, 'fr')) : []
  const magasins = noms.map((n) => reseau.magasins.find((m) => m.nom === n)).filter((m) => !!m)
  const coach = coachDonne || (magasins[0] ? coachA(magasins[0], reseau.jour) : '')
  // Visite à reporter : la date passée n'est pas reprise
  const [date, setDate] = useState(visite && visite.date >= reseau.jour ? visite.date : dateInitiale)
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(noms.map((n) => [n, preparationDe(reseau, n)?.notes ?? ''])))
  const [agenda, setAgenda] = useState(!visite)
  const unSeul = magasins.length === 1
  const valide = magasins.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= reseau.jour
  return (
    <Fenetre
      titre={choix ? 'Planifier une visite' : unSeul ? `Visite de ${magasins[0].nom}` : `Tournée de ${magasins.length} magasins`} ouvert onFermer={onFermer} valide={valide}
      enregistrer={async () => {
        // Ouvert avant toute attente : le navigateur ne le bloque pas
        if (agenda) window.open(lienGoogleAgenda({ magasins, date, notes }), '_blank', 'noopener')
        if (visite) {
          if (visite.date !== date) await enregistrerVisites({ ...visite, date, prevue: true }, [visite.magasin], visite.id)
        } else {
          await enregistrerVisites({ groupe: magasins.length > 1 ? `g_${Date.now()}` : '', date, type: 'terrain', visiteurs: coach ? [coach] : [], signatureRequise: false, lienSigne: '', dateSignature: '', documents: [], photos: [], notes: '', parties: partiesVides(), plan: [], prevue: true }, noms, null)
        }
        const par = monNomPorteur(reseau, profil) || reseau.directeur.nom
        for (const n of noms) await enregistrerPreparation(n, { notes: notes[n] ?? '', heure: '', par, maj: reseau.jour })
        return unSeul ? `Visite planifiée le ${dateCourte(date)}.` : `${magasins.length} visites planifiées le ${dateCourte(date)}.`
      }}
      supprimer={visite?.id ? async () => { await supprimerVisite(visite.id!); return 'Visite retirée du planning.' } : undefined}
      libelleSuppression={visite ? `Retirer du planning la visite du ${dateCourte(visite.date)} à ${visite.magasin} ?` : undefined}
    >
      {choix && (
        <Autocomplete multiple options={options} value={noms} disableCloseOnSelect noOptionsText="Aucun magasin ne correspond"
          onChange={(_e, v) => { setNoms(v); setNotes((x) => ({ ...Object.fromEntries(v.map((n) => [n, preparationDe(reseau, n)?.notes ?? ''])), ...x })) }}
          renderInput={(p) => <TextField {...p} label="Magasins" />} />
      )}
      <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: reseau.jour } }} error={!!date && date < reseau.jour} />
      {magasins.map((m) => (
        <TextField key={m.nom} multiline minRows={unSeul ? 5 : 2} label={unSeul ? 'Notes de préparation' : `Notes · ${m.nom}`} value={notes[m.nom] ?? ''}
          onChange={(e) => setNotes((x) => ({ ...x, [m.nom]: e.target.value }))} />
      ))}
      <FormControlLabel control={<Switch checked={agenda} onChange={(e) => setAgenda(e.target.checked)} />} label="Ajouter à Google Agenda" sx={{ minHeight: 48 }} />
    </Fenetre>
  )
}
