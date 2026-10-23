// Réunions et formations (sprint 22, A2) : magasins invités d'un événement, pointage des présents par l'équipe,
// réunions de l'année sur la fiche magasin, réponse du franchisé sur son accueil
import { useEffect, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import { Puces, LigneCompacte, Initiales, CarteLignes, TitreSection } from './Social'
import { Section } from './Section'
import { useAuth } from '../auth/AuthContext'
import type { Evenement, Reseau } from '../data/modele'
import { chargerReunionsFranchise, pointerPresence, repondreReunion, reunionsDuMagasin, tauxPresence, usePresences, type Presence, type Reponse, type ReunionFranchise } from '../data/reunions'
import { dateCourte } from '../lib/format'

const regionsDe = (reseau: Reseau, rrs: string[] | null) => reseau.rrs.filter((r) => !r.integres && (!rrs || rrs.includes(r.id)))
const memes = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

// Choix des magasins invités : aucun, tout le réseau, une région, ou une liste
export function ChampInvites({ reseau, valeur, changer }: { reseau: Reseau; valeur: string[]; changer: (v: string[]) => void }) {
  const { profil } = useAuth()
  const tous = reseau.magasins.map((m) => m.nom)
  const regions = regionsDe(reseau, profil?.role === 'rr' ? profil.perimetre.rr ?? [] : null)
  const deRegion = (id: string) => reseau.magasins.filter((m) => m.rr?.id === id).map((m) => m.nom)
  const depart = !valeur.length ? '' : memes(valeur, tous) ? 'reseau' : regions.find((r) => memes(valeur, deRegion(r.id)))?.id ?? 'choix'
  const [mode, setMode] = useState(depart)
  const choisir = (v: string) => {
    setMode(v)
    changer(v === '' ? [] : v === 'reseau' ? tous : v === 'choix' ? valeur : deRegion(v))
  }
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Magasins invités</Typography>
      <Puces label="Magasins invités" valeur={mode} onChange={choisir}
        options={[{ v: '', libelle: 'Aucun' }, ...(profil?.role === 'directeur' ? [{ v: 'reseau', libelle: 'Tout le réseau' }] : []), ...regions.map((r) => ({ v: r.id, libelle: `Région ${r.nom}` })), { v: 'choix', libelle: 'Choisir' }]} />
      {mode === 'choix' && (
        <Autocomplete multiple disableCloseOnSelect limitTags={4} options={tous} value={valeur} onChange={(_e, v) => changer(v)}
          renderInput={(p) => <TextField {...p} label="Magasins" />} />
      )}
      {mode !== '' && mode !== 'choix' && <Typography variant="body2" color="text.secondary">{valeur.length} magasin{valeur.length > 1 ? 's' : ''} invité{valeur.length > 1 ? 's' : ''}</Typography>}
    </Box>
  )
}

const libelleReponse = (r: Reponse | null) => (r === 'present' ? 'Répond présent' : r === 'absent' ? 'Répond absent' : 'Sans réponse')

// Réponses des magasins invités que suit le compte ; après le début, pointage Présent / Absent
export function PresencesReunion({ reseau, e }: { reseau: Reseau; e: Evenement }) {
  const { presences, recharger } = usePresences()
  const [erreur, setErreur] = useState('')
  if (!presences || e.id === null) return null
  const visibles = reseau.magasins.map((m) => m.nom).filter((n) => e.invites?.includes(n))
  if (!visibles.length) return null
  const de = (m: string): Presence | undefined => presences.find((p) => p.event === e.id && p.magasin === m)
  const commencee = e.debut <= reseau.jour
  const reponses = visibles.filter((m) => de(m)?.reponse).length
  const presents = visibles.filter((m) => de(m)?.present === true).length
  const pointer = async (m: string, v: boolean) => {
    setErreur('')
    try { await pointerPresence(e.id!, m, de(m)?.present === v ? null : v); await recharger() } catch (x) { setErreur((x as Error).message) }
  }
  return (
    <Box component="section" aria-label="Présences">
      <Typography variant="h3" component="h3" sx={{ mb: 0.5 }}>Présences</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {[`${reponses} réponse${reponses > 1 ? 's' : ''} sur ${visibles.length}`, commencee && `${presents} présent${presents > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
      </Typography>
      <Card component="ul" aria-label="Magasins invités" sx={{ listStyle: 'none', m: 0, p: 0, overflow: 'hidden', '& > li + li': { borderTop: '1px solid', borderColor: 'divider' } }}>
        {visibles.map((m) => {
          const p = de(m)
          return (
            <Box component="li" key={m} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 140 }}>
                <Typography sx={{ fontWeight: 600 }}>{m}</Typography>
                <Typography variant="body2" color="text.secondary">{libelleReponse(p?.reponse ?? null)}</Typography>
              </Box>
              {commencee && (['Présent', 'Absent'] as const).map((l) => {
                const v = l === 'Présent'
                const actif = p?.present === v
                return <Button key={l} size="small" variant={actif ? 'contained' : 'outlined'} color={v ? 'success' : 'inherit'} aria-pressed={actif}
                  aria-label={`${l} : ${m}`} onClick={() => void pointer(m, v)} sx={{ minHeight: 48, minWidth: 88 }}>{l}</Button>
              })}
            </Box>
          )
        })}
      </Card>
      {erreur && <Typography color="error" sx={{ mt: 1 }}>{erreur}</Typography>}
    </Box>
  )
}

// Fiche magasin : réunions et formations de l'année, présent à X sur Y
export function SectionReunionsMagasin({ reseau, magasin }: { reseau: Reseau; magasin: string }) {
  const { presences } = usePresences()
  if (!presences) return null
  const liste = reunionsDuMagasin(reseau, magasin, presences)
  if (!liste.length) return null
  const t = tauxPresence(liste, reseau.jour)
  return (
    <Section titre={`Réunions et formations · ${reseau.jour.slice(0, 4)}`} action={t.total ? <Typography sx={{ fontWeight: 600 }}>Présent à {t.presences} sur {t.total}</Typography> : undefined}>
      <CarteLignes label="Réunions du magasin">
        {liste.map(({ e, presence }) => (
          <LigneCompacte key={e.id} avatar={<Initiales nom={e.titre} icone={<GroupsOutlined />} />} titre={e.titre}
            detail={[dateCourte(e.debut), e.debut > reseau.jour ? libelleReponse(presence?.reponse ?? null)
              : presence?.present === true ? 'Présent' : presence?.present === false ? 'Absent' : 'Présence non pointée'].join(' · ')} />
        ))}
      </CarteLignes>
    </Section>
  )
}

// Accueil du franchisé : réunions à venir, réponse Présent / Absent
export function SectionReunionsFranchise({ jour }: { jour: string }) {
  const [liste, setListe] = useState<ReunionFranchise[] | null>(null)
  const [erreur, setErreur] = useState('')
  const relire = () => chargerReunionsFranchise().then(setListe).catch(() => setListe(null))
  useEffect(() => { void relire() }, [])
  const a_venir = (liste ?? []).filter((r) => r.fin >= jour)
  if (!a_venir.length) return null
  const repondre = async (r: ReunionFranchise, v: Reponse) => {
    setErreur('')
    try { await repondreReunion(r.id, v); await relire() } catch (x) { setErreur((x as Error).message) }
  }
  return (
    <Box component="section" aria-label="Réunions et formations">
      <TitreSection nombre={a_venir.length}>Réunions et formations</TitreSection>
      <Card component="ul" aria-label="Réunions à venir" sx={{ listStyle: 'none', m: 0, p: 0, overflow: 'hidden', '& > li + li': { borderTop: '1px solid', borderColor: 'divider' } }}>
        {a_venir.map((r) => (
          <Box component="li" key={r.id} sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ fontWeight: 600 }}>{r.titre}</Typography>
            <Typography variant="body2" color="text.secondary">{[r.debut === r.fin ? dateCourte(r.debut) : `${dateCourte(r.debut)} au ${dateCourte(r.fin)}`, r.notes].filter(Boolean).join(' · ')}</Typography>
            <Box role="group" aria-label={`Ma réponse : ${r.titre}`} sx={{ display: 'flex', gap: 1, mt: 1 }}>
              {(['present', 'absent'] as const).map((v) => (
                <Button key={v} variant={r.reponse === v ? 'contained' : 'outlined'} color={v === 'present' ? 'success' : 'inherit'} aria-pressed={r.reponse === v}
                  onClick={() => void repondre(r, v)} sx={{ minHeight: 48, flex: 1 }}>{v === 'present' ? 'Présent' : 'Absent'}</Button>
              ))}
            </Box>
          </Box>
        ))}
      </Card>
      {erreur && <Typography color="error" sx={{ mt: 1 }}>{erreur}</Typography>}
    </Box>
  )
}
