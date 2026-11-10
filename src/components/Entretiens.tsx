// Entretien mensuel RR–Coach (refonte vague 4, Joseph 10/11/2026, 34A), onglet « Entretiens » de la fiche du Coach.
// Le RR du Coach (ou le Directeur) prépare et note ; le Coach lit et ajoute ses remarques.
import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutlined'
import { Section } from './Section'
import { TexteDicte } from './Dictee'
import { useAuth } from '../auth/AuthContext'
import { monNom } from './AgendaAbonne'
import { ENGAGEMENTS_MAX, enregistrerEntretien, enregistrerRemarques, moisPrecedent, ordreDuJour, useEntretiens, type Engagement, type Entretien } from '../data/entretiens'
import { libelleMois } from '../data/chiffres'
import { dateCourte } from '../lib/format'
import type { Coach, Reseau } from '../data/modele'

const vide = (coach: string, mois: string, par: string): Entretien => ({ id: null, coach, mois, notes: '', engagements: [], remarques: '', faitLe: '', par })
const nouvelEngagement = (): Engagement => ({ id: Math.random().toString(36).slice(2, 8), texte: '', echeance: '' })

export function OngletEntretiens({ reseau, coach, signaler }: { reseau: Reseau; coach: Coach; signaler: (m: string) => void }) {
  const { profil } = useAuth()
  const { liste, recharger } = useEntretiens(coach.nom)
  const mois = reseau.jour.slice(0, 7)
  const anime = (profil?.role === 'directeur' || (profil?.role === 'rr' && !!coach.rr && profil.perimetre.rr?.includes(coach.rr.id)))
  const estLeCoach = profil?.role === 'coach' && profil.perimetre.coachs?.includes(coach.nom)
  const par = monNom(reseau, profil) || profil?.nom || ''
  const actuel = liste?.find((e) => e.mois === mois) ?? null
  const precedent = liste?.find((e) => e.mois === moisPrecedent(mois)) ?? null
  const [brouillon, setBrouillon] = useState<Entretien | null>(null)
  const [tenus, setTenus] = useState<Engagement[]>([])
  const [remarques, setRemarques] = useState('')
  const [envoi, setEnvoi] = useState(false)
  useEffect(() => { if (liste !== undefined) { setBrouillon(actuel ?? vide(coach.nom, mois, par)); setTenus(precedent?.engagements ?? []); setRemarques(actuel?.remarques ?? '') } }, [liste]) // eslint-disable-line react-hooks/exhaustive-deps
  const points = useMemo(() => ordreDuJour(reseau, coach.nom), [reseau, coach.nom])

  if (liste === undefined || !brouillon) return <Box sx={{ display: 'grid', gap: 2 }}><Skeleton variant="rounded" height={160} /><Skeleton variant="rounded" height={220} /></Box>
  if (liste === null) return <Typography color="text.secondary">Les entretiens ne sont pas encore activés dans la base.</Typography>

  const changer = (f: Partial<Entretien>) => setBrouillon((b) => (b ? { ...b, ...f } : b))
  const changerEngagement = (id: string, f: Partial<Engagement>) => changer({ engagements: brouillon.engagements.map((e) => (e.id === id ? { ...e, ...f } : e)) })
  const enregistrer = async (faire: boolean) => {
    setEnvoi(true)
    try {
      await enregistrerEntretien({ ...brouillon, par: brouillon.par || par, engagements: brouillon.engagements.filter((e) => e.texte.trim()), faitLe: faire ? reseau.jour : brouillon.faitLe })
      if (precedent && tenus.some((t, i) => t.tenu !== precedent.engagements[i]?.tenu)) await enregistrerEntretien({ ...precedent, engagements: tenus })
      await recharger()
      signaler(faire ? 'Entretien noté comme fait.' : 'Entretien enregistré.')
    } catch (e) { signaler(e instanceof Error ? e.message : 'L’entretien n’a pas pu être enregistré.') }
    finally { setEnvoi(false) }
  }
  const envoyerRemarques = async () => {
    if (!actuel?.id) return
    setEnvoi(true)
    try { await enregistrerRemarques(actuel.id, remarques.trim()); await recharger(); signaler('Remarques enregistrées.') }
    catch (e) { signaler(e instanceof Error ? e.message : 'Tes remarques n’ont pas pu être enregistrées.') }
    finally { setEnvoi(false) }
  }
  const anciens = liste.filter((e) => e.mois < mois)

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' }, alignItems: 'start' }}>
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Section titre={`Entretien de ${libelleMois(mois).toLowerCase()}`}
          action={actuel?.faitLe ? <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.dark', fontWeight: 600 }}><CheckCircleOutline sx={{ fontSize: 18 }} />Fait le {dateCourte(actuel.faitLe)}</Typography> : undefined}>
          {anime ? (
            <Box sx={{ display: 'grid', gap: 2 }}>
              {precedent && precedent.engagements.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Engagements de {libelleMois(precedent.mois).toLowerCase()}</Typography>
                  {tenus.map((e, i) => (
                    <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, flexWrap: 'wrap' }}>
                      <Typography sx={{ flex: 1, minWidth: 180 }}>{e.texte}{e.echeance && <Typography component="span" variant="body2" color="text.secondary"> · pour le {dateCourte(e.echeance)}</Typography>}</Typography>
                      <ToggleButtonGroup size="small" exclusive value={e.tenu === undefined ? null : e.tenu ? 'oui' : 'non'} aria-label={`Engagement tenu : ${e.texte}`}
                        onChange={(_, v) => setTenus((l) => l.map((x, j) => (j === i ? { ...x, ...(v === null ? { tenu: undefined } : { tenu: v === 'oui' }) } : x)))}>
                        <ToggleButton value="oui" sx={{ minHeight: { xs: 48, sm: 32 }, px: 1.5 }}>Tenu</ToggleButton>
                        <ToggleButton value="non" sx={{ minHeight: { xs: 48, sm: 32 }, px: 1.5 }}>Pas tenu</ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                  ))}
                </Box>
              )}
              <TexteDicte label="Notes de l’entretien" libelleDictee="Dicter les notes" valeur={brouillon.notes} changer={(f) => changer({ notes: f(brouillon.notes) })} multiline minRows={4} fullWidth slotProps={{ htmlInput: { maxLength: 10000 } }} />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Engagements du mois ({brouillon.engagements.length}/{ENGAGEMENTS_MAX})</Typography>
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  {brouillon.engagements.map((e, i) => (
                    <Box key={e.id} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <TextField label={`Engagement ${i + 1}`} value={e.texte} onChange={(ev) => changerEngagement(e.id, { texte: ev.target.value })} sx={{ flex: 1, minWidth: 220 }} slotProps={{ htmlInput: { maxLength: 300 } }} />
                      <TextField label="Pour le" type="date" value={e.echeance} onChange={(ev) => changerEngagement(e.id, { echeance: ev.target.value })} sx={{ width: 170 }} slotProps={{ inputLabel: { shrink: true } }} />
                    </Box>
                  ))}
                </Box>
                {brouillon.engagements.length < ENGAGEMENTS_MAX && <Button startIcon={<AddOutlined />} onClick={() => changer({ engagements: [...brouillon.engagements, nouvelEngagement()] })} sx={{ minHeight: 48, mt: 1 }}>Ajouter un engagement</Button>}
              </Box>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Button onClick={() => void enregistrer(false)} disabled={envoi} sx={{ minHeight: 48 }}>Enregistrer</Button>
                {!actuel?.faitLe && <Button variant="contained" onClick={() => void enregistrer(true)} disabled={envoi} sx={{ minHeight: 48 }}>Entretien fait</Button>}
              </Box>
              {actuel?.remarques && <Box><Typography variant="subtitle2">Remarques de {coach.nom}</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{actuel.remarques}</Typography></Box>}
            </Box>
          ) : actuel ? (
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              {actuel.notes && <Typography sx={{ whiteSpace: 'pre-wrap' }}>{actuel.notes}</Typography>}
              <Engagements liste={actuel.engagements} />
              {estLeCoach ? (
                <Box sx={{ display: 'grid', gap: 1 }}>
                  <TexteDicte label="Mes remarques" libelleDictee="Dicter mes remarques" valeur={remarques} changer={(f) => setRemarques(f(remarques))} multiline minRows={3} fullWidth slotProps={{ htmlInput: { maxLength: 5000 } }} />
                  <Button variant="contained" onClick={() => void envoyerRemarques()} disabled={envoi || remarques.trim() === (actuel.remarques ?? '')} sx={{ minHeight: 48, justifySelf: 'end' }}>Enregistrer mes remarques</Button>
                </Box>
              ) : actuel.remarques && <Box><Typography variant="subtitle2">Remarques de {coach.nom}</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{actuel.remarques}</Typography></Box>}
            </Box>
          ) : <Typography color="text.secondary">L’entretien de ce mois n’est pas encore préparé.</Typography>}
        </Section>
        {anciens.length > 0 && (
          <Section titre="Entretiens précédents">
            {anciens.slice(0, 12).map((e) => (
              <Box key={e.mois} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                <Typography sx={{ fontWeight: 600 }}>{libelleMois(e.mois)}{e.faitLe ? '' : ' · pas fait'}</Typography>
                {e.notes && <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>{e.notes.length > 240 ? `${e.notes.slice(0, 240)}…` : e.notes}</Typography>}
                <Engagements liste={e.engagements} />
              </Box>
            ))}
          </Section>
        )}
      </Box>
      <Section titre="À aborder">
        {points.length === 0 ? <Typography variant="body2" color="text.secondary">Rien de particulier dans son portefeuille ce mois-ci.</Typography> : (
          <Box component="ul" aria-label="Ordre du jour" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {points.map((p, i) => (
              <Box component="li" key={i} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                {p.lien ? <Link component={RouterLink} to={p.lien} sx={{ fontWeight: 600 }}>{p.libelle}</Link> : <Typography sx={{ fontWeight: 600 }}>{p.libelle}</Typography>}
                {p.detail && <Typography variant="body2" color="text.secondary">{p.detail}</Typography>}
              </Box>
            ))}
          </Box>
        )}
      </Section>
    </Box>
  )
}

function Engagements({ liste }: { liste: Engagement[] }) {
  if (!liste.length) return null
  return (
    <Box component="ul" aria-label="Engagements" sx={{ m: 0, pl: 2.5 }}>
      {liste.map((e) => (
        <Typography component="li" key={e.id} variant="body2">
          {e.texte}{e.echeance && ` · pour le ${dateCourte(e.echeance)}`}
          {e.tenu !== undefined && <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: e.tenu ? 'success.dark' : 'error.main' }}> · {e.tenu ? 'Tenu' : 'Pas tenu'}</Typography>}
        </Typography>
      ))}
    </Box>
  )
}
