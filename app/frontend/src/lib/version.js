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
