import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Aide } from './Aide'
import { chargerCommentaires, chargerEcartsMagasin, chargerExplicationsEcarts, envoyerCommentaire, type Commentaire } from '../data/pilotage'
import { ancreEcart, CAUSES_ECART, causesDuMois, ecartsDuMois, ecrireExplication, lireAncreEcart, lireExplication, type CauseEcart, type EcartMois } from '../moteur/causesEcarts'
import { MOIS_LONGS, taux } from '../lib/format'

const pts = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} pt`
const valeurEcart = (e: EcartMois) => (e.indicateur === 'ca' ? taux(e.ecart) : pts(e.ecart))

// Clôture du mois (vague 6, 77A) : chaque écart au-delà du seuil d'alerte reçoit une cause et une phrase
export function CausesEcartsMois({ magasin, annee, mois, peutSaisir }: { magasin: string; annee: number; mois: number; peutSaisir: boolean }) {
  const [donnees, setDonnees] = useState<Awaited<ReturnType<typeof chargerEcartsMagasin>> | undefined>(undefined)
  const [commentaires, setCommentaires] = useState<Commentaire[]>([])
  const [choix, setChoix] = useState<Record<string, { cause?: CauseEcart; phrase: string }>>({})
  const [occupe, setOccupe] = useState('')
  const [erreur, setErreur] = useState('')
  const relire = () => chargerCommentaires(magasin, annee).then(setCommentaires, () => setCommentaires([]))
  useEffect(() => {
    let actif = true
    chargerEcartsMagasin(magasin).then((d) => actif && setDonnees(d), () => actif && setDonnees(null))
    void relire()
    return () => { actif = false }
  }, [magasin, annee]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!donnees) return null
  const ecarts = ecartsDuMois(mois, donnees.n, donnees.n1, donnees.budget, donnees.seuils)
  if (!ecarts.length) return null
  const faites = new Map(commentaires.filter((c) => !c.parent).map((c) => [c.ancre, c]))
  const enregistrer = async (e: EcartMois) => {
    const ancre = ancreEcart(annee, mois, e.indicateur), c = choix[ancre]
    if (!c?.cause) return
    setOccupe(ancre); setErreur('')
    try {
      await envoyerCommentaire(magasin, annee, { ancre, libelle: `${e.libelle} en ${MOIS_LONGS[mois - 1]}`, texte: ecrireExplication(c.cause, c.phrase) })
      await relire()
    } catch { setErreur('La cause n’a pas été enregistrée. Vérifie ta connexion, puis réessaie.') } finally { setOccupe('') }
  }
  return (
    <Card component="section" aria-label="Écarts du mois à expliquer" sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
        <Typography variant="h2" sx={{ flex: 1 }}>Écarts de {MOIS_LONGS[mois - 1]} à expliquer</Typography>
        <Aide sujet="causesEcarts" />
      </Box>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2 }}>
        {ecarts.map((e) => {
          const ancre = ancreEcart(annee, mois, e.indicateur), fait = faites.get(ancre), c = choix[ancre] ?? { phrase: '' }
          const lu = fait ? lireExplication(fait.texte) : null
          return (
            <Box component="li" key={ancre} aria-label={e.libelle} sx={{ display: 'grid', gap: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>{e.libelle} : <Box component="span" sx={{ color: 'error.main' }}>{valeurEcart(e)}</Box></Typography>
              {lu ? (
                <Typography variant="body2" sx={{ bgcolor: 'action.hover', borderRadius: 2, px: 1.5, py: 1 }}>
                  <b>{CAUSES_ECART.find((x) => x.cle === lu.cause)!.libelle}</b>{lu.phrase ? ` : ${lu.phrase}` : ''}{fait?.auteurNom ? ` (${fait.auteurNom})` : ''}
                </Typography>
              ) : peutSaisir ? (
                <>
                  <Box role="radiogroup" aria-label={`Cause : ${e.libelle}`} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {CAUSES_ECART.map((x) => (
                      <Chip key={x.cle} role="radio" aria-checked={c.cause === x.cle} label={x.libelle} clickable color={c.cause === x.cle ? 'primary' : 'default'} variant={c.cause === x.cle ? 'filled' : 'outlined'}
                        onClick={() => setChoix((o) => ({ ...o, [ancre]: { ...c, cause: x.cle } }))} sx={{ height: 40, minWidth: 48 }} />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                    <TextField size="small" fullWidth label="En une phrase (facultatif)" value={c.phrase} onChange={(ev) => setChoix((o) => ({ ...o, [ancre]: { ...c, phrase: ev.target.value } }))}
                      slotProps={{ htmlInput: { maxLength: 300 } }} />
                    <Button variant="outlined" disabled={!c.cause || occupe === ancre} onClick={() => void enregistrer(e)} sx={{ minHeight: 48, flexShrink: 0 }}>Enregistrer</Button>
                  </Box>
                </>
              ) : <Typography variant="body2" color="text.secondary">Pas encore expliqué.</Typography>}
            </Box>
          )
        })}
      </Box>
      {erreur && <Alert severity="error" sx={{ mt: 2 }}>{erreur}</Alert>}
    </Card>
  )
}

// Vue d'ensemble du magasin : les causes données pour les derniers mois
export function ExplicationsEcarts({ magasin, annee }: { magasin: string; annee: number }) {
  const [l, setL] = useState<Commentaire[]>([])
  useEffect(() => { chargerCommentaires(magasin, annee).then(setL, () => setL([])) }, [magasin, annee])
  const lignes = l.filter((c) => !c.parent && lireAncreEcart(c.ancre)).map((c) => ({ c, a: lireAncreEcart(c.ancre)!, e: lireExplication(c.texte) }))
    .sort((x, y) => y.a.mois - x.a.mois).slice(0, 6)
  if (!lignes.length) return null
  return (
    <Card component="section" aria-label="Écarts expliqués" sx={{ p: { xs: 2, md: 2.5 } }}>
      <Typography variant="h2" sx={{ mb: 1.5 }}>Écarts expliqués</Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
        {lignes.map(({ c, a, e }) => (
          <Box component="li" key={c.id}>
            <Typography variant="body2"><b>{MOIS_LONGS[a.mois - 1]} · {a.indicateur === 'ca' ? 'CA' : 'Marge'} · {CAUSES_ECART.find((x) => x.cle === e.cause)!.libelle}</b>{e.phrase ? ` : ${e.phrase}` : ''}</Typography>
          </Box>
        ))}
      </Box>
    </Card>
  )
}

// Performance › Face au budget : les causes du dernier mois expliqué, comptées sur les magasins du périmètre
export function CausesEcartsReseau({ annee }: { annee: number }) {
  const [l, setL] = useState<Awaited<ReturnType<typeof chargerExplicationsEcarts>>>([])
  useEffect(() => { chargerExplicationsEcarts(annee).then(setL, () => setL([])) }, [annee])
  const dernier = Math.max(0, ...l.map((c) => lireAncreEcart(c.ancre)?.mois ?? 0))
  if (!dernier) return null
  const causes = causesDuMois(l, annee, dernier)
  const total = causes.reduce((a, x) => a + x.n, 0)
  return (
    <Card component="section" aria-label="Causes des écarts" sx={{ p: { xs: 2, md: 2.5 }, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
        <Typography variant="h2" sx={{ flex: 1 }}>Causes des écarts de {MOIS_LONGS[dernier - 1]} · {total}</Typography>
        <Aide sujet="causesEcarts" />
      </Box>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
        {causes.map((x) => (
          <Box component="li" key={x.cause} sx={{ display: 'grid', gridTemplateColumns: '7rem 1fr 4rem', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body2">{x.libelle}</Typography>
            <Box aria-hidden sx={{ height: 10, borderRadius: 1, bgcolor: 'action.hover' }}><Box sx={{ height: '100%', width: `${(x.n / total) * 100}%`, borderRadius: 1, bgcolor: 'primary.main' }} /></Box>
            <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 700 }}>{Math.round((x.n / total) * 100)} %</Typography>
          </Box>
        ))}
      </Box>
    </Card>
  )
}
