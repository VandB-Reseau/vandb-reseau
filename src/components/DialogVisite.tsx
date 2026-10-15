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
import { enregistrerAudit, enregistrerChiffres, enregistrerVisites, supprimerVisite } from '../data/chargement'
import { ChampsChiffres, useSaisieChiffres } from './Chiffres'
import { auditDe, lireNombre, moisPrecedent, typesAudit, typesContact } from '../data/chiffres'
import { partiesVides } from '../data/compteRendu'
import { typesVisite, type ActionPlan, type Document, type Reseau, type Visite } from '../data/modele'

// Personnes qui peuvent visiter : Coachs, RR, Directeur
export function visiteursGroupes(reseau: Reseau): { nom: string; groupe: string }[] {
  const tous = [
    ...reseau.equipe.filter((c) => !c.fictif).map((c) => ({ nom: c.nom, groupe: 'Coachs' })),
    ...reseau.rrs.map((r) => ({ nom: r.nom, groupe: 'Responsables Régionaux' })),
    { nom: reseau.directeur.nom, groupe: 'Directeur de réseau' },
  ]
  return tous.filter((p, i) => p.nom && tous.findIndex((x) => x.nom === p.nom) === i)
}
export function visiteurs(reseau: Reseau): string[] { return visiteursGroupes(reseau).map((p) => p.nom) }

export function DialogVisite({ reseau, visite, magasinsInitiaux = [], typeInitial = 'terrain', onFermer }: { reseau: Reseau; visite: Visite | null; magasinsInitiaux?: string[]; typeInitial?: string; onFermer: (m?: string) => void }) {
  const [magasins, setMagasins] = useState<string[]>(visite ? [visite.magasin] : magasinsInitiaux)
  const [date, setDate] = useState(visite?.date ?? reseau.jour)
  const [type, setType] = useState(visite?.type ?? typeInitial)
  // Par défaut : le Coach du magasin, tant que les participants n'ont pas été choisis à la main
  const coachDe = (noms: string[]) => { const c = reseau.magasins.find((m) => m.nom === noms[0])?.coach; return c ? [c] : [] }
  const [participants, setParticipants] = useState<string[]>(visite?.visiteurs ?? coachDe(magasinsInitiaux))
  const [participantsChoisis, setParticipantsChoisis] = useState(!!visite)
  const groupes = visiteursGroupes(reseau)
  const options = [...groupes.map((p) => p.nom), ...participants.filter((n) => !groupes.some((p) => p.nom === n))]
  const groupeDe = (n: string) => groupes.find((p) => p.nom === n)?.groupe ?? 'Autres'
  const [signatureRequise, setSignatureRequise] = useState(visite?.signatureRequise ?? false)
  const [lienSigne, setLienSigne] = useState(visite?.lienSigne ?? '')
  const [dateSignature, setDateSignature] = useState(visite?.dateSignature ?? '')
  const [documents, setDocuments] = useState<Document[]>(visite?.documents.length ? visite.documents : [])
  const [notes, setNotes] = useState(visite?.notes ?? '')
  const [parties, setParties] = useState<string[]>(visite?.parties ?? partiesVides())
  const [plan, setPlan] = useState<ActionPlan[]>(visite?.plan ?? [])
  const unSeul = magasins.length <= 1
  const contact = typesContact.includes(type)
  const audit = typesAudit.includes(type) && unSeul
  const auditAvant = visite ? auditDe(reseau, visite.magasin, visite.date, visite.type) : null
  const [conforme, setConforme] = useState(auditAvant?.conforme === true ? 'oui' : auditAvant?.conforme === false ? 'non' : '')
  const [score, setScore] = useState(auditAvant?.score === null || auditAvant?.score === undefined ? '' : String(auditAvant.score).replace('.', ','))
  const scoreLu = lireNombre(score)
  const scoreInvalide = !!score.trim() && (scoreLu === null || scoreLu < 0 || scoreLu > 100)
  const chiffres = useSaisieChiffres(reseau, magasins[0] ?? '', moisPrecedent(visite?.date ?? reseau.jour))
  const valide = magasins.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && (!unSeul || chiffres.valide) && !(audit && scoreInvalide)
  const noms = reseau.magasins.map((m) => m.nom)
  return (
    <Fenetre
      large titre={visite ? `Modifier la visite de ${visite.magasin}` : 'Saisir une visite'} ouvert onFermer={onFermer} valide={valide}
      enregistrer={async () => {
        const groupe = visite?.groupe || (magasins.length > 1 ? `g_${Date.now()}` : '')
        const signe = signatureRequise && !contact
        await enregistrerVisites({ groupe, date, type, visiteurs: participants, signatureRequise: signe, lienSigne: signe ? lienSigne.trim() : '', dateSignature: signe ? dateSignature : '', documents: contact ? [] : documents, notes: notes.trim(), parties: unSeul && !contact ? parties : partiesVides(), plan: unSeul && !contact ? plan : [] }, magasins, visite?.id ?? null)
        if (unSeul && chiffres.modifie) await enregistrerChiffres([chiffres.ligne()])
        const resultat = audit && (conforme || scoreLu !== null) ? { date, type, conforme: conforme ? conforme === 'oui' : null, score: scoreLu } : null
        const ancien = visite && typesAudit.includes(visite.type) ? { date: visite.date, type: visite.type } : null
        if (resultat || (ancien && auditAvant)) await enregistrerAudit(magasins[0], ancien, resultat)
        return visite ? 'Visite mise à jour.' : magasins.length > 1 ? `${magasins.length} visites enregistrées.` : 'Visite enregistrée.'
      }}
      supprimer={visite?.id ? async () => {
        await supprimerVisite(visite.id!)
        if (auditAvant) await enregistrerAudit(visite.magasin, { date: visite.date, type: visite.type }, null)
        return 'Visite supprimée.'
      } : undefined}
      libelleSuppression={visite ? `Supprimer la visite du ${date} à ${visite.magasin} ?` : undefined}
    >
      <Autocomplete
        multiple
        options={noms}
        value={magasins}
        onChange={(_e, v) => { const m = visite ? v.slice(-1) : v; setMagasins(m); if (!participantsChoisis) setParticipants(coachDe(m)) }}
        disableCloseOnSelect={!visite}
        renderInput={(p) => <TextField {...p} label={visite ? 'Magasin' : 'Magasins visités'} />}
        noOptionsText="Aucun magasin ne correspond"
      />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          {typesVisite.map((t) => <MenuItem key={t.id} value={t.id}>{t.libelle}</MenuItem>)}
        </TextField>
      </Box>
      <Autocomplete
        multiple
        options={options}
        groupBy={groupeDe}
        value={participants}
        onChange={(_e, v) => { setParticipants(v); setParticipantsChoisis(true) }}
        disableCloseOnSelect
        renderInput={(p) => <TextField {...p} label={contact ? 'Fait par' : 'Visité par'} />}
        noOptionsText="Aucune personne ne correspond"
      />
      {audit && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField select label="Résultat de l’audit" value={conforme} onChange={(e) => setConforme(e.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
            <MenuItem value="">Non renseigné</MenuItem>
            <MenuItem value="oui">Conforme</MenuItem>
            <MenuItem value="non">Non conforme</MenuItem>
          </TextField>
          <TextField label="Score de l’audit (%)" value={score} onChange={(e) => setScore(e.target.value)} error={scoreInvalide} helperText={scoreInvalide ? 'Entre 0 et 100' : undefined} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        </Box>
      )}
      {contact
        ? <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={3} />
        : <SaisieCompteRendu
          reseau={reseau} visite={visite} tournee={!unSeul} magasin={magasins[0] ?? ''} date={date}
          notes={notes} setNotes={setNotes} parties={parties} setParties={setParties} plan={plan} setPlan={setPlan}
        />}
      {unSeul && magasins[0] && <ChampsChiffres s={chiffres} reseau={reseau} titre="Chiffres du mois" />}
      {!contact && <>
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
      </>}
    </Fenetre>
  )
}
