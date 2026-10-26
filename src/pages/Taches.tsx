// Tâches : actions attribuées à la personne connectée (son nom en porteur), à faire puis faites,
// avec qui les a faites et quand. Le Directeur peut ouvrir la liste d'un RR ou d'un Coach.
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Menu from '@mui/material/Menu'
import Typography from '@mui/material/Typography'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import { PageHeader } from '../components/PageHeader'
import { ChampRecherche } from '../components/Outils'
import { RechercheFiltres } from '../components/RechercheFiltres'
import { CarteLignes, TitreSection, cartouche } from '../components/Social'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { BoutonAjouterAction, DialogAction, LigneAction, useEcritureActions } from '../components/Actions'
import MenuItem from '@mui/material/MenuItem'
import ListSubheader from '@mui/material/ListSubheader'
import { useAuth } from '../auth/AuthContext'
import { useReseau } from '../data/ReseauContext'
import { actionsDes, echeanceDate, enRetard, monNomPorteur, portePar, porteursDe, porteursDu, type ActionSuivie } from '../data/actions'
import { magasinsDu, perimetreDuProfil } from '../data/perimetre'
import { libelleResponsable, type Reseau } from '../data/modele'
import { ErreurAction } from '../data/espaceFranchise'
import { useMarquerTachesVues } from '../data/tachesVues'

const FAITES_VISIBLES = 10

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')

// Tâches à faire rangées par échéance ; une échéance écrite en toutes lettres (« novembre ») va dans « Plus tard »
type Groupe = 'retard' | 'semaine' | 'tard' | 'sans'
const groupes: { g: Groupe; titre: string }[] = [
  { g: 'retard', titre: 'En retard' }, { g: 'semaine', titre: 'Cette semaine' }, { g: 'tard', titre: 'Plus tard' }, { g: 'sans', titre: 'Sans échéance' },
]
function groupeDe(x: ActionSuivie, jour: string, dansUneSemaine: string): Groupe {
  if (enRetard(x.a, jour)) return 'retard'
  const date = echeanceDate(x.a)
  if (date) return date <= dansUneSemaine ? 'semaine' : 'tard'
  return x.a.echeance?.trim() ? 'tard' : 'sans'
}
const plusSept = (jour: string) => { const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10) }

// Intertitre d'un groupe, à l'intérieur de la liste (pas une tâche)
function Intertitre({ titre, nombre }: { titre: string; nombre: number }) {
  return (
    <Box component="li" role="presentation" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1.5, pb: 0.5, bgcolor: 'action.hover' }}>
      <Typography component="h2" sx={cartouche}>{titre}</Typography><Box sx={{ flex: 1 }} />
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.secondary' }}>{nombre}</Typography>
    </Box>
  )
}

// Liste des tâches des franchisés des magasins affichés
const FRANCHISES = '@franchises'

// L'équipe passe de sa liste à celle des franchisés de ses magasins ; le Directeur ouvre aussi celle d'un RR ou d'un
// Coach (« Équipe »). Listes en puces visibles avec leur nombre de tâches à faire (sprint 27, S1)
function ChoixPorteur({ reseau, noms, moi, valeur, directeur, onChange }: { reseau: Reseau; noms: string[]; moi: string; valeur: string; directeur: boolean; onChange: (nom: string) => void }) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const n = (porteur: string) => aFaireDe(reseau, noms, porteur).length
  const coachs = reseau.equipe.filter((c) => !c.fictif).map((c) => c.nom)
  const membre = valeur !== moi && valeur !== FRANCHISES ? valeur : null
  const puce = (libelle: string, actif: boolean, onClick: (e: MouseEvent<HTMLElement>) => void, menu?: boolean) => (
    <Chip label={libelle} onClick={onClick} aria-pressed={actif} aria-haspopup={menu ? 'menu' : undefined} color={actif ? 'primary' : 'default'} variant={actif ? 'filled' : 'outlined'}
      sx={{ minHeight: 48, borderRadius: 999, fontWeight: 700, '& .MuiChip-label': { px: 2 } }} />
  )
  return (
    <Box role="group" aria-label="Liste de tâches" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
      {puce(`Mes tâches · ${n(moi)}`, valeur === moi, () => onChange(moi))}
      {puce(`Franchisés · ${n(FRANCHISES)}`, valeur === FRANCHISES, () => onChange(FRANCHISES))}
      {directeur && puce(membre ? `Équipe · ${membre}` : 'Équipe', !!membre, (e) => setAncre(e.currentTarget), true)}
      {directeur && (
        <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)}>
          <ListSubheader>Responsables Régionaux</ListSubheader>
          {reseau.rrs.map((r) => <MenuItem key={r.id} selected={valeur === r.nom} onClick={() => { setAncre(null); onChange(r.nom) }} sx={{ minHeight: 48 }}>{r.nom} · {n(r.nom)}</MenuItem>)}
          <ListSubheader>Coachs</ListSubheader>
          {coachs.map((c) => <MenuItem key={c} selected={valeur === c} onClick={() => { setAncre(null); onChange(c) }} sx={{ minHeight: 48 }}>{c} · {n(c)}</MenuItem>)}
        </Menu>
      )}
    </Box>
  )
}

// La tâche est-elle portée par un franchisé (ou un associé d'un intégré) de son magasin ?
function porteeParFranchise(reseau: Reseau, x: ActionSuivie, cache: Map<string, Set<string>>): boolean {
  if (!x.a.porteur) return false
  let noms = cache.get(x.magasin)
  if (!noms) {
    const m = reseau.magasins.find((y) => y.nom === x.magasin)
    noms = new Set(m ? porteursDu(reseau, x.magasin).filter((p) => p.role === libelleResponsable(m)).map((p) => p.nom) : [])
    noms.add('Franchisé').add('Associé').add('Responsable du magasin')
    cache.set(x.magasin, noms)
  }
  const ensemble = noms
  return porteursDe(x.a).some((n) => ensemble.has(n))
}

// Tâches à faire d'une liste (porteur, ou franchisés des magasins)
function tachesDe(reseau: Reseau, noms: string[], porteur: string): ActionSuivie[] {
  const cache = new Map<string, Set<string>>()
  return actionsDes(reseau, new Set(noms)).filter((x) => (porteur === FRANCHISES ? porteeParFranchise(reseau, x, cache) : portePar(x.a, porteur)))
}
const aFaireDe = (reseau: Reseau, noms: string[], porteur: string) => tachesDe(reseau, noms, porteur).filter((x) => !x.a.faite)

function Liste({ reseau, noms, porteur, signaler, choixPorteur, ajout, ajoutVide }: { reseau: Reseau; noms: string[]; porteur: string; signaler: (m: string) => void; choixPorteur?: ReactNode; ajout?: ReactNode; ajoutVide?: ReactNode }) {
  const { recharger } = useReseau()
  const ecriture = useEcritureActions(reseau)
  const [recherche, setRecherche] = useState('')
  const [magasin, setMagasin] = useState<string | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [toutesFaites, setToutesFaites] = useState(false)
  const [edition, setEdition] = useState<ActionSuivie | null>(null)
  const choix = magasin && noms.includes(magasin) ? magasin : null
  const q = sansAccents(recherche.trim())
  const actions = tachesDe(reseau, choix ? [choix] : noms, porteur)
    .filter((x) => !q || sansAccents(`${x.a.action} ${x.magasin} ${x.a.porteur ?? ''}`).includes(q))
  const aFaire = actions.filter((x) => !x.a.faite)
  const faites = actions.filter((x) => x.a.faite)
  const cocher = async (x: ActionSuivie, faite: boolean) => {
    setEnCours(x.cle)
    try {
      await ecriture.cocher(x, faite)
      await recharger()
      signaler(faite ? 'Tâche marquée faite.' : 'Tâche remise à faire.')
    } catch (e) { signaler(e instanceof ErreurAction ? e.message : 'La tâche n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.') }
    finally { setEnCours(null) }
  }
  const ligne = (x: ActionSuivie) => (
    <LigneAction key={x.cle} reseau={reseau} x={x} avecMagasin={!choix && noms.length > 1} avecPorteur={porteur === FRANCHISES} enCours={enCours === x.cle}
      cocher={ecriture.lectureSeule ? undefined : (f) => void cocher(x, f)}
      modifier={x.libre && !ecriture.franchise ? () => setEdition(x) : undefined} />
  )
  if (!noms.length) return <EmptyState icone={<TaskAltOutlined />} titre="Aucun magasin" texte="Aucun magasin n’est rattaché à ton accès pour le moment." />
  if (!porteur) return <EmptyState icone={<TaskAltOutlined />} titre="Aucune liste" texte="Ton nom n’est pas encore relié à ton accès. Contacte la direction du réseau." />
  const dansUneSemaine = plusSept(reseau.jour)
  const parGroupe = groupes.map((g) => ({ ...g, lignes: aFaire.filter((x) => groupeDe(x, reseau.jour, dansUneSemaine) === g.g) })).filter((g) => g.lignes.length)
  const filtreMagasin = noms.length > 1 && (noms.length <= 6
    ? (
      <Box role="group" aria-label="Magasins affichés" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip label="Tous" color={choix ? 'default' : 'primary'} variant={choix ? 'outlined' : 'filled'} onClick={() => setMagasin(null)} aria-pressed={!choix} sx={{ minHeight: 48 }} />
        {noms.map((n) => <Chip key={n} label={n} color={choix === n ? 'primary' : 'default'} variant={choix === n ? 'filled' : 'outlined'} onClick={() => setMagasin(n)} aria-pressed={choix === n} sx={{ minHeight: 48 }} />)}
      </Box>
    )
    : (
      <Autocomplete options={[...noms].sort((a, b) => a.localeCompare(b, 'fr'))} value={choix} onChange={(_e, v) => setMagasin(v)} sx={{ width: { xs: '100%', sm: 280 } }}
        renderInput={(params) => <TextField {...params} size="small" label="Magasin" placeholder="Tous les magasins" sx={{ '& .MuiInputBase-root': { minHeight: 48 } }} />} />
    ))
  return (
    <>
      {choixPorteur}
      <RechercheFiltres actifs={choix ? 1 : 0} actions={ajout}
        recherche={<ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Tâche, magasin, porteur" libelle="Rechercher une tâche" />}>
        {filtreMagasin || undefined}
      </RechercheFiltres>
      <Box sx={{ display: 'grid', gap: 2 }}>
        <CarteLignes label="À faire">
          {aFaire.length
            ? <Box component="ul" aria-label="Tâches à faire" sx={{ listStyle: 'none', m: 0, p: 0, '& > li:not([role=presentation])': { px: 1 } }}>
                {parGroupe.flatMap((g) => [<Intertitre key={g.g} titre={g.titre} nombre={g.lignes.length} />, ...g.lignes.map(ligne)])}
              </Box>
            : q || faites.length
              ? <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>{q ? 'Aucune tâche ne correspond à la recherche.' : 'Toutes tes tâches sont faites.'}</Typography>
              : <EmptyState icone={<TaskAltOutlined />} titre="Aucune tâche en cours" texte="Les tâches confiées à cette liste arriveront ici." action={ajoutVide} />}
        </CarteLignes>
        {faites.length > 0 && (
          <Box>
            <TitreSection nombre={faites.length}>Faites</TitreSection>
            <CarteLignes label="Faites">
              <Box component="ul" aria-label="Tâches faites" sx={{ listStyle: 'none', m: 0, p: 0, '& > li': { px: 1 } }}>{(toutesFaites ? faites : faites.slice(0, FAITES_VISIBLES)).map(ligne)}</Box>
              {faites.length > FAITES_VISIBLES && (
                <Button onClick={() => setToutesFaites((v) => !v)} sx={{ minHeight: 48, width: '100%' }}>{toutesFaites ? 'Voir moins' : `Voir les ${faites.length} tâches faites`}</Button>
              )}
            </CarteLignes>
          </Box>
        )}
      </Box>
      {edition && <DialogAction reseau={reseau} magasins={noms} action={edition} onFermer={(msg) => { setEdition(null); if (msg) signaler(msg) }} />}
    </>
  )
}

// Onglet Tâches (séparé des Messages, Joseph 22/10/2026) ; ouvrir sa propre liste remet le compteur de l'onglet à jour
export function PageTaches() {
  const { profil } = useAuth()
  const { reseau } = useReseau()
  const [params, setParams] = useSearchParams()
  const [message, setMessage] = useState('')
  const impose = perimetreDuProfil(profil)
  const franchise = !!reseau?.espace
  const moi = reseau ? monNomPorteur(reseau, profil) : ''
  // Franchisé : sa liste ; l'équipe ajoute celle des franchisés, le Directeur celle de chacun
  const choixPossible = !!reseau && !franchise && !!moi
  const demande = choixPossible ? params.get('de') : null
  const porteur = (demande && (!impose || demande === FRANCHISES) ? demande : '') || moi
  const changer = (nom: string) => setParams((x) => { const n = new URLSearchParams(x); if (nom === moi) n.delete('de'); else n.set('de', nom); return n }, { replace: true })
  useMarquerTachesVues(!!moi && porteur === moi)
  // Sans liste demandée : la sienne si elle a des tâches à faire, sinon celle des franchisés si elle en a (une seule fois)
  const choisi = useRef(false)
  useEffect(() => {
    if (choisi.current || !reseau || !choixPossible) return
    choisi.current = true
    if (params.get('de')) return
    const ns = (impose ? magasinsDu(reseau, impose) : reseau.magasins).map((m) => m.nom)
    if (!aFaireDe(reseau, ns, moi).length && aFaireDe(reseau, ns, FRANCHISES).length) changer(FRANCHISES)
  })
  const noms = reseau ? (impose ? magasinsDu(reseau, impose) : reseau.magasins).map((m) => m.nom).sort((a, b) => a.localeCompare(b, 'fr')) : []
  return (
    <>
      {(() => {
        const autre = !porteur || porteur === moi ? null : porteur === FRANCHISES ? 'Tâches des franchisés' : `Tâches de ${porteur}`
        return <PageHeader titre={autre ?? 'Tâches'} />
      })()}
      <AvecReseau>{(r) => (
        <Liste reseau={r} noms={noms} porteur={porteur} signaler={setMessage}
          choixPorteur={choixPossible ? <ChoixPorteur reseau={r} noms={noms} moi={moi} valeur={porteur} directeur={!impose} onChange={changer} /> : undefined}
          ajout={<BoutonAjouterAction barre reseau={r} magasins={noms} porteur={porteur === FRANCHISES ? '' : porteur} signaler={setMessage} />}
          ajoutVide={<BoutonAjouterAction plein libelle="Nouvelle tâche" reseau={r} magasins={noms} porteur={porteur === FRANCHISES ? '' : porteur} signaler={setMessage} />} />
      )}</AvecReseau>
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}
