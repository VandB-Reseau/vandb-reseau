import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import ArrowBack from '@mui/icons-material/ArrowBack'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { EnTeteLettre, PiedLettre } from '../components/Lettre'
import { Bloc, FILET, GRIS, NOIR, ROUGE, VERT, Vide, styleImpression, tableau } from '../components/Feuille'
import { Puces } from '../components/Social'
import { BoutonAjouterAction } from '../components/Actions'
import { EnvoyerAuFranchise } from '../components/EnvoyerCompteRendu'
import { useAuth } from '../auth/AuthContext'
import { dateCourte, dateLongue } from '../lib/format'
import { libelleTypeVisite, nomsVisiteurs, visiteFaite, type Magasin, type Reseau } from '../data/modele'
import { caDe, chiffresDuMagasin, decalerMois, estVisite, formatEuros, formatPourcent, formatValeur, libelleAudit, libelleMois, type ChampChiffre, type ChiffreMois } from '../data/chiffres'
import { caseDe, historiqueSante, nineBox, tonDe, type CaseNineBox } from '../data/sante'
import { anneeDe, suiviRythme } from '../data/visites'
import { actionsDuMagasin, echeanceDate } from '../data/actions'
import { reunionsDuMagasin, usePresences } from '../data/reunions'

// Bilan de l'année d'un magasin (sprint 26, F1), pour l'entretien annuel avec le franchisé : chiffres de l'année face
// à N-1, visites, nine box du début à la fin de l'année, audits, tâches tenues, réunions et formations, thématiques
// déployées, priorités de l'année suivante. Au format lettre, téléchargeable en PDF, envoyable au franchisé.
// Année civile, comme le reste de l'app ; l'année en cours s'arrête à aujourd'hui.

const moisDe = (annee: string) => Array.from({ length: 12 }, (_x, i) => `${annee}-${String(i + 1).padStart(2, '0')}`)
const somme = (l: (number | null)[]) => (l.some((x) => x !== null) ? l.reduce<number>((s, x) => s + (x ?? 0), 0) : null)
const moyenne = (l: (number | null)[]) => { const v = l.filter((x): x is number => x !== null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null }
const ecartPct = (a: number | null, b: number | null) => (a !== null && b ? ((a - b) / b) * 100 : null)

export interface Bilan {
  annee: string; fin: string
  // Chiffres : mois de l'année qui ont un CA, comparés aux mêmes mois un an plus tôt
  mois: { mois: string; ca: number | null; ref: number | null }[]
  ca: number | null; caRef: number | null; ecart: number | null
  indicateurs: { id: ChampChiffre; libelle: string; valeur: number | null; ref: number | null }[]
  visites: { faites: number; reference: number; liste: Reseau['visites'] }
  caseDebut: CaseNineBox | null; caseFin: CaseNineBox | null
  audits: Reseau['audits'][string]
  taches: { tenues: number; echues: number; enCours: number; enRetard: number }
  reunions: ReturnType<typeof reunionsDuMagasin> | null
  thematiques: { libelle: string; etat: string; ton: ReturnType<typeof tonDe> }[]
  priorites: ReturnType<typeof actionsDuMagasin>
}

const caseAu = (reseau: Reseau, nom: string, date: string): CaseNineBox | null => {
  const p = historiqueSante(reseau.evaluations, nom).filter((x) => x.caseId && x.date <= date).at(-1)
  return p ? nineBox.find((c) => c.id === p.caseId) ?? null : null
}

export function bilanDe(reseau: Reseau, m: Magasin, annee: string, presences: Parameters<typeof reunionsDuMagasin>[2] | null): Bilan {
  const a = anneeDe(`${annee}-01-01`)
  const fin = a.fin < reseau.jour ? a.fin : reseau.jour
  const liste = chiffresDuMagasin(reseau, m.nom)
  const du = (mo: string): ChiffreMois | undefined => liste.find((c) => c.mois === mo)
  const mois = moisDe(annee).filter((mo) => mo <= fin.slice(0, 7))
    .map((mo) => ({ mois: mo, ca: caDe(du(mo)), ref: caDe(du(decalerMois(mo, -12))) })).filter((x) => x.ca !== null)
  // Le total ne compare que les mois connus des deux années
  const comparables = mois.filter((x) => x.ref !== null)
  const ca = somme(mois.map((x) => x.ca))
  const caComp = somme(comparables.map((x) => x.ca)), caRef = somme(comparables.map((x) => x.ref))
  const indicateurs = ([['pmCave', 'Panier moyen HT cave'], ['fluxCave', 'Flux cave'], ['pmBar', 'Panier moyen HT bar'], ['fluxBar', 'Flux bar'], ['marge', 'Marge']] as [ChampChiffre, string][])
    .map(([id, libelle]) => ({ id, libelle, valeur: moyenne(mois.map((x) => du(x.mois)?.[id] ?? null)), ref: moyenne(mois.map((x) => du(decalerMois(x.mois, -12))?.[id] ?? null)) }))
    .filter((x) => x.valeur !== null)
  const rythme = suiviRythme(reseau, a).find((l) => l.magasin.nom === m.nom)
  const visites = reseau.visites.filter((v) => v.magasin === m.nom && v.date >= a.debut && visiteFaite(v, fin) && estVisite(v)).sort((x, y) => x.date.localeCompare(y.date))
  const actions = actionsDuMagasin(reseau, m.nom)
  const echues = actions.filter((x) => { const e = echeanceDate(x.a); return e && e >= a.debut && e <= fin })
  return {
    annee, fin, mois, ca, caRef, ecart: ecartPct(caComp, caRef), indicateurs,
    visites: { faites: rythme?.faites ?? visites.length, reference: rythme?.reference ?? 0, liste: visites },
    caseDebut: caseAu(reseau, m.nom, `${Number(annee) - 1}-12-31`),
    caseFin: annee === reseau.jour.slice(0, 4) ? caseDe(reseau.evaluations[m.nom]) : caseAu(reseau, m.nom, fin),
    audits: (reseau.audits[m.nom] ?? []).filter((x) => x.date >= a.debut && x.date <= fin && (x.conforme !== null || x.score !== null)).sort((x, y) => x.date.localeCompare(y.date)),
    taches: {
      echues: echues.length,
      tenues: echues.filter((x) => x.a.faite && x.a.faite <= echeanceDate(x.a)).length,
      enCours: actions.filter((x) => !x.a.faite).length,
      enRetard: actions.filter((x) => !x.a.faite && echeanceDate(x.a) && echeanceDate(x.a) < reseau.jour).length,
    },
    reunions: presences ? reunionsDuMagasin({ ...reseau, jour: `${annee}-06-30` }, m.nom, presences).filter((x) => x.e.debut <= fin) : null,
    thematiques: reseau.deploiements.thematiques.map((t) => {
      const etat = reseau.deploiements.valeurs[m.nom]?.[t.id] ?? ''
      return { libelle: t.libelle, etat: etat || 'Non renseigné', ton: tonDe(t, etat) }
    }),
    priorites: actions.filter((x) => !x.a.faite && echeanceDate(x.a) > a.fin),
  }
}

// Le bilan en texte, joint au message du franchisé (e-mail ou partage)
export function texteBilan(m: Magasin, b: Bilan): string {
  const l: string[] = [`Bilan de l'année ${b.annee} · ${m.nom}`, '']
  if (b.ca !== null) l.push(`CA de l'année : ${formatEuros(b.ca)}${b.ecart !== null ? ` (${formatPourcent(b.ecart)} vs ${Number(b.annee) - 1} sur les mêmes mois)` : ''}`)
  b.indicateurs.forEach((x) => l.push(`${x.libelle} : ${formatValeur(x.id, x.valeur)}${x.ref !== null ? ` (${formatValeur(x.id, x.ref)} en ${Number(b.annee) - 1})` : ''}`))
  l.push(`Visites : ${b.visites.faites}${b.visites.reference ? ` sur ${b.visites.reference} de référence` : ''}`)
  if (b.caseFin) l.push(`Nine box : ${b.caseDebut && b.caseDebut.id !== b.caseFin.id ? `${b.caseDebut.libelle} → ` : ''}${b.caseFin.libelle}`)
  b.audits.forEach((x) => l.push(`Audit ${x.type === 'hygiene' ? 'hygiène' : 'excellence opérationnelle'} du ${dateCourte(x.date)} : ${libelleAudit(x)}`))
  if (b.taches.echues) l.push(`Tâches tenues à l'échéance : ${b.taches.tenues} sur ${b.taches.echues}`)
  if (b.reunions?.length) l.push(`Réunions et formations suivies : ${b.reunions.filter((x) => x.presence?.present === true).length} sur ${b.reunions.length}`)
  const deployees = b.thematiques.filter((x) => x.ton === 'positif')
  if (deployees.length) l.push(`Thématiques déployées : ${deployees.map((x) => x.libelle).join(', ')}`)
  if (b.priorites.length) l.push('', `Priorités pour ${Number(b.annee) + 1} :`, ...b.priorites.map((x) => `- ${x.a.action}${x.a.porteur ? ` (${x.a.porteur})` : ''}`))
  return l.join('\n')
}

function Tuile({ libelle, valeur, detail, ton }: { libelle: string; valeur: string; detail?: string; ton?: 'rouge' | 'vert' }) {
  return (
    <Box sx={{ border: `1px solid ${FILET}`, borderRadius: 2, p: 1.25, minWidth: 0 }}>
      <Typography variant="body2" sx={{ color: GRIS }}>{libelle}</Typography>
      <Typography sx={{ color: NOIR, fontWeight: 800, fontSize: 22, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{valeur}</Typography>
      {detail && <Typography variant="body2" sx={{ color: ton === 'rouge' ? ROUGE : ton === 'vert' ? VERT : GRIS, fontWeight: ton ? 700 : 400 }}>{detail}</Typography>}
    </Box>
  )
}
const Ligne = ({ libelle, children }: { libelle: string; children: ReactNode }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 1, borderTop: `1px solid ${FILET}`, '&:first-of-type': { borderTop: 0 } }}>
    <Typography variant="body1" sx={{ color: NOIR }}>{libelle}</Typography>
    <Typography variant="body1" sx={{ color: NOIR, fontWeight: 600, textAlign: 'right' }}>{children}</Typography>
  </Box>
)
const tonEcart = (n: number | null) => (n === null ? undefined : n < 0 ? 'rouge' : 'vert') as 'rouge' | 'vert' | undefined
const couleurTon = { positif: VERT, partiel: GRIS, negatif: ROUGE } as const

function Feuille({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const naviguer = useNavigate()
  const { profil } = useAuth()
  const { presences } = usePresences()
  const courante = reseau.jour.slice(0, 4)
  const [annee, setAnnee] = useState(courante)
  const [message, setMessage] = useState('')
  const b = bilanDe(reseau, m, annee, presences)
  const precedente = String(Number(annee) - 1)
  const pctTaches = b.taches.echues ? Math.round((b.taches.tenues / b.taches.echues) * 100) : null
  const presents = b.reunions?.filter((x) => x.presence?.present === true).length ?? 0
  return (
    <>
      {styleImpression}
      <Box className="sans-impression" sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button startIcon={<ArrowBack />} onClick={() => naviguer(-1)} sx={{ ml: -1, minHeight: 48 }}>Retour</Button>
        <Puces label="Année du bilan" valeur={annee} onChange={setAnnee} options={[courante, String(Number(courante) - 1)].map((x) => ({ v: x, libelle: x }))} />
        <Box sx={{ flex: 1 }} />
        {m.franchise && profil?.role !== 'franchise' && (
          <EnvoyerAuFranchise key={annee} reseau={reseau} magasin={m.nom} titreFenetre="Envoyer le bilan de l’année"
            libelleIcone={`Envoyer au franchisé le bilan ${annee}`} sousTitre={`${m.nom} · bilan de l’année ${annee}`}
            titre={`Bilan de l'année ${annee} · ${m.nom}`} annexe={texteBilan(m, b)}
            messageParDefaut={(noms) => [`Bonjour ${noms.map((n) => n.split(' ')[0]).join(', ')},`, '', `Voici le bilan de l'année ${annee} de ${m.nom}, en vue de notre rendez-vous.`, '', 'À bientôt,', profil?.nom ?? ''].join('\n').trim()} />
        )}
        <Button variant="contained" startIcon={<PictureAsPdfOutlined />} onClick={() => window.print()} sx={{ minHeight: 48 }}>Télécharger en PDF</Button>
      </Box>
      <Box className="feuille" sx={{ bgcolor: '#fff', color: NOIR, maxWidth: 820, mx: 'auto', borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
        <EnTeteLettre objet={`Objet : bilan de l’année ${annee}`} date={`${m.franchise ? 'Franchisé' : 'Intégré'} · ${b.fin < `${annee}-12-31` ? `arrêté au ${dateLongue(b.fin)}` : `du 1er janvier au 31 décembre ${annee}`}`} />
        <Box sx={{ p: { xs: 2, sm: 4 } }}>
          <Typography variant="h2" component="h1" sx={{ color: NOIR, mb: 2 }}>{m.nom}</Typography>

          <Bloc titre="En bref">
            <Box role="group" aria-label="Repères de l’année" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1 }}>
              <Tuile libelle="CA de l’année" valeur={formatEuros(b.ca)} detail={b.ecart !== null ? `${formatPourcent(b.ecart)} vs ${precedente}` : 'pas de comparaison'} ton={tonEcart(b.ecart)} />
              <Tuile libelle="Visites" valeur={b.visites.reference ? `${b.visites.faites} / ${b.visites.reference}` : String(b.visites.faites)} detail={b.visites.reference ? 'référence nine box' : ''} />
              <Tuile libelle="Tâches tenues" valeur={b.taches.echues ? `${b.taches.tenues} / ${b.taches.echues}` : '—'} detail={pctTaches !== null ? `${pctTaches} % à l’échéance` : 'aucune échéance'} />
              <Tuile libelle="Réunions et formations" valeur={b.reunions?.length ? `${presents} / ${b.reunions.length}` : '—'} detail={b.reunions?.length ? 'présences' : 'aucune invitation'} />
            </Box>
          </Bloc>

          <Bloc titre="Chiffres">
            {!b.mois.length ? <Vide>Aucun chiffre enregistré pour {annee}.</Vide> : (
              <>
                <Box component="table" sx={tableau} aria-label={`Chiffres ${annee}`}>
                  <thead><tr><th>Mois</th><th className="nombre">CA</th><th className="nombre">{precedente}</th><th className="nombre">Écart</th></tr></thead>
                  <tbody>{b.mois.map((x) => {
                    const e = ecartPct(x.ca, x.ref)
                    return <tr key={x.mois}><td>{libelleMois(x.mois)}</td><td className="nombre">{formatEuros(x.ca)}</td><td className="nombre">{formatEuros(x.ref)}</td><td className="nombre" style={{ color: e !== null && e < 0 ? ROUGE : NOIR }}>{formatPourcent(e)}</td></tr>
                  })}</tbody>
                </Box>
                <Typography variant="body2" sx={{ color: GRIS, mt: 2, mb: 0.5 }}>Moyenne des mois de l’année face aux mêmes mois de {precedente}</Typography>
                {b.indicateurs.map((x) => (
                  <Ligne key={x.id} libelle={x.libelle}>{formatValeur(x.id, x.valeur)}{x.ref !== null && <Box component="span" sx={{ color: GRIS, fontWeight: 400 }}> · {formatValeur(x.id, x.ref)}</Box>}</Ligne>
                ))}
              </>
            )}
          </Bloc>

          <Bloc titre="Santé du magasin">
            <Ligne libelle={`Nine box au 1er janvier ${annee}`}>{b.caseDebut?.libelle ?? 'Non classé'}</Ligne>
            <Ligne libelle={annee === courante ? 'Nine box aujourd’hui' : `Nine box au 31 décembre ${annee}`}>{b.caseFin?.libelle ?? 'Non classé'}</Ligne>
            {b.audits.map((x) => <Ligne key={`${x.type}-${x.date}`} libelle={`Audit ${x.type === 'hygiene' ? 'hygiène' : 'excellence opérationnelle'} · ${dateCourte(x.date)}`}><Box component="span" sx={{ color: x.conforme === false ? ROUGE : NOIR }}>{libelleAudit(x)}</Box></Ligne>)}
            {!b.audits.length && <Ligne libelle="Audits">Aucun en {annee}</Ligne>}
          </Bloc>

          <Bloc titre={`Visites (${b.visites.liste.length})`}>
            {!b.visites.liste.length ? <Vide>Aucune visite en {annee}.</Vide> : b.visites.liste.map((v) => (
              <Ligne key={v.id ?? `${v.date}-${v.type}`} libelle={dateCourte(v.date)}>{[libelleTypeVisite(v.type), nomsVisiteurs(v)].filter(Boolean).join(' · ')}</Ligne>
            ))}
          </Bloc>

          <Bloc titre="Tâches">
            <Ligne libelle="Tenues à l’échéance">{b.taches.echues ? `${b.taches.tenues} sur ${b.taches.echues}` : 'Aucune échéance passée'}</Ligne>
            <Ligne libelle="En cours aujourd’hui">{b.taches.enCours}{b.taches.enRetard ? <Box component="span" sx={{ color: ROUGE }}> · {b.taches.enRetard} en retard</Box> : null}</Ligne>
          </Bloc>

          {b.reunions !== null && (
            <Bloc titre="Réunions et formations">
              {!b.reunions.length ? <Vide>Aucune invitation en {annee}.</Vide> : b.reunions.map(({ e, presence }) => (
                <Ligne key={e.id} libelle={`${dateCourte(e.debut)} · ${e.titre}`}>
                  <Box component="span" sx={{ color: presence?.present === true ? VERT : presence?.present === false ? ROUGE : GRIS }}>{presence?.present === true ? 'Présent' : presence?.present === false ? 'Absent' : 'Non pointé'}</Box>
                </Ligne>
              ))}
            </Bloc>
          )}

          <Bloc titre="Thématiques">
            {!b.thematiques.length ? <Vide>Aucune thématique de déploiement.</Vide> : b.thematiques.map((x) => (
              <Ligne key={x.libelle} libelle={x.libelle}><Box component="span" sx={{ color: x.ton ? couleurTon[x.ton] : GRIS }}>{x.etat}</Box></Ligne>
            ))}
          </Bloc>

          <Bloc titre={`Priorités pour ${Number(annee) + 1}`}>
            {!b.priorites.length ? <Vide>Aucune priorité posée.</Vide> : b.priorites.map((x) => (
              <Ligne key={x.cle} libelle={x.a.action}>{[x.a.porteur, dateCourte(echeanceDate(x.a))].filter(Boolean).join(' · ')}</Ligne>
            ))}
            <Box className="sans-impression" sx={{ mt: 1 }}><BoutonAjouterAction reseau={reseau} magasins={[m.nom]} signaler={setMessage} libelle="Ajouter une priorité" echeance={`${Number(annee) + 1}-06-30`} /></Box>
          </Bloc>
        </Box>
        <PiedLettre />
      </Box>
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

export function BilanAnnee() {
  const { nom = '' } = useParams()
  const naviguer = useNavigate()
  return (
    <AvecReseau>
      {(reseau) => {
        const m = reseau.magasins.find((x) => x.nom === nom)
        if (!m) return <EmptyState icone={<StorefrontOutlined />} titre="Magasin introuvable" texte="Ce magasin a peut-être été renommé ou retiré du réseau." action={<Button variant="contained" onClick={() => naviguer('/magasins')} sx={{ minHeight: 48 }}>Voir les magasins</Button>} />
        return <Feuille reseau={reseau} m={m} />
      }}
    </AvecReseau>
  )
}
