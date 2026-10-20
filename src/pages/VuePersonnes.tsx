import { useMemo, useState } from 'react'
import { CarteLignes, Initiales, LigneCompacte } from '../components/Social'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import PersonAddAlt1Outlined from '@mui/icons-material/PersonAddAlt1Outlined'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import ChevronRight from '@mui/icons-material/ChevronRight'
import { DialogCoach, DialogFranchise, DialogRR } from '../components/EditionEquipe'
import { EmptyState } from '../components/EmptyState'
import { RechercheFiltres } from '../components/RechercheFiltres'
import { BoutonAction, ChampRecherche } from '../components/Outils'
import { normaliser } from '../data/filtres'
import { fichePersonne, franchises, libelleRole, type FichePersonnelle, type TypePersonne } from '../data/personnes'
import { lienCoach, lienDirecteur, lienFranchise, lienRR } from '../lib/format'
import type { Reseau } from '../data/modele'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'

interface LignePersonne { cle: string; type: TypePersonne; nom: string; role: string; rattachement: string; lien: string; fiche: FichePersonnelle }

export type Perimetre = 'collaborateurs' | 'franchises'

const FILTRES: { id: 'tous' | TypePersonne; libelle: string }[] = [
  { id: 'tous', libelle: 'Tous' },
  { id: 'rr', libelle: 'Responsables Régionaux' },
  { id: 'coach', libelle: 'Coachs' },
]
const AJOUTS = { collaborateurs: [['coach', 'Un Coach'], ['rr', 'Un Responsable Régional']], franchises: [] } as const

export function lignesPersonnes(reseau: Reseau): LignePersonne[] {
  const l: LignePersonne[] = []
  if (reseau.directeur.nom !== 'Direction du réseau') {
    l.push({ cle: 'directeur', type: 'directeur', nom: reseau.directeur.nom, role: reseau.directeur.titre, rattachement: 'Tout le réseau', lien: lienDirecteur(), fiche: fichePersonne(reseau, { type: 'directeur', cle: '' }) })
  }
  for (const r of reseau.rrs) {
    const n = reseau.equipe.filter((c) => c.rr?.id === r.id).length
    l.push({ cle: `rr:${r.id}`, type: 'rr', nom: r.nom, role: r.integres ? 'Responsable Magasins Intégrés' : libelleRole('rr'), rattachement: r.integres ? 'Magasins intégrés' : `${n} Coach${n > 1 ? 's' : ''}`, lien: lienRR(r.id), fiche: fichePersonne(reseau, { type: 'rr', cle: r.id }) })
  }
  for (const c of reseau.equipe) {
    l.push({ cle: `coach:${c.nom}`, type: 'coach', nom: c.nom, role: c.fictif ? 'Coach (poste à pourvoir)' : 'Coach', rattachement: c.rr?.nom ?? 'Sans Responsable Régional', lien: lienCoach(c.nom), fiche: fichePersonne(reseau, { type: 'coach', cle: c.nom }) })
  }
  for (const f of franchises(reseau)) {
    if (/recrutement/i.test(f.nom)) continue
    l.push({ cle: `franchise:${f.nom}`, type: 'franchise', nom: f.nom, role: libelleRole('franchise', f.integresSeulement), rattachement: f.magasins.map((m) => m.nom).join(', '), lien: lienFranchise(f.nom), fiche: fichePersonne(reseau, { type: 'franchise', cle: f.nom }) })
  }
  return l
}

// Annuaire des collaborateurs V and B (Directeur, RR, Coachs) ou des franchisés ; un clic ouvre la fiche, où l'on modifie
export function VuePersonnes({ reseau, perimetre }: { reseau: Reseau; perimetre: Perimetre }) {
  const naviguer = useNavigate()
  const [params, setParams] = useSearchParams()
  const filtre = (FILTRES.find((f) => f.id === params.get('role'))?.id ?? 'tous') as 'tous' | TypePersonne
  const changerFiltre = (id: string) => { const p = new URLSearchParams(params); if (id === 'tous') p.delete('role'); else p.set('role', id); setParams(p, { replace: true }) }
  const [texte, setTexte] = useState('')
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const [ajout, setAjout] = useState<'coach' | 'rr' | 'franchise' | null>(null)
  const [message, setMessage] = useState('')
  const toutes = useMemo(() => lignesPersonnes(reseau).filter((p) => (perimetre === 'franchises') === (p.type === 'franchise')), [reseau, perimetre])
  const compte = (id: string) => (id === 'tous' ? toutes.length : toutes.filter((p) => p.type === id).length)
  const t = normaliser(texte)
  const visibles = toutes.filter((p) => (perimetre === 'franchises' || filtre === 'tous' || p.type === filtre) && (!t || normaliser(`${p.nom} ${p.role} ${p.rattachement} ${p.fiche.ville}`).includes(t)))
  const fermer = (m?: string, nom?: string, lien?: (n: string) => string) => { setAjout(null); if (m) { setMessage(m); if (nom && lien) naviguer(lien(nom)) } }

  return (
    <>
      <RechercheFiltres actifs={filtre === 'tous' ? 0 : 1}
        recherche={<ChampRecherche valeur={texte} onChange={setTexte} placeholder="Nom, ville, magasin…" libelle="Rechercher une personne" />}
        actions={perimetre === 'franchises'
          ? <BoutonAction libelle="Ajouter un franchisé" icone={<PersonAddAlt1Outlined />} onClick={() => setAjout('franchise')} />
          : <BoutonAction libelle="Ajouter un collaborateur" icone={<PersonAddAlt1Outlined />} onClick={(e) => setMenu(e.currentTarget)} />}>
        {perimetre === 'collaborateurs' && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }} role="group" aria-label="Filtrer par rôle">
          {FILTRES.map((f) => (
            <Chip key={f.id} label={`${f.libelle} (${compte(f.id)})`} onClick={() => changerFiltre(f.id)} color={filtre === f.id ? 'secondary' : 'default'} variant={filtre === f.id ? 'filled' : 'outlined'} aria-pressed={filtre === f.id} sx={{ height: 36, fontSize: '0.875rem', fontWeight: 500, borderRadius: 2 }} />
          ))}
        </Box>}
      </RechercheFiltres>
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
        {AJOUTS[perimetre].map(([id, l]) => (
          <MenuItem key={id} onClick={() => { setMenu(null); setAjout(id) }} sx={{ minHeight: 48 }}>{l}</MenuItem>
        ))}
      </Menu>
      {visibles.length === 0 ? (
        <EmptyState icone={<PersonOutlineOutlined />} titre={toutes.length ? 'Personne ne correspond' : perimetre === 'franchises' ? 'Aucun franchisé renseigné' : 'Aucun collaborateur'}
          texte={toutes.length ? 'Change la recherche ou le filtre.' : 'Ajoute la personne : elle aura sa fiche personnelle.'}
          action={!toutes.length ? <Button variant="contained" onClick={(e) => (perimetre === 'franchises' ? setAjout('franchise') : setMenu(e.currentTarget))}>Ajouter</Button> : undefined} />
      ) : (
        <CarteLignes label={perimetre === 'franchises' ? 'Franchisés' : 'Collaborateurs'}>
          {visibles.map((p) => (
            <LigneCompacte key={p.cle} lien={p.lien} label={p.nom} avatar={<Initiales nom={p.nom} />} titre={p.nom}
              detail={[p.role, p.rattachement, p.fiche.ville].filter(Boolean).join(' · ')}
              fin={<ChevronRight color="action" />} />
          ))}
        </CarteLignes>
      )}
      {ajout === 'coach' && <DialogCoach reseau={reseau} coach={null} onFermer={(m, n) => fermer(m, n, lienCoach)} />}
      {ajout === 'rr' && <DialogRR reseau={reseau} rr={null} onFermer={(m) => fermer(m)} />}
      {ajout === 'franchise' && <DialogFranchise reseau={reseau} nom={null} onFermer={(m, n) => fermer(m, n, lienFranchise)} />}
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

// Page de la partie « Paramètres » : Collaborateurs ou Franchisés
export function Personnes({ perimetre }: { perimetre: Perimetre }) {
  return (
    <>
      <PageHeader titre={perimetre === 'franchises' ? 'Franchisés' : 'Collaborateurs'} />
      <AvecReseau>{(reseau) => <VuePersonnes key={perimetre} perimetre={perimetre} reseau={reseau} />}</AvecReseau>
    </>
  )
}
