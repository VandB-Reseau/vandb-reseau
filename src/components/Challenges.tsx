// Challenge du mois (sprint 22, A6) : création et classement pour l'équipe, rang et podium pour le franchisé
import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined'
import { Fenetre } from './EditionEquipe'
import { Puces, TitreSection } from './Social'
import { BoutonAction } from './Outils'
import { EmptyState } from './EmptyState'
import { useAuth } from '../auth/AuthContext'
import type { Reseau } from '../data/modele'
import { libelleMois } from '../data/chiffres'
import { lienFiche } from '../lib/format'
import {
  chargerChallenges, chargerChallengesFranchise, creerChallenge, libellesIndicateur, progression, rangTexte, supprimerChallenge,
  type Challenge, type ChallengeFranchise, type Indicateur,
} from '../data/challenges'

const moisPrecedent = (jour: string) => { const d = new Date(`${jour.slice(0, 7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7) }

function DialogChallenge({ reseau, onFermer }: { reseau: Reseau; onFermer: (m?: string) => void }) {
  const { profil } = useAuth()
  const directeur = profil?.role === 'directeur'
  const tous = reseau.magasins.filter((m) => m.statut !== 'avenir').map((m) => m.nom)
  const regions = reseau.rrs.filter((r) => !r.integres && (directeur || (profil?.perimetre.rr ?? []).includes(r.id)))
  const deRegion = (id: string) => reseau.magasins.filter((m) => m.rr?.id === id && m.statut !== 'avenir').map((m) => m.nom)
  const [titre, setTitre] = useState('')
  const [indicateur, setIndicateur] = useState<Indicateur>('pm_bar')
  const [mois, setMois] = useState(moisPrecedent(reseau.jour))
  const [cible, setCible] = useState(directeur ? 'reseau' : regions[0]?.id ?? 'choix')
  const [choisis, setChoisis] = useState<string[]>([])
  const [franchises, setFranchises] = useState<'oui' | 'non'>('oui')
  const magasins = cible === 'reseau' ? tous : cible === 'choix' ? choisis : deRegion(cible)
  return (
    <Fenetre titre="Lancer un challenge" ouvert onFermer={onFermer} valide={!!titre.trim() && magasins.length >= 2 && /^\d{4}-\d{2}$/.test(mois)} sansRechargement
      enregistrer={async () => { await creerChallenge({ titre: titre.trim(), indicateur, mois, magasins, franchises: franchises === 'oui' }); return 'Challenge lancé.' }}>
      <TextField label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} autoFocus slotProps={{ htmlInput: { maxLength: 200 } }} placeholder="Par exemple : challenge du panier bar" />
      <Puces label="Indicateur" valeur={indicateur} onChange={setIndicateur} options={(Object.keys(libellesIndicateur) as Indicateur[]).map((v) => ({ v, libelle: libellesIndicateur[v] }))} />
      <TextField type="month" label="Mois" value={mois} onChange={(e) => setMois(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} helperText="Comparé au même mois de l’an dernier" />
      <Puces label="Magasins en compétition" valeur={cible} onChange={setCible}
        options={[...(directeur ? [{ v: 'reseau', libelle: 'Tout le réseau' }] : []), ...regions.map((r) => ({ v: r.id, libelle: `Région ${r.nom}` })), { v: 'choix', libelle: 'Choisir' }]} />
      {cible === 'choix'
        ? <Autocomplete multiple disableCloseOnSelect limitTags={4} options={tous} value={choisis} onChange={(_e, v) => setChoisis(v)} renderInput={(p) => <TextField {...p} label="Magasins" />} />
        : <Typography variant="body2" color="text.secondary">{magasins.length} magasins en compétition</Typography>}
      <Puces label="Rang montré aux franchisés" valeur={franchises} onChange={setFranchises} options={[{ v: 'oui', libelle: 'Rang et podium montrés' }, { v: 'non', libelle: 'Équipe seulement' }]} />
    </Fenetre>
  )
}

function CarteChallenge({ c, moi, directeur, retirer }: { c: Challenge; moi: string; directeur: boolean; retirer: () => void }) {
  return (
    <Card component="article" aria-label={c.titre} sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>{c.titre}</Typography>
          <Typography variant="body2" color="text.secondary">
            {[libellesIndicateur[c.indicateur], libelleMois(c.mois), `${c.classement.length} classés sur ${c.magasins.length}`, c.franchises ? 'rang montré aux franchisés' : 'équipe seulement'].join(' · ')}
          </Typography>
        </Box>
        {(directeur || c.auteur === moi) && <Tooltip title="Retirer le challenge"><IconButton aria-label={`Retirer le challenge ${c.titre}`} onClick={retirer} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton></Tooltip>}
      </Box>
      {!c.classement.length
        ? <Typography color="text.secondary">Classement dès que les chiffres du mois sont importés.</Typography>
        : (
          <Box component="ol" aria-label={`Classement : ${c.titre}`} sx={{ listStyle: 'none', m: 0, p: 0, '& > li + li': { borderTop: '1px solid', borderColor: 'divider' } }}>
            {c.classement.map((k) => (
              <Box component="li" key={k.magasin} sx={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', alignItems: 'center', gap: 1, py: 0.75 }}>
                <Typography sx={{ fontWeight: 700 }}>{rangTexte(k.rang)}</Typography>
                <Link component={RouterLink} to={lienFiche(k.magasin)} sx={{ fontWeight: 500, minHeight: 32, display: 'inline-flex', alignItems: 'center' }}>{k.magasin}</Link>
                <Typography sx={{ fontWeight: 600, color: k.valeur === null ? 'text.secondary' : k.valeur >= 0 ? 'success.dark' : 'error.main' }}>{k.valeur === null ? '—' : progression(k.valeur)}</Typography>
              </Box>
            ))}
          </Box>
        )}
    </Card>
  )
}

// Équipe (Santé du parc) : challenges et classements ; création par le Directeur et les RR
export function VueChallenges({ reseau }: { reseau: Reseau }) {
  const { profil, session } = useAuth()
  const [liste, setListe] = useState<Challenge[] | null | undefined>(undefined)
  const [ajout, setAjout] = useState(false)
  const [message, setMessage] = useState('')
  const relire = useCallback(() => { void chargerChallenges().then(setListe).catch(() => setListe(null)) }, [])
  useEffect(relire, [relire])
  const cree = profil?.role === 'directeur' || profil?.role === 'rr'
  if (liste === undefined) return null
  if (liste === null) return <EmptyState icone={<EmojiEventsOutlined />} titre="Challenges bientôt disponibles" texte="Les challenges arrivent dès que la base de données est mise à jour." />
  const retirer = async (c: Challenge) => { try { await supprimerChallenge(c.id); setMessage('Challenge retiré.'); relire() } catch (e) { setMessage((e as Error).message) } }
  return (
    <Box component="section" aria-label="Challenges">
      <TitreSection nombre={liste.length} action={cree ? <BoutonAction libelle="Lancer un challenge" onClick={() => setAjout(true)} /> : undefined}>Challenges</TitreSection>
      {!liste.length
        ? <EmptyState icone={<EmojiEventsOutlined />} titre="Aucun challenge" texte="Un challenge classe les magasins sur la progression d’un indicateur face à l’an dernier." action={cree ? <Button variant="contained" onClick={() => setAjout(true)}>Lancer un challenge</Button> : undefined} />
        : <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'start' }}>
            {liste.map((c) => <CarteChallenge key={c.id} c={c} moi={session?.user.id ?? ''} directeur={profil?.role === 'directeur'} retirer={() => void retirer(c)} />)}
          </Box>}
      {message && <Typography role="status" sx={{ mt: 1 }}>{message}</Typography>}
      {ajout && <DialogChallenge reseau={reseau} onFermer={(m) => { setAjout(false); if (m) { setMessage(m); relire() } }} />}
    </Box>
  )
}

// Accueil du franchisé : son rang et le podium, sans chiffre
export function SectionChallengesFranchise() {
  const [liste, setListe] = useState<ChallengeFranchise[] | null>(null)
  useEffect(() => { void chargerChallengesFranchise().then(setListe).catch(() => setListe(null)) }, [])
  if (!liste?.length) return null
  return (
    <Box component="section" aria-label="Challenges du réseau">
      <TitreSection nombre={liste.length}>Challenges du réseau</TitreSection>
      <Card component="ul" sx={{ listStyle: 'none', m: 0, p: 0, overflow: 'hidden', '& > li + li': { borderTop: '1px solid', borderColor: 'divider' } }}>
        {liste.map((c) => (
          <Box component="li" key={c.id} sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ fontWeight: 600 }}>{c.titre}</Typography>
            <Typography variant="body2" color="text.secondary">{[libellesIndicateur[c.indicateur], libelleMois(c.mois)].join(' · ')}</Typography>
            {!c.classes
              ? <Typography sx={{ mt: 0.5 }}>Classement dès que les chiffres du mois sont connus.</Typography>
              : <>
                  {c.mesRangs.length
                    ? c.mesRangs.map((r) => <Typography key={r.magasin} sx={{ mt: 0.5, fontWeight: 700 }}>{c.mesRangs.length > 1 ? `${r.magasin} : ` : ''}{rangTexte(r.rang)} sur {c.classes}</Typography>)
                    : <Typography sx={{ mt: 0.5 }}>Ton magasin n’est pas encore classé.</Typography>}
                  <Typography variant="body2" sx={{ mt: 0.5 }}>Podium : {c.podium.map((p) => `${rangTexte(p.rang)} ${p.magasin}`).join(' · ')}</Typography>
                </>}
          </Box>
        ))}
      </Card>
    </Box>
  )
}
