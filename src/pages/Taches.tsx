import ButtonBase from '@mui/material/ButtonBase'
import { styleBac, styleVue } from '../components/VuesRapides'
// Tâches : actions attribuées à la personne connectée (son nom en porteur), à faire puis faites,
// avec qui les a faites et quand. Le Directeur peut ouvrir la liste d'un RR ou d'un Coach.
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Popover from '@mui/material/Popover'
import { useMessageAnnulable } from '../components/Annulable'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import PersonOutlined from '@mui/icons-material/PersonOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import BlockOutlined from '@mui/icons-material/BlockOutlined'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import { Onglets, type Rubrique } from '../components/Onglets'
import Typography from '@mui/material/Typography'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import FlagOutlined from '@mui/icons-material/FlagOutlined'
import DoneAllOutlined from '@mui/icons-material/DoneAllOutlined'
import { Indicateur, grilleIndicateurs } from '../components/Indicateur'
import { PageHeader } from '../components/PageHeader'
import { ChampRecherche } from '../components/Outils'
import { RechercheFiltres } from '../components/RechercheFiltres'
import { CarteLignes, Puces, cartouche } from '../components/Social'
import Card from '@mui/material/Card'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { LigneVide, styleBloc, styleEnteteBloc } from '../components/Section'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { BoutonAjouterAction, DialogAction, LigneAction, useChangerStatut, useEcritureActions } from '../components/Actions'
import { useAuth } from '../auth/AuthContext'
import { useReseau } from '../data/ReseauContext'
import { actionsDes, echeanceDate, enRetard, monNomPorteur, portePar, porteursDe, porteursDu, type ActionSuivie } from '../data/actions'
import { magasinsDu, perimetreDuProfil } from '../data/perimetre'
import { libelleResponsable, type Reseau } from '../data/modele'
import { ErreurAction } from '../data/espaceFranchise'
import { useMarquerTachesVues } from '../data/tachesVues'

const FAITES_VISIBLES = 10

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')

// Regroupement des tâches à faire (vague 4, 32A) : par échéance (d'office), par magasin ou par personne
type Regroupement = 'echeance' | 'magasin' | 'personne' | 'priorite'

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
// 406 (Joseph, 24/11/2026) : par magasin ou par personne, une barre d'avancement (tâches faites sur l'ensemble)
function Intertitre({ titre, nombre, faites }: { titre: string; nombre: number; faites?: number }) {
  const total = nombre + (faites ?? 0)
  const part = faites != null && total ? faites / total : null
  return (
    <Box component="li" role="presentation" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1.5, pb: 0.5, bgcolor: 'action.hover' }}>
      <Typography component="h2" sx={cartouche}>{titre}</Typography><Box sx={{ flex: 1 }} />
      {part != null && (
        <Box role="img" aria-label={`${faites} faite${faites! > 1 ? 's' : ''} sur ${total}`} data-testid="avancement-groupe" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: { xs: 64, md: 120 }, height: 8, borderRadius: 4, bgcolor: 'divider', overflow: 'hidden' }}>
            <Box sx={{ width: `${Math.round(part * 100)}%`, height: '100%', bgcolor: 'success.main' }} />
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{Math.round(part * 100)} % faites</Typography>
        </Box>
      )}
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.secondary' }}>{nombre}</Typography>
    </Box>
  )
}

const moinsJours = (jour: string, n: number) => { const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10) }

// 406 (Joseph, 24/11/2026) : quatre cartes chiffrées en tête de liste ; les faites sur 30 jours comparées aux 30 jours d'avant
function CartesTaches({ reseau, aFaire, faites }: { reseau: Reseau; aFaire: ActionSuivie[]; faites: ActionSuivie[] }) {
  const j30 = moinsJours(reseau.jour, 30), j60 = moinsJours(reseau.jour, 60)
  const retard = aFaire.filter((x) => enRetard(x.a, reseau.jour)).length
  const bloquees = aFaire.filter((x) => x.a.statut === 'bloquee').length
  const recentes = faites.filter((x) => (x.a.faite ?? '').slice(0, 10) > j30).length
  const avant = faites.filter((x) => { const d = (x.a.faite ?? '').slice(0, 10); return d > j60 && d <= j30 }).length
  const ecart = recentes - avant
  return (
    <Box aria-label="Tâches en chiffres" role="group" sx={{ ...grilleIndicateurs, mb: 2 }}>
      <Indicateur icone={<TaskAltOutlined />} libelle="À faire" valeur={String(aFaire.length)} detail={aFaire.length ? `dont ${aFaire.filter((x) => x.a.statut === 'en_cours').length} en cours` : 'Rien en attente'} />
      <Indicateur icone={<ScheduleOutlined />} libelle="En retard" valeur={String(retard)} couleur={retard ? 'error.main' : undefined} detail={aFaire.length ? `${Math.round((retard / aFaire.length) * 100)} % des tâches à faire` : '—'} />
      <Indicateur icone={<BlockOutlined />} libelle="Bloquées" valeur={String(bloquees)} couleur={bloquees ? 'warning.dark' : undefined} detail={bloquees ? 'À débloquer' : 'Aucune'} />
      <Indicateur icone={<DoneAllOutlined />} libelle="Faites sur 30 jours" valeur={String(recentes)}
        evolution={avant || recentes ? { texte: `${ecart > 0 ? '+' : ''}${ecart}`, sens: ecart > 0 ? 'hausse' : ecart < 0 ? 'baisse' : 'stable', reference: `vs ${avant} les 30 jours d’avant` } : null} />
    </Box>
  )
}

// Liste des tâches des franchisés des magasins affichés ; vague 4 (32A) : toutes les tâches en retard, toutes les bloquées
const FRANCHISES = '@franchises'
const RETARD = '@retard'
const BLOQUEES = '@bloquees'
const PERSONNE = '@personne'
const SPECIALES = [FRANCHISES, RETARD, BLOQUEES]

// Listes de tâches en onglets soulignés (refonte vague 4, 32A et 39A) : Mes tâches, Franchisés, En retard, Bloquées ;
// le Directeur ouvre aussi celle d'une personne de l'équipe (onglet « Une personne », choix de la personne dessous)
function ChoixPorteur({ reseau, noms, moi, valeur, directeur, onChange }: { reseau: Reseau; noms: string[]; moi: string; valeur: string; directeur: boolean; onChange: (nom: string) => void }) {
  const n = (porteur: string) => aFaireDe(reseau, noms, porteur).length
  const membre = valeur !== moi && !SPECIALES.includes(valeur) ? valeur : null
  const rubriques: Rubrique<string>[] = [
    { vue: moi, libelle: `Mes tâches · ${n(moi)}`, court: `Mes tâches · ${n(moi)}`, icone: <PersonOutlined /> },
    { vue: FRANCHISES, libelle: `Franchisés · ${n(FRANCHISES)}`, court: `Franchisés · ${n(FRANCHISES)}`, icone: <StorefrontOutlined /> },
    { vue: RETARD, libelle: `En retard · ${n(RETARD)}`, court: `En retard · ${n(RETARD)}`, icone: <ScheduleOutlined /> },
    { vue: BLOQUEES, libelle: `Bloquées · ${n(BLOQUEES)}`, court: `Bloquées · ${n(BLOQUEES)}`, icone: <BlockOutlined /> },
    ...(directeur ? [{ vue: PERSONNE, libelle: 'Une personne', court: 'Une personne', icone: <GroupsOutlined /> }] : []),
  ]
  const personnes = [...reseau.rrs.map((r) => r.nom), ...reseau.equipe.filter((c) => !c.fictif).map((c) => c.nom)].filter((x, i, l) => x && x !== moi && l.indexOf(x) === i)
  return (
    <Box sx={{ mb: 2 }}>
      <Onglets valeur={membre ? PERSONNE : valeur} onChange={(v) => onChange(v === PERSONNE ? (membre ?? personnes[0] ?? moi) : v)} rubriques={rubriques} libelle="Liste de tâches" />
      {membre && (
        <Autocomplete options={personnes} value={membre} onChange={(_e, v) => v && onChange(v)} disableClearable sx={{ width: { xs: '100%', sm: 320 }, mt: 2 }}
          renderInput={(params) => <TextField {...params} size="small" label="Personne" sx={{ '& .MuiInputBase-root': { minHeight: 48 } }} />} />
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
  const toutes = actionsDes(reseau, new Set(noms))
  if (porteur === RETARD) return toutes.filter((x) => enRetard(x.a, reseau.jour))
  if (porteur === BLOQUEES) return toutes.filter((x) => !x.a.faite && x.a.statut === 'bloquee')
  return toutes.filter((x) => (porteur === FRANCHISES ? porteeParFranchise(reseau, x, cache) : portePar(x.a, porteur)))
}
const aFaireDe = (reseau: Reseau, noms: string[], porteur: string) => tachesDe(reseau, noms, porteur).filter((x) => !x.a.faite)

function Liste({ reseau, noms, porteur, signaler, choixPorteur, ajoutVide }: { reseau: Reseau; noms: string[]; porteur: string; signaler: (m: string, annuler?: () => void) => void; choixPorteur?: ReactNode; ajoutVide?: ReactNode }) {
  const { recharger } = useReseau()
  const ecriture = useEcritureActions(reseau)
  const [recherche, setRecherche] = useState('')
  const [magasin, setMagasin] = useState<string | null>(null)
  const [ancreMagasin, setAncreMagasin] = useState<HTMLElement | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [toutesFaites, setToutesFaites] = useState(false)
  const [edition, setEdition] = useState<ActionSuivie | null>(null)
  const [regroupement, setRegroupement] = useState<Regroupement>('echeance')
  // Vague 7 (89A) : filtre « Sans priorité » et regroupement par priorité du plan d'action
  const [sansPrio, setSansPrio] = useState(false)
  const prioriteDe = (x: ActionSuivie) => (x.a.priorite ? reseau.plans?.[x.magasin]?.find((p) => p.id === x.a.priorite && p.statut === 'active') : undefined)
  const choix = magasin && noms.includes(magasin) ? magasin : null
  const q = sansAccents(recherche.trim())
  const actions = tachesDe(reseau, choix ? [choix] : noms, porteur)
    .filter((x) => !q || sansAccents(`${x.a.action} ${x.magasin} ${x.a.porteur ?? ''}`).includes(q))
    .filter((x) => !sansPrio || !prioriteDe(x))
  const aFaire = actions.filter((x) => !x.a.faite)
  const faites = actions.filter((x) => x.a.faite)
  const cocher = async (x: ActionSuivie, faite: boolean) => {
    setEnCours(x.cle)
    try {
      await ecriture.cocher(x, faite)
      await recharger()
      signaler(faite ? 'Tâche marquée faite.' : 'Tâche remise à faire.', () => void cocher(x, !faite))
    } catch (e) { signaler(e instanceof ErreurAction ? e.message : 'La tâche n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.') }
    finally { setEnCours(null) }
  }
  const changerStatut = useChangerStatut(reseau, signaler)
  const ligne = (x: ActionSuivie) => (
    <LigneAction key={x.cle} reseau={reseau} x={x} avecMagasin={!choix && noms.length > 1} avecPorteur={porteur === FRANCHISES} enCours={enCours === x.cle} changerStatut={changerStatut?.(x)}
      cocher={ecriture.lectureSeule ? undefined : (f) => void cocher(x, f)}
      modifier={x.libre && !ecriture.franchise ? () => setEdition(x) : undefined} />
  )
  if (!noms.length) return <EmptyState icone={<TaskAltOutlined />} titre="Aucun magasin" texte="Aucun magasin n’est rattaché à ton accès pour le moment." />
  if (!porteur) return <EmptyState icone={<TaskAltOutlined />} titre="Aucune liste" texte="Ton nom n’est pas encore relié à ton accès. Contacte la direction du réseau." />
  const dansUneSemaine = plusSept(reseau.jour)
  const parCle = (cle: (x: ActionSuivie) => string[], avecAvancement = false) => {
    const m = new Map<string, ActionSuivie[]>()
    for (const x of aFaire) for (const k of cle(x)) m.set(k, [...(m.get(k) ?? []), x])
    const f = new Map<string, number>()
    if (avecAvancement) for (const x of faites) for (const k of cle(x)) f.set(k, (f.get(k) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr')).map(([k, lignes]) => ({ g: k, titre: k, lignes, faites: avecAvancement ? f.get(k) ?? 0 : undefined as number | undefined }))
  }
  const parPorteur = (x: ActionSuivie) => (porteursDe(x.a).length ? porteursDe(x.a) : ['Sans porteur'])
  const parGroupe: { g: string; titre: string; lignes: ActionSuivie[]; faites?: number }[] = regroupement === 'magasin' ? parCle((x) => [x.magasin], true)
    : regroupement === 'personne' ? parCle(parPorteur, true)
    : regroupement === 'priorite' ? parCle((x) => { const p = prioriteDe(x); return [p ? `${noms.length > 1 && !choix ? `${x.magasin} · ` : ''}${p.titre}` : '~Sans priorité'] }).map((g) => ({ ...g, titre: g.titre.replace(/^~/, '') }))
    : groupes.map((g) => ({ ...g, lignes: aFaire.filter((x) => groupeDe(x, reseau.jour, dansUneSemaine) === g.g) })).filter((g) => g.lignes.length)
  const bascule = (
    <ToggleButtonGroup exclusive size="small" value={regroupement} onChange={(_e, v: Regroupement | null) => v && setRegroupement(v)} aria-label="Regrouper les tâches" sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
      <ToggleButton value="echeance" sx={{ minHeight: 40, px: 1.5 }}>Par échéance</ToggleButton>
      {noms.length > 1 && <ToggleButton value="magasin" sx={{ minHeight: 40, px: 1.5 }}>Par magasin</ToggleButton>}
      <ToggleButton value="personne" sx={{ minHeight: 40, px: 1.5 }}>Par personne</ToggleButton>
      <ToggleButton value="priorite" sx={{ minHeight: 40, px: 1.5 }}>Par priorité</ToggleButton>
    </ToggleButtonGroup>
  )
  const filtreMagasin = noms.length > 1 && (noms.length <= 6
    ? (
      <Box role="group" aria-label="Magasins affichés" sx={{ ...styleBac, mb: 0 }}>
        <ButtonBase onClick={() => setMagasin(null)} aria-pressed={!choix} sx={styleVue(!choix)}><span>Tous</span></ButtonBase>
        {noms.map((n) => <ButtonBase key={n} onClick={() => setMagasin(n)} aria-pressed={choix === n} sx={styleVue(choix === n)}><span>{n}</span></ButtonBase>)}
      </Box>
    )
    : (
      // 324 (18/11/2026) : le filtre Magasin en puce comme les autres ; la liste s'ouvre au clic
      <>
        <Chip label={choix ?? 'Tous les magasins'} icon={<StorefrontOutlined />} color={choix ? 'primary' : 'default'} variant={choix ? 'filled' : 'outlined'}
          onClick={(e) => setAncreMagasin(e.currentTarget)} onDelete={choix ? () => setMagasin(null) : undefined} aria-haspopup="dialog" aria-label={`Magasin : ${choix ?? 'tous'}`} sx={{ minHeight: 48 }} />
        <Popover open={!!ancreMagasin} anchorEl={ancreMagasin} onClose={() => setAncreMagasin(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
          <Box sx={{ p: 1.5, width: 300 }}>
            <Autocomplete openOnFocus options={[...noms].sort((a, b) => a.localeCompare(b, 'fr'))} value={choix} onChange={(_e, v) => { setMagasin(v); setAncreMagasin(null) }}
              renderInput={(params) => <TextField {...params} autoFocus size="small" label="Magasin" placeholder="Tous les magasins" sx={{ '& .MuiInputBase-root': { minHeight: 48 } }} />} />
          </Box>
        </Popover>
      </>
    ))
  return (
    <>
      {choixPorteur}
      <RechercheFiltres actifs={(choix ? 1 : 0) + (sansPrio ? 1 : 0)} actions={bascule}
        recherche={<ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Tâche, magasin, porteur" libelle="Rechercher une tâche" />}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {filtreMagasin || null}
          <Chip label="Sans priorité" icon={<FlagOutlined />} color={sansPrio ? 'primary' : 'default'} variant={sansPrio ? 'filled' : 'outlined'} onClick={() => setSansPrio((v) => !v)} aria-pressed={sansPrio} sx={{ minHeight: 48 }} />
        </Box>
      </RechercheFiltres>
      {(aFaire.length > 0 || faites.length > 0) && <CartesTaches reseau={reseau} aFaire={aFaire} faites={faites} />}
      <Box sx={{ display: 'grid', gap: 2 }}>
        <CarteLignes label="À faire">
          {aFaire.length
            ? <Box component="ul" aria-label="Tâches à faire" sx={{ listStyle: 'none', m: 0, p: 0, '& > li:not([role=presentation])': { px: 1 } }}>
                {parGroupe.flatMap((g) => [<Intertitre key={`t-${g.g}`} titre={g.titre} nombre={g.lignes.length} faites={g.faites} />, ...g.lignes.map((x) => <Fragment key={`${g.g}-${x.cle}`}>{ligne(x)}</Fragment>)])}
              </Box>
            : q || faites.length
              ? <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>{q ? 'Aucune tâche ne correspond à la recherche.' : 'Toutes tes tâches sont faites.'}</Typography>
              : <EmptyState icone={<TaskAltOutlined />} titre="Aucune tâche en cours" texte="Les tâches confiées à cette liste arriveront ici." action={ajoutVide} />}
          {/* 324 : les tâches faites dans la même carte, sous leur intertitre */}
          {faites.length > 0 && (
            <Box component="section" aria-label="Faites">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1.5, pb: 0.5, bgcolor: 'action.hover' }}>
                <Typography component="h2" sx={cartouche}>Faites</Typography><Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.secondary' }}>{faites.length}</Typography>
              </Box>
              <Box component="ul" aria-label="Tâches faites" sx={{ listStyle: 'none', m: 0, p: 0, '& > li': { px: 1 } }}>{(toutesFaites ? faites : faites.slice(0, FAITES_VISIBLES)).map(ligne)}</Box>
              {faites.length > FAITES_VISIBLES && (
                <Button onClick={() => setToutesFaites((v) => !v)} sx={{ minHeight: 48, width: '100%' }}>{toutesFaites ? 'Voir moins' : `Voir les ${faites.length} tâches faites`}</Button>
              )}
            </Box>
          )}
        </CarteLignes>
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
  const { signaler, bandeau } = useMessageAnnulable()
  const impose = perimetreDuProfil(profil)
  const franchise = !!reseau?.espace
  const moi = reseau ? monNomPorteur(reseau, profil) : ''
  // Franchisé : sa liste ; l'équipe ajoute celle des franchisés, le Directeur celle de chacun
  const choixPossible = !!reseau && !franchise && !!moi
  const demande = choixPossible ? params.get('de') : null
  const porteur = (demande && (!impose || SPECIALES.includes(demande)) ? demande : '') || moi
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
      <PageHeader titre="Tâches" sousTitre={porteur && porteur !== moi && !SPECIALES.includes(porteur) ? `Tâches de ${porteur}` : undefined}
        actions={reseau ? <BoutonAjouterAction barre reseau={reseau} magasins={noms} porteur={SPECIALES.includes(porteur) ? '' : porteur} signaler={signaler} /> : undefined} />
      <AvecReseau>{(r) => (
        <Liste reseau={r} noms={noms} porteur={porteur} signaler={signaler}
          choixPorteur={choixPossible ? <ChoixPorteur reseau={r} noms={noms} moi={moi} valeur={porteur} directeur={!impose} onChange={changer} /> : undefined}
          /* Vague 8 (99A) : l'état vide n'a pas de second bouton, celui de l'en-tête suffit */ />
      )}</AvecReseau>
      {bandeau}
    </>
  )
}

// Onglet Tâches de la fiche magasin (Joseph, 17/11/2026) : toutes les tâches du magasin, quel que soit le porteur,
// en puces À faire / En retard / Bloquées / Faites ; les tâches à faire rangées par échéance. L'Activité garde l'historique.
export type FiltreTachesMagasin = 'afaire' | 'encours' | 'retard' | 'bloquees' | 'faites'
export function TachesMagasin({ reseau, magasin, ajouter }: { reseau: Reseau; magasin: string; ajouter: () => void }) {
  const { recharger } = useReseau()
  // « Fait » se défait : « Annuler » dans le message (Joseph, 17/11/2026 : une tâche validée par erreur)
  const { signaler, bandeau } = useMessageAnnulable()
  const ecriture = useEcritureActions(reseau)
  const changerStatut = useChangerStatut(reseau, signaler)
  const [filtre, setFiltre] = useState<FiltreTachesMagasin>('afaire')
  const [enCours, setEnCours] = useState<string | null>(null)
  const [edition, setEdition] = useState<ActionSuivie | null>(null)
  const [toutesFaites, setToutesFaites] = useState(false)
  const toutes = actionsDes(reseau, new Set([magasin]))
  const aFaire = toutes.filter((x) => !x.a.faite)
  const listes: Record<FiltreTachesMagasin, ActionSuivie[]> = {
    afaire: aFaire,
    // Joseph (18/11/2026) : les tâches passées « En cours » par leur puce de statut
    encours: aFaire.filter((x) => x.a.statut === 'en_cours'),
    retard: aFaire.filter((x) => enRetard(x.a, reseau.jour)),
    bloquees: aFaire.filter((x) => x.a.statut === 'bloquee'),
    faites: toutes.filter((x) => x.a.faite),
  }
  const libelles: Record<FiltreTachesMagasin, string> = { afaire: 'À faire', encours: 'En cours', retard: 'En retard', bloquees: 'Bloquées', faites: 'Faites' }
  const cocher = async (x: ActionSuivie, faite: boolean) => {
    setEnCours(x.cle)
    try {
      await ecriture.cocher(x, faite)
      await recharger()
      signaler(faite ? 'Tâche marquée faite.' : 'Tâche remise en cours.', () => void cocher(x, !faite))
    } catch (e) { signaler(e instanceof ErreurAction ? e.message : 'La tâche n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.') }
    finally { setEnCours(null) }
  }
  const ligne = (x: ActionSuivie) => (
    <LigneAction key={x.cle} reseau={reseau} x={x} avecMagasin={false} enCours={enCours === x.cle} changerStatut={changerStatut?.(x)}
      cocher={ecriture.lectureSeule ? undefined : (f) => void cocher(x, f)}
      modifier={x.libre && !ecriture.franchise ? () => setEdition(x) : undefined} />
  )
  const lignes = listes[filtre]
  const dansUneSemaine = plusSept(reseau.jour)
  const parGroupe = groupes.map((g) => ({ ...g, lignes: lignes.filter((x) => groupeDe(x, reseau.jour, dansUneSemaine) === g.g) })).filter((g) => g.lignes.length)
  const vide: Record<FiltreTachesMagasin, string> = {
    afaire: 'Aucune tâche en cours pour ce magasin.',
    encours: 'Aucune tâche marquée en cours.',
    retard: 'Aucune tâche en retard.',
    bloquees: 'Aucune tâche bloquée.',
    faites: 'Aucune tâche faite pour l’instant.',
  }
  const bouton = !ecriture.lectureSeule && <Button startIcon={<AddOutlined />} onClick={ajouter} sx={{ minHeight: 48, whiteSpace: 'nowrap' }}>Ajouter une tâche</Button>
  return (
    <Card component="section" aria-label="Tâches du magasin" sx={styleBloc}>
      <Box sx={{ ...styleEnteteBloc, columnGap: 2 }}>
        <Typography component="h2" sx={cartouche}>Tâches</Typography>
        <Box sx={{ mr: 'auto' }} />
        {bouton}
      </Box>
      <Box sx={{ mb: 1 }}>
        <Puces label="Filtrer les tâches" valeur={filtre} onChange={(v) => { setFiltre(v); setToutesFaites(false) }}
          options={(Object.keys(libelles) as FiltreTachesMagasin[]).map((v) => ({ v, libelle: `${libelles[v]} · ${listes[v].length}` }))} />
      </Box>
      {!lignes.length
        ? <LigneVide>{vide[filtre]}</LigneVide>
        : filtre === 'faites'
          ? <>
              <Box component="ul" aria-label="Tâches faites" sx={{ listStyle: 'none', m: 0, p: 0 }}>{(toutesFaites ? lignes : lignes.slice(0, FAITES_VISIBLES)).map(ligne)}</Box>
              {lignes.length > FAITES_VISIBLES && <Button onClick={() => setToutesFaites((v) => !v)} sx={{ minHeight: 48, width: '100%' }}>{toutesFaites ? 'Voir moins' : `Voir les ${lignes.length} tâches faites`}</Button>}
            </>
          : <Box component="ul" aria-label={filtre === 'afaire' ? `Tâches en cours de ${magasin}` : `Tâches ${libelles[filtre].toLocaleLowerCase('fr')}`} sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {parGroupe.flatMap((g) => [<Intertitre key={`t-${g.g}`} titre={g.titre} nombre={g.lignes.length} />, ...g.lignes.map((x) => <Fragment key={`${g.g}-${x.cle}`}>{ligne(x)}</Fragment>)])}
            </Box>}
      {edition && <DialogAction reseau={reseau} magasins={[magasin]} action={edition} onFermer={(msg) => { setEdition(null); if (msg) signaler(msg) }} />}
      {bandeau}
    </Card>
  )
}
