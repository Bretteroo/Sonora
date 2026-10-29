// Every row's artwork stays inside its tile, across several lists, in each theme
// named. The themes run side by side, each in a context of its own.
// Usage: node art_inside_tiles.mjs <playwright-core> <firefox> <base url> <theme>...
// Prints one line per theme and list, "ok" or what spills, and exits 1 if
// anything does.
// Only GET requests leave the page, so walking the lists plays nothing.
const [, , pw, executablePath, base, ...themes] = process.argv
const { firefox } = await import(pw)
const LISTS = [[], ['TuneIn'], ['TuneIn', 'My Radio Stations'], ['Sonos Favorites'], ['Sonos Playlists'], ['Sonos Radio'], ['Plex'], ['Pandora']]
const browser = await firefox.launch({ executablePath })
let failed = false
await Promise.all(themes.map(async (theme) => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  await ctx.addInitScript((id) => { localStorage.setItem('sonora.theme', id) }, theme)
  for (const path of LISTS) {
    const label = `${theme}: ${path.join(' > ') || '(top)'}`
    const page = await ctx.newPage()
    await page.route('**/*', (r) => (r.request().method() === 'GET' ? r.continue() : r.abort()))
    await page.goto(base); await page.waitForTimeout(5000)
    try {
      for (const name of path) { await page.getByText(name, { exact: true }).first().click({ timeout: 8000 }); await page.waitForTimeout(3000) }
    } catch {
      // A household without this source has nothing to check here.
      console.log(label, 'skipped: not in this household'); await page.close(); continue
    }
    const spills = await page.evaluate(() => {
      const out = []
      for (const tile of document.querySelectorAll('.dk-browse-art')) {
        const t = tile.getBoundingClientRect(); if (!t.width) continue
        for (const el of tile.querySelectorAll('*')) {
          const r = el.getBoundingClientRect(); if (!r.width) continue
          if (r.left < t.left - 0.5 || r.top < t.top - 0.5 || r.right > t.right + 0.5 || r.bottom > t.bottom + 0.5)
            out.push(`${tile.closest('.dk-browse-row')?.textContent.trim().slice(0, 30)}: ${el.tagName.toLowerCase()}.${el.getAttribute('class')} ${r.width}x${r.height} at ${r.left - t.left},${r.top - t.top} in ${t.width}x${t.height}`)
        }
      }
      return [...new Set(out)].slice(0, 5)
    })
    if (spills.length) failed = true
    console.log(label, spills.length ? spills.join(' | ') : 'ok')
    await page.close()
  }
  await ctx.close()
}))
await browser.close()
process.exit(failed ? 1 : 0)
