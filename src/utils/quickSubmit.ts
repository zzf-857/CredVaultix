interface QuickSubmitTargetLike {
  tagName?: string
  isContentEditable?: boolean
  getAttribute?: (name: string) => string | null
  closest?: (selector: string) => unknown
}

export interface QuickSubmitEventLike {
  key: string
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  nativeEvent?: { isComposing?: boolean }
  target?: EventTarget | QuickSubmitTargetLike | null
}

export function shouldSubmitOnEnter(event: QuickSubmitEventLike) {
  if (
    event.key !== 'Enter'
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || event.shiftKey
    || event.nativeEvent?.isComposing
  ) {
    return false
  }

  const target = event.target as QuickSubmitTargetLike | null | undefined
  if (!target) return true

  const tagName = target.tagName?.toLowerCase()
  const role = target.getAttribute?.('role')?.toLowerCase()
  if (tagName === 'textarea' || target.isContentEditable) {
    return false
  }

  if (
    tagName === 'a'
    || tagName === 'button'
    || tagName === 'select'
    || role === 'button'
    || role === 'link'
    || Boolean(target.closest?.('button, [role="button"]'))
  ) {
    return false
  }

  if (tagName === 'input') {
    const inputType = target.getAttribute?.('type')?.toLowerCase() || 'text'
    if (['button', 'checkbox', 'color', 'file', 'radio', 'range', 'reset', 'submit'].includes(inputType)) {
      return false
    }
  }

  const isCombobox = role === 'combobox'
    || Boolean(target.closest?.('[role="combobox"]'))

  return !isCombobox
}
