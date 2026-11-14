// Objectifs de l'année et plan d'action du magasin (refonte vague 4, Joseph 10/11/2026, 31A ; un seul bloc le 14/11/2026) :
// chaque objectif chiffré, ses priorités (3 au plus par objectif) et leurs tâches. L'équipe le pose et le revoit en visite ; le franchisé le lit (titres, statuts, tâches) et change
// le statut de ses tâches, sans voir l'objectif chiffré.
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { Section } from './Section'
import { Fenetre } from './EditionEquipe'
import { Puces } from './Social'
import { DialogAction, LigneAction, useChangerStatut } from './Actions'
import { DialogObjectif, EnteteObjectif } from './Objectifs'
import { echelle } from '../theme/theme'
import { useAuth } from '../auth/AuthContext'
import { useReseau } from '../data/ReseauContext'
import { enregistrerPlan, rattacherTaches, type CibleTache } from '../data/chargement'
import { actionsDuMagasin, echeanceDate, enRetard, type ActionSuivie } from '../data/actions'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined'
import { Link as RouterLink } from 'react-router-dom'
import { lienFiche } from '../lib/format'
import { anneeObjectif, avancement, libelleStatut, objectifsDu, phraseObjectif, type Objectif } from '../data/objectifs'
import { PRIORITES_MAX, libelleStatutPriorite, nouvelIdPriorite, prioritesDu, tachesDeLaPriorite, type Priorite, type StatutPriorite } from '../data/planAction'
import { dateCourte } from '../lib/format'
import type { Magasin, Reseau } from '../data/modele'

const cibleDe = (x: ActionSuivie): CibleTache | null => (x.libre ? { libre: x.libre.id, magasin: x.magasin } : x.visite?.id != null ? { visite: x.visite.id, index: x.index } : null)

function BlocPriorite({ reseau, m, p, rang, actions, equipe, modifier, ajouterTache, signaler, sousObjectif = false }: { reseau: Reseau; m: Magasin; p: Priorite; rang: number; actions: ActionSuivie[]; equipe: boolean; modifier?: () => void; ajouterTache?: () => void; signaler: (msg: string) => void; sousObjectif?: boolean }) {
  // Sous son objectif, l'objectif n'est pas répété ; ailleurs (vue du franchisé), il n'est jamais montré
  const objectif = equipe && !sousObjectif && p.objectif ? objectifsDu(reseau, m.nom).find((o) => o.id === p.objectif) : undefined
  const toutes = tachesDeLaPriorite(actions, p)
  const taches = toutes.filter((x) => !x.a.faite || p.statut !== 'active')
  const faites = toutes.filter((x) => x.a.faite).length
  const changerStatut = useChangerStatut(reseau, signaler)
  const statutObj = objectif ? avancement(reseau, m.nom, objectif).statut : null
  return (
    <Box component="li" aria-label={`Priorité ${rang} : ${p.titre}`} sx={{ display: 'grid', gridTemplateColumns: '32px minmax(0, 1fr)', gap: 1.5, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
      <Box aria-hidden sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'text.primary', color: 'background.paper', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: echelle.legende, mt: 1 }}>{rang}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', minHeight: 48 }}>
          <Typography component={sousObjectif ? 'h4' : 'h3'} sx={{ fontWeight: 700, fontSize: echelle.carte, mr: 'auto' }}>{p.titre}</Typography>
          {modifier && <Button size="small" startIcon={<EditOutlined />} onClick={modifier} sx={{ minHeight: 48 }} aria-label={`Modifier la priorité ${p.titre}`}>Modifier</Button>}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {[objectif ? `Objectif : ${phraseObjectif(objectif)}` : null, statutObj ? libelleStatut[statutObj] : null,
            toutes.length ? `${faites} tâche${faites > 1 ? 's' : ''} faite${faites > 1 ? 's' : ''} sur ${toutes.length}` : 'Aucune tâche pour l’instant'].filter(Boolean).join(' · ')}
        </Typography>
        {taches.length > 0 && (
          <Box component="ul" aria-label={`Tâches de la priorité ${p.titre}`} sx={{ listStyle: 'none', m: 0, mt: 0.5, p: 0 }}>
            {taches.map((x) => <LigneAction key={x.cle} reseau={reseau} x={x} avecPorteur sansPriorite changerStatut={changerStatut?.(x)} />)}
          </Box>
        )}
        {ajouterTache && <Button size="small" startIcon={<AddOutlined />} onClick={ajouterTache} sx={{ minHeight: 48 }} aria-label={`Ajouter une tâche à la priorité ${p.titre}`}>Ajouter une tâche</Button>}
      </Box>
    </Box>
  )
}

// Joseph (14/11/2026) : un seul bloc, en tête de l'aperçu : les objectifs de l'année (ou du semestre), et sous chacun les
// priorités qui y mènent, détaillées en tâches avec leur échéance et leur porteur. Même modèle qu'avant : un objectif chiffré,
// des priorités du plan qui le visent (Joseph : « des priorités en dessous des objectifs »), des tâches rattachées à chaque
// priorité, avec leur échéance et leur porteur.
// Le franchisé ne voit jamais l'objectif chiffré : pour lui, le bloc liste les priorités et leurs tâches.
export function SectionObjectifsPlan({ reseau, m, signaler, equipe = true, lecture = false }: { reseau: Reseau; m: Magasin; signaler: (msg: string) => void; equipe?: boolean; lecture?: boolean }) {
  const { recharger } = useReseau()
  const tout = prioritesDu(reseau, m.nom)
  const actives = tout.filter((p) => p.statut === 'active')
  const closes = tout.filter((p) => p.statut !== 'active')
  const objectifs = equipe ? [...objectifsDu(reseau, m.nom)].sort((x, y) => x.echeance.localeCompare(y.echeance)) : []
  const [edition, setEdition] = useState<{ priorite: Priorite | null; objectif: string } | undefined>(undefined)
  const [editionObjectif, setEditionObjectif] = useState<Objectif | null | undefined>(undefined)
  const [nouvelleTache, setNouvelleTache] = useState<string | null>(null)
  const [voirCloses, setVoirCloses] = useState(false)
  const actions = actionsDuMagasin(reseau, m.nom)
  const modifiable = equipe && !lecture
  const revue = actives.map((p) => p.revueLe || p.creeLe).filter(Boolean).sort().at(-1)
  const marquerRevu = async () => {
    try {
      await enregistrerPlan(m.nom, tout.map((p) => (p.statut === 'active' ? { ...p, revueLe: reseau.jour } : p)))
      await recharger()
      signaler('Plan d’action marqué revu.')
    } catch { signaler('Le plan n’a pas pu être enregistré. Vérifie ta connexion et réessaie.') }
  }
  if (!equipe && !tout.length) return null
  // Titre : les années des objectifs en cours (« Objectifs 2026 et plan d'action »), l'année en cours s'il n'y en a pas
  const annees = [...new Set(objectifs.map(anneeObjectif))].sort()
  const anneeCourante = Number(reseau.jour.slice(0, 4))
  const titre = equipe
    ? `Objectifs ${(annees.length ? annees : [anneeCourante]).join(' et ')} et plan d’action`
    : `Plan d’action ${annees.length ? annees.join(' et ') : anneeCourante}`
  const sansObjectif = actives.filter((p) => !equipe || !objectifs.some((o) => o.id === p.objectif))
  const blocs = (liste: Priorite[], sousObjectif: boolean) => (
    <Box component="ol" aria-label={sousObjectif || !equipe ? 'Priorités' : 'Priorités sans objectif chiffré'} sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {liste.map((p, i) => <BlocPriorite key={p.id} reseau={reseau} m={m} p={p} rang={i + 1} actions={actions} equipe={equipe} signaler={signaler} sousObjectif={sousObjectif}
        modifier={modifiable ? () => setEdition({ priorite: p, objectif: p.objectif }) : undefined}
        ajouterTache={modifiable ? () => setNouvelleTache(p.id) : undefined} />)}
    </Box>
  )
  const boutonAction = (objectif: string, libelle: string) => modifiable && (
    <Button size="small" startIcon={<AddOutlined />} onClick={() => setEdition({ priorite: null, objectif })} sx={{ minHeight: 48 }}>{libelle}</Button>
  )
  return (
    <Section titre={titre}
      action={modifiable ? <Button startIcon={<AddOutlined />} onClick={() => setEditionObjectif(null)} sx={{ minHeight: 48 }}>Fixer un objectif</Button> : undefined}>
      {equipe && objectifs.length === 0 && actives.length === 0 && (
        <Typography variant="body2" color="text.secondary">Aucun objectif pour l’instant. Fixe l’objectif de l’année, puis les priorités qui y mènent.</Typography>
      )}
      {objectifs.map((o) => {
        const liees = actives.filter((p) => p.objectif === o.id)
        return (
          <Box key={o.id} component="section" aria-label={`Objectif : ${phraseObjectif(o)}`}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', px: { xs: 1.5, md: 2 }, py: 1, mb: 1.5 }}>
            <EnteteObjectif reseau={reseau} magasin={m.nom} o={o} onClick={modifiable ? () => setEditionObjectif(o) : undefined} />
            {liees.length > 0 ? blocs(liees, true)
              : <Typography variant="body2" color="text.secondary" sx={{ py: 1, borderTop: '1px solid', borderColor: 'divider' }}>Aucune priorité pour cet objectif.</Typography>}
            {liees.length < PRIORITES_MAX && boutonAction(o.id, 'Ajouter une priorité')}
          </Box>
        )
      })}
      {(sansObjectif.length > 0 || (modifiable && objectifs.length === 0)) && (
        <Box component="section" aria-label={equipe ? 'Priorités sans objectif chiffré' : 'Priorités'} sx={{ mb: 1 }}>
          {equipe && objectifs.length > 0 && <Typography component="h3" sx={{ fontWeight: 700, fontSize: echelle.carte, minHeight: 40, display: 'flex', alignItems: 'center' }}>Priorités sans objectif chiffré</Typography>}
          {sansObjectif.length > 0 && blocs(sansObjectif, false)}
          {sansObjectif.length < PRIORITES_MAX && boutonAction('', objectifs.length ? 'Ajouter une priorité sans objectif' : 'Ajouter une priorité')}
        </Box>
      )}
      {equipe && <AutresTaches reseau={reseau} m={m} actions={actions.filter((x) => !x.a.faite && !actives.some((p) => p.id === x.a.priorite))} signaler={signaler} avecTitre={actives.length > 0} />}
      {(actives.length > 0 || closes.length > 0) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          {actives.length > 0 && <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>{revue ? `Revu le ${dateCourte(revue)}` : 'Pas encore revu'}</Typography>}
          {modifiable && actives.length > 0 && <MenuRevue marquer={() => void marquerRevu()} />}
          {closes.length > 0 && <Button onClick={() => setVoirCloses((v) => !v)} sx={{ minHeight: 48 }}>{voirCloses ? 'Masquer l’historique' : `Historique · ${closes.length}`}</Button>}
        </Box>
      )}
      {voirCloses && (
        <Box component="ul" aria-label="Priorités closes" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {closes.map((p) => (
            <Box component="li" key={p.id} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
              <Typography sx={{ fontWeight: 700 }}>{p.titre}</Typography>
              <Typography variant="body2" color="text.secondary">{[`${libelleStatutPriorite[p.statut]}${p.closLe ? ` le ${dateCourte(p.closLe)}` : ''}`, p.bilan].filter(Boolean).join(' · ')}</Typography>
            </Box>
          ))}
        </Box>
      )}
      {edition !== undefined && <DialogPriorite reseau={reseau} m={m} priorite={edition.priorite} objectifInitial={edition.objectif} actions={actions} onFermer={(msg) => { setEdition(undefined); if (msg) signaler(msg) }} />}
      {editionObjectif !== undefined && <DialogObjectif reseau={reseau} m={m} objectif={editionObjectif} onFermer={(msg) => { setEditionObjectif(undefined); if (msg) signaler(msg) }} />}
      {nouvelleTache !== null && <DialogAction reseau={reseau} magasins={[m.nom]} action={null} prioriteInitiale={nouvelleTache} onFermer={(msg) => { setNouvelleTache(null); if (msg) signaler(msg) }} />}
    </Section>
  )
}

// Vague 7 (90A) : la visite marque le plan revu ; le geste à la main reste dans le menu « ⋯ »
function MenuRevue({ marquer }: { marquer: () => void }) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  return (
    <>
      <IconButton onClick={(e) => setAncre(e.currentTarget)} aria-label="Autres actions du plan" aria-haspopup="menu" sx={{ width: 48, height: 48 }}><MoreHorizOutlined /></IconButton>
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)}>
        <MenuItem onClick={() => { setAncre(null); marquer() }} sx={{ minHeight: 48 }}>Marquer revu aujourd’hui</MenuItem>
      </Menu>
    </>
  )
}

// Vague 7 (90A) : les tâches ouvertes sans priorité, sous le plan ; les cinq plus urgentes, le reste dans Activité
function AutresTaches({ reseau, m, actions, signaler, avecTitre }: { reseau: Reseau; m: Magasin; actions: ActionSuivie[]; signaler: (msg: string) => void; avecTitre: boolean }) {
  const changerStatut = useChangerStatut(reseau, signaler)
  if (!actions.length) return null
  const tries = [...actions].sort((x, y) => Number(enRetard(y.a, reseau.jour)) - Number(enRetard(x.a, reseau.jour)) || (echeanceDate(x.a) || '9999').localeCompare(echeanceDate(y.a) || '9999'))
  return (
    <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 48 }}>
        <Typography component="h3" sx={{ fontWeight: 700, fontSize: echelle.carte, mr: 'auto' }}>{avecTitre ? `Tâches hors plan · ${actions.length}` : `Tâches en cours · ${actions.length}`}</Typography>
        {actions.length > 5 && <Button component={RouterLink} to={`${lienFiche(m.nom)}?vue=activite`} sx={{ minHeight: 48 }}>Tout voir</Button>}
      </Box>
      <Box component="ul" aria-label={avecTitre ? 'Tâches hors plan' : 'Tâches en cours'} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {tries.slice(0, 5).map((x) => <LigneAction key={x.cle} reseau={reseau} x={x} avecPorteur changerStatut={changerStatut?.(x)} />)}
      </Box>
    </Box>
  )
}

function DialogPriorite({ reseau, m, priorite, objectifInitial = '', actions, onFermer }: { reseau: Reseau; m: Magasin; priorite: Priorite | null; objectifInitial?: string; actions: ActionSuivie[]; onFermer: (msg?: string) => void }) {
  const { profil } = useAuth()
  const [titre, setTitre] = useState(priorite?.titre ?? '')
  const [objectif, setObjectif] = useState(priorite?.objectif ?? objectifInitial)
  const [statut, setStatut] = useState<StatutPriorite>(priorite?.statut ?? 'active')
  const [bilan, setBilan] = useState(priorite?.bilan ?? '')
  const objectifs = objectifsDu(reseau, m.nom)
  const candidates = actions.filter((x) => !x.a.faite || (priorite && x.a.priorite === priorite.id))
  const [taches, setTaches] = useState<string[]>(priorite ? actions.filter((x) => x.a.priorite === priorite.id).map((x) => x.cle) : [])
  const valide = !!titre.trim() && (statut === 'active' || !!bilan.trim())
  const enregistrer = async () => {
    const id = priorite?.id ?? nouvelIdPriorite()
    const p: Priorite = {
      id, titre: titre.trim().slice(0, 200), objectif: objectifs.some((o) => o.id === objectif) ? objectif : '', statut, bilan: statut === 'active' ? '' : bilan.trim().slice(0, 300),
      creeLe: priorite?.creeLe || reseau.jour, par: priorite?.par || profil?.nom || '', closLe: statut === 'active' ? '' : priorite?.closLe || reseau.jour, revueLe: priorite?.revueLe ?? '',
    }
    const tout = reseau.plans?.[m.nom] ?? []
    await enregistrerPlan(m.nom, priorite ? tout.map((x) => (x.id === id ? p : x)) : [...tout, p])
    const avant = new Set(actions.filter((x) => x.a.priorite === id).map((x) => x.cle))
    const ajout = actions.filter((x) => taches.includes(x.cle) && !avant.has(x.cle)).map(cibleDe).filter((c): c is CibleTache => !!c)
    const retrait = actions.filter((x) => avant.has(x.cle) && !taches.includes(x.cle)).map(cibleDe).filter((c): c is CibleTache => !!c)
    if (ajout.length) await rattacherTaches(ajout, id)
    if (retrait.length) await rattacherTaches(retrait, '')
    return priorite ? (statut === 'active' ? 'Priorité enregistrée.' : `Priorité ${libelleStatutPriorite[statut].toLowerCase()}.`) : 'Priorité ajoutée au plan.'
  }
  const supprimer = async () => {
    await enregistrerPlan(m.nom, (reseau.plans?.[m.nom] ?? []).filter((x) => x.id !== priorite!.id))
    const liees = actions.filter((x) => x.a.priorite === priorite!.id).map(cibleDe).filter((c): c is CibleTache => !!c)
    if (liees.length) await rattacherTaches(liees, '')
    return 'Priorité retirée du plan.'
  }
  return (
    <Fenetre titre={priorite ? 'Modifier la priorité' : `Nouvelle priorité pour ${m.nom}`} ouvert onFermer={onFermer} valide={valide} enregistrer={enregistrer}
      supprimer={priorite ? supprimer : undefined} libelleSuppression={priorite ? `Retirer « ${priorite.titre} » du plan ?` : undefined}>
      <TextField label="Priorité" placeholder="Relancer la Cave" value={titre} onChange={(e) => setTitre(e.target.value)} autoFocus={!priorite} slotProps={{ htmlInput: { maxLength: 200 } }} />
      <TextField select label="Objectif de l’année" value={objectifs.some((o) => o.id === objectif) ? objectif : ''} onChange={(e) => setObjectif(e.target.value)}
        helperText={objectifs.length ? 'Jamais montré au franchisé' : 'Aucun objectif fixé : la priorité reste sans objectif chiffré'}>
        <MenuItem value="" sx={{ minHeight: 48 }}>Aucun</MenuItem>
        {objectifs.map((o) => <MenuItem key={o.id} value={o.id} sx={{ minHeight: 48 }}>{phraseObjectif(o)}</MenuItem>)}
      </TextField>
      {candidates.length > 0 && (
        <Box role="group" aria-label="Tâches de la priorité">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Tâches de la priorité</Typography>
          {candidates.map((x) => (
            <FormControlLabel key={x.cle} sx={{ display: 'flex', minHeight: 48, mr: 0 }} label={x.a.action}
              control={<Checkbox checked={taches.includes(x.cle)} onChange={(e) => setTaches((t) => (e.target.checked ? [...t, x.cle] : t.filter((k) => k !== x.cle)))} />} />
          ))}
        </Box>
      )}
      {priorite && (
        <>
          <Puces label="Statut de la priorité" valeur={statut} onChange={setStatut} options={(['active', 'atteinte', 'abandonnee'] as const).map((v) => ({ v, libelle: libelleStatutPriorite[v] }))} />
          {statut !== 'active' && <TextField label="Bilan en une ligne" value={bilan} onChange={(e) => setBilan(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />}
        </>
      )}
    </Fenetre>
  )
}
