import Box from '@mui/material/Box'

// Wordmark V and B (le logo officiel sera intégré en fichier local, sans dépendre d'un site externe)
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <Box
      role="img"
      aria-label="V and B"
      sx={{
        display: 'inline-flex', alignItems: 'baseline', gap: '0.2em',
        bgcolor: '#ffffff', color: '#1b1b1f', borderRadius: 1.5, px: 1.25, py: 0.25,
        fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: size, lineHeight: 1.3,
        border: '1px solid', borderColor: 'divider',
      }}
    >
      V<Box component="span" sx={{ fontStyle: 'italic', fontWeight: 400, fontSize: '0.5em' }}>and</Box>B
    </Box>
  )
}
