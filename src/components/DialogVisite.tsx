import { useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddLinkOutlined from '@mui/icons-material/AddLinkOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { Fenetre } from './EditionEquipe'
import { SaisieCompteRendu } from './SaisieCompteRendu'
import { enregistrerVisites, supprimerVisite } from '../data/chargement'
import { partiesVides } from '../data/compteRendu'
import { typesVisite, type ActionPlan, type Document, type Reseau, type Visite } from '../data/modele'

// Personnes qui peuvent visiter : Coachs, RR, Directeur
export function visiteurs(reseau: Reseau): string[] {
  return [...reseau.equipe.filter((c) => !c.fictif).map((c) => c.nom), ...reseau.rrs.map((r) => r.nom), reseau.directeur.nom].filter((n, i, t) => n && t.indexOf(n) === i)
}

export function DialogVisite({ reseau, visite, magasinsInitiaux = [], onFermer }: { reseau: Reseau; visite: Visite | null; magasinsInitiaux?: string[]; onFermer: (m?: string) => void }) {
  const [magasins, setMagasins] = useState<string[]>(visite ? [visite.magasin] : magasinsInitiaux)
  const [date, setDate] = useState(visite?.date ?? reseau.jour)
  const [type, setType] = useState(visite?.type ?? 'terrain')
  const coachDuPremier = reseau.magasins.find((m) => m.nom === magasinsInitiaux[0])?.coach ?? ''
  const [visiteur, setVisiteur] = useState(visite?.visiteur ?? coachDuPremier)
  const [signatureRequise, setSignatureRequise] = useState(visite?.signatureRequise ?? false)
  const [lienSigne, setLienSigne] = useState(visite?.lienSigne ?? '')
  const [dateSignature, setDateSignature] = useState(visite?.dateSignature ?? '')
  const [documents, setDocuments] = useState<Document[]>(visite?.documents.length ? visite.documents : [])
  const [notes, setNotes] = useState(visite?.notes ?? '')
  const [parties, setParties] = useState<string[]>(visite?.parties ?? partiesVides())
  const [plan, setPlan] = useState<ActionPlan[]>(visite?.plan ?? [])
  const unSeul = magasins.length === 1
  const valide = magasins.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date)
  const noms = reseau.magasins.map((m) => m.nom)
  return (
    <Fenetre
      large titre={visite ? `Modifier la visite de ${visite.magasin}` : 'Saisir une visite'} ouvert onFermer={onFermer} valide={valide}
      enregistrer={async () => {
        const groupe = visite?.groupe || (magasins.length > 1 ? `g_${Date.now()}` : '')
        await enregistrerVisites({ groupe, date, type, visiteur, signatureRequise, lienSigne: signatureRequise ? lienSigne.trim() : '', dateSignature: signatureRequise ? dateSignature : '', documents, notes: notes.trim(), parties: unSeul ? parties : partiesVides(), plan: unSeul ? plan : [] }, magasins, visite?.id ?? null)
        return visite ? 'Visite mise à jour.' : magasins.length > 1 ? `${magasins.length} visites enregistrées.` : 'Visite enregistrée.'
      }}
      supprimer={visite?.id ? async () => { await supprimerVisite(visite.id!); return 'Visite supprimée.' } : undefined}
      libelleSuppression={visite ? `Supprimer la visite du ${date} à ${visite.magasin} ?` : undefined}
    >
      <Autocomplete
        multiple
        options={noms}
        value={magasins}
        onChange={(_e, v) => setMagasins(visite ? v.slice(-1) : v)}
        disableCloseOnSelect={!visite}
        renderInput={(p) => <TextField {...p} label={visite ? 'Magasin' : 'Magasins visités'} helperText={visite ? ' ' : 'Une tournée : choisis plusieurs magasins, une visite est créée pour chacun.'} />}
        noOptionsText="Aucun magasin ne correspond"
      />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
        <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          {typesVisite.map((t) => <MenuItem key={t.id} value={t.id}>{t.libelle}</MenuItem>)}
        </TextField>
        <TextField select label="Visité par" value={visiteur} onChange={(e) => setVisiteur(e.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">Non précisé</MenuItem>
          {visiteurs(reseau).map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
        </TextField>
      </Box>
      <SaisieCompteRendu
        reseau={reseau} visite={visite} magasin={unSeul ? magasins[0] : ''} date={date}
        notes={notes} setNotes={setNotes} parties={parties} setParties={setParties} plan={plan} setPlan={setPlan}
      />
      <Box>
        <FormControlLabel control={<Switch checked={signatureRequise} onChange={(e) => setSignatureRequise(e.target.checked)} />} label="Visite contractuelle, à faire signer" sx={{ minHeight: 48 }} />
        <Collapse in={signatureRequise}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, mt: 1 }}>
            <TextField label="Lien du compte rendu signé (Drive)" value={lienSigne} onChange={(e) => setLienSigne(e.target.value)} placeholder="https://drive.google.com/…" />
            <TextField type="date" label="Signé le" value={dateSignature} onChange={(e) => setDateSignature(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Box>
        </Collapse>
      </Box>
      <Box>
        <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>Documents (liens Drive)</Typography>
        {documents.map((d, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
            <TextField label="Intitulé" value={d.label} onChange={(e) => setDocuments((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} sx={{ flex: 1 }} />
            <TextField label="Lien" value={d.url} onChange={(e) => setDocuments((x) => x.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)))} sx={{ flex: 2 }} />
            <IconButton aria-label={`Retirer le document ${i + 1}`} onClick={() => setDocuments((x) => x.filter((_y, j) => j !== i))}><CloseOutlined /></IconButton>
          </Box>
        ))}
        <Button startIcon={<AddLinkOutlined />} onClick={() => setDocuments((x) => [...x, { label: '', url: '' }])} sx={{ minHeight: 48 }}>Ajouter un document</Button>
      </Box>
    </Fenetre>
  )
}
