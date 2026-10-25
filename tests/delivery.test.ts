import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateDelivery, buildDeliveryMessage } from '../src/delivery/pricing.ts'
import { getRoute, geocode, ProviderError } from '../src/delivery/providers.ts'
import { csvToObjects } from '../src/lib/csv.ts'

const rules = { freeDeliveryAbove: 300, maxDistanceKm: 10, baseFee: 30, perKmFee: 10 }
const P = { geocodeUrl: 'http://x/s', reverseUrl: 'http://x/r', routeUrl: 'http://x/route', countryCodes: 'in', autoSuggest: false, suggestDebounceMs: 1, timeoutMs: 500, maxSnapMeters: 500 }
const calc = (orderAmount: number, distanceKm: number, hasLiveProducts = false) => calculateDelivery({ orderAmount, distanceKm, hasLiveProducts }, rules) as any

test('₹300 within 10 km pays the formula (₹300 is NOT "above ₹300")', () => {
  const q = calc(300, 5); assert.equal(q.free, false); assert.equal(q.deliveryFee, 80); assert.equal(q.total, 380)
})
test('₹301 within 10 km is free', () => {
  const q = calc(301, 5); assert.equal(q.free, true); assert.equal(q.deliveryFee, 0); assert.equal(q.total, 301); assert.equal(q.baseFee, 0)
})
test('exactly 10 km is available', () => {
  assert.equal(calc(250, 10).deliveryFee, 130); assert.equal(calc(500, 10).free, true)
})
test('beyond 10 km is never free or payable', () => {
  for (const amt of [100, 300, 301, 5000]) { const q = calc(amt, 10.01); assert.equal(q.status, 'out-of-range'); assert.equal(q.total, undefined); assert.equal(q.deliveryFee, undefined) }
})
test('decimal distances round once and the fee rounds UP', () => {
  const q = calc(250, 6.42); assert.equal(q.distanceCharge, 64.2); assert.equal(q.rawFee, 94.2); assert.equal(q.deliveryFee, 95)
  assert.equal(calc(250, 6.4249).distanceKm, 6.42)          // shown and charged as 6.42
  assert.equal(calc(250, 10.004).status, 'available')        // displays as 10.00 km
  assert.equal(calc(250, 10.006).status, 'out-of-range')     // displays as 10.01 km
  assert.equal(calc(100, 7.35).distanceCharge, 73.5)         // no float drift (10 × 7.35)
  assert.equal(calc(100, 0).deliveryFee, 30)
})
test('invalid amounts and live products', () => {
  for (const bad of [0, -5, NaN]) assert.equal(calc(bad, 3).status, 'invalid-amount')
  assert.equal(calc(1000, 3, true).status, 'live-only')
})
test('WhatsApp message has every required detail', () => {
  const m = buildDeliveryMessage({ shopName: 'Fins & Wings', location: 'Medavakkam, Chennai', lat: 12.9, lng: 80.2, quote: calc(250, 6.42) })
  for (const t of ['Medavakkam, Chennai', '6.42 km', '₹250', '₹95', '₹345', 'estimate', 'confirmed by the shop']) assert.ok(m.includes(t), t)
})

const fakeFetch = (body: unknown, ok = true) => (globalThis.fetch = (async () => ({ ok, status: ok ? 200 : 503, json: async () => body })) as any)
const A = { lat: 1, lng: 1 }
test('routing: success, no route, far-from-road pin, service failure, network failure', async () => {
  fakeFetch({ code: 'Ok', routes: [{ distance: 6420, geometry: { coordinates: [[80, 13], [80.1, 13.1]] } }], waypoints: [{ distance: 5 }, { distance: 20 }] })
  const r = await getRoute(A, A, P); assert.equal(r.distanceKm, 6.42); assert.deepEqual(r.coords[0], [13, 80])
  fakeFetch({ code: 'NoRoute' }); await assert.rejects(getRoute(A, A, P), (e: ProviderError) => e.kind === 'no-route')
  fakeFetch({ code: 'Ok', routes: [{ distance: 1 }], waypoints: [{ distance: 1 }, { distance: 9000 }] }); await assert.rejects(getRoute(A, A, P), (e: ProviderError) => e.kind === 'no-route')
  fakeFetch({}, false); await assert.rejects(getRoute(A, A, P), (e: ProviderError) => e.kind === 'service')
  fakeFetch({ code: 'Ok' }); await assert.rejects(getRoute(A, A, P), (e: ProviderError) => e.kind === 'service')
  globalThis.fetch = (async () => { throw new TypeError('offline') }) as any
  await assert.rejects(getRoute(A, A, P), (e: ProviderError) => e.kind === 'service')
})
test('geocoding: results, invalid address (no results), failure', async () => {
  fakeFetch([{ lat: '13.0', lon: '80.2', display_name: 'Selaiyur, Chennai' }])
  assert.equal((await geocode('selaiyur', P, null))[0].label, 'Selaiyur, Chennai')
  fakeFetch([]); assert.deepEqual(await geocode('zzzzqq', P, null), [])
  fakeFetch({}, false); await assert.rejects(geocode('x', P, null), (e: ProviderError) => e.kind === 'service')
})
test('CSV: Excel BOM, quotes, commas, CRLF, blank rows', () => {
  const rows = csvToObjects('\uFEFFName,Price\r\n"Tank, 20L",1299\r\n\r\n"He said ""hi""",5\r\n')
  assert.deepEqual(rows, [{ name: 'Tank, 20L', price: '1299' }, { name: 'He said "hi"', price: '5' }])
})

import { parseOptions } from '../src/lib/options.ts'
test('product options: priced, base-price, old price, errors', () => {
  assert.deepEqual(parseOptions('100g=149|175; 200g=279', NaN, NaN), [{ label: '100g', price: 149, originalPrice: 175 }, { label: '200g', price: 279, originalPrice: undefined }])
  assert.equal(parseOptions('', 299, NaN)[0].price, 299)
  assert.equal(parseOptions('1 feet; 2 feet=500', 300, NaN)[0].price, 300)
  assert.deepEqual(parseOptions('1 feet; 2 feet=500', NaN, NaN), [])
  assert.deepEqual(parseOptions('', NaN, NaN), [])
  assert.equal(parseOptions('4W = ₹1,299', NaN, NaN)[0].price, 1299)
})

test('free zone vs. delivery limit: beyond the free zone delivery is always charged', () => {
  const far = { freeDeliveryAbove: 399, freeDeliveryMaxKm: 10, maxDistanceKm: 20, baseFee: 30, perKmFee: 10 }
  const q = (amt: number, km: number) => calculateDelivery({ orderAmount: amt, distanceKm: km }, far) as any
  assert.equal(q(5000, 10).free, true)                       // exactly 10 km, big order: free
  const c = q(5000, 12); assert.equal(c.free, false); assert.equal(c.deliveryFee, 150); assert.equal(c.total, 5150); assert.equal(c.chargedBecause, 'distance')
  assert.equal(q(399, 5).chargedBecause, 'order-amount')
  assert.equal(q(100, 20).deliveryFee, 230)                  // exactly at the limit
  assert.equal(q(5000, 20.01).status, 'out-of-range')
  assert.equal(calculateDelivery({ orderAmount: 5000, distanceKm: 12 }, { freeDeliveryAbove: 399, maxDistanceKm: 10, baseFee: 30, perKmFee: 10 }).status, 'out-of-range') // old configs still work
})
