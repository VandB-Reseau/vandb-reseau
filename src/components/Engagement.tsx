// Engagement d'un franchisé (sprint 22, A5) : trois repères sur 90 jours, sans note agrégée, équipe seule
import Typography from '@mui/material/Typography'
import { Ligne, Section } from './Section'
import { enRetrait, FENETRE, silence, type Engagement, type Ratio } from '../data/engagement'
import { dateCourte } from '../lib/format'

const ratio = (r: Ratio) => `${r.fait} sur ${r.total}`
const ilYA = (j: number) => (j <= 0 ? 'aujourd’hui' : j === 1 ? 'hier' : `il y a ${j} jours`)

// Résumé d'une ligne pour la liste des franchisés
export function resumeEngagement(e: Engagement, jour: string): string {
  const s = silence(e, jour)
  return [
    e.communications && `Lu ${ratio(e.communications)}`,
    e.taches && `Tâches tenues ${ratio(e.taches)}`,
    s === null ? 'Aucun message' : `Écrit ${ilYA(s)}`,
    e.reunions && `Réunions ${ratio(e.reunions)}`,
  ].filter(Boolean).join(' · ')
}

function Valeur({ texte, retrait }: { texte: string; retrait: boolean }) {
  return <Typography component="span" sx={{ fontWeight: retrait ? 600 : undefined, color: retrait ? 'warning.dark' : undefined }}>{texte}{retrait ? ' · en retrait' : ''}</Typography>
}

export function SectionEngagement({ e, jour, lectures }: { e: Engagement; jour: string; lectures: boolean }) {
  const r = enRetrait(e, jour)
  const s = silence(e, jour)
  return (
    <Section titre={`Engagement · ${FENETRE} jours`}>
      {lectures && (
        <Ligne libelle="Communications lues">
          {e.communications ? <Valeur texte={ratio(e.communications)} retrait={r.communications} /> : 'Aucune communication pour ses magasins'}
        </Ligne>
      )}
      <Ligne libelle="Tâches tenues dans les délais">
        {e.taches ? <Valeur texte={ratio(e.taches)} retrait={r.taches} /> : 'Aucune tâche arrivée à échéance'}
      </Ligne>
      {e.reunions && (
        <Ligne libelle="Présent aux réunions">
          <Valeur texte={ratio(e.reunions)} retrait={r.reunions} />
        </Ligne>
      )}
      <Ligne libelle="Dernier message écrit">
        <Valeur texte={s === null ? 'Aucun message' : `${ilYA(s)} (${dateCourte(e.dernierMessage!.slice(0, 10))})`} retrait={r.messages} />
      </Ligne>
    </Section>
  )
}
