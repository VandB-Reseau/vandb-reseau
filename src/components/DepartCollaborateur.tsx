import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import LogoutOutlined from '@mui/icons-material/LogoutOutlined'
import { Fenetre } from './EditionEquipe'
import { rond } from './Portefeuille'
import { ChampDate } from './ChampDate'
import { ChampMois, premierDuMois } from './ChampMois'
import { enregistrerCoach, enregistrerFichePersonne, enregistrerRR, organiserDepart, rattacherCoach, type Reprise } from '../data/chargement'
import { coachA } from '../data/charge'
import { actionsDes, portePar } from '../data/actions'
import { departDe, ficheVide, nomComplet, type RefPersonne } from '../data/personnes'
import { dateCourte } from '../lib/format'
import type { Coach, Reseau, ResponsableRegional } from '../data/modele'

// Départ d'un Coach ou d'un Responsable Régional et reprise par un remplaçant (Joseph, 18/11/2026).
// Le remplaçant est un collaborateur en poste ou un nouveau, créé ici ; il reprend magasins, Coachs, visites
// prévues après le départ et tâches en cours. L'historique (visites faites, affectations passées) reste au partant.

const NOUVEAU = '__nouveau'
const lendemain = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) }
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

// Ce que le partant laisse : calculé sur le réseau, à la date de départ
export function aReprendre(reseau: Reseau, personne: RefPersonne, nom: string, depart: string) {
  const coach = personne.type === 'coach'
  const magasins = (coach
    ? reseau.magasins.filter((m) => coachA(m, lendemain(depart)) === nom || m.historiqueCoach.at(-1)?.coach === nom)
    : reseau.magasins.filter((m) => m.rr?.id === personne.cle && m.rrEnDirect)).map((m) => m.nom)
  const coachs = coach ? [] : reseau.equipe.filter((c) => c.rr?.id === personne.cle).map((c) => c.nom)
  const visites = reseau.visites.filter((v) => v.id !== null && v.date > depart && v.visiteurs.includes(nom)).map((v) => ({ id: v.id as number, visiteurs: v.visiteurs }))
  const taches = actionsDes(reseau, null).filter((x) => !x.a.faite && !x.campagne && portePar(x.a, nom))
  return { magasins, coachs, visites, taches }
}

export function DialogDepart({ reseau, personne, nom, onFermer }: { reseau: Reseau; personne: RefPersonne; nom: string; onFermer: (m?: string) => void }) {
  const coach = personne.type === 'coach'
  const deja = departDe(reseau, personne)
  const lui: Coach | ResponsableRegional | undefined = coach
    ? [...reseau.equipe, ...(reseau.anciens?.coachs ?? [])].find((c) => c.nom === nom)
    : [...reseau.rrs, ...(reseau.anciens?.rrs ?? [])].find((r) => r.id === personne.cle)
  const [depart, setDepart] = useState(deja || reseau.jour)
  const [remplacant, setRemplacant] = useState('')
  const [prenom, setPrenom] = useState('')
  const [nomFamille, setNomFamille] = useState('')
  const [aRecruter, setARecruter] = useState(false)
  const [mois, setMois] = useState(premierDuMois(lendemain(deja || reseau.jour)))
  const [exclus, setExclus] = useState<Set<string>>(new Set())
  const basculer = (k: string) => setExclus((e) => { const n = new Set(e); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const dateValide = /^\d{4}-\d{2}-\d{2}$/.test(depart)
  const reste = aReprendre(reseau, personne, nom, dateValide ? depart : reseau.jour)
  const candidats = coach
    ? reseau.equipe.filter((c) => c.nom !== nom).map((c) => ({ cle: c.nom, libelle: c.fictif ? `${c.nom} (poste à pourvoir)` : c.nom }))
    : reseau.rrs.filter((r) => r.id !== personne.cle && !r.integres).map((r) => ({ cle: r.id, libelle: r.nom }))
  const nouveauNom = nomComplet({ prenom, nom: nomFamille })
  const doublon = remplacant === NOUVEAU && !!nouveauNom && [...reseau.equipe, ...reseau.rrs, ...(reseau.anciens?.coachs ?? []), ...(reseau.anciens?.rrs ?? [])].some((p) => p.nom.toLowerCase() === nouveauNom.toLowerCase())
  const avecRemplacant = !!remplacant && dateValide
  const valide = (dateValide || (!!deja && !depart)) && (remplacant !== NOUVEAU || (!!nomFamille.trim() && !doublon))
  const blocs = [
    { cle: 'magasins', libelle: pluriel(reste.magasins.length, 'magasin'), detail: reste.magasins.join(', '), n: reste.magasins.length },
    { cle: 'coachs', libelle: pluriel(reste.coachs.length, 'Coach'), detail: reste.coachs.join(', '), n: reste.coachs.length },
    { cle: 'visites', libelle: `${pluriel(reste.visites.length, 'visite')} prévue${reste.visites.length > 1 ? 's' : ''} après son départ`, detail: '', n: reste.visites.length },
    { cle: 'taches', libelle: `${pluriel(reste.taches.length, 'tâche')} en cours`, detail: '', n: reste.taches.length },
  ].filter((b) => b.n > 0)

  const enregistrer = async () => {
    if (!depart) {
      await organiserDepart(reseau, { personne, nom, depart: '', remplacant: '', mois, magasins: [], coachs: [], visites: [], taches: [] })
      return `Le départ de ${nom} est annulé.`
    }
    let nomRemplacant = '', rrRemplacant: string | undefined
    if (remplacant === NOUVEAU) {
      const arrivee = lendemain(depart)
      nomRemplacant = nouveauNom
      if (coach) {
        const c = lui as Coach | undefined
        await enregistrerCoach({ nom: nouveauNom, telephone: '', email: '', ville: c?.ville ?? '', fictif: aRecruter, arrivee })
        if (c?.rr) await rattacherCoach(nouveauNom, c.rr.id, mois)
        await enregistrerFichePersonne({ type: 'coach', cle: nouveauNom }, { ...ficheVide(), prenom: prenom.trim(), nom: nomFamille.trim(), arrivee, ville: c?.ville ?? '' })
      } else {
        const r = lui as ResponsableRegional | undefined
        rrRemplacant = await enregistrerRR({ nom: nouveauNom, telephone: '', email: '', couleur: r?.couleur ?? '#307672', integres: !!r?.integres, naissance: '', arrivee })
        await enregistrerFichePersonne({ type: 'rr', cle: rrRemplacant }, { ...ficheVide(), prenom: prenom.trim(), nom: nomFamille.trim(), arrivee })
      }
    } else if (remplacant) {
      if (coach) nomRemplacant = remplacant
      else { rrRemplacant = remplacant; nomRemplacant = reseau.rrs.find((r) => r.id === remplacant)?.nom ?? '' }
    }
    const garde = (k: string) => !!nomRemplacant && !exclus.has(k)
    const reprise: Reprise = {
      personne, nom, depart, remplacant: nomRemplacant, mois, rrRemplacant,
      magasins: garde('magasins') ? reste.magasins : [],
      coachs: garde('coachs') ? reste.coachs : [],
      visites: garde('visites') ? reste.visites : [],
      taches: garde('taches') ? reste.taches.map((x) => (x.libre ? { libre: x.libre.id, magasin: x.magasin } : { visite: x.visite!.id as number, plan: x.visite!.plan })) : [],
    }
    // Une visite peut porter plusieurs tâches : son plan n'est réécrit qu'une fois
    reprise.taches = reprise.taches.filter((t, i, l) => !('visite' in t) || l.findIndex((u) => 'visite' in u && u.visite === t.visite) === i)
    await organiserDepart(reseau, reprise)
    const repris = blocs.filter((b) => garde(b.cle)).map((b) => (b.cle === 'visites' ? pluriel(b.n, 'visite') : b.cle === 'taches' ? pluriel(b.n, 'tâche') : b.libelle))
    return nomRemplacant
      ? `${nom} part le ${dateCourte(depart)}. ${nomRemplacant} reprend ${repris.length ? repris.join(', ') : 'son poste'}.`
      : `${nom} part le ${dateCourte(depart)}.`
  }

  return (
    <Fenetre titre={`Départ de ${nom}`} ouvert large onFermer={onFermer} valide={valide} enregistrer={enregistrer}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <ChampDate label="Dernier jour" value={depart} onChange={(e) => { setDepart(e.target.value); if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setMois(premierDuMois(lendemain(e.target.value))) }}
          helperText={deja && !depart ? 'Sans date, le départ est annulé.' : undefined} />
        <TextField select label="Remplacé par" value={remplacant} onChange={(e) => setRemplacant(e.target.value)}>
          <MenuItem value="">Personne pour l’instant</MenuItem>
          <MenuItem value={NOUVEAU}>{coach ? 'Un nouveau Coach' : 'Un nouveau Responsable Régional'}</MenuItem>
          {candidats.map((c) => <MenuItem key={c.cle} value={c.cle}>{c.libelle}</MenuItem>)}
        </TextField>
      </Box>
      {remplacant === NOUVEAU && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField label="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} autoFocus />
          <TextField label="Nom" required value={nomFamille} onChange={(e) => setNomFamille(e.target.value.toLocaleUpperCase('fr'))}
            error={doublon} helperText={doublon ? 'Cette personne existe déjà' : undefined} />
          {coach && <FormControlLabel control={<Switch checked={aRecruter} onChange={(e) => setARecruter(e.target.checked)} />} label="Pas encore recruté (poste à pourvoir)" sx={{ minHeight: 48 }} />}
        </Box>
      )}
      {avecRemplacant && (
        <>
          {(reste.magasins.length > 0 || reste.coachs.length > 0) && (
            <ChampMois label={coach ? 'Magasins repris à partir de' : 'Repris à partir de'} value={mois} onChange={setMois} jour={reseau.jour} />
          )}
          <Box role="group" aria-label="Ce que reprend le remplaçant">
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Reprend</Typography>
            {blocs.length === 0
              ? <Typography variant="body2" color="text.secondary">Rien à reprendre : aucun magasin, visite prévue ni tâche en cours à son nom.</Typography>
              : blocs.map((b) => (
                <Box key={b.cle}>
                  <FormControlLabel control={<Checkbox checked={!exclus.has(b.cle)} onChange={() => basculer(b.cle)} />} label={b.libelle} sx={{ minHeight: 48 }} />
                  {b.detail && <Typography variant="body2" color="text.secondary" sx={{ pl: 4, mt: -1, mb: 0.5 }}>{b.detail}</Typography>}
                </Box>
              ))}
          </Box>
        </>
      )}
    </Fenetre>
  )
}

// Picto de la fiche, à côté de « Modifier » : départ et remplacement (ou modification d'un départ déjà posé)
// Sur téléphone, la bande du nom n'a pas la place d'un picto de plus : le bouton se met dans la vue d'ensemble (forme « bouton »)
export function BoutonDepart({ reseau, personne, nom, signaler, bouton }: { reseau: Reseau; personne: RefPersonne; nom: string; signaler: (m: string) => void; bouton?: boolean }) {
  const [ouvert, setOuvert] = useState(false)
  const deja = departDe(reseau, personne)
  return (
    <>
      {bouton
        ? <Button variant="outlined" fullWidth startIcon={<LogoutOutlined />} onClick={() => setOuvert(true)} sx={{ minHeight: 48 }}>{deja ? 'Modifier le départ' : 'Départ et remplacement'}</Button>
        : <Tooltip title={deja ? 'Modifier le départ' : 'Départ et remplacement'}><IconButton onClick={() => setOuvert(true)} aria-label={deja ? 'Modifier le départ' : 'Départ et remplacement'} sx={rond}><LogoutOutlined /></IconButton></Tooltip>}
      {ouvert && <DialogDepart reseau={reseau} personne={personne} nom={nom} onFermer={(m) => { setOuvert(false); if (m) signaler(m) }} />}
    </>
  )
}
