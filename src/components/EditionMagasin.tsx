import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Autocomplete from '@mui/material/Autocomplete'
import { Fenetre, RECRUTEMENT } from './EditionEquipe'
import { departementDepuisCP, estFrance, fichePersonne, franchises } from '../data/personnes'
import { enregistrerMagasin, supprimerMagasin, type FicheMagasin } from '../data/chargement'
import { libelleResponsable, type Magasin, type Reseau } from '../data/modele'

const emailValide = (e: string) => !e.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

function Groupe({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle2" component="h3" sx={{ mb: 1.5 }}>{titre}</Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>{children}</Box>
    </Box>
  )
}

function depuisMagasin(m: Magasin | null): FicheMagasin {
  return {
    nom: m?.nom ?? '', code: m?.code ?? '', departement: m?.departement ?? '', ouverture: m?.ouvertureConnue ? m.ouverture : '',
    franchise: m?.franchise ?? true, telephone: m?.telephone ?? '', email: m?.email ?? '',
    adresse: m?.adresse ?? '', codePostal: m?.codePostal ?? '', ville: m?.ville ?? '', pays: m?.pays ?? '',
    responsable: m?.responsable?.nom ?? (m?.responsableARecruter ? RECRUTEMENT : ''),
    telResponsable: m?.responsable?.telephone ?? '', emailResponsable: m?.responsable?.email ?? '',
    rrDirect: m?.rrEnDirect && m.rr ? m.rr.id : '',
  }
}

export function DialogMagasin({ reseau, magasin, onFermer }: { reseau: Reseau; magasin: Magasin | null; onFermer: (message?: string, nom?: string) => void }) {
  const [f, setF] = useState<FicheMagasin>(() => depuisMagasin(magasin))
  const champ = (cle: keyof FicheMagasin, libelle: string, extra: Record<string, unknown> = {}) => (
    <TextField label={libelle} value={f[cle] as string} onChange={(e) => setF((x) => ({ ...x, [cle]: e.target.value }))} {...extra} />
  )
  const nom = f.nom.trim().replace(/\s+/g, ' ')
  const doublon = nom !== magasin?.nom && reseau.magasins.some((m) => m.nom.toLowerCase() === nom.toLowerCase())
  const emailsOk = emailValide(f.email)
  const connus = franchises(reseau)
  const responsable = f.responsable.trim().replace(/\s+/g, ' ')
  const existant = connus.find((x) => x.nom === responsable)
  // Les coordonnées du franchisé viennent de sa fiche personnelle
  const coordonnees = () => {
    if (!responsable || /recrutement/i.test(responsable)) return { telResponsable: '', emailResponsable: '' }
    if (responsable === magasin?.responsable?.nom) return { telResponsable: f.telResponsable, emailResponsable: f.emailResponsable }
    const p = existant ? fichePersonne(reseau, { type: 'franchise', cle: responsable }) : null
    return { telResponsable: p?.telephone ?? '', emailResponsable: p?.email ?? '' }
  }
  const renomme = !!magasin && nom !== magasin.nom
  return (
    <Fenetre
      titre={magasin ? `Modifier ${magasin.nom}` : 'Ajouter un magasin'} ouvert large
      onFermer={(m) => onFermer(m, m ? nom : undefined)}
      valide={!!nom && !doublon && emailsOk}
      enregistrer={async () => {
        await enregistrerMagasin({ ...f, nom, responsable, ...coordonnees() }, magasin?.nom ?? null)
        return magasin ? (renomme ? `${magasin.nom} s’appelle désormais ${nom}.` : `${nom} est mis à jour.`) : `${nom} est ajouté au réseau.`
      }}
      supprimer={magasin ? async () => { await supprimerMagasin(magasin.nom); return `${magasin.nom} est supprimé du réseau.` } : undefined}
      libelleSuppression={magasin ? `Supprimer ${magasin.nom} du réseau ? Sa fiche et l’historique de ses Coachs sont effacés. Ses visites sont conservées.` : undefined}
    >
      <Groupe titre="Magasin">
        {champ('nom', 'Nom du magasin', { required: true, autoFocus: !magasin, error: doublon, helperText: doublon ? 'Un magasin porte déjà ce nom.' : renomme ? 'Le nouveau nom sera repris partout : Coachs, visites, chiffres.' : ' ' })}
        {champ('code', 'Code magasin')}
        {champ('ouverture', 'Date d’ouverture', { type: 'date', slotProps: { inputLabel: { shrink: true } }, helperText: 'Laisse vide si elle n’est pas encore connue.' })}
        <FormControlLabel control={<Switch checked={f.franchise} onChange={(e) => setF((x) => ({ ...x, franchise: e.target.checked }))} />} label={f.franchise ? 'Magasin franchisé' : 'Magasin intégré'} sx={{ minHeight: 48 }} />
        <Autocomplete
          freeSolo options={[...connus.map((x) => x.nom), RECRUTEMENT]} value={f.responsable} inputValue={f.responsable}
          onInputChange={(_e, v) => setF((x) => ({ ...x, responsable: v }))}
          renderInput={(p) => <TextField {...p} label={libelleResponsable(f)}
            helperText={!responsable ? 'Choisis une personne existante ou tape un nouveau nom.' : existant || /recrutement/i.test(responsable) ? 'Ses coordonnées se modifient sur sa fiche personnelle.' : 'Nouvelle personne : complète sa fiche ensuite (téléphone, email…).'} />}
        />
        <TextField select label="Géré en direct par" value={f.rrDirect} onChange={(e) => setF((x) => ({ ...x, rrDirect: e.target.value }))} helperText="Seulement si un Responsable Régional gère ce magasin sans Coach." slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">Personne (suivi par son Coach)</MenuItem>
          {reseau.rrs.filter((r) => !r.integres).map((r) => <MenuItem key={r.id} value={r.id}>{r.nom}</MenuItem>)}
        </TextField>
      </Groupe>
      <Groupe titre="Coordonnées">
        {champ('telephone', 'Téléphone du magasin', { type: 'tel' })}
        {champ('email', 'Email du magasin', { type: 'email', error: !emailValide(f.email), helperText: emailValide(f.email) ? ' ' : 'Adresse email incomplète.' })}
        {champ('adresse', 'Adresse')}
        <TextField label="Code postal" value={f.codePostal} onChange={(e) => { const cp = e.target.value; const d = estFrance(f.pays) ? departementDepuisCP(cp) : ''; setF((x) => ({ ...x, codePostal: cp, ...(d ? { departement: d } : {}) })) }} />
        {champ('ville', 'Ville')}
        {champ('departement', 'Département')}
        {champ('pays', 'Pays', { helperText: 'Laisse vide pour la France.' })}
      </Groupe>
      {magasin && <Typography variant="body2" color="text.secondary">Pour changer de Coach, utilise « Réaffecter » sur la fiche : l’historique est ainsi conservé.</Typography>}
    </Fenetre>
  )
}
