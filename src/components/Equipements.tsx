// Équipements du magasin (Joseph, 14/11/2026) : le matériel acheté et mis à disposition, surtout pour le marché
// extérieur. L'équipe et le franchisé (ses magasins, Joseph 14/11/2026) ajoutent, modifient ou retirent une ligne ;
// le nombre de tireuses ouvre le simulateur du parc.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AddOutlined from '@mui/icons-material/AddOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import RemoveOutlined from '@mui/icons-material/RemoveOutlined'
import { Section } from './Section'
import { useReseau } from '../data/ReseauContext'
import { horsLigne } from '../lib/horsLigne'
import { Fenetre } from './EditionEquipe'
import { useAuth } from '../auth/AuthContext'
import { useApercu } from '../auth/Apercu'
import { enregistrerEquipements, enregistrerEquipementsFranchise } from '../data/chargement'
import { formatEuros } from '../data/chiffres'
import { achatsDe, avecAchats, categoriesEquipement, equipementsDu, libelleCategorie, resumeEquipements, tireusesDu, type AchatEquipement, type CategorieEquipement, type Equipement } from '../data/equipements'
import type { Magasin, Reseau } from '../data/modele'

// Joseph (18/11/2026) : saisie directe en tableau. Chaque type d'équipement a sa ligne d'office ; quantité (− / +),
// année et prix d'achat se tapent sur la ligne et s'enregistrent seuls. Le crayon garde précision, note et retrait.
type Rang = { cle: string; categorie: CategorieEquipement; ligne: Equipement | null }

function rangsDu(liste: Equipement[]): Rang[] {
  const rangs: Rang[] = []
  for (const [c] of categoriesEquipement) {
    const lignes = liste.filter((e) => e.categorie === c)
    if (lignes.length) lignes.forEach((e) => rangs.push({ cle: e.id, categorie: c, ligne: e }))
    else if (c !== 'autre') rangs.push({ cle: `vide_${c}`, categorie: c, ligne: null })
  }
  return rangs
}

const nouvelId = () => `e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function SectionEquipements({ reseau, m, signaler }: { reseau: Reseau; m: Magasin; signaler?: (msg: string) => void }) {
  const { profil } = useAuth()
  const { apercu } = useApercu()
  const { recharger } = useReseau()
  const [edition, setEdition] = useState<{ e: Equipement | null; categorie?: CategorieEquipement } | undefined>(undefined)
  const recu = equipementsDu(reseau, m.nom)
  const [lignes, setLignes] = useState<Equipement[]>(recu)
  const [etat, setEtat] = useState<'' | 'envoi' | 'ok' | 'erreur'>('')
  const enCours = useRef(0)
  const file = useRef<Promise<void>>(Promise.resolve())
  const minuterie = useRef<number | undefined>(undefined)
  const recuCle = JSON.stringify(recu)
  // La liste de la base fait foi dès qu'aucun enregistrement n'est en route
  useEffect(() => { if (!enCours.current) setLignes(JSON.parse(recuCle) as Equipement[]) }, [recuCle])
  const aRecharger = useRef(false)
  const rechargerRef = useRef(recharger)
  rechargerRef.current = recharger
  // En quittant l'onglet, la fiche (et le simulateur du parc) repart des chiffres enregistrés
  useEffect(() => () => {
    window.clearTimeout(minuterie.current)
    if (aRecharger.current) void file.current.then(() => { if (!horsLigne()) void rechargerRef.current() })
  }, [])
  const lecture = !!apercu
  const ecrire = profil?.role === 'franchise' ? enregistrerEquipementsFranchise : enregistrerEquipements
  const par = profil?.nom ?? ''
  const r = resumeEquipements(lignes)
  const tireuses = tireusesDu(lignes)
  const titre = lignes.length ? `Équipements · ${r.nombre}${r.valeur > 0 ? ` · ${formatEuros(r.valeur)} HT` : ''}` : 'Équipements'

  const enregistrer = (suivante: Equipement[]) => {
    setLignes(suivante)
    enCours.current += 1
    aRecharger.current = true
    setEtat('envoi')
    file.current = file.current.then(async () => {
      try { await ecrire(m.nom, suivante); setEtat((x) => (x === 'erreur' ? x : 'ok')) } catch { setEtat('erreur') } finally { enCours.current -= 1 }
      if (!enCours.current && !horsLigne()) {
        window.clearTimeout(minuterie.current)
        minuterie.current = window.setTimeout(() => { if (!enCours.current) { aRecharger.current = false; void recharger() } }, 1500)
      }
    })
  }
  const modifier = (rang: Rang, champs: Partial<Pick<Equipement, 'quantite' | 'annee' | 'valeur'>>) => {
    const avant = rang.ligne
    if (avant) {
      const ligne = { ...avant, ...champs }
      if (ligne.quantite === avant.quantite && ligne.annee === avant.annee && ligne.valeur === avant.valeur) return
      enregistrer(ligne.quantite < 1 ? lignes.filter((x) => x.id !== avant.id) : lignes.map((x) => (x.id === avant.id ? ligne : x)))
    } else {
      const quantite = champs.quantite ?? 0
      if (quantite < 1) return
      enregistrer([...lignes, { id: nouvelId(), categorie: rang.categorie, precision: '', quantite, annee: champs.annee ?? null, valeur: champs.valeur ?? null, note: '', par, le: reseau.jour }])
    }
  }

  return (
    <Section titre={titre} action={etat ? (
      <Typography role="status" variant="body2" color={etat === 'erreur' ? 'error' : 'text.secondary'} sx={{ alignSelf: 'center' }}>
        {etat === 'envoi' ? 'Enregistrement…' : etat === 'ok' ? 'Enregistré' : 'Enregistrement impossible : vérifie la connexion et recommence.'}
      </Typography>
    ) : undefined}>
      <Box component="ul" aria-label={`Équipements de ${m.nom}`} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {rangsDu(lignes).map((rang) => (
          <RangEquipement key={rang.cle} rang={rang} lecture={lecture} onModifier={(c) => modifier(rang, c)}
            onRemplacer={(e) => { if (rang.ligne) enregistrer(e ? lignes.map((x) => (x.id === rang.ligne!.id ? e : x)) : lignes.filter((x) => x.id !== rang.ligne!.id)) }}
            onDetails={rang.ligne ? () => setEdition({ e: rang.ligne }) : undefined} />
        ))}
      </Box>
      {!lecture && (
        <Button startIcon={<AddOutlined />} onClick={() => setEdition({ e: null, categorie: 'autre' })} sx={{ minHeight: 48, mt: 1 }}>Ajouter un autre équipement</Button>
      )}
      {tireuses !== null && (
        <Box>
          <Button component={RouterLink} to={`/magasins/${encodeURIComponent(m.nom)}?vue=simulateurs&partie=simulateurs&sim=tireuses`} sx={{ minHeight: 48, mt: 1 }}>
            {`Simuler le parc de ${tireuses} tireuse${tireuses > 1 ? 's' : ''}`}
          </Button>
        </Box>
      )}
      {edition !== undefined && <DialogEquipement m={m} liste={lignes} ecrire={ecrire} equipement={edition.e} categorieInitiale={edition.categorie} par={par} jour={reseau.jour}
        onFermer={(msg) => { setEdition(undefined); if (msg) signaler?.(msg) }} />}
    </Section>
  )
}


type Champs = Partial<AchatEquipement>

// Joseph (19/11/2026) : plusieurs achats d'un même équipement (10 tireuses en 2024, 7 en 2026). Un lien discret
// « Ajouter un achat » sous la ligne ; dès deux achats, la ligne affiche les totaux et chaque achat a sa sous-ligne.
function RangEquipement({ rang, lecture, onRemplacer, onModifier, onDetails }: { rang: Rang; lecture: boolean; onRemplacer: (e: Equipement | null) => void; onModifier: (c: Champs) => void; onDetails?: () => void }) {
  const e = rang.ligne
  const nom = libelleCategorie(rang.categorie) + (e?.precision ? ` · ${e.precision}` : '')
  const achats = e ? achatsDe(e) : []
  const plusieurs = achats.length > 1
  const changerAchat = (i: number, c: Champs) => {
    if (!e) return
    const avant = achats[i]
    const apres = { ...avant, ...c }
    if (apres.quantite === avant.quantite && apres.annee === avant.annee && apres.valeur === avant.valeur) return
    onRemplacer(avecAchats(e, achats.map((a, j) => (j === i ? apres : a))))
  }
  const ajouterAchat = () => { if (e) onRemplacer(avecAchats(e, [...achats, { quantite: 1, annee: null, valeur: null }])) }
  const crayon = onDetails && !lecture ? <IconButton onClick={onDetails} aria-label={`Modifier ${nom}`} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton> : null
  const titre = (
    <>
      <Typography sx={{ fontWeight: e ? 600 : 400, color: e ? 'text.primary' : 'text.secondary' }}>{nom}</Typography>
      {e?.note && <Typography variant="body2" color="text.secondary">« {e.note} »</Typography>}
    </>
  )
  return (
    <Box component="li" aria-label={nom} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      {plusieurs ? (
        <>
          <Box sx={grille()}>
            <Box sx={{ gridArea: 'nom', minWidth: 0 }}>{titre}</Box>
            <Typography aria-label={`Quantité totale, ${nom}`} sx={{ gridArea: 'qte', fontWeight: 600, textAlign: { xs: 'right', md: 'center' }, pr: { xs: 2, md: 0 } }}>{e!.quantite}</Typography>
            <Typography color="text.secondary" sx={{ gridArea: 'annee' }}>{`${achats.length} achats`}</Typography>
            <Typography aria-label={`Prix d’achat total HT, ${nom}`} sx={{ gridArea: 'valeur', fontWeight: 600 }}>{e!.valeur !== null ? `${formatEuros(e!.valeur)} HT` : ''}</Typography>
            <Box sx={{ gridArea: 'details' }}>{crayon}</Box>
          </Box>
          {achats.map((a, i) => (
            <LigneSaisie key={i} libelle={`${nom}, achat ${i + 1}`} achat={a} lecture={lecture} actif onModifier={(c) => changerAchat(i, c)}
              titre={<Typography variant="body2" color="text.secondary" sx={{ pl: { md: 2 } }}>{`Achat ${i + 1}`}</Typography>} />
          ))}
        </>
      ) : (
        <LigneSaisie libelle={nom} achat={achats[0] ?? { quantite: 0, annee: null, valeur: null }} lecture={lecture} actif={!!e} onModifier={onModifier} titre={titre} details={crayon} />
      )}
      {e && !lecture && (
        <Button size="small" startIcon={<AddOutlined />} onClick={ajouterAchat} aria-label={`Ajouter un achat, ${nom}`}
          sx={{ minHeight: { xs: 48, md: 32 }, mt: 0.5, color: 'text.secondary', fontWeight: 400 }}>Ajouter un achat</Button>
      )}
    </Box>
  )
}

// Joseph (25/11/2026) : sur téléphone, le nom et le compteur sur la même ligne, année et prix en dessous ; un type
// encore absent du magasin n'occupe qu'une ligne (année et prix n'apparaissent qu'une fois la quantité saisie).
const grille = (complet = true) => ({
  display: 'grid', alignItems: 'center', columnGap: { xs: 1, md: 1.5 }, rowGap: 1, py: { xs: 0.25, md: 0.5 },
  gridTemplateColumns: { xs: 'minmax(0, 1fr) minmax(0, 1fr) 48px', md: 'minmax(200px, 1fr) 168px 120px 160px 48px' },
  gridTemplateAreas: { xs: complet ? '"nom qte qte" "annee valeur details"' : '"nom qte qte"', md: '"nom qte annee valeur details"' },
}) as const

function LigneSaisie({ libelle, achat, lecture, actif, onModifier, titre, details }: { libelle: string; achat: AchatEquipement; lecture: boolean; actif: boolean; onModifier: (c: Champs) => void; titre: ReactNode; details?: ReactNode }) {
  const q = achat.quantite
  const [quantite, setQuantite] = useState(String(q))
  const [annee, setAnnee] = useState(achat.annee ? String(achat.annee) : '')
  const [valeur, setValeur] = useState(achat.valeur !== null ? String(achat.valeur) : '')
  useEffect(() => { setQuantite(String(q)) }, [q])
  useEffect(() => { setAnnee(achat.annee ? String(achat.annee) : '') }, [achat.annee])
  useEffect(() => { setValeur(achat.valeur !== null ? String(achat.valeur) : '') }, [achat.valeur])
  const validerQuantite = () => {
    const n = nombreOuNull(quantite)
    if (n === null || n < 0) { setQuantite(String(q)); return }
    onModifier({ quantite: Math.round(n) })
  }
  const validerAnnee = () => {
    const a = nombreOuNull(annee)
    if (annee.trim() && (a === null || a < 1950 || a > 2100)) { setAnnee(achat.annee ? String(achat.annee) : ''); return }
    onModifier({ annee: a !== null ? Math.round(a) : null })
  }
  const validerValeur = () => {
    const v = nombreOuNull(valeur)
    if (valeur.trim() && (v === null || v < 0)) { setValeur(achat.valeur !== null ? String(achat.valeur) : ''); return }
    onModifier({ valeur: v })
  }
  const entree = (valider: () => void) => (x: KeyboardEvent) => { if (x.key === 'Enter') { x.preventDefault(); valider() } }
  const telephone = !useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const masque = telephone && !actif
  return (
    <Box sx={grille(!masque)}>
      <Box sx={{ gridArea: 'nom', minWidth: 0 }}>{titre}</Box>
      <Box sx={{ gridArea: 'qte', display: 'flex', alignItems: 'center', gap: 0.5, justifySelf: { xs: 'end', md: 'start' } }}>
        <IconButton disabled={lecture || q < 1} onClick={() => onModifier({ quantite: q - 1 })} aria-label={`Enlever 1, ${libelle}`} sx={{ width: 48, height: 48 }}><RemoveOutlined /></IconButton>
        <TextField value={quantite} disabled={lecture} onChange={(x) => setQuantite(x.target.value)} onBlur={validerQuantite} onKeyDown={entree(validerQuantite)}
          slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': `Quantité, ${libelle}`, style: { textAlign: 'center' } } }} sx={{ width: { xs: 56, md: 64 } }} />
        <IconButton disabled={lecture} onClick={() => onModifier({ quantite: q + 1 })} aria-label={`Ajouter 1, ${libelle}`} sx={{ width: 48, height: 48 }}><AddOutlined /></IconButton>
      </Box>
      {!masque && <>
      <TextField label={telephone ? 'Année' : 'Année d’achat'} value={annee} disabled={lecture || !actif} onChange={(x) => setAnnee(x.target.value)} onBlur={validerAnnee} onKeyDown={entree(validerAnnee)}
        slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': `Année d’achat, ${libelle}` } }} sx={{ gridArea: 'annee' }} />
      <TextField label={telephone ? 'Prix HT' : 'Prix d’achat HT'} value={valeur} disabled={lecture || !actif} onChange={(x) => setValeur(x.target.value)} onBlur={validerValeur} onKeyDown={entree(validerValeur)}
        slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': `Prix d’achat HT, ${libelle}` }, input: { endAdornment: <InputAdornment position="end">€</InputAdornment> } }} sx={{ gridArea: 'valeur' }} />
      <Box sx={{ gridArea: 'details' }}>{details}</Box>
      </>}
    </Box>
  )
}

const nombreOuNull = (v: string) => { const n = Number(v.replace(/\s/g, '').replace(',', '.')); return v.trim() && Number.isFinite(n) ? n : null }

function DialogEquipement({ m, liste, ecrire, equipement: e, categorieInitiale, par, jour, onFermer }: { m: Magasin; liste: Equipement[]; ecrire: (magasin: string, liste: Equipement[]) => Promise<void>; equipement: Equipement | null; categorieInitiale?: CategorieEquipement; par: string; jour: string; onFermer: (msg?: string) => void }) {
  const [categorie, setCategorie] = useState<CategorieEquipement>(e?.categorie ?? categorieInitiale ?? 'tireuse')
  const [precision, setPrecision] = useState(e?.precision ?? '')
  const [quantite, setQuantite] = useState(String(e?.quantite ?? 1))
  const [annee, setAnnee] = useState(e?.annee ? String(e.annee) : '')
  const [valeur, setValeur] = useState(e?.valeur !== null && e?.valeur !== undefined ? String(e.valeur) : '')
  const [note, setNote] = useState(e?.note ?? '')
  const q = nombreOuNull(quantite), a = nombreOuNull(annee), v = nombreOuNull(valeur)
  const plusieurs = !!e && achatsDe(e).length > 1
  const valide = (plusieurs || q !== null && q >= 1) && (!annee.trim() || (a !== null && a >= 1950 && a <= 2100)) && (!valeur.trim() || (v !== null && v >= 0)) && (categorie !== 'autre' || !!precision.trim())
  const enregistrer = async () => {
    const ligne: Equipement = {
      id: e?.id ?? `e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, categorie, precision: precision.trim(),
      quantite: Math.round(q ?? 1), annee: a !== null ? Math.round(a) : null, valeur: v, note: note.trim(), par: e?.par || par, le: e?.le || jour,
      ...(plusieurs && e ? { quantite: e.quantite, annee: e.annee, valeur: e.valeur, achats: e.achats } : {}),
    }
    await ecrire(m.nom, e ? liste.map((x) => (x.id === e.id ? ligne : x)) : [...liste, ligne])
    return e ? 'Équipement enregistré.' : 'Équipement ajouté.'
  }
  const retirer = async () => {
    await ecrire(m.nom, liste.filter((x) => x.id !== e!.id))
    return `${libelleCategorie(e!.categorie)} retiré des équipements.`
  }
  return (
    <Fenetre titre={e ? libelleCategorie(e.categorie) : 'Ajouter un équipement'} ouvert onFermer={onFermer} valide={valide} enregistrer={enregistrer}
      supprimer={e ? retirer : undefined} libelleSuppression={e ? `Retirer ${libelleCategorie(e.categorie).toLowerCase()} des équipements ?` : undefined}>
      <TextField select label="Équipement" value={categorie} onChange={(x) => setCategorie(x.target.value as CategorieEquipement)}>
        {categoriesEquipement.map(([k, l]) => <MenuItem key={k} value={k} sx={{ minHeight: 48 }}>{l}</MenuItem>)}
      </TextField>
      <TextField label={categorie === 'autre' ? 'Nom de l’équipement' : 'Précision (modèle, taille, nombre de becs…)'} value={precision} onChange={(x) => setPrecision(x.target.value)} required={categorie === 'autre'} />
      {!plusieurs && <TextField label="Quantité" value={quantite} onChange={(x) => setQuantite(x.target.value)} slotProps={{ htmlInput: { inputMode: 'numeric' } }} required />}
      {!plusieurs && <TextField label="Année d’achat" value={annee} onChange={(x) => setAnnee(x.target.value)} slotProps={{ htmlInput: { inputMode: 'numeric' } }} />}
      {!plusieurs && <TextField label="Prix d’achat HT (toute la ligne)" value={valeur} onChange={(x) => setValeur(x.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />}
      <TextField label="Note" value={note} onChange={(x) => setNote(x.target.value)} multiline minRows={2} />
    </Fenetre>
  )
}
