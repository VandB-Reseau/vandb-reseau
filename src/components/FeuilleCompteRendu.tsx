import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { RangeePhotos } from './GrilleAudit'
import { EnTeteLettre, IntertitreLettre, PiedLettre } from './Lettre'
import { dateLongue } from '../lib/format'
import { coachA } from '../data/charge'
import { associesEnPlace } from '../data/associes'
import { libelleResponsable, libelleTypeVisite, nomsVisiteurs, type Reseau, type Visite } from '../data/modele'
import { PARTIES } from '../data/compteRendu'
import { motDe, partiesMot } from '../data/motFranchise'

function Champ({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <Box sx={{ py: 0.75 }}>
      <Typography variant="caption" sx={{ color: '#5f5f66', display: 'block' }}>{libelle}</Typography>
      <Typography variant="body1" sx={{ color: '#1d1d1b' }}>{children || 'Non renseigné'}</Typography>
    </Box>
  )
}

const Titre = IntertitreLettre

// La feuille du compte rendu : sur sa page (imprimable en PDF) et dans la fenêtre ouverte depuis le fil d'actualité
export function FeuilleCompteRendu({ reseau, v }: { reseau: Reseau; v: Visite }) {
  const m = reseau.magasins.find((x) => x.nom === v.magasin)
  const coach = m ? coachA(m, v.date) : ''
  const redigees = PARTIES.map((_p, i) => i).filter((i) => v.parties[i]?.trim())
  const mot = motDe(reseau, v.magasin, v.id)
  return (
    <Box className="feuille" sx={{ bgcolor: '#fff', color: '#1d1d1b', maxWidth: 820, mx: 'auto', borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      <EnTeteLettre objet={`Objet : ${v.signatureRequise ? 'compte rendu de visite contractuelle' : 'compte rendu de visite'}`}
        date={`${libelleTypeVisite(v.type)} du ${dateLongue(v.date)}`} />
      <Box sx={{ p: { xs: 2, sm: 4 } }}>
        <Typography variant="h2" component="h1" sx={{ color: '#1d1d1b', mb: 2 }}>{v.magasin}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 4, mb: 3 }}>
          <Champ libelle="Visité par">{nomsVisiteurs(v)}</Champ>
          <Champ libelle="Coach du magasin">{coach}</Champ>
          <Champ libelle={m && !m.franchise ? 'Associés' : 'Franchisé'}>{m && !m.franchise ? associesEnPlace(reseau, m).map((a) => a.nom).join(', ') : m?.responsable?.nom}</Champ>
          <Champ libelle="Responsable Régional">{m?.rr?.nom}</Champ>
          <Champ libelle="Adresse">{[m?.adresse, m?.pays].filter(Boolean).join(', ')}</Champ>
          <Champ libelle="Code magasin">{m?.code}</Champ>
        </Box>
        {mot && (
          <Box component="section" aria-label="Le mot du franchisé" sx={{ mb: 3, breakInside: 'avoid' }}>
            <Titre>Le mot du franchisé</Titre>
            {partiesMot.filter((p) => mot[p.cle]).map((p) => (
              <Box key={p.cle} sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ color: '#5f5f66' }}>{p.libelle}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap', color: '#1d1d1b' }}>{mot[p.cle]}</Typography>
              </Box>
            ))}
          </Box>
        )}
        {redigees.map((i) => (
          <Box key={i} sx={{ mb: 3, breakInside: 'avoid' }}>
            <Titre>{`${i + 1}. ${PARTIES[i].titre}`}</Titre>
            <Typography sx={{ whiteSpace: 'pre-wrap', color: '#1d1d1b' }}>{v.parties[i].trim()}</Typography>
          </Box>
        ))}
        {(v.notes || redigees.length === 0) && (
          <>
            <Titre>Notes de visite</Titre>
            <Typography sx={{ whiteSpace: 'pre-wrap', color: '#1d1d1b', minHeight: redigees.length ? 0 : 120, mb: 3 }}>{v.notes || 'Aucune note saisie.'}</Typography>
          </>
        )}
        {v.plan.length > 0 && (
          <Box sx={{ mb: 3, breakInside: 'avoid' }}>
            <Titre>Plan d’action</Titre>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', color: '#1d1d1b', '& th, & td': { textAlign: 'left', p: 1, borderBottom: '1px solid #e0e0e0', fontSize: 14, verticalAlign: 'top' }, '& th': { color: '#5f5f66', fontWeight: 600 } }}>
              <thead><tr><th>Tâche</th><th>Porteur</th><th>Échéance</th></tr></thead>
              <tbody>{v.plan.map((a, i) => <tr key={i}><td>{a.action}</td><td>{a.porteur || 'Non précisé'}</td><td>{a.echeance || 'Non précisée'}</td></tr>)}</tbody>
            </Box>
          </Box>
        )}
        {v.documents.length > 0 && (
          <>
            <Titre>Documents</Titre>
            <Box component="ul" sx={{ mt: 0, mb: 3, pl: 3 }}>
              {v.documents.map((d, i) => <li key={i}><Link href={d.url} target="_blank" rel="noopener">{d.label || d.url}</Link></li>)}
            </Box>
          </>
        )}
        {(v.photos?.length ?? 0) > 0 && (
          <Box sx={{ mb: 3, breakInside: 'avoid' }}>
            <Titre>Photos</Titre>
            <RangeePhotos photos={v.photos} />
          </Box>
        )}
        {v.signatureRequise && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, mt: 4, breakInside: 'avoid' }}>
          {[m ? libelleResponsable(m) : 'Franchisé', ...(v.visiteurs.length ? v.visiteurs : ['Visiteur'])].map((s) => (
            <Box key={s}>
              <Typography variant="body2" sx={{ color: '#5f5f66' }}>Signature · {s}</Typography>
              <Box sx={{ height: 90, border: '1px solid #c9c9cf', borderRadius: 1, mt: 1 }} />
            </Box>
          ))}
        </Box>
        )}
        {v.signatureRequise && v.dateSignature && <Typography variant="body2" sx={{ color: '#5f5f66', mt: 2 }}>Signé le {dateLongue(v.dateSignature)}.</Typography>}
        {!v.signatureRequise && nomsVisiteurs(v) && <Typography sx={{ color: '#1d1d1b', fontWeight: 700, textAlign: 'right', mt: 4 }}>{nomsVisiteurs(v)}</Typography>}
      </Box>
      <PiedLettre />
    </Box>
  )
}