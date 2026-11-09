import { useEffect, useMemo, useRef } from 'react'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { useCreer, type Choix } from './Creer'
import { useAuth } from '../auth/AuthContext'
import { useNavigate } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import InputBase from '@mui/material/InputBase'
import Typography from '@mui/material/Typography'
import SearchIcon from '@mui/icons-material/Search'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import PersonOutline from '@mui/icons-material/PersonOutlineOutlined'
import SupervisorAccountOutlined from '@mui/icons-material/SupervisorAccountOutlined'
import { useReseau } from '../data/ReseauContext'
import { normaliser } from '../data/filtres'
import { lienCoach, lienDirecteur, lienFiche, lienFranchise, lienRR } from '../lib/format'
import { franchises } from '../data/personnes'
import HandshakeOutlined from '@mui/icons-material/HandshakeOutlined'
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined'
import StarOutlined from '@mui/icons-material/StarOutlined'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import { magasinsSuivis, useSuivis } from '../lib/suivis'

interface Resultat { type: 'Actions' | 'Favoris' | 'Consultés récemment' | 'Magasins' | 'Coachs' | 'Responsables Régionaux' | 'Franchisés' | 'Direction'; libelle: string; detail: string; cible: string; cle: string; faire?: { choix: Choix | 'message'; magasin?: string } }

const icones = { Actions: <AddOutlined />, Favoris: <StarOutlined />, 'Consultés récemment': <HistoryOutlined />, Magasins: <StorefrontOutlined />, Coachs: <PersonOutline />, 'Responsables Régionaux': <SupervisorAccountOutlined />, Franchisés: <HandshakeOutlined />, Direction: <AdminPanelSettingsOutlined /> }

const ordreTypes: Resultat['type'][] = ['Coachs', 'Responsables Régionaux', 'Direction', 'Franchisés', 'Magasins']

// Actions proposées par la recherche (refonte, Joseph 09/11/2026, choix 9A) : créer sans quitter l'écran
const ACTIONS: { choix: Choix | 'message'; libelle: string; avecMagasin: string; mots: string }[] = [
  { choix: 'visite', libelle: 'Saisir une visite', avecMagasin: 'Saisir une visite à', mots: 'visite compte rendu planifier' },
  { choix: 'tache', libelle: 'Ajouter une tâche', avecMagasin: 'Ajouter une tâche à', mots: 'tâche tache action' },
  { choix: 'message', libelle: 'Écrire un message', avecMagasin: 'Écrire à', mots: 'message écrire ecrire' },
  { choix: 'pratique', libelle: 'Partager une bonne pratique', avecMagasin: '', mots: 'bonne pratique photo' },
  { choix: 'evenement', libelle: 'Ajouter un événement', avecMagasin: '', mots: 'événement evenement agenda formation' },
]

// court : téléphone, champ étroit entre le logo et les icônes ; la liste des résultats prend toute la largeur
// menu : PC, en haut du menu latéral, avec le raccourci Ctrl K (ou Cmd K) qui place le curseur dans le champ
export function RechercheGlobale({ surFonce, court, menu }: { surFonce?: boolean; court?: boolean; menu?: boolean }) {
  const { reseau } = useReseau()
  const naviguer = useNavigate()
  const creer = useCreer()
  const { profil } = useAuth()
  const avecActions = !!profil && profil.role !== 'franchise'
  const champ = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (!menu) return
    const raccourci = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); champ.current?.focus() }
    }
    document.addEventListener('keydown', raccourci)
    return () => document.removeEventListener('keydown', raccourci)
  }, [menu])
  const options = useMemo<Resultat[]>(() => {
    if (!reseau) return []
    const nbCoach = (c: string) => reseau.magasins.filter((m) => m.coach === c).length
    return [
      ...reseau.magasins.map((m) => ({ type: 'Magasins' as const, libelle: m.nom, detail: [m.ville, m.departement && `Dépt ${m.departement}`, m.coach].filter(Boolean).join(' · '), cible: lienFiche(m.nom), cle: `m-${m.nom}` })),
      ...Object.keys(reseau.coachs).filter((c) => nbCoach(c) > 0).sort((a, b) => a.localeCompare(b, 'fr')).map((c) => ({ type: 'Coachs' as const, libelle: c, detail: `${nbCoach(c)} magasins`, cible: lienCoach(c), cle: `c-${c}` })),
      ...reseau.rrs.map((r) => ({ type: 'Responsables Régionaux' as const, libelle: r.nom, detail: `${reseau.magasins.filter((m) => m.rr?.id === r.id).length} magasins`, cible: lienRR(r.id), cle: `r-${r.id}` })),
      ...franchises(reseau).map((f) => ({ type: 'Franchisés' as const, libelle: f.nom, detail: f.magasins.map((m) => m.nom).join(', '), cible: lienFranchise(f.nom), cle: `f-${f.nom}` })),
      ...(reseau.directeur.nom !== 'Direction du réseau' ? [{ type: 'Direction' as const, libelle: reseau.directeur.nom, detail: reseau.directeur.titre, cible: lienDirecteur(), cle: 'directeur' }] : []),
    ]
  }, [reseau])
  // Champ vide : favoris puis dernières fiches ouvertes
  const suivis = useSuivis()
  const enTete = useMemo<Resultat[]>(() => {
    const magasins = new Map(options.filter((o) => o.type === 'Magasins').map((o) => [o.libelle, o]))
    const s = magasinsSuivis(suivis, new Set(magasins.keys()))
    return [
      ...s.favoris.map((n) => ({ ...magasins.get(n)!, type: 'Favoris' as const, cle: `fav-${n}` })),
      ...s.recents.map((n) => ({ ...magasins.get(n)!, type: 'Consultés récemment' as const, cle: `rec-${n}` })),
    ]
  }, [options, suivis])

  return (
    <Autocomplete
      options={[...enTete, ...options]}
      openOnFocus={enTete.length > 0 || (!!menu && avecActions)}
      groupBy={(o) => o.type}
      getOptionLabel={(o) => o.libelle}
      getOptionKey={(o) => o.cle}
      filterOptions={(opts, { inputValue }) => {
        const t = normaliser(inputValue)
        const actions: Resultat[] = !avecActions ? [] : ACTIONS.filter((a) => !t || normaliser(`${a.libelle} ${a.mots}`).includes(t))
          .map((a) => ({ type: 'Actions' as const, libelle: a.libelle, detail: '', cible: '', cle: `a-${a.choix}`, faire: { choix: a.choix } }))
        if (!t) return [...enTete, ...actions.slice(0, 3)]
        // Le nom trouvé passe avant ce qui ne le cite qu'en détail : la fiche d'un Coach avant ses magasins
        const rang = (o: Resultat) => (normaliser(o.libelle).includes(t) ? 0 : 1)
        const trouves = opts.filter((o) => o.type !== 'Favoris' && o.type !== 'Consultés récemment' && normaliser(`${o.libelle} ${o.detail}`).includes(t))
        const meilleur = new Map<Resultat['type'], number>()
        for (const o of trouves) meilleur.set(o.type, Math.min(meilleur.get(o.type) ?? 1, rang(o)))
        const ordre = (o: Resultat) => meilleur.get(o.type)! * 10 + ordreTypes.indexOf(o.type)
        const tries = trouves.sort((a, b) => ordre(a) - ordre(b) || rang(a) - rang(b)).slice(0, 12)
        // Un magasin trouvé : ses actions directes (« Saisir une visite à Annecy »)
        const premier = tries.find((o) => o.type === 'Magasins')
        const surMagasin: Resultat[] = avecActions && premier ? ACTIONS.filter((a) => a.avecMagasin)
          .map((a) => ({ type: 'Actions' as const, libelle: `${a.avecMagasin} ${premier.libelle}`, detail: '', cible: '', cle: `a-${a.choix}-${premier.libelle}`, faire: { choix: a.choix, magasin: premier.libelle } })) : []
        return [...tries, ...surMagasin, ...actions]
      }}
      noOptionsText="Aucun résultat"
      value={null}
      blurOnSelect
      clearOnBlur
      onChange={(_e, o) => { if (!o) return; if (o.faire) creer(o.faire.choix, o.faire.magasin); else naviguer(o.cible) }}
      renderOption={({ key, ...props }, o) => (
        <Box component="li" key={key} {...props} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', minHeight: 48 }}>
          <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icones[o.type]}</Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{o.libelle}</Typography>
            <Typography variant="caption" color="text.secondary">{o.detail}</Typography>
          </Box>
        </Box>
      )}
      sx={{ width: '100%', maxWidth: 560 }}
      slotProps={{ paper: { sx: { mt: 1 } }, popper: court ? { sx: { width: 'calc(100vw - 16px) !important' } } : menu ? { placement: 'bottom-start', sx: { width: '420px !important' } } : undefined }}
      renderInput={(p) => (
        <Box ref={p.slotProps.input.ref} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: court || menu ? 1.25 : 2, height: menu ? 40 : 44, borderRadius: 2, bgcolor: surFonce ? 'rgba(255,255,255,0.12)' : 'action.hover', border: menu ? '1px solid' : 0, borderColor: 'divider' }}>
          <SearchIcon sx={{ color: surFonce ? '#ffffff' : 'text.secondary', fontSize: menu ? 20 : 24 }} />
          <InputBase
            inputRef={champ}
            inputProps={{ ...p.slotProps.htmlInput, 'aria-label': 'Recherche globale', 'aria-keyshortcuts': menu ? 'Control+K' : undefined }}
            placeholder={court ? 'Rechercher' : menu ? 'Rechercher ou agir' : 'Rechercher un magasin, une personne, une ville'}
            sx={{ flex: 1, fontSize: '0.875rem', color: surFonce ? '#ffffff' : 'text.primary', '& input::placeholder': { color: surFonce ? 'rgba(255,255,255,0.78)' : 'text.secondary', opacity: 1 } }}
          />
          {menu && <Box component="kbd" aria-hidden sx={{ fontFamily: 'inherit', fontSize: '0.75rem', color: 'text.secondary', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 0.5, whiteSpace: 'nowrap' }}>Ctrl K</Box>}
        </Box>
      )}
    />
  )
}
