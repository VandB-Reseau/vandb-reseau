// Plan d'action du magasin (refonte vague 4, Joseph 10/11/2026, 31A) : 3 priorités au plus, chacune avec son objectif
// chiffré et ses tâches. L'équipe le pose et le revoit en visite ; le franchisé le lit (titres, statuts, tâches) et change
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
import { LigneAction, useChangerStatut } from './Actions'
import { useAuth } from '../auth/AuthContext'
import { useReseau } from '../data/ReseauContext'
import { enregistrerPlan, rattacherTaches, type CibleTache } from '../data/chargement'
import { actionsDuMagasin, type ActionSuivie } from '../data/actions'
import { avancement, libelleStatut, objectifsDu, phraseObjectif } from '../data/objectifs'
import { PRIORITES_MAX, libelleStatutPriorite, nouvelIdPriorite, prioritesDu, tachesDeLaPriorite, type Priorite, type StatutPriorite } from '../data/planAction'
import { dateCourte } from '../lib/format'
import type { Magasin, Reseau } from '../data/modele'

const cibleDe = (x: ActionSuivie): CibleTache | null => (x.libre ? { libre: x.libre.id, magasin: x.magasin } : x.visite?.id != null ? { visite: x.visite.id, index: x.index } : null)

function BlocPriorite({ reseau, m, p, rang, actions, equipe, modifier, signaler }: { reseau: Reseau; m: Magasin; p: Priorite; rang: number; actions: ActionSuivie[]; equipe: boolean; modifier?: () => void; signaler: (msg: string) => void }) {
  const objectif = equipe && p.objectif ? objectifsDu(reseau, m.nom).find((o) => o.id === p.objectif) : undefined
  const taches = tachesDeLaPriorite(actions, p).filter((x) => !x.a.faite || p.statut !== 'active')
  const faites = tachesDeLaPriorite(actions, p).filter((x) => x.a.faite).length
  const changerStatut = useChangerStatut(reseau, signaler)
  const statutObj = objectif ? avancement(reseau, m.nom, objectif).statut : null
  return (
    <Box component="li" aria-label={`Priorité ${rang} : ${p.titre}`} sx={{ display: 'grid', gridTemplateColumns: '32px minmax(0, 1fr)', gap: 1.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Box aria-hidden sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'text.primary', color: 'background.paper', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, mt: 0.25 }}>{rang}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography component="h3" sx={{ fontWeight: 700, fontSize: '1rem', mr: 'auto' }}>{p.titre}</Typography>
          {modifier && <Button size="small" startIcon={<EditOutlined />} onClick={modifier} sx={{ minHeight: 48 }} aria-label={`Modifier la priorité ${p.titre}`}>Modifier</Button>}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {[objectif ? `Objectif : ${phraseObjectif(objectif)}` : null, statutObj ? libelleStatut[statutObj] : null,
            `${faites} tâche${faites > 1 ? 's' : ''} faite${faites > 1 ? 's' : ''} sur ${tachesDeLaPriorite(actions, p).length}`].filter(Boolean).join(' · ')}
        </Typography>
        {taches.length > 0 && (
          <Box component="ul" aria-label={`Tâches de la priorité ${p.titre}`} sx={{ listStyle: 'none', m: 0, mt: 0.5, p: 0 }}>
            {taches.map((x) => <LigneAction key={x.cle} reseau={reseau} x={x} avecPorteur changerStatut={changerStatut?.(x)} />)}
          </Box>
        )}
      </Box>
    </Box>
  )
}

export function SectionPlan({ reseau, m, signaler, equipe = true, lecture = false }: { reseau: Reseau; m: Magasin; signaler: (msg: string) => void; equipe?: boolean; lecture?: boolean }) {
  const { recharger } = useReseau()
  const tout = prioritesDu(reseau, m.nom)
  const actives = tout.filter((p) => p.statut === 'active')
  const closes = tout.filter((p) => p.statut !== 'active')
  const [edition, setEdition] = useState<Priorite | null | undefined>(undefined)
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
  return (
    <Section titre={actives.length ? `Plan d’action · ${actives.length}` : 'Plan d’action'}
      action={modifiable && actives.length < PRIORITES_MAX ? <Button startIcon={<AddOutlined />} onClick={() => setEdition(null)} sx={{ minHeight: 48 }}>Ajouter une priorité</Button> : undefined}>
      {actives.length === 0
        ? <Typography variant="body2" color="text.secondary">{equipe ? `Aucune priorité en cours. Un plan tient en ${PRIORITES_MAX} priorités au plus, chacune avec son objectif chiffré et ses tâches.` : 'Aucune priorité en cours.'}</Typography>
        : <Box component="ol" aria-label="Priorités du plan d’action" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {actives.map((p, i) => <BlocPriorite key={p.id} reseau={reseau} m={m} p={p} rang={i + 1} actions={actions} equipe={equipe} signaler={signaler} modifier={modifiable ? () => setEdition(p) : undefined} />)}
          </Box>}
      {(actives.length > 0 || closes.length > 0) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 1, pt: 1, borderTop: actives.length ? '1px solid' : 0, borderColor: 'divider' }}>
          {actives.length > 0 && <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>{revue ? `Revu le ${dateCourte(revue)}` : 'Pas encore revu'}</Typography>}
          {modifiable && actives.length > 0 && <Button onClick={() => void marquerRevu()} sx={{ minHeight: 48 }}>Marquer revu aujourd’hui</Button>}
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
      {edition !== undefined && <DialogPriorite reseau={reseau} m={m} priorite={edition} actions={actions} onFermer={(msg) => { setEdition(undefined); if (msg) signaler(msg) }} />}
    </Section>
  )
}

function DialogPriorite({ reseau, m, priorite, actions, onFermer }: { reseau: Reseau; m: Magasin; priorite: Priorite | null; actions: ActionSuivie[]; onFermer: (msg?: string) => void }) {
  const { profil } = useAuth()
  const [titre, setTitre] = useState(priorite?.titre ?? '')
  const [objectif, setObjectif] = useState(priorite?.objectif ?? '')
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
      <TextField select label="Objectif chiffré" value={objectifs.some((o) => o.id === objectif) ? objectif : ''} onChange={(e) => setObjectif(e.target.value)}
        helperText={objectifs.length ? 'Jamais montré au franchisé' : 'Fixe d’abord un objectif dans la carte Objectifs'}>
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
