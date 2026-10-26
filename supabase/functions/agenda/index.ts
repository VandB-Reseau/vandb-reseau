// Fonction Supabase « agenda » : l'agenda de l'app au format .ics, relu par Google Agenda (sprint 25, F2, migration 0034).
// À coller dans Supabase > Edge Functions > Deploy a new function > Via Editor, sous le nom « agenda », puis dans ses
// réglages décocher « Verify JWT » : Google Agenda appelle le lien sans compte. Le lien porte un jeton secret propre à
// chaque personne (fonction mon_agenda), seul moyen de lire quelque chose.
//   GET …/functions/v1/agenda?jeton=<64 caractères>  → fichier .ics (visites de la personne, événements, réunions, formations)
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const base = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const SITE = 'https://vandb-reseau.github.io/vandb-reseau/'

interface Visite { id: number; magasin: string; date: string; type: string; prevue: boolean; heure: string | null }
interface Evenement { id: number; titre: string; type: string; debut: string; fin: string; heure: string | null; notes: string | null }

// Texte d'un champ .ics : virgules, points-virgules et retours à la ligne protégés, lignes pliées à 75 octets
const texte = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
function plier(ligne: string): string {
  const octets = new TextEncoder().encode(ligne)
  if (octets.length <= 75) return ligne
  const morceaux: string[] = []
  let courant = ''
  for (const c of ligne) {
    if (new TextEncoder().encode(courant + c).length > (morceaux.length ? 74 : 75)) { morceaux.push(courant); courant = '' }
    courant += c
  }
  morceaux.push(courant)
  return morceaux.join('\r\n ')
}
const jour = (d: string) => d.replaceAll('-', '')
const lendemain = (d: string) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10) }
const horodatage = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')

// Un rendez-vous : à l'heure (une heure, heure de Paris) ou sur la journée
function rendezVous(uid: string, titre: string, debut: string, fin: string, heure: string | null, details: string, lien: string): string[] {
  const h = heure && /^\d{2}:\d{2}/.test(heure) ? heure.slice(0, 5) : null
  const quand = h
    ? [`DTSTART;TZID=Europe/Paris:${jour(debut)}T${h.replace(':', '')}00`, `DTEND;TZID=Europe/Paris:${jour(debut)}T${String(Math.min(23, Number(h.slice(0, 2)) + 1)).padStart(2, '0')}${h.slice(3)}00`]
    : [`DTSTART;VALUE=DATE:${jour(debut)}`, `DTEND;VALUE=DATE:${jour(lendemain(fin))}`]
  return ['BEGIN:VEVENT', `UID:${uid}@vandb-reseau`, `DTSTAMP:${horodatage}`, ...quand, `SUMMARY:${texte(titre)}`,
    ...(details ? [`DESCRIPTION:${texte(details)}`] : []), `URL:${lien}`, 'END:VEVENT']
}

const libelleType: Record<string, string> = { reunion: 'Réunion', formation: 'Formation' }

Deno.serve(async (req) => {
  const jeton = new URL(req.url).searchParams.get('jeton') ?? ''
  if (!/^[0-9a-f]{40,128}$/.test(jeton)) return new Response('Lien d’agenda inconnu.', { status: 404 })
  const { data, error } = await base.rpc('agenda_du_jeton', { p_jeton: jeton })
  if (error) return new Response('Agenda indisponible pour le moment.', { status: 503 })
  if (!data) return new Response('Lien d’agenda inconnu ou remplacé.', { status: 404 })
  const a = data as { nom: string; visites: Visite[]; evenements: Evenement[] }
  const lignes = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//V and B//Reseau//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${texte('V and B Réseau')}`, 'X-WR-TIMEZONE:Europe/Paris', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
    'BEGIN:VTIMEZONE', 'TZID:Europe/Paris',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
    'END:VTIMEZONE',
  ]
  for (const v of a.visites) {
    lignes.push(...rendezVous(`visite-${v.id}`, `Visite ${v.magasin}`, v.date, v.date, v.heure, v.prevue ? 'Visite prévue' : 'Visite faite',
      `${SITE}#/magasins/${encodeURIComponent(v.magasin)}`))
  }
  for (const e of a.evenements) {
    const titre = libelleType[e.type] ? `${libelleType[e.type]} : ${e.titre}` : e.titre
    lignes.push(...rendezVous(`evenement-${e.id}`, titre, e.debut, e.fin, e.heure, e.notes ?? '', `${SITE}#/plus/agenda?mois=${e.debut.slice(0, 7)}`))
  }
  lignes.push('END:VCALENDAR')
  return new Response(lignes.map(plier).join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=900', 'Content-Disposition': 'inline; filename="vandb-reseau.ics"' },
  })
})
