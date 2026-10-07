// A speaker's software as one label: the release, then its build in
// parentheses, "18.8 (97.1-80312)". The S2 app's update notices name the
// build, so a release number alone could not be matched against them. Either
// half alone stands by itself (an UpdateItem carries only the build).
export function versionLabel(release, build) {
  const r = String(release || '').trim()
  const b = String(build || '').trim()
  if (r && b && r !== b) return `${r} (${b})`
  return r || b
}

// The question before a speaker update. With S1 and S2 systems both in the
// house it names the one the update is for; with one kind only it need not.
export function updateBody(t, households, householdId, version) {
  const kinds = new Set((households || []).map((h) => h.generation).filter(Boolean))
  const system = (households || []).find((h) => h.id === householdId)?.generation
  return kinds.size > 1 && system
    ? t('desk.update.bodySystem', { system, version })
    : t('desk.update.body', { version })
}
