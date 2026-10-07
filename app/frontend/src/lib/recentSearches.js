// The search box's recent queries, as the app's search menu lists them under
// "Recent Searches" with a "Clear Recent Searches" row. Per browser, since
// they are this person's typing, not household state.
const KEY = 'sonora.recentSearches'
const MAX = 10

export function readRecentSearches() {
  try {
    const raw = window.localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((item) => typeof item === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

export function addRecentSearch(query) {
  const text = (query || '').trim()
  if (!text) return readRecentSearches()
  const next = [text, ...readRecentSearches().filter((item) => item.toLowerCase() !== text.toLowerCase())].slice(0, MAX)
  try { window.localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private window */ }
  return next
}

export function clearRecentSearches() {
  try { window.localStorage.removeItem(KEY) } catch { /* private window */ }
  return []
}
