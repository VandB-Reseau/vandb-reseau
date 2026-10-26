import { useState, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { Section } from './Section'
import { Fenetre } from './EditionEquipe'
import { useAuth } from '../auth/AuthContext'
import { enregistrerOuverture } from '../data/chargement'
import { etatOuverture, type EtatEtape, type EtatOuverture } from '../data/ouvertures'
import { etapesOuverture, type EtapeOuverture, type IdEtape, type Magasin, type Reseau } from '../data/modele'
import { dateCourte, dateLongue } from '../lib/format'

// Ouvertures suivies par étapes (sprint 25, F3, migration 0035) : barre des six étapes, carte de la fiche du magasin,
// saisie par le Directeur et les Responsables Régionaux, ligne de « À venir sur 12 mois »
const couleurEtape: Record<EtatEtape, string> = { faite: 'success.main', retard: 'error.main', prevue: 'divider', vide: 'divider' }

export function BarreEtapes({ e }: { e: EtatOuverture }) {
  return (
    <Box role="img" aria-label={`${e.faites} étapes sur ${e.total}`} sx={{ display: 'flex', gap: 0.5, mt: 0.75 }}>
      {e.etapes.map((x) => <Box key={x.id} sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: couleurEtape[x.etat] }} />)}
    </Box>
  )
}

// Où en est l'ouverture, en une ligne : l'étape qui vient est dite « prochaine » (sprint 26, S3) ; à moins de 60 jours
// de l'ouverture sans aucune étape faite, la ligne passe en alerte
export function resumeOuverture(e: EtatOuverture, jour: string, ouverture: string): { texte: string; retard: boolean } {
  if (e.retard) return { texte: `${e.retard.libelle} en retard (prévu le ${dateCourte(e.retard.prevu)})`, retard: true }
  const p = e.prochaine
  const suite = p && p.libelle !== 'Ouverture' ? ` · prochaine : ${p.libelle.charAt(0).toLowerCase()}${p.libelle.slice(1)}${p.prevu ? ` le ${dateCourte(p.prevu)}` : ''}` : ''
  const proche = !!ouverture && ouverture > jour && joursEntre(jour, ouverture) < 60
  return { texte: `${e.faites} étape${e.faites > 1 ? 's' : ''} sur ${e.total}${suite}`, retard: proche && e.faites === 0 }
}

const joursEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

// Ligne de « À venir sur 12 mois » pour une ouverture
export function LigneOuverture({ reseau, m, lien, avatar }: { reseau: Reseau; m: Magasin; lien: string; avatar: ReactNode }) {
  const e = etatOuverture(reseau, m)
  const r = resumeOuverture(e, reseau.jour, m.ouverture)
  return (
    <ButtonBase component={RouterLink} to={lien} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, minHeight: 64, width: '100%', textAlign: 'left', justifyContent: 'flex-start', color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }}>
      {avatar}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600 }}>{m.nom} · {m.ouverture ? dateLongue(m.ouverture) : 'date à fixer'}</Typography>
        <Typography variant="body2" sx={{ color: r.retard ? 'error.main' : 'text.secondary', fontWeight: r.retard ? 600 : 400 }}>{r.texte}</Typography>
        <BarreEtapes e={e} />
      </Box>
    </ButtonBase>
  )
}

const libelleEtat = (x: EtatOuverture['etapes'][number]) =>
  x.etat === 'faite' ? `Fait le ${dateCourte(x.fait)}` : x.etat === 'retard' ? `En retard, prévu le ${dateCourte(x.prevu)}` : x.prevu ? `Prévu le ${dateCourte(x.prevu)}` : 'À planifier'

// Carte de la fiche d'un magasin à ouvrir
export function SectionOuverture({ reseau, m, signaler }: { reseau: Reseau; m: Magasin; signaler: (msg: string) => void }) {
  const { profil } = useAuth()
  const [edition, setEdition] = useState(false)
  const pilote = profil?.role === 'directeur' || profil?.role === 'rr'
  const e = etatOuverture(reseau, m)
  return (
    <Section titre="Ouverture" action={pilote ? <Button startIcon={<EditOutlined />} onClick={() => setEdition(true)} sx={{ minHeight: 48 }}>Modifier</Button> : undefined}>
      <Typography sx={{ fontWeight: 600 }}>{e.faites} étape{e.faites > 1 ? 's' : ''} sur {e.total}</Typography>
      <BarreEtapes e={e} />
      <Box component="ol" aria-label="Étapes de l’ouverture" sx={{ listStyle: 'none', p: 0, m: 0, mt: 2 }}>
        {e.etapes.map((x) => (
          <Box component="li" key={x.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: x.etat === 'faite' ? 'success.main' : x.etat === 'retard' ? 'error.main' : 'transparent', border: '2px solid', borderColor: x.etat === 'faite' ? 'success.main' : x.etat === 'retard' ? 'error.main' : 'text.secondary', flexShrink: 0 }} />
            <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{x.libelle}</Typography>
            <Typography variant="body2" sx={{ color: x.etat === 'retard' ? 'error.main' : 'text.secondary', textAlign: 'right' }}>{libelleEtat(x)}</Typography>
          </Box>
        ))}
      </Box>
      {edition && <DialogOuverture reseau={reseau} m={m} onFermer={(msg) => { setEdition(false); if (msg) signaler(msg) }} />}
    </Section>
  )
}

function DialogOuverture({ reseau, m, onFermer }: { reseau: Reseau; m: Magasin; onFermer: (msg?: string) => void }) {
  const { profil } = useAuth()
  const [etapes, setEtapes] = useState<Partial<Record<IdEtape, EtapeOuverture>>>(() => ({ ...(reseau.ouvertures[m.nom]?.etapes ?? {}) }))
  const changer = (id: IdEtape, champ: keyof EtapeOuverture, v: string) => setEtapes((x) => ({ ...x, [id]: { prevu: '', fait: '', ...x[id], [champ]: v } }))
  const enregistrer = async () => {
    const propres = Object.fromEntries(Object.entries(etapes).filter(([, x]) => x && (x.prevu || x.fait))) as Partial<Record<IdEtape, EtapeOuverture>>
    await enregistrerOuverture(m.nom, { etapes: propres, par: profil?.nom ?? '', maj: new Date().toISOString() })
    return 'Étapes de l’ouverture enregistrées.'
  }
  return (
    <Fenetre titre={`Ouverture de ${m.nom}`} ouvert onFermer={onFermer} valide enregistrer={enregistrer}>
      {etapesOuverture.map((e) => (
        <Box key={e.id} role="group" aria-label={e.libelle}>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>{e.libelle}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField type="date" label="Prévu le" value={etapes[e.id]?.prevu ?? ''} onChange={(ev) => changer(e.id, 'prevu', ev.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField type="date" label="Fait le" value={etapes[e.id]?.fait ?? ''} onChange={(ev) => changer(e.id, 'fait', ev.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Box>
        </Box>
      ))}
      <Typography color="text.secondary">Ouverture : {m.ouverture ? dateLongue(m.ouverture) : 'date à fixer'}</Typography>
    </Fenetre>
  )
}
