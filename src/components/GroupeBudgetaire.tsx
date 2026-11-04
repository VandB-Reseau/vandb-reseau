import { useEffect, useState } from 'react'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import { supabase } from '../lib/supabase'
import { Ligne } from './Section'

// Groupe budgétaire du magasin (fusion avec le pilotage, Joseph 03/11/2026, décision 3) : attribut facultatif de la
// fiche, tenu par le Directeur ; les groupes se créent dans Budgets > Hypothèses du réseau. Sans le schéma des budgets
// ou sans groupe créé, la ligne n'apparaît pas.
interface Groupe { id: number; nom: string }

export function GroupeBudgetaire({ magasin, modifiable }: { magasin: string; modifiable: boolean }) {
  const [groupes, setGroupes] = useState<Groupe[] | null>(null)
  const [choisi, setChoisi] = useState<number | null>(null)
  const [erreur, setErreur] = useState(false)
  useEffect(() => {
    let actif = true
    const p = supabase.schema('pilotage')
    void Promise.all([p.from('groupes').select('id,nom').order('nom'), p.from('groupe_magasins').select('groupe_id').eq('store_name', magasin)])
      .then(([g, m]) => {
        if (!actif || g.error || m.error) return
        setGroupes((g.data ?? []) as Groupe[])
        setChoisi(((m.data ?? []) as { groupe_id: number }[])[0]?.groupe_id ?? null)
      })
      .catch(() => { /* schéma des budgets absent : pas de ligne */ })
    return () => { actif = false }
  }, [magasin])
  if (!groupes?.length) return null
  const nom = groupes.find((g) => g.id === choisi)?.nom ?? null
  if (!modifiable) return nom ? <Ligne libelle="Groupe budgétaire">{nom}</Ligne> : null
  const changer = async (v: string) => {
    const id = v ? Number(v) : null
    const avant = choisi
    setChoisi(id); setErreur(false)
    const p = supabase.schema('pilotage').from('groupe_magasins')
    const r = id === null ? await p.delete().eq('store_name', magasin) : await p.upsert({ store_name: magasin, groupe_id: id })
    if (r.error) { setChoisi(avant); setErreur(true) }
  }
  return (
    <Ligne libelle="Groupe budgétaire">
      <TextField select value={choisi === null ? '' : String(choisi)} onChange={(e) => void changer(e.target.value)}
        slotProps={{ htmlInput: { 'aria-label': 'Groupe budgétaire' } }} error={erreur}
        helperText={erreur ? 'Le groupe n’a pas pu être changé. Réessaie dans un instant.' : undefined} sx={{ minWidth: 220 }}>
        <MenuItem value="">Aucun</MenuItem>
        {groupes.map((g) => <MenuItem key={g.id} value={String(g.id)}>{g.nom}</MenuItem>)}
      </TextField>
    </Ligne>
  )
}
