import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ConstructionOutlined from '@mui/icons-material/ConstructionOutlined'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { chargeA, niveauCharge } from '../data/charge'
import { enregistrerParametres } from '../data/chargement'
import { useReseau } from '../data/ReseauContext'
import type { ParametresReseau, Reseau } from '../data/modele'

type Cle = keyof ParametresReseau
const champs: { cle: Cle; libelle: string; aide: string; min: number; max: number }[] = [
  { cle: 'maxUnits', libelle: 'Charge maximale d’un Coach', aide: 'Au-delà, le Coach est en dépassement.', min: 1, max: 30 },
  { cle: 'alertThreshold', libelle: 'Seuil d’attention', aide: 'À partir de cette charge, le Coach est à surveiller.', min: 1, max: 30 },
  { cle: 'poidsOuvert', libelle: 'Unités pour un magasin ouvert', aide: 'Magasin en activité courante.', min: 0, max: 5 },
  { cle: 'poidsRenforce', libelle: 'Unités pour un magasin en accompagnement renforcé', aide: 'Magasin en pré-ouverture ou ouvert depuis peu.', min: 0, max: 5 },
  { cle: 'prepDuration', libelle: 'Mois de pré-ouverture', aide: 'Le Coach prend en charge le magasin ce nombre de mois avant l’ouverture.', min: 0, max: 12 },
  { cle: 'postDuration', libelle: 'Mois d’accompagnement après ouverture', aide: 'Durée pendant laquelle un magasin reste « nouvelle ouverture ».', min: 0, max: 24 },
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
        <Typography variant="h3" component="h2">Règle de charge des Coachs</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Ces réglages servent au plan de charge, aux alertes et aux suggestions de réaffectation. Le maximum, le seuil et les durées sont partagés avec l’ancienne application ; les unités par magasin ne s’appliquent qu’ici.
        </Typography>
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          {champs.map((c) => (
            <TextField
              key={c.cle}
              type="number"
              label={c.libelle}
              value={valeurs[c.cle]}
              onChange={(e) => setValeurs((v) => ({ ...v, [c.cle]: e.target.value }))}
              error={invalides.includes(c)}
              helperText={invalides.includes(c) ? `Entre ${c.min} et ${c.max}, nombre entier.` : c.aide}
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

export function Direction() {
  return (
    <AvecReseau>
      {(reseau) => (
        <>
          <PageHeader titre="Direction" sousTitre="Réglages du réseau" />
          <RegleCharge reseau={reseau} />
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', color: 'text.secondary', mt: 3 }}>
            <ConstructionOutlined />
            <Typography variant="body2">L’import et l’export Excel et la sauvegarde arrivent au sprint 5.</Typography>
          </Box>
        </>
      )}
    </AvecReseau>
  )
}
