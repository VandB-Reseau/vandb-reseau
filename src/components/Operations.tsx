// 185 · Journal des opérations commerciales (Joseph, 15/11/2026) : dégustations, soirées, promotions… avec leur date,
// leur univers et leur coût ; chaque ligne porte son bilan en caisse (évolution du mois face à l'an passé, moins la
// tendance des 3 mois d'avant). L'équipe et le franchisé (ses magasins, par ecrire_operations) ajoutent et modifient.
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { Section } from './Section'
import { Fenetre } from './EditionEquipe'
import { ChampDate } from './ChampDate'
import { useAuth } from '../auth/AuthContext'
import { useApercu } from '../auth/Apercu'
import { enregistrerOperations, enregistrerOperationsFranchise } from '../data/chargement'
import { chiffresDuMagasin, formatEuros } from '../data/chiffres'
import {
  bilanOperation, libelleTypeOperation, libelleUnivers, operationsDu, phraseBilan, typesOperation, universOperation,
  type Operation, type TypeOperation, type UniversOperation,
} from '../data/operations'
import { dateCourte } from '../lib/format'
import type { Magasin, Reseau } from '../data/modele'

export function SectionOperations({ reseau, m, signaler }: { reseau: Reseau; m: Magasin; signaler?: (msg: string) => void }) {
  const { profil } = useAuth()
  const { apercu } = useApercu()
  const [edition, setEdition] = useState<Operation | null | undefined>(undefined)
  const [tout, setTout] = useState(false)
  const liste = operationsDu(reseau, m.nom)
  const chiffres = chiffresDuMagasin(reseau, m.nom)
  const ecrire = profil?.role === 'franchise' ? enregistrerOperationsFranchise : enregistrerOperations
  const vues = tout ? liste : liste.slice(0, 6)
  return (
    <Section titre={liste.length ? `Opérations commerciales · ${liste.length}` : 'Opérations commerciales'}
      action={apercu ? undefined : <Button startIcon={<AddOutlined />} onClick={() => setEdition(null)} aria-label="Ajouter une opération commerciale" sx={{ minHeight: 48 }}>Ajouter</Button>}>
      {!liste.length ? (
        <Typography variant="body2" color="text.secondary">Aucune opération notée. Note une dégustation, une soirée ou une promotion : son bilan se lit en caisse le mois suivant.</Typography>
      ) : (
        <Box component="ul" aria-label={`Opérations commerciales de ${m.nom}`} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {vues.map((o) => {
            const b = phraseBilan(bilanOperation(chiffres, o), o)
            return (
              <Box component="li" key={o.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{o.titre}</Typography>
                  <Typography variant="body2" color="text.secondary">{[libelleTypeOperation(o.type), dateCourte(o.jour), libelleUnivers(o.univers), o.cout !== null && `${formatEuros(o.cout)} HT`].filter(Boolean).join(' · ')}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.25, fontWeight: b.ton === 'neutre' ? 400 : 600, color: b.ton === 'bon' ? 'success.dark' : b.ton === 'faible' ? 'text.primary' : 'text.secondary' }}>{b.texte}</Typography>
                </Box>
                {!apercu && <IconButton onClick={() => setEdition(o)} aria-label={`Modifier ${o.titre}`} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton>}
              </Box>
            )
          })}
        </Box>
      )}
      {liste.length > 6 && <Button onClick={() => setTout((v) => !v)} sx={{ minHeight: 48, mt: 0.5 }}>{tout ? 'Afficher moins' : `Voir les ${liste.length} opérations`}</Button>}
      {edition !== undefined && <DialogOperation m={m} liste={liste} ecrire={ecrire} operation={edition} par={profil?.nom ?? ''} jour={reseau.jour}
        onFermer={(msg) => { setEdition(undefined); if (msg) signaler?.(msg) }} />}
    </Section>
  )
}

const nombreOuNull = (v: string) => { const n = Number(v.replace(/\s/g, '').replace(',', '.')); return v.trim() && Number.isFinite(n) ? n : null }

function DialogOperation({ m, liste, ecrire, operation: o, par, jour, onFermer }: { m: Magasin; liste: Operation[]; ecrire: (magasin: string, liste: Operation[]) => Promise<void>; operation: Operation | null; par: string; jour: string; onFermer: (msg?: string) => void }) {
  const [type, setType] = useState<TypeOperation>(o?.type ?? 'degustation')
  const [titre, setTitre] = useState(o?.titre ?? '')
  const [date, setDate] = useState(o?.jour ?? jour)
  const [univers, setUnivers] = useState<UniversOperation>(o?.univers ?? 'tout')
  const [cout, setCout] = useState(o?.cout !== null && o?.cout !== undefined ? String(o.cout) : '')
  const [note, setNote] = useState(o?.note ?? '')
  const c = nombreOuNull(cout)
  const valide = !!titre.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date) && (!cout.trim() || (c !== null && c >= 0))
  const enregistrer = async () => {
    const ligne: Operation = {
      id: o?.id ?? `o_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, type, titre: titre.trim().slice(0, 120), jour: date, univers,
      cout: c, note: note.trim().slice(0, 500), par: o?.par || par, le: o?.le || jour,
    }
    await ecrire(m.nom, o ? liste.map((x) => (x.id === o.id ? ligne : x)) : [ligne, ...liste])
    return o ? 'Opération enregistrée.' : 'Opération ajoutée au journal.'
  }
  const retirer = async () => {
    await ecrire(m.nom, liste.filter((x) => x.id !== o!.id))
    return 'Opération retirée du journal.'
  }
  return (
    <Fenetre titre={o ? 'Modifier l’opération' : 'Ajouter une opération commerciale'} ouvert onFermer={onFermer} valide={valide} enregistrer={enregistrer}
      supprimer={o ? retirer : undefined} libelleSuppression={o ? `Retirer « ${o.titre} » du journal ?` : undefined}>
      <TextField select label="Type d’opération" value={type} onChange={(x) => setType(x.target.value as TypeOperation)}>
        {typesOperation.map(([k, l]) => <MenuItem key={k} value={k} sx={{ minHeight: 48 }}>{l}</MenuItem>)}
      </TextField>
      <TextField label="Intitulé" placeholder="Dégustation vins de Loire" value={titre} onChange={(x) => setTitre(x.target.value)} required slotProps={{ htmlInput: { maxLength: 120 } }} />
      <ChampDate label="Date (ou premier jour)" value={date} onChange={(x) => setDate(x.target.value)} required />
      <TextField select label="Univers visé" value={univers} onChange={(x) => setUnivers(x.target.value as UniversOperation)}>
        {universOperation.map(([k, l]) => <MenuItem key={k} value={k} sx={{ minHeight: 48 }}>{l}</MenuItem>)}
      </TextField>
      <TextField label="Coût HT (produits offerts, animation, communication)" value={cout} onChange={(x) => setCout(x.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
      <TextField label="Note" value={note} onChange={(x) => setNote(x.target.value)} multiline minRows={2} />
    </Fenetre>
  )
}
