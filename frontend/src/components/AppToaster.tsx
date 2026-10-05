import { useTheme } from '@/features/theme/ThemeProvider'
import { Toaster as Sonner } from 'sonner'

export function AppToaster() {
  const { theme } = useTheme()
  return <Sonner position="top-right" richColors closeButton theme={theme} />
}
