// Étape « Préparer » d'une visite (vague 7, Joseph 10/11/2026, 81A et 82A) : la date se pose ici, sans fenêtre ; l'ordre du
// jour est proposé (priorités, tâches, campagnes, mot du franchisé, objectifs, chiffres) et se coche ; sujets libres et notes.
// L'ordre du jour s'envoie à la main au franchisé, sans les sujets réservés à l'équipe (objectifs chiffrés, alertes).
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import EventOutlined from '@mui/icons-material/EventOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import { Section } from './Section'
import { TexteDicte } from './Dictee'
import { EnvoyerAuFranchise } from './EnvoyerCompteRendu'
import { useAuth } from '../auth/AuthContext'
import { useReseau } from '../data/ReseauContext'
import { monNomPorteur } from '../data/actions'
import { coachA } from '../data/charge'
import { enregistrerPreparation, enregistrerVisites, supprimerVisite } from '../data/chargement'
import { partiesVides } from '../data/compteRendu'
import { preparationDe } from '../data/semaine'
import { libelleGenreSujet, sujetsProposes, type GenreSujet, type Sujet } from '../data/ordreDuJour'
import { lienGoogleAgenda } from '../lib/agenda'
import { dateCourte, dateLongue } from '../lib/format'
import type { Magasin, Reseau, Visite } from '../data/modele'

const ORDRE: GenreSujet[] = ['priorite', 'tache', 'campagne', 'mot', 'objectif', 'chiffres']

export function texteOrdreDuJour(m: Magasin, v: Visite | null, sujets: Sujet[], noms: string[]): string {
  const prenoms = noms.map((n) => n.split(' ')[0]).join(', ')
  return [
    prenoms ? `Bonjour ${prenoms},` : 'Bonjour,', '',
    v ? `Pour notre visite du ${dateLongue(v.date)} à ${m.nom}, voici les sujets que je te propose :` : `Pour notre prochaine visite à ${m.nom}, voici les sujets que je te propose :`,
    ...sujets.filter((s) => !s.equipe).map((s) => `- ${s.titre}`),
    '', 'Dis-moi si tu veux en ajouter. À bientôt,',
  ].join('\n')
}

export function PreparerVisite({ reseau, m, v, signaler }: { reseau: Reseau; m: Magasin; v: Visite | null; signaler: (msg: string) => void }) {
  const { profil } = useAuth()
  const { recharger } = useReseau()
  const p = preparationDe(reseau, m.nom)
  const proposes = sujetsProposes(reseau, m.nom)
  const [params] = useSearchParams()
  const proposee = params.get('date')
  const [date, setDate] = useState(v?.date && v.date >= reseau.jour ? v.date : proposee && /^\d{4}-\d{2}-\d{2}$/.test(proposee) && proposee >= reseau.jour ? proposee : '')
  const [sujets, setSujets] = useState<Set<string>>(() => new Set(p?.sujets ?? []))
  const [libres, setLibres] = useState<string[]>(() => p?.libres?.length ? p.libres : [])
  const [notes, setNotes] = useState(p?.notes ?? '')
  const [envoi, setEnvoi] = useState(false)
  const par = monNomPorteur(reseau, profil) || reseau.directeur.nom
  const lecture = profil?.role === 'franchise'
  const modifie = JSON.stringify([...sujets].sort()) !== JSON.stringify([...(p?.sujets ?? [])].sort()) || JSON.stringify(libres.filter((t) => t.trim())) !== JSON.stringify(p?.libres ?? []) || notes.trim() !== (p?.notes ?? '').trim()
  const dateValide = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= reseau.jour
  const coach = coachA(m, reseau.jour)

  const agir = async (f: () => Promise<string>) => {
    setEnvoi(true)
    try { const msg = await f(); await recharger(); signaler(msg) } catch { signaler('La visite n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.') } finally { setEnvoi(false) }
  }
  const enregistrer = () => agir(async () => {
    await enregistrerPreparation(m.nom, { notes, heure: p?.heure ?? '', par, maj: reseau.jour, sujets: [...sujets], libres })
    return 'Préparation enregistrée.'
  })
  const planifier = () => agir(async () => {
    if (v) await enregistrerVisites({ ...v, date, prevue: true }, [v.magasin], v.id)
    else await enregistrerVisites({ groupe: '', date, type: 'terrain', visiteurs: coach ? [coach] : [], signatureRequise: false, lienSigne: '', dateSignature: '', documents: [], photos: [], notes: '', parties: partiesVides(), plan: [], prevue: true }, [m.nom], null)
    if (modifie) await enregistrerPreparation(m.nom, { notes, heure: p?.heure ?? '', par, maj: reseau.jour, sujets: [...sujets], libres })
    return v ? `Visite déplacée au ${dateCourte(date)}.` : `Visite planifiée le ${dateCourte(date)}.`
  })
  const retirer = () => v?.id != null && agir(async () => { await supprimerVisite(v.id!); return 'Visite retirée du planning.' })
  const basculer = (id: string) => setSujets((s) => { const t = new Set(s); if (t.has(id)) t.delete(id); else t.add(id); return t })
  const retenus: Sujet[] = [...proposes.filter((s) => sujets.has(s.id)), ...libres.filter((t) => t.trim()).map((t, i) => ({ id: `l:${i}`, genre: 'libre' as const, titre: t, detail: '' }))]

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Section titre="Date de la visite">
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} disabled={lecture}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: reseau.jour } }} error={!!date && date < reseau.jour} sx={{ width: { xs: '100%', sm: 220 } }} />
          {!lecture && <Button variant={v ? 'outlined' : 'contained'} startIcon={<EventAvailableOutlined />} disabled={!dateValide || envoi || (!!v && v.date === date)} onClick={planifier} sx={{ minHeight: 48 }}>
            {v ? 'Changer la date' : 'Planifier la visite'}
          </Button>}
          {v && dateValide && <Tooltip title="Ajouter à Google Agenda"><IconButton component="a" href={lienGoogleAgenda({ magasins: [m], date, notes: { [m.nom]: notes } })} target="_blank" rel="noopener" aria-label="Ajouter à Google Agenda"><EventOutlined /></IconButton></Tooltip>}
          {v && !lecture && <Button color="error" onClick={retirer} disabled={envoi} sx={{ minHeight: 48 }}>Retirer du planning</Button>}
        </Box>
        {v && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{`Prévue le ${dateLongue(v.date)}${v.visiteurs.length ? ` · ${v.visiteurs.join(', ')}` : ''}`}</Typography>}
      </Section>

      <Box component="section" aria-label="Ordre du jour">
      <Section titre="Ordre du jour" action={!lecture && retenus.some((s) => !s.equipe) ? (
        <EnvoyerAuFranchise reseau={reseau} magasin={m.nom} titreFenetre="Envoyer l’ordre du jour" libelleBouton="Envoyer l’ordre du jour"
          libelleIcone={`Envoyer l’ordre du jour à ${m.nom}`} sousTitre={`${m.nom}${v ? ` · visite du ${dateLongue(v.date)}` : ''}`}
          titre={`Ordre du jour · ${m.nom}${v ? ` · ${dateCourte(v.date)}` : ''}`} messageParDefaut={(noms) => texteOrdreDuJour(m, v, retenus, noms)} annexe="" sansAnnexe />
      ) : undefined}>
        {!proposes.length && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Rien d’ouvert pour ce magasin : ajoute tes propres sujets.</Typography>}
        {ORDRE.map((g) => {
          const liste = proposes.filter((s) => s.genre === g)
          if (!liste.length) return null
          return (
            <Box key={g} role="group" aria-label={libelleGenreSujet[g]} sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, mt: 1 }}>{libelleGenreSujet[g]}</Typography>
              {liste.map((s) => (
                <Box key={s.id} component="label" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minHeight: 48, cursor: lecture ? 'default' : 'pointer' }}>
                  <Checkbox checked={sujets.has(s.id)} onChange={() => basculer(s.id)} disabled={lecture} sx={{ width: 48, height: 48, flexShrink: 0 }} slotProps={{ input: { 'aria-label': `À aborder : ${s.titre}` } }} />
                  <Box sx={{ py: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{s.titre}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      {s.detail}{s.equipe && <><LockOutlined sx={{ fontSize: 16 }} aria-hidden /> équipe seule</>}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )
        })}
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, mt: 1 }}>Mes sujets</Typography>
        <Box sx={{ display: 'grid', gap: 1, mt: 1 }}>
          {libres.map((t, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField label={`Sujet ${i + 1}`} value={t} onChange={(e) => setLibres((l) => l.map((x, j) => (j === i ? e.target.value : x)))} disabled={lecture} sx={{ flex: 1 }} />
              {!lecture && <IconButton aria-label={`Retirer le sujet ${i + 1}`} onClick={() => setLibres((l) => l.filter((_x, j) => j !== i))}><CloseOutlined /></IconButton>}
            </Box>
          ))}
          {!lecture && <Button startIcon={<AddOutlined />} onClick={() => setLibres((l) => [...l, ''])} sx={{ minHeight: 48, justifySelf: 'start' }}>Ajouter un sujet</Button>}
        </Box>
      </Section>
      </Box>

      <Section titre="Notes de préparation">
        <TexteDicte label="Notes de préparation" libelleDictee="Notes de préparation" valeur={notes} changer={(f) => setNotes((x) => f(x))} multiline minRows={4} disabled={lecture} fullWidth />
      </Section>
      {!lecture && (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto', alignSelf: 'center' }}>
            {`${retenus.length} sujet${retenus.length > 1 ? 's' : ''} à l’ordre du jour${p?.maj ? ` · enregistré le ${dateCourte(p.maj.slice(0, 10))}` : ''}`}
          </Typography>
          <Button variant="contained" onClick={enregistrer} disabled={!modifie || envoi} sx={{ minHeight: 48 }}>{envoi ? 'Enregistrement…' : 'Enregistrer la préparation'}</Button>
        </Box>
      )}
    </Box>
  )
}
