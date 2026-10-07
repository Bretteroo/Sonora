// The household account an item's sn= stands for, as the backend reads it
// (_item_account in backend/main.py): usually the number itself, but a
// Spotify Connect session's track carries a serial that is none of the
// household's accounts, and the apps then use the controller's default
// account for the service -- here the reader's choice on the service row's
// caret, else the first account Sonora holds a login for, else the first.
// `services` is the household's in-use list, one entry per account.
export function itemAccount(raw, services, sid) {
  const same = (services || []).filter((svc) => svc.id === sid)
  const ids = same.map((svc) => String(svc.account_id ?? ''))
  if (!raw || !ids.length || ids.includes(raw)) return raw
  let choice = {}
  try { choice = JSON.parse(localStorage.getItem('sonora.serviceAccounts') || '{}') || {} } catch { /* none */ }
  const chosen = Object.entries(choice).find(([key, value]) => key.endsWith(`:${sid}`) && ids.includes(String(value)))
  if (chosen) return String(chosen[1])
  const held = same.find((svc) => svc.sonora_token || svc.sonora_linked)
  return held ? String(held.account_id ?? '') : ids[0]
}
