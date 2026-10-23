// Sondages (sprint 22, A3, puis 23/10/2026) : poser un sondage de 1 à 5 questions et lire les résultats (Directeur, RR),
// y répondre (franchisé depuis son accueil, équipe depuis son accueil et Infos réseau)
import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { Fenetre } from './EditionEquipe'
import { Puces, TitreSection } from './Social'
import { BoutonAction } from './Outils'
import { useAuth } from '../auth/AuthContext'
import type { Reseau } from '../data/modele'
import {
  chargerSondages, chargerSondagesARepondre, decompte, libelleValeur, publierSondage, repondreSondage, supprimerSondage, valeursDe,
  type Cible, type Genre, type QuestionSondage, type Sondage, type SondageARepondre,
} from '../data/questions'
import { dateCourte } from '../lib/format'

const MAX_QUESTIONS = 5
const plusJours = (jour: string, n: number) => { const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const pourcent = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0)
const virgule = (x: number) => x.toFixed(1).replace('.', ',')
const libelleCible: Record<Cible, string> = { franchises: 'franchisés', equipe: 'équipe', tous: 'franchisés et équipe' }

interface Brouillon { titre: string; genre: Genre; choix: string }
const nouvelle = (): Brouillon => ({ titre: '', genre: 'oui_non', choix: '' })
const optionsDe = (b: Brouillon) => b.choix.split('\n').map((c) => c.trim()).filter(Boolean)
const brouillonValide = (b: Brouillon) => !!b.titre.trim() && (b.genre !== 'choix' || (optionsDe(b).length >= 2 && optionsDe(b).length <= 6))

export function DialogSondage({ reseau, onFermer }: { reseau: Reseau; onFermer: (m?: string) => void }) {
  const { profil } = useAuth()
  const directeur = profil?.role === 'directeur'
  const [titre, setTitre] = useState('')
  const [questions, setQuestions] = useState<Brouillon[]>([nouvelle()])
  const [cible, setCible] = useState<Cible>('franchises')
  const [anonyme, setAnonyme] = useState<'nominative' | 'anonyme'>('nominative')
  const regions = reseau.rrs.filter((r) => !r.integres)
  const [region, setRegion] = useState('')
  const [jusquAu, setJusquAu] = useState(plusJours(reseau.jour, 7))
  const plusieurs = questions.length > 1
  const valide = (!plusieurs || !!titre.trim()) && questions.every(brouillonValide) && jusquAu >= reseau.jour
  const changer = (i: number, b: Partial<Brouillon>) => setQuestions((l) => l.map((x, j) => (j === i ? { ...x, ...b } : x)))
  return (
    <Fenetre titre="Nouveau sondage" ouvert onFermer={onFermer} valide={valide} sansRechargement
      enregistrer={async () => {
        const magasins = !directeur || !region ? null : reseau.magasins.filter((m) => m.rr?.id === region).map((m) => m.nom)
        await publierSondage({
          titre: plusieurs ? titre.trim() : questions[0].titre.trim(), cible, anonyme: anonyme === 'anonyme', magasins, jusquAu,
          questions: questions.map((b) => ({ titre: b.titre.trim(), genre: b.genre, choix: b.genre === 'choix' ? optionsDe(b) : [] })),
        })
        return 'Sondage envoyé.'
      }}>
      {plusieurs && <TextField label="Titre du sondage" value={titre} onChange={(e) => setTitre(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />}
      {questions.map((b, i) => {
        const options = optionsDe(b)
        const nom = plusieurs ? `Question ${i + 1}` : 'Question'
        return (
          <Box key={i} sx={{ display: 'grid', gap: 1.5, ...(plusieurs ? { pl: 1.5, borderLeft: '3px solid', borderColor: 'divider' } : {}) }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <TextField label={nom} value={b.titre} onChange={(e) => changer(i, { titre: e.target.value })} autoFocus={i === questions.length - 1} multiline fullWidth slotProps={{ htmlInput: { maxLength: 300 } }} />
              {plusieurs && <Tooltip title="Retirer la question"><IconButton aria-label={`Retirer la question ${i + 1}`} onClick={() => setQuestions((l) => l.filter((_x, j) => j !== i))} sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton></Tooltip>}
            </Box>
            <Puces label={`Type de réponse, ${nom.toLowerCase()}`} valeur={b.genre} onChange={(g) => changer(i, { genre: g })} options={[{ v: 'oui_non', libelle: 'Oui ou non' }, { v: 'choix', libelle: 'Choix' }, { v: 'note', libelle: 'Note de 1 à 5' }]} />
            {b.genre === 'choix' && <TextField label={`Réponses possibles, une par ligne (${nom.toLowerCase()})`} value={b.choix} onChange={(e) => changer(i, { choix: e.target.value })} multiline minRows={3}
              error={!!b.choix && (options.length < 2 || options.length > 6)} helperText={options.length > 6 ? '6 réponses au plus.' : ' '} />}
          </Box>
        )
      })}
      {questions.length < MAX_QUESTIONS && <Button startIcon={<AddOutlined />} onClick={() => setQuestions((l) => [...l, nouvelle()])} sx={{ minHeight: 48, justifySelf: 'start' }}>Ajouter une question</Button>}
      <Puces label="Destinataires" valeur={cible} onChange={setCible} options={[
        { v: 'franchises', libelle: 'Franchisés' }, { v: 'equipe', libelle: directeur ? 'Coachs et RR' : 'Coachs' }, { v: 'tous', libelle: 'Les deux' },
      ]} />
      <Puces label="Réponses" valeur={anonyme} onChange={setAnonyme} options={[{ v: 'nominative', libelle: 'Avec le nom' }, { v: 'anonyme', libelle: 'Anonymes' }]} />
      {directeur
        ? <Puces label="Magasins concernés" valeur={region} onChange={setRegion} options={[{ v: '', libelle: 'Tout le réseau' }, ...regions.map((r) => ({ v: r.id, libelle: `Région ${r.nom}` }))]} />
        : <Typography variant="body2" color="text.secondary">Tes magasins</Typography>}
      <TextField type="date" label="Ouvert jusqu’au" value={jusquAu} onChange={(e) => setJusquAu(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
    </Fenetre>
  )
}

function Barre({ libelle, n, total }: { libelle: string; n: number; total: number }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(64px, 30%) 1fr auto', gap: 1, alignItems: 'center', py: 0.5 }}>
      <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{libelle}</Typography>
      <Box sx={{ height: 10, borderRadius: 5, bgcolor: 'action.hover', overflow: 'hidden' }}>
        <Box sx={{ width: `${pourcent(n, total)}%`, height: '100%', bgcolor: 'primary.main' }} />
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 64, textAlign: 'right' }}>{n} · {pourcent(n, total)} %</Typography>
    </Box>
  )
}

function ResultatQuestion({ reseau, s, q, n }: { reseau: Reseau; s: Sondage; q: QuestionSondage; n: number }) {
  const d = decompte(q, n, s.reponses)
  // Par région, quand plusieurs régions ont répondu
  const regions = reseau.rrs.filter((r) => !r.integres && s.reponses.some((x) => x.regions.includes(r.id)))
  return (
    <Box sx={{ mt: 1 }}>
      {s.questions.length > 1 && <Typography sx={{ fontWeight: 600 }}>{n + 1}. {q.titre}</Typography>}
      {d.moyenne !== null && <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Moyenne {virgule(d.moyenne)} sur 5</Typography>}
      {d.parValeur.map((x) => <Barre key={x.v} libelle={libelleValeur(q, x.v)} n={x.n} total={d.total} />)}
      {regions.length > 1 && regions.map((r) => {
        const dr = decompte(q, n, s.reponses.filter((x) => x.regions.includes(r.id)))
        return (
          <Typography key={r.id} variant="body2" color="text.secondary">
            Région {r.nom} : {dr.moyenne !== null ? `moyenne ${virgule(dr.moyenne)}` : dr.parValeur.filter((x) => x.n).map((x) => `${libelleValeur(q, x.v)} ${x.n}`).join(', ')} ({dr.total} réponse{dr.total > 1 ? 's' : ''})
          </Typography>
        )
      })}
    </Box>
  )
}

function CarteSondage({ reseau, s, jour, moi, directeur, retirer }: { reseau: Reseau; s: Sondage; jour: string; moi: string; directeur: boolean; retirer: () => void }) {
  const [relance, setRelance] = useState(false)
  const [noms, setNoms] = useState(false)
  const total = s.reponses.length
  const ouverte = s.jusquAu >= jour
  const equipe = s.reponses.filter((r) => r.role !== 'franchise').length
  return (
    <Box component="article" aria-label={s.titre} sx={{ px: 2, py: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>{s.titre}</Typography>
          <Typography variant="body2" color="text.secondary">
            {[`${total} réponse${total > 1 ? 's' : ''} sur ${s.concernes}`, s.cible === 'tous' && total ? `dont ${equipe} de l’équipe` : null,
              `pour ${libelleCible[s.cible]}`, ouverte ? `ouvert jusqu’au ${dateCourte(s.jusquAu)}` : 'clos', s.anonyme ? 'anonyme' : null, s.auteurNom].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        {(directeur || s.auteur === moi) && <Tooltip title="Retirer le sondage"><IconButton aria-label={`Retirer le sondage ${s.titre}`} onClick={retirer} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton></Tooltip>}
      </Box>
      {s.questions.map((q, n) => <ResultatQuestion key={n} reseau={reseau} s={s} q={q} n={n} />)}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
        {!s.anonyme && total > 0 && <Button onClick={() => setNoms((v) => !v)} aria-expanded={noms} sx={{ minHeight: 48 }}>Qui a répondu quoi</Button>}
        {s.sansReponse.length > 0 && <Button onClick={() => setRelance((v) => !v)} aria-expanded={relance} sx={{ minHeight: 48 }}>Sans réponse ({s.sansReponse.length})</Button>}
      </Box>
      <Collapse in={noms} unmountOnExit>
        <Typography variant="body2">{s.reponses.map((r) => `${r.franchise} : ${r.valeurs.map((v, i) => (s.questions[i] ? libelleValeur(s.questions[i], v) : v)).join(', ')}`).join(' · ')}</Typography>
      </Collapse>
      <Collapse in={relance} unmountOnExit>
        <Typography variant="body2">{s.sansReponse.join(', ')}</Typography>
      </Collapse>
    </Box>
  )
}

// Directeur et RR : sondages posés et résultats ; rien tant que la base ne connaît pas les sondages
export function SectionSondages({ reseau }: { reseau: Reseau }) {
  const { profil, session } = useAuth()
  const [liste, setListe] = useState<Sondage[] | null>(null)
  const [ajout, setAjout] = useState(false)
  const [message, setMessage] = useState('')
  const relire = useCallback(() => { void chargerSondages().then(setListe).catch(() => setListe(null)) }, [])
  useEffect(relire, [relire])
  if (!liste) return null
  const retirer = async (s: Sondage) => {
    try { await supprimerSondage(s.id); setMessage('Sondage retiré.'); relire() } catch (e) { setMessage((e as Error).message) }
  }
  return (
    <Box component="section" aria-label="Sondages posés">
      <TitreSection nombre={liste.filter((s) => s.jusquAu >= reseau.jour).length} action={<BoutonAction libelle="Nouveau sondage" onClick={() => setAjout(true)} />}>Sondages posés</TitreSection>
      {!liste.length
        ? <Card sx={{ px: 2, py: 2 }}><Typography color="text.secondary">Aucun sondage pour l’instant.</Typography></Card>
        : <Card sx={{ '& > article + article': { borderTop: '1px solid', borderColor: 'divider' } }}>
            {liste.map((s) => <CarteSondage key={s.id} reseau={reseau} s={s} jour={reseau.jour} moi={session?.user.id ?? ''} directeur={profil?.role === 'directeur'} retirer={() => void retirer(s)} />)}
          </Card>}
      {message && <Typography role="status" sx={{ mt: 1 }}>{message}</Typography>}
      {ajout && <DialogSondage reseau={reseau} onFermer={(m) => { setAjout(false); if (m) { setMessage(m); relire() } }} />}
    </Box>
  )
}

// Un sondage à remplir : une question se répond d'un geste, plusieurs se répondent puis s'envoient ensemble
function SondageAFaire({ s, envoyer }: { s: SondageARepondre; envoyer: (valeurs: string[]) => Promise<void> }) {
  const [valeurs, setValeurs] = useState<string[]>([])
  const seule = s.questions.length === 1
  const complet = s.questions.every((_q, i) => !!valeurs[i])
  return (
    <Box component="li" aria-label={s.titre} sx={{ px: 2, py: 1.5 }}>
      <Typography sx={{ fontWeight: 600 }}>{s.titre}</Typography>
      <Typography variant="body2" color="text.secondary">{[s.auteurNom, `jusqu’au ${dateCourte(s.jusquAu)}`, s.anonyme ? 'réponse anonyme' : null].filter(Boolean).join(' · ')}</Typography>
      {s.repondu
        ? <Typography sx={{ mt: 1, fontWeight: 600, color: 'success.dark' }}>Réponse envoyée, merci.</Typography>
        : <>
            {s.questions.map((q, i) => (
              <Box key={i} sx={{ mt: 1 }}>
                {!seule && <Typography variant="body2" sx={{ fontWeight: 600 }}>{i + 1}. {q.titre}</Typography>}
                <Box role="group" aria-label={`Répondre : ${q.titre}`} sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                  {valeursDe(q).map((v) => (
                    <Button key={v} variant={valeurs[i] === v ? 'contained' : 'outlined'} aria-pressed={seule ? undefined : valeurs[i] === v}
                      onClick={() => { if (seule) void envoyer([v]); else setValeurs((l) => { const n = [...l]; n[i] = v; return n }) }}
                      sx={{ minHeight: 48, minWidth: 48, flex: q.genre === 'oui_non' ? 1 : undefined }}>{libelleValeur(q, v)}</Button>
                  ))}
                </Box>
              </Box>
            ))}
            {!seule && <Button variant="contained" disabled={!complet} onClick={() => void envoyer(s.questions.map((_q, i) => valeurs[i]))} sx={{ mt: 1.5, minHeight: 48 }}>Envoyer mes réponses</Button>}
          </>}
    </Box>
  )
}

// Sondages à remplir : franchisé (accueil) ou équipe (accueil, Infos réseau). aFaire : seulement ceux sans réponse.
export function SondagesARepondre({ equipe = false, aFaire = false, titre = 'Sondages du réseau' }: { equipe?: boolean; aFaire?: boolean; titre?: string }) {
  const [liste, setListe] = useState<SondageARepondre[] | null>(null)
  const [erreur, setErreur] = useState('')
  const relire = useCallback(() => chargerSondagesARepondre(equipe).then(setListe).catch(() => setListe(null)), [equipe])
  useEffect(() => { void relire() }, [relire])
  // Un sondage qui vient d'être rempli reste affiché avec son merci jusqu'au prochain passage
  const [faits, setFaits] = useState<number[]>([])
  const visibles = (liste ?? []).filter((s) => !aFaire || !s.repondu || faits.includes(s.id))
  if (!visibles.length) return null
  const envoyer = async (s: SondageARepondre, valeurs: string[]) => {
    setErreur('')
    try { await repondreSondage(s.id, valeurs); setFaits((f) => [...f, s.id]); await relire() } catch (e) { setErreur((e as Error).message) }
  }
  return (
    <Box component="section" aria-label={titre} sx={{ mb: 2 }}>
      <TitreSection nombre={visibles.filter((s) => !s.repondu).length}>{titre}</TitreSection>
      <Card component="ul" aria-label="Sondages ouverts" sx={{ listStyle: 'none', m: 0, p: 0, overflow: 'hidden', '& > li + li': { borderTop: '1px solid', borderColor: 'divider' } }}>
        {visibles.map((s) => <SondageAFaire key={s.id} s={s} envoyer={(v) => envoyer(s, v)} />)}
      </Card>
      {erreur && <Typography color="error" sx={{ mt: 1 }}>{erreur}</Typography>}
    </Box>
  )
}
