// Équipements du magasin (Joseph, 14/11/2026) : le matériel acheté et mis à disposition, surtout pour le marché
// extérieur. L'équipe et le franchisé (ses magasins, Joseph 14/11/2026) ajoutent, modifient ou retirent une ligne ;
// le nombre de tireuses ouvre le simulateur du parc.
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { Section } from './Section'
import { Fenetre } from './EditionEquipe'
import { useAuth } from '../auth/AuthContext'
import { useApercu } from '../auth/Apercu'
import { enregistrerEquipements, enregistrerEquipementsFranchise } from '../data/chargement'
import { formatEuros } from '../data/chiffres'
import { categoriesEquipement, equipementsDu, libelleCategorie, resumeEquipements, tireusesDu, type CategorieEquipement, type Equipement } from '../data/equipements'
import type { Magasin, Reseau } from '../data/modele'

export function SectionEquipements({ reseau, m, signaler }: { reseau: Reseau; m: Magasin; signaler?: (msg: string) => void }) {
  const { profil } = useAuth()
  const { apercu } = useApercu()
  const [edition, setEdition] = useState<Equipement | null | undefined>(undefined)
  const liste = equipementsDu(reseau, m.nom)
  const lecture = apercu
  const ecrire = profil?.role === 'franchise' ? enregistrerEquipementsFranchise : enregistrerEquipements
  const r = resumeEquipements(liste)
  const tireuses = tireusesDu(liste)
  const titre = liste.length ? `Équipements · ${r.nombre}${r.valeur > 0 ? ` · ${formatEuros(r.valeur)} HT` : ''}` : 'Équipements'
  return (
    <Section titre={titre} action={lecture ? undefined : <Button startIcon={<AddOutlined />} onClick={() => setEdition(null)} aria-label="Ajouter un équipement" sx={{ minHeight: 48 }}>Ajouter</Button>}>
      {!liste.length ? (
        <Typography variant="body2" color="text.secondary">Aucun équipement enregistré : tireuses, barnums, camion ou chariot mis à disposition du magasin.</Typography>
      ) : (
        <Box component="ul" aria-label={`Équipements de ${m.nom}`} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {liste.map((e) => (
            <Box component="li" key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{e.quantite > 1 ? `${e.quantite} × ` : ''}{libelleCategorie(e.categorie)}</Typography>
                {(e.precision || e.annee || e.valeur !== null) && (
                  <Typography variant="body2" color="text.secondary">{[e.precision, e.annee && `achat ${e.annee}`, e.valeur !== null && `${formatEuros(e.valeur)} HT`].filter(Boolean).join(' · ')}</Typography>
                )}
                {e.note && <Typography variant="body2" sx={{ mt: 0.25 }}>« {e.note} »</Typography>}
              </Box>
              {!lecture && <IconButton onClick={() => setEdition(e)} aria-label={`Modifier ${libelleCategorie(e.categorie)}${e.precision ? ` ${e.precision}` : ''}`} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton>}
            </Box>
          ))}
        </Box>
      )}
      {tireuses !== null && (
        <Button component={RouterLink} to={`/magasins/${encodeURIComponent(m.nom)}?vue=chiffres&partie=simulateurs&sim=tireuses`} sx={{ minHeight: 48, mt: 1 }}>
          {`Simuler le parc de ${tireuses} tireuse${tireuses > 1 ? 's' : ''}`}
        </Button>
      )}
      {edition !== undefined && <DialogEquipement m={m} liste={liste} ecrire={ecrire} equipement={edition} par={profil?.nom ?? ''} jour={reseau.jour}
        onFermer={(msg) => { setEdition(undefined); if (msg) signaler?.(msg) }} />}
    </Section>
  )
}

const nombreOuNull = (v: string) => { const n = Number(v.replace(/\s/g, '').replace(',', '.')); return v.trim() && Number.isFinite(n) ? n : null }

function DialogEquipement({ m, liste, ecrire, equipement: e, par, jour, onFermer }: { m: Magasin; liste: Equipement[]; ecrire: (magasin: string, liste: Equipement[]) => Promise<void>; equipement: Equipement | null; par: string; jour: string; onFermer: (msg?: string) => void }) {
  const [categorie, setCategorie] = useState<CategorieEquipement>(e?.categorie ?? 'tireuse')
  const [precision, setPrecision] = useState(e?.precision ?? '')
  const [quantite, setQuantite] = useState(String(e?.quantite ?? 1))
  const [annee, setAnnee] = useState(e?.annee ? String(e.annee) : '')
  const [valeur, setValeur] = useState(e?.valeur !== null && e?.valeur !== undefined ? String(e.valeur) : '')
  const [note, setNote] = useState(e?.note ?? '')
  const q = nombreOuNull(quantite), a = nombreOuNull(annee), v = nombreOuNull(valeur)
  const valide = q !== null && q >= 1 && (!annee.trim() || (a !== null && a >= 1950 && a <= 2100)) && (!valeur.trim() || (v !== null && v >= 0)) && (categorie !== 'autre' || !!precision.trim())
  const enregistrer = async () => {
    const ligne: Equipement = {
      id: e?.id ?? `e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, categorie, precision: precision.trim(),
      quantite: Math.round(q ?? 1), annee: a !== null ? Math.round(a) : null, valeur: v, note: note.trim(), par: e?.par || par, le: e?.le || jour,
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
      <TextField label="Quantité" value={quantite} onChange={(x) => setQuantite(x.target.value)} slotProps={{ htmlInput: { inputMode: 'numeric' } }} required />
      <TextField label="Année d’achat" value={annee} onChange={(x) => setAnnee(x.target.value)} slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
      <TextField label="Prix d’achat HT (toute la ligne)" value={valeur} onChange={(x) => setValeur(x.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
      <TextField label="Note" value={note} onChange={(x) => setNote(x.target.value)} multiline minRows={2} />
    </Fenetre>
  )
}
