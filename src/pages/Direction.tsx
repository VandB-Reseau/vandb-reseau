import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import ImportExportOutlined from '@mui/icons-material/ImportExportOutlined'
import { dateCourte } from '../lib/format'
import BalanceOutlined from '@mui/icons-material/BalanceOutlined'
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined'
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined'
import GridViewOutlined from '@mui/icons-material/GridViewOutlined'
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined'
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined'
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined'
import { CarteLignes, Initiales, LigneCompacte } from '../components/Social'
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
import { NON_CLASSE, nineBox } from '../data/sante'
import { anneeDe, suiviRythme } from '../data/visites'
import { hautEntete, sousBandes } from '../components/Collant'

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

// Réglage chiffré en ligne : le libellé à gauche, un champ court à droite (Joseph, 21/10/2026)
function LigneReglage({ libelle, nom = libelle, detail, valeur, onChange, invalide, min, max }: {
  libelle: string; nom?: string; detail?: string; valeur: string; onChange: (v: string) => void; invalide: boolean; min: number; max: number
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography>{libelle}</Typography>
        {(invalide || detail) && <Typography variant="body2" color={invalide ? 'error' : 'text.secondary'}>{invalide ? `Entre ${min} et ${max}, nombre entier.` : detail}</Typography>}
      </Box>
      <TextField type="number" size="small" value={valeur} onChange={(e) => onChange(e.target.value)} error={invalide}
        slotProps={{ htmlInput: { min, max, step: 1, inputMode: 'numeric', 'aria-label': nom } }}
        sx={{ width: 96, flexShrink: 0, '& .MuiInputBase-root': { minHeight: 48 }, '& input': { textAlign: 'right' } }} />
    </Box>
  )
}

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
        <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>Règle de charge des Coachs</Typography>
        <Box>
          {champs.map((c) => (
            <LigneReglage key={c.cle} libelle={c.libelle} detail={c.aide} valeur={valeurs[c.cle]} onChange={(v) => setValeurs((x) => ({ ...x, [c.cle]: v }))} invalide={invalides.includes(c)} min={c.min} max={c.max} />
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
        <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>Alerte sur les chiffres</Typography>
        <TextField select fullWidth label="Écart de CA par rapport au" value={valeurs.moisReference} onChange={(e) => setValeurs((v) => ({ ...v, moisReference: e.target.value }))} sx={{ mb: 1 }}>
          {referencesPossibles.map((r) => <MenuItem key={r.valeur} value={String(r.valeur)}>{r.libelle}</MenuItem>)}
        </TextField>
        <Box>
          {champsSeuils.map((c) => (
            <LigneReglage key={c.cle} libelle={c.libelle} valeur={valeurs[c.cle]} onChange={(v) => setValeurs((x) => ({ ...x, [c.cle]: v }))} invalide={invalides.includes(c)} min={c.min} max={c.max} />
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

// Jours sans visite avant qu'un magasin soit signalé, case par case de la nine box
const casesDelai = [...nineBox].sort((x, y) => x.resultats + x.management - (y.resultats + y.management)).map((c) => ({ cle: c.id, libelle: c.libelle, rythme: c.rythme }))
  .concat({ cle: NON_CLASSE, libelle: 'Non classé', rythme: '2 visites' })

function RegleVisite({ reseau }: { reseau: Reseau }) {
  const { recharger } = useReseau()
  const initiales = () => Object.fromEntries(casesDelai.map((c) => [c.cle, String(reseau.delaisVisite[c.cle])]))
  const [valeurs, setValeurs] = useState<Record<string, string>>(initiales)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(false)
  const [ok, setOk] = useState(false)
  const nombres = Object.fromEntries(casesDelai.map((c) => [c.cle, Number(valeurs[c.cle])]))
  const invalides = casesDelai.filter((c) => valeurs[c.cle] === '' || !Number.isInteger(nombres[c.cle]) || nombres[c.cle] < 7 || nombres[c.cle] > 730)
  const modifie = casesDelai.some((c) => nombres[c.cle] !== reseau.delaisVisite[c.cle])
  const signales = (delais: Record<string, number>) => suiviRythme({ ...reseau, delaisVisite: delais }, anneeDe(reseau.jour)).filter((l) => l.alerte).length
  const enregistrer = async () => {
    setEnvoi(true); setErreur(false)
    try { await enregistrerParametres(Object.fromEntries(casesDelai.map((c) => [`alerteVisite_${c.cle}`, nombres[c.cle]]))); await recharger(); setOk(true) } catch { setErreur(true) } finally { setEnvoi(false) }
  }
  return (
    <Card sx={{ mt: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>Alerte de visite</Typography>
        <Box>
          {casesDelai.map((c) => (
            <LigneReglage key={c.cle} libelle={c.libelle} nom={`${c.libelle} (jours sans visite)`} detail={`Référence ${c.rythme.split('×')[0].trim()} par an · jours sans visite`}
              valeur={valeurs[c.cle]} onChange={(v) => setValeurs((x) => ({ ...x, [c.cle]: v }))} invalide={invalides.includes(c)} min={7} max={730} />
          ))}
        </Box>
        {modifie && !invalides.length && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Avec ces délais, {signales(nombres)} magasin{signales(nombres) > 1 ? 's seraient signalés' : ' serait signalé'} (contre {signales(reseau.delaisVisite)} actuellement).
          </Alert>
        )}
        {erreur && <Alert severity="error" sx={{ mt: 2 }}>Les réglages n’ont pas pu être enregistrés. Vérifie ta connexion et réessaie.</Alert>}
        <Box sx={{ display: 'flex', gap: 1, mt: 3, justifyContent: 'flex-end' }}>
          <Button disabled={!modifie || envoi} onClick={() => setValeurs(initiales())} sx={{ minHeight: 48 }}>Annuler</Button>
          <Button variant="contained" disabled={!modifie || envoi || invalides.length > 0} onClick={enregistrer} sx={{ minHeight: 48 }}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </Box>
      </CardContent>
      <Snackbar open={ok} autoHideDuration={5000} onClose={() => setOk(false)} message="Alerte de visite enregistrée." />
    </Card>
  )
}

// Sommaire puis une rubrique par écran, comme les réglages d'un téléphone (Joseph, 21/10/2026).
// Sur PC, le sommaire reste à gauche et la rubrique s'affiche à droite.
type Rubrique = 'charge' | 'chiffres' | 'visite' | 'ninebox' | 'thematiques' | 'audits' | 'photos'
function rubriques(reseau: Reseau): { id: Rubrique; libelle: string; detail: string; icone: ReactNode }[] {
  const p = reseau.parametres, s = reseau.seuils
  const premiere = casesDelai[0]
  const ths = reseau.deploiements.thematiques.length
  return [
    { id: 'charge', libelle: 'Règle de charge', detail: `Charge maximale ${p.maxUnits} · attention à ${p.alertThreshold}`, icone: <BalanceOutlined /> },
    { id: 'chiffres', libelle: 'Alerte sur les chiffres', detail: `Décroche à −${s.seuilDecroche} % · à surveiller à −${s.seuilSurveiller} %`, icone: <QueryStatsOutlined /> },
    { id: 'visite', libelle: 'Alerte de visite', detail: `${premiere.libelle} ${reseau.delaisVisite[premiere.cle]} j`, icone: <EventRepeatOutlined /> },
    { id: 'ninebox', libelle: 'Nine box', detail: 'Grille de notation, notes des magasins', icone: <GridViewOutlined /> },
    { id: 'thematiques', libelle: 'Thématiques de déploiement', detail: ths ? `${ths} thématique${ths > 1 ? 's' : ''}` : 'Aucune thématique', icone: <RocketLaunchOutlined /> },
    { id: 'audits', libelle: 'Grilles d’audit', detail: 'Critères et seuils de conformité', icone: <FactCheckOutlined /> },
    { id: 'photos', libelle: 'Espace photos', detail: 'Place occupée', icone: <PhotoLibraryOutlined /> },
  ]
}

function ContenuRubrique({ id, reseau, signaler }: { id: Rubrique; reseau: Reseau; signaler: (m: string) => void }) {
  return (
    // Les cartes gardent leur propre marge haute quand elles s'enchaînent ; la première colle au sommaire ou au retour
    <Box sx={{ '& > .MuiCard-root:first-of-type': { mt: 0 } }}>
      {id === 'charge' && <RegleCharge reseau={reseau} />}
      {id === 'chiffres' && <RegleAlerte reseau={reseau} />}
      {id === 'visite' && <RegleVisite reseau={reseau} />}
      {id === 'ninebox' && <><EditeurGrilleNineBox reseau={reseau} /><CarteEffacerNotes reseau={reseau} /></>}
      {id === 'thematiques' && <CarteThematiques reseau={reseau} signaler={signaler} />}
      {id === 'audits' && <GrillesAudit reseau={reseau} />}
      {id === 'photos' && <EspacePhotos reseau={reseau} />}
    </Box>
  )
}

export function Direction() {
  const [message, setMessage] = useState('')
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [params, setParams] = useSearchParams()
  const ouvrir = (id: Rubrique) => { const n = new URLSearchParams(params); n.set('rubrique', id); setParams(n, { replace: surPC }) }
  return (
    <AvecReseau>
      {(reseau) => {
        const liste = rubriques(reseau)
        const choisie = liste.find((r) => r.id === params.get('rubrique')) ?? (surPC ? liste[0] : null)
        const sommaire = (
          <CarteLignes label="Rubriques des paramètres">
            <LigneCompacte lien="/parametres/charge" label="Charge des Coachs" avatar={<Initiales nom="Charge des Coachs" icone={<GroupsOutlined />} />} titre="Charge des Coachs"
              detail={`${reseau.equipe.filter((c) => !c.fictif).length} Coachs · simulation et répartition`} fin={<ChevronRightOutlined color="action" />} />
            {liste.map((r) => (
              <Box key={r.id} sx={{ bgcolor: surPC && choisie?.id === r.id ? 'action.selected' : undefined }}>
                <LigneCompacte onClick={() => ouvrir(r.id)} label={r.libelle} avatar={<Initiales nom={r.libelle} icone={r.icone} />} titre={r.libelle} detail={r.detail}
                  fin={!surPC && <ChevronRightOutlined color="action" />} />
              </Box>
            ))}
            <LigneCompacte lien="/parametres/donnees" label="Import et export" avatar={<Initiales nom="Import et export" icone={<ImportExportOutlined />} />} titre="Import et export"
              detail={reseau.derniereSauvegarde ? `Dernière sauvegarde ${dateCourte(reseau.derniereSauvegarde)}` : 'Référentiels en Excel, sauvegarde complète'} fin={<ChevronRightOutlined color="action" />} />
          </CarteLignes>
        )
        return (
          <>
            {!surPC && choisie ? (
              <>
                {/* Le titre de la carte sert de titre à l'écran */}
                {/* Le retour au sommaire reste en haut quand la rubrique défile */}
                <Box sx={{ position: 'sticky', top: sousBandes(), zIndex: 4, bgcolor: 'background.default', mx: -2, px: 1, mt: -1.5, pt: 0.5, mb: 1 }}>
                  <Button startIcon={<ArrowBackOutlined />} onClick={() => { const n = new URLSearchParams(params); n.delete('rubrique'); setParams(n) }} sx={{ minHeight: 48 }}>Paramètres</Button>
                </Box>
                <ContenuRubrique id={choisie.id} reseau={reseau} signaler={setMessage} />
              </>
            ) : (
              <>
                <PageHeader titre="Paramètres" />
                {surPC ? (
                  <Box sx={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 3, alignItems: 'start' }}>
                    {/* Le sommaire reste à l'écran quand la rubrique défile */}
                    <Box sx={{ position: 'sticky', top: hautEntete.md + 16, maxHeight: `calc(100vh - ${hautEntete.md + 32}px)`, overflowY: 'auto', scrollbarWidth: 'thin' }}>{sommaire}</Box>
                    {choisie && <ContenuRubrique id={choisie.id} reseau={reseau} signaler={setMessage} />}
                  </Box>
                ) : sommaire}
              </>
            )}
            <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
          </>
        )
      }}
    </AvecReseau>
  )
}
