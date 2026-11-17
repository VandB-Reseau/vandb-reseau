import { LigneVide } from './Section'
import { useEffect, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import CheckCircle from '@mui/icons-material/CheckCircle'
import InventoryOutlined from '@mui/icons-material/Inventory2Outlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import { analyser, decalerMois, formatEuros, formatPourcent, libelleMois, moisPrecedent } from '../data/chiffres'
import { actionsDes, echeanceDate, enRetard } from '../data/actions'
import type { Magasin, Reseau } from '../data/modele'
import { dateCourte, lienFiche } from '../lib/format'
import { phraseCADuMois } from '../pilotage/moteur/phrases'
import { chargerStocks, enregistrerStock } from '../pilotage/data/pilotage'
import { nombre } from '../pilotage/import/caisse'
import { enChiffres } from '../pilotage/lib/format'
import type { StockSaisi } from '../pilotage/moteur/stock'
import { Pastille } from './Social'
import { styleChiffre } from '../theme/theme'

// 222 (Joseph, 16/11/2026) : sur le téléphone, l'accueil du franchisé s'ouvre sur un chiffre (le CA du dernier mois
// face à N-1) et une seule chose à faire maintenant, avant l'actualité. Ordre : clôture du mois non faite, tâche en
// retard, tâche à rendre dans les 7 jours ; sinon « rien d'urgent ».
// 223 : la clôture se fait d'ici, en trois écrans (stocks repris du mois précédent, vérification, c'est fait).

const UNIVERS = [['cave', 'Cave'], ['bar', 'Bar'], ['exterieur', 'Extérieur']] as const
type Univers = typeof UNIVERS[number][0]
const SEUIL_VERIFIER = 30 // % de variation d'un univers face au mois précédent au-delà duquel on fait relire

const couleurEcart = (e: number | null) => (e === null ? 'text.secondary' : e < 0 ? 'error.main' : 'success.main')
const nomDuMois = (mois: string) => libelleMois(mois).split(' ')[0].toLowerCase()

interface EtatStocks { saisi: Record<string, boolean>; precedent: Record<string, StockSaisi | null> }

// Stocks du mois clos et du mois d'avant, pour chaque magasin
async function lireStocks(magasins: string[], mois: string): Promise<EtatStocks> {
  const annee = Number(mois.slice(0, 4)), m = Number(mois.slice(5, 7))
  const etat: EtatStocks = { saisi: {}, precedent: {} }
  await Promise.all(magasins.map(async (nom) => {
    const n = await chargerStocks(nom, annee)
    const avant = m > 1 ? n[m - 2] : (await chargerStocks(nom, annee - 1).catch(() => Array(12).fill(null)))[11]
    etat.saisi[nom] = !!n[m - 1]
    etat.precedent[nom] = avant ?? null
  }))
  return etat
}

export function MonMois({ reseau, magasins, lectureSeule }: { reseau: Reseau; magasins: Magasin[]; lectureSeule?: boolean }) {
  const mois = moisPrecedent(reseau.jour)
  const noms = magasins.map((m) => m.nom)
  const cle = noms.join('|')
  const [stocks, setStocks] = useState<EtatStocks | null>(null)
  const [version, setVersion] = useState(0)
  const [cloture, setCloture] = useState<string | null>(null)
  useEffect(() => {
    let actif = true
    lireStocks(cle.split('|'), mois).then((e) => actif && setStocks(e)).catch(() => actif && setStocks({ saisi: {}, precedent: {} }))
    return () => { actif = false }
  }, [cle, mois, version])

  // Le chiffre : CA du dernier mois connu face au même mois N-1
  const seul = magasins.length === 1
  const analyses = magasins.map((m) => ({ m, a: analyser(reseau, m.nom) }))
  const a0 = analyses[0]?.a ?? null

  // L'action : une seule, la plus pressante
  const aClore = stocks ? noms.find((n) => stocks.saisi[n] === false) : undefined
  const ouvertes = actionsDes(reseau, new Set(noms)).filter((x) => !x.a.faite)
  const retard = ouvertes.filter((x) => enRetard(x.a, reseau.jour)).sort((x, y) => (echeanceDate(x.a) || '').localeCompare(echeanceDate(y.a) || ''))[0]
  const dans7 = decalerJour(reseau.jour, 7)
  const proche = ouvertes.filter((x) => { const e = echeanceDate(x.a); return !!e && e >= reseau.jour && e <= dans7 }).sort((x, y) => echeanceDate(x.a).localeCompare(echeanceDate(y.a)))[0]

  const bouton = { minHeight: 48, flex: 'none' } as const
  let action
  if (!stocks) action = <Skeleton variant="rounded" height={64} aria-label="Chargement de ce qu’il y a à faire" />
  else if (aClore) {
    action = (
      <LigneAction icone={<InventoryOutlined />} titre={`Clôturer ${nomDuMois(mois)}${seul ? '' : ` · ${aClore}`}`} detail="Stock de fin de mois, deux minutes">
        {lectureSeule
          ? <Button component={RouterLink} to={`${lienFiche(aClore)}?vue=chiffres&partie=cloture`} variant="outlined" sx={bouton}>Voir</Button>
          : <Button variant="contained" onClick={() => setCloture(aClore)} sx={bouton}>Clôturer</Button>}
      </LigneAction>
    )
  } else if (retard || proche) {
    const x = (retard ?? proche)!
    action = (
      <LigneAction icone={<TaskAltOutlined />} titre={x.a.action}
        detail={[!seul && x.magasin, echeanceDate(x.a) ? `pour le ${dateCourte(echeanceDate(x.a))}` : null].filter(Boolean).join(' · ')}
        fin={retard ? <Pastille ton="rouge">En retard</Pastille> : undefined}>
        <Button component={RouterLink} to="/taches" variant="outlined" sx={bouton}>Ouvrir</Button>
      </LigneAction>
    )
  } else {
    action = <LigneAction icone={<CheckCircle sx={{ color: 'success.main' }} />} titre="Rien d’urgent" detail={`${libelleMois(mois)} est clôturé, aucune tâche à rendre cette semaine`} />
  }

  return (
    <Card component="section" aria-label="Mon mois" sx={{ p: 2, display: 'grid', gap: 1.5, mt: 1 }}>
      {seul ? (
        a0 ? (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{`CA HT · ${libelleMois(a0.mois)}`}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={styleChiffre}>{formatEuros(a0.ca)}</Typography>
              <Typography sx={{ fontWeight: 700, color: couleurEcart(a0.ecart) }}>{formatPourcent(a0.ecart)}</Typography>
              <Typography variant="body2" color="text.secondary">{`vs ${libelleMois(a0.reference)}`}</Typography>
            </Box>
            {(() => { const p = phraseCADuMois({ mois: libelleMois(a0.mois), reference: libelleMois(a0.reference), ecartPct: a0.ecart }); return p ? <Typography variant="body2">{p}</Typography> : null })()}
          </Box>
        ) : <LigneVide>Pas encore de chiffres de caisse pour ce magasin.</LigneVide>
      ) : (
        <Box component="ul" aria-label="CA du dernier mois" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
          {analyses.map(({ m, a }) => (
            <Box component="li" key={m.nom} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>{m.nom}</Typography>
              <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{a ? formatEuros(a.ca) : '—'}</Typography>
              {a && <Typography variant="body2" sx={{ fontWeight: 700, color: couleurEcart(a.ecart) }}>{formatPourcent(a.ecart)}</Typography>}
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>{action}</Box>
      {cloture && stocks && (
        <ClotureExpress magasin={cloture} mois={mois} precedent={stocks.precedent[cloture] ?? null}
          onFermer={(enregistre) => { setCloture(null); if (enregistre) setVersion((v) => v + 1) }} />
      )}
    </Card>
  )
}

function decalerJour(iso: string, jours: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + jours)
  return d.toISOString().slice(0, 10)
}

function LigneAction({ icone, titre, detail, fin, children }: { icone: ReactNode; titre: string; detail?: string; fin?: ReactNode; children?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box aria-hidden sx={{ display: 'flex', color: 'primary.main' }}>{icone}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>À faire maintenant</Typography>
        <Typography sx={{ fontWeight: 700 }}>{titre}</Typography>
        {(detail || fin) && <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>{detail && <Typography variant="body2" color="text.secondary">{detail}</Typography>}{fin}</Box>}
      </Box>
      {children}
    </Box>
  )
}

// ── 223 : clôture express, trois écrans ──
type Etape = 'saisie' | 'verifier' | 'fait'
export function ClotureExpress({ magasin, mois, precedent, onFermer }: { magasin: string; mois: string; precedent: StockSaisi | null; onFermer: (enregistre: boolean) => void }) {
  const pleinEcran = useMediaQuery(useTheme().breakpoints.down('sm'))
  const annee = Number(mois.slice(0, 4)), m = Number(mois.slice(5, 7))
  const nom = nomDuMois(mois)
  const nomPrecedent = nomDuMois(decalerMois(mois, -1))
  const depart = (u: Univers) => (precedent?.[u] != null ? enChiffres(precedent[u]!) : '')
  const [champs, setChamps] = useState<Record<Univers, string>>({ cave: depart('cave'), bar: depart('bar'), exterieur: depart('exterieur') })
  const [touches, setTouches] = useState<Set<Univers>>(new Set())
  const [etape, setEtape] = useState<Etape>('saisie')
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const lire = (t: string) => (t.trim() === '' ? null : nombre(t))
  const saisi: StockSaisi = { cave: lire(champs.cave), bar: lire(champs.bar), exterieur: lire(champs.exterieur) }

  const suivant = () => {
    if (UNIVERS.some(([k]) => (champs[k].trim() && saisi[k] === null) || (saisi[k] ?? 0) < 0)) { setErreur('Saisis des montants en euros, sans signe moins (par exemple 85 000).'); return }
    if (UNIVERS.every(([k]) => saisi[k] === null)) { setErreur('Saisis au moins le stock d’un univers.'); return }
    setErreur(null); setEtape('verifier')
  }
  const enregistrer = async () => {
    setOccupe(true); setErreur(null)
    try { await enregistrerStock(magasin, annee, m, saisi); setEtape('fait') } catch { setErreur('L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.') } finally { setOccupe(false) }
  }
  const variation = (u: Univers) => {
    const v = saisi[u], p = precedent?.[u]
    return v != null && p ? ((v - p) / p) * 100 : null
  }
  const total = UNIVERS.reduce((s, [k]) => s + (saisi[k] ?? 0), 0)
  const numero = etape === 'saisie' ? 1 : etape === 'verifier' ? 2 : 3
  const quadrimestre = m % 4 === 0
  const bouton = { minHeight: 48, flex: { xs: 1, sm: 'none' } } as const

  return (
    <Dialog open onClose={() => onFermer(etape === 'fait')} fullScreen={pleinEcran} fullWidth maxWidth="xs" aria-labelledby="titre-cloture-express">
      <DialogTitle id="titre-cloture-express" sx={{ pb: 0.5 }}>{`Clôture de ${nom} · ${magasin}`}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>{`Étape ${numero} sur 3`}</Typography>
        {erreur && <Alert severity="error" sx={{ mb: 2 }}>{erreur}</Alert>}
        {etape === 'saisie' && (
          <Box component="section" aria-label="Stocks de fin de mois" sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="h3" component="h3">{`Stock de fin ${nom}`}</Typography>
            {precedent && <Typography variant="body2" color="text.secondary">{`Repris de fin ${nomPrecedent}, en gris tant que non modifié.`}</Typography>}
            {UNIVERS.map(([k, l]) => {
              const gris = !touches.has(k) && champs[k] !== ''
              return (
                <TextField key={k} label={`Stock ${l}`} value={champs[k]} fullWidth
                  onChange={(e) => { const v = e.target.value; setChamps((c) => ({ ...c, [k]: v })); setTouches((t) => new Set(t).add(k)) }}
                  slotProps={{ htmlInput: { inputMode: 'decimal', 'data-prerempli': gris ? 'oui' : undefined }, input: { endAdornment: <Typography color="text.secondary">€</Typography> } }}
                  sx={{ '& input': { height: 56, boxSizing: 'border-box', py: 0, fontSize: '1.25rem', color: gris ? 'text.secondary' : 'text.primary', fontStyle: gris ? 'italic' : 'normal' } }} />
              )
            })}
          </Box>
        )}
        {etape === 'verifier' && (
          <Box component="section" aria-label="Vérifier les stocks" sx={{ display: 'grid', gap: 1.5 }}>
            <Typography variant="h3" component="h3">Vérifier</Typography>
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
              {UNIVERS.map(([k, l]) => {
                const v = variation(k)
                const alerte = v !== null && Math.abs(v) > SEUIL_VERIFIER
                return (
                  <Box component="li" key={k} aria-label={`Stock ${l}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 600, minWidth: 88 }}>{l}</Typography>
                    <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flex: 1 }}>{saisi[k] == null ? '—' : formatEuros(saisi[k])}</Typography>
                    {v !== null && <Typography variant="body2" color="text.secondary">{`${formatPourcent(v)} vs ${nomPrecedent}`}</Typography>}
                    {alerte && <Pastille ton="orange">À vérifier</Pastille>}
                  </Box>
                )
              })}
              <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1, borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
                <Typography sx={{ fontWeight: 700, minWidth: 88 }}>Total</Typography>
                <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatEuros(total)}</Typography>
              </Box>
            </Box>
            {UNIVERS.some(([k]) => { const v = variation(k); return v !== null && Math.abs(v) > SEUIL_VERIFIER }) && (
              <Alert severity="warning">{`Un stock a bougé de plus de ${SEUIL_VERIFIER} % depuis fin ${nomPrecedent}. Vérifie qu’il n’y a pas un zéro de trop ou de moins.`}</Alert>
            )}
          </Box>
        )}
        {etape === 'fait' && (
          <Box component="section" aria-label="Clôture enregistrée" sx={{ display: 'grid', gap: 1.5, justifyItems: 'center', textAlign: 'center', py: 2 }}>
            <CheckCircle sx={{ color: 'success.main', fontSize: 56 }} />
            <Typography variant="h3" component="h3">{`Stock de fin ${nom} enregistré`}</Typography>
            <Typography variant="body2" color="text.secondary">{quadrimestre ? 'Il reste les comptes du quadrimestre, quand ton comptable te les donne.' : `${libelleMois(mois)} est clôturé.`}</Typography>
            <Button component={RouterLink} to={`${lienFiche(magasin)}?vue=chiffres&partie=cloture`} onClick={() => onFermer(true)} sx={{ minHeight: 48 }}>Voir toute la clôture</Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        {etape === 'saisie' && <>
          <Button onClick={() => onFermer(false)} sx={bouton}>Plus tard</Button>
          <Button variant="contained" onClick={suivant} sx={bouton}>Suivant</Button>
        </>}
        {etape === 'verifier' && <>
          <Button onClick={() => setEtape('saisie')} sx={bouton}>Corriger</Button>
          <Button variant="contained" onClick={() => void enregistrer()} disabled={occupe} sx={bouton}>Enregistrer</Button>
        </>}
        {etape === 'fait' && <Button variant="contained" onClick={() => onFermer(true)} sx={bouton}>Terminer</Button>}
      </DialogActions>
    </Dialog>
  )
}
