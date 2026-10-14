import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import SearchIcon from '@mui/icons-material/Search'
import { RechercheFiltres } from './RechercheFiltres'
import { FiltreMenu } from './FiltreMenu'
import { nbFiltresActifs, filtresVides, type Filtres } from '../data/filtres'
import { statutLibelle, type Reseau, type Statut } from '../data/modele'

export function BarreFiltres({ reseau, filtres, onChange }: { reseau: Reseau; filtres: Filtres; onChange: (f: Filtres) => void }) {
  const compter = (pred: (m: Reseau['magasins'][number]) => boolean) => reseau.magasins.filter(pred).length
  const coachs = [...new Set(reseau.magasins.map((m) => m.coach).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  const rrs = reseau.rrs.filter((r) => reseau.magasins.some((m) => m.rr?.id === r.id))
  const actifs = nbFiltresActifs(filtres)
  const recherche = (
      <TextField
        size="small"
        placeholder="Nom, ville, département, Coach…"
        value={filtres.texte}
        onChange={(e) => onChange({ ...filtres, texte: e.target.value })}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }, htmlInput: { 'aria-label': 'Rechercher dans les magasins' } }}
        sx={{ width: { xs: '100%', md: 320 }, '& .MuiOutlinedInput-root': { borderRadius: 999, minHeight: { xs: 48, md: 40 } } }}
      />
  )
  return (
    <RechercheFiltres recherche={recherche} actifs={actifs} pc={(r, f) => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>{r}{f}</Box>}>
      <FiltreMenu
        libelle="Statut"
        options={(Object.keys(statutLibelle) as Statut[]).map((s) => ({ valeur: s, libelle: statutLibelle[s], detail: `${compter((m) => m.statut === s)} magasins` }))}
        choisis={filtres.statuts}
        onChange={(v) => onChange({ ...filtres, statuts: v as Statut[] })}
      />
      <FiltreMenu
        libelle="Type"
        options={[
          { valeur: 'franchise', libelle: 'Franchisé', detail: `${compter((m) => m.franchise)} magasins` },
          { valeur: 'integre', libelle: 'Intégré', detail: `${compter((m) => !m.franchise)} magasins` },
        ]}
        choisis={filtres.types}
        onChange={(v) => onChange({ ...filtres, types: v as Filtres['types'] })}
      />
      <FiltreMenu
        libelle="Coach"
        options={[...coachs.map((c) => ({ valeur: c, libelle: c, detail: `${compter((m) => m.coach === c)} magasins` })), { valeur: '__aucun__', libelle: 'Sans Coach', detail: `${compter((m) => !m.coach)} magasins` }]}
        choisis={filtres.coachs}
        onChange={(v) => onChange({ ...filtres, coachs: v })}
      />
      <FiltreMenu
        libelle="Responsable Régional"
        options={[...rrs.map((r) => ({ valeur: r.id, libelle: r.nom, detail: `${compter((m) => m.rr?.id === r.id)} magasins` })), { valeur: '__aucun__', libelle: 'Sans RR', detail: `${compter((m) => !m.rr)} magasins` }]}
        choisis={filtres.rrs}
        onChange={(v) => onChange({ ...filtres, rrs: v })}
      />
      {(actifs > 0 || filtres.texte) && (
        <Button onClick={() => onChange(filtresVides)} sx={{ minHeight: 36 }}>Effacer les filtres</Button>
      )}
    </RechercheFiltres>
  )
}
