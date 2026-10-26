// Revue mensuelle d'un Responsable Régional : à préparer avant le point du mois, téléchargeable en PDF
import { useMemo, type ReactNode } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import GlobalStyles from '@mui/material/GlobalStyles'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ArrowForward from '@mui/icons-material/ArrowForward'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import { Section } from './Section'
import { Pastille } from './Social'
import { PastilleCase } from './Sante'
import { formatPourcent, libelleAlerte, libelleMois } from '../data/chiffres'
import { moisDeRevue, moisParDefaut, revueDu } from '../data/revue'
import { porteursDe, echeanceDate } from '../data/actions'
import { dateCourte, lienCoach, lienFiche, lienRR } from '../lib/format'
import type { Magasin, Reseau } from '../data/modele'

// À l'impression, seule la revue sort
const styleImpression = (
  <GlobalStyles styles={{
    '@media print': {
      'body *': { visibility: 'hidden' },
      '.revue, .revue *': { visibility: 'visible' },
      '.revue': { position: 'absolute', left: 0, top: 0, width: '100%' },
      '.revue .sans-impression': { display: 'none !important' },
      '.revue .MuiCard-root': { boxShadow: 'none !important', breakInside: 'avoid' },
      '@page': { size: 'A4', margin: '12mm' },
    },
  }} />
)

const Rangee = ({ children }: { children: ReactNode }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.5, minHeight: 52, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>{children}</Box>
)
const Vide = ({ children }: { children: ReactNode }) => <Typography variant="body2" color="text.secondary">{children}</Typography>
const LienMagasin = ({ nom }: { nom: string }) => <Link component={RouterLink} to={lienFiche(nom)} sx={{ fontWeight: 500, py: 1 }}>{nom}</Link>
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

function Compteur({ valeur, libelle }: { valeur: string | number; libelle: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
      <Typography sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{valeur}</Typography>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
    </Box>
  )
}

// parRR : revue du réseau entier pour le Directeur (sprint 24, F4), une ligne par Responsable Régional en tête
export function RevueRR({ reseau, nom, magasins, parRR = false }: { reseau: Reseau; nom: string; magasins: Magasin[]; parRR?: boolean }) {
  const [params, setParams] = useSearchParams()
  const options = moisDeRevue(reseau.jour)
  const mois = options.includes(params.get('mois') ?? '') ? params.get('mois')! : moisParDefaut(reseau.jour)
  const choisir = (m: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('mois', m); return n }, { replace: true })
  const r = useMemo(() => revueDu(reseau, magasins, mois), [reseau, magasins, mois])
  const decroche = r.decrochages.filter((d) => d.analyse.statut === 'decroche').length
  const faites = r.coachs.reduce((s, c) => s + c.faites, 0)
  const reference = Math.round(r.coachs.reduce((s, c) => s + c.reference, 0))
  const regions = useMemo(() => !parRR ? [] : reseau.rrs.map((rr) => {
    const x = revueDu(reseau, magasins.filter((m) => m.rr?.id === rr.id), mois)
    return {
      rr, decroche: x.decrochages.filter((d) => d.analyse.statut === 'decroche').length, chiffres: x.chiffresSaisis,
      faites: x.coachs.reduce((s, c) => s + c.faites, 0), reference: Math.round(x.coachs.reduce((s, c) => s + c.reference, 0)),
      retards: x.retards.length, changements: x.changements.length,
    }
  }).filter((x) => x.reference > 0 || x.decroche || x.retards), [parRR, reseau, magasins, mois])

  return (
    <Box className="revue" sx={{ display: 'grid', gap: 2 }}>
      {styleImpression}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="h2" sx={{ flex: 1, minWidth: 220 }}>Revue de {libelleMois(mois)} · {nom}</Typography>
        <TextField select label="Mois" value={mois} onChange={(e) => choisir(e.target.value)} className="sans-impression" sx={{ minWidth: 180 }}>
          {options.map((m) => <MenuItem key={m} value={m}>{libelleMois(m)}</MenuItem>)}
        </TextField>
        <Button variant="contained" startIcon={<PictureAsPdfOutlined />} onClick={() => window.print()} className="sans-impression" sx={{ minHeight: 48 }}>Télécharger en PDF</Button>
      </Box>

      <Box role="list" aria-label="En bref" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
        <Box role="listitem"><Compteur valeur={r.chiffresSaisis ? decroche : '—'} libelle={decroche > 1 ? 'magasins en Décroche' : 'magasin en Décroche'} /></Box>
        <Box role="listitem"><Compteur valeur={`${faites} / ${reference}`} libelle="visites du mois" /></Box>
        <Box role="listitem"><Compteur valeur={r.retards.length} libelle={r.retards.length > 1 ? 'tâches en retard' : 'tâche en retard'} /></Box>
        <Box role="listitem"><Compteur valeur={r.changements.length} libelle={r.changements.length > 1 ? 'changements de case' : 'changement de case'} /></Box>
      </Box>

      {parRR && (
        <Box component="section" aria-label="Par Responsable Régional">
          <Section titre="Par Responsable Régional">
            {!regions.length ? <Vide>Aucun magasin rattaché à un Responsable Régional.</Vide> : regions.map((x) => (
              <Rangee key={x.rr.id}>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Link component={RouterLink} to={`${lienRR(x.rr.id)}?vue=revue&mois=${mois}`} sx={{ fontWeight: 500, py: 1 }}>{x.rr.nom}</Link>
                  <Typography variant="body2" color="text.secondary">
                    {[x.chiffres ? `${x.decroche} en Décroche` : null, `visites ${x.faites} / ${x.reference}`, pluriel(x.retards, 'tâche') + ' en retard', x.changements ? pluriel(x.changements, 'changement') + ' de case' : null].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                {x.decroche > 0 && <Pastille ton="rouge">{`${x.decroche} Décroche`}</Pastille>}
                {x.faites < x.reference - 1 && <Pastille ton="orange">Visites en dessous</Pastille>}
              </Rangee>
            ))}
          </Section>
        </Box>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
        <Box component="section" aria-label="Magasins qui décrochent">
          <Section titre="Magasins qui décrochent">
            {!r.chiffresSaisis ? <Vide>Les chiffres de {libelleMois(mois)} ne sont pas encore saisis.</Vide>
              : !r.decrochages.length ? <Vide>Aucun magasin en Décroche ni à surveiller ce mois-ci.</Vide>
                : r.decrochages.map(({ magasin, coach, analyse }) => (
                  <Rangee key={magasin.nom}>
                    <Box sx={{ flex: 1, minWidth: 160 }}>
                      <LienMagasin nom={magasin.nom} />
                      {coach && <Typography variant="body2" color="text.secondary">{coach}</Typography>}
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>CA {formatPourcent(analyse.ecart)} vs {libelleMois(analyse.reference)}</Typography>
                    <Pastille ton={analyse.statut === 'decroche' ? 'rouge' : 'orange'}>{libelleAlerte[analyse.statut!]}</Pastille>
                  </Rangee>
                ))}
          </Section>
        </Box>

        <Box component="section" aria-label="Visites par Coach">
          <Section titre="Visites par Coach">
            {!r.coachs.length ? <Vide>Aucun magasin ouvert dans son périmètre.</Vide> : r.coachs.map((c) => {
              const ecart = c.faites - c.reference
              return (
                <Rangee key={c.coach || 'aucun'}>
                  <Box sx={{ flex: 1, minWidth: 160 }}>
                    {c.coach ? <Link component={RouterLink} to={c.rrDirect ? lienRR(c.rrDirect) : lienCoach(c.coach)} sx={{ fontWeight: 500, py: 1 }}>{c.coach}</Link> : <Typography sx={{ fontWeight: 500 }}>Sans Coach</Typography>}
                    <Typography variant="body2" color="text.secondary">{pluriel(c.magasins, 'magasin')}</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} aria-label={`${pluriel(c.faites, 'visite')} pour une référence de ${c.reference.toLocaleString('fr-FR')}`}>
                    {c.faites} / {c.reference.toLocaleString('fr-FR')}
                  </Typography>
                  {ecart <= -1 && <Pastille ton="orange">En dessous</Pastille>}
                </Rangee>
              )
            })}
          </Section>
        </Box>

        <Box component="section" aria-label="Tâches en retard">
          <Section titre="Tâches en retard">
            {!r.retards.length ? <Vide>Aucune tâche en retard à la fin du mois.</Vide> : r.retards.map((x) => (
              <Rangee key={x.cle}>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Typography variant="body1">{x.a.action}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    <LienMagasin nom={x.magasin} />{porteursDe(x.a).length ? ` · ${porteursDe(x.a).join(', ')}` : ''}
                  </Typography>
                </Box>
                <Pastille ton="orange">{`Échéance ${dateCourte(echeanceDate(x.a))}`}</Pastille>
              </Rangee>
            ))}
          </Section>
        </Box>

        <Box component="section" aria-label="Changements de case">
          <Section titre="Changements de case">
            {!r.changements.length ? <Vide>Aucun magasin n’a changé de case ce mois-ci.</Vide> : r.changements.map((c) => (
              <Rangee key={`${c.magasin.nom}-${c.date}`}>
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <LienMagasin nom={c.magasin.nom} />
                  <Typography variant="body2" color="text.secondary">{dateCourte(c.date)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }} aria-label={`${c.avant?.libelle ?? 'Non classé'} vers ${c.apres?.libelle ?? 'Non classé'}`}>
                  <PastilleCase c={c.avant} />
                  <ArrowForward fontSize="small" color="action" />
                  <PastilleCase c={c.apres} />
                </Box>
              </Rangee>
            ))}
          </Section>
        </Box>
      </Box>
    </Box>
  )
}
