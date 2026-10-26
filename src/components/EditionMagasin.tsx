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
import { enregistrerPosition, geolocaliser } from '../data/geolocalisation'
import { enregistrerMagasin, supprimerMagasin, type FicheMagasin } from '../data/chargement'
import { libelleResponsable, type Figure, type Magasin, type Reseau, type Topographie } from '../data/modele'
import { libellesTopographie, topographieDeduite } from './Blason'
import { figureDeduite, figures } from './FiguresBlason'
import { JOURS, exploitationVide, libellesJour, libellesLicence, libellesTypologie, libellesZone, plageValide, type Exploitation, type Licence, type Typologie, type ZoneChalandise } from '../data/exploitation'

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
    rrDirect: m?.rrEnDirect && m.rr ? m.rr.id : '', topographie: m?.topographie ?? '', figure: m?.figure ?? '',
    exploitation: m?.exploitation ?? exploitationVide(),
  }
}

// Liste à choix avec une option vide
function Choix<T extends string>({ label, value, libelles, onChange }: { label: string; value: T | ''; libelles: Record<T, string>; onChange: (v: T | '') => void }) {
  return (
    <TextField select label={label} value={value} onChange={(e) => onChange(e.target.value as T | '')} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
      <MenuItem value="">Non renseigné</MenuItem>
      {(Object.keys(libelles) as T[]).map((k) => <MenuItem key={k} value={k}>{libelles[k]}</MenuItem>)}
    </TextField>
  )
}

export function DialogMagasin({ reseau, magasin, onFermer }: { reseau: Reseau; magasin: Magasin | null; onFermer: (message?: string, nom?: string) => void }) {
  const [f, setF] = useState<FicheMagasin>(() => depuisMagasin(magasin))
  const champ = (cle: keyof FicheMagasin, libelle: string, extra: Record<string, unknown> = {}) => (
    <TextField label={libelle} value={f[cle] as string} onChange={(e) => setF((x) => ({ ...x, [cle]: e.target.value }))} {...extra} />
  )
  const nom = f.nom.trim().replace(/\s+/g, ' ')
  const doublon = nom !== magasin?.nom && reseau.magasins.some((m) => m.nom.toLowerCase() === nom.toLowerCase())
  const emailsOk = emailValide(f.email)
  // Code à 3 chiffres, propre à chaque magasin (vide : le suivant est donné à l'enregistrement)
  const code = f.code.trim()
  const codePris = !!code && [...reseau.magasins, ...reseau.fermes].find((m) => m.code === code && m.nom !== magasin?.nom)
  const codeOk = (!code || /^\d{3,}$/.test(code)) && !codePris
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
  const ex = f.exploitation ?? exploitationVide()
  const exploiter = (x: Partial<Exploitation>) => setF((y) => ({ ...y, exploitation: { ...(y.exploitation ?? exploitationVide()), ...x } }))
  const horairesOk = JOURS.every((j) => plageValide(ex.horaires[j] ?? ''))
  return (
    <Fenetre
      titre={magasin ? `Modifier ${magasin.nom}` : 'Ajouter un magasin'} ouvert large
      onFermer={(m) => onFermer(m, m ? nom : undefined)}
      valide={!!nom && !doublon && emailsOk && codeOk && horairesOk}
      enregistrer={async () => {
        await enregistrerMagasin({ ...f, code, nom, responsable, ...coordonnees() }, magasin?.nom ?? null)
        // Nouvelle adresse : le point sur la carte suit
        const adresse = (x: { adresse: string; codePostal: string; ville: string; pays: string }) => [x.adresse, x.codePostal, x.ville, x.pays].map((v) => v.trim()).join('|')
        if (!magasin || adresse(f) !== adresse(magasin)) {
          const p = await geolocaliser(f)
          if (p) await enregistrerPosition(nom, p)
        }
        return magasin ? (renomme ? `${magasin.nom} s’appelle désormais ${nom}.` : `${nom} est mis à jour.`) : `${nom} est ajouté au réseau.`
      }}
      supprimer={magasin ? async () => { await supprimerMagasin(magasin.nom); return `${magasin.nom} est supprimé du réseau.` } : undefined}
      libelleSuppression={magasin ? `Supprimer ${magasin.nom} du réseau ? Sa fiche et l’historique de ses Coachs sont effacés. Ses visites sont conservées.` : undefined}
    >
      <Groupe titre="Magasin">
        {champ('nom', 'Nom du magasin', { required: true, autoFocus: !magasin, error: doublon, helperText: doublon ? 'Un magasin porte déjà ce nom.' : renomme ? 'Le nouveau nom sera repris partout : Coachs, visites, chiffres.' : ' ' })}
        {champ('code', 'Code magasin', { error: !codeOk, helperText: codePris ? `Déjà pris par ${codePris.nom}.` : !codeOk ? '3 chiffres.' : ' ', slotProps: { htmlInput: { inputMode: 'numeric' } } })}
        {champ('ouverture', 'Date d’ouverture', { type: 'date', slotProps: { inputLabel: { shrink: true } }, helperText: 'Laisse vide si elle n’est pas encore connue.' })}
        <FormControlLabel control={<Switch checked={f.franchise} onChange={(e) => setF((x) => ({ ...x, franchise: e.target.checked }))} />} label={f.franchise ? 'Magasin franchisé' : 'Magasin intégré'} sx={{ minHeight: 48 }} />
        {f.franchise && <Autocomplete
          freeSolo options={[...connus.map((x) => x.nom), RECRUTEMENT]} value={f.responsable} inputValue={f.responsable}
          onInputChange={(_e, v) => setF((x) => ({ ...x, responsable: v }))}
          renderInput={(p) => <TextField {...p} label={libelleResponsable(f)}
            helperText={!responsable ? undefined : existant || /recrutement/i.test(responsable) ? 'Ses coordonnées se modifient sur sa fiche personnelle.' : 'Nouvelle personne : complète sa fiche ensuite (téléphone, email…).'} />}
        />}
        <TextField select label="Géré en direct par" value={f.rrDirect} onChange={(e) => setF((x) => ({ ...x, rrDirect: e.target.value }))} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
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
        <TextField select label="Forme du blason" value={f.topographie} onChange={(e) => setF((x) => ({ ...x, topographie: e.target.value as FicheMagasin['topographie'] }))}
          slotProps={{ select: { displayEmpty: true, renderValue: (v) => (v ? libellesTopographie[v as Topographie] : `Selon le département (${libellesTopographie[topographieDeduite(f.departement)].toLowerCase()})`) }, inputLabel: { shrink: true } }}>
          <MenuItem value="">Selon le département</MenuItem>
          {(Object.keys(libellesTopographie) as Topographie[]).map((t) => <MenuItem key={t} value={t}>{libellesTopographie[t]}</MenuItem>)}
        </TextField>
        <TextField select label="Figure du blason" value={f.figure} onChange={(e) => setF((x) => ({ ...x, figure: e.target.value as FicheMagasin['figure'] }))}
          slotProps={{ select: { displayEmpty: true, renderValue: (v) => (v ? figures[v as Figure].libelle : `Selon le département (${figures[figureDeduite(f.departement, f.topographie || topographieDeduite(f.departement))].libelle.toLowerCase()})`) }, inputLabel: { shrink: true } }}>
          <MenuItem value="">Selon le département</MenuItem>
          {(Object.keys(figures) as Figure[]).map((k) => (
            <MenuItem key={k} value={k} sx={{ gap: 1.5 }}>
              <Box component="svg" aria-hidden viewBox="0 0 24 24" sx={{ width: 24, height: 24, flexShrink: 0 }}>{figures[k].dessin('currentColor')}</Box>
              {figures[k].libelle}
            </MenuItem>
          ))}
        </TextField>
      </Groupe>
      <Groupe titre="Exploitation">
        <Choix label="Typologie" value={ex.typologie} libelles={libellesTypologie} onChange={(v) => exploiter({ typologie: v as Typologie | '' })} />
        <Choix label="Zone de chalandise" value={ex.zoneChalandise} libelles={libellesZone} onChange={(v) => exploiter({ zoneChalandise: v as ZoneChalandise | '' })} />
        <Choix label="Licence" value={ex.licence} libelles={libellesLicence} onChange={(v) => exploiter({ licence: v as Licence | '' })} />
        <TextField type="date" label="Date d’implantation" value={ex.implantation} onChange={(e) => exploiter({ implantation: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Instagram" value={ex.instagram} onChange={(e) => exploiter({ instagram: e.target.value })} placeholder="https://www.instagram.com/…" />
      </Groupe>
      <Groupe titre="Horaires d’ouverture">
        {JOURS.map((j) => {
          const v = ex.horaires[j] ?? ''
          return (
            <TextField key={j} label={libellesJour[j]} value={v} placeholder="Fermé" error={!plageValide(v)}
              helperText={plageValide(v) ? ' ' : 'Par exemple 10:00-20:00, ou 10:00-13:00, 15:00-20:00.'}
              onChange={(e) => { const h = { ...ex.horaires }; if (e.target.value.trim()) h[j] = e.target.value; else delete h[j]; exploiter({ horaires: h }) }} />
          )
        })}
      </Groupe>
    </Fenetre>
  )
}
