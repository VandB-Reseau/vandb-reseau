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
  resp: i % 5 === 0 ? 'En cours de recrutement' : i === 1 || i === 3 ? 'Paul MULTI' : `Franchisé ${i}`,
  tel_resp: '+33 6 00 00 00 00',
  adj: i % 3 === 0 ? `Adjoint ${i}` : '',
  addr: `${i + 1} rue de l’Exemple, ${depts[i]}000 ${v}`,
  cp: `${depts[i]}000`,
  ville: v,
  franchise: i % 6 !== 0,
  // Lille est à sa vraie place (sa commune est connue du service des communes simulé)
  lat: v === 'Lille' ? 50.63 : 43 + (i % 7) * 0.8,
  lon: v === 'Lille' ? 3.06 : -1 + (i % 9) * 0.9,
  rr: '',
}))

export const affectationsFictives = magasinsFictifs
  .map((m, i) => (i === 29 ? null : { store: m.n, cs: COACHS[i % 4], date: '2018-01-01', note: 'Affectation initiale', type: 'pre' }))
  .filter(Boolean)
  .concat([{ store: 'Lyon Test', cs: 'Noé MODELE', date: '2025-06-01', note: 'Réaffectation', type: 'manual' }])

export const configRRFictive = {
  directeur: { name: 'Dominique DIRECTION', titre: 'Directeur de réseau' },
  drs: [
    { id: 'rr1', name: 'Alex NORD', color: '#307672', tel: '+33 6 11 11 11 11', email: 'alex@exemple.test' },
    { id: 'rr2', name: 'Sam SUD', color: '#ea6029' },
    { id: 'rr3', name: 'Léa INTEGRES', color: '#312e2e', role: 'integres' },
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
  { id: 1, store: 'Lyon Test', visit_date: '2026-10-02', type: 'terrain', visitor: 'Noé MODELE', signed_required: true, signed_url: '', docs: [{ label: 'Photos', url: 'https://exemple.test/photos' }, { label: 'Photo', url: '', chemin: 'visites/2026-10/lyon.jpg', taille: 200000 }], notes: 'Vitrine refaite, stock à revoir.', sections: ['', '', 'Tête de gondole à reprendre.', '', '', ''], action_plan: [{ action: 'Refaire la tête de gondole Beaujolais', porteur: 'Franchisé', echeance: 'novembre' }] },
  { id: 2, store: 'Nantes Test', visit_date: '2026-03-10', type: 'hygiene', visitor: 'Inès EXEMPLE', signed_required: false, docs: [], notes: 'Audit conforme.' },
  // Un appel ne compte pas comme visite : Agen reste en retard
  { id: 3, store: 'Agen Test', visit_date: '2026-10-01', type: 'appel', visitor: 'Inès EXEMPLE', signed_required: false, docs: [], notes: 'Appel de suivi.' },
  // Plan d'action de Brest : une action en retard, une à venir, une déjà faite
  { id: 4, store: 'Brest Test', visit_date: '2026-09-20', type: 'terrain', visitor: 'Noé MODELE', signed_required: false, docs: [], notes: 'Visite de suivi.', action_plan: [
    { id: 'a1', action: 'Refaire la vitrine', porteur: 'Franchisé 11', echeance: '2026-09-30' },
    { id: 'a2', action: 'Former l’équipe à la vente additionnelle', porteur: 'Noé MODELE', echeance: '2099-01-31' },
    { id: 'a3', action: 'Changer l’enseigne', porteur: 'Franchisé 11', echeance: '2026-09-25', faite: '2026-09-24' },
  ] },
]
export const congesFictifs = [{ id: 1, person: 'Hugo FICTIF', role: 'cs', start_date: '2026-10-20', end_date: '2026-10-24', notes: 'Congés' }]
// Séminaire dans la semaine qui vient, quel que soit le jour où les tests tournent
const dansJours = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
export const evenementsFictifs = [{ id: 1, title: 'Séminaire des Coachs', type: 'event', start_date: dansJours(1), end_date: dansJours(2), color: '#7c3aed' }]

// Santé du parc : Lyon en redressement urgent, Annecy locomotive, Nantes cœur de réseau
const n = (r: number, f: number) => ({ notes: { caExterieur: r, panierCave: r, panierBar: r, fluxCave: r, fluxBar: r, franchise: f }, date: '2026-10-01', par: 'Dominique DIRECTION' })
// Lyon était en cœur de réseau avant de passer en redressement (historique daté)
export const santeFictive = {
  'Lyon Test': { ...n(1, 1), historique: [{ date: '2026-06-01', caseId: 'coeur', notes: n(2, 2).notes }, { date: '2026-10-01', caseId: 'redressement', notes: n(1, 1).notes }] },
  'Annecy Test': n(3, 3), 'Nantes Test': n(2, 2),
}
export const notesMagasinsFictives = { 'Lyon Test': [{ id: 'n1', date: '2026-09-15', texte: 'Appel du franchisé : travaux de vitrine prévus.', par: 'Dominique DIRECTION' }] }
export const deploiementsFictifs = { valeurs: { 'Lyon Test': { concept20: 'Fait', terrasse: 'Oui' }, 'Annecy Test': { concept20: 'En cours' } }, journal: { 'Lyon Test': [{ date: '2026-05-04', thematique: 'concept20', etat: 'Fait' }] } }

// Fiches personnelles (app_config, clé fiches_personnes)
export const fichesFictives = {
  'rr:rr1': { prenom: 'Alex', nom: 'NORD', naissance: '1980-04-12', arrivee: '2019-09-01', codePostal: '59000', departement: '59', ville: 'Lille', pays: 'France', email: 'alex@exemple.test', telephone: '+33 6 11 11 11 11' },
}

// Chiffres mensuels fictifs (table store_finance), d'octobre 2024 à septembre 2026
// Lyon décroche en septembre 2026 (−30 % sur le mois), Nantes recule de 7 % (à surveiller), Annecy est stable
const moisFictifs = Array.from({ length: 24 }, (_x, i) => { const t = 2024 * 12 + 9 + i; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}` })
// Panier moyen HT 40 € en cave et 12 € au bar ; 70 % du CA en cave
const ligneCA = (store: string, mois: string, ca: number) => {
  const fluxCave = (ca * 0.7) / 40, fluxBar = (ca * 0.3) / 12
  return { store_name: store, month: `${mois}-01`, ca_ext: 0, pm_cave: 40, flux_cave: fluxCave, pm_bar: 12, flux_bar: fluxBar, ca_cave: Math.round(ca * 0.7), ca_bar: Math.round(ca * 0.3), freq: fluxCave + fluxBar, panier: Math.round((ca / (fluxCave + fluxBar)) * 100) / 100, marge: 42, updated_at: '2026-10-05T08:00:00Z' }
}
export const chiffresFictifs = [
  ...moisFictifs.map((m) => ligneCA('Lyon Test', m, m === '2026-09' ? 70000 : 100000)),
  ...moisFictifs.map((m) => ligneCA('Nantes Test', m, m >= '2026-07' ? 93000 : 100000)),
  ...moisFictifs.map((m) => ligneCA('Annecy Test', m, 80000)),
]
export const auditsFictifs = { 'Nantes Test': [{ date: '2026-03-10', type: 'hygiene', conforme: true, score: 92 }] }
