export const TAG_COLOR_PALETTE = ['#a8c7fa', '#81c995', '#f2b8b5', '#fdd663', '#d7aefb', '#78d9ec', '#fcb68e']

const TAG_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

export function pickTagColor(name: string) {
  const seed = Array.from(name).reduce((total, char) => total + char.charCodeAt(0), 0)
  return TAG_COLOR_PALETTE[seed % TAG_COLOR_PALETTE.length]
}

export function isTagColor(value: string) {
  return TAG_COLOR_PATTERN.test(value)
}
