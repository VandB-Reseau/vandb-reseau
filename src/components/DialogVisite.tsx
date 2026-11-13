import { useEffect, useState } from 'react'
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
import { ConstatsVisite, OrdreDuJourSaisie, RevuePlan, type EtatSujet, type RevuesPriorites, type RevuesTaches } from './SaisieCompteRendu'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import type { ReactNode } from 'react'
import { ordreDuJour, visitePlanifieeProche } from '../data/ordreDuJour'
import { actionsEnCours } from '../data/actions'
import { prioritesDu } from '../data/planAction'
import { enregistrerAudit, enregistrerConstats, enregistrerPlan, enregistrerPreparation, enregistrerVisites, revoirTaches, supprimerVisite, type CibleTache } from '../data/chargement'
import { useSaisieChiffres } from './Chiffres'
import { analyser, auditDe, formatKEuros, formatPourcent, formatValeur, libelleMois, lireNombre, moisPrecedent, typesAudit, typesContact } from '../data/chiffres'
import { partiesVides } from '../data/compteRendu'
import { libellesGrilles, photosDe, reponsesPourSaisie, resultatGrille, type Reponses } from '../data/grilles'
import { supprimerPhotos } from '../lib/photos'
import { ChampPhotos, SaisieGrille } from './GrilleAudit'
import { SaisieCampagnes, useSaisieCampagnes } from './Campagnes'
import { notifier } from '../lib/notifications'
import { effacerBrouillon, garderBrouillon, lireBrouillon } from '../lib/brouillon'
import { preparationDe } from '../data/semaine'
import { dateCourte, dateHeure } from '../lib/format'
import { libelleTypeVisite, typesVisite, type ActionPlan, type Document, type Reseau, type Visite } from '../data/modele'
import { TexteDicte } from './Dictee'

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

// Ce que garde le brouillon du compte rendu (photos exceptées)
interface Brouillon {
  magasins: string[]; date: string; type: string; participants: string[]; signatureRequise: boolean; lienSigne: string; dateSignature: string
  documents: Document[]; notes: string; parties: string[]; plan: ActionPlan[]; faites?: Record<string, boolean>; mois: string; chiffres: Record<string, string>
  revues?: RevuesTaches; priorites?: RevuesPriorites; sujets?: Record<string, EtatSujet>
}

// Une partie de la saisie, repliable, avec son ancre pour le sommaire (vague 7, 83A)
function BlocSaisie({ id, titre, detail, children }: { id: string; titre: string; detail?: string; children: ReactNode }) {
  const [ouvert, setOuvert] = useState(true)
  return (
    <Box component="section" id={id} aria-label={titre} sx={{ scrollMarginTop: 72, borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
      <Button onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} endIcon={ouvert ? <ExpandLessOutlined /> : <ExpandMoreOutlined />}
        sx={{ minHeight: 48, px: 0, color: 'text.primary', justifyContent: 'flex-start', width: '100%', '& .MuiButton-endIcon': { ml: 'auto' } }}>
        <Typography component="h3" sx={{ fontWeight: 700, fontSize: '1rem' }}>{titre}</Typography>
        {detail && <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>{detail}</Typography>}
      </Button>
      <Collapse in={ouvert}><Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1, pb: 1 }}>{children}</Box></Collapse>
    </Box>
  )
}

export function DialogVisite({ reseau, visite, magasinsInitiaux = [], typeInitial = 'terrain', dateInitiale, onFermer }: { reseau: Reseau; visite: Visite | null; magasinsInitiaux?: string[]; typeInitial?: string; dateInitiale?: string; onFermer: (m?: string) => void }) {
  // Un brouillon par visite enregistrée, ou par saisie nouvelle depuis le même endroit
  const cleBrouillon = visite?.id ? `visite:${visite.id}` : `nouvelle:${magasinsInitiaux.join('|')}:${typeInitial}`
  const [brouillon, setBrouillon] = useState(() => lireBrouillon<Brouillon>(cleBrouillon))
  const b = brouillon
  const [magasins, setMagasins] = useState<string[]>(b?.magasins ?? (visite ? [visite.magasin] : magasinsInitiaux))
  const [date, setDate] = useState(b?.date ?? visite?.date ?? dateInitiale ?? reseau.jour)
  const [type, setType] = useState(b?.type ?? visite?.type ?? typeInitial)
  // Par défaut : le Coach du magasin, tant que les participants n'ont pas été choisis à la main
  const coachDe = (noms: string[]) => { const c = reseau.magasins.find((m) => m.nom === noms[0])?.coach; return c ? [c] : [] }
  const [participants, setParticipants] = useState<string[]>(b?.participants ?? visite?.visiteurs ?? coachDe(magasinsInitiaux))
  const [participantsChoisis, setParticipantsChoisis] = useState(!!visite || !!b)
  const groupes = visiteursGroupes(reseau)
  const options = [...groupes.map((p) => p.nom), ...participants.filter((n) => !groupes.some((p) => p.nom === n))]
  const groupeDe = (n: string) => groupes.find((p) => p.nom === n)?.groupe ?? 'Autres'
  const [signatureRequise, setSignatureRequise] = useState(b?.signatureRequise ?? visite?.signatureRequise ?? false)
  const [lienSigne, setLienSigne] = useState(b?.lienSigne ?? visite?.lienSigne ?? '')
  const [dateSignature, setDateSignature] = useState(b?.dateSignature ?? visite?.dateSignature ?? '')
  const [documents, setDocuments] = useState<Document[]>(b?.documents ?? (visite?.documents.length ? visite.documents : []))
  // Visite planifiée : le compte rendu part des notes de préparation
  const [notes, setNotes] = useState(b?.notes ?? (visite?.notes || (visite?.prevue ? preparationDe(reseau, visite.magasin)?.notes ?? '' : '')))
  const [parties, setParties] = useState<string[]>(b?.parties ?? visite?.parties ?? partiesVides())
  const [plan, setPlan] = useState<ActionPlan[]>(b?.plan ?? visite?.plan ?? [])
  // Revue du plan (87A) : statut des tâches ouvertes, statut des priorités ; anciens brouillons : « faites »
  const [revues, setRevues] = useState<RevuesTaches>(() => b?.revues ?? Object.fromEntries(Object.entries(b?.faites ?? {}).filter(([, v]) => v).map(([k]) => [k, { statut: 'faite' as const }])))
  const [revuesPriorites, setRevuesPriorites] = useState<RevuesPriorites>(b?.priorites ?? {})
  const [etatsSujets, setEtatsSujets] = useState<Record<string, EtatSujet>>(b?.sujets ?? {})
  const unSeul = magasins.length <= 1
  const contact = typesContact.includes(type)
  const audit = typesAudit.includes(type) && unSeul
  const auditAvant = visite ? auditDe(reseau, visite.magasin, visite.date, visite.type) : null
  const [conforme, setConforme] = useState(auditAvant?.conforme === true ? 'oui' : auditAvant?.conforme === false ? 'non' : '')
  const [score, setScore] = useState(auditAvant?.score === null || auditAvant?.score === undefined ? '' : String(auditAvant.score).replace('.', ','))
  const scoreLu = lireNombre(score)
  const scoreInvalide = !!score.trim() && (scoreLu === null || scoreLu < 0 || scoreLu > 100)
  // Grille du type d'audit choisi : reprise de l'audit enregistré, sinon vide
  const grille = audit ? reseau.grilles[type] : undefined
  const [reponsesParType, setReponsesParType] = useState<Record<string, Reponses>>({})
  const reponses = grille ? reponsesParType[type] ?? reponsesPourSaisie(grille, auditAvant?.type === type ? auditAvant.reponses : undefined) : {}
  const setReponses = (f: (r: Reponses) => Reponses) => setReponsesParType((x) => ({ ...x, [type]: f(reponses) }))
  const [photosRetirees, setPhotosRetirees] = useState<string[]>([])
  const [photos, setPhotos] = useState(visite?.photos ?? [])
  const resultatG = grille ? resultatGrille(reponses, grille.seuil) : null
  const grilleRemplie = !!resultatG && (resultatG.renseignes > 0 || photosDe(reponses).length > 0)
  const chiffres = useSaisieChiffres(reseau, magasins[0] ?? '', b?.mois ?? moisPrecedent(visite?.date ?? reseau.jour))
  const [chiffresRepris, setChiffresRepris] = useState(!b?.chiffres)
  if (!chiffresRepris) { setChiffresRepris(true); chiffres.setValeurs(b!.chiffres) }
  // Toute saisie est gardée sur l'appareil ; rien n'est gardé tant que rien n'a changé
  const courant: Brouillon = { magasins, date, type, participants, signatureRequise, lienSigne, dateSignature, documents, notes, parties, plan, revues, priorites: revuesPriorites, sujets: etatsSujets, mois: chiffres.mois, chiffres: chiffres.valeurs as Record<string, string> }
  const [depart] = useState(() => JSON.stringify(courant))
  const texte = JSON.stringify(courant)
  useEffect(() => { if (texte !== depart) garderBrouillon(cleBrouillon, JSON.parse(texte)) }, [texte, depart, cleBrouillon])
  // Campagnes en cours à la date de la visite : constatées sur place, rangées à cette date
  const campagnes = useSaisieCampagnes(reseau, unSeul ? magasins[0] ?? '' : '', date)
  // Anti-doublon (84A) : une saisie nouvelle reprend la visite planifiée du magasin à 7 jours près
  const reprise = !visite && magasins.length === 1 ? visitePlanifieeProche(reseau, magasins[0], date) : null
  const cible = visite ?? reprise
  const sujets = unSeul && !contact && magasins[0] && (!visite || visite.prevue || visite.date >= reseau.jour) ? ordreDuJour(reseau, magasins[0]) : []
  const avecPlan = unSeul && !contact && !!magasins[0]
  const nbOuvertes = avecPlan ? actionsEnCours(reseau, new Set([magasins[0]])).filter((x) => !x.visite || x.visite.id !== (visite?.id ?? null)).length : 0
  const valide = magasins.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && !(audit && !grilleRemplie && scoreInvalide)
  const noms = reseau.magasins.map((m) => m.nom)
  // Depuis un magasin (ou le compte rendu d'une visite prévue) : magasin, date, type et visiteurs déjà connus, sur une ligne
  const [details, setDetails] = useState(() => !((visite?.prevue || (!visite && magasinsInitiaux.length === 1)) && participants.length > 0))
  const prioritesActivesNb = avecPlan ? prioritesDu(reseau, magasins[0]).filter((p) => p.statut === 'active').length : 0
  const sommaire = contact ? [] : [
    ...(sujets.length ? [{ id: 'saisie-ordre', titre: 'Ordre du jour' }] : []), ...(avecPlan ? [{ id: 'saisie-plan', titre: 'Plan d’action' }] : []),
    { id: 'saisie-constats', titre: 'Constats' }, ...(audit || unSeul ? [{ id: 'saisie-chiffres', titre: audit ? 'Grille et chiffres' : 'Chiffres' }] : []), { id: 'saisie-documents', titre: 'Photos et documents' },
  ]
  const quand = date === reseau.jour ? 'aujourd’hui' : /^\d{4}-\d{2}-\d{2}$/.test(date) ? `le ${dateCourte(date)}` : ''
  return (
    <Fenetre
      large pleinePage titre={visite?.prevue ? `Visite de ${visite.magasin}` : visite ? `Modifier la visite de ${visite.magasin}` : 'Saisir une visite'} ouvert onFermer={onFermer} valide={valide}
      entete={sommaire.length > 1 ? (
        <Box component="nav" aria-label="Sommaire de la saisie" sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
          {sommaire.map((x) => <Chip key={x.id} label={x.titre} onClick={() => document.getElementById(x.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} variant="outlined" sx={{ minHeight: 48, borderRadius: 2, flexShrink: 0 }} />)}
        </Box>
      ) : undefined}
      enregistrer={async () => {
        const groupe = cible?.groupe || (magasins.length > 1 ? `g_${Date.now()}` : '')
        const signe = signatureRequise && !contact
        const ids = await enregistrerVisites({ groupe, date, type, visiteurs: participants, signatureRequise: signe, lienSigne: signe ? lienSigne.trim() : '', dateSignature: signe ? dateSignature : '', documents: contact ? [] : documents, photos: unSeul && !contact ? photos : [], notes: notes.trim(), parties: unSeul && !contact ? parties : partiesVides(), plan: unSeul && !contact ? plan : [], prevue: date > reseau.jour }, magasins, cible?.id ?? null)
        effacerBrouillon(cleBrouillon)
        // Franchisé prévenu sur son téléphone d'un nouveau compte rendu (visite faite, pas un appel ni une visite planifiée)
        const sansCompteRendu = !cible || (!cible.notes.trim() && !cible.parties.some((x) => x.trim()))
        if (!contact && sansCompteRendu && date <= reseau.jour) notifier('visite', ids)
        const m0 = magasins[0]
        // Revue du plan (87A) : clés « visite:index » (plan d'une visite) ou « l:id » (tâche hors visite)
        if (avecPlan) {
          const lot = Object.entries(revues).map(([k, r]) => ({ cible: (k.startsWith('l:') ? { libre: k.slice(2), magasin: m0 } : { visite: Number(k.split(':')[0]), index: Number(k.split(':')[1]) }) as CibleTache, revue: r }))
            .filter((l) => 'libre' in l.cible || l.cible.visite)
          if (lot.length) await revoirTaches(lot, date, participants[0] ?? '')
          // Priorités : statut et bilan posés sur place ; une visite faite marque le plan revu
          const tout = prioritesDu(reseau, m0)
          const fait = date <= reseau.jour
          if (tout.length && (fait || Object.keys(revuesPriorites).length)) {
            await enregistrerPlan(m0, tout.map((p) => {
              if (p.statut !== 'active') return p
              const r = revuesPriorites[p.id]
              if (r && r.statut !== 'active') return { ...p, statut: r.statut, bilan: r.bilan.trim().slice(0, 300), closLe: date, revueLe: date }
              return fait ? { ...p, revueLe: date } : p
            }))
          }
          // Ordre du jour : les sujets reportés restent pour la prochaine visite
          if (fait && sujets.length) {
            const prep = reseau.preparations[m0]
            const reportes = sujets.filter((x) => etatsSujets[x.id] === 'reporte')
            await enregistrerPreparation(m0, reportes.length ? { notes: '', heure: '', par: prep?.par ?? '', maj: date, sujets: reportes.filter((x) => x.genre !== 'libre').map((x) => x.id), libres: reportes.filter((x) => x.genre === 'libre').map((x) => x.titre) } : null)
          }
        }
        const constats = unSeul ? campagnes.lot(date, participants[0] ?? reseau.directeur.nom) : []
        if (constats.length) await enregistrerConstats(constats)
        const resultat = audit && grilleRemplie && resultatG ? { date, type, conforme: resultatG.conforme, score: resultatG.score, reponses }
          : audit && (conforme || scoreLu !== null) ? { date, type, conforme: conforme ? conforme === 'oui' : null, score: scoreLu } : null
        const ancien = visite && typesAudit.includes(visite.type) ? { date: visite.date, type: visite.type } : null
        if (resultat || (ancien && auditAvant)) await enregistrerAudit(magasins[0], ancien, resultat)
        // Photos retirées ou d'un audit remplacé : effacées de l'espace photos une fois l'audit enregistré
        const gardees = new Set([...photosDe(resultat?.reponses), ...(unSeul && !contact ? photos : [])].map((p) => p.chemin))
        await supprimerPhotos([...new Set([...photosRetirees, ...photosDe(auditAvant?.reponses).map((p) => p.chemin), ...(visite?.photos ?? []).map((p) => p.chemin)])].filter((c) => !gardees.has(c)))
        return visite || reprise ? 'Visite mise à jour.' : magasins.length > 1 ? `${magasins.length} visites enregistrées.` : 'Visite enregistrée.'
      }}
      supprimer={visite?.id ? async () => {
        await supprimerVisite(visite.id!)
        effacerBrouillon(cleBrouillon)
        if (auditAvant) await enregistrerAudit(visite.magasin, { date: visite.date, type: visite.type }, null)
        await supprimerPhotos([...photosDe(auditAvant?.reponses), ...(visite.photos ?? [])].map((p) => p.chemin))
        return 'Visite supprimée.'
      } : undefined}
      libelleSuppression={visite ? `Supprimer la visite du ${date} à ${visite.magasin} ?` : undefined}
    >
      {brouillon && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', bgcolor: 'action.hover', borderRadius: 2, pl: 2, pr: 1 }}>
          <Typography variant="body2" sx={{ flex: 1, minWidth: 180 }}>{`Brouillon repris du ${dateHeure(brouillon.garde)}`}</Typography>
          <Button onClick={() => { effacerBrouillon(cleBrouillon); setBrouillon(null); onFermer() }} sx={{ minHeight: 48 }}>Supprimer le brouillon</Button>
        </Box>
      )}
      {!details && (
        <Box component="section" aria-label="Visite" sx={{ display: 'flex', alignItems: 'center', gap: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, pl: 2, pr: 1, py: 0.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }}>{[magasins.join(', '), quand].filter(Boolean).join(' · ')}</Typography>
            <Typography variant="body2" color="text.secondary">{[libelleTypeVisite(type), participants.join(', ')].filter(Boolean).join(' · ')}</Typography>
          </Box>
          <Button onClick={() => setDetails(true)} sx={{ minHeight: 48 }}>Modifier</Button>
        </Box>
      )}
      <Collapse in={details} unmountOnExit><Box sx={{ display: 'grid', gap: 2.5, pt: 1 }}>
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
      </Box></Collapse>
      {reprise && (
        <Alert severity="info">{`Une visite est prévue le ${dateCourte(reprise.date)} à ${reprise.magasin} : cette saisie la complète, sans créer de doublon.`}</Alert>
      )}
      {contact
        ? <TexteDicte label="Notes" libelleDictee="Notes" valeur={notes} changer={setNotes} multiline minRows={3} />
        : <>
          {sujets.length > 0 && (
            <BlocSaisie id="saisie-ordre" titre="Ordre du jour" detail={`${sujets.length} sujet${sujets.length > 1 ? 's' : ''}`}>
              <OrdreDuJourSaisie sujets={sujets} etats={etatsSujets} setEtats={setEtatsSujets} />
            </BlocSaisie>
          )}
          {avecPlan && (
            <BlocSaisie id="saisie-plan" titre="Plan d’action et tâches" detail={[prioritesActivesNb && `${prioritesActivesNb} priorité${prioritesActivesNb > 1 ? 's' : ''}`, nbOuvertes && `${nbOuvertes} tâche${nbOuvertes > 1 ? 's' : ''} en cours`].filter(Boolean).join(' · ')}>
              <RevuePlan reseau={reseau} visite={visite} magasin={magasins[0]} plan={plan} setPlan={setPlan} revues={revues} setRevues={setRevues} priorites={revuesPriorites} setPriorites={setRevuesPriorites} />
            </BlocSaisie>
          )}
          <BlocSaisie id="saisie-constats" titre="Constats">
            <ConstatsVisite tournee={!unSeul} notes={notes} setNotes={setNotes} parties={parties} setParties={setParties} />
          </BlocSaisie>
        </>}
      {(audit || unSeul) && (
        <BlocSaisie id="saisie-chiffres" titre={audit ? 'Grille, campagnes et chiffres' : 'Campagnes et chiffres'}>
      {grille && grille.themes.length > 0 && (
        <SaisieGrille titre={`Grille ${libellesGrilles[type]?.toLowerCase() ?? ''}`} reponses={reponses} setReponses={setReponses} seuil={grille.seuil} onRetirerPhoto={(c) => setPhotosRetirees((x) => [...x, c])} />
      )}
      {audit && !grilleRemplie && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField select label="Résultat de l’audit" value={conforme} onChange={(e) => setConforme(e.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
            <MenuItem value="">Non renseigné</MenuItem>
            <MenuItem value="oui">Conforme</MenuItem>
            <MenuItem value="non">Non conforme</MenuItem>
          </TextField>
          <TextField label="Score de l’audit (%)" value={score} onChange={(e) => setScore(e.target.value)} error={scoreInvalide} helperText={scoreInvalide ? 'Entre 0 et 100' : undefined} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        </Box>
      )}
      {unSeul && magasins[0] && <ChiffresCaisse reseau={reseau} magasin={magasins[0]} />}
      {unSeul && <SaisieCampagnes s={campagnes} />}
        </BlocSaisie>
      )}
      {!contact && (
        <BlocSaisie id="saisie-documents" titre="Photos, documents et signature">
      <Box>
        <FormControlLabel control={<Switch checked={signatureRequise} onChange={(e) => setSignatureRequise(e.target.checked)} />} label="Visite contractuelle, à faire signer" sx={{ minHeight: 48 }} />
        <Collapse in={signatureRequise}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, mt: 1 }}>
            <TextField label="Lien du compte rendu signé (Drive)" value={lienSigne} onChange={(e) => setLienSigne(e.target.value)} placeholder="https://drive.google.com/…" />
            <TextField type="date" label="Signé le" value={dateSignature} onChange={(e) => setDateSignature(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Box>
        </Collapse>
      </Box>
      {unSeul && <ChampPhotos photos={photos} onChange={setPhotos} onRetirer={(c) => setPhotosRetirees((x) => [...x, c])} />}
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
        </BlocSaisie>
      )}
    </Fenetre>
  )
}

// Vague 8 (Joseph, 11/11/2026, « pourquoi tu me demandes les chiffres du mois en visite alors que ça vient de la caisse ») :
// la visite ne saisit plus de chiffres ; elle rappelle ceux de la caisse, en lecture
function ChiffresCaisse({ reseau, magasin }: { reseau: Reseau; magasin: string }) {
  const a = analyser(reseau, magasin)
  return (
    <Box component="section" aria-label="Chiffres de la caisse">
      <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>{a ? `Chiffres de la caisse · ${libelleMois(a.mois)}` : 'Chiffres de la caisse'}</Typography>
      {a ? (
        <Typography variant="body2">
          {[`CA ${formatKEuros(a.ca)}${a.ecart === null ? '' : ` (${formatPourcent(a.ecart)} vs N-1)`}`,
            a.chiffre.tickets !== null && `${formatValeur('tickets', a.chiffre.tickets)} tickets`,
            a.chiffre.panier !== null && `panier ${formatValeur('panier', a.chiffre.panier)}`,
            a.chiffre.marge !== null && `marge ${formatValeur('marge', a.chiffre.marge)}`].filter(Boolean).join(' · ')}
        </Typography>
      ) : <Typography variant="body2" color="text.secondary">Pas encore de chiffres de caisse pour ce magasin.</Typography>}
    </Box>
  )
}
