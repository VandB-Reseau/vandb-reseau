import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { Section } from './Section'
import { Fenetre } from './EditionEquipe'
import { useAuth } from '../auth/AuthContext'
import { useReseau } from '../data/ReseauContext'
import { enregistrerConcurrence } from '../data/chargement'
import { libelleDistance, lignesConcurrents, suiviVide, useCommercesProches, type LigneConcurrent, type SuiviConcurrence } from '../data/concurrence'
import type { Magasin, Reseau } from '../data/modele'

// Concurrents à moins de 2 km (sprint 27, F3) : cavistes et caves lus sur OpenStreetMap, complétés par l'équipe
const VISIBLES = 8

export function SectionConcurrents({ reseau, m, signaler, lecture = false, max }: { reseau: Reseau; m: Magasin; signaler?: (msg: string) => void; lecture?: boolean; max?: number }) {
  const { commerces, relancer } = useCommercesProches(m)
  const { recharger } = useReseau()
  const suivi = reseau.concurrence[m.nom] ?? suiviVide()
  const [edition, setEdition] = useState<LigneConcurrent | null | undefined>(undefined)
  const [tout, setTout] = useState(false)
  const lignes = lignesConcurrents(commerces.etat === 'pret' ? commerces.liste : [], suivi)
  const limite = max ?? (tout ? lignes.length : VISIBLES)
  const etat = commerces.etat === 'chargement' ? 'Recherche des commerces alentour…'
    : commerces.etat === 'erreur' ? 'La carte des commerces ne répond pas pour le moment.'
      : commerces.etat === 'sansPosition' ? 'Position du magasin inconnue sur la carte : seuls les concurrents ajoutés s’affichent.'
        : !lignes.length ? 'Aucun caviste ni cave à moins de 2 km sur la carte.' : ''
  const remettre = async () => {
    try { await enregistrerConcurrence(m.nom, { ...suivi, masques: [] }); await recharger(); signaler?.('Commerces remis dans la liste.') } catch { signaler?.('La liste n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.') }
  }
  return (
    <Section titre="Concurrents à 2 km" action={lecture ? undefined : <Button startIcon={<AddOutlined />} onClick={() => setEdition(null)} aria-label="Ajouter un concurrent" sx={{ minHeight: 48 }}>Ajouter</Button>}>
      {etat && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: lignes.length ? 1 : 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>{etat}</Typography>
          {commerces.etat === 'erreur' && <Button onClick={relancer} sx={{ minHeight: 48 }}>Réessayer</Button>}
        </Box>
      )}
      {lignes.length > 0 && (
        <Box component="ul" aria-label={`Concurrents de ${m.nom}`} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {lignes.slice(0, limite).map((l) => (
            <Box component="li" key={l.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{l.nom}</Typography>
                {(l.detail || l.ajoute) && <Typography variant="body2" color="text.secondary">{[l.detail, l.ajoute && (l.par ? `ajouté par ${l.par}` : 'ajouté')].filter(Boolean).join(' · ')}</Typography>}
                {l.note && <Typography variant="body2" sx={{ mt: 0.25 }}>« {l.note} »</Typography>}
              </Box>
              {l.distance !== null && <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{libelleDistance(l.distance)}</Typography>}
              {!lecture && <IconButton onClick={() => setEdition(l)} aria-label={`Modifier ${l.nom}`} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton>}
            </Box>
          ))}
        </Box>
      )}
      {!max && lignes.length > VISIBLES && <Button onClick={() => setTout((v) => !v)} sx={{ minHeight: 48, width: '100%' }}>{tout ? 'Voir moins' : `Voir les ${lignes.length} concurrents`}</Button>}
      {!lecture && suivi.masques.length > 0 && <Button onClick={() => void remettre()} sx={{ minHeight: 48 }}>{`Remettre ${suivi.masques.length === 1 ? 'le commerce retiré' : `les ${suivi.masques.length} commerces retirés`}`}</Button>}
      {edition !== undefined && <DialogConcurrent m={m} suivi={suivi} ligne={edition} onFermer={(msg) => { setEdition(undefined); if (msg) signaler?.(msg) }} />}
    </Section>
  )
}

function DialogConcurrent({ m, suivi, ligne, onFermer }: { m: Magasin; suivi: SuiviConcurrence; ligne: LigneConcurrent | null; onFermer: (msg?: string) => void }) {
  const { profil } = useAuth()
  const libre = !ligne || ligne.ajoute
  const [nom, setNom] = useState(ligne?.nom ?? '')
  const [detail, setDetail] = useState(ligne?.ajoute ? ligne.detail : '')
  const [note, setNote] = useState(ligne?.note ?? '')
  const enregistrer = async () => {
    const n = note.trim()
    let s: SuiviConcurrence
    if (!ligne) {
      const id = `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
      s = { ...suivi, ajoutes: [...suivi.ajoutes, { id, nom: nom.trim(), detail: detail.trim(), note: n, par: profil?.nom ?? '', le: new Date().toISOString().slice(0, 10) }] }
    } else if (ligne.ajoute) {
      s = { ...suivi, ajoutes: suivi.ajoutes.map((a) => (a.id === ligne.id ? { ...a, nom: nom.trim(), detail: detail.trim(), note: n } : a)) }
    } else {
      const notes = { ...suivi.notes }
      if (n) notes[ligne.id] = n
      else delete notes[ligne.id]
      s = { ...suivi, notes }
    }
    await enregistrerConcurrence(m.nom, s)
    return ligne ? 'Concurrent enregistré.' : 'Concurrent ajouté.'
  }
  const retirer = async () => {
    const notes = { ...suivi.notes }
    delete notes[ligne!.id]
    await enregistrerConcurrence(m.nom, ligne!.ajoute
      ? { ...suivi, ajoutes: suivi.ajoutes.filter((a) => a.id !== ligne!.id) }
      : { ...suivi, notes, masques: [...new Set([...suivi.masques, ligne!.id])] })
    return `${ligne!.nom} retiré de la liste.`
  }
  return (
    <Fenetre titre={ligne ? ligne.nom : 'Ajouter un concurrent'} ouvert onFermer={onFermer} valide={!libre || !!nom.trim()} enregistrer={enregistrer}
      supprimer={ligne ? retirer : undefined} libelleSuppression={ligne ? `Retirer ${ligne.nom} de la liste ?` : undefined}>
      {libre && <TextField label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} required autoFocus={!ligne} />}
      {libre && <TextField label="Adresse ou précision" value={detail} onChange={(e) => setDetail(e.target.value)} />}
      {!libre && ligne?.detail && <Typography color="text.secondary">{ligne.detail}</Typography>}
      <TextField label="Note" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
    </Fenetre>
  )
}
