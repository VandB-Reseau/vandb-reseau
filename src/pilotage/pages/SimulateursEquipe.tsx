import { useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { PageHeader } from '../../components/PageHeader'
import { useAuth as useAuthReseau } from '../../auth/AuthContext'
import { useReseau } from '../../data/ReseauContext'
import { lireVue, magasinsDu } from '../../data/perimetre'
import { optionsPerimetre } from '../../data/perimetreChoisi'
import { lienFiche } from '../../lib/format'
import { useAuth } from '../auth/AuthContext'
import { Aide } from '../components/Aide'
import { ChampMontant } from '../components/ChampMontant'
import { ChampTaux } from '../components/ChampTaux'
import { EtatVide } from '../components/EtatVide'
import { Indicateur } from '../components/Indicateur'
import { Panne } from '../components/Panne'
import { Simulateurs, type AjoutBudget } from '../components/Simulateurs'
import { anneeBudget, chargerBudgets, chargerParametres, departTresorerie, enregistrerAjustements, hypothesesDe, parametresDuBudget, type DonneesBudgets } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { montant, tauxCourt as taux } from '../lib/format'
import { calculerBudget } from '../moteur/budget'
import { appliquerLevier, type Levier } from '../moteur/simulateurs'
import type { Cibles } from '../moteur/cibles'
import type { ParametresReseau } from '../moteur/types'

// Simulateurs de l'équipe (choix 157 et 158, Joseph 14/11/2026) : une entrée du menu sous le Budget prévisionnel.
// « Un magasin » : les simulateurs du magasin choisi (le dernier utilisé est retenu sur l'appareil), sans passer par sa
// fiche. « Plusieurs magasins » : un levier qui s'additionne (vente additionnelle, panier, tickets, prix) appliqué au budget
// de chaque magasin d'une sélection, d'une région ou du périmètre, avec le total. Rien n'est enregistré ; jamais montré
// au franchisé (comparaisons du réseau).

const CLE_MAGASIN = 'vandb-simulateurs-magasin'
const lireDernier = () => { try { return localStorage.getItem(CLE_MAGASIN) } catch { return null } }
const ecrireDernier = (nom: string) => { try { localStorage.setItem(CLE_MAGASIN, nom) } catch { /* stockage indisponible */ } }
const bouton = { sx: { width: 48, height: 48 } }
const champ = { '& .MuiInputBase-root': { minHeight: 48 }, '& input': { height: 48, boxSizing: 'border-box' } }
const entier = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v)).replace(/[  ]/g, ' ')
const unChiffre = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)
// Un champ avec son libellé visible au-dessus
const Champ = ({ libelle, children }: { libelle: string; children: ReactNode }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
    <Typography component="span" sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>{libelle}</Typography>
    {children}
  </Box>
)

export function SimulateursEquipe() {
  const [params, setParams] = useSearchParams()
  const mode = params.get('mode') === 'plusieurs' ? 'plusieurs' : 'magasin'
  const changerMode = (m: string) => setParams((x) => { const n = new URLSearchParams(x); n.set('mode', m); n.delete('sim'); return n }, { replace: true })
  const annee = anneeBudget()
  const { reseau } = useReseau()
  const { donnees, erreur, chargement, recharger } = useChargement(
    () => Promise.all([chargerBudgets(annee), chargerParametres(annee)]).then(([d, p]) => ({ d, parametres: p.parametres })), [annee])
  // Magasins de l'équipe : ceux du réseau (périmètre du compte), ouverts ou en travaux, hors projets
  const noms = useMemo(() => (reseau?.magasins ?? []).filter((m) => m.statut !== 'avenir').map((m) => m.nom).sort((a, b) => a.localeCompare(b, 'fr')), [reseau])

  return (
    <Box>
      <PageHeader titre="Simulateurs" />
      <Stack spacing={3}>
        <Box className="pas-a-l-impression" sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v: string | null) => v && changerMode(v)} aria-label="Simuler pour">
            <ToggleButton value="magasin" sx={{ minHeight: 48, px: 2 }}>Un magasin</ToggleButton>
            <ToggleButton value="plusieurs" sx={{ minHeight: 48, px: 2 }}>Plusieurs magasins</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {chargement && !donnees ? <Skeleton variant="rounded" height={240} />
          : erreur || !donnees ? <Panne quoi="Les budgets des magasins" recharger={recharger} />
          : !noms.length ? <EtatVide titre="Aucun magasin dans ton périmètre" texte="Les simulateurs s’ouvrent sur les magasins qui te sont rattachés. Le Directeur de réseau peut les rattacher depuis ta fiche." />
          : mode === 'magasin'
            ? <UnMagasin noms={noms} d={donnees.d} parametres={donnees.parametres} annee={annee} recharger={recharger} />
            : <PlusieursMagasins noms={noms} d={donnees.d} parametres={donnees.parametres} annee={annee} />}
      </Stack>
    </Box>
  )
}

function UnMagasin({ noms, d, parametres, annee, recharger }: { noms: string[]; d: DonneesBudgets; parametres: ParametresReseau; annee: number; recharger: () => void }) {
  const { profil } = useAuth()
  const [nom, setNom] = useState<string>(() => { const x = lireDernier(); return x && noms.includes(x) ? x : noms[0] })
  const choisir = (m: string | null) => { if (m) { setNom(m); ecrireDernier(m) } }
  const ligne = d.magasins.find((l) => l.magasin === nom) ?? null
  const p = parametresDuBudget(ligne, parametres)
  const resolu = ligne ? hypothesesDe(ligne, d) : null
  const b = resolu ? calculerBudget(resolu.hypotheses, p) : null
  const depart = ligne ? departTresorerie(ligne, d, p) ?? 0 : 0
  const peutAjuster = profil?.role === 'directeur' && !profil.apercu && !!ligne?.base && ligne.statut !== 'valide'
  // Comme dans la fiche : une soirée ou un investissement ajouté au budget, à la suite de ce qui y est déjà
  const mettreAuBudget = async (ajout: AjoutBudget) => {
    if (!ligne || !resolu) return
    const h0 = resolu.hypotheses
    const c: Cibles = { ...ligne.ajustements }
    if (ajout.tempsForts) c.tempsForts = [...(h0.tempsForts ?? []), ...ajout.tempsForts]
    if (ajout.investissements) c.investissements = [...(h0.investissements ?? []), ...ajout.investissements]
    if (ajout.emprunts) c.emprunts = [...(h0.emprunts ?? []), ...ajout.emprunts]
    if (ajout.ajustementsCA) c.ajustementsCA = [...(h0.ajustementsCA ?? []), ...ajout.ajustementsCA]
    const h = hypothesesDe(ligne, d, c)
    if (!h) throw new Error('budget')
    await enregistrerAjustements(ligne.magasin, annee, c, h.hypotheses)
    recharger()
  }
  return (
    <Stack spacing={3}>
      <Box className="pas-a-l-impression" sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Autocomplete options={noms} value={nom} disableClearable onChange={(_, m) => choisir(m)}
          openText="Ouvrir la liste" closeText="Fermer la liste" noOptionsText="Aucun magasin de ce nom"
          slotProps={{ popupIndicator: bouton }} sx={{ minWidth: 260, flex: '1 1 260px', maxWidth: 400 }}
          renderInput={(x) => <TextField {...x} label="Magasin" sx={{ '& .MuiInputBase-root': { py: 0 }, '& input': { height: 48, boxSizing: 'border-box' } }} />} />
        <Button component={RouterLink} to={lienFiche(nom)} startIcon={<StorefrontOutlined />} sx={{ minHeight: 48 }}>Fiche du magasin</Button>
      </Box>
      <Simulateurs key={`simulateurs-${nom}`} magasin={nom} budget={b} hypotheses={resolu?.hypotheses ?? null} parametres={p} depart={depart}
        peutGarder={!!profil && profil.role !== 'aucun' && !profil.apercu} budgetValide={ligne?.statut === 'valide'}
        mettreAuBudget={peutAjuster && resolu ? mettreAuBudget : null} />
    </Stack>
  )
}

type TypeLevier = Levier['type']
const LEVIERS: [TypeLevier, string][] = [['vente', 'Vente additionnelle'], ['panier', 'Panier moyen'], ['tickets', 'Tickets'], ['prix', 'Prix']]

function PlusieursMagasins({ noms, d, parametres, annee }: { noms: string[]; d: DonneesBudgets; parametres: ParametresReseau; annee: number }) {
  const { profil: profilReseau } = useAuthReseau()
  const { reseau } = useReseau()
  const options = reseau ? optionsPerimetre(reseau, profilReseau) : []
  const [choix, setChoix] = useState<string>('tout')
  const [liste, setListe] = useState<string[]>([])
  const [type, setType] = useState<TypeLevier>('vente')
  const [univers, setUnivers] = useState<'cave' | 'bar'>('cave')
  const [unSur, setUnSur] = useState(10)
  const [prixTTC, setPrixTTC] = useState(8)
  const [euros, setEuros] = useState(1)
  const [tauxL, setTauxL] = useState(0.02)

  const selection = choix === 'tout' ? noms
    : choix === 'liste' ? liste
    : reseau ? magasinsDu(reseau, lireVue(choix)).map((m) => m.nom).filter((m) => noms.includes(m)) : []
  const levier: Levier = type === 'vente' ? { type, univers, unSur, prixTTC } : type === 'panier' ? { type, univers, euros } : { type, univers, taux: tauxL }
  const lignes = selection.map((nom) => {
    const l = d.magasins.find((x) => x.magasin === nom)
    const h = l ? hypothesesDe(l, d) : null
    if (!l || !h) return { nom, effet: null }
    const p = parametresDuBudget(l, parametres)
    return { nom, effet: appliquerLevier(calculerBudget(h.hypotheses, p), p, levier) }
  })
  const comptes = lignes.filter((l) => l.effet !== null) as { nom: string; effet: NonNullable<ReturnType<typeof appliquerLevier>> }[]
  const sansBudget = lignes.filter((l) => l.effet === null).map((l) => l.nom)
  const total = (k: 'ca' | 'marge' | 'ebe' | 'redevance' | 'caAvant' | 'ebeAvant') => comptes.reduce((a, l) => a + l.effet[k], 0)
  const option = options.find((o) => o.cle === choix)
  const qui = choix === 'tout' ? (profilReseau?.role === 'directeur' ? 'tous les magasins du réseau' : 'tous mes magasins')
    : choix === 'liste' ? `ces ${liste.length} magasins`
    : option?.libelle.startsWith('Région ') ? `les magasins de la région ${option.libelle.slice(7)}` : option ? `les ${option.libelle.charAt(0).toLowerCase()}${option.libelle.slice(1)}` : ''
  const uLib = univers === 'cave' ? 'en cave' : 'au bar'
  const description = type === 'vente' ? `vendent un article à ${montant(prixTTC)} TTC à 1 client sur ${unSur} ${uLib}`
    : type === 'panier' ? `gagnent ${montant(euros)} TTC de panier moyen ${uLib}` : type === 'tickets' ? `font ${taux(tauxL)} de tickets en plus ${uLib}` : `relèvent leurs prix ${uLib} de ${taux(tauxL)}`
  const articlesJour = type === 'vente' && comptes.length ? comptes.reduce((a, l) => a + (l.effet.articlesParJour ?? 0), 0) / comptes.length : null
  const phrase = comptes.length ? `Si ${qui} ${description} : ${montant(total('ca'))} de CA HT et ${montant(total('ebe'))} d’EBE en plus sur ${comptes.length} magasin${comptes.length > 1 ? 's' : ''} en ${annee}${articlesJour !== null ? `, soit ${unChiffre(articlesJour)} article${articlesJour >= 2 ? 's' : ''} par jour et par magasin` : ''}.` : ''

  return (
    <Stack spacing={3}>
      <Card sx={{ p: { xs: 2, md: 3 }, borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="h2">Un levier sur plusieurs magasins</Typography>
          <Aide sujet="simReseau" />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField select size="small" label="Magasins" value={choix} onChange={(e) => setChoix(e.target.value)} sx={{ ...champ, minWidth: 240 }}>
            <MenuItem value="tout">{profilReseau?.role === 'directeur' ? 'Tout le réseau' : 'Tout mon périmètre'}</MenuItem>
            {options.filter((o) => o.cle !== 'reseau').map((o) => <MenuItem key={o.cle} value={o.cle} sx={{ pl: o.niveau ? 4 : 2 }}>{o.libelle}</MenuItem>)}
            <MenuItem value="liste">Choisir les magasins</MenuItem>
          </TextField>
          {choix === 'liste' && (
            <Autocomplete multiple options={noms} value={liste} onChange={(_, v) => setListe(v)} disableCloseOnSelect limitTags={4}
              openText="Ouvrir la liste" closeText="Fermer la liste" clearText="Effacer" noOptionsText="Aucun magasin de ce nom"
              slotProps={{ popupIndicator: bouton, clearIndicator: bouton }} sx={{ minWidth: 280, flex: '1 1 320px' }}
              renderInput={(x) => <TextField {...x} label="Magasins choisis" sx={{ '& .MuiInputBase-root': { minHeight: 48 } }} />} />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <ToggleButtonGroup exclusive size="small" value={type} onChange={(_, v: TypeLevier | null) => v && setType(v)} aria-label="Levier" sx={{ flexWrap: 'wrap' }}>
            {LEVIERS.map(([v, l]) => <ToggleButton key={v} value={v} sx={{ minHeight: 48, px: 2 }}>{l}</ToggleButton>)}
          </ToggleButtonGroup>
          <ToggleButtonGroup exclusive size="small" value={univers} onChange={(_, v: 'cave' | 'bar' | null) => v && setUnivers(v)} aria-label="Univers">
            <ToggleButton value="cave" sx={{ minHeight: 48, px: 2 }}>Cave</ToggleButton>
            <ToggleButton value="bar" sx={{ minHeight: 48, px: 2 }}>Bar</ToggleButton>
          </ToggleButtonGroup>
          {type === 'vente' && <>
            <Champ libelle="Un client sur"><ChampMontant libelle="Un client sur" valeur={unSur} onChange={(v) => setUnSur(Math.max(1, Math.round(v)))} unite="" largeur={130} /></Champ>
            <Champ libelle="Prix de l’article TTC"><ChampMontant libelle="Prix de l’article TTC" valeur={prixTTC} onChange={setPrixTTC} largeur={150} /></Champ>
          </>}
          {type === 'panier' && <Champ libelle="Panier en plus TTC"><ChampMontant libelle="Panier en plus TTC" valeur={euros} onChange={setEuros} largeur={150} /></Champ>}
          {(type === 'tickets' || type === 'prix') && <Champ libelle={type === 'tickets' ? 'Tickets en plus' : 'Hausse des prix'}><ChampTaux libelle={type === 'tickets' ? 'Tickets en plus' : 'Hausse des prix'} valeur={tauxL} onChange={(v) => setTauxL(v ?? 0)} largeur={140} pas={0.01} /></Champ>}
        </Box>
        {comptes.length > 0 && (
          <>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              <Indicateur libelle="CA HT en plus" valeur={montant(total('ca'))} detail={`${taux(total('caAvant') > 0 ? total('ca') / total('caAvant') : 0)} du CA budgété`} />
              <Indicateur libelle="EBE en plus" valeur={montant(total('ebe'))} detail={`${montant(total('ebe') / comptes.length)} par magasin en moyenne`} />
              <Indicateur libelle="Redevance et publicité en plus" valeur={montant(total('redevance'))} detail="pour le réseau" />
              {articlesJour !== null && <Indicateur libelle="Articles par jour" valeur={unChiffre(articlesJour)} detail="par magasin, en moyenne" />}
            </Box>
            <Typography role="status" sx={{ fontWeight: 600, fontSize: '1rem', maxWidth: '75ch' }}>{phrase}</Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Effet par magasin" sx={{ minWidth: 560, '& td, & th': { fontVariantNumeric: 'tabular-nums' } }}>
                <TableHead><TableRow>
                  <TableCell>Magasin</TableCell><TableCell align="right">CA HT budgété</TableCell><TableCell align="right">CA HT en plus</TableCell><TableCell align="right">EBE en plus</TableCell>
                  {type === 'vente' && <TableCell align="right">Articles par jour</TableCell>}
                </TableRow></TableHead>
                <TableBody>
                  {[...comptes].sort((a, b) => b.effet.ebe - a.effet.ebe).map((l) => (
                    <TableRow key={l.nom}>
                      <TableCell>{l.nom}</TableCell>
                      <TableCell align="right">{montant(l.effet.caAvant)}</TableCell>
                      <TableCell align="right">{montant(l.effet.ca)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{montant(l.effet.ebe)}</TableCell>
                      {type === 'vente' && <TableCell align="right">{l.effet.articlesParJour === null ? '–' : unChiffre(l.effet.articlesParJour)}</TableCell>}
                    </TableRow>
                  ))}
                  <TableRow sx={{ '& td': { fontWeight: 700 } }}>
                    <TableCell>Total, {comptes.length} magasin{comptes.length > 1 ? 's' : ''}</TableCell>
                    <TableCell align="right">{montant(total('caAvant'))}</TableCell>
                    <TableCell align="right">{montant(total('ca'))}</TableCell>
                    <TableCell align="right">{montant(total('ebe'))}</TableCell>
                    {type === 'vente' && <TableCell align="right">{articlesJour === null ? '–' : unChiffre(articlesJour)}</TableCell>}
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          </>
        )}
        {!selection.length && <EtatVide titre="Aucun magasin choisi" texte="Choisis une région, un Coach ou des magasins pour voir l’effet du levier." />}
        {selection.length > 0 && !comptes.length && <EtatVide titre={`Pas encore de budget ${annee} pour ces magasins`} texte="Le levier part du budget de chaque magasin (tickets, panier, marge). Il s’applique dès que le siège a proposé leur budget." />}
        {sansBudget.length > 0 && comptes.length > 0 && (
          <Typography color="text.secondary">Sans budget {annee} proposé, pas comptés : {sansBudget.join(', ')}.</Typography>
        )}
        {comptes.length > 0 && (
          <Box className="pas-a-l-impression">
            <Button variant="outlined" startIcon={<PictureAsPdfOutlined />} onClick={() => window.print()} sx={{ minHeight: 48 }}>PDF</Button>
          </Box>
        )}
      </Card>
      <Typography color="text.secondary" sx={{ fontSize: '0.875rem' }}>{entier(selection.length)} magasin{selection.length > 1 ? 's' : ''} dans la sélection. Rien n’est enregistré ni envoyé dans les budgets.</Typography>
    </Stack>
  )
}
