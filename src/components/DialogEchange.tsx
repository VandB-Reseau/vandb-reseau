// Compte rendu d'échange (Joseph, 25/11/2026) : après un appel ou un point, quelques lignes rangées dans le dossier du
// magasin, à côté des comptes rendus de visite (carnet, historique). Sans titre, sans signature, rien n'est envoyé : un
// appel ou un point n'est jamais renvoyé au franchisé (espace_franchise écarte ces types). Enregistré comme une visite de
// type « appel » ou « point », sans migration.
import { useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import { Fenetre } from './EditionEquipe'
import { Puces } from './Social'
import { TexteDicte } from './Dictee'
import { ChampDate } from './ChampDate'
import { useAuth } from '../auth/AuthContext'
import { monNomPorteur } from '../data/actions'
import { enregistrerVisites } from '../data/chargement'
import { partiesVides } from '../data/compteRendu'
import { estErreurReseau, horsLigne, mettreEnAttente } from '../lib/horsLigne'
import type { Reseau, Visite } from '../data/modele'

type TypeEchange = 'appel' | 'point'

export function DialogEchange({ reseau, magasin: initial, typeInitial = 'appel', onFermer }: { reseau: Reseau; magasin?: string; typeInitial?: TypeEchange; onFermer: (m?: string) => void }) {
  const { profil } = useAuth()
  const [magasin, setMagasin] = useState(initial ?? '')
  const [type, setType] = useState<TypeEchange>(typeInitial)
  const [date, setDate] = useState(reseau.jour)
  const [texte, setTexte] = useState('')
  const moi = monNomPorteur(reseau, profil) || profil?.nom || ''
  const magasins = reseau.magasins.map((m) => m.nom).sort((a, b) => a.localeCompare(b, 'fr'))
  return (
    <Fenetre titre="Compte rendu d’échange" ouvert onFermer={onFermer} valide={!!magasin && !!date && !!texte.trim()}
      enregistrer={async () => {
        const base: Omit<Visite, 'magasin' | 'id'> = { groupe: '', date, type, visiteurs: moi ? [moi] : [], signatureRequise: false, lienSigne: '', dateSignature: '', documents: [], photos: [], notes: texte.trim(), parties: partiesVides(), plan: [], prevue: false }
        const garder = async () => {
          await mettreEnAttente('visite', `${type === 'appel' ? 'Appel' : 'Point'} · ${magasin}`, { base, magasins: [magasin], audit: null })
          return 'Échange gardé sur l’appareil : il partira seul au retour du réseau.'
        }
        if (horsLigne()) return garder()
        try { await enregistrerVisites(base, [magasin], null) } catch (e) { if (estErreurReseau(e)) return garder(); throw e }
        return `Échange rangé dans le dossier de ${magasin}.`
      }}>
      {!initial && <Autocomplete options={magasins} value={magasin || null} onChange={(_, v) => setMagasin(v ?? '')} renderInput={(p) => <TextField {...p} label="Magasin" />} />}
      <Puces label="Échange" valeur={type} onChange={setType} options={[{ v: 'appel', libelle: 'Appel' }, { v: 'point', libelle: 'Point' }]} />
      <ChampDate label="Date" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TexteDicte label="Ce qui s’est dit" libelleDictee="Ce qui s’est dit" valeur={texte} changer={setTexte} multiline minRows={5} autoFocus fullWidth />
    </Fenetre>
  )
}
