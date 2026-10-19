import { useState, type ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { useReseau } from '../data/ReseauContext'
import Autocomplete from '@mui/material/Autocomplete'
import {
  enregistrerCoach, enregistrerDirecteur, enregistrerFichePersonne, enregistrerFranchise, enregistrerRR, rattacherCoach, renommerCoach, renommerVisiteur, supprimerCoach, supprimerFranchise, supprimerRR,
} from '../data/chargement'
import { ChampsPersonnels, fichePersonnelleValide } from './ChampsPersonnels'
import { fichePersonne, ficheVide, franchises, nomComplet, type FichePersonnelle, type RefPersonne } from '../data/personnes'
import { coachA } from '../data/charge'
import { ChampMois, premierDuMois } from './ChampMois'
import type { Coach, Magasin, Reseau, ResponsableRegional } from '../data/modele'

const COULEURS = ['#1b6fce', '#ef7d00', '#2e7d32', '#7c3aed', '#c2185b', '#00838f', '#6d4c41', '#eaa400']

// Traduit le refus de la base en message compréhensible
export function messageErreur(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/does not exist|schema cache|could not find the table/i.test(m)) return 'Cette partie n’est pas encore activée dans la base : le script SQL correspondant doit être lancé dans Supabase.'
  if (/row-level security|permission denied/i.test(m)) return 'La base refuse l’enregistrement : la règle d’accès de cette table manque dans Supabase.'
  if (/column/i.test(m)) return 'La base n’a pas toutes les colonnes attendues : le script SQL de mise à jour doit être lancé dans Supabase.'
  return 'L’enregistrement n’a pas abouti. Vérifie ta connexion et réessaie.'
}

// Squelette commun : titre, champs, suppression avec confirmation, enregistrement avec message humain
export function Fenetre({ titre, ouvert, onFermer, children, valide, enregistrer, supprimer, suppressionBloquee, libelleSuppression, large }: {
  large?: boolean; titre: string; ouvert: boolean; onFermer: (message?: string) => void; children: ReactNode; valide: boolean
  enregistrer: () => Promise<string>; supprimer?: () => Promise<string>; suppressionBloquee?: string; libelleSuppression?: string
}) {
  const theme = useTheme()
  const pleinEcran = useMediaQuery(theme.breakpoints.down('sm'))
  const { recharger } = useReseau()
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | false>(false)
  const [confirmer, setConfirmer] = useState(false)
  const agir = async (action: () => Promise<string>) => {
    setEnvoi(true); setErreur(false)
    try { const message = await action(); await recharger(); onFermer(message) } catch (e) { setErreur(messageErreur(e)) } finally { setEnvoi(false) }
  }
  return (
    <Dialog open={ouvert} onClose={() => onFermer()} fullScreen={pleinEcran} fullWidth maxWidth={large ? "md" : "sm"} aria-labelledby="titre-edition">
      <DialogTitle id="titre-edition">{titre}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>{children}</Box>
        {confirmer && (
          <Alert severity="warning" sx={{ mt: 2 }} action={<Button color="inherit" onClick={() => supprimer && agir(supprimer)} disabled={envoi} sx={{ minHeight: 48 }}>Supprimer</Button>}>
            {libelleSuppression}
          </Alert>
        )}
        {erreur && <Alert severity="error" sx={{ mt: 2 }}>{erreur}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        {supprimer && (
          suppressionBloquee
            ? <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 200 }}>{suppressionBloquee}</Typography>
            : <Button color="error" startIcon={<DeleteOutlined />} onClick={() => setConfirmer(true)} disabled={envoi || confirmer} sx={{ minHeight: 48, mr: 'auto' }}>Supprimer</Button>
        )}
        <Button onClick={() => onFermer()} sx={{ minHeight: 48 }}>Annuler</Button>
        <Button variant="contained" disabled={!valide || envoi} onClick={() => agir(enregistrer)} sx={{ minHeight: 48 }}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
      </DialogActions>
    </Dialog>
  )
}

function useFiche(reseau: Reseau, r: RefPersonne | null) {
  return useState<FichePersonnelle>(() => (r ? fichePersonne(reseau, r) : ficheVide()))
}

export function DialogDirecteur({ reseau, onFermer }: { reseau: Reseau; onFermer: (m?: string) => void }) {
  const [f, setF] = useFiche(reseau, { type: 'directeur', cle: '' })
  const [titre, setTitre] = useState(reseau.directeur.titre)
  const nom = nomComplet(f)
  return (
    <Fenetre titre="Modifier le Directeur de réseau" ouvert large onFermer={onFermer} valide={fichePersonnelleValide(f)}
      enregistrer={async () => {
        if (reseau.directeur.nom !== nom && reseau.directeur.nom !== 'Direction du réseau') await renommerVisiteur(reseau.directeur.nom, nom)
        await enregistrerDirecteur({ nom, titre: titre.trim() || 'Directeur de réseau', telephone: f.telephone.trim(), email: f.email.trim(), naissance: f.naissance, arrivee: f.arrivee })
        await enregistrerFichePersonne({ type: 'directeur', cle: '' }, f)
        return 'Fiche du Directeur enregistrée.'
      }}>
      <ChampsPersonnels f={f} onChange={setF} autoFocus />
      <TextField label="Fonction" value={titre} onChange={(e) => setTitre(e.target.value)} />
    </Fenetre>
  )
}

export function DialogRR({ reseau, rr, onFermer }: { reseau: Reseau; rr: ResponsableRegional | null; onFermer: (m?: string) => void }) {
  const [f, setF] = useFiche(reseau, rr ? { type: 'rr', cle: rr.id } : null)
  const [couleur, setCouleur] = useState(rr?.couleur ?? COULEURS.find((c) => !reseau.rrs.some((r) => r.couleur === c)) ?? COULEURS[0])
  const [integres, setIntegres] = useState(rr?.integres ?? false)
  const nom = nomComplet(f)
  const coachs = rr ? reseau.equipe.filter((c) => c.rr?.id === rr.id).length : 0
  const doublon = reseau.rrs.some((r) => r.id !== rr?.id && r.nom.toLowerCase() === nom.toLowerCase())
  return (
    <Fenetre
      titre={rr ? `Modifier ${rr.nom}` : 'Ajouter un Responsable Régional'} ouvert large onFermer={onFermer}
      valide={fichePersonnelleValide(f) && !doublon}
      enregistrer={async () => {
        if (rr && rr.nom !== nom) await renommerVisiteur(rr.nom, nom)
        const id = await enregistrerRR({ id: rr?.id, nom, telephone: f.telephone.trim(), email: f.email.trim(), couleur, integres, naissance: f.naissance, arrivee: f.arrivee })
        await enregistrerFichePersonne({ type: 'rr', cle: id }, f)
        return rr ? `${nom} est mis à jour.` : `${nom} est ajouté.`
      }}
      supprimer={rr ? async () => { await supprimerRR(rr.id); return `${rr.nom} est supprimé.` } : undefined}
      suppressionBloquee={coachs ? `Rattache d’abord ses ${coachs} Coach${coachs > 1 ? 's' : ''} à un autre Responsable Régional pour pouvoir le supprimer.` : undefined}
      libelleSuppression={rr ? `Supprimer ${rr.nom} ? Les magasins qu’il gère en direct n’auront plus de Responsable Régional désigné.` : undefined}
    >
      <ChampsPersonnels f={f} onChange={setF} doublon={doublon} autoFocus={!rr} />
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Couleur sur la carte</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }} role="radiogroup" aria-label="Couleur sur la carte">
          {COULEURS.map((c) => (
            <Box key={c} component="button" type="button" role="radio" aria-checked={couleur === c} aria-label={`Couleur ${c}`} onClick={() => setCouleur(c)}
              sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: c, cursor: 'pointer', border: '3px solid', borderColor: couleur === c ? 'text.primary' : 'transparent', outlineOffset: 2 }} />
          ))}
        </Box>
      </Box>
      <FormControlLabel control={<Switch checked={integres} onChange={(e) => setIntegres(e.target.checked)} />} label="Responsable Magasins Intégrés (rôle transverse, ne manage pas de Coach)" sx={{ minHeight: 48 }} />
    </Fenetre>
  )
}

export function DialogCoach({ reseau, coach, onFermer }: { reseau: Reseau; coach: Coach | null; onFermer: (m?: string, nouveauNom?: string) => void }) {
  const [f, setF] = useFiche(reseau, coach ? { type: 'coach', cle: coach.nom } : null)
  const [rrId, setRrId] = useState(coach?.rr?.id ?? '')
  const [fictif, setFictif] = useState(coach?.fictif ?? false)
  const [dateRattachement, setDateRattachement] = useState(premierDuMois(reseau.jour))
  const rrs = reseau.rrs.filter((r) => !r.integres)
  const nomPropre = nomComplet(f)
  const doublon = nomPropre !== coach?.nom && (reseau.equipe.some((c) => c.nom.toLowerCase() === nomPropre.toLowerCase()) || reseau.rrs.some((r) => r.nom.toLowerCase() === nomPropre.toLowerCase()))
  const changeRR = rrId && rrId !== (coach?.rr?.id ?? '')
  // Magasins suivis aujourd'hui ou plus tard : on ne supprime pas un Coach qui en a encore
  const suivis = coach ? reseau.magasins.filter((m) => coachA(m, reseau.jour) === coach.nom || (m.historiqueCoach.at(-1)?.coach === coach.nom)).length : 0
  return (
    <Fenetre
      titre={coach ? `Modifier ${coach.nom}` : 'Ajouter un Coach'} ouvert large onFermer={(m) => onFermer(m, m ? nomPropre : undefined)}
      valide={fichePersonnelleValide(f) && !doublon}
      enregistrer={async () => {
        if (coach && nomPropre !== coach.nom) await renommerCoach(coach.nom, nomPropre)
        await enregistrerCoach({ nom: nomPropre, telephone: f.telephone.trim(), email: f.email.trim(), ville: f.ville.trim(), fictif, arrivee: f.arrivee })
        if (changeRR) await rattacherCoach(nomPropre, rrId, dateRattachement || reseau.jour)
        await enregistrerFichePersonne({ type: 'coach', cle: nomPropre }, f)
        return coach ? (nomPropre !== coach.nom ? `${coach.nom} s’appelle désormais ${nomPropre}.` : `${nomPropre} est mis à jour.`) : `${nomPropre} est ajouté à l’équipe.`
      }}
      supprimer={coach ? async () => { await supprimerCoach(coach.nom); return `${coach.nom} est retiré de l’équipe.` } : undefined}
      suppressionBloquee={suivis ? `Réaffecte d’abord ses ${suivis} magasin${suivis > 1 ? 's' : ''} pour pouvoir le supprimer.` : undefined}
      libelleSuppression={coach ? `Retirer ${coach.nom} de l’équipe ? L’historique des magasins qu’il a suivis est conservé.` : undefined}
    >
      <ChampsPersonnels f={f} onChange={setF} doublon={doublon} autoFocus={!coach} libelleArrivee={fictif ? 'Arrivée visée' : 'Date d’arrivée'}
        aideNom={coach && nomPropre !== coach.nom ? 'Le nouveau nom sera repris partout : magasins, historique, rattachements, visites.' : undefined} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField select label="Responsable Régional" value={rrId} onChange={(e) => setRrId(e.target.value)}>
          <MenuItem value="" disabled>Choisir</MenuItem>
          {rrs.map((r) => <MenuItem key={r.id} value={r.id}>{r.nom}</MenuItem>)}
        </TextField>
        {changeRR && coach && (
          <ChampMois label="Rattaché à ce Responsable Régional à partir de" value={dateRattachement} onChange={setDateRattachement} jour={reseau.jour} />
        )}
      </Box>
      <FormControlLabel control={<Switch checked={fictif} onChange={(e) => setFictif(e.target.checked)} />} label="Poste à pourvoir (Coach pas encore recruté)" sx={{ minHeight: 48 }} />
    </Fenetre>
  )
}

export const RECRUTEMENT = 'En cours de recrutement'

export function DialogFranchise({ reseau, nom: ancien, magasinsInitiaux = [], onFermer }: { reseau: Reseau; nom: string | null; magasinsInitiaux?: string[]; onFermer: (m?: string, nouveauNom?: string) => void }) {
  const [f, setF] = useFiche(reseau, ancien ? { type: 'franchise', cle: ancien } : null)
  const actuels = ancien ? franchises(reseau).find((x) => x.nom === ancien)?.magasins.map((m) => m.nom) ?? [] : []
  const [magasins, setMagasins] = useState<string[]>(ancien ? actuels : magasinsInitiaux)
  const nom = nomComplet(f)
  const doublon = nom !== ancien && franchises(reseau).some((x) => x.nom.toLowerCase() === nom.toLowerCase())
  const repris = magasins.filter((n) => !actuels.includes(n)).map((n) => reseau.magasins.find((m) => m.nom === n)).filter((m) => m?.responsable && m.responsable.nom !== ancien) as Magasin[]
  const integresSeulement = magasins.length > 0 && magasins.every((n) => reseau.magasins.find((m) => m.nom === n)?.franchise === false)
  return (
    <Fenetre
      titre={ancien ? `Modifier ${ancien}` : 'Ajouter un franchisé'} ouvert large onFermer={(m) => onFermer(m, m ? nom : undefined)}
      valide={fichePersonnelleValide(f) && !doublon && !/recrutement/i.test(nom)}
      enregistrer={async () => {
        await enregistrerFranchise(nom, ancien, magasins, actuels, f, reseau)
        return ancien ? (nom !== ancien ? `${ancien} s’appelle désormais ${nom}.` : `${nom} est mis à jour.`) : `${nom} est ajouté.`
      }}
      supprimer={ancien ? async () => { await supprimerFranchise(ancien, actuels, reseau); return `${ancien} est retiré de ses magasins.` } : undefined}
      libelleSuppression={ancien ? `Retirer ${ancien} ? ${actuels.length ? `Ses ${actuels.length} magasin${actuels.length > 1 ? 's' : ''} n’auront plus de franchisé renseigné.` : ''}` : undefined}
    >
      <ChampsPersonnels f={f} onChange={setF} doublon={doublon} autoFocus={!ancien}
        aideNom={ancien && nom !== ancien ? 'Le nouveau nom sera repris sur tous ses magasins.' : undefined} />
      <Autocomplete
        multiple options={reseau.magasins.map((m) => m.nom)} value={magasins} onChange={(_e, v) => setMagasins(v)}
        renderInput={(p) => <TextField {...p} label="Ses magasins" helperText={repris.length
          ? repris.map((m) => (m.franchise ? `Associé à ${m.responsable!.nom} sur ${m.nom}` : `Remplace ${m.responsable!.nom} sur ${m.nom}`)).join(', ') + '.'
          : integresSeulement ? 'Magasins intégrés : la personne apparaîtra comme responsable de magasin.' : ' '} />}
      />
    </Fenetre>
  )
}
