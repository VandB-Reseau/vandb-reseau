import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { PageHeader } from '../components/PageHeader'
import { EspacePhotos, GrillesAudit } from '../components/EditeurGrilles'
import { EditeurGrilleNineBox } from '../components/EditeurGrilleNineBox'
import { CarteEffacerNotes, CarteThematiques } from '../components/ImportsSuivi'
import { AvecReseau } from '../components/EtatDonnees'
import { chargeA, niveauCharge } from '../data/charge'
import { enregistrerParametres } from '../data/chargement'
import { useReseau } from '../data/ReseauContext'
import type { ParametresReseau, Reseau } from '../data/modele'
import { analyser, referencesPossibles, type SeuilsAlerte } from '../data/chiffres'

type Cle = keyof ParametresReseau
const champs: { cle: Cle; libelle: string; aide: string; min: number; max: number }[] = [
  { cle: 'maxUnits', libelle: 'Charge maximale d’un Coach', aide: 'Au-delà, le Coach est en dépassement.', min: 1, max: 30 },
  { cle: 'alertThreshold', libelle: 'Seuil d’attention', aide: 'À partir de cette charge, le Coach est à surveiller.', min: 1, max: 30 },
  { cle: 'poidsOuvert', libelle: 'Unités pour un magasin ouvert', aide: 'Magasin en activité courante.', min: 0, max: 5 },
  { cle: 'poidsRenforce', libelle: 'Unités pour un magasin en accompagnement renforcé', aide: 'Magasin en pré-ouverture ou ouvert depuis peu.', min: 0, max: 5 },
  { cle: 'prepDuration', libelle: 'Mois de pré-ouverture', aide: 'Le Coach prend en charge le magasin ce nombre de mois avant l’ouverture.', min: 0, max: 12 },
  { cle: 'postDuration', libelle: 'Mois d’accompagnement après ouverture', aide: 'Durée pendant laquelle un magasin reste « nouvelle ouverture ».', min: 0, max: 24 },
  { cle: 'maxCoachsRR', libelle: 'Coachs maximum par Responsable Régional', aide: 'Sert aux propositions de rattachement des Coachs aux Responsables Régionaux.', min: 1, max: 30 },
]

function compterDepassements(reseau: Reseau, p: ParametresReseau) {
  const r = { ...reseau, parametres: p }
  return reseau.equipe.filter((c) => niveauCharge(r, chargeA(r, c.nom)) === 'depassement').length
}

function RegleCharge({ reseau }: { reseau: Reseau }) {
  const { recharger } = useReseau()
  const [valeurs, setValeurs] = useState<Record<Cle, string>>(() => Object.fromEntries(champs.map((c) => [c.cle, String(reseau.parametres[c.cle])])) as Record<Cle, string>)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(false)
  const [ok, setOk] = useState(false)
  const nombres = Object.fromEntries(champs.map((c) => [c.cle, Number(valeurs[c.cle])])) as unknown as ParametresReseau
  const invalides = champs.filter((c) => valeurs[c.cle] === '' || !Number.isInteger(nombres[c.cle]) || nombres[c.cle] < c.min || nombres[c.cle] > c.max)
  const incoherent = !invalides.length && nombres.alertThreshold > nombres.maxUnits
  const modifie = champs.some((c) => nombres[c.cle] !== reseau.parametres[c.cle])
  const apres = invalides.length ? null : compterDepassements(reseau, nombres)
  const avant = compterDepassements(reseau, reseau.parametres)

  const enregistrer = async () => {
    setEnvoi(true); setErreur(false)
    try {
      await enregistrerParametres(nombres as unknown as Record<string, number>)
      await recharger(); setOk(true)
    } catch { setErreur(true) } finally { setEnvoi(false) }
  }

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h3" component="h2" sx={{ mb: 3 }}>Règle de charge des Coachs</Typography>
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          {champs.map((c) => (
            <TextField
              key={c.cle}
              type="number"
              label={c.libelle}
              value={valeurs[c.cle]}
              onChange={(e) => setValeurs((v) => ({ ...v, [c.cle]: e.target.value }))}
              error={invalides.includes(c)}
              helperText={invalides.includes(c) ? `Entre ${c.min} et ${c.max}, nombre entier.` : ' '}
              slotProps={{ htmlInput: { min: c.min, max: c.max, step: 1 } }}
            />
          ))}
        </Box>
        {incoherent && <Alert severity="warning" sx={{ mt: 2 }}>Le seuil d’attention doit être inférieur ou égal à la charge maximale.</Alert>}
        {modifie && apres !== null && !incoherent && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Avec ces réglages, {apres} Coach{apres > 1 ? 's seraient' : ' serait'} en dépassement aujourd’hui (contre {avant} actuellement).
          </Alert>
        )}
        {erreur && <Alert severity="error" sx={{ mt: 2 }}>Les réglages n’ont pas pu être enregistrés. Vérifie ta connexion et réessaie.</Alert>}
        <Box sx={{ display: 'flex', gap: 1, mt: 3, justifyContent: 'flex-end' }}>
          <Button disabled={!modifie || envoi} onClick={() => setValeurs(Object.fromEntries(champs.map((c) => [c.cle, String(reseau.parametres[c.cle])])) as Record<Cle, string>)} sx={{ minHeight: 48 }}>Annuler</Button>
          <Button variant="contained" disabled={!modifie || envoi || invalides.length > 0 || incoherent} onClick={enregistrer} sx={{ minHeight: 48 }}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </Box>
      </CardContent>
      <Snackbar open={ok} autoHideDuration={5000} onClose={() => setOk(false)} message="Règle de charge enregistrée." />
    </Card>
  )
}

type CleSeuil = keyof SeuilsAlerte
const champsSeuils: { cle: CleSeuil; libelle: string; min: number; max: number }[] = [
  { cle: 'seuilDecroche', libelle: 'Décroche : baisse du CA (%)', min: 1, max: 50 },
  { cle: 'seuilSurveiller', libelle: 'À surveiller : baisse du CA (%)', min: 0, max: 50 },
  { cle: 'delaiAppel', libelle: 'Délai pour appeler un magasin qui décroche (jours)', min: 1, max: 30 },
]

function compterDecroches(reseau: Reseau, s: SeuilsAlerte) {
  return reseau.magasins.filter((m) => analyser(reseau, m.nom, s)?.statut === 'decroche').length
}

function RegleAlerte({ reseau }: { reseau: Reseau }) {
  const { recharger } = useReseau()
  const initiales = () => Object.fromEntries(([...champsSeuils.map((c) => c.cle), 'moisReference'] as CleSeuil[]).map((c) => [c, String(reseau.seuils[c])])) as Record<CleSeuil, string>
  const [valeurs, setValeurs] = useState<Record<CleSeuil, string>>(initiales)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(false)
  const [ok, setOk] = useState(false)
  const nombres = Object.fromEntries(Object.entries(valeurs).map(([c, v]) => [c, Number(v)])) as unknown as SeuilsAlerte
  const invalides = champsSeuils.filter((c) => valeurs[c.cle] === '' || !Number.isInteger(nombres[c.cle]) || nombres[c.cle] < c.min || nombres[c.cle] > c.max)
  const incoherent = !invalides.length && nombres.seuilSurveiller > nombres.seuilDecroche
  const modifie = (Object.keys(valeurs) as CleSeuil[]).some((c) => nombres[c] !== reseau.seuils[c])
  const avecChiffres = Object.keys(reseau.chiffres).length > 0
  const enregistrer = async () => {
    setEnvoi(true); setErreur(false)
    try { await enregistrerParametres(nombres as unknown as Record<string, number>); await recharger(); setOk(true) } catch { setErreur(true) } finally { setEnvoi(false) }
  }
  return (
    <Card sx={{ mt: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h3" component="h2" sx={{ mb: 3 }}>Alerte sur les chiffres</Typography>
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <TextField select label="Écart de CA par rapport au" value={valeurs.moisReference} onChange={(e) => setValeurs((v) => ({ ...v, moisReference: e.target.value }))} helperText=" ">
            {referencesPossibles.map((r) => <MenuItem key={r.valeur} value={String(r.valeur)}>{r.libelle}</MenuItem>)}
          </TextField>
          {champsSeuils.map((c) => (
            <TextField key={c.cle} type="number" label={c.libelle} value={valeurs[c.cle]} onChange={(e) => setValeurs((v) => ({ ...v, [c.cle]: e.target.value }))}
              error={invalides.includes(c)} helperText={invalides.includes(c) ? `Entre ${c.min} et ${c.max}, nombre entier.` : ' '} slotProps={{ htmlInput: { min: c.min, max: c.max, step: 1 } }} />
          ))}
        </Box>
        {incoherent && <Alert severity="warning" sx={{ mt: 2 }}>La baisse « À surveiller » doit être inférieure ou égale à la baisse « Décroche ».</Alert>}
        {modifie && avecChiffres && !invalides.length && !incoherent && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Avec ces réglages, {compterDecroches(reseau, nombres)} magasin{compterDecroches(reseau, nombres) > 1 ? 's décrocheraient' : ' décrocherait'} (contre {compterDecroches(reseau, reseau.seuils)} actuellement).
          </Alert>
        )}
        {erreur && <Alert severity="error" sx={{ mt: 2 }}>Les réglages n’ont pas pu être enregistrés. Vérifie ta connexion et réessaie.</Alert>}
        <Box sx={{ display: 'flex', gap: 1, mt: 3, justifyContent: 'flex-end' }}>
          <Button disabled={!modifie || envoi} onClick={() => setValeurs(initiales())} sx={{ minHeight: 48 }}>Annuler</Button>
          <Button variant="contained" disabled={!modifie || envoi || invalides.length > 0 || incoherent} onClick={enregistrer} sx={{ minHeight: 48 }}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </Box>
      </CardContent>
      <Snackbar open={ok} autoHideDuration={5000} onClose={() => setOk(false)} message="Alerte sur les chiffres enregistrée." />
    </Card>
  )
}

export function Direction() {
  const [message, setMessage] = useState('')
  return (
    <AvecReseau>
      {(reseau) => (
        <>
          <PageHeader titre="Paramètres" />
          <RegleCharge reseau={reseau} />
          <RegleAlerte reseau={reseau} />
          <EditeurGrilleNineBox reseau={reseau} />
          <CarteEffacerNotes reseau={reseau} />
          <CarteThematiques reseau={reseau} signaler={setMessage} />
          <GrillesAudit reseau={reseau} />
          <EspacePhotos reseau={reseau} />
          <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
        </>
      )}
    </AvecReseau>
  )
}
