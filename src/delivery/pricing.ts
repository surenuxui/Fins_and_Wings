import type { Rules } from './config.ts'

export type Quote =
  | { status: 'live-only' }
  | { status: 'invalid-amount' }
  | { status: 'out-of-range'; distanceKm: number }
  | {
      status: 'available'; distanceKm: number; orderAmount: number; free: boolean
      /** Why the fee is charged even though the order is above the free-delivery amount. */
      chargedBecause: 'order-amount' | 'distance'
      baseFee: number; distanceCharge: number; rawFee: number; deliveryFee: number; total: number
    }

/** Distance is rounded to 2 decimals ONCE, and that same value is shown, charged and range-checked. */
export const roundKm = (km: number) => Math.round(km * 100) / 100
export const formatKm = (km: number) => `${roundKm(km).toFixed(2)} km`
export const formatRupees = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

/** The ONLY place delivery pricing is calculated. All money maths is done in whole paise (no float errors). */
export function calculateDelivery(
  input: { orderAmount: number; distanceKm: number; hasLiveProducts?: boolean },
  rules: Rules,
): Quote {
  if (input.hasLiveProducts) return { status: 'live-only' }
  if (!Number.isFinite(input.orderAmount) || input.orderAmount <= 0) return { status: 'invalid-amount' }
  const km100 = Math.round(input.distanceKm * 100)
  if (!Number.isFinite(km100) || km100 < 0) return { status: 'invalid-amount' }
  if (km100 > Math.round(rules.maxDistanceKm * 100)) return { status: 'out-of-range', distanceKm: km100 / 100 }

  const amountPaise = Math.round(input.orderAmount * 100)
  const inFreeZone = km100 <= Math.round((rules.freeDeliveryMaxKm ?? rules.maxDistanceKm) * 100)
  const bigOrder = amountPaise > Math.round(rules.freeDeliveryAbove * 100)
  const free = bigOrder && inFreeZone // beyond the free zone delivery is ALWAYS charged, whatever the amount
  const basePaise = free ? 0 : Math.round(rules.baseFee * 100)
  const distancePaise = free ? 0 : Math.round(rules.perKmFee * km100) // ₹/km × (km×100) = paise
  const rawPaise = basePaise + distancePaise
  const feeRupees = Math.ceil(rawPaise / 100)
  return {
    status: 'available', distanceKm: km100 / 100, orderAmount: amountPaise / 100, free, chargedBecause: bigOrder && !inFreeZone ? 'distance' : 'order-amount',
    baseFee: basePaise / 100, distanceCharge: distancePaise / 100, rawFee: rawPaise / 100,
    deliveryFee: feeRupees, total: amountPaise / 100 + feeRupees,
  }
}

export function buildDeliveryMessage(a: {
  shopName: string; location: string; lat: number; lng: number; quote: Extract<Quote, { status: 'available' }>
}): string {
  const q = a.quote
  return [
    `Hello ${a.shopName}, I'd like to enquire about delivery.`, '',
    `Delivery location: ${a.location}`,
    `Map pin: https://www.openstreetmap.org/?mlat=${a.lat.toFixed(6)}&mlon=${a.lng.toFixed(6)}#map=17/${a.lat.toFixed(6)}/${a.lng.toFixed(6)}`,
    `Road distance: ${formatKm(q.distanceKm)}`,
    `Order amount: ${formatRupees(q.orderAmount)}`,
    `Delivery fee: ${q.free ? 'FREE' : formatRupees(q.deliveryFee)}`,
    `Estimated total: ${formatRupees(q.total)}`, '',
    'Note: The delivery fee is an estimate. Final delivery availability and charges will be confirmed by the shop.',
  ].join('\n')
}
