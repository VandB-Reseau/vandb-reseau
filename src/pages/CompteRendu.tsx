import { RangeePhotos } from '../components/GrilleAudit'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import GlobalStyles from '@mui/material/GlobalStyles'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import ArrowBack from '@mui/icons-material/ArrowBack'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { EnvoyerCompteRendu } from '../components/EnvoyerCompteRendu'
import { Logo } from '../components/Logo'
import { dateLongue } from '../lib/format'
import { coachA } from '../data/charge'
import { libelleResponsable, libelleTypeVisite, nomsVisiteurs } from '../data/modele'
import { PARTIES } from '../data/compteRendu'

// À l'impression, seule la feuille du compte rendu reste visible (menu, barres et boutons masqués)
const styleImpression = (
  <GlobalStyles styles={{
    '@media print': {
      'header, nav, .MuiDrawer-root, .MuiBottomNavigation-root, .sans-impression': { display: 'none !important' },
      'body, main': { background: '#fff !important', padding: '0 !important', margin: '0 !important' },
      '.feuille': { boxShadow: 'none !important', border: '0 !important', margin: '0 !important', maxWidth: 'none !important' },
      '@page': { size: 'A4', margin: '14mm' },
    },
  }} />
)

function Champ({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <Box sx={{ py: 0.75 }}>
      <Typography variant="caption" sx={{ color: '#5f5f66', display: 'block' }}>{libelle}</Typography>
      <Typography variant="body1" sx={{ color: '#1b1b1f' }}>{children || 'Non renseigné'}</Typography>
    </Box>
  )
}

function Titre({ children }: { children: ReactNode }) {
  return <Typography variant="h4" component="h2" sx={{ color: '#1b1b1f', borderBottom: '2px solid #eaa400', pb: 0.5, mb: 1.5 }}>{children}</Typography>
}

export function CompteRendu() {
  const { id = '' } = useParams()
  const naviguer = useNavigate()
  return (
    <AvecReseau>
      {(reseau) => {
        const v = reseau.visites.find((x) => String(x.id) === id)
        if (!v) return <EmptyState icone={<EventNoteOutlined />} titre="Visite introuvable" texte="Cette visite a peut-être été supprimée." action={<Button variant="contained" onClick={() => naviguer('/visites?vue=historique')}>Voir les visites</Button>} />
        const m = reseau.magasins.find((x) => x.nom === v.magasin)
        const coach = m ? coachA(m, v.date) : ''
        const redigees = PARTIES.map((_p, i) => i).filter((i) => v.parties[i]?.trim())
        return (
          <>
            {styleImpression}
            <Box className="sans-impression" sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Button startIcon={<ArrowBack />} onClick={() => naviguer(-1)} sx={{ ml: -1, minHeight: 48 }}>Retour</Button>
              <Box sx={{ flex: 1 }} />
              <EnvoyerCompteRendu reseau={reseau} visite={v} />
              <Button variant="contained" startIcon={<PictureAsPdfOutlined />} onClick={() => window.print()} sx={{ minHeight: 48 }}>Télécharger en PDF</Button>
            </Box>
            <Box className="feuille" sx={{ bgcolor: '#fff', color: '#1b1b1f', maxWidth: 820, mx: 'auto', borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
              <Box sx={{ bgcolor: '#1b1b1f', px: 4, py: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Logo size={24} />
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ color: '#fff', fontWeight: 600 }}>{v.signatureRequise ? 'Compte rendu de visite contractuelle' : 'Compte rendu de visite'}</Typography>
              </Box>
              <Box sx={{ height: 4, background: 'linear-gradient(90deg, #f6c544, #ef7d00, #1b6fce)' }} />
              <Box sx={{ p: 4 }}>
                <Typography variant="h2" component="h1" sx={{ color: '#1b1b1f' }}>{v.magasin}</Typography>
                <Typography sx={{ color: '#5f5f66', mb: 3 }}>{libelleTypeVisite(v.type)} · {dateLongue(v.date)}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 4, mb: 3 }}>
                  <Champ libelle="Visité par">{nomsVisiteurs(v)}</Champ>
                  <Champ libelle="Coach du magasin">{coach}</Champ>
                  <Champ libelle={m ? libelleResponsable(m) : 'Franchisé'}>{m?.responsable?.nom}</Champ>
                  <Champ libelle="Responsable Régional">{m?.rr?.nom}</Champ>
                  <Champ libelle="Adresse">{[m?.adresse, m?.pays].filter(Boolean).join(', ')}</Champ>
                  <Champ libelle="Code magasin">{m?.code}</Champ>
                </Box>
                {redigees.map((i) => (
                  <Box key={i} sx={{ mb: 3, breakInside: 'avoid' }}>
                    <Titre>{`${i + 1}. ${PARTIES[i].titre}`}</Titre>
                    <Typography sx={{ whiteSpace: 'pre-wrap', color: '#1b1b1f' }}>{v.parties[i].trim()}</Typography>
                  </Box>
                ))}
                {(v.notes || redigees.length === 0) && (
                  <>
                    <Titre>Notes de visite</Titre>
                    <Typography sx={{ whiteSpace: 'pre-wrap', color: '#1b1b1f', minHeight: redigees.length ? 0 : 120, mb: 3 }}>{v.notes || 'Aucune note saisie.'}</Typography>
                  </>
                )}
                {v.plan.length > 0 && (
                  <Box sx={{ mb: 3, breakInside: 'avoid' }}>
                    <Titre>Plan d’action</Titre>
                    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', color: '#1b1b1f', '& th, & td': { textAlign: 'left', p: 1, borderBottom: '1px solid #e0e0e0', fontSize: 14, verticalAlign: 'top' }, '& th': { color: '#5f5f66', fontWeight: 600 } }}>
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
              </Box>
            </Box>
          </>
        )
      }}
    </AvecReseau>
  )
}
