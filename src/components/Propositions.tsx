// Bonnes pratiques proposées par les franchisés (sprint 22, A4)
import { useCallback, useEffect, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Fenetre } from './EditionEquipe'
import { TitreSection } from './Social'
import { BoutonAction } from './Outils'
import { ChampDicte } from './SaisieCompteRendu'
import { DialogPratique } from './BonnesPratiques'
import type { Reseau } from '../data/modele'
import { chargerMesPropositions, chargerPropositions, proposerPratique, traiterProposition, type Proposition } from '../data/propositions'
import { dateCourte } from '../lib/format'

const liste = { listStyle: 'none', m: 0, p: 0, overflow: 'hidden', '& > li + li': { borderTop: '1px solid', borderColor: 'divider' } } as const

// Équipe : propositions à relire sur ses magasins ; rien s'il n'y en a pas
export function PropositionsARelire({ reseau, signaler }: { reseau: Reseau; signaler: (m: string) => void }) {
  const [propositions, setPropositions] = useState<Proposition[] | null>(null)
  const [relue, setRelue] = useState<Proposition | null>(null)
  const relire = useCallback(() => { void chargerPropositions().then(setPropositions).catch(() => setPropositions(null)) }, [])
  useEffect(relire, [relire])
  if (!propositions?.length) return null
  const refuser = async (p: Proposition) => {
    try { await traiterProposition(p.id, 'refusee'); signaler('Proposition non retenue.'); relire() } catch (e) { signaler((e as Error).message) }
  }
  return (
    <Box component="section" aria-label="Propositions des franchisés" sx={{ mb: 2 }}>
      <TitreSection nombre={propositions.length}>Propositions des franchisés</TitreSection>
      <Card component="ul" sx={liste}>
        {propositions.map((p) => (
          <Box component="li" key={p.id} sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ fontWeight: 600 }}>{p.titre}</Typography>
            <Typography variant="body2" color="text.secondary">{[p.magasin, p.franchise, `proposée le ${dateCourte(p.proposeLe.slice(0, 10))}`].join(' · ')}</Typography>
            {p.texte && <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>{p.texte}</Typography>}
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" onClick={() => setRelue(p)} sx={{ minHeight: 48 }} aria-label={`Relire et publier : ${p.titre}`}>Relire et publier</Button>
              <Button onClick={() => void refuser(p)} sx={{ minHeight: 48 }} aria-label={`Ne pas retenir : ${p.titre}`}>Ne pas retenir</Button>
            </Box>
          </Box>
        ))}
      </Card>
      {relue && <DialogPratique reseau={reseau} pratique={null} depart={{ magasin: relue.magasin, titre: relue.titre, texte: relue.texte, par: relue.franchise }}
        apres={(id) => traiterProposition(relue.id, 'publiee', id)}
        onFermer={(m) => { setRelue(null); if (m) { signaler(m); relire() } }} />}
    </Box>
  )
}

const libelles = { proposee: 'En relecture', publiee: 'Publiée', refusee: 'Non retenue' } as const
const couleurs = { proposee: 'default', publiee: 'success', refusee: 'default' } as const

function DialogProposer({ reseau, onFermer }: { reseau: Reseau; onFermer: (m?: string) => void }) {
  const noms = reseau.magasins.map((m) => m.nom)
  const [magasin, setMagasin] = useState(noms.length === 1 ? noms[0] : '')
  const [titre, setTitre] = useState('')
  const [texte, setTexte] = useState('')
  return (
    <Fenetre titre="Proposer une bonne pratique" ouvert onFermer={onFermer} valide={!!magasin && !!titre.trim()} sansRechargement
      enregistrer={async () => { await proposerPratique(magasin, titre.trim(), texte.trim()); return 'Proposition envoyée à ton Coach.' }}>
      {noms.length > 1 && <Autocomplete options={noms} value={magasin || null} onChange={(_e, v) => setMagasin(v ?? '')} renderInput={(p) => <TextField {...p} label="Magasin" />} />}
      <TextField label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} autoFocus slotProps={{ htmlInput: { maxLength: 200 } }} />
      <ChampDicte libelle="Ce que fait le magasin" valeur={texte} changer={setTexte} minRows={4} />
    </Fenetre>
  )
}

// Franchisé : proposer, et suivre ses propositions ; rien tant que la base ne les connaît pas
export function MesPropositions({ reseau }: { reseau: Reseau }) {
  const [propositions, setPropositions] = useState<Proposition[] | null>(null)
  const [ajout, setAjout] = useState(false)
  const [message, setMessage] = useState('')
  const relire = useCallback(() => { void chargerMesPropositions().then(setPropositions).catch(() => setPropositions(null)) }, [])
  useEffect(relire, [relire])
  if (!propositions) return null
  return (
    <Box component="section" aria-label="Mes propositions" sx={{ mb: 2 }}>
      <TitreSection nombre={propositions.length} action={<BoutonAction libelle="Proposer une bonne pratique" onClick={() => setAjout(true)} />}>Mes propositions</TitreSection>
      {propositions.length > 0 && (
        <Card component="ul" sx={liste}>
          {propositions.map((p) => (
            <Box component="li" key={p.id} sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{p.titre}</Typography>
                <Typography variant="body2" color="text.secondary">{[p.magasin, dateCourte(p.proposeLe.slice(0, 10))].join(' · ')}</Typography>
              </Box>
              <Chip label={libelles[p.statut]} color={couleurs[p.statut]} variant={p.statut === 'publiee' ? 'filled' : 'outlined'} sx={{ fontSize: '0.8125rem' }} />
            </Box>
          ))}
        </Card>
      )}
      {message && <Typography role="status" sx={{ mt: 1 }}>{message}</Typography>}
      {ajout && <DialogProposer reseau={reseau} onFermer={(m) => { setAjout(false); if (m) { setMessage(m); relire() } }} />}
    </Box>
  )
}
