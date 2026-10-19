import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined'
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined'
import { enregistrerGrille } from '../data/chargement'
import { useReseau } from '../data/ReseauContext'
import type { Reseau } from '../data/modele'
import { caseDe, grilleParDefaut, libelleAxe, normaliserGrille, type Axe, type CritereGrille, type GrilleNineBox } from '../data/sante'
import { dateCourte } from '../lib/format'
import { PastilleCase } from './Sante'

const AXES: Axe[] = ['resultats', 'franchise']
type Brouillon = { criteres: (Omit<CritereGrille, 'poids'> & { poids: string })[]; seuilBas: string; seuilHaut: string }

const versBrouillon = (g: GrilleNineBox): Brouillon => ({
  criteres: g.criteres.map((c) => ({ ...c, poids: String(c.poids) })), seuilBas: String(g.seuilBas), seuilHaut: String(g.seuilHaut),
})
const nombre = (s: string) => Number(s.replace(',', '.'))
function versGrille(b: Brouillon): GrilleNineBox {
  return {
    seuilBas: nombre(b.seuilBas), seuilHaut: nombre(b.seuilHaut),
    criteres: b.criteres.map((c) => ({
      id: c.id, libelle: c.libelle.trim(), axe: c.axe, poids: nombre(c.poids),
      ...(c.bloquant ? { bloquant: true } : {}), ...(c.definition?.trim() ? { definition: c.definition.trim() } : {}),
    })),
  }
}
const empreinte = (g: GrilleNineBox) => JSON.stringify([g.seuilBas, g.seuilHaut, g.criteres.map((c) => [c.id, c.libelle, c.axe, c.poids, !!c.bloquant, c.definition ?? ''])])
const pareil = (a: GrilleNineBox, b: GrilleNineBox) => empreinte(a) === empreinte(b)

export function EditeurGrilleNineBox({ reseau }: { reseau: Reseau }) {
  const { recharger } = useReseau()
  const actuelle = reseau.grilleNineBox
  const [b, setB] = useState<Brouillon>(() => versBrouillon(actuelle))
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(false)
  const [ok, setOk] = useState(false)

  const grille = versGrille(b)
  const totaux = Object.fromEntries(AXES.map((axe) => [axe, grille.criteres.filter((c) => c.axe === axe).reduce((a, c) => a + (c.poids || 0), 0)])) as Record<Axe, number>
  const poidsInvalides = b.criteres.filter((c) => c.poids.trim() === '' || isNaN(nombre(c.poids)) || nombre(c.poids) < 0 || nombre(c.poids) > 100).map((c) => c.id)
  const libellesVides = b.criteres.filter((c) => !c.libelle.trim()).map((c) => c.id)
  const doublons = b.criteres.filter((c, i) => c.libelle.trim() && b.criteres.findIndex((x) => x.libelle.trim().toLowerCase() === c.libelle.trim().toLowerCase()) !== i).map((c) => c.id)
  const axeVide = AXES.find((axe) => !grille.criteres.some((c) => c.axe === axe))
  const seuilsOk = grille.seuilBas > 1 && grille.seuilHaut > grille.seuilBas && grille.seuilHaut < 3
  const axeHorsTotal = AXES.find((axe) => Math.abs(totaux[axe] - 100) > 0.01)
  const valide = !poidsInvalides.length && !libellesVides.length && !doublons.length && !axeVide && seuilsOk && !axeHorsTotal
  const modifie = !pareil(grille, actuelle)

  // Magasins dont la case change avec la nouvelle grille
  const nouvelle = valide && modifie ? normaliserGrille(grille) : null
  const changements = !nouvelle ? [] : reseau.magasins.flatMap((m) => {
    const e = reseau.evaluations[m.nom]
    const avant = caseDe(e, actuelle), apres = caseDe(e, nouvelle)
    return avant?.id === apres?.id ? [] : [{ nom: m.nom, avant, apres }]
  })

  const changer = (id: string, ch: Partial<Brouillon['criteres'][number]>) => setB((x) => ({ ...x, criteres: x.criteres.map((c) => (c.id === id ? { ...c, ...ch } : c)) }))
  const retirer = (id: string) => setB((x) => ({ ...x, criteres: x.criteres.filter((c) => c.id !== id) }))
  const ajouter = (axe: Axe) => setB((x) => {
    const id = `c${Date.now().toString(36)}`
    const i = x.criteres.map((c) => c.axe).lastIndexOf(axe)
    const l = [...x.criteres]
    l.splice(i + 1, 0, { id, libelle: '', axe, poids: '0' })
    return { ...x, criteres: l }
  })
  // Échange un critère avec son voisin du même axe
  const deplacer = (id: string, sens: -1 | 1) => setB((x) => {
    const c = x.criteres.find((y) => y.id === id)!
    const memeAxe = x.criteres.filter((y) => y.axe === c.axe)
    const j = memeAxe.indexOf(c) + sens
    if (j < 0 || j >= memeAxe.length) return x
    const autre = memeAxe[j]
    return { ...x, criteres: x.criteres.map((y) => (y.id === id ? autre : y.id === autre.id ? c : y)) }
  })

  const enregistrer = async () => {
    setEnvoi(true); setErreur(false)
    try { await enregistrerGrille(normaliserGrille(grille), reseau.jour); await recharger(); setOk(true) } catch { setErreur(true) } finally { setEnvoi(false) }
  }

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Typography variant="h3" component="h2" sx={{ flex: 1 }}>Grille de la nine box</Typography>
          {actuelle.modifieLe && <Typography variant="body2" color="text.secondary">Modifiée le {dateCourte(actuelle.modifieLe)}</Typography>}
        </Box>
        {AXES.map((axe) => {
          const liste = b.criteres.filter((c) => c.axe === axe)
          const total = totaux[axe]
          return (
            <Box key={axe} component="section" aria-label={`Critères ${libelleAxe(axe)}`} sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Typography variant="h4" component="h3" sx={{ flex: 1 }}>{libelleAxe(axe)}</Typography>
                <Chip label={`Total ${Math.round(total * 100) / 100} %`} color={Math.abs(total - 100) > 0.01 ? 'error' : 'success'} variant="outlined" sx={{ fontSize: 13 }} />
              </Box>
              {liste.map((c, i) => (
                <Box key={c.id} sx={{ display: 'grid', gap: 1.5, alignItems: 'start', py: 1.5, borderTop: 1, borderColor: 'divider',
                  gridTemplateColumns: { xs: '1fr 110px', md: 'minmax(200px, 1.2fr) 110px minmax(200px, 2fr) auto auto' } }}>
                  <TextField size="small" label="Critère" value={c.libelle} onChange={(e) => changer(c.id, { libelle: e.target.value })}
                    error={libellesVides.includes(c.id) || doublons.includes(c.id)} helperText={libellesVides.includes(c.id) ? 'Nom obligatoire' : doublons.includes(c.id) ? 'Déjà utilisé' : undefined}
                    sx={{ '& .MuiInputBase-root': { minHeight: 48 } }} />
                  <TextField size="small" label="Poids (%)" value={c.poids} onChange={(e) => changer(c.id, { poids: e.target.value })} error={poidsInvalides.includes(c.id)}
                    slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': `Poids de ${c.libelle || 'ce critère'}` } }} sx={{ '& .MuiInputBase-root': { minHeight: 48 } }} />
                  <TextField size="small" label="Définition" value={c.definition ?? ''} onChange={(e) => changer(c.id, { definition: e.target.value })}
                    sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, '& .MuiInputBase-root': { minHeight: 48 } }} />
                  <FormControlLabel control={<Checkbox checked={!!c.bloquant} onChange={(e) => changer(c.id, { bloquant: e.target.checked })} />} label="Bloquant" sx={{ minHeight: 48, m: 0 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <IconButton aria-label={`Monter ${c.libelle}`} disabled={i === 0} onClick={() => deplacer(c.id, -1)} sx={{ width: 48, height: 48 }}><ArrowUpwardOutlined /></IconButton>
                    <IconButton aria-label={`Descendre ${c.libelle}`} disabled={i === liste.length - 1} onClick={() => deplacer(c.id, 1)} sx={{ width: 48, height: 48 }}><ArrowDownwardOutlined /></IconButton>
                    <IconButton aria-label={`Supprimer ${c.libelle}`} disabled={liste.length <= 1} onClick={() => retirer(c.id)} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton>
                  </Box>
                </Box>
              ))}
              <Button startIcon={<AddOutlined />} onClick={() => ajouter(axe)} sx={{ minHeight: 48, mt: 0.5 }}>Ajouter un critère</Button>
            </Box>
          )
        })}

        <Typography variant="h4" component="h3" sx={{ mb: 1.5 }}>Seuils</Typography>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <TextField label="Faible en dessous de" value={b.seuilBas} onChange={(e) => setB((x) => ({ ...x, seuilBas: e.target.value }))} error={!seuilsOk}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
          <TextField label="Fort à partir de" value={b.seuilHaut} onChange={(e) => setB((x) => ({ ...x, seuilHaut: e.target.value }))} error={!seuilsOk}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        </Box>

        {axeHorsTotal && <Alert severity="warning" sx={{ mt: 2 }}>Les poids {axeHorsTotal === 'resultats' ? 'des Résultats' : 'du Franchisé'} font {Math.round(totaux[axeHorsTotal] * 100) / 100} % au lieu de 100 %.</Alert>}
        {!seuilsOk && <Alert severity="warning" sx={{ mt: 2 }}>Les seuils doivent être entre 1 et 3, le premier plus petit que le second.</Alert>}
        {modifie && valide && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {changements.length === 0 ? 'Aucun magasin ne change de case.' : `${changements.length} magasin${changements.length > 1 ? 's changent' : ' change'} de case.`}
            {changements.length > 0 && (
              <Box component="ul" aria-label="Magasins qui changent de case" sx={{ listStyle: 'none', p: 0, m: 0, mt: 1, maxHeight: 320, overflowY: 'auto' }}>
                {changements.map((x) => (
                  <Box component="li" key={x.nom} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', py: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 160 }}>{x.nom}</Typography>
                    <PastilleCase c={x.avant} />
                    <Typography variant="body2" aria-hidden>→</Typography>
                    <PastilleCase c={x.apres} />
                  </Box>
                ))}
              </Box>
            )}
          </Alert>
        )}
        {erreur && <Alert severity="error" sx={{ mt: 2 }}>La grille n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.</Alert>}
        <Box sx={{ display: 'flex', gap: 1, mt: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button startIcon={<RestartAltOutlined />} disabled={envoi || pareil(grille, grilleParDefaut)} onClick={() => setB(versBrouillon(grilleParDefaut))} sx={{ minHeight: 48, mr: 'auto' }}>Grille par défaut</Button>
          <Button disabled={!modifie || envoi} onClick={() => setB(versBrouillon(actuelle))} sx={{ minHeight: 48 }}>Annuler</Button>
          <Button variant="contained" disabled={!modifie || envoi || !valide} onClick={enregistrer} sx={{ minHeight: 48 }}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </Box>
      </CardContent>
      <Snackbar open={ok} autoHideDuration={5000} onClose={() => setOk(false)} message="Grille de la nine box enregistrée." />
    </Card>
  )
}
