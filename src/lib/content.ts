import { csvToObjects } from './csv'
import { imageSources, slugify } from './images'
import { parseOptions, type Option } from './options'
import type { DeliveryConfig } from '../delivery/config'

export type Category = { id: string; name: string; optionName: string; images: string[] }
export type { Option }
export type Product = {
  id: number; name: string; category: string; price: number; originalPrice?: number
  optionName: string; options: Option[]
  images: string[]; description: string; stock: string; badge?: string; featured: boolean; live: boolean
}
export type Settings = {
  shop: { name: string; subtitle: string; address: string; phone: string; whatsapp: string; hours: string; mapsUrl: string }
  nav: { label: string; target: string }[]
  hero: { eyebrow: string; title: string; copy: string; image: string; trust: string[] }
  usp: { eyebrow: string; title: string; copy: string; cta: string; items: { title: string; text: string }[] }
  banners: { image: string; alt: string; link: string }[]
  promotion: { eyebrow: string; title: string; copy: string; conditions: string; expiry: string; image: string }
  feature: { title: string; copy: string; image: string; cta: string }
  delivery: { terms: string }
  about: { copy: string; image: string }
  enquiry: { image: string; types: string[]; contactMethods: string[] }
  policies: { title: string; content: string }[]
  payment?: { eyebrow: string; title: string; copy: string; payeeName: string; upiId: string; qrImage: string; note: string }
}
export type Content = { categories: Category[]; products: Product[]; settings: Settings; delivery: DeliveryConfig; warnings: string[] }

const BASE = import.meta.env.BASE_URL
const yes = (v: string | undefined) => /^(y|yes|true|1|x|✓)$/i.test((v ?? '').trim())
const num = (v: string | undefined) => {
  const n = parseFloat((v ?? '').replace(/[₹,\s]|rs\.?/gi, ''))
  return Number.isFinite(n) ? n : NaN
}
const pick = (row: Record<string, string>, start: string) => row[Object.keys(row).find(k => k.startsWith(start)) ?? ''] ?? ''

async function load(file: string): Promise<string> {
  let res: Response
  try { res = await fetch(`${BASE}data/${file}`, { cache: 'no-store' }) }
  catch { throw new Error(`Could not load data/${file}. Check your internet connection.`) }
  if (!res.ok) throw new Error(`The file data/${file} is missing (or was renamed).`)
  return res.text()
}
async function loadJson<T>(file: string): Promise<T> {
  const text = await load(file)
  try { return JSON.parse(text) as T }
  catch (e) { throw new Error(`There is a typing mistake in data/${file}: ${(e as Error).message}. Usually a missing comma, quote or bracket just before that spot.`) }
}

export async function loadContent(): Promise<Content> {
  const [catText, prodText, settings, delivery] = await Promise.all([
    load('categories.csv'), load('products.csv'),
    loadJson<Settings>('site-settings.json'), loadJson<DeliveryConfig>('delivery-config.json'),
  ])
  const warnings: string[] = []
  // Numbers typed in the texts as {freeDeliveryAbove} {maxDistanceKm} {baseFee} {perKmFee} always follow delivery-config.json.
  const r = delivery.rules, rs = (n: number) => `₹${n.toLocaleString('en-IN')}`
  const tokens: Record<string, string> = { freeDeliveryAbove: rs(r.freeDeliveryAbove), maxDistanceKm: String(r.maxDistanceKm), freeDeliveryMaxKm: String(r.freeDeliveryMaxKm ?? r.maxDistanceKm), baseFee: rs(r.baseFee), perKmFee: rs(r.perKmFee) }
  const fill = <T,>(v: T): T => typeof v === 'string' ? v.replace(/\{(\w+)\}/g, (m, k) => tokens[k] ?? m) as T
    : Array.isArray(v) ? v.map(fill) as T : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) as T : v

  const categories: Category[] = csvToObjects(catText).filter(r => r.name).map(r => {
    const id = slugify(r.id || r.name)
    return { id, name: r.name, optionName: r['option name'] || 'Size', images: imageSources('categories', r.image, id) }
  })

  const products: Product[] = []
  csvToObjects(prodText).forEach((r, i) => {
    const line = i + 2
    if (!r.name) return
    if (r['show on website'] && !yes(r['show on website'])) return
    const wanted = (r.category ?? '').trim().toLowerCase()
    const cat = categories.find(c => c.id === slugify(wanted) || c.name.toLowerCase() === wanted)
    if (!cat) { warnings.push(`products.csv row ${line} ("${r.name}"): category "${r.category}" is not listed in categories.csv, so it is hidden.`); return }
    const basePrice = num(r.price), baseOriginal = num(r['original price'])
    const options = parseOptions(r.options ?? '', basePrice, baseOriginal)
    if (!options.length) { warnings.push(`products.csv row ${line} ("${r.name}"): no usable price (fill the price column, or give every option a price like 100g=149), so it is hidden.`); return }
    const price = Math.min(...options.map(o => o.price))
    products.push({
      id: i + 1, name: r.name, category: cat.id, price,
      originalPrice: options[0].originalPrice, optionName: r['option name'] || cat.optionName, options,
      images: imageSources(`products/${cat.id}`, r.image, slugify(r.name)),
      description: r.description ?? '', stock: r.stock ?? '', badge: r.badge || undefined,
      featured: yes(r.featured), live: yes(pick(r, 'live')),
    })
  })
  return { categories, products, settings: fill(settings), delivery, warnings }
}
