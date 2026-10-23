// Questions éclair (sprint 22, A3) : poser une question et lire les résultats (Directeur, RR), répondre (franchisé)
import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { Fenetre } from './EditionEquipe'
import { Puces, TitreSection } from './Social'
import { BoutonAction } from './Outils'
import { useAuth } from '../auth/AuthContext'
import type { Reseau } from '../data/modele'
import {
  chargerQuestions, chargerQuestionsFranchise, decompte, libelleValeur, publierQuestion, repondreQuestion, supprimerQuestion, valeursDe,
  type Genre, type Question, type QuestionFranchise,
} from '../data/questions'
import { dateCourte } from '../lib/format'

const plusJours = (jour: string, n: number) => { const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const pourcent = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0)
const virgule = (x: number) => x.toFixed(1).replace('.', ',')

export function DialogQuestion({ reseau, onFermer }: { reseau: Reseau; onFermer: (m?: string) => void }) {
  const { profil } = useAuth()
  const directeur = profil?.role === 'directeur'
  const [titre, setTitre] = useState('')
  const [genre, setGenre] = useState<Genre>('oui_non')
  const [choix, setChoix] = useState('')
  const [anonyme, setAnonyme] = useState<'nominative' | 'anonyme'>('nominative')
  const regions = reseau.rrs.filter((r) => !r.integres)
  const [cible, setCible] = useState('')
  const [jusquAu, setJusquAu] = useState(plusJours(reseau.jour, 7))
  const options = choix.split('\n').map((c) => c.trim()).filter(Boolean)
  const valide = !!titre.trim() && (genre !== 'choix' || (options.length >= 2 && options.length <= 6)) && jusquAu >= reseau.jour
  return (
    <Fenetre titre="Poser une question" ouvert onFermer={onFermer} valide={valide} sansRechargement
      enregistrer={async () => {
        const magasins = !directeur || !cible ? null : reseau.magasins.filter((m) => m.rr?.id === cible).map((m) => m.nom)
        await publierQuestion({ titre: titre.trim(), genre, choix: options, anonyme: anonyme === 'anonyme', magasins, jusquAu })
        return 'Question envoyée aux franchisés.'
      }}>
      <TextField label="Question" value={titre} onChange={(e) => setTitre(e.target.value)} autoFocus multiline slotProps={{ htmlInput: { maxLength: 300 } }} />
      <Puces label="Type de réponse" valeur={genre} onChange={setGenre} options={[{ v: 'oui_non', libelle: 'Oui ou non' }, { v: 'choix', libelle: 'Choix' }, { v: 'note', libelle: 'Note de 1 à 5' }]} />
      {genre === 'choix' && <TextField label="Réponses possibles, une par ligne" value={choix} onChange={(e) => setChoix(e.target.value)} multiline minRows={3}
        error={!!choix && (options.length < 2 || options.length > 6)} helperText={options.length > 6 ? '6 réponses au plus.' : ' '} />}
      <Puces label="Réponses" valeur={anonyme} onChange={setAnonyme} options={[{ v: 'nominative', libelle: 'Avec le nom' }, { v: 'anonyme', libelle: 'Anonymes' }]} />
      {directeur
        ? <Puces label="Franchisés interrogés" valeur={cible} onChange={setCible} options={[{ v: '', libelle: 'Tout le réseau' }, ...regions.map((r) => ({ v: r.id, libelle: `Région ${r.nom}` }))]} />
        : <Typography variant="body2" color="text.secondary">Franchisés de tes magasins</Typography>}
      <TextField type="date" label="Ouverte jusqu’au" value={jusquAu} onChange={(e) => setJusquAu(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
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

function CarteQuestion({ reseau, q, jour, moi, directeur, retirer }: { reseau: Reseau; q: Question; jour: string; moi: string; directeur: boolean; retirer: () => void }) {
  const [relance, setRelance] = useState(false)
  const [noms, setNoms] = useState(false)
  const d = decompte(q)
  const ouverte = q.jusquAu >= jour
  // Par région, quand plusieurs régions ont répondu
  const regions = reseau.rrs.filter((r) => !r.integres && q.reponses.some((x) => x.regions.includes(r.id)))
  return (
    <Box component="article" aria-label={q.titre} sx={{ px: 2, py: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>{q.titre}</Typography>
          <Typography variant="body2" color="text.secondary">
            {[`${d.total} réponse${d.total > 1 ? 's' : ''} sur ${q.concernes}`, ouverte ? `ouverte jusqu’au ${dateCourte(q.jusquAu)}` : 'close', q.anonyme ? 'anonyme' : null, q.auteurNom].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        {(directeur || q.auteur === moi) && <Tooltip title="Retirer la question"><IconButton aria-label={`Retirer la question ${q.titre}`} onClick={retirer} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton></Tooltip>}
      </Box>
      <Box sx={{ mt: 1 }}>
        {d.moyenne !== null && <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Moyenne {virgule(d.moyenne)} sur 5</Typography>}
        {d.parValeur.map((x) => <Barre key={x.v} libelle={libelleValeur(q, x.v)} n={x.n} total={d.total} />)}
        {regions.length > 1 && regions.map((r) => {
          const dr = decompte(q, q.reponses.filter((x) => x.regions.includes(r.id)))
          return (
            <Typography key={r.id} variant="body2" color="text.secondary">
              Région {r.nom} : {dr.moyenne !== null ? `moyenne ${virgule(dr.moyenne)}` : dr.parValeur.filter((x) => x.n).map((x) => `${libelleValeur(q, x.v)} ${x.n}`).join(', ')} ({dr.total} réponse{dr.total > 1 ? 's' : ''})
            </Typography>
          )
        })}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
        {!q.anonyme && d.total > 0 && <Button onClick={() => setNoms((v) => !v)} aria-expanded={noms} sx={{ minHeight: 48 }}>Qui a répondu quoi</Button>}
        {q.sansReponse.length > 0 && <Button onClick={() => setRelance((v) => !v)} aria-expanded={relance} sx={{ minHeight: 48 }}>Sans réponse ({q.sansReponse.length})</Button>}
      </Box>
      <Collapse in={noms} unmountOnExit>
        <Typography variant="body2">{q.reponses.map((r) => `${r.franchise} : ${libelleValeur(q, r.valeur)}`).join(' · ')}</Typography>
      </Collapse>
      <Collapse in={relance} unmountOnExit>
        <Typography variant="body2">{q.sansReponse.join(', ')}</Typography>
      </Collapse>
    </Box>
  )
}

// Directeur et RR : questions posées et résultats ; rien tant que la base ne connaît pas les questions
export function SectionQuestions({ reseau }: { reseau: Reseau }) {
  const { profil, session } = useAuth()
  const [liste, setListe] = useState<Question[] | null>(null)
  const [ajout, setAjout] = useState(false)
  const [message, setMessage] = useState('')
  const relire = useCallback(() => { void chargerQuestions().then(setListe).catch(() => setListe(null)) }, [])
  useEffect(relire, [relire])
  if (!liste) return null
  const retirer = async (q: Question) => {
    try { await supprimerQuestion(q.id); setMessage('Question retirée.'); relire() } catch (e) { setMessage((e as Error).message) }
  }
  return (
    <Box component="section" aria-label="Questions éclair">
      <TitreSection nombre={liste.filter((q) => q.jusquAu >= reseau.jour).length} action={<BoutonAction libelle="Poser une question" onClick={() => setAjout(true)} />}>Questions éclair</TitreSection>
      {!liste.length
        ? <Card sx={{ px: 2, py: 2 }}><Typography color="text.secondary">Aucune question posée pour l’instant.</Typography></Card>
        : <Card sx={{ '& > article + article': { borderTop: '1px solid', borderColor: 'divider' } }}>
            {liste.map((q) => <CarteQuestion key={q.id} reseau={reseau} q={q} jour={reseau.jour} moi={session?.user.id ?? ''} directeur={profil?.role === 'directeur'} retirer={() => void retirer(q)} />)}
          </Card>}
      {message && <Typography role="status" sx={{ mt: 1 }}>{message}</Typography>}
      {ajout && <DialogQuestion reseau={reseau} onFermer={(m) => { setAjout(false); if (m) { setMessage(m); relire() } }} />}
    </Box>
  )
}

// Accueil du franchisé : questions ouvertes, une réponse d'un geste
export function SectionQuestionsFranchise() {
  const [liste, setListe] = useState<QuestionFranchise[] | null>(null)
  const [erreur, setErreur] = useState('')
  const relire = () => chargerQuestionsFranchise().then(setListe).catch(() => setListe(null))
  useEffect(() => { void relire() }, [])
  if (!liste?.length) return null
  const repondre = async (q: QuestionFranchise, v: string) => {
    setErreur('')
    try { await repondreQuestion(q.id, v); await relire() } catch (e) { setErreur((e as Error).message) }
  }
  return (
    <Box component="section" aria-label="Questions du réseau">
      <TitreSection nombre={liste.filter((q) => !q.repondu).length}>Questions du réseau</TitreSection>
      <Card component="ul" aria-label="Questions ouvertes" sx={{ listStyle: 'none', m: 0, p: 0, overflow: 'hidden', '& > li + li': { borderTop: '1px solid', borderColor: 'divider' } }}>
        {liste.map((q) => (
          <Box component="li" key={q.id} sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ fontWeight: 600 }}>{q.titre}</Typography>
            <Typography variant="body2" color="text.secondary">{[q.auteurNom, `jusqu’au ${dateCourte(q.jusquAu)}`, q.anonyme ? 'réponse anonyme' : null].filter(Boolean).join(' · ')}</Typography>
            {q.repondu
              ? <Typography sx={{ mt: 1, fontWeight: 600, color: 'success.dark' }}>Réponse envoyée, merci.</Typography>
              : <Box role="group" aria-label={`Répondre : ${q.titre}`} sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                  {valeursDe(q).map((v) => (
                    <Button key={v} variant="outlined" onClick={() => void repondre(q, v)} sx={{ minHeight: 48, minWidth: 48, flex: q.genre === 'oui_non' ? 1 : undefined }}>{libelleValeur(q, v)}</Button>
                  ))}
                </Box>}
          </Box>
        ))}
      </Card>
      {erreur && <Typography color="error" sx={{ mt: 1 }}>{erreur}</Typography>}
    </Box>
  )
}
