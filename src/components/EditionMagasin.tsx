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
import { enregistrerDeploiements, enregistrerEvaluations, enregistrerMagasin, supprimerMagasin, type FicheMagasin } from '../data/chargement'
import { BoutonsOption, NotesParAxe, PastilleCase } from './Sante'
import { caseDe, depuisDeploiement, type Evaluation, type IdCritere, type Note } from '../data/sante'
import { libelleResponsable, type Figure, type Magasin, type Reseau, type Topographie } from '../data/modele'
import { libellesTopographie, topographieDeduite } from './Blason'
import { figureDeduite, figures } from './FiguresBlason'

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
  }
}

export function DialogMagasin({ reseau, magasin, onFermer }: { reseau: Reseau; magasin: Magasin | null; onFermer: (message?: string, nom?: string) => void }) {
  const [f, setF] = useState<FicheMagasin>(() => depuisMagasin(magasin))
  const notesInitiales = (magasin && reseau.evaluations[magasin.nom]?.notes) || {}
  const depsInitiaux = (magasin && reseau.deploiements.valeurs[magasin.nom]) || {}
  const [notes, setNotes] = useState<Partial<Record<IdCritere, Note>>>(() => ({ ...notesInitiales }))
  const [deps, setDeps] = useState<Record<string, string>>(() => ({ ...depsInitiaux }))
  const [dateChangement, setDateChangement] = useState(reseau.jour)
  // Chaque déploiement a sa date : celle depuis laquelle l'état est en place, celle du jour dès qu'il change
  const datesInitiales = Object.fromEntries(reseau.deploiements.thematiques.map((t) => [t.id, magasin ? depuisDeploiement(reseau.deploiements, magasin.nom, t.id) : '']))
  const [datesDeps, setDatesDeps] = useState<Record<string, string>>(() => ({ ...datesInitiales }))
  const noter = (c: IdCritere, n: Note | null) => setNotes((x) => { const y = { ...x }; if (n === null) delete y[c]; else y[c] = n; return y })
  const deployer = (t: string, v: string | null) => {
    setDeps((x) => { const y = { ...x }; if (v) y[t] = v; else delete y[t]; return y })
    setDatesDeps((x) => (x[t] === datesInitiales[t] ? { ...x, [t]: reseau.jour } : x))
  }
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
  return (
    <Fenetre
      titre={magasin ? `Modifier ${magasin.nom}` : 'Ajouter un magasin'} ouvert large
      onFermer={(m) => onFermer(m, m ? nom : undefined)}
      valide={!!nom && !doublon && emailsOk && codeOk}
      enregistrer={async () => {
        await enregistrerMagasin({ ...f, code, nom, responsable, ...coordonnees() }, magasin?.nom ?? null)
        // Nouvelle adresse : le point sur la carte suit
        const adresse = (x: { adresse: string; codePostal: string; ville: string; pays: string }) => [x.adresse, x.codePostal, x.ville, x.pays].map((v) => v.trim()).join('|')
        if (!magasin || adresse(f) !== adresse(magasin)) {
          const p = await geolocaliser(f)
          if (p) await enregistrerPosition(nom, p)
        }
        if (magasin) {
          if (JSON.stringify(notes) !== JSON.stringify(notesInitiales)) {
            const e: Evaluation = { notes, date: dateChangement, par: reseau.directeur.nom }
            await enregistrerEvaluations([{ magasin: nom, e }])
          }
          // État changé, ou date seule reprise (l'état en place remonte à cette date)
          const changes = reseau.deploiements.thematiques.filter((t) => (deps[t.id] ?? '') !== (depsInitiaux[t.id] ?? '') || (deps[t.id] && datesDeps[t.id] !== datesInitiales[t.id]))
          if (changes.length) await enregistrerDeploiements(changes.map((t) => ({ magasin: nom, thematique: t.id, etat: deps[t.id] ?? '', date: datesDeps[t.id] || reseau.jour })), reseau.jour)
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
        <Autocomplete
          freeSolo options={[...connus.map((x) => x.nom), RECRUTEMENT]} value={f.responsable} inputValue={f.responsable}
          onInputChange={(_e, v) => setF((x) => ({ ...x, responsable: v }))}
          renderInput={(p) => <TextField {...p} label={libelleResponsable(f)}
            helperText={!responsable ? undefined : existant || /recrutement/i.test(responsable) ? 'Ses coordonnées se modifient sur sa fiche personnelle.' : 'Nouvelle personne : complète sa fiche ensuite (téléphone, email…).'} />}
        />
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
      {magasin && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography variant="subtitle2" component="h3" sx={{ flex: 1 }}>Santé (nine box)</Typography>
            <PastilleCase c={caseDe({ notes, date: '', par: '' })} />
          </Box>
          <TextField type="date" label="Date du classement" value={dateChangement} onChange={(e) => setDateChangement(e.target.value || reseau.jour)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: reseau.jour } }} sx={{ mb: 2, minWidth: 280 }} />
          <NotesParAxe integre={!f.franchise} notes={notes} noter={noter} />
        </Box>
      )}
      {magasin && (
        <Box>
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1.5 }}>Déploiements</Typography>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            {reseau.deploiements.thematiques.map((t) => (
              <Box key={t.id} sx={{ overflowX: 'auto' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{t.libelle}</Typography>
                <BoutonsOption t={t} libelle={t.libelle} valeur={deps[t.id] ?? ''} onChange={(v) => deployer(t.id, v)} />
                {deps[t.id] && (
                  <Box><TextField type="date" size="small" label={`Date : ${t.libelle}`} value={datesDeps[t.id] ?? ''} onChange={(e) => { const v = e.target.value; setDatesDeps((x) => ({ ...x, [t.id]: v })) }}
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: reseau.jour } }} sx={{ mt: 1.5, minWidth: 200, '& .MuiInputBase-root': { minHeight: 48 } }} /></Box>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Fenetre>
  )
}
