import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from './ThemeProvider'

interface ThemeToggleProps {
  className?: string
  /** Compact icon-only control for dense headers. */
  size?: 'sm' | 'md'
}

export function ThemeToggle({ className, size = 'md' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'inline-flex items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground',
        size === 'sm' ? 'size-8' : 'size-9',
        className,
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? (
        <Sun className={size === 'sm' ? 'size-4' : 'size-[18px]'} aria-hidden />
      ) : (
        <Moon className={size === 'sm' ? 'size-4' : 'size-[18px]'} aria-hidden />
      )}
    </button>
  )
}
