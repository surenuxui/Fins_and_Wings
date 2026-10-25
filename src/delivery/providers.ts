// Search, reverse-search and routing live ONLY here. To switch provider (Google, Mapbox, a paid OSRM,
// your own server…) change the URLs in delivery-config.json, or rewrite these three functions.
import type { Providers } from './config.ts'

export type Point = { lat: number; lng: number }
export type Place = Point & { label: string }
export class ProviderError extends Error {
  kind: 'no-route' | 'service' | 'aborted'
  constructor(kind: 'no-route' | 'service' | 'aborted', message?: string) { super(message ?? kind); this.kind = kind }
}

async function getJson(url: string, timeoutMs: number, signal?: AbortSignal): Promise<any> {
  const ctl = new AbortController()
  const onAbort = () => ctl.abort()
  signal?.addEventListener('abort', onAbort)
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new ProviderError('service', `HTTP ${res.status}`)
    return await res.json()
  } catch (e) {
    if (e instanceof ProviderError) throw e
    throw new ProviderError(signal?.aborted ? 'aborted' : 'service', String(e))
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort) }
}

export async function geocode(query: string, p: Providers, near: Point | null, signal?: AbortSignal): Promise<Place[]> {
  const q = new URLSearchParams({ format: 'jsonv2', limit: '5', q: query, countrycodes: p.countryCodes })
  if (near) q.set('viewbox', `${near.lng - 0.45},${near.lat + 0.45},${near.lng + 0.45},${near.lat - 0.45}`)
  const data = await getJson(`${p.geocodeUrl}?${q}`, p.timeoutMs, signal)
  if (!Array.isArray(data)) throw new ProviderError('service', 'Unexpected search response')
  return data
    .map((d: any) => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lon), label: String(d.display_name ?? '') }))
    .filter(d => Number.isFinite(d.lat) && Number.isFinite(d.lng) && d.label)
}

export async function reverseGeocode(pt: Point, p: Providers, signal?: AbortSignal): Promise<string | null> {
  try {
    const q = new URLSearchParams({ format: 'jsonv2', lat: String(pt.lat), lon: String(pt.lng), zoom: '18' })
    const data = await getJson(`${p.reverseUrl}?${q}`, p.timeoutMs, signal)
    return typeof data?.display_name === 'string' ? data.display_name : null
  } catch { return null } // a missing label is not an error – the pin itself is what matters
}

/** Driving distance in km + the route line as [lat, lng] pairs. Throws ProviderError('no-route' | 'service'). */
export async function getRoute(from: Point, to: Point, p: Providers, signal?: AbortSignal) {
  const url = `${p.routeUrl}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
  const data = await getJson(url, p.timeoutMs, signal)
  if (data?.code === 'NoRoute' || data?.code === 'NoSegment') throw new ProviderError('no-route')
  const route = data?.routes?.[0]
  if (data?.code !== 'Ok' || !route || typeof route.distance !== 'number') throw new ProviderError('service', `Routing: ${data?.code ?? 'bad response'}`)
  // The pin must be near a drivable road, otherwise the distance would not be trustworthy.
  const snap = data.waypoints?.[1]?.distance
  if (typeof snap === 'number' && snap > p.maxSnapMeters) throw new ProviderError('no-route', 'Pin is far from any road')
  const coords: [number, number][] = (route.geometry?.coordinates ?? []).map((c: number[]) => [c[1], c[0]])
  return { distanceKm: route.distance / 1000, coords }
}
