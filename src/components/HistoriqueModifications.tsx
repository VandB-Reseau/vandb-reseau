import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Link from '@mui/material/Link'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import RestoreOutlined from '@mui/icons-material/RestoreOutlined'
import { ChampRecherche } from './Outils'
import { Puces, cartouche } from './Social'
import { useReseau } from '../data/ReseauContext'
import { useDroits } from '../auth/Droits'
import { horodatage } from '../data/messagerie'
import { plier } from '../data/compteRendu'
import { ErreurHistorique, chargerHistorique, lignesDe, nomAuteur, remettre, type LigneHistorique, type Modification } from '../data/historique'
import { lienFiche } from '../lib/format'
import type { Reseau } from '../data/modele'

type Filtre = 'tout' | 'suppressions'
const PAR_PAGE = 100

// Historique des modifications (sprint 26, F3) : Directeur seul, 90 derniers jours, remise d'une suppression
export function HistoriqueModifications({ reseau }: { reseau: Reseau }) {
  const { recharger } = useReseau()
  const { referentiels } = useDroits()
  const [modifs, setModifs] = useState<Modification[] | null | undefined>(undefined)
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tout')
  const [nombre, setNombre] = useState(PAR_PAGE)
  const [enCours, setEnCours] = useState('')
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')

  const charger = () => chargerHistorique().then(setModifs)
  useEffect(() => { charger() }, [])

  const lignes = useMemo(() => {
    const q = plier(recherche.trim())
    return (modifs ?? []).flatMap(lignesDe)
      .filter((l) => filtre === 'tout' || l.suppression)
      .filter((l) => !q || plier(`${l.modif.magasin} ${l.texte} ${nomAuteur(l.modif, reseau)}`).includes(q))
  }, [modifs, recherche, filtre, reseau])

  const remise = (l: LigneHistorique) => l.remettre?.genre === 'tache'
    ? (reseau.actionsLibres[l.modif.magasin] ?? []).some((x) => x.id === (l.remettre as { tache: { id: string } }).tache.id)
    : !!l.modif.remisLe
  const lancer = async (l: LigneHistorique) => {
    setEnCours(l.cle); setErreur('')
    try {
      await remettre(l, reseau)
      await Promise.all([recharger(), charger()])
      setMessage('Remis en place.')
    } catch (e) {
      setErreur(e instanceof ErreurHistorique ? e.message : 'La remise n’a pas abouti. Réessaie dans un instant.')
    } finally { setEnCours('') }
  }

  return (
    <Card component="section" aria-label="Historique des modifications" sx={{ mt: 2 }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography component="h2" sx={[cartouche, { mb: 1.5 }]}>Historique des modifications</Typography>
        {modifs === undefined && <Typography color="text.secondary">Chargement…</Typography>}
        {modifs === null && (
          <Alert severity="info">L’historique n’est pas encore activé dans la base : il démarrera dès que le script de l’historique aura été passé.</Alert>
        )}
        {modifs && (
          <>
            <Puces label="Modifications affichées" valeur={filtre} onChange={(v) => { setFiltre(v); setNombre(PAR_PAGE) }}
              options={[{ v: 'tout', libelle: 'Tout' }, { v: 'suppressions', libelle: 'Suppressions' }]} />
            <Box sx={{ mb: 1.5 }}>
              <ChampRecherche valeur={recherche} onChange={(v) => { setRecherche(v); setNombre(PAR_PAGE) }} placeholder="Magasin, personne, tâche…" libelle="Chercher dans l’historique" />
            </Box>
            {erreur && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setErreur('')}>{erreur}</Alert>}
            {!lignes.length ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>
                {modifs.length ? 'Aucune modification ne correspond à cette recherche.' : 'Aucune modification sur les 90 derniers jours.'}
              </Typography>
            ) : (
              <Box component="ul" aria-label="Modifications" sx={{ listStyle: 'none', p: 0, m: 0, '& > li + li': { borderTop: '1px solid', borderColor: 'divider' } }}>
                {lignes.slice(0, nombre).map((l) => (
                  <Box component="li" key={l.cle} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.9375rem' }}>
                        {l.modif.magasin && <><Link component={RouterLink} to={lienFiche(l.modif.magasin)} underline="hover" sx={{ fontWeight: 600, color: 'text.primary' }}>{l.modif.magasin}</Link> · </>}
                        <Box component="span" sx={{ color: l.suppression ? 'error.main' : undefined }}>{l.texte}</Box>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">{nomAuteur(l.modif, reseau)} · {horodatage(l.modif.le)}</Typography>
                    </Box>
                    {l.remettre && (remise(l)
                      ? <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>Remis</Typography>
                      : referentiels && (
                        <Button size="small" variant="outlined" startIcon={<RestoreOutlined />} disabled={!!enCours} onClick={() => lancer(l)}
                          aria-label={`Remettre : ${l.texte}${l.modif.magasin ? ` (${l.modif.magasin})` : ''}`} sx={{ flexShrink: 0, minHeight: 48 }}>
                          {enCours === l.cle ? 'Remise…' : 'Remettre'}
                        </Button>
                      ))}
                  </Box>
                ))}
              </Box>
            )}
            {lignes.length > nombre && (
              <Button onClick={() => setNombre((n) => n + PAR_PAGE)} sx={{ mt: 1, minHeight: 48 }}>Voir les suivantes ({lignes.length - nombre})</Button>
            )}
          </>
        )}
      </CardContent>
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </Card>
  )
}
