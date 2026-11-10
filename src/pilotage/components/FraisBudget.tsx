import { useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import ReplayOutlined from '@mui/icons-material/ReplayOutlined'
import Tooltip from '@mui/material/Tooltip'
import { CODE_COMMUNICATION } from '../moteur/communication'
import { ChampNombre } from './ChampNombre'
import { Indicateur } from './Indicateur'
import { nombre } from '../import/caisse'
import { enChiffres, milliers, montant, taux } from '../lib/format'
import { avecPretsBudget, CLES_FINANCES, lignesFraisBudget, type ChoixFrais, type LigneFraisBudget, type ModeFrais, type PretsDeuxAnnees } from '../moteur/fraisBudget'
import { LIGNES_SUR_CA, lignesActives, lignesFrais, rubriqueLibelle, THEMES_FRAIS, type LigneGrille } from '../moteur/parametres'
import type { Hypotheses } from '../moteur/types'
import { styleTableau } from '../theme/tableau'

const visuellementCache = { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const
const enTexte = (c: ChoixFrais) => (c.valeur === undefined ? '' : enChiffres(Math.round((c.mode === 'taux' || c.mode === 'partCA' ? c.valeur * 100 : c.valeur) * 100) / 100))

// Lot 35 (Joseph, 02/11/2026) : frais du budget ligne par ligne, à partir des frais de l'année en cours, dans le même
// tableau par thème que l'onglet Frais. Chaque ligne : même montant, hausse en %, ou nouveau montant ; sans choix, elle
// suit l'inflation des frais. Les choix vont dans les ajustements du budget (enregistrés avec la barre du budget).
export function FraisBudget({ base, choix, inflation, annee, anneeEnCours, lectureSeule, tauxSurCA, onChange, grille = lignesFrais, prets }: {
  base: Pick<Hypotheses, 'frais' | 'amortissements' | 'interets' | 'remboursementCapital'>
  choix: Record<string, ChoixFrais> | undefined
  inflation: number
  annee: number
  anneeEnCours: number
  lectureSeule: boolean
  tauxSurCA: { publicite: number; redevance: number; communication?: number }
  onChange: (c: Record<string, ChoixFrais> | undefined) => void
  grille?: LigneGrille[]  // grille des frais de l'année (lot 40)
  prets?: PretsDeuxAnnees | null  // prêts du magasin : intérêts et capital des deux années
}) {
  const [replies, setReplies] = useState<Set<string>>(new Set())
  // Texte en cours de saisie, par ligne : gardé tant qu'il n'est pas un nombre lisible
  const [textes, setTextes] = useState<Record<string, string>>({})
  const [ajout, setAjout] = useState<{ ancre: HTMLElement; theme: string } | null>(null)
  const lignes = avecPretsBudget(lignesFraisBudget(base, choix, inflation, grille, tauxSurCA.communication ?? 0), prets)
  const basculer = (cle: string) => setReplies((o) => { const n = new Set(o); if (n.has(cle)) n.delete(cle); else n.add(cle); return n })

  const ecrire = (code: string, c: ChoixFrais | null) => {
    const n = { ...(choix ?? {}) }
    // Ligne nouvelle au budget : son libellé et son thème la suivent (lot 40, grille modifiable)
    const precedent = choix?.[code]
    if (c) n[code] = c.mode === 'montant' && precedent?.libelle && !c.libelle ? { ...c, libelle: precedent.libelle, rubrique: precedent.rubrique } : c
    else delete n[code]
    onChange(Object.keys(n).length ? n : undefined)
  }
  const changerMode = (l: LigneFraisBudget, mode: ModeFrais) => {
    setTextes(({ [l.code]: _, ...reste }) => reste)
    if (mode === 'meme') ecrire(l.code, { mode })
    // Hausse : part de l'inflation ; nouveau montant : part du montant du budget actuel
    else if (mode === 'taux') ecrire(l.code, l.rubrique === 'finances' ? { mode, valeur: 0 } : null)
    else ecrire(l.code, { mode, valeur: Math.round(l.apres) })
  }
  const changerValeur = (l: LigneFraisBudget, v: string) => {
    setTextes((t) => ({ ...t, [l.code]: v }))
    const n = nombre(v)
    if (n === null || Number.isNaN(n)) return
    ecrire(l.code, l.choix.mode === 'taux' ? { mode: 'taux', valeur: Math.round(n * 100) / 10_000 } : { mode: 'montant', valeur: n })
  }

  const avant = (x: LigneFraisBudget[]) => x.reduce((a, l) => a + l.avant, 0)
  const apres = (x: LigneFraisBudget[]) => x.reduce((a, l) => a + l.apres, 0)
  const partCA = (x: LigneFraisBudget[]) => x.reduce((a, l) => a + (l.tauxCA ?? 0), 0)
  const enMontant = (annuel: number, part: number) => `${montant(annuel)}${part ? ` + ${taux(part)} du CA` : ''}`
  const frais = lignes.filter((l) => l.rubrique !== 'finances')
  const finances = lignes.filter((l) => l.rubrique === 'finances')
  const modifiees = lignes.filter((l) => !l.parDefaut).length

  // Budget communication (Joseph, 10/11/2026) : une préconisation du siège, pas une redevance ; le magasin la règle en
  // part du CA ou en montant, et peut revenir à la préconisation
  const preco = tauxSurCA.communication ?? 0
  const choixCommunication = (l: LigneFraisBudget) => {
    const mode: 'partCA' | 'montant' = l.choix.mode === 'partCA' || (l.parDefaut && l.tauxCA !== undefined) ? 'partCA' : 'montant'
    const valeur = l.choix.mode === 'partCA' || l.choix.mode === 'montant' ? enTexte(l.choix)
      : mode === 'partCA' ? enChiffres(Math.round((l.tauxCA ?? 0) * 10_000) / 100) : enChiffres(Math.round(l.apres))
    if (lectureSeule) {
      return <Typography variant="body2" color={l.parDefaut ? 'text.secondary' : 'text.primary'}>
        {l.parDefaut ? (preco > 0 ? 'Préconisation du siège' : 'Inflation') : mode === 'partCA' ? 'Part du CA' : 'Montant choisi'}
      </Typography>
    }
    const changer = (v: string) => {
      setTextes((t) => ({ ...t, [l.code]: v }))
      const n = nombre(v)
      if (n === null || Number.isNaN(n)) return
      ecrire(l.code, mode === 'partCA' ? { mode: 'partCA', valeur: Math.round(n * 100) / 10_000 } : { mode: 'montant', valeur: n })
    }
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
        {!l.parDefaut && (
          <Tooltip title={preco > 0 ? `Reprendre la préconisation du siège : ${taux(preco)} du CA` : 'Reprendre l’inflation des frais'}>
            <IconButton aria-label={`Reprendre la préconisation du siège : ${l.libelle}`} color="primary" onClick={() => { setTextes(({ [l.code]: _, ...r }) => r); ecrire(l.code, null) }}
              sx={{ width: { xs: 48, md: 32 }, height: { xs: 48, md: 32 } }}><ReplayOutlined sx={{ fontSize: 18 }} /></IconButton>
          </Tooltip>
        )}
        <ToggleButtonGroup exclusive size="small" value={mode} aria-label={`Choix ${annee} : ${l.libelle}`}
          onChange={(_, m: 'partCA' | 'montant' | null) => {
            if (!m || m === mode) return
            setTextes(({ [l.code]: _, ...r }) => r)
            ecrire(l.code, m === 'partCA' ? { mode: 'partCA', valeur: l.tauxCA ?? (preco || 0.025) } : { mode: 'montant', valeur: Math.round(l.tauxCA !== undefined ? l.avant : l.apres) })
          }}>
          <ToggleButton value="partCA" sx={{ minHeight: { xs: 48, md: 36 }, px: 1.25 }}>% du CA</ToggleButton>
          <ToggleButton value="montant" sx={{ minHeight: { xs: 48, md: 36 }, px: 1.25 }}>Montant</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ width: 112, textAlign: 'left' }}>
          <ChampNombre libelle={mode === 'partCA' ? `Part du CA ${annee} : ${l.libelle}` : `Montant ${annee} : ${l.libelle}`}
            valeur={textes[l.code] ?? valeur} unite={mode === 'partCA' ? '%' : '€'} largeur={112} onChange={changer} />
        </Box>
      </Box>
    )
  }

  const choixLigne = (l: LigneFraisBudget) => {
    if (l.code === CODE_COMMUNICATION) return choixCommunication(l)
    if (l.tauxCA !== undefined) return <Typography variant="body2" color="text.secondary">Part du CA gardée</Typography>
    if (l.depuisPrets) return <Typography variant="body2" color="text.secondary">Calculé depuis les prêts</Typography>
    if (lectureSeule) {
      return <Typography variant="body2" color={l.parDefaut ? 'text.secondary' : 'text.primary'}>
        {l.choix.mode === 'meme' ? 'Même montant' : l.choix.mode === 'taux' ? `${taux(l.choix.valeur ?? 0)}${l.parDefaut ? ' (inflation)' : ''}` : 'Nouveau montant'}
      </Typography>
    }
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
        <ToggleButtonGroup exclusive size="small" value={l.choix.mode} aria-label={`Choix ${annee} : ${l.libelle}`}
          onChange={(_, m: ModeFrais | null) => m && changerMode(l, m)}>
          <ToggleButton value="meme" sx={{ minHeight: { xs: 48, md: 36 }, px: 1.25 }}>Même</ToggleButton>
          <ToggleButton value="taux" sx={{ minHeight: { xs: 48, md: 36 }, px: 1.25 }}>%</ToggleButton>
          <ToggleButton value="montant" sx={{ minHeight: { xs: 48, md: 36 }, px: 1.25 }}>Montant</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ width: 112, textAlign: 'left' }}>
          {l.choix.mode !== 'meme' && (
            <ChampNombre libelle={l.choix.mode === 'taux' ? `Hausse ${annee} : ${l.libelle}` : `Montant ${annee} : ${l.libelle}`}
              valeur={textes[l.code] ?? enTexte(l.choix)} unite={l.choix.mode === 'taux' ? '%' : '€'} largeur={112}
              onChange={(v) => changerValeur(l, v)} />
          )}
        </Box>
      </Box>
    )
  }
  const ligne = (l: LigneFraisBudget) => (
    <TableRow key={l.code}>
      <TableCell sx={{ pl: '40px !important', whiteSpace: 'normal !important', minWidth: 160 }}>
        {l.libelle}
        {l.parDefaut && l.tauxCA === undefined && l.rubrique !== 'finances' && <Box component="span" sx={{ ml: 1, color: 'text.secondary' }}>· inflation</Box>}
        {l.code === CODE_COMMUNICATION && l.parDefaut && l.tauxCA !== undefined && <Box component="span" sx={{ ml: 1, color: 'text.secondary' }}>· préconisation du siège</Box>}
      </TableCell>
      <TableCell align="right">{l.tauxAvant !== undefined ? `${taux(l.tauxAvant)} du CA` : l.avant ? montant(l.avant) : '–'}</TableCell>
      <TableCell align="right" sx={{ py: '2px !important' }}>{choixLigne(l)}</TableCell>
      <TableCell align="right" sx={{ fontWeight: l.parDefaut ? 400 : 700 }}>{l.tauxCA !== undefined ? `${taux(l.tauxCA)} du CA` : montant(l.apres)}</TableCell>
    </TableRow>
  )
  const ligneTexte = (cle: string, libelle: string, valeur: string) => (
    <TableRow key={cle}>
      <TableCell sx={{ pl: '40px !important', whiteSpace: 'normal !important' }}>{libelle}</TableCell>
      <TableCell align="right" sx={{ color: 'text.secondary' }}>{valeur}</TableCell>
      <TableCell align="right"><Typography variant="body2" color="text.secondary">Paramètre du réseau</Typography></TableCell>
      <TableCell align="right" sx={{ color: 'text.secondary' }}>{valeur}</TableCell>
    </TableRow>
  )
  const groupe = (cle: string, libelle: string, dans: LigneFraisBudget[], rangees: React.ReactNode[], plus?: React.ReactNode) => {
    const replie = replies.has(cle)
    return (
      <TableBody key={cle} aria-label={libelle}>
        {/* Thème encore vide : en retrait, seulement là pour son « + » */}
        <TableRow sx={rangees.length ? { bgcolor: 'background.default' } : undefined}>
          <TableCell sx={rangees.length ? { fontWeight: 700 } : { color: 'text.secondary' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ButtonBase onClick={() => basculer(cle)} aria-expanded={!replie} aria-label={`${libelle} : ${replie ? 'détailler' : 'replier'}`}
                sx={{ font: 'inherit', gap: 0.5, ml: -0.75, px: 0.5, borderRadius: 1, minHeight: { xs: 48, md: 32 }, '&:hover': { bgcolor: 'action.hover' } }}>
                <ChevronRightOutlined sx={{ fontSize: 18, transform: replie ? 'none' : 'rotate(90deg)', color: 'text.secondary' }} />
                {libelle}
              </ButtonBase>
              {plus}
            </Box>
          </TableCell>
          <TableCell align="right" sx={{ fontWeight: 700 }}>{dans.length ? enMontant(avant(dans), partCA(dans)) : ''}</TableCell>
          <TableCell />
          <TableCell align="right" sx={{ fontWeight: 700 }}>{dans.length ? enMontant(apres(dans), partCA(dans)) : ''}</TableCell>
        </TableRow>
        {!replie && rangees}
      </TableBody>
    )
  }
  // Lignes de la grille absentes de l'année en cours, à ajouter au budget avec un montant
  const libres = (r: string) => lignesActives(grille).filter((g) => g.rubrique === r && !lignes.some((l) => l.code === g.code))
  const plusTheme = (r: string) => !lectureSeule && libres(r).length > 0 && (
    <IconButton aria-label={`Ajouter une ligne au budget : ${rubriqueLibelle[r as keyof typeof rubriqueLibelle]}`} onClick={(e) => setAjout({ ancre: e.currentTarget, theme: r })}
      sx={{ width: { xs: 48, md: 32 }, height: { xs: 48, md: 32 } }}>
      <AddOutlined fontSize="small" />
    </IconButton>
  )
  const themes = THEMES_FRAIS.map((r) => ({ r, dans: frais.filter((l) => l.rubrique === r) })).filter((x) => x.dans.length || (!lectureSeule && libres(x.r).length))
  const surCA = tauxSurCA.publicite + tauxSurCA.redevance

  return (
    <Stack spacing={3}>
      <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }} component="section" aria-label={`Frais ${annee} en chiffres`}>
        <Indicateur libelle={`Frais ${annee}`} aide="fraisBudget" valeur={milliers(apres(frais))} detail={`${anneeEnCours} : ${milliers(avant(frais))}`} />
        <Indicateur libelle="Inflation des frais" aide="inflationFrais" valeur={taux(inflation)} detail="Lignes sans choix" />
        <Indicateur libelle="Lignes modifiées" valeur={String(modifiees)} detail={`sur ${lignes.filter((l) => l.tauxCA === undefined).length}`} />
      </Stack>
      <Card component="section" aria-label={`Frais ${annee} ligne par ligne`}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
          <Typography variant="h2" sx={{ flex: 1 }}>Frais {annee}</Typography>
        </Box>
        {/* Joseph (10/11/2026) : la page défile, pas le tableau dans sa carte ; il tient dans la largeur sans défiler à droite */}
        <TableContainer sx={{ maxHeight: 'none' }}>
          <Table size="small" aria-label={`Frais ${annee} par thème`} sx={{ ...styleTableau, '& td, & th': { ...styleTableau['& td, & th'], fontSize: '0.875rem' } }}>
            <TableHead>
              <TableRow>
                <TableCell>Ligne</TableCell>
                <TableCell align="right">{anneeEnCours}</TableCell>
                <TableCell align="right">Choix {annee}<Box component="span" sx={visuellementCache}> : même montant, hausse en % ou nouveau montant</Box></TableCell>
                <TableCell align="right">{annee}</TableCell>
              </TableRow>
            </TableHead>
            {themes.map(({ r, dans }) => groupe(r, rubriqueLibelle[r], dans, dans.map(ligne), plusTheme(r)))}
            {groupe('reseau', 'Redevances du réseau', [], (['publicite', 'redevance'] as const).map((k) => ligneTexte(k, LIGNES_SUR_CA[k].libelle, `${taux(tauxSurCA[k])} du CA`)))}
            {groupe('hors-ebe', 'Sous l’excédent brut d’exploitation', finances.filter((l) => l.code !== 'remboursementCapital'), CLES_FINANCES.map((k) => ligne(finances.find((l) => l.code === k)!)))}
            <TableBody aria-label="Totaux">
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Total des frais au-dessus de l’EBE</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{enMontant(avant(frais), partCA(frais) + surCA)}</TableCell>
                <TableCell />
                <TableCell align="right" sx={{ fontWeight: 700 }}>{enMontant(apres(frais), partCA(frais) + surCA)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      <Menu anchorEl={ajout?.ancre} open={!!ajout} onClose={() => setAjout(null)}>
        {ajout && libres(ajout.theme).map((g) => (
          <MenuItem key={g.code} sx={{ minHeight: 48 }} onClick={() => { ecrire(g.code, { mode: 'montant', valeur: 0, libelle: g.libelle, rubrique: g.rubrique }); setTextes((t) => ({ ...t, [g.code]: '' })); setAjout(null) }}>{g.libelle}</MenuItem>
        ))}
      </Menu>
    </Stack>
  )
}
