import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import Tooltip from '@mui/material/Tooltip'
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined'
import '../data/envoisEnAttente'
import { apresEnvois, demarrerEnvois, envoyerEnAttente, horsLigne, refusEtVider, useEnvoisEnAttente } from '../lib/horsLigne'
import { useReseauSiDispo } from '../data/ReseauContext'

// Compteur des créations gardées sans réseau (choix 114) : « 3 en attente d'envoi », à côté de la cloche. Un geste relance
// l'envoi ; au retour du réseau, il part seul. Une création refusée par la base est signalée une fois.
export function EnvoisEnAttente({ court }: { court?: boolean } = {}) {
  const l = useEnvoisEnAttente()
  const etat = useReseauSiDispo()
  const [refus, setRefus] = useState<string[]>([])
  const recharger = etat?.recharger
  useEffect(() => { demarrerEnvois() }, [])
  useEffect(() => apresEnvois(() => {
    const r = refusEtVider()
    if (r.length) setRefus(r)
    void recharger?.()
  }), [recharger])
  return (
    <>
      {l.length > 0 && (
        <Tooltip title={l.map((e) => e.libelle).join(' · ')}>
           <Button size="small" fullWidth={!court} color="warning" variant="outlined" startIcon={<CloudUploadOutlined />} onClick={() => { if (!horsLigne()) void envoyerEnAttente() }}
            aria-label={`${l.length} en attente d’envoi${horsLigne() ? ', sans réseau' : ', envoyer maintenant'}`} sx={{ minHeight: 48, whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 700 }}>
            {court ? `${l.length} à envoyer` : `${l.length} en attente d’envoi`}
          </Button>
        </Tooltip>
      )}
      <Snackbar open={refus.length > 0} onClose={() => setRefus([])} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setRefus([])} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>
          {refus.length === 1 ? `Une saisie faite sans réseau n’a pas pu être enregistrée : ${refus[0]}. Refais-la.` : `${refus.length} saisies faites sans réseau n’ont pas pu être enregistrées : ${refus.join(', ')}. Refais-les.`}
        </Alert>
      </Snackbar>
    </>
  )
}
