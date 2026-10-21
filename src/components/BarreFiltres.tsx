import type { ReactNode } from 'react'
import Button from '@mui/material/Button'
import { ChampRecherche } from './Outils'
import { RechercheFiltres, type FiltreActif } from './RechercheFiltres'
import { FiltreMenu } from './FiltreMenu'
import { nbFiltresActifs, filtresVides, type Filtres } from '../data/filtres'
import { statutLibelle, type Reseau, type Statut } from '../data/modele'

export function BarreFiltres({ reseau, filtres, onChange, actions }: { reseau: Reseau; filtres: Filtres; onChange: (f: Filtres) => void; actions?: ReactNode }) {
  const compter = (pred: (m: Reseau['magasins'][number]) => boolean) => reseau.magasins.filter(pred).length
  const coachs = [...new Set(reseau.magasins.map((m) => m.coach).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  const rrs = reseau.rrs.filter((r) => reseau.magasins.some((m) => m.rr?.id === r.id))
  const actifs = nbFiltresActifs(filtres)
  const sans = <K extends 'statuts' | 'types' | 'coachs' | 'rrs'>(k: K, v: string) => () => onChange({ ...filtres, [k]: (filtres[k] as string[]).filter((x) => x !== v) })
  const pucesActives: FiltreActif[] = [
    ...filtres.statuts.map((s) => ({ cle: `s-${s}`, libelle: statutLibelle[s], retirer: sans('statuts', s) })),
    ...filtres.types.map((t) => ({ cle: `t-${t}`, libelle: t === 'franchise' ? 'Franchisé' : 'Intégré', retirer: sans('types', t) })),
    ...filtres.coachs.map((c) => ({ cle: `c-${c}`, libelle: c === '__aucun__' ? 'Sans Coach' : c, retirer: sans('coachs', c) })),
    ...filtres.rrs.map((r) => ({ cle: `r-${r}`, libelle: r === '__aucun__' ? 'Sans RR' : reseau.rrs.find((x) => x.id === r)?.nom ?? r, retirer: sans('rrs', r) })),
  ]
  const recherche = <ChampRecherche valeur={filtres.texte} onChange={(texte) => onChange({ ...filtres, texte })} placeholder="Nom, ville, département, Coach…" libelle="Rechercher dans les magasins" />
  return (
    <RechercheFiltres recherche={recherche} actifs={actifs} actions={actions} pucesActives={pucesActives}>
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
