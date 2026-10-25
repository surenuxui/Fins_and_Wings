export type Option = { label: string; price: number; originalPrice?: number }
const num = (v: string | undefined) => { const n = parseFloat((v ?? '').replace(/[₹,\s]|rs\.?/gi, '')); return Number.isFinite(n) ? n : NaN }

/**
 * Reads the "options" cell of products.csv:  "100g=149; 200g=270|299; 500g"
 *   label=price        → that size costs that price
 *   label=price|old    → with a strike-through old price
 *   label              → uses the product's own price column
 * Returns [] if a price cannot be worked out for some option.
 */
export function parseOptions(text: string, basePrice: number, baseOriginal: number): Option[] {
  const items = (text ?? '').split(/[;\n]/).map(x => x.trim()).filter(Boolean)
  if (!items.length) return Number.isFinite(basePrice) ? [{ label: '', price: basePrice, originalPrice: baseOriginal > basePrice ? baseOriginal : undefined }] : []
  const out: Option[] = []
  for (const item of items) {
    const eq = item.indexOf('=')
    const label = (eq < 0 ? item : item.slice(0, eq)).trim()
    const [p, o] = eq < 0 ? ['', ''] : item.slice(eq + 1).split('|')
    const price = Number.isFinite(num(p)) ? num(p) : basePrice
    if (!Number.isFinite(price) || !label) return []
    const original = Number.isFinite(num(o)) ? num(o) : eq < 0 ? baseOriginal : NaN
    out.push({ label, price, originalPrice: original > price ? original : undefined })
  }
  return out
}
