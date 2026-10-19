import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { useReseau } from '../data/ReseauContext'
import { marquerActions } from '../data/chargement'
import { echeanceDate, enRetard, type ActionSuivie } from '../data/actions'
import type { Reseau } from '../data/modele'
import { dateCourte, lienFiche } from '../lib/format'
import { lienCompteRendu } from '../data/visites'

function LigneAction({ reseau, x, avecMagasin, cocher, enCours }: { reseau: Reseau; x: ActionSuivie; avecMagasin?: boolean; cocher: (faite: boolean) => void; enCours: boolean }) {
  const retard = enRetard(x.a, reseau.jour)
  const echeance = x.a.echeance && (echeanceDate(x.a) ? dateCourte(x.a.echeance) : x.a.echeance)
  return (
    <Box component="li" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Checkbox checked={!!x.a.faite} disabled={enCours} onChange={(e) => cocher(e.target.checked)} sx={{ width: 48, height: 48, flexShrink: 0 }}
        slotProps={{ input: { 'aria-label': `${x.a.faite ? 'Remettre en cours' : 'Marquer faite'} : ${x.a.action}` } }} />
      <Box sx={{ flex: 1, minWidth: 0, py: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: 500, textDecoration: x.a.faite ? 'line-through' : undefined, color: x.a.faite ? 'text.secondary' : undefined }}>{x.a.action}</Typography>
        <Typography variant="body2" color="text.secondary">
          {avecMagasin && <><Link component={RouterLink} to={lienFiche(x.visite.magasin)}>{x.visite.magasin}</Link> · </>}
          {[x.a.porteur, x.a.faite ? `faite le ${dateCourte(x.a.faite)}` : null].filter(Boolean).join(' · ')}
          {(x.a.porteur || x.a.faite) && ' · '}
          <Link component={RouterLink} to={lienCompteRendu(x.visite)}>visite du {dateCourte(x.visite.date)}</Link>
        </Typography>
      </Box>
      {!x.a.faite && echeance && <Chip size="small" color={retard ? 'error' : 'default'} variant={retard ? 'filled' : 'outlined'} label={retard ? `En retard · ${echeance}` : echeance} sx={{ fontSize: 12, fontWeight: 600, mt: 1.5, flexShrink: 0 }} />}
    </Box>
  )
}

// Actions des plans de visite : en cours (échéance la plus proche d'abord), puis celles déjà faites
export function ListeActions({ reseau, actions, avecMagasin, signaler, libelle }: { reseau: Reseau; actions: ActionSuivie[]; avecMagasin?: boolean; signaler: (m: string) => void; libelle: string }) {
  const { recharger } = useReseau()
  const [enCours, setEnCours] = useState<string | null>(null)
  const [voirFaites, setVoirFaites] = useState(false)
  const ouvertes = actions.filter((x) => !x.a.faite)
  const faites = actions.filter((x) => x.a.faite)
  const cocher = async (x: ActionSuivie, faite: boolean) => {
    if (x.visite.id === null) return
    setEnCours(x.cle)
    try {
      await marquerActions([{ visite: x.visite.id, index: x.index, faite: faite ? reseau.jour : '' }])
      await recharger()
      signaler(faite ? 'Action marquée faite.' : 'Action remise en cours.')
    } catch { signaler('L’action n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.') }
    finally { setEnCours(null) }
  }
  const ligne = (x: ActionSuivie) => <LigneAction key={x.cle} reseau={reseau} x={x} avecMagasin={avecMagasin} enCours={enCours === x.cle} cocher={(f) => cocher(x, f)} />
  return (
    <>
      {ouvertes.length === 0
        ? <Typography variant="body2" color="text.secondary">{actions.length ? 'Toutes les actions sont faites.' : 'Aucune action dans les plans d’action des visites.'}</Typography>
        : <Box component="ul" aria-label={libelle} sx={{ listStyle: 'none', m: 0, p: 0 }}>{ouvertes.map(ligne)}</Box>}
      {faites.length > 0 && (
        <>
          <Button onClick={() => setVoirFaites((v) => !v)} sx={{ minHeight: 48, mt: 1, ml: -1 }}>{voirFaites ? 'Masquer les actions faites' : `Actions faites (${faites.length})`}</Button>
          {voirFaites && <Box component="ul" aria-label={`${libelle} : faites`} sx={{ listStyle: 'none', m: 0, p: 0 }}>{faites.map(ligne)}</Box>}
        </>
      )}
    </>
  )
}
