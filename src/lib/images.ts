// Turns whatever the shop owner typed (a file name, a web link, or nothing) into a list of
// image addresses to try in order. The last one is always the built-in placeholder.
const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif']
const GUESS_EXTENSIONS = ['jpg', 'png', 'webp'] // when no file name is typed, only the three common types are tried (fewer failed requests)

export const PLACEHOLDER = `${BASE}images/site/placeholder.svg`
export const slugify = (text: string) =>
  text.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const isWebLink = (v: string) => /^(https?:)?\/\//i.test(v) || v.startsWith('data:')
const hasExtension = (v: string) => /\.(jpe?g|png|webp|avif|gif|svg)$/i.test(v)

/**
 * folder: 'site' | 'categories' | 'products/<category-id>'
 * value:  what is written in the sheet/settings (file name, web link or blank)
 * guess:  file name (without extension) to look for when the cell is blank or the file is missing
 */
export function imageSources(folder: string, value: string | undefined, guess: string): string[] {
  const out: string[] = []
  const v = (value ?? '').trim()
  const dir = `${BASE}images/${folder}/`
  if (v && isWebLink(v)) out.push(v)
  else if (v && hasExtension(v)) out.push(v.includes('/') ? `${BASE}images/${v.replace(/^\/+/, '')}` : dir + v)
  else if (v) EXTENSIONS.forEach(e => out.push(`${dir}${v}.${e}`))
  if (guess) GUESS_EXTENSIONS.forEach(e => out.push(`${dir}${guess}.${e}`))
  out.push(PLACEHOLDER)
  return [...new Set(out)]
}
