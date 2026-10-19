import type { ReactNode } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import TrendingDown from '@mui/icons-material/TrendingDown'
import SwapVert from '@mui/icons-material/SwapVert'
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import PersonSearchOutlined from '@mui/icons-material/PersonSearchOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { PastilleCase, PastilleTendance } from '../components/Sante'
import { PastilleAlerte, PastilleAppel } from '../components/Chiffres'
import { analyser, suiviAlerte } from '../data/chiffres'
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined'
import { useAuth } from '../auth/AuthContext'
import { useReseau } from '../data/ReseauContext'
import { caseDe, tendance } from '../data/sante'
import { anneeDe, suiviRythme } from '../data/visites'
import { chargeA, coachA, niveauCharge } from '../data/charge'
import { dateCourte, lienCoach, lienFiche } from '../lib/format'
import { ajouterJours, elementsDuMois, jourLong } from './Agenda'
import { libelleResponsable, type Reseau } from '../data/modele'
import ListSubheader from '@mui/material/ListSubheader'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import HandshakeOutlined from '@mui/icons-material/HandshakeOutlined'
import { roleLibelle } from '../auth/roles'
import { cleVue, libelleVue, lireVue, magasinsDu, perimetreDuProfil, personnesDu, type Perimetre } from '../data/perimetre'
import { actionsEnCours, echeanceDate, enRetard } from '../data/actions'
import { libellesEtatMandat, mandatsARenouveler } from '../data/associes'
import { bilan, magasinsConcernes, phase } from '../data/campagnes'

// Ordre de priorité fixé par Joseph le 14/10/2026
const PRIORITAIRES = ['redressement', 'relance', 'renforcer']
const MAX = 6

function Bloc({ titre, icone, vide, lien, libelleLien, total, children, large }: { titre: string; icone: ReactNode; vide: string; lien: string; libelleLien: string; total: number; children: ReactNode; large?: boolean }) {
  return (
    <Card sx={{ gridColumn: { md: large ? 'span 2' : 'auto' } }} component="section" aria-label={titre}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'inline-flex', p: 1, borderRadius: 3, bgcolor: 'action.hover' }}>{icone}</Box>
          <Typography variant="h4" component="h2" sx={{ flex: 1 }}>{titre}</Typography>
          {total > 0 && <Typography variant="h4" component="span" color="text.secondary">{total}</Typography>}
        </Box>
        {total === 0 ? <Typography variant="body2" color="text.secondary">{vide}</Typography> : <Box sx={{ display: 'flex', flexDirection: 'column' }}>{children}</Box>}
        {total > MAX && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>et {total - MAX} de plus</Typography>}
        <Button component={RouterLink} to={lien} sx={{ mt: 1.5, minHeight: 48, ml: -1 }}>{libelleLien}</Button>
      </CardContent>
    </Card>
  )
}

function Ligne({ lien, titre, detail, fin }: { lien?: string; titre: string; detail?: string; fin?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 48, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap', py: 0.5 }}>
      <Box sx={{ flex: 1, minWidth: 160 }}>
        {lien ? <Link component={RouterLink} to={lien} sx={{ fontWeight: 600 }}>{titre}</Link> : <Typography sx={{ fontWeight: 600 }}>{titre}</Typography>}
        {detail && <Typography variant="body2" color="text.secondary">{detail}</Typography>}
      </Box>
      {fin}
    </Box>
  )
}

function Tableau({ reseau, p }: { reseau: Reseau; p: Perimetre }) {
  const j = reseau.jour
  const perimetre = magasinsDu(reseau, p)
  const noms = new Set(perimetre.map((m) => m.nom))
  const personnes = personnesDu(reseau, p)
  const actifs = perimetre.filter((m) => m.statut !== 'avenir')
  const sousPerf = actifs.map((m) => ({ m, c: caseDe(reseau.evaluations[m.nom]) }))
    .filter((x) => x.c && PRIORITAIRES.includes(x.c.id))
    .sort((a, b) => PRIORITAIRES.indexOf(a.c!.id) - PRIORITAIRES.indexOf(b.c!.id))
  // Démarche coach : les magasins qui décrochent d'abord (appel en retard en tête), puis ceux à surveiller
  const alertes = actifs.map((m) => { const an = analyser(reseau, m.nom); return { m, an, suivi: suiviAlerte(reseau, m.nom, an) } })
    .filter((x) => x.an?.statut === 'decroche' || x.an?.statut === 'surveiller')
    .sort((x, y) => (x.an!.statut === y.an!.statut ? 0 : x.an!.statut === 'decroche' ? -1 : 1) || (y.suivi?.retard ?? 0) - (x.suivi?.retard ?? 0) || (x.an!.ecart ?? 0) - (y.an!.ecart ?? 0))
  const avecChiffres = Object.keys(reseau.chiffres).length > 0
  const nonEvalues = actifs.filter((m) => !caseDe(reseau.evaluations[m.nom])).length
  const a = anneeDe(j)
  const aVisiter = suiviRythme(reseau, a).filter((l) => l.retard > 0 && noms.has(l.magasin.nom))
    .sort((x, y) => y.retard - x.retard || (x.derniere?.date ?? '').localeCompare(y.derniere?.date ?? ''))
  // Actions des plans de visite en retard ou à échéance dans les quinze jours
  const dans15j = ajouterJours(j, 15)
  const actionsProches = actionsEnCours(reseau, noms).filter((x) => echeanceDate(x.a) && echeanceDate(x.a) <= dans15j)
  const mandats = p.type === 'coach' ? [] : mandatsARenouveler(reseau, perimetre)
  // Magasins qui ont changé de case ces trois derniers mois, ceux qui reculent d'abord
  const il3mois = ajouterJours(j, -92)
  const changements = actifs.map((m) => ({ m, t: tendance(reseau.evaluations, m.nom) }))
    .filter((x) => x.t?.precedente && x.t.depuis >= il3mois)
    .sort((x, y) => ['descend', 'stable', 'monte'].indexOf(x.t!.sens) - ['descend', 'stable', 'monte'].indexOf(y.t!.sens) || y.t!.depuis.localeCompare(x.t!.depuis))
  const campagnes = reseau.campagnes.liste.filter((c) => phase(c, j) === 'encours')
    .map((c) => ({ c, b: bilan(reseau.campagnes, c, magasinsConcernes(reseau, c).filter((m) => noms.has(m.nom))) })).filter((x) => x.b.total > 0)
  const finSemaine = ajouterJours(j, 6)
  const semaine = elementsDuMois(reseau, j, finSemaine).filter((e) => {
    if (p.type === 'reseau') return true
    if (e.categorie === 'ouverture') return noms.has(e.cle.slice(2))
    if (e.categorie === 'conge') return !!e.conge && personnes!.has(e.conge.personne)
    if (e.categorie === 'anniversaire') return [...personnes!].some((n) => e.cle.startsWith(`a-${n}-`))
    return true
  })
  const coachsVus = reseau.equipe.filter((c) => p.type === 'reseau' || (p.type === 'rr' && c.rr?.id === p.id))
  const surcharges = p.type === 'coach' ? [] : coachsVus.filter((c) => !c.fictif).map((c) => ({ c, charge: chargeA(reseau, c.nom) }))
    .filter((x) => ['depassement', 'complet'].includes(niveauCharge(reseau, x.charge))).sort((a, b) => b.charge - a.charge)
  const vacants = p.type === 'coach' ? [] : [
    ...coachsVus.filter((c) => c.fictif).map((c) => ({ titre: c.nom, detail: 'Poste de Coach à pourvoir', lien: lienCoach(c.nom) })),
    ...actifs.filter((m) => !coachA(m, j)).map((m) => ({ titre: m.nom, detail: 'Magasin sans Coach', lien: lienFiche(m.nom) })),
  ]
  const dans6mois = ajouterJours(j, 183)
  const ouvertures = perimetre.filter((m) => m.ouverture > j && m.ouverture <= dans6mois).sort((a, b) => a.ouverture.localeCompare(b.ouverture))
  const manque = (m: (typeof ouvertures)[number]) => [!coachA(m, j) && 'Coach', !m.responsable && libelleResponsable(m), !m.ouvertureConnue && 'date confirmée'].filter(Boolean) as string[]
  const avecCoach = p.type !== 'coach'

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
      <Bloc large titre="Magasins qui décrochent" icone={<QueryStatsOutlined />} total={alertes.length} lien="/plus/sante?vue=chiffres" libelleLien="Voir les chiffres"
        vide={avecChiffres ? 'Aucun magasin ne décroche ni n’est à surveiller sur ses derniers chiffres.' : 'Aucun chiffre mensuel enregistré pour l’instant.'}>
        {alertes.slice(0, MAX).map(({ m, an, suivi }) => <Ligne key={m.nom} lien={lienFiche(m.nom)} titre={m.nom} detail={[avecCoach && `Coach ${coachA(m, j) || 'à désigner'}`, an!.raisons.join(' · ')].filter(Boolean).join(' · ')} fin={<Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}><PastilleAlerte statut={an!.statut} /><PastilleAppel s={suivi} /></Box>} />)}
      </Bloc>
      <Bloc large titre="Magasins qui sous-performent" icone={<TrendingDown />} total={sousPerf.length} lien="/plus/sante" libelleLien="Voir la nine box"
        vide={nonEvalues ? `Aucun magasin en redressement, relance ou management à renforcer. ${nonEvalues} magasin${nonEvalues > 1 ? 's restent' : ' reste'} à évaluer dans la santé du parc.` : 'Aucun magasin en redressement, relance ou management à renforcer.'}>
        {sousPerf.slice(0, MAX).map(({ m, c }) => <Ligne key={m.nom} lien={lienFiche(m.nom)} titre={m.nom} detail={[avecCoach && `Coach ${coachA(m, j) || 'à désigner'}`, `rythme conseillé ${c!.rythme}`].filter(Boolean).join(' · ')} fin={<PastilleCase c={c} />} />)}
      </Bloc>
      <Bloc titre="Visites en retard" icone={<EventBusyOutlined />} total={aVisiter.length} lien="/visites" libelleLien="Voir le rythme de visite" vide={`Tous les magasins sont à jour de leurs visites sur ${a.court}.`}>
        {aVisiter.slice(0, MAX).map((l) => <Ligne key={l.magasin.nom} lien={lienFiche(l.magasin.nom)} titre={l.magasin.nom} detail={[avecCoach && (l.coach ? `Coach ${l.coach}` : 'Sans Coach'), l.derniere ? `dernière visite le ${dateCourte(l.derniere.date)}` : 'jamais visité', `une visite tous les ${l.intervalle} jours`].filter(Boolean).join(' · ')} fin={<Chip size="small" color="warning" label={`${l.retard} j de retard`} sx={{ fontSize: 12, fontWeight: 600 }} />} />)}
      </Bloc>
      <Bloc titre="Actions à échéance" icone={<TaskAltOutlined />} total={actionsProches.length} lien={p.type === 'coach' ? `${lienCoach(p.nom)}?vue=actions` : '/visites?vue=historique'} libelleLien={p.type === 'coach' ? 'Voir toutes ses actions' : 'Voir les visites'} vide="Aucune action en retard ni à échéance dans les quinze jours.">
        {actionsProches.slice(0, MAX).map((x) => <Ligne key={x.cle} lien={`${lienFiche(x.visite.magasin)}?vue=actions`} titre={x.a.action} detail={[x.visite.magasin, x.a.porteur].filter(Boolean).join(' · ')}
          fin={<Chip size="small" color={enRetard(x.a, j) ? 'error' : 'default'} variant={enRetard(x.a, j) ? 'filled' : 'outlined'} label={enRetard(x.a, j) ? `En retard · ${dateCourte(x.a.echeance)}` : dateCourte(x.a.echeance)} sx={{ fontSize: 12, fontWeight: 600 }} />} />)}
      </Bloc>
      <Bloc titre="Campagnes en cours" icone={<CampaignOutlined />} total={campagnes.length} lien="/visites?vue=campagnes" libelleLien="Voir les campagnes" vide="Aucune campagne en cours.">
        {campagnes.slice(0, MAX).map(({ c, b }) => <Ligne key={c.id} lien={`/visites?vue=campagnes&campagne=${encodeURIComponent(c.id)}`} titre={c.nom} detail={`${b.fait} sur ${b.total} magasin${b.total > 1 ? 's' : ''} exécuté${b.fait > 1 ? 's' : ''} · ${b.aConstater} à constater`} fin={<Typography sx={{ fontWeight: 600 }}>{b.taux === null ? '—' : `${b.taux} %`}</Typography>} />)}
      </Bloc>
      {p.type !== 'coach' && (
        <Bloc titre="Mandats à renouveler" icone={<HandshakeOutlined />} total={mandats.length} lien="/parametres/franchises" libelleLien="Voir les franchisés" vide="Aucun mandat de franchisé ne finit dans l’année.">
          {mandats.slice(0, MAX).map((x) => <Ligne key={`${x.m.nom}-${x.a.id}`} lien={lienFiche(x.m.nom)} titre={`${x.a.nom} · ${x.m.nom}`} detail={`Fin du mandat le ${dateCourte(x.mandat.fin)}`}
            fin={<Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}><PastilleCase c={caseDe(reseau.evaluations[x.m.nom])} /><Chip size="small" color={x.etat === 'echu' ? 'error' : 'warning'} label={libellesEtatMandat[x.etat]} sx={{ fontSize: 12, fontWeight: 600 }} /></Box>} />)}
        </Bloc>
      )}
      <Bloc titre="Changements de case" icone={<SwapVert />} total={changements.length} lien="/plus/sante" libelleLien="Voir la nine box" vide="Aucun magasin n’a changé de case ces trois derniers mois.">
        {changements.slice(0, MAX).map(({ m, t }) => <Ligne key={m.nom} lien={lienFiche(m.nom)} titre={m.nom} detail={`${dateCourte(t!.depuis)} · ${t!.precedente!.libelle} vers ${t!.actuelle.libelle}`} fin={<PastilleTendance t={t} court />} />)}
      </Bloc>
      <Bloc titre="Agenda de la semaine" icone={<CalendarMonthOutlined />} total={semaine.length} lien="/plus/agenda" libelleLien="Ouvrir l’agenda" vide="Rien de prévu dans les sept prochains jours.">
        {semaine.slice(0, MAX).map((e) => <Ligne key={e.cle} lien={e.lien} titre={e.titre} detail={[jourLong(e.debut < j ? j : e.debut), e.detail].filter(Boolean).join(' · ')} />)}
      </Bloc>
      {p.type !== 'coach' && (
        <Bloc titre="Coachs surchargés et postes vacants" icone={<PersonSearchOutlined />} total={surcharges.length + vacants.length} lien="/equipe?vue=charge" libelleLien="Voir la charge" vide="Aucun Coach au maximum et aucun poste vacant.">
          {[...surcharges.map((x) => ({ titre: x.c.nom, detail: `Charge ${x.charge} sur ${reseau.parametres.maxUnits}`, lien: lienCoach(x.c.nom) })), ...vacants].slice(0, MAX).map((x) => <Ligne key={x.titre + x.detail} {...x} />)}
        </Bloc>
      )}
      <Bloc titre="Ouvertures à préparer" icone={<StorefrontOutlined />} total={ouvertures.length} lien="/magasins" libelleLien="Voir les magasins" vide="Aucune ouverture prévue dans les six prochains mois.">
        {ouvertures.slice(0, MAX).map((m) => { const k = manque(m); return <Ligne key={m.nom} lien={lienFiche(m.nom)} titre={m.nom} detail={`${dateCourte(m.ouverture)} · ${k.length ? `manque : ${k.join(', ')}` : 'tout est prêt'}`} /> })}
      </Bloc>
    </Box>
  )
}

function salutation(): string {
  return new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir'
}

// Le Directeur choisit sa vue (réseau, un Responsable Régional, un Coach) ; un Coach ou un RR voit ses magasins
function ChoixVue({ reseau, valeur, onChange }: { reseau: Reseau; valeur: Perimetre; onChange: (p: Perimetre) => void }) {
  const options = [
    { cle: 'reseau', libelle: 'Tout le réseau' },
    ...reseau.rrs.map((r) => ({ cle: `rr:${r.id}`, libelle: r.nom })),
    ...reseau.equipe.filter((c) => !c.fictif).map((c) => ({ cle: `coach:${c.nom}`, libelle: c.nom })),
  ]
  return (
    <TextField select size="small" label="Vue" value={options.some((o) => o.cle === cleVue(valeur)) ? cleVue(valeur) : 'reseau'} onChange={(e) => onChange(lireVue(e.target.value))}
      sx={{ minWidth: 240, '& .MuiInputBase-root': { minHeight: 48 } }}>
      <ListSubheader>Directeur de réseau</ListSubheader>
      <MenuItem value="reseau">Tout le réseau</MenuItem>
      {reseau.rrs.length > 0 && <ListSubheader>Responsables Régionaux</ListSubheader>}
      {options.filter((o) => o.cle.startsWith('rr:')).map((o) => <MenuItem key={o.cle} value={o.cle}>{o.libelle}</MenuItem>)}
      <ListSubheader>Coachs</ListSubheader>
      {options.filter((o) => o.cle.startsWith('coach:')).map((o) => <MenuItem key={o.cle} value={o.cle}>{o.libelle}</MenuItem>)}
    </TextField>
  )
}

export function Accueil() {
  const { profil } = useAuth()
  const { reseau } = useReseau()
  const [params, setParams] = useSearchParams()
  const impose = perimetreDuProfil(profil)
  const choisi = impose ?? lireVue(params.get('vue'))
  const changer = (p: Perimetre) => setParams((x) => { const n = new URLSearchParams(x); if (p.type === 'reseau') n.delete('vue'); else n.set('vue', cleVue(p)); return n }, { replace: true })
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const role = impose ? roleLibelle[profil!.role] : choisi.type === 'reseau' ? roleLibelle.directeur : choisi.type === 'rr' ? roleLibelle.rr : roleLibelle.coach
  const n = reseau ? magasinsDu(reseau, choisi).length : 0
  const perimetre = !reseau ? null : choisi.type === 'reseau' ? `${n} magasins` : `${role} · ${libelleVue(reseau, choisi)} · ${n} magasin${n > 1 ? 's' : ''}`
  return (
    <>
      <PageHeader titre={`${salutation()}${profil ? ` ${profil.nom}` : ''}`} sousTitre={[date.charAt(0).toUpperCase() + date.slice(1), perimetre].filter(Boolean).join(' · ')}
        actions={impose || !reseau ? undefined : <ChoixVue reseau={reseau} valeur={choisi} onChange={changer} />} />
      <AvecReseau>{(r) => <Tableau reseau={r} p={choisi} />}</AvecReseau>
    </>
  )
}
