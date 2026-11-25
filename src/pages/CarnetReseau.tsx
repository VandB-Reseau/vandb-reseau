// Carnet du réseau (Joseph, 25/11/2026, idée de la maquette B « Fil de l'équipe ») : toutes les notes des carnets des
// magasins du périmètre, sur une page. Le Directeur et la Direction lisent tout le réseau (ou la vue choisie dans le menu),
// un Responsable Régional son secteur, un Coach ses magasins (la base ne renvoie d'ailleurs que les notes de son
// périmètre). En tête, ce qui reste à traiter, avec « Je m'en occupe » ; en dessous, le fil, de la plus récente à la plus
// ancienne. Répondre, clore, prendre en charge : sur place, sans ouvrir la fiche. Jamais lu par le franchisé.
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { CarteNote, useCouleurTon } from '../components/Carnet'
import { VuesRapides } from '../components/VuesRapides'
import { LigneVide, styleBloc } from '../components/Section'
import { useMessageAnnulable } from '../components/Annulable'
import { useAuth } from '../auth/AuthContext'
import { useReseau } from '../data/ReseauContext'
import { monNomPorteur } from '../data/actions'
import { aTraiterCarnet, collegues, dernierEchange, extrait, libelleTon, meConcerne, ouverte, tonDe, type NoteLue } from '../data/carnet'
import type { Reseau } from '../data/modele'
import { dateCourte } from '../lib/format'

const PAGE = 30
type Filtre = 'tout' | 'ouvertes' | 'moi'
export function CarnetReseau() {
  return <AvecReseau>{(reseau) => <Contenu reseau={reseau} />}</AvecReseau>
}

function Contenu({ reseau }: { reseau: Reseau }) {
  const { profil } = useAuth()
  const { recharger } = useReseau()
  const { signaler, bandeau } = useMessageAnnulable()
  const couleur = useCouleurTon()
  const moi = monNomPorteur(reseau, profil) || profil?.nom || ''
  const [filtre, setFiltre] = useState<Filtre>('tout')
  const [nombre, setNombre] = useState(PAGE)
  const [occupe, setOccupe] = useState(false)

  const toutes = useMemo<NoteLue[]>(() => reseau.magasins.flatMap((m) => (reseau.notesMagasins[m.nom] ?? []).map((note) => ({ magasin: m.nom, note })))
    .sort((a, b) => dernierEchange(b.note).localeCompare(dernierEchange(a.note))), [reseau.magasins, reseau.notesMagasins])
  const aTraiter = aTraiterCarnet(toutes)
  const libres = aTraiter.filter((x) => !x.note.prise).length
  const visibles = toutes.filter((x) => filtre === 'tout' || (filtre === 'ouvertes' && ouverte(x.note)) || (filtre === 'moi' && meConcerne(x.note, moi)))
  const magasinsNotes = new Set(toutes.map((x) => x.magasin)).size

  const agir = async (f: () => Promise<unknown>, ok: string, annuler?: () => void) => {
    setOccupe(true)
    try { await f(); await recharger(); signaler(ok, annuler); return true }
    catch { signaler('La note n’est pas enregistrée. Vérifie ta connexion, puis réessaie.'); return false }
    finally { setOccupe(false) }
  }
  const voir = (id: string) => {
    if (!visibles.some((x) => x.note.id === id)) setFiltre('tout')
    const i = toutes.findIndex((x) => x.note.id === id)
    if (i >= nombre) setNombre(i + 1)
    window.setTimeout(() => document.getElementById(`note-${id}`)?.scrollIntoView({ block: 'center' }), 100)
  }

  return (
    <Box>
      <PageHeader titre="Carnet" sousTitre={`${toutes.length} note${toutes.length > 1 ? 's' : ''} sur ${magasinsNotes} magasin${magasinsNotes > 1 ? 's' : ''}`} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 360px' }, alignItems: 'start' }}>
        <Card component="section" aria-label="À traiter" sx={{ ...styleBloc, display: 'grid', gap: 0.5, order: { lg: 2 }, position: { lg: 'sticky' }, top: { lg: 16 } }}>
          <Typography component="h2" sx={{ fontSize: '1rem', fontWeight: 700 }}>
            À traiter{aTraiter.length > 0 && <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>{` · ${aTraiter.length}${libres ? `, dont ${libres} sans personne` : ''}`}</Box>}
          </Typography>
          {aTraiter.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Aucune alerte ni point à surveiller en cours sur le périmètre.</Typography>
          ) : (
            <Box component="ul" aria-label="Notes à traiter" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
              {aTraiter.map(({ magasin, note }) => {
                const t = tonDe(note)
                return (
                  <Box component="li" key={note.id}>
                    <ButtonBase onClick={() => voir(note.id)} aria-label={`${magasin} : ${libelleTon(t)}, ${extrait(note.texte, 60)}`}
                      sx={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', minHeight: 48, borderRadius: 2, px: 1, py: 0.75, borderLeft: 4, borderLeftColor: couleur(t).bord, bgcolor: 'background.default', display: 'grid', gap: 0.25 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{magasin}</Typography>
                        <Chip size="small" label={libelleTon(t)} sx={{ ...couleur(t).puce, fontSize: '0.75rem', height: 22 }} />
                      </Box>
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{extrait(note.texte, 90)}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {[note.par, dateCourte(note.date), note.prise ? (note.prise.par === moi ? 'tu t’en occupes' : `${note.prise.par} s’en occupe`) : 'personne ne s’en occupe'].filter(Boolean).join(' · ')}
                      </Typography>
                    </ButtonBase>
                  </Box>
                )
              })}
            </Box>
          )}
        </Card>

        <Box sx={{ minWidth: 0, order: { lg: 1 } }}>
          <VuesRapides filtre label="Filtrer le carnet" valeur={filtre} onChange={(v) => { setFiltre(v); setNombre(PAGE) }} options={[
            { v: 'tout', libelle: 'Tout', nombre: toutes.length },
            { v: 'ouvertes', libelle: 'À clore', nombre: aTraiter.length },
            { v: 'moi', libelle: 'Me concernent', nombre: toutes.filter((x) => meConcerne(x.note, moi)).length },
          ]} />
          {visibles.length === 0 ? (
            <LigneVide>{filtre === 'ouvertes' ? 'Aucune alerte ni point à surveiller en cours.' : filtre === 'moi' ? 'Aucune note écrite par toi, ni où l’on te nomme.' : 'Aucune note dans les carnets des magasins. Une note s’écrit depuis l’onglet Carnet de la fiche d’un magasin.'}</LigneVide>
          ) : (
            <Box component="ol" aria-label="Notes des magasins" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.25 }}>
              {visibles.slice(0, nombre).map(({ magasin, note }) => (
                <Box component="li" key={`${magasin}|${note.id}`}>
                  <CarteNote reseau={reseau} magasin={magasin} note={note} moi={moi} autres={collegues(reseau, magasin, moi)} occupe={occupe} agir={agir} mise={false} avecMagasin />
                </Box>
              ))}
            </Box>
          )}
          {visibles.length > nombre && (
            <Button onClick={() => setNombre((n) => n + PAGE)} sx={{ mt: 1.5, minHeight: 48 }}>{`Afficher ${Math.min(PAGE, visibles.length - nombre)} notes de plus`}</Button>
          )}
        </Box>
      </Box>
      {bandeau}
    </Box>
  )
}
