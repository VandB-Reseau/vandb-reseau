// Demandes des franchisés au siège (refonte vague 4, Joseph 10/11/2026, 37A). Équipe : guichet de ses magasins, filtré par
// statut, avec le délai médian de première réponse et les demandes ouvertes depuis plus de 5 jours. Franchisé : ses
// demandes, une nouvelle en trois champs, la conversation avec le siège.
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AddOutlined from '@mui/icons-material/AddOutlined'
import SupportAgentOutlined from '@mui/icons-material/SupportAgentOutlined'
import { PageHeader } from '../components/PageHeader'
import { NomMagasin, Personne } from '../components/Entites'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { Fenetre } from '../components/EditionEquipe'
import { Puces } from '../components/Social'
import { ChampRecherche } from '../components/Outils'
import { RechercheFiltres } from '../components/RechercheFiltres'
import { useAuth } from '../auth/AuthContext'
import { useApercu } from '../auth/Apercu'
import {
  aTraiterParLeSiege, completerDemande, creerDemande, delaiMedian, enAttenteLongue, libelleStatutDemande, libelleTheme, repondreDemande,
  themesDemande, useDemandes, useMesDemandes, type Demande, type StatutDemande, type ThemeDemande,
} from '../data/demandes'
import { dateHeure, dateRelative } from '../lib/format'
import type { Reseau } from '../data/modele'

const tonStatut: Record<StatutDemande, object> = {
  nouvelle: { bgcolor: 'rgba(194, 65, 25, 0.12)', color: 'error.dark' },
  en_cours: { bgcolor: 'rgba(248, 187, 9, 0.22)', color: 'text.primary' },
  attente: { bgcolor: 'action.hover', color: 'text.secondary' },
  resolue: { bgcolor: 'rgba(46, 125, 50, 0.12)', color: 'success.dark' },
}
export function PuceDemande({ statut }: { statut: StatutDemande }) {
  return <Chip size="small" label={libelleStatutDemande[statut]} sx={{ fontSize: 12, fontWeight: 700, borderRadius: 1, height: 24, ...tonStatut[statut] }} />
}

function FilEchanges({ d }: { d: Demande }) {
  if (!d.echanges.length) return <Typography variant="body2" color="text.secondary">Aucun message.</Typography>
  return (
    <Box component="ol" aria-label="Échanges" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
      {d.echanges.map((e, i) => (
        <Box component="li" key={i} sx={{ justifySelf: e.role === 'equipe' ? 'end' : 'start', maxWidth: '88%', p: 1.25, borderRadius: 2, bgcolor: e.role === 'equipe' ? 'rgba(248, 187, 9, 0.16)' : 'action.hover' }}>
          <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.texte}</Typography>
          <Typography variant="body2" color="text.secondary">{[e.par, dateHeure(e.le)].filter(Boolean).join(' · ')}</Typography>
        </Box>
      ))}
    </Box>
  )
}

const maintenant = (reseau: Reseau) => `${reseau.jour}T${new Date().toISOString().slice(11)}`

export function Demandes() {
  const { profil } = useAuth()
  return <AvecReseau>{(reseau) => (profil?.role === 'franchise' ? <DemandesFranchise reseau={reseau} /> : <DemandesEquipe reseau={reseau} />)}</AvecReseau>
}

type Filtre = 'traiter' | 'attente' | 'resolue' | 'toutes'
function DemandesEquipe({ reseau }: { reseau: Reseau }) {
  const voirComme = !!useApercu().equipe
  const { liste, recharger } = useDemandes()
  const [filtre, setFiltre] = useState<Filtre>('traiter')
  const [recherche, setRecherche] = useState('')
  const [ouverte, setOuverte] = useState<Demande | null>(null)
  const [message, setMessage] = useState('')
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  // Le réseau reçu suit déjà le périmètre choisi
  const noms = useMemo(() => new Set(reseau.magasins.map((m) => m.nom)), [reseau])
  const instant = maintenant(reseau)
  if (liste === undefined) return <><PageHeader titre="Demandes" /><Skeleton variant="rounded" height={240} /></>
  if (liste === null) return <><PageHeader titre="Demandes" /><EmptyState icone={<SupportAgentOutlined />} titre="Demandes pas encore activées" texte="Le guichet des demandes s’ouvrira dès que la base sera à jour." /></>
  const siennes = liste.filter((d) => noms.has(d.magasin))
  const comptes: Record<Filtre, number> = {
    traiter: siennes.filter(aTraiterParLeSiege).length, attente: siennes.filter((d) => d.statut === 'attente').length,
    resolue: siennes.filter((d) => d.statut === 'resolue').length, toutes: siennes.length,
  }
  const q = recherche.trim().toLowerCase()
  const visibles = siennes.filter((d) => (filtre === 'toutes' || (filtre === 'traiter' ? aTraiterParLeSiege(d) : d.statut === filtre))
    && (!q || `${d.titre} ${d.magasin} ${d.franchise} ${libelleTheme(d.theme)}`.toLowerCase().includes(q)))
  const median = delaiMedian(siennes)
  const longues = siennes.filter((d) => enAttenteLongue(d, instant)).length
  const interlocuteur = (d: Demande) => reseau.interlocuteursDemandes?.[d.theme] ?? ''
  return (
    <>
      <PageHeader titre="Demandes" sousTitre={[
        `${comptes.traiter} à traiter`,
        median === null ? null : `réponse en ${String(median).replace('.', ',')} j (médiane)`,
        longues ? `${longues} ouverte${longues > 1 ? 's' : ''} depuis plus de 5 jours` : null,
      ].filter(Boolean).join(' · ')} />
      <RechercheFiltres recherche={<ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Demande, magasin, franchisé" libelle="Rechercher une demande" />}>
        <Puces label="Statut des demandes" valeur={filtre} onChange={setFiltre} options={[
          { v: 'traiter', libelle: `À traiter · ${comptes.traiter}` }, { v: 'attente', libelle: `Attend le franchisé · ${comptes.attente}` },
          { v: 'resolue', libelle: `Résolues · ${comptes.resolue}` }, { v: 'toutes', libelle: `Toutes · ${comptes.toutes}` },
        ]} />
      </RechercheFiltres>
      {visibles.length === 0 ? (
        <EmptyState icone={<SupportAgentOutlined />} titre={filtre === 'traiter' ? 'Aucune demande à traiter' : 'Aucune demande'} texte={filtre === 'traiter' ? 'Les franchisés n’attendent rien du siège pour le moment.' : 'Aucune demande ne correspond.'} />
      ) : surPC ? (
        <TableContainer>
          <Table size="small" aria-label="Demandes des franchisés">
            <TableHead><TableRow><TableCell>Demande</TableCell><TableCell>Magasin</TableCell><TableCell>Thème</TableCell><TableCell>Interlocuteur</TableCell><TableCell>Ouverte</TableCell><TableCell>Statut</TableCell></TableRow></TableHead>
            <TableBody>
              {visibles.map((d) => (
                <TableRow key={d.id} hover onClick={() => setOuverte(d)} sx={{ cursor: 'pointer' }}>
                  <TableCell><Link component="button" onClick={(e) => { e.stopPropagation(); setOuverte(d) }} sx={{ fontWeight: 600, textAlign: 'left' }}>{d.titre}</Link></TableCell>
                  <TableCell><NomMagasin reseau={reseau} nom={d.magasin} /></TableCell>
                  <TableCell>{libelleTheme(d.theme)}</TableCell>
                  <TableCell>{interlocuteur(d) ? <Personne reseau={reseau} nom={interlocuteur(d)} /> : '—'}</TableCell>
                  <TableCell sx={{ color: enAttenteLongue(d, instant) ? 'error.main' : undefined, fontWeight: enAttenteLongue(d, instant) ? 700 : undefined }}>{dateRelative(d.ouverteLe, reseau.jour)}</TableCell>
                  <TableCell><PuceDemande statut={d.statut} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box component="ul" aria-label="Demandes des franchisés" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {visibles.map((d) => (
            <Box component="li" key={d.id} onClick={() => setOuverte(d)} sx={{ py: 1.25, minHeight: 48, borderBottom: '1px solid', borderColor: 'divider', cursor: 'pointer' }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}><Typography sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>{d.titre}</Typography><PuceDemande statut={d.statut} /></Box>
              <Typography variant="body2" color="text.secondary">{[d.magasin, libelleTheme(d.theme), dateRelative(d.ouverteLe, reseau.jour)].join(' · ')}</Typography>
            </Box>
          ))}
        </Box>
      )}
      {ouverte && <DialogRepondre d={ouverte} interlocuteur={interlocuteur(ouverte)} lecture={voirComme} onFermer={(m) => { setOuverte(null); if (m) { setMessage(m); void recharger() } }} />}
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

function DialogRepondre({ d, interlocuteur, lecture, onFermer }: { d: Demande; interlocuteur: string; lecture: boolean; onFermer: (m?: string) => void }) {
  const [texte, setTexte] = useState('')
  const [statut, setStatut] = useState<StatutDemande>(d.statut === 'nouvelle' ? 'en_cours' : d.statut)
  return (
    <Fenetre titre={d.titre} ouvert onFermer={onFermer} valide={!lecture && (!!texte.trim() || statut !== d.statut)} sansRechargement
      enregistrer={async () => { await repondreDemande(d.id, texte.trim(), statut); return statut === 'resolue' ? 'Demande résolue.' : 'Réponse envoyée.' }}>
      <Typography variant="body2" color="text.secondary">{[d.magasin, d.franchise, libelleTheme(d.theme), interlocuteur && `Interlocuteur : ${interlocuteur}`].filter(Boolean).join(' · ')}</Typography>
      <FilEchanges d={d} />
      {!lecture && <>
        <TextField label="Réponse au franchisé" value={texte} onChange={(e) => setTexte(e.target.value)} multiline minRows={3} slotProps={{ htmlInput: { maxLength: 5000 } }} />
        <TextField select label="Statut" value={statut} onChange={(e) => setStatut(e.target.value as StatutDemande)}>
          {(Object.keys(libelleStatutDemande) as StatutDemande[]).map((s) => <MenuItem key={s} value={s} sx={{ minHeight: 48 }}>{libelleStatutDemande[s]}</MenuItem>)}
        </TextField>
      </>}
    </Fenetre>
  )
}

function DemandesFranchise({ reseau }: { reseau: Reseau }) {
  const { apercu } = useApercu()
  const { liste, recharger } = useMesDemandes(apercu)
  const [nouvelle, setNouvelle] = useState(false)
  const [ouverte, setOuverte] = useState<Demande | null>(null)
  const [message, setMessage] = useState('')
  const magasins = reseau.magasins.filter((m) => m.statut !== 'avenir').map((m) => m.nom)
  const fermer = (m?: string) => { setNouvelle(false); setOuverte(null); if (m) { setMessage(m); void recharger() } }
  const bouton = !apercu && liste !== null ? <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setNouvelle(true)} sx={{ minHeight: 48 }}>Nouvelle demande</Button> : undefined
  return (
    <>
      <PageHeader titre="Mes demandes" actions={bouton} />
      {liste === undefined ? <Skeleton variant="rounded" height={200} />
        : liste === null ? <EmptyState icone={<SupportAgentOutlined />} titre="Demandes pas encore ouvertes" texte="Pour une question au siège, passe par ton Coach en attendant." />
        : liste.length === 0 ? <EmptyState icone={<SupportAgentOutlined />} titre="Aucune demande" texte="Une question pour les achats, les travaux, le marketing, la caisse ou le juridique ? Le siège te répond ici." action={bouton} />
        : (
          <Box component="ul" aria-label="Mes demandes" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {liste.map((d) => (
              <Box component="li" key={d.id} onClick={() => setOuverte(d)} sx={{ py: 1.25, minHeight: 48, borderBottom: '1px solid', borderColor: 'divider', cursor: 'pointer' }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}><Typography sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>{d.titre}</Typography><PuceDemande statut={d.statut} /></Box>
                <Typography variant="body2" color="text.secondary">{[magasins.length > 1 ? d.magasin : null, libelleTheme(d.theme), dateRelative(d.ouverteLe, reseau.jour)].filter(Boolean).join(' · ')}</Typography>
              </Box>
            ))}
          </Box>
        )}
      {nouvelle && <DialogNouvelleDemande magasins={magasins} onFermer={fermer} />}
      {ouverte && <DialogCompleter d={ouverte} lecture={!!apercu} onFermer={fermer} />}
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

function DialogNouvelleDemande({ magasins, onFermer }: { magasins: string[]; onFermer: (m?: string) => void }) {
  const [magasin, setMagasin] = useState(magasins[0] ?? '')
  const [theme, setTheme] = useState<ThemeDemande>('achats')
  const [titre, setTitre] = useState('')
  const [texte, setTexte] = useState('')
  return (
    <Fenetre titre="Nouvelle demande" ouvert onFermer={onFermer} valide={!!magasin && !!titre.trim()} sansRechargement
      enregistrer={async () => { await creerDemande(magasin, theme, titre.trim(), texte.trim()); return 'Demande envoyée au siège.' }}>
      {magasins.length > 1 && (
        <TextField select label="Magasin" value={magasin} onChange={(e) => setMagasin(e.target.value)}>
          {magasins.map((m) => <MenuItem key={m} value={m} sx={{ minHeight: 48 }}>{m}</MenuItem>)}
        </TextField>
      )}
      <TextField select label="Thème" value={theme} onChange={(e) => setTheme(e.target.value as ThemeDemande)}>
        {themesDemande.map((t) => <MenuItem key={t.v} value={t.v} sx={{ minHeight: 48 }}>{t.libelle}</MenuItem>)}
      </TextField>
      <TextField label="Ma demande en une ligne" value={titre} onChange={(e) => setTitre(e.target.value)} autoFocus slotProps={{ htmlInput: { maxLength: 200 } }} />
      <TextField label="Détails" value={texte} onChange={(e) => setTexte(e.target.value)} multiline minRows={3} slotProps={{ htmlInput: { maxLength: 5000 } }} />
    </Fenetre>
  )
}

function DialogCompleter({ d, lecture, onFermer }: { d: Demande; lecture: boolean; onFermer: (m?: string) => void }) {
  const [texte, setTexte] = useState('')
  return (
    <Fenetre titre={d.titre} ouvert onFermer={onFermer} valide={!lecture && !!texte.trim()} sansRechargement
      enregistrer={async () => { await completerDemande(d.id, texte.trim()); return 'Message envoyé au siège.' }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}><Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{libelleTheme(d.theme)}</Typography><PuceDemande statut={d.statut} /></Box>
      <FilEchanges d={d} />
      {!lecture && <TextField label={d.statut === 'resolue' ? 'Rouvrir avec un message' : 'Ajouter un message'} value={texte} onChange={(e) => setTexte(e.target.value)} multiline minRows={3} slotProps={{ htmlInput: { maxLength: 5000 } }} />}
    </Fenetre>
  )
}
