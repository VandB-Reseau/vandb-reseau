import { useState } from 'react'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import { useAuth } from '../auth/AuthContext'
import { telechargerClasseur } from '../data/referentiels'

// Export Excel de la liste affichée (L6, 21/10/2026) : exactement les lignes à l'écran, filtres compris.
// Réservé au Directeur et aux Responsables Régionaux ; aucune coordonnée personnelle dans les colonnes.
export interface ColonneExport<T> { entete: string; valeur: (x: T) => string | number | null | undefined; largeur?: number }

export function BoutonExporter<T>({ lignes, colonnes, fichier, feuille }: { lignes: T[]; colonnes: ColonneExport<T>[]; fichier: string; feuille: string }) {
  const { profil } = useAuth()
  const [message, setMessage] = useState('')
  if (!profil || !['directeur', 'rr'].includes(profil.role)) return null
  const exporter = async () => {
    try {
      await telechargerClasseur([{
        sheet: feuille.slice(0, 31),
        data: [
          colonnes.map((c) => ({ value: c.entete, fontWeight: 'bold' as const, type: String })),
          ...lignes.map((l) => colonnes.map((c) => { const v = c.valeur(l); return v === null || v === undefined || v === '' ? null : typeof v === 'number' ? { value: v, type: Number } : { value: v, type: String } })),
        ],
        columns: colonnes.map((c) => ({ width: c.largeur ?? Math.max(12, c.entete.length + 2) })),
        stickyRowsCount: 1,
      }] as unknown as Parameters<typeof telechargerClasseur>[0], `${fichier} ${new Date().toLocaleDateString('sv-SE')}.xlsx`)
    } catch { setMessage('L’export n’a pas pu être préparé. Réessaie dans un instant.') }
  }
  return (
    <>
      <Button startIcon={<FileDownloadOutlined />} onClick={exporter} disabled={!lignes.length} sx={{ minHeight: 48, flexShrink: 0 }}>Exporter</Button>
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </>
  )
}
