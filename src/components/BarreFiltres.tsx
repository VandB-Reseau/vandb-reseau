import type { ReactNode } from 'react'
import Button from '@mui/material/Button'
import { ChampRecherche } from './Outils'
import { RechercheFiltres } from './RechercheFiltres'
import { FiltreMenu } from './FiltreMenu'
import { nbFiltresActifs, filtresVides, type Filtres } from '../data/filtres'
import { statutLibelle, type Reseau, type Statut } from '../data/modele'

export function BarreFiltres({ reseau, filtres, onChange, actions }: { reseau: Reseau; filtres: Filtres; onChange: (f: Filtres) => void; actions?: ReactNode }) {
  const compter = (pred: (m: Reseau['magasins'][number]) => boolean) => reseau.magasins.filter(pred).length
  const coachs = [...new Set(reseau.magasins.map((m) => m.coach).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  const rrs = reseau.rrs.filter((r) => reseau.magasins.some((m) => m.rr?.id === r.id))
  const actifs = nbFiltresActifs(filtres)
  const recherche = <ChampRecherche valeur={filtres.texte} onChange={(texte) => onChange({ ...filtres, texte })} placeholder="Nom, ville, département, Coach…" libelle="Rechercher dans les magasins" />
  return (
    <RechercheFiltres recherche={recherche} actifs={actifs} actions={actions}>
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
