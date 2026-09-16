import { DEFAULT_LOCALE, readStoredLocale, storeLocale } from './i18n.js'

const EVENT = 'arcade:locale'

export function currentLocale() {
  return readStoredLocale()
}

export function setAppLocale(locale) {
  const normalized = storeLocale(locale)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: normalized }))
  return normalized
}

export function subscribeLocale(listener) {
  if (typeof listener !== 'function') return () => {}
  const initial = currentLocale() || DEFAULT_LOCALE
  listener(initial)
  if (typeof window === 'undefined') return () => {}
  const handler = (event) => listener(event.detail || DEFAULT_LOCALE)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
