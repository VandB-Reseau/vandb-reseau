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
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import { LIGNES_REMISES, parametresSimulateurs, simulateursParDefaut, type CleRemise, type ParametresSimulateurs } from '../moteur/simulateurs'
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
  // Vague 10 (choix 152 à 165)
  const contrat = (k: keyof ParametresSimulateurs['contrat'], x: number) => setV((y) => ({ ...y, contrat: { ...y.contrat, [k]: x } }))
  const tireuses = (k: keyof ParametresSimulateurs['tireuses'], x: number) => setV((y) => ({ ...y, tireuses: { ...y.tireuses, [k]: x } }))
  const remise = (k: CleRemise, x: number) => setV((y) => ({ ...y, remises: { ...y.remises, [k]: x } }))
  const livraison = (i: number, k: 'kmMax' | 'franco' | 'prix', x: number) => setV((y) => ({ ...y, livraison: y.livraison.map((l, j) => (j === i ? { ...l, [k]: x } : l)) }))
  const palierExt = (i: number, k: 'caMax' | 'tireuses' | 'investissement' | 'heures', x: number) => setV((y) => ({ ...y, marcheExterieur: { ...y.marcheExterieur, paliers: y.marcheExterieur.paliers.map((l, j) => (j === i ? { ...l, [k]: x } : l)) } }))
  const famille = (i: number, f: Partial<ParametresSimulateurs['familles'][number]>) => setV((y) => ({ ...y, familles: y.familles.map((l, j) => (j === i ? { ...l, ...f } : l)) }))
  const retirer = (i: number, onRetire: () => void, quoi: string) => !lecture && <IconButton aria-label={`Retirer ${quoi} ${i + 1}`} onClick={onRetire} sx={{ width: 48, height: 48 }}><DeleteOutlineOutlined /></IconButton>
  const titre = (t: string) => <Box sx={{ px: 2, pt: 2, pb: 1 }}><Typography component="h3" sx={{ fontWeight: 700 }}>{t}</Typography></Box>
  const ajouter = (libelle: string, f: () => void) => !lecture && <Box sx={{ px: 2, py: 1 }}><Button startIcon={<AddOutlined />} onClick={f} sx={{ minHeight: 48 }}>{libelle}</Button></Box>

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
          {ligne('Perte pression : perte normale (coulage au service, mousse au perçage du fût)', <ChampTaux libelle="Perte standard des fûts" valeur={v.pression.perteStandard} onChange={(x) => pression('perteStandard', Math.min(1, x ?? 0))} />)}
          {ligne('TVA normale (prix et marge)', <ChampTaux libelle="TVA normale" valeur={v.tva.normale} onChange={(x) => tva('normale', x ?? 0)} />)}
          {ligne('TVA intermédiaire (restauration sur place)', <ChampTaux libelle="TVA intermédiaire" valeur={v.tva.intermediaire} onChange={(x) => tva('intermediaire', x ?? 0)} />)}
          {ligne('TVA réduite (alimentation à emporter)', <ChampTaux libelle="TVA réduite" valeur={v.tva.reduite} onChange={(x) => tva('reduite', x ?? 0)} />)}
          {ligne('Majoration des heures du dimanche', <ChampTaux libelle="Majoration du dimanche" valeur={v.majorations.dimanche} onChange={(x) => majoration('dimanche', x ?? 0)} />)}
          {ligne('Majoration des heures d’un jour férié', <ChampTaux libelle="Majoration d’un jour férié" valeur={v.majorations.ferie} onChange={(x) => majoration('ferie', x ?? 0)} />)}
          {ligne('Intérim : coefficient de l’agence sur le salaire brut', <ChampMontant libelle="Coefficient de l’intérim" valeur={v.coefInterim} onChange={(x) => setV((y) => ({ ...y, coefInterim: x }))} unite="" largeur={160} />)}
          {ligne('CDD : rédaction du contrat et solde de tout compte', <ChampMontant libelle="Rédaction d’un CDD" valeur={v.contrat.redaction} onChange={(x) => contrat('redaction', x)} largeur={160} />)}
          {ligne('CDD : bulletin de paie par mois', <ChampMontant libelle="Bulletin de paie par mois" valeur={v.contrat.paieParMois} onChange={(x) => contrat('paieParMois', x)} largeur={160} />)}
          {ligne('Tireuses : week-ends de la saison', <ChampMontant libelle="Week-ends de la saison" valeur={v.tireuses.semainesSaison} onChange={(x) => tireuses('semainesSaison', x)} unite="" largeur={160} />)}
          {ligne('Tireuses : part des week-ends loués en saison', <ChampTaux libelle="Week-ends loués en saison" valeur={v.tireuses.occupationSaison} onChange={(x) => tireuses('occupationSaison', x ?? 0)} />)}
          {ligne('Tireuses : part des week-ends loués le reste de l’année', <ChampTaux libelle="Week-ends loués hors saison" valeur={v.tireuses.occupationHors} onChange={(x) => tireuses('occupationHors', x ?? 0)} />)}
          {ligne('Tireuses : parc plein au-delà de', <ChampTaux libelle="Parc plein au-delà de" valeur={v.tireuses.saturation} onChange={(x) => tireuses('saturation', x ?? 0)} />)}
          {ligne('Marché extérieur : prix d’un camion', <ChampMontant libelle="Prix d’un camion" valeur={v.marcheExterieur.camion} onChange={(x) => setV((y) => ({ ...y, marcheExterieur: { ...y.marcheExterieur, camion: x } }))} largeur={160} />)}
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

      {titre('Remises et offerts : repères en part du CA')}
      <Table aria-label="Repères des remises et offerts">
        <TableBody>
          {LIGNES_REMISES.map((l) => ligne(l.libelle, <ChampTaux libelle={`Repère, ${l.libelle}`} valeur={v.remises[l.cle]} onChange={(x) => remise(l.cle, x ?? 0)} />))}
        </TableBody>
      </Table>

      {titre('Marge visée par famille (calculette Prix et marge)')}
      <Table aria-label="Marge visée par famille">
        <TableHead><TableRow><TableCell>Famille</TableCell><TableCell>Univers</TableCell><TableCell>TVA</TableCell><TableCell align="right">Marge visée</TableCell><TableCell /></TableRow></TableHead>
        <TableBody>
          {v.familles.map((f, i) => (
            <TableRow key={i}>
              <TableCell><TextField size="small" value={f.libelle} disabled={lecture} onChange={(e) => famille(i, { libelle: e.target.value })} slotProps={{ htmlInput: { 'aria-label': `Famille ${i + 1}`, maxLength: 40 } }} sx={{ width: 180, '& .MuiInputBase-root': { minHeight: 48 } }} /></TableCell>
              <TableCell>
                <TextField select size="small" value={f.univers} disabled={lecture} onChange={(e) => famille(i, { univers: e.target.value as 'cave' | 'bar' })} slotProps={{ htmlInput: { 'aria-label': `Univers de la famille ${i + 1}` } }} sx={{ width: 110, '& .MuiInputBase-root': { minHeight: 48 } }}>
                  <MenuItem value="cave">Cave</MenuItem><MenuItem value="bar">Bar</MenuItem>
                </TextField>
              </TableCell>
              <TableCell>
                <TextField select size="small" value={f.tva} disabled={lecture} onChange={(e) => famille(i, { tva: e.target.value as 'normale' | 'intermediaire' | 'reduite' })} slotProps={{ htmlInput: { 'aria-label': `TVA de la famille ${i + 1}` } }} sx={{ width: 150, '& .MuiInputBase-root': { minHeight: 48 } }}>
                  <MenuItem value="normale">Normale</MenuItem><MenuItem value="intermediaire">Intermédiaire</MenuItem><MenuItem value="reduite">Réduite</MenuItem>
                </TextField>
              </TableCell>
              <TableCell align="right"><ChampTaux libelle={`Marge visée, famille ${i + 1}`} valeur={f.marge} onChange={(x) => famille(i, { marge: x ?? 0 })} /></TableCell>
              <TableCell align="right" sx={{ width: 64 }}>{retirer(i, () => setV((y) => ({ ...y, familles: y.familles.filter((_, j) => j !== i) })), 'la famille')}</TableCell>
            </TableRow>
          ))}
          {!v.familles.length && <TableRow><TableCell colSpan={5} sx={{ color: 'text.secondary' }}>Aucune famille : la calculette demande la marge visée.</TableCell></TableRow>}
        </TableBody>
      </Table>
      {ajouter('Ajouter une famille', () => setV((y) => ({ ...y, familles: [...y.familles, { libelle: '', univers: 'cave', marge: 0, tva: 'normale' }] })))}

      {titre('Livraisons du marché extérieur (distance aller)')}
      <Table aria-label="Grille des livraisons">
        <TableHead><TableRow><TableCell>Jusqu’à</TableCell><TableCell align="right">Offerte dès (commande HT)</TableCell><TableCell align="right">Prix HT sinon</TableCell><TableCell /></TableRow></TableHead>
        <TableBody>
          {v.livraison.map((l, i) => (
            <TableRow key={i}>
              <TableCell><ChampMontant libelle={`Distance maximale, ligne ${i + 1}`} valeur={l.kmMax} onChange={(x) => livraison(i, 'kmMax', x)} unite="km" largeur={120} /></TableCell>
              <TableCell align="right"><ChampMontant libelle={`Commande pour une livraison offerte, ligne ${i + 1}`} valeur={l.franco} onChange={(x) => livraison(i, 'franco', x)} largeur={140} /></TableCell>
              <TableCell align="right"><ChampMontant libelle={`Prix de la livraison, ligne ${i + 1}`} valeur={l.prix} onChange={(x) => livraison(i, 'prix', x)} largeur={120} /></TableCell>
              <TableCell align="right" sx={{ width: 64 }}>{retirer(i, () => setV((y) => ({ ...y, livraison: y.livraison.filter((_, j) => j !== i) })), 'la ligne de livraison')}</TableCell>
            </TableRow>
          ))}
          {!v.livraison.length && <TableRow><TableCell colSpan={4} sx={{ color: 'text.secondary' }}>Aucune grille : le prix de livraison se saisit dans le contrat.</TableCell></TableRow>}
        </TableBody>
      </Table>
      {ajouter('Ajouter une distance', () => setV((y) => ({ ...y, livraison: [...y.livraison, { kmMax: 0, franco: 0, prix: 0 }] })))}

      {titre('Développer le marché extérieur : préconisation selon l’objectif de CA')}
      <Table aria-label="Préconisation du marché extérieur">
        <TableHead><TableRow><TableCell>CA HT jusqu’à</TableCell><TableCell align="right">Tireuses</TableCell><TableCell align="right">Investissement HT</TableCell><TableCell align="right">Heures par semaine</TableCell><TableCell /></TableRow></TableHead>
        <TableBody>
          {v.marcheExterieur.paliers.map((l, i) => (
            <TableRow key={i}>
              <TableCell><ChampMontant libelle={`CA maximal, palier ${i + 1}`} valeur={l.caMax} onChange={(x) => palierExt(i, 'caMax', x)} largeur={150} /></TableCell>
              <TableCell align="right"><ChampMontant libelle={`Tireuses, palier ${i + 1}`} valeur={l.tireuses} onChange={(x) => palierExt(i, 'tireuses', x)} unite="" largeur={100} /></TableCell>
              <TableCell align="right"><ChampMontant libelle={`Investissement, palier ${i + 1}`} valeur={l.investissement} onChange={(x) => palierExt(i, 'investissement', x)} largeur={150} /></TableCell>
              <TableCell align="right"><ChampMontant libelle={`Heures par semaine, palier ${i + 1}`} valeur={l.heures} onChange={(x) => palierExt(i, 'heures', x)} unite="h" largeur={100} /></TableCell>
              <TableCell align="right" sx={{ width: 64 }}>{retirer(i, () => setV((y) => ({ ...y, marcheExterieur: { ...y.marcheExterieur, paliers: y.marcheExterieur.paliers.filter((_, j) => j !== i) } })), 'le palier extérieur')}</TableCell>
            </TableRow>
          ))}
          {!v.marcheExterieur.paliers.length && <TableRow><TableCell colSpan={5} sx={{ color: 'text.secondary' }}>Aucune préconisation : le modèle Marché extérieur d’« Investir » se saisit à la main.</TableCell></TableRow>}
        </TableBody>
      </Table>
      {ajouter('Ajouter un palier extérieur', () => setV((y) => ({ ...y, marcheExterieur: { ...y.marcheExterieur, paliers: [...y.marcheExterieur.paliers, { caMax: 0, tireuses: 0, investissement: 0, heures: 0 }] } })))}
    </SectionParametres>
  )
}
