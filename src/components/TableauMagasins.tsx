import { useApercu } from '../auth/Apercu'
import { Entete, LigneSansResultat, useTableau, type ColonneTri, type Tri } from './TableauTri'
import { BarreSelection, CaseEntete, CaseLigne, useSelection } from './Selection'
import { TacheEnSerie } from './TacheEnSerie'
import AddTaskOutlined from '@mui/icons-material/AddTaskOutlined'
import Snackbar from '@mui/material/Snackbar'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { Blason } from './Blason'
import { Pastille } from './Social'
import { useCreer } from './Creer'
import { lienFiche } from '../lib/format'
import { libelleSuivi } from '../data/charge'
import { statutLibelle, type Magasin, type Reseau } from '../data/modele'
import { analyser, formatKEuros, formatPourcent, libelleMois } from '../data/chiffres'
import { caExterieurAnnee } from '../data/exterieur'
import { caseDe, visitesParAn } from '../data/sante'
import { actionsEnCours } from '../data/actions'
import { anneeDe, suiviRythme } from '../data/visites'
import { useReseau } from '../data/ReseauContext'
import type { TriMagasins } from './ListeMagasins'

// Liste des magasins sur PC en vrai tableau (refonte, Joseph 09/11/2026, choix 5A) : lignes de 44 px, colonnes triables,
// une ligne cliquée ouvre l'aperçu à droite sans quitter la liste ; le nom ouvre la fiche. Le téléphone garde ses lignes.
interface Infos { ext: number | null; ca: number | null; mois: string | null; ecart: number | null; caseLibelle: string; rang: number; depuis: number | null; alerteVisite: boolean; taches: number; alerte: 'decroche' | 'surveiller' | null }

function infosDe(reseau: Reseau | null): Map<string, Infos> {
  const res = new Map<string, Infos>()
  if (!reseau) return res
  const rythme = new Map(suiviRythme(reseau, anneeDe(reseau.jour)).map((l) => [l.magasin.nom, l]))
  const taches = new Map<string, number>()
  for (const x of actionsEnCours(reseau, null)) taches.set(x.magasin, (taches.get(x.magasin) ?? 0) + 1)
  for (const m of reseau.magasins) {
    const a = analyser(reseau, m.nom)
    const c = caseDe(reseau.evaluations[m.nom])
    const l = rythme.get(m.nom)
    res.set(m.nom, {
      ext: caExterieurAnnee(reseau, m.nom, reseau.jour.slice(0, 4)), ca: a?.ca ?? null, mois: a?.mois ?? null, ecart: a?.ecart ?? null, caseLibelle: c?.libelle ?? '', rang: c ? visitesParAn(c) : 0,
      depuis: l?.derniere ? l.depuis ?? 0 : null, alerteVisite: !!l?.alerte, taches: taches.get(m.nom) ?? 0,
      alerte: a?.statut === 'decroche' || a?.statut === 'surveiller' ? a.statut : null,
    })
  }
  return res
}

// Harmonisation des tableaux (Joseph, 10/11/2026) : chaque colonne se trie et se filtre. Les tris historiques
// (magasin, évolution, nine box, dernière visite, tâches) restent dans l'adresse, comme sur téléphone.
const TRIS_ADRESSE: Record<TriMagasins, { cle: string; sens: 'asc' | 'desc' }> = {
  nom: { cle: 'nom', sens: 'asc' }, ca: { cle: 'ecart', sens: 'asc' }, case: { cle: 'case', sens: 'desc' }, visite: { cle: 'visite', sens: 'desc' }, taches: { cle: 'taches', sens: 'desc' },
}
const colonnesDe = (infos: Map<string, Infos>): ColonneTri<Magasin>[] => [
  { cle: 'nom', libelle: 'magasin', valeur: (m) => m.nom },
  { cle: 'coach', libelle: 'Coach', valeur: (m) => libelleSuivi(m) || null },
  { cle: 'rr', libelle: 'Responsable Régional', valeur: (m) => m.rr?.nom ?? null },
  { cle: 'mois', libelle: 'CA du mois', valeur: (m) => infos.get(m.nom)?.ca ?? null, nombre: (m) => { const c = infos.get(m.nom)?.ca; return c == null ? null : c / 1000 }, unite: 'k€' },
  { cle: 'ext', libelle: 'CA extérieur de l’année', valeur: (m) => infos.get(m.nom)?.ext ?? null, nombre: (m) => { const c = infos.get(m.nom)?.ext; return c == null ? null : c / 1000 }, unite: 'k€', premier: 'desc' },
  { cle: 'ecart', libelle: 'évolution du CA', valeur: (m) => infos.get(m.nom)?.ecart ?? null, premier: 'asc', unite: '%' },
  { cle: 'case', libelle: 'nine box', valeur: (m) => infos.get(m.nom)?.rang ?? 0, texte: (m) => infos.get(m.nom)?.caseLibelle || 'Non classé', filtre: 'liste', premier: 'desc' },
  { cle: 'visite', libelle: 'dernière visite', valeur: (m) => infos.get(m.nom)?.depuis ?? Infinity, nombre: (m) => infos.get(m.nom)?.depuis ?? null, unite: 'jours', premier: 'desc' },
  { cle: 'taches', libelle: 'tâches', valeur: (m) => infos.get(m.nom)?.taches ?? 0 },
]

const PAS = 100

// Favoris et fiches consultées récemment : une rangée de liens au-dessus du tableau, comme les lignes du téléphone
export function MagasinsSuivis({ suivis }: { suivis?: { favoris: Magasin[]; recents: Magasin[] } }) {
  const groupes = suivis ? [{ titre: 'Favoris', ms: suivis.favoris }, { titre: 'Consultés récemment', ms: suivis.recents }].filter((g) => g.ms.length) : []
  if (!groupes.length) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 4, rowGap: 1, mb: 1.5 }}>
      {groupes.map((g) => (
        <Box key={g.titre} component="section" aria-label={g.titre} sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.5 }}>
          <Typography component="h2" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.875rem' }}>{g.titre}</Typography>
          {g.ms.map((m) => (
            <Link key={m.nom} component={RouterLink} to={lienFiche(m.nom)} color="inherit" underline="hover"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minHeight: 36, fontWeight: 600, fontSize: '0.875rem' }}>
              <Blason magasin={m} taille={22} />{m.nom}
            </Link>
          ))}
        </Box>
      ))}
    </Box>
  )
}

export function TableauMagasins({ magasins, tri, trier }: { magasins: Magasin[]; tri: TriMagasins; trier: (t: TriMagasins) => void }) {
  const { reseau } = useReseau()
  const naviguer = useNavigate()
  const infos = useMemo(() => infosDe(reseau), [reseau])
  const [choisi, setChoisi] = useState<string | null>(null)
  const [nb, setNb] = useState(PAS)
  const colonnes = useMemo(() => colonnesDe(infos), [infos])
  const legacy = TRIS_ADRESSE[tri] ?? TRIS_ADRESSE.nom
  const [triLibre, setTriLibre] = useState<Tri>(null)
  const triCourant = triLibre ?? legacy
  const t = useTableau(magasins, colonnes, {
    tri: TRIS_ADRESSE.nom, memoire: 'magasins',
    controle: { tri: triCourant, changer: (x) => {
      const v = (Object.keys(TRIS_ADRESSE) as TriMagasins[]).find((k) => x && TRIS_ADRESSE[k].cle === x.cle && TRIS_ADRESSE[k].sens === x.sens)
      setTriLibre(v ? null : x ?? TRIS_ADRESSE.nom)
      trier(v ?? 'nom')
    } },
  })
  const tries = t.lignes
  const visibles = tries.slice(0, nb)
  const apercu = choisi ? magasins.find((m) => m.nom === choisi) ?? null : null
  // Totaux en pied : CA du mois des magasins affichés et écart pondéré face à l'an dernier
  const total = useMemo(() => {
    let ca = 0, ref = 0, n = 0
    for (const m of tries) {
      const x = infos.get(m.nom)
      if (x?.ca === null || x?.ca === undefined) continue
      ca += x.ca; n++
      if (x.ecart !== null) ref += x.ca / (1 + x.ecart / 100)
    }
    const ext = tries.reduce((a, m) => a + (infos.get(m.nom)?.ext ?? 0), 0)
    return { ca: n ? ca : null, ecart: ref ? ((ca - ref) / ref) * 100 : null, ext }
  }, [tries, infos])
  const ouvrir = (nom: string) => setChoisi((c) => (c === nom ? null : nom))
  // Refonte vague 2 (16A) : cocher plusieurs magasins et leur créer une même tâche
  const { apercu: voirComme, equipe: voirEquipe } = useApercu()
  const avecSelection = !voirComme && !voirEquipe
  const cles = useMemo(() => tries.map((m) => m.nom), [tries])
  const sel = useSelection(cles)
  const [tacheSerie, setTacheSerie] = useState(false)
  const [message, setMessage] = useState('')
  const clavier = (e: KeyboardEvent, nom: string) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(nom) } }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: apercu ? 'minmax(0, 1fr) 320px' : 'minmax(0, 1fr)', gap: 2, alignItems: 'start' }}>
      <Card component="section" aria-label="Liste des magasins" sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small" aria-label="Tableau des magasins" sx={{ '& td, & th': { py: 0.75, px: 1.5, fontSize: '0.875rem' }, '& tbody tr': { height: 44, cursor: 'pointer' }, '& tbody tr:hover': { bgcolor: 'action.hover' } }}>
            <TableHead>
              <TableRow>
                {avecSelection && <TableCell padding="checkbox" sx={{ width: 44, '&&': { pl: 1.5, pr: 0 } }}><CaseEntete s={sel} /></TableCell>}
                <Entete t={t} cle="nom" sx={{ minWidth: 200 }}>Magasin</Entete>
                <Entete t={t} cle="coach">Coach</Entete>
                <Entete t={t} cle="rr" sx={{ width: 150 }}>Responsable Régional</Entete>
                <Entete t={t} cle="mois" align="right" sx={{ width: 104 }}>CA du mois</Entete>
                <Entete t={t} cle="ecart" align="right" sx={{ width: 88 }}>vs N-1</Entete>
                <Entete t={t} cle="ext" align="right" sx={{ width: 104 }}>Extérieur</Entete>
                <Entete t={t} cle="case" sx={{ width: 150 }}>Nine box</Entete>
                <Entete t={t} cle="visite" align="right" sx={{ width: 112 }}>Dernière visite</Entete>
                <Entete t={t} cle="taches" align="right" sx={{ width: 76 }}>Tâches</Entete>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibles.map((m) => {
                const x = infos.get(m.nom)
                const actif = choisi === m.nom
                return (
                  <TableRow key={m.nom} selected={actif} hover tabIndex={0} aria-selected={actif} onClick={() => ouvrir(m.nom)} onDoubleClick={() => naviguer(lienFiche(m.nom))} onKeyDown={(e) => clavier(e, m.nom)}>
                    {avecSelection && <TableCell padding="checkbox" sx={{ '&&': { pl: 1.5, pr: 0 } }}><CaseLigne s={sel} cle={m.nom} nom={m.nom} /></TableCell>}
                    <TableCell sx={{ minWidth: 200 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', columnGap: 1.25, rowGap: 0.25, flexWrap: 'wrap' }}>
                        <Blason magasin={m} taille={28} />
                        <Link component={RouterLink} to={lienFiche(m.nom)} color="inherit" underline="hover" onClick={(e) => e.stopPropagation()} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{m.nom}</Link>
                        {x?.alerte === 'decroche' && <Pastille ton="rouge">Décroche</Pastille>}
                        {x?.alerte === 'surveiller' && <Pastille ton="orange">À surveiller</Pastille>}
                        {m.statut !== 'ouvert' && <Pastille ton={m.statut === 'nouveau' ? 'bleu' : 'gris'}>{statutLibelle[m.statut]}</Pastille>}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{libelleSuivi(m) || '—'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{m.rr?.nom ?? '—'}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{x?.ca !== null && x?.ca !== undefined ? formatKEuros(x.ca) : '—'}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: x?.ecart === null || x?.ecart === undefined ? 'text.secondary' : x.ecart <= -5 ? 'error.main' : x.ecart < 0 ? 'warning.dark' : 'success.dark' }}>
                      {x?.ecart === null || x?.ecart === undefined ? '—' : formatPourcent(x.ecart)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: x?.ext ? 'text.primary' : 'text.secondary' }}>{x?.ext ? formatKEuros(x.ext) : '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: x?.caseLibelle ? 'text.primary' : 'text.secondary' }}>{x?.caseLibelle || 'Non classé'}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: x?.alerteVisite ? 'warning.dark' : 'text.secondary', fontWeight: x?.alerteVisite ? 600 : 400 }}>
                      {x?.depuis === null || x?.depuis === undefined ? 'jamais' : `il y a ${x.depuis} j`}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{x?.taches || ''}</TableCell>
                  </TableRow>
                )
              })}
              <LigneSansResultat t={t} colSpan={avecSelection ? 10 : 9} quoi="Aucun magasin ne correspond" />
              <TableRow sx={{ '&&': { cursor: 'default', height: 44 }, '&&:hover': { bgcolor: 'transparent' }, '& td': { borderBottom: 0, fontWeight: 700 } }}>
                <TableCell colSpan={avecSelection ? 4 : 3} sx={{ color: 'text.secondary' }}>{tries.length < magasins.length ? `${tries.length} sur ${magasins.length} magasins` : `${magasins.length} magasin${magasins.length > 1 ? 's' : ''}`}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatKEuros(total.ca)}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{total.ecart === null ? '—' : formatPourcent(total.ecart)}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{total.ext ? formatKEuros(total.ext) : '—'}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        {nb < tries.length && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button variant="outlined" onClick={() => setNb(nb + PAS)}>Afficher {Math.min(PAS, tries.length - nb)} magasins de plus</Button>
          </Box>
        )}
        <BarreSelection s={sel} quoi="magasin">
          <Button variant="outlined" startIcon={<AddTaskOutlined />} onClick={() => setTacheSerie(true)}>Ajouter une tâche à chacun</Button>
        </BarreSelection>
      </Card>
      {tacheSerie && <TacheEnSerie magasins={sel.liste} onFermer={(msg) => { setTacheSerie(false); if (msg) { setMessage(msg); sel.vider() } }} />}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
      {apercu && <Apercu m={apercu} infos={infos.get(apercu.nom)} fermer={() => setChoisi(null)} />}
    </Box>
  )
}

// Aperçu d'un magasin à droite du tableau : l'essentiel et les actions courantes, sans quitter la liste
function Apercu({ m, infos, fermer }: { m: Magasin; infos: Infos | undefined; fermer: () => void }) {
  const creer = useCreer()
  const naviguer = useNavigate()
  const ligne = (libelle: string, valeur: string, couleur?: string) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: couleur, textAlign: 'right' }}>{valeur}</Typography>
    </Box>
  )
  const ecart = infos?.ecart ?? null
  return (
    <Card component="aside" aria-label={`Aperçu de ${m.nom}`} sx={{ p: 2, position: 'sticky', top: 16, display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Blason magasin={m} taille={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h3" component="h2" sx={{ fontSize: '1.125rem' }} noWrap>{m.nom}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>{[m.franchise ? 'Franchisé' : 'Intégré', m.ville].filter(Boolean).join(' · ')}</Typography>
        </Box>
        <Tooltip title="Fermer l’aperçu"><IconButton onClick={fermer} aria-label="Fermer l’aperçu" sx={{ width: 40, height: 40 }}><CloseOutlined /></IconButton></Tooltip>
      </Box>
      <Box>
        {ligne(infos?.mois ? `CA de ${libelleMois(infos.mois)}` : 'CA du mois', formatKEuros(infos?.ca ?? null))}
        {ligne('Évolution vs N-1', ecart === null ? '—' : formatPourcent(ecart), ecart === null ? undefined : ecart <= -5 ? 'error.main' : ecart < 0 ? 'warning.dark' : 'success.dark')}
        {ligne('Nine box', infos?.caseLibelle || 'Non classé')}
        {ligne('Dernière visite', infos?.depuis === null || infos?.depuis === undefined ? 'jamais' : `il y a ${infos.depuis} j`, infos?.alerteVisite ? 'warning.dark' : undefined)}
        {ligne('Tâches en cours', String(infos?.taches ?? 0))}
        {ligne('Coach', libelleSuivi(m) || '—')}
        {ligne('Responsable Régional', m.rr?.nom ?? '—')}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={() => naviguer(lienFiche(m.nom))}>Ouvrir la fiche</Button>
        <Button variant="outlined" onClick={() => creer('visite', m.nom)}>Visite</Button>
        <Button variant="outlined" onClick={() => creer('tache', m.nom)}>Tâche</Button>
      </Box>
    </Card>
  )
}
