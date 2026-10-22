import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import GlobalStyles from '@mui/material/GlobalStyles'
import Typography from '@mui/material/Typography'
import ArrowBack from '@mui/icons-material/ArrowBack'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { Logo } from '../components/Logo'
import { dateCourte, dateLongue } from '../lib/format'
import { libelleResponsable, libelleTypeVisite, nomsVisiteurs, type Magasin, type Reseau } from '../data/modele'
import { analyser, caDe, chiffresDuMagasin, decalerMois, dernierAudit, formatEuros, formatPourcent, formatValeur, libelleAlerte, libelleAudit, libelleMois, type ChampChiffre } from '../data/chiffres'
import { caseDe } from '../data/sante'
import { anneeDe, libellePasVu, suiviRythme } from '../data/visites'
import { preparationDe } from '../data/semaine'
import { actionsDuMagasin, echeanceDate, enRetard } from '../data/actions'
import { campagnesDuMagasin } from '../data/campagnes'
import { associesEnPlace } from '../data/associes'
import { ecarts } from '../data/grilles'
import { horodatage, messagesDu } from '../data/messagerie'
import { useMessagerie } from '../data/MessagerieContext'
import { chargerReperesEquipe, type IndicateurRepere, type Reperes } from '../data/espaceFranchise'

// Fiche avant visite : tout ce qu'il faut savoir d'un magasin sur une page, lisible au téléphone
// et téléchargeable en PDF (même feuille que le compte rendu de visite)
const styleImpression = (
  <GlobalStyles styles={{
    '@media print': {
      'header, nav, .MuiDrawer-root, .MuiBottomNavigation-root, .sans-impression, [aria-label="Aperçu"]': { display: 'none !important' },
      'body, main': { background: '#fff !important', padding: '0 !important', margin: '0 !important' },
      '.feuille': { boxShadow: 'none !important', border: '0 !important', margin: '0 !important', maxWidth: 'none !important' },
      '@page': { size: 'A4', margin: '12mm' },
    },
  }} />
)

const NOIR = '#1b1b1f', GRIS = '#5f5f66', FILET = '#e0e0e0'
const ROUGE = '#c62828', ORANGE = '#b45309', VERT = '#2e7d32'

function Titre({ children }: { children: ReactNode }) {
  return <Typography variant="h4" component="h2" sx={{ color: NOIR, borderBottom: '2px solid #eaa400', pb: 0.5, mb: 1.5 }}>{children}</Typography>
}
function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return <Box component="section" aria-label={titre} sx={{ mb: 3, breakInside: 'avoid' }}><Titre>{titre}</Titre>{children}</Box>
}
function Champ({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <Box sx={{ py: 0.75 }}>
      <Typography variant="caption" sx={{ color: GRIS, display: 'block' }}>{libelle}</Typography>
      <Typography variant="body1" sx={{ color: NOIR }}>{children || 'Non renseigné'}</Typography>
    </Box>
  )
}
const Vide = ({ children }: { children: ReactNode }) => <Typography variant="body1" sx={{ color: GRIS }}>{children}</Typography>
const tableau = { width: '100%', borderCollapse: 'collapse', color: NOIR, '& th, & td': { textAlign: 'left', p: 1, borderBottom: `1px solid ${FILET}`, fontSize: 14, verticalAlign: 'top' }, '& th': { color: GRIS, fontWeight: 600 }, '& td.nombre, & th.nombre': { textAlign: 'right', whiteSpace: 'nowrap' } } as const
const couleurStatut = { decroche: ROUGE, surveiller: ORANGE, ok: VERT } as const

// Trois derniers mois connus : une ligne par indicateur, une colonne par mois (lisible à 390 px)
function Chiffres({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const a = analyser(reseau, m.nom)
  if (!a) return <Vide>Aucun chiffre enregistré pour ce magasin.</Vide>
  const liste = chiffresDuMagasin(reseau, m.nom)
  const mois = [decalerMois(a.mois, -2), decalerMois(a.mois, -1), a.mois]
  const du = (mo: string) => liste.find((c) => c.mois === mo)
  const ecart = (mo: string) => { const ca = caDe(du(mo)), ref = caDe(du(decalerMois(mo, -12))); return ca !== null && ref ? ((ca - ref) / ref) * 100 : null }
  const lignes: { libelle: string; valeur: (mo: string) => string }[] = [
    { libelle: 'CA cumulé', valeur: (mo) => formatEuros(caDe(du(mo))) },
    { libelle: 'Écart vs N-1', valeur: (mo) => formatPourcent(ecart(mo)) },
    ...([['pmCave', 'Panier moyen HT cave'], ['fluxCave', 'Flux cave'], ['pmBar', 'Panier moyen HT bar'], ['fluxBar', 'Flux bar'], ['marge', 'Marge']] as [ChampChiffre, string][])
      .map(([id, libelle]) => ({ libelle, valeur: (mo: string) => formatValeur(id, du(mo)?.[id] ?? null) })),
  ]
  return (
    <>
      {a.statut && (
        <Typography variant="body1" sx={{ color: couleurStatut[a.statut], fontWeight: 600, mb: 1 }}>
          {libelleAlerte[a.statut]} · CA de {libelleMois(a.mois)} {formatPourcent(a.ecart)} vs {libelleMois(a.reference)}
        </Typography>
      )}
      <Box component="table" sx={tableau} aria-label={`Chiffres de ${m.nom}`}>
        <thead><tr><th /> {mois.map((mo) => <th key={mo} className="nombre">{libelleMois(mo)}</th>)}</tr></thead>
        <tbody>{lignes.map((l) => <tr key={l.libelle}><td>{l.libelle}</td>{mois.map((mo) => <td key={mo} className="nombre">{l.valeur(mo)}</td>)}</tr>)}</tbody>
      </Box>
    </>
  )
}

const libellesReperes: Record<IndicateurRepere, string> = {
  evolution: 'Évolution du CA vs N-1', pmCave: 'Panier moyen HT cave', pmBar: 'Panier moyen HT bar',
  fluxCave: 'Flux cave', fluxBar: 'Flux bar', panier: 'Panier moyen', marge: 'Marge',
}
const ordreReperes: IndicateurRepere[] = ['evolution', 'pmCave', 'pmBar', 'fluxCave', 'fluxBar', 'panier', 'marge']
const formatRepere = (i: IndicateurRepere, n: number | null) => (i === 'evolution' ? formatPourcent(n) : formatValeur(i as ChampChiffre, n))

function Reperes({ reseau, m, r }: { reseau: Reseau; m: Magasin; r: Reperes | null | undefined }) {
  if (r === undefined) return <Vide>Chargement des repères…</Vide>
  const indicateurs = r ? ordreReperes.filter((i) => r.indicateurs[i]) : []
  if (!r || !indicateurs.length) return <Vide>Pas encore assez de magasins avec des chiffres pour comparer.</Vide>
  const liste = chiffresDuMagasin(reseau, m.nom)
  const valeur = (i: IndicateurRepere) => {
    const c = liste.find((x) => x.mois === r.mois)
    if (i !== 'evolution') return c?.[i] ?? null
    const ca = caDe(c), ref = caDe(liste.find((x) => x.mois === decalerMois(r.mois, -12)))
    return ca !== null && ref ? ((ca - ref) / ref) * 100 : null
  }
  return (
    <>
      <Typography variant="body2" sx={{ color: GRIS, mb: 1 }}>{libelleMois(r.mois)}</Typography>
      <Box component="table" sx={tableau} aria-label="Repères réseau">
        <thead><tr><th>Indicateur</th><th className="nombre">Magasin</th><th className="nombre">Médiane</th><th className="nombre">Quart sup.</th></tr></thead>
        <tbody>{indicateurs.map((i) => {
          const x = r.indicateurs[i]!, v = valeur(i)
          const couleur = v === null ? NOIR : v >= x.quartHaut ? VERT : v >= x.mediane ? NOIR : ORANGE
          return <tr key={i}><td>{libellesReperes[i]}</td><td className="nombre" style={{ color: couleur, fontWeight: 600 }}>{formatRepere(i, v)}</td><td className="nombre">{formatRepere(i, x.mediane)}</td><td className="nombre">{formatRepere(i, x.quartHaut)}</td></tr>
        })}</tbody>
      </Box>
    </>
  )
}

function Fiche({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const naviguer = useNavigate()
  const { messagerie } = useMessagerie()
  const [reperes, setReperes] = useState<Reperes | null | undefined>(undefined)
  useEffect(() => {
    let actif = true
    chargerReperesEquipe([m.nom]).then((r) => { if (actif) setReperes(r) }, () => { if (actif) setReperes(null) })
    return () => { actif = false }
  }, [m.nom])

  const rythme = suiviRythme(reseau, anneeDe(reseau.jour)).find((l) => l.magasin.nom === m.nom)
  const prevue = reseau.visites.filter((v) => v.magasin === m.nom && v.date > reseau.jour).sort((a, b) => a.date.localeCompare(b.date))[0]
  const preparation = preparationDe(reseau, m.nom)
  const c = caseDe(reseau.evaluations[m.nom])
  const associes = associesEnPlace(reseau, m).map((a) => a.nom)
  const actions = actionsDuMagasin(reseau, m.nom).filter((x) => !x.a.faite)
    .sort((x, y) => Number(enRetard(y.a, reseau.jour)) - Number(enRetard(x.a, reseau.jour)) || (echeanceDate(x.a) || '9999').localeCompare(echeanceDate(y.a) || '9999'))
  const audits = (['hygiene', 'excellence'] as const).map((t) => ({ t, r: dernierAudit(reseau, m.nom, t) }))
  const campagnes = campagnesDuMagasin(reseau, m.nom, reseau.jour)
    .map((cp) => ({ cp, points: cp.points.filter((p) => !reseau.campagnes.constats[cp.id]?.[m.nom]?.[p.id]) }))
    .filter((x) => x.points.length)
  const messages = messagesDu(messagerie, m.nom).slice().sort((a, b) => b.creeLe.localeCompare(a.creeLe)).slice(0, 3)

  return (
    <>
      {styleImpression}
      <Box className="sans-impression" sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBack />} onClick={() => naviguer(-1)} sx={{ ml: -1, minHeight: 48 }}>Retour</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<PictureAsPdfOutlined />} onClick={() => window.print()} sx={{ minHeight: 48 }}>Télécharger en PDF</Button>
      </Box>
      <Box className="feuille" sx={{ bgcolor: '#fff', color: NOIR, maxWidth: 820, mx: 'auto', borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
        <Box sx={{ bgcolor: NOIR, px: { xs: 2, sm: 4 }, py: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Logo size={24} />
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ color: '#fff', fontWeight: 600 }}>Fiche avant visite</Typography>
        </Box>
        <Box sx={{ height: 4, background: 'linear-gradient(90deg, #f6c544, #ef7d00, #1b6fce)' }} />
        <Box sx={{ p: { xs: 2, sm: 4 } }}>
          <Typography variant="h2" component="h1" sx={{ color: NOIR }}>{m.nom}</Typography>
          <Typography sx={{ color: GRIS, mb: 2 }}>{m.franchise ? 'Franchisé' : 'Intégré'} · préparée le {dateLongue(reseau.jour)}</Typography>

          <Bloc titre="En bref">
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, columnGap: 4 }}>
              <Champ libelle={m.franchise ? 'Franchisés associés' : libelleResponsable(m)}>{m.franchise ? associes.join(', ') : m.responsable?.nom}</Champ>
              <Champ libelle="Coach">{m.coach}</Champ>
              <Champ libelle={m.rr?.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional'}>{m.rr?.nom}</Champ>
              <Champ libelle="Nine box">{c ? `${c.libelle} · ${c.rythme}` : 'Non classé'}</Champ>
              <Champ libelle="Dernière visite">{rythme?.derniere ? `${dateCourte(rythme.derniere.date)} · ${libelleTypeVisite(rythme.derniere.type)}${rythme.derniere.visiteurs.length ? ` · ${nomsVisiteurs(rythme.derniere)}` : ''}` : 'Jamais visité'}</Champ>
              <Champ libelle="Prochaine visite">{prevue ? `Prévue le ${dateCourte(prevue.date)}` : 'Non planifiée'}</Champ>
              <Champ libelle="Visites de l’année">{rythme ? `${rythme.faites} · référence nine box ${rythme.reference}${rythme.alerte ? ` · ${libellePasVu(rythme).toLowerCase()}` : ''}` : null}</Champ>
              <Champ libelle="Adresse">{[m.adresse, m.pays].filter(Boolean).join(', ')}</Champ>
              <Champ libelle="Téléphone du magasin">{m.telephone}</Champ>
            </Box>
          </Bloc>

          {preparation?.notes && (
            <Bloc titre="Notes de préparation">
              <Typography variant="body1" sx={{ color: NOIR, whiteSpace: 'pre-wrap' }}>{preparation.notes}</Typography>
              <Typography variant="body2" sx={{ color: GRIS, mt: 0.5 }}>{preparation.par} · {dateCourte(preparation.maj)}</Typography>
            </Bloc>
          )}

          <Bloc titre="Chiffres"><Chiffres reseau={reseau} m={m} /></Bloc>
          <Bloc titre="Repères réseau"><Reperes reseau={reseau} m={m} r={reperes} /></Bloc>

          <Bloc titre={`Tâches en cours (${actions.length})`}>
            {!actions.length ? <Vide>Aucune tâche en cours.</Vide> : (
              <Box component="table" sx={tableau} aria-label="Tâches en cours">
                <thead><tr><th>Tâche</th><th>Porteur</th><th>Échéance</th></tr></thead>
                <tbody>{actions.map((x) => {
                  const retard = enRetard(x.a, reseau.jour)
                  return <tr key={x.cle}><td>{x.a.action}</td><td>{x.a.porteur || 'Non précisé'}</td><td style={{ whiteSpace: 'nowrap', color: retard ? ROUGE : NOIR, fontWeight: retard ? 600 : 400 }}>{echeanceDate(x.a) ? `${dateCourte(echeanceDate(x.a))}${retard ? ' · en retard' : ''}` : x.a.echeance || 'Non précisée'}</td></tr>
                })}</tbody>
              </Box>
            )}
          </Bloc>

          <Bloc titre="Audits">
            {audits.map(({ t, r }) => (
              <Box key={t} sx={{ mb: 1.5 }}>
                <Typography variant="body1" sx={{ color: NOIR, fontWeight: 600 }}>{t === 'hygiene' ? 'Hygiène' : 'Excellence opérationnelle'}</Typography>
                <Typography variant="body1" sx={{ color: r?.conforme === false ? ROUGE : NOIR }}>{r ? `${libelleAudit(r)} · ${dateCourte(r.date)}` : 'Aucun audit enregistré'}</Typography>
                {ecarts(r?.reponses).map((e, i) => (
                  <Typography key={i} variant="body2" sx={{ color: NOIR, pl: 2 }}>
                    <Box component="span" sx={{ color: ROUGE, fontWeight: 600 }}>{e.critique ? 'Critique · ' : 'Écart · '}</Box>{e.libelle}{e.commentaire ? ` : ${e.commentaire}` : ''}
                  </Typography>
                ))}
              </Box>
            ))}
          </Bloc>

          <Bloc titre="Campagnes à constater">
            {!campagnes.length ? <Vide>Aucun point de campagne à constater dans ce magasin.</Vide> : campagnes.map(({ cp, points }) => (
              <Box key={cp.id} sx={{ mb: 1.5 }}>
                <Typography variant="body1" sx={{ color: NOIR, fontWeight: 600 }}>{cp.nom} · jusqu’au {dateCourte(cp.fin)}</Typography>
                <Box component="ul" sx={{ m: 0, pl: 3, color: NOIR }}>{points.map((p) => <li key={p.id}><Typography variant="body1">{p.libelle}</Typography></li>)}</Box>
              </Box>
            ))}
          </Bloc>

          <Bloc titre="Derniers messages">
            {!messages.length ? <Vide>Aucun message sur ce magasin.</Vide> : messages.map((x) => (
              <Box key={x.id} sx={{ py: 1, borderBottom: `1px solid ${FILET}`, '&:last-of-type': { borderBottom: 0 } }}>
                <Typography variant="body2" sx={{ color: GRIS }}>{x.auteurNom} · {horodatage(x.creeLe)}</Typography>
                <Typography variant="body1" sx={{ color: NOIR, whiteSpace: 'pre-wrap' }}>{x.texte}</Typography>
              </Box>
            ))}
          </Bloc>
        </Box>
      </Box>
    </>
  )
}

export function PreparationVisite() {
  const { nom = '' } = useParams()
  const naviguer = useNavigate()
  return (
    <AvecReseau>
      {(reseau) => {
        const m = reseau.magasins.find((x) => x.nom === nom)
        if (!m) return <EmptyState icone={<StorefrontOutlined />} titre="Magasin introuvable" texte="Ce magasin a peut-être été renommé ou retiré du réseau." action={<Button variant="contained" onClick={() => naviguer('/magasins')} sx={{ minHeight: 48 }}>Voir les magasins</Button>} />
        return <Fiche reseau={reseau} m={m} />
      }}
    </AvecReseau>
  )
}
