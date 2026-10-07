// The Edit menu of a desktop shell, enabled the way the apps enable theirs.
//
// In both apps the clipboard items follow whatever has the keyboard focus:
// WPF's Cut, Copy and Paste commands, and AppKit's cut:, copy:, paste:,
// delete: and selectAll:, only do anything in a text field, so outside one
// the whole group is gray. Cut, Copy and Delete want a selection in that
// field; Paste and Select All want only the field.
//
// The menu bars keep the focus where it was when a title is pressed (see
// their onMouseDown), so the field is still the active element and its
// selection still stands when an item is chosen.

const TEXT_TYPES = new Set(['', 'text', 'search', 'url', 'tel', 'email', 'password', 'number'])

// The focused text field, or null.
export function editableTarget() {
  const el = typeof document !== 'undefined' ? document.activeElement : null
  if (!el) return null
  if (el.isContentEditable) return el
  if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TEXT_TYPES.has((el.type || '').toLowerCase()))) {
    return el.disabled ? null : el
  }
  return null
}

function hasSelection(el) {
  if (!el) return false
  if (el.isContentEditable) {
    const sel = window.getSelection()
    return Boolean(sel && !sel.isCollapsed && el.contains(sel.anchorNode))
  }
  try {
    return el.selectionStart !== el.selectionEnd
  } catch {
    // A number field has no selection API; its text counts as selected when
    // there is any, which is what the platform's own menu does with it.
    return Boolean(el.value)
  }
}

const writable = (el) => Boolean(el && !el.readOnly)

// Each item's disabled state is a function, so the menu bar asks it when
// the menu opens rather than when the shell last rendered.
export const editState = {
  cut: () => { const el = editableTarget(); return !(writable(el) && hasSelection(el)) },
  copy: () => !hasSelection(editableTarget()),
  paste: () => !writable(editableTarget()),
  delete: () => { const el = editableTarget(); return !(writable(el) && hasSelection(el)) },
  selectAll: () => !editableTarget(),
}

export const editActions = {
  cut: () => document.execCommand('cut'),
  copy: () => document.execCommand('copy'),
  // A page cannot run the browser's own paste; it reads the clipboard and
  // types what it holds (Firefox asks the first time, with its Paste button).
  paste: async () => {
    const el = editableTarget()
    if (!writable(el)) return
    try {
      const text = await navigator.clipboard.readText()
      el.focus()
      document.execCommand('insertText', false, text)
    } catch {
      // Refused or unsupported: nothing is pasted, as when the clipboard is empty.
    }
  },
  delete: () => document.execCommand('delete'),
  selectAll: () => {
    const el = editableTarget()
    if (!el) return
    if (el.select) el.select()
    else document.execCommand('selectAll')
  },
}
