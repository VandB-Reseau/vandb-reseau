// Réseau fictif pour les tests (aucune donnée réelle : dépôt public)
const villes = ['Lyon', 'Annecy', 'Nantes', 'Rennes', 'Bordeaux', 'Toulouse', 'Lille', 'Metz', 'Nice', 'Dijon', 'Tours', 'Brest', 'Pau', 'Reims', 'Caen', 'Nîmes', 'Angers', 'Vannes', 'Gap', 'Albi', 'Sète', 'Agen', 'Laval', 'Niort', 'Blois', 'Arles', 'Auch', 'Dax', 'Rodez', 'Vichy']
const depts = ['69', '74', '44', '35', '33', '31', '59', '57', '06', '21', '37', '29', '64', '51', '14', '30', '49', '56', '05', '81', '34', '47', '53', '79', '41', '13', '32', '40', '12', '03']
export const COACHS = ['Camille TESTARD', 'Hugo FICTIF', 'Inès EXEMPLE', 'Noé MODELE']

export const magasinsFictifs = villes.map((v, i) => ({
  n: `${v} Test`,
  dept: depts[i],
  open: i < 24 ? `20${18 + (i % 7)}-0${1 + (i % 9)}-15` : i < 27 ? '2026-08-20' : i < 29 ? '2026-11-20' : '2027-01-01',
  code: `T${100 + i}`,
  tel: `+33 4 00 00 0${i % 10} 0${i % 10}`,
  email_mag: `magasin${i}@exemple.test`,
  resp: i % 5 === 0 ? 'En cours de recrutement' : `Responsable ${i}`,
  tel_resp: '+33 6 00 00 00 00',
  adj: i % 3 === 0 ? `Adjoint ${i}` : '',
  addr: `${i + 1} rue de l’Exemple, ${depts[i]}000 ${v}`,
  cp: `${depts[i]}000`,
  ville: v,
  franchise: i % 6 !== 0,
  lat: 43 + (i % 7) * 0.8,
  lon: -1 + (i % 9) * 0.9,
  rr: '',
}))

export const affectationsFictives = magasinsFictifs
  .map((m, i) => (i === 29 ? null : { store: m.n, cs: COACHS[i % 4], date: '2018-01-01', note: 'Affectation initiale', type: 'pre' }))
  .filter(Boolean)
  .concat([{ store: 'Lyon Test', cs: 'Noé MODELE', date: '2025-06-01', note: 'Réaffectation', type: 'manual' }])

export const configRRFictive = {
  directeur: { name: 'Dominique DIRECTION', titre: 'Directeur de réseau' },
  drs: [
    { id: 'rr1', name: 'Alex NORD', color: '#1b6fce', tel: '+33 6 11 11 11 11', email: 'alex@exemple.test' },
    { id: 'rr2', name: 'Sam SUD', color: '#ef7d00' },
    { id: 'rr3', name: 'Léa INTEGRES', color: '#7c3aed', role: 'integres' },
  ],
  dr_assigns: [
    { cs: 'Camille TESTARD', dr: 'rr1', date: '2018-01-01' },
    { cs: 'Hugo FICTIF', dr: 'rr1', date: '2018-01-01' },
    { cs: 'Inès EXEMPLE', dr: 'rr2', date: '2018-01-01' },
    { cs: 'Noé MODELE', dr: 'rr2', date: '2018-01-01' },
    { cs: 'Poste NORD', dr: 'rr1', date: '2026-01-01' },
  ],
}

export const coachsFictifs = [
  { cs_name: 'Camille TESTARD', tel: '+33 6 22 22 22 22', email: 'camille@exemple.test', tech: false, lat: 45.7, lon: 4.8 },
  { cs_name: 'Hugo FICTIF', lat: 47.2, lon: -1.5 },
  { cs_name: 'Inès EXEMPLE', lat: 44.8, lon: -0.6 },
  { cs_name: 'Noé MODELE', lat: 43.6, lon: 1.4 },
  { cs_name: 'Poste NORD', fictif: true, ville: 'Lille' },
  { cs_name: 'Tom TECHNICIEN', tech: true },
]

export const recruesFictives = [{ id: 1, name: 'Zoé ARRIVEE', start: '2099-03-01', ville: 'Dijon', lat: 47.3, lon: 5.0 }]

export const visitesFictives = [
  { id: 1, store: 'Lyon Test', visit_date: '2026-10-02', type: 'terrain', visitor: 'Noé MODELE', signed_required: true, signed_url: '', docs: [{ label: 'Photos', url: 'https://exemple.test/photos' }], notes: 'Vitrine refaite, stock à revoir.' },
  { id: 2, store: 'Nantes Test', visit_date: '2026-03-10', type: 'hygiene', visitor: 'Inès EXEMPLE', signed_required: false, docs: [], notes: 'Audit conforme.' },
]
export const congesFictifs = [{ id: 1, person: 'Hugo FICTIF', role: 'cs', start_date: '2026-10-20', end_date: '2026-10-24', notes: 'Congés' }]
export const evenementsFictifs = [{ id: 1, title: 'Séminaire des Coachs', type: 'event', start_date: '2026-10-15', end_date: '2026-10-16', color: '#7c3aed' }]
