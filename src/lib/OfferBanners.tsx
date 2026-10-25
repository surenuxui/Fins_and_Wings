import { useEffect, useState } from 'react'
import { imageSources } from './images'

type Banner = { image: string; alt: string; link: string }

/** "Current offer" banners. Put the picture in public/images/banners/ and list it in site-settings.json.
 *  A banner whose picture is missing is simply not shown; with no banners the whole strip is hidden. */
export default function OfferBanners({ banners }: { banners: Banner[] }) {
  const [broken, setBroken] = useState<Set<string>>(new Set())
  const [i, setI] = useState(0)
  const live = banners.filter(b => b.image && !broken.has(b.image))
  const n = live.length
  useEffect(() => {
    if (n < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI(c => (c + 1) % n), 6000)
    return () => clearInterval(t)
  }, [n])
  if (!banners.length) return null
  return (
    <section className="banners" id="current-offer" aria-label="Current offers" hidden={n === 0}>
      <div className="shell">
        <div className="banner-frame">
          {banners.filter(b => b.image).map(b => {
            const idx = live.indexOf(b)
            return <BannerSlide key={b.image} b={b} active={idx === Math.min(i, n - 1)} onMissing={() => setBroken(s => new Set(s).add(b.image))} />
          })}
          {n > 1 && <div className="banner-dots">{live.map((b, k) => <button key={b.image} type="button" className={k === Math.min(i, n - 1) ? 'on' : ''} onClick={() => setI(k)} aria-label={`Show offer ${k + 1} of ${n}`} />)}</div>}
        </div>
      </div>
    </section>
  )
}

function BannerSlide({ b, active, onMissing }: { b: Banner; active: boolean; onMissing: () => void }) {
  const sources = imageSources('banners', b.image, '').slice(0, -1) // no placeholder: a missing banner hides itself
  const [k, setK] = useState(0)
  const img = <img src={sources[Math.min(k, sources.length - 1)]} alt={b.alt || 'Current offer'}
    onError={() => (k < sources.length - 1 ? setK(k + 1) : onMissing())} />
  return <div className={active ? 'banner-slide on' : 'banner-slide'} aria-hidden={!active}>
    {b.link ? <a href={b.link} tabIndex={active ? 0 : -1} target={/^https?:/.test(b.link) ? '_blank' : undefined} rel="noreferrer">{img}</a> : img}</div>
}
