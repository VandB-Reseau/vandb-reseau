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
import {
  enregistrerCoach, enregistrerDirecteur, enregistrerRR, rattacherCoach, supprimerCoach, supprimerRR,
} from '../data/chargement'
import { coachA } from '../data/charge'
import type { Coach, Reseau, ResponsableRegional } from '../data/modele'

const COULEURS = ['#1b6fce', '#ef7d00', '#2e7d32', '#7c3aed', '#c2185b', '#00838f', '#6d4c41', '#eaa400']
const emailValide = (e: string) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

// Squelette commun : titre, champs, suppression avec confirmation, enregistrement avec message humain
function Fenetre({ titre, ouvert, onFermer, children, valide, enregistrer, supprimer, suppressionBloquee, libelleSuppression }: {
  titre: string; ouvert: boolean; onFermer: (message?: string) => void; children: ReactNode; valide: boolean
  enregistrer: () => Promise<string>; supprimer?: () => Promise<string>; suppressionBloquee?: string; libelleSuppression?: string
}) {
  const theme = useTheme()
  const pleinEcran = useMediaQuery(theme.breakpoints.down('sm'))
  const { recharger } = useReseau()
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(false)
  const [confirmer, setConfirmer] = useState(false)
  const agir = async (action: () => Promise<string>) => {
    setEnvoi(true); setErreur(false)
    try { const message = await action(); recharger(); onFermer(message) } catch { setErreur(true) } finally { setEnvoi(false) }
  }
  return (
    <Dialog open={ouvert} onClose={() => onFermer()} fullScreen={pleinEcran} fullWidth maxWidth="sm" aria-labelledby="titre-edition">
      <DialogTitle id="titre-edition">{titre}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>{children}</Box>
        {confirmer && (
          <Alert severity="warning" sx={{ mt: 2 }} action={<Button color="inherit" onClick={() => supprimer && agir(supprimer)} disabled={envoi} sx={{ minHeight: 48 }}>Supprimer</Button>}>
            {libelleSuppression}
          </Alert>
        )}
        {erreur && <Alert severity="error" sx={{ mt: 2 }}>L’enregistrement n’a pas abouti. Vérifie ta connexion et réessaie.</Alert>}
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

function ChampsContact({ tel, setTel, email, setEmail }: { tel: string; setTel: (v: string) => void; email: string; setEmail: (v: string) => void }) {
  return (
    <>
      <TextField label="Téléphone" type="tel" value={tel} onChange={(e) => setTel(e.target.value)} />
      <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={!emailValide(email)} helperText={emailValide(email) ? ' ' : 'Adresse email incomplète.'} />
    </>
  )
}

export function DialogDirecteur({ reseau, onFermer }: { reseau: Reseau; onFermer: (m?: string) => void }) {
  const d = reseau.directeur
  const [nom, setNom] = useState(d.nom === 'Direction du réseau' ? '' : d.nom)
  const [titre, setTitre] = useState(d.titre)
  const [tel, setTel] = useState(d.telephone ?? '')
  const [email, setEmail] = useState(d.email ?? '')
  return (
    <Fenetre titre="Modifier le Directeur de réseau" ouvert onFermer={onFermer} valide={!!nom.trim() && emailValide(email)}
      enregistrer={async () => { await enregistrerDirecteur({ nom: nom.trim(), titre: titre.trim() || 'Directeur de réseau', telephone: tel.trim(), email: email.trim() }); return 'Fiche du Directeur enregistrée.' }}>
      <TextField label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} required autoFocus />
      <TextField label="Fonction" value={titre} onChange={(e) => setTitre(e.target.value)} />
      <ChampsContact tel={tel} setTel={setTel} email={email} setEmail={setEmail} />
    </Fenetre>
  )
}

export function DialogRR({ reseau, rr, onFermer }: { reseau: Reseau; rr: ResponsableRegional | null; onFermer: (m?: string) => void }) {
  const [nom, setNom] = useState(rr?.nom ?? '')
  const [tel, setTel] = useState(rr?.telephone ?? '')
  const [email, setEmail] = useState(rr?.email ?? '')
  const [couleur, setCouleur] = useState(rr?.couleur ?? COULEURS.find((c) => !reseau.rrs.some((r) => r.couleur === c)) ?? COULEURS[0])
  const [integres, setIntegres] = useState(rr?.integres ?? false)
  const coachs = rr ? reseau.equipe.filter((c) => c.rr?.id === rr.id).length : 0
  const doublon = reseau.rrs.some((r) => r.id !== rr?.id && r.nom.toLowerCase() === nom.trim().toLowerCase())
  return (
    <Fenetre
      titre={rr ? `Modifier ${rr.nom}` : 'Ajouter un Responsable Régional'} ouvert onFermer={onFermer}
      valide={!!nom.trim() && !doublon && emailValide(email)}
      enregistrer={async () => { await enregistrerRR({ id: rr?.id, nom: nom.trim(), telephone: tel.trim(), email: email.trim(), couleur, integres }); return rr ? `${nom.trim()} est mis à jour.` : `${nom.trim()} est ajouté.` }}
      supprimer={rr ? async () => { await supprimerRR(rr.id); return `${rr.nom} est supprimé.` } : undefined}
      suppressionBloquee={coachs ? `Rattache d’abord ses ${coachs} Coach${coachs > 1 ? 's' : ''} à un autre Responsable Régional pour pouvoir le supprimer.` : undefined}
      libelleSuppression={rr ? `Supprimer ${rr.nom} ? Les magasins qu’il gère en direct n’auront plus de Responsable Régional désigné.` : undefined}
    >
      <TextField label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} required autoFocus error={doublon} helperText={doublon ? 'Ce nom existe déjà.' : ' '} />
      <ChampsContact tel={tel} setTel={setTel} email={email} setEmail={setEmail} />
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

export function DialogCoach({ reseau, coach, onFermer }: { reseau: Reseau; coach: Coach | null; onFermer: (m?: string) => void }) {
  const [nom, setNom] = useState(coach?.nom ?? '')
  const [tel, setTel] = useState(coach?.telephone ?? '')
  const [email, setEmail] = useState(coach?.email ?? '')
  const [ville, setVille] = useState(coach?.ville ?? '')
  const [rrId, setRrId] = useState(coach?.rr?.id ?? '')
  const [fictif, setFictif] = useState(coach?.fictif ?? false)
  const [arrivee, setArrivee] = useState(coach?.arrivee ?? '')
  const [dateRattachement, setDateRattachement] = useState(reseau.jour)
  const rrs = reseau.rrs.filter((r) => !r.integres)
  const nomPropre = nom.trim().replace(/\s+/g, ' ')
  const doublon = !coach && (reseau.equipe.some((c) => c.nom.toLowerCase() === nomPropre.toLowerCase()) || reseau.rrs.some((r) => r.nom.toLowerCase() === nomPropre.toLowerCase()))
  const changeRR = rrId && rrId !== (coach?.rr?.id ?? '')
  // Magasins suivis aujourd'hui ou plus tard : on ne supprime pas un Coach qui en a encore
  const suivis = coach ? reseau.magasins.filter((m) => coachA(m, reseau.jour) === coach.nom || (m.historiqueCoach.at(-1)?.coach === coach.nom)).length : 0
  return (
    <Fenetre
      titre={coach ? `Modifier ${coach.nom}` : 'Ajouter un Coach'} ouvert onFermer={onFermer}
      valide={!!nomPropre && !doublon && emailValide(email)}
      enregistrer={async () => {
        await enregistrerCoach({ nom: nomPropre, telephone: tel.trim(), email: email.trim(), ville: ville.trim(), fictif, arrivee })
        if (changeRR) await rattacherCoach(nomPropre, rrId, dateRattachement || reseau.jour)
        return coach ? `${nomPropre} est mis à jour.` : `${nomPropre} est ajouté à l’équipe.`
      }}
      supprimer={coach ? async () => { await supprimerCoach(coach.nom); return `${coach.nom} est retiré de l’équipe.` } : undefined}
      suppressionBloquee={suivis ? `Réaffecte d’abord ses ${suivis} magasin${suivis > 1 ? 's' : ''} pour pouvoir le supprimer.` : undefined}
      libelleSuppression={coach ? `Retirer ${coach.nom} de l’équipe ? L’historique des magasins qu’il a suivis est conservé.` : undefined}
    >
      <TextField label="Prénom et NOM" value={nom} onChange={(e) => setNom(e.target.value)} required autoFocus={!coach} disabled={!!coach}
        error={doublon} helperText={doublon ? 'Cette personne existe déjà dans l’équipe.' : coach ? 'Le nom ne se modifie pas : il relie le Coach à l’historique de ses magasins.' : 'Par exemple : Camille DUPONT'} />
      <ChampsContact tel={tel} setTel={setTel} email={email} setEmail={setEmail} />
      <TextField label="Ville de résidence" value={ville} onChange={(e) => setVille(e.target.value)} helperText="Sert aux suggestions de réaffectation par distance, une fois géolocalisée." />
      <TextField select label="Responsable Régional" value={rrId} onChange={(e) => setRrId(e.target.value)}>
        <MenuItem value="" disabled>Choisir</MenuItem>
        {rrs.map((r) => <MenuItem key={r.id} value={r.id}>{r.nom}</MenuItem>)}
      </TextField>
      {changeRR && coach && (
        <TextField type="date" label="Rattaché à ce Responsable Régional à partir du" value={dateRattachement} onChange={(e) => setDateRattachement(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      )}
      <FormControlLabel control={<Switch checked={fictif} onChange={(e) => setFictif(e.target.checked)} />} label="Poste à pourvoir (Coach pas encore recruté)" sx={{ minHeight: 48 }} />
      <TextField type="date" label={fictif ? 'Arrivée visée' : 'Date d’arrivée'} value={arrivee} onChange={(e) => setArrivee(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} helperText="Facultatif." />
    </Fenetre>
  )
}
