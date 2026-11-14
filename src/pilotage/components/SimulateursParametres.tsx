import { useEffect, useState, type ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import TableHead from '@mui/material/TableHead'
import Typography from '@mui/material/Typography'
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
  const ext = (k: keyof ParametresSimulateurs['exterieur'], x: number) => setV((y) => ({ ...y, exterieur: { ...y.exterieur, [k]: x } }))
  const pression = (k: keyof ParametresSimulateurs['pression'], x: number) => setV((y) => ({ ...y, pression: { ...y.pression, [k]: x } }))
  const tva = (k: keyof ParametresSimulateurs['tva'], x: number) => setV((y) => ({ ...y, tva: { ...y.tva, [k]: x } }))
  const majoration = (k: keyof ParametresSimulateurs['majorations'], x: number) => setV((y) => ({ ...y, majorations: { ...y.majorations, [k]: x } }))
  const palier = (i: number, k: 'partBar' | 'cible', x: number) => setV((y) => ({ ...y, productivite: y.productivite.map((l, j) => (j === i ? { ...l, [k]: x } : l)) }))

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
          {ligne('Coût d’une heure de travail chargée (livraisons, ouvertures exceptionnelles)', <ChampMontant libelle="Coût d’une heure chargée" valeur={v.coutHoraire} onChange={(x) => setV((y) => ({ ...y, coutHoraire: x }))} largeur={160} />)}
          {ligne('Marché extérieur : prix du kilomètre', <ChampMontant libelle="Prix du kilomètre" valeur={v.exterieur.prixKm} onChange={(x) => ext('prixKm', x)} unite="€/km" largeur={160} />)}
          {ligne('Marché extérieur : durée de vie d’une tireuse', <ChampMontant libelle="Durée de vie d’une tireuse" valeur={v.exterieur.dureeTireuse} onChange={(x) => ext('dureeTireuse', x)} unite="ans" largeur={160} />)}
          {ligne('Marché extérieur : entretien d’une tireuse par an', <ChampMontant libelle="Entretien d’une tireuse" valeur={v.exterieur.entretienTireuse} onChange={(x) => ext('entretienTireuse', x)} largeur={160} />)}
          {ligne('Marché extérieur : CO2 par fût', <ChampMontant libelle="CO2 par fût" valeur={v.exterieur.co2ParFut} onChange={(x) => ext('co2ParFut', x)} largeur={160} />)}
          {ligne('Don à l’association traité comme un don (réduction mécénat de 60 %, reçu Cerfa demandé)',
            <FormControlLabel control={<Checkbox checked={v.donMecenat} onChange={(e) => setV((y) => ({ ...y, donMecenat: e.target.checked }))} disabled={lecture} slotProps={{ input: { 'aria-label': 'Don traité comme un don' } }} />} label={v.donMecenat ? 'Oui' : 'Non'} sx={{ minHeight: 48, mr: 0 }} />)}
          {ligne('Carte pression : marge visée au bar', <ChampTaux libelle="Marge visée au bar" valeur={v.pression.cibleMarge} onChange={(x) => pression('cibleMarge', x ?? 0)} />)}
          {ligne('Carte pression : jours au-delà desquels un fût entamé s’abîme', <ChampMontant libelle="Jours de fraîcheur d’un fût" valeur={v.pression.joursFraicheur} onChange={(x) => pression('joursFraicheur', x)} unite="j" largeur={160} />)}
          {ligne('TVA normale (prix et marge)', <ChampTaux libelle="TVA normale" valeur={v.tva.normale} onChange={(x) => tva('normale', x ?? 0)} />)}
          {ligne('TVA intermédiaire (restauration sur place)', <ChampTaux libelle="TVA intermédiaire" valeur={v.tva.intermediaire} onChange={(x) => tva('intermediaire', x ?? 0)} />)}
          {ligne('TVA réduite (alimentation à emporter)', <ChampTaux libelle="TVA réduite" valeur={v.tva.reduite} onChange={(x) => tva('reduite', x ?? 0)} />)}
          {ligne('Majoration des heures du dimanche', <ChampTaux libelle="Majoration du dimanche" valeur={v.majorations.dimanche} onChange={(x) => majoration('dimanche', x ?? 0)} />)}
          {ligne('Majoration des heures d’un jour férié', <ChampTaux libelle="Majoration d’un jour férié" valeur={v.majorations.ferie} onChange={(x) => majoration('ferie', x ?? 0)} />)}
          {ligne('Intérim : coefficient de l’agence sur le salaire brut', <ChampMontant libelle="Coefficient de l’intérim" valeur={v.coefInterim} onChange={(x) => setV((y) => ({ ...y, coefInterim: x }))} unite="" largeur={160} />)}
        </TableBody>
      </Table>
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Typography component="h3" sx={{ fontWeight: 700 }}>Productivité visée selon la part du bar</Typography>
      </Box>
      <Table aria-label="Productivité visée selon la part du bar">
        <TableHead><TableRow><TableCell>Part du bar à partir de</TableCell><TableCell align="right">CA HT par heure visé</TableCell><TableCell /></TableRow></TableHead>
        <TableBody>
          {v.productivite.map((l, i) => (
            <TableRow key={i}>
              <TableCell><ChampTaux libelle={`Part du bar, palier ${i + 1}`} valeur={l.partBar} onChange={(x) => palier(i, 'partBar', x ?? 0)} /></TableCell>
              <TableCell align="right"><ChampMontant libelle={`CA par heure visé, palier ${i + 1}`} valeur={l.cible} onChange={(x) => palier(i, 'cible', x)} unite="€/h" largeur={140} /></TableCell>
              <TableCell align="right" sx={{ width: 64 }}>{!lecture && <IconButton aria-label={`Retirer le palier ${i + 1}`} onClick={() => setV((y) => ({ ...y, productivite: y.productivite.filter((_, j) => j !== i) }))} sx={{ width: 48, height: 48 }}><DeleteOutlineOutlined /></IconButton>}</TableCell>
            </TableRow>
          ))}
          {!v.productivite.length && <TableRow><TableCell colSpan={3} sx={{ color: 'text.secondary' }}>Aucune grille : l’Équipe montre la productivité sans cible.</TableCell></TableRow>}
        </TableBody>
      </Table>
      {!lecture && <Box sx={{ px: 2, py: 1 }}><Button startIcon={<AddOutlined />} onClick={() => setV((y) => ({ ...y, productivite: [...y.productivite, { partBar: 0, cible: 0 }] }))} sx={{ minHeight: 48 }}>Ajouter un palier</Button></Box>}
    </SectionParametres>
  )
}
