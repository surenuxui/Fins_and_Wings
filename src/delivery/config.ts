export type DeliveryConfig = {
  shop: { latitude: number | null; longitude: number | null }
  rules: Rules
  providers: Providers
  map: { tileUrl: string; attribution: string; zoom: number; setupCenter: [number, number] }
}
export type Rules = {
  freeDeliveryAbove: number
  /** Free delivery only applies within this distance. Beyond it, delivery is always charged. (Defaults to maxDistanceKm.) */
  freeDeliveryMaxKm?: number
  /** Furthest distance we deliver to. */
  maxDistanceKm: number
  baseFee: number
  perKmFee: number
}
export type Providers = {
  geocodeUrl: string; reverseUrl: string; routeUrl: string; countryCodes: string
  autoSuggest: boolean; suggestDebounceMs: number; timeoutMs: number; maxSnapMeters: number
}
