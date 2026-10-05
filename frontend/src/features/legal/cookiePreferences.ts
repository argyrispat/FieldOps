/**
 * Cookie / storage preference helpers for FieldOps.
 *
 * The app does not set analytics or advertising cookies today.
 * Authentication uses JWT access/refresh tokens in localStorage (necessary).
 * This module records the user's acknowledgment so the consent banner can stay dismissed.
 */

export const CONSENT_STORAGE_KEY = 'fieldops_cookie_consent'

export type CookiePreferences = {
  /** User has seen and acknowledged the notice. */
  acknowledged: boolean
  /** Optional analytics — not implemented; kept for a future extension point. */
  analytics: boolean
  /** Optional marketing — not implemented; kept for a future extension point. */
  marketing: boolean
  updatedAt: string
}

export const DEFAULT_PREFERENCES: CookiePreferences = {
  acknowledged: false,
  analytics: false,
  marketing: false,
  updatedAt: '',
}

export function loadCookiePreferences(): CookiePreferences {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFERENCES }
    const parsed = JSON.parse(raw) as Partial<CookiePreferences>
    return {
      acknowledged: Boolean(parsed.acknowledged),
      // Optional categories stay off until a real implementation exists.
      analytics: false,
      marketing: false,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function saveCookiePreferences(partial: Partial<CookiePreferences>): CookiePreferences {
  const next: CookiePreferences = {
    ...loadCookiePreferences(),
    ...partial,
    // Never persist optional categories as enabled until they are implemented.
    analytics: false,
    marketing: false,
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('fieldops:cookie-preferences', { detail: next }))
  return next
}

export function acknowledgeNecessaryOnly(): CookiePreferences {
  return saveCookiePreferences({ acknowledged: true })
}
