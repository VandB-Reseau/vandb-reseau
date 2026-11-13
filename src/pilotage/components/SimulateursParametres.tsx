import { useEffect, useState, type ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { ChampMontant } from './ChampMontant'
import { ChampTaux } from './ChampTaux'
import { useSaisieEnCours } from './GardeSaisie'
import { SectionParametres } from './SectionParametres'
import { enregistrerParametres } from '../data/pilotage'
import { parametresSimulateurs, simulateursParDefaut, type ParametresSimulateurs } from '../moteur/simulateurs'
import type { ParametresReseau } from '../moteur/types'

// Repères des simulateurs du franchisé (choix 127, 134, 135, Joseph 13/11/2026), réglés par le Directeur : à 0, le
// franchisé saisit les siens dans le simulateur. Rien ne change dans les budgets.
export function SimulateursParametres({ annee, parametres, lecture, onEnregistre, onModifie }: {
  annee: number
  parametres: ParametresReseau
  lecture: boolean
  onEnregistre: () => void
  onModifie: (m: boolean) => void
}) {
  const enregistres = parametresSimulateurs(parametres)
  const empreinte = JSON.stringify(enregistres)
  const [v, setV] = useState<ParametresSimulateurs>(enregistres)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setV(parametresSimulateurs(parametres)), [empreinte])
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)
  const modifies = JSON.stringify(v) !== empreinte
  useSaisieEnCours(!lecture && modifies)
  useEffect(() => { onModifie(!lecture && modifies) }, [lecture, modifies, onModifie])
  const corner = (k: keyof ParametresSimulateurs['corner'], x: number) => setV((y) => ({ ...y, corner: { ...y.corner, [k]: x } }))

  const enregistrer = async () => {
    setOccupe(true)
    setMessage(null)
    try {
      await enregistrerParametres(annee, { ...parametres, simulateurs: v })
      setMessage({ gravite: 'success', texte: `Repères des simulateurs ${annee} enregistrés.` })
      onEnregistre()
    } catch {
      setMessage({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }
  const ligne = (libelle: string, champ: ReactNode) => <TableRow><TableCell>{libelle}</TableCell><TableCell align="right">{champ}</TableCell></TableRow>

  return (
    <SectionParametres nom="Simulateurs" titre={`Repères des simulateurs ${annee}`} parDefaut={empreinte === JSON.stringify(simulateursParDefaut)}
      action={lecture ? undefined : (
        <Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe || !modifies} onClick={() => void enregistrer()} sx={{ minHeight: 48 }}>Enregistrer</Button>
      )}>
      {message && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{message.texte}</Alert>
        </Box>
      )}
      <Table aria-label={`Repères des simulateurs ${annee}`}>
        <TableBody>
          {ligne('Coût annuel de l’argent immobilisé (découvert), proposé dans « Acheter en volume »', <ChampTaux libelle="Coût annuel de l’argent" valeur={v.tauxDecouvert} onChange={(x) => setV((y) => ({ ...y, tauxDecouvert: x ?? 0 }))} />)}
          {ligne('Aide à l’embauche d’un apprenti, par an, déduite dans « Embaucher »', <ChampMontant libelle="Aide à l’embauche d’un apprenti" valeur={v.aideApprenti} onChange={(x) => setV((y) => ({ ...y, aideApprenti: x }))} largeur={160} />)}
          {ligne('Corner alimentaire : CA HT par mètre linéaire et par an', <ChampMontant libelle="CA du corner par mètre" valeur={v.corner.caParMetre} onChange={(x) => corner('caParMetre', x)} largeur={160} />)}
          {ligne('Corner alimentaire : taux de marge', <ChampTaux libelle="Taux de marge du corner" valeur={v.corner.tauxMarge} onChange={(x) => corner('tauxMarge', x ?? 0)} />)}
          {ligne('Corner alimentaire : démarque des produits frais', <ChampTaux libelle="Démarque du corner" valeur={v.corner.demarque} onChange={(x) => corner('demarque', x ?? 0)} />)}
        </TableBody>
      </Table>
    </SectionParametres>
  )
}
