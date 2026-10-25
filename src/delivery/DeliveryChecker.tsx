import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './delivery.css'
import type { DeliveryConfig } from './config'
import { calculateDelivery, buildDeliveryMessage, formatKm, formatRupees, type Quote } from './pricing'
import { geocode, getRoute, reverseGeocode, ProviderError, type Place, type Point } from './providers'

type Props = { config: DeliveryConfig; shopName: string; whatsapp: string; phone: string }
type Problem = { title: string; text: string }
type Result = { dest: Place; quote: Quote }

const PROBLEMS: Record<string, Problem> = {
  'no-address': { title: 'Delivery location needed', text: 'Please enter your address and choose it from the suggestions, or tap the map to drop a pin.' },
  'no-amount': { title: 'Order amount needed', text: 'Please enter your order amount in ₹ (a number greater than 0).' },
  'not-found': { title: 'Location not found', text: 'We could not find that address. Try a nearby landmark, area or pincode, or tap the map to drop a pin.' },
  'no-route': { title: 'Route unavailable', text: 'We could not find a driving route to that point. Move the pin closer to a road and try again.' },
  service: { title: 'Distance service unavailable', text: 'We could not reach the map service, so the distance could not be verified. Please try again in a moment or message the shop.' },
  denied: { title: 'Location permission denied', text: 'We could not access your location. You can still search for your address or tap the map.' },
  unsupported: { title: 'Location not available', text: 'Your browser cannot share its location. Please search for your address or tap the map.' },
}
const OUT_OF_RANGE = 'Sorry, this location is outside our delivery area. Please contact the shop for assistance.'
const pinIcon = (cls: string, text: string) => L.divIcon({ className: `dc-pin ${cls}`, html: `<span>${text}</span>`, iconSize: [46, 46], iconAnchor: [23, 46] })

function useLeaflet(opts: { config: DeliveryConfig; center: Point; fixedPin: boolean; dest: Point | null; route: [number, number][]; onPick: (p: Point) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const destPin = useRef<L.Marker | null>(null)
  const line = useRef<L.Polyline | null>(null)
  const pick = useRef(opts.onPick); pick.current = opts.onPick
  const { config, center, fixedPin } = opts

  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, { center: [center.lat, center.lng], zoom: config.map.zoom, scrollWheelZoom: false })
    L.tileLayer(config.map.tileUrl, { maxZoom: 19, attribution: config.map.attribution }).addTo(m)
    m.attributionControl.setPrefix(false)
    if (fixedPin) L.marker([center.lat, center.lng], { icon: pinIcon('dc-shop', 'F&W'), keyboard: false, title: 'Fins & Wings shop' }).addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => pick.current({ lat: e.latlng.lat, lng: e.latlng.lng }))
    map.current = m
    return () => { m.remove(); map.current = null; destPin.current = null; line.current = null }
  }, [config, center.lat, center.lng, fixedPin])

  useEffect(() => {
    const m = map.current; if (!m) return
    if (!opts.dest) { destPin.current?.remove(); destPin.current = null; return }
    const ll: L.LatLngExpression = [opts.dest.lat, opts.dest.lng]
    if (!destPin.current) {
      destPin.current = L.marker(ll, { icon: pinIcon('dc-dest', 'You'), draggable: true, title: 'Your delivery location – drag to move' }).addTo(m)
      destPin.current.on('dragend', () => { const p = destPin.current!.getLatLng(); pick.current({ lat: p.lat, lng: p.lng }) })
    } else destPin.current.setLatLng(ll)
  }, [opts.dest?.lat, opts.dest?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current; if (!m) return
    line.current?.remove(); line.current = null
    if (opts.route.length > 1) {
      line.current = L.polyline(opts.route, { color: '#16483E', weight: 5, opacity: 0.9 }).addTo(m)
      m.fitBounds(line.current.getBounds(), { padding: [50, 50] })
    } else if (opts.dest) {
      m.fitBounds(L.latLngBounds([[center.lat, center.lng], [opts.dest.lat, opts.dest.lng]]), { padding: [60, 60], maxZoom: 15 })
    }
  }, [opts.route, opts.dest?.lat, opts.dest?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  return { el, map }
}

/** Owner-only helper (open the site with ?setup=1): click the shop on the map to read its coordinates. */
function ShopLocationPicker({ config }: { config: DeliveryConfig }) {
  const [pt, setPt] = useState<Point | null>(null)
  const c = { lat: config.map.setupCenter[0], lng: config.map.setupCenter[1] }
  const { el } = useLeaflet({ config, center: c, fixedPin: false, dest: pt, route: [], onPick: setPt })
  return (
    <div className="dc-setup">
      <h3>Shop location setup</h3>
      <p>Zoom in and click the exact spot of the shop door. Then copy the two numbers into <code>public/data/delivery-config.json</code>.</p>
      <div className="dc-map" style={{ height: 380 }}><div ref={el} className="dc-map-el" /></div>
      <pre>{pt ? `"latitude": ${pt.lat.toFixed(6)},\n"longitude": ${pt.lng.toFixed(6)}` : 'Click the map…'}</pre>
    </div>
  )
}

export default function DeliveryChecker({ config, shopName, whatsapp, phone }: Props) {
  const { latitude, longitude } = config.shop
  const shop: Point | null = typeof latitude === 'number' && typeof longitude === 'number' ? { lat: latitude, lng: longitude } : null
  const rules = config.rules

  const [address, setAddress] = useState('')
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const [dest, setDest] = useState<Place | null>(null)
  const [amount, setAmount] = useState('')
  const [hasLive, setHasLive] = useState(false)
  const [busy, setBusy] = useState<'' | 'search' | 'check' | 'locate'>('')
  const [problem, setProblem] = useState<Problem | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [route, setRoute] = useState<[number, number][]>([])
  const req = useRef(0)
  const dirty = useRef(false)
  const checked = useRef(false)
  const destRef = useRef<Place | null>(null)

  const amountNum = Number(amount)
  const fail = (key: string) => { setProblem(PROBLEMS[key]); setResult(null); setRoute([]); setBusy('') }

  async function runCheck(d: Place) {
    if (!shop) return
    const id = ++req.current
    checked.current = true; setProblem(null); setResult(null); setRoute([]); setBusy('check')
    try {
      const r = await getRoute(shop, d, config.providers)
      if (id !== req.current) return
      setRoute(r.coords)
      setResult({ dest: d, quote: calculateDelivery({ orderAmount: amountNum, distanceKm: r.distanceKm }, rules) })
      setBusy('')
    } catch (e) {
      if (id !== req.current) return
      fail(e instanceof ProviderError && e.kind === 'no-route' ? 'no-route' : 'service')
    }
  }

  async function choose(p: Point, label?: string) {
    const pinned: Place = { ...p, label: label ?? `Pinned location (${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})` }
    dirty.current = false; destRef.current = pinned; setSuggestions([]); setDest(pinned); setAddress(pinned.label)
    if (checked.current && !hasLive && amountNum > 0) runCheck(pinned) // moving the pin recalculates
    if (!label) {
      const name = await reverseGeocode(p, config.providers)
      const cur = destRef.current
      if (name && cur && cur.lat === p.lat && cur.lng === p.lng) { destRef.current = { ...cur, label: name }; setDest(destRef.current); setAddress(name) }
      if (name) setResult(r => (r && r.dest.lat === p.lat && r.dest.lng === p.lng ? { ...r, dest: { ...r.dest, label: name } } : r)) // keep the result card and WhatsApp text in step with the address
    }
  }

  async function search(text: string): Promise<Place[] | null> {
    const id = ++req.current
    setBusy('search'); setProblem(null)
    try {
      const found = await geocode(text, config.providers, shop)
      if (id !== req.current) return null
      setBusy(''); return found
    } catch { if (id === req.current) fail('service'); return null }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!address.trim()) return fail('no-address')
    const found = await search(address.trim())
    if (!found) return
    if (!found.length) { setSuggestions([]); return fail('not-found') }
    setSuggestions(found)
  }

  useEffect(() => { // optional as-you-type suggestions (off by default to respect free-service usage limits)
    const t = address.trim()
    if (!config.providers.autoSuggest || !dirty.current || t.length < 4) return
    const timer = setTimeout(async () => { const f = await search(t); if (f) setSuggestions(f) }, config.providers.suggestDebounceMs)
    return () => clearTimeout(timer)
  }, [address]) // eslint-disable-line react-hooks/exhaustive-deps

  function locateMe() {
    if (!('geolocation' in navigator)) return fail('unsupported')
    setBusy('locate'); setProblem(null)
    navigator.geolocation.getCurrentPosition(
      pos => { setBusy(''); choose({ lat: pos.coords.latitude, lng: pos.coords.longitude }) },
      () => fail('denied'), { enableHighAccuracy: true, timeout: 15000 })
  }

  async function onCheck() {
    if (hasLive) return
    if (!(amountNum > 0)) return fail('no-amount')
    let d = dest
    if (!d || dirty.current) {
      const text = address.trim()
      if (!text) return fail('no-address')
      const found = await search(text)
      if (!found) return
      if (!found.length) return fail('not-found')
      d = found[0]; dirty.current = false; destRef.current = d; setDest(d); setAddress(d.label); setSuggestions([])
    }
    runCheck(d)
  }

  const quote = result?.quote
  const waLink = quote?.status === 'available' && result
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(buildDeliveryMessage({ shopName, location: result.dest.label, lat: result.dest.lat, lng: result.dest.lng, quote }))}`
    : ''
  const liveLink = `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hello ${shopName}, I'd like to ask about live fish / live products available in the shop.`)}`

  return (
    <section className="checker section" id="delivery-check">
      <div className="shell">
        <div className="section-head">
          <div><p className="eyebrow">OUR PROMISE</p><h2>Check Delivery<br /><em>Availability</em></h2></div>
          <p>Enter your delivery location to check the distance from our shop and calculate your delivery fee.</p>
        </div>

        {!shop ? (
          new URLSearchParams(window.location.search).has('setup')
            ? <ShopLocationPicker config={config} />
            : <div className="dc-card dc-note" role="status"><b>Delivery checker is being set up.</b> Please message us on <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a> or call <a href={`tel:${phone}`}>{phone}</a> to confirm delivery.</div>
        ) : (
          <div className="dc-grid">
            <form className="dc-addr dc-card" onSubmit={onSearch} role="search">
              <label htmlFor="dc-address">Delivery address</label>
              <div className="dc-search">
                <input id="dc-address" value={address} autoComplete="street-address" placeholder="Street, area, landmark or pincode"
                  onChange={e => { dirty.current = true; setAddress(e.target.value) }} aria-describedby="dc-hint" />
                <button type="submit" className="dc-btn dc-btn-ghost" disabled={busy === 'search'}>{busy === 'search' ? 'Searching…' : 'Search'}</button>
              </div>
              <p id="dc-hint" className="dc-hint">Press Search, then pick your location from the suggestions. You can also tap the map or drag the pin.</p>
              {suggestions.length > 0 && <ul className="dc-suggest" aria-label="Location suggestions">
                {suggestions.map(s => <li key={`${s.lat},${s.lng}`}>
                  <button type="button" onClick={() => choose(s, s.label)}>{s.label}</button></li>)}
              </ul>}
              <button type="button" className="dc-btn dc-btn-ghost dc-locate" onClick={locateMe} disabled={busy === 'locate'}>
                {busy === 'locate' ? 'Finding you…' : '◎ Use My Location'}</button>
            </form>

            <div className="dc-mapwrap">
              <div className="dc-map"><MapHost config={config} shop={shop} dest={dest} route={route} onPick={p => choose(p)} /></div>
              <p className="dc-attrib-note">Tap the map or drag the <b>You</b> pin to set your location. Distance is by road, not a straight line.</p>
            </div>

            <div className="dc-amt dc-card">
              <label htmlFor="dc-amount">Order amount (₹)</label>
              <input id="dc-amount" type="number" inputMode="decimal" min="1" step="any" value={amount} placeholder="e.g. 450"
                onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && onCheck()} />
              <label className="dc-check"><input type="checkbox" checked={hasLive} onChange={e => { setHasLive(e.target.checked); setResult(null); setProblem(null) }} />
                <span>My order includes live fish or other live products</span></label>
              {hasLive && <div className="dc-msg dc-msg-warn" role="status"><b>⚠ Visit Shop Only</b>
                <p>Live fish and live products are sold only at the shop, so online delivery is not offered for them. Please visit us, or ask about live stock.</p>
                <a className="dc-btn dc-btn-ghost" href={liveLink} target="_blank" rel="noreferrer">Ask about live stock on WhatsApp</a></div>}
              <button type="button" className="dc-btn dc-btn-primary" onClick={onCheck} disabled={busy === 'check' || busy === 'search' || hasLive} aria-busy={busy === 'check'}>
                {busy === 'check' ? <><span className="dc-spin" aria-hidden="true" /> Checking route…</> : 'Check Delivery'}</button>
            </div>

            <div className="dc-res" aria-live="polite">
              {busy === 'check' && <div className="dc-card dc-msg" role="status">Calculating the driving route…</div>}
              {problem && <div className="dc-card dc-msg dc-msg-bad" role="alert"><b>✕ {problem.title}</b><p>{problem.text}</p></div>}
              {quote?.status === 'out-of-range' && result && <div className="dc-card dc-msg dc-msg-bad" role="alert">
                <b>✕ Outside delivery area</b><p>{OUT_OF_RANGE}</p><p className="dc-small">Road distance: {formatKm(quote.distanceKm)} (we deliver up to {rules.maxDistanceKm} km)</p>
                <a className="dc-btn dc-btn-ghost" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Contact the shop</a></div>}
              {quote?.status === 'available' && result && <div className="dc-card dc-result">
                <div className="dc-status">✓ Delivery available{quote.free && <span className="dc-free">FREE DELIVERY</span>}</div>
                <p className="dc-loc">{result.dest.label}</p>
                <dl>
                  <div><dt>Order amount</dt><dd>{formatRupees(quote.orderAmount)}</dd></div>
                  <div><dt>Road distance</dt><dd>{formatKm(quote.distanceKm)}</dd></div>
                  {!quote.free && <>
                    <div><dt>Base charge</dt><dd>{formatRupees(quote.baseFee)}</dd></div>
                    <div><dt>Distance charge ({formatRupees(rules.perKmFee)} × {quote.distanceKm.toFixed(2)} km)</dt><dd>{formatRupees(quote.distanceCharge)}</dd></div>
                  </>}
                  <div><dt>Delivery fee{!quote.free && quote.rawFee !== quote.deliveryFee ? ' (rounded up)' : ''}</dt><dd>{quote.free ? 'FREE' : formatRupees(quote.deliveryFee)}</dd></div>
                  <div className="dc-total"><dt>Total including delivery</dt><dd>{formatRupees(quote.total)}</dd></div>
                </dl>
                {quote.chargedBecause === 'distance' && <p className="dc-note-inline" role="note">ℹ Free delivery applies only within {rules.freeDeliveryMaxKm ?? rules.maxDistanceKm} km, so this distance is charged whatever the order amount.</p>}
                <p className="dc-small">This fee is an estimate. Final delivery availability is confirmed by the shop.</p>
                <a className="dc-btn dc-btn-primary" href={waLink} target="_blank" rel="noreferrer">Enquire on WhatsApp</a>
              </div>}
              {!busy && !problem && !result && <p className="dc-idle">Free delivery above {formatRupees(rules.freeDeliveryAbove)} within {rules.freeDeliveryMaxKm ?? rules.maxDistanceKm} km. Otherwise {formatRupees(rules.baseFee)} + {formatRupees(rules.perKmFee)} per km, up to {rules.maxDistanceKm} km.</p>}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function MapHost({ config, shop, dest, route, onPick }: { config: DeliveryConfig; shop: Point; dest: Point | null; route: [number, number][]; onPick: (p: Point) => void }) {
  const { el } = useLeaflet({ config, center: shop, fixedPin: true, dest, route, onPick })
  return <div ref={el} className="dc-map-el dc-map-live" />
}
