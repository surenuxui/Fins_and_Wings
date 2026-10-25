import { useEffect, useMemo, useState } from 'react'

import SmartImage from './lib/SmartImage'
import { imageSources } from './lib/images'
import { loadContent, type Content, type Product } from './lib/content'
import OfferBanners from './lib/OfferBanners'
import CategoryScroller from './lib/CategoryScroller'
import PaymentCard from './lib/PaymentCard'
import DeliveryChecker from './delivery/DeliveryChecker'
import { formatRupees } from './delivery/pricing'
const MAX_QTY = 99
const Icon = ({ name }: { name: 'search' | 'menu' | 'arrow' | 'whatsapp' | 'location' | 'delivery' }) => {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
    whatsapp: <><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.7 2 2 3.3 4 4l1-1c.3-.3.6-.2.9-.1l1.4.7c.3.2.4.4.3.7-.3 1.1-1.2 1.8-2.3 1.8-3.3-.2-6.7-3.5-6.9-6.8 0-1 .7-2 1.6-2.3.3-.1.6 0 .7.4l.7 1.5c.1.3.1.6-.2.8Z"/></>,
    location: <><path d="M12 21s6-5.3 6-11a6 6 0 0 0-12 0c0 5.7 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></>,
    delivery: <><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>
}

export default function App() {
  const [content, setContent] = useState<Content | null>(null)
  const [loadError, setLoadError] = useState('')
  const data = content, settings = content?.settings ?? null
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('featured')
  const [menu, setMenu] = useState(false)
  const [qty, setQty] = useState<Record<number, number>>({})
  const [optIdx, setOptIdx] = useState<Record<number, number>>({})
  const getOpt = (p: Product) => p.options[Math.min(optIdx[p.id] ?? 0, p.options.length - 1)]
  const optText = (p: Product) => { const o = getOpt(p).label; return o ? ` (${p.optionName}: ${o})` : '' }
  const getQty = (id: number) => qty[id] ?? 1
  const setQuantity = (id: number, value: number) => setQty(c => ({ ...c, [id]: Math.min(MAX_QTY, Math.max(1, Math.floor(value) || 1)) }))
  const [form, setForm] = useState({ name: '', mobile: '', email: '', type: '', product: '', quantity: '', contact: 'WhatsApp', message: '', consent: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formStatus, setFormStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc) }, [])
  useEffect(() => { loadContent().then(setContent).catch(e => setLoadError(String(e.message ?? e))) }, [])

  const products = useMemo(() => {
    if (!data) return []
    const found = data.products.filter(p =>
      (category === 'all' || p.category === category) &&
      `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(query.toLowerCase()))
    return [...found].sort((a, b) => sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : Number(b.featured) - Number(a.featured))
  }, [data, category, query, sort])

  if (loadError) return <div className="config-error" role="alert"><h1>The website could not load its content</h1><p>{loadError}</p><p>Fix that file (or put back the last working copy) and refresh the page.</p></div>
  if (!data || !settings) return <div className="loading">Preparing the aquarium…</div>
  const money = formatRupees
  const warnings = new URLSearchParams(window.location.search).has('check') ? data.warnings : []
  const wa = (text: string) => `https://wa.me/${settings.shop.whatsapp}?text=${encodeURIComponent(text)}`
  const productWa = (p: Product) => { const q = getQty(p.id), pr = getOpt(p).price; return wa(`Hello Fins & Wings, I’d like to order ${q} × ${p.name}${optText(p)} (${money(pr)} each, ${money(pr * q)} in total). Please confirm availability and delivery charges.`) }
  const updateForm = (field: string, value: string | boolean) => {
    setForm(current => ({ ...current, [field]: value }))
    if (errors[field]) setErrors(current => ({ ...current, [field]: '' }))
  }
  const fp = (k: string, required = false) => ({ id: `f-${k}`, 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `err-${k}` : undefined, 'aria-required': required || undefined })
  const fe = (k: string) => errors[k] ? <small id={`err-${k}`} className="field-error">{errors[k]}</small> : null
  const enquireAbout = (p: Product) => {
    setForm(current => ({ ...current, product: p.name + optText(p), type: p.live ? 'Other' : 'Product availability', quantity: String(getQty(p.id)), message: `I would like to know more about ${p.name}.` }))
    setFormStatus('')
    requestAnimationFrame(() => document.querySelector('#enquiry')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const submitEnquiry = (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    const nextErrors: Record<string, string> = {}
    if (!form.name.trim()) nextErrors.name = 'Please enter your full name.'
    if (!form.mobile.trim()) nextErrors.mobile = 'Please enter your mobile number.'
    else if (!/^(?:\+91)?[6-9]\d{9}$/.test(form.mobile.replace(/[\s-]/g, ''))) nextErrors.mobile = 'Enter a valid 10-digit Indian mobile number.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.'
    if (!form.type) nextErrors.type = 'Please select an enquiry type.'
    if (!form.message.trim()) nextErrors.message = 'Please tell us how we can help.'
    if (!form.consent) nextErrors.consent = 'Please agree before continuing.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setFormStatus('Please check the highlighted fields.')
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.enquiry-form [aria-invalid="true"]')?.focus())
      return
    }
    setSubmitting(true)
    const message = [
      'Hello Fins & Wings, I would like to make an enquiry.', '',
      `Name: ${form.name.trim()}`, `Mobile: ${form.mobile.trim()}`,
      form.email ? `Email: ${form.email.trim()}` : '',
      `Enquiry type: ${form.type}`, form.product ? `Product: ${form.product.trim()}` : '',
      form.quantity ? `Quantity: ${form.quantity}` : '',
      `Preferred contact: ${form.contact}`, `Message: ${form.message.trim()}`,
    ].filter(Boolean).join('\n')
    // NB: the 'noopener' flag makes window.open() always return null, which wrongly looked like a blocked popup.
    const opened = window.open(wa(message), '_blank')
    if (opened) opened.opener = null
    setFormStatus(opened === null ? `WhatsApp could not open. Please call ${settings.shop.phone}.` : 'Your enquiry is ready in WhatsApp. Please tap Send there to submit it to our shop.')
    window.setTimeout(() => setSubmitting(false), 900)
  }

  return (
    <>
      {warnings.length > 0 && <div className="notice" role="status"><b>Content check:</b><ul>{warnings.map(w => <li key={w}>{w}</li>)}</ul></div>}
      <header className="site-header">
        <a className="brand" href="#home" aria-label="Fins and Wings home">
          <span>Fins <i>&</i> Wings</span><small>{settings.shop.subtitle}</small>
        </a>
        <nav id="main-nav" className={menu ? 'nav open' : 'nav'} aria-label="Main navigation">
          {settings.nav.map(item =>
            <a key={item.label} href={`#${item.target}`} onClick={() => setMenu(false)}>{item.label}</a>)}
        </nav>
        <div className="header-actions">
          <a className="icon-link" href="#shop" aria-label="Search products" onClick={() => window.setTimeout(() => document.querySelector<HTMLInputElement>('#product-search')?.focus({ preventScroll: true }), 500)}><Icon name="search"/></a>
          <a className="button button-small" href={wa('Hello Fins & Wings, I’d like to enquire about your products.')} target="_blank" rel="noreferrer"><Icon name="whatsapp"/> Enquire</a>
          <button className="menu-button" type="button" onClick={() => setMenu(!menu)} aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} aria-controls="main-nav"><Icon name="menu"/></button>
        </div>
      </header>

      <main>
        <section className="hero shell" id="home">
          <div className="hero-copy">
            <p className="eyebrow">{settings.hero.eyebrow}</p>
            <h1>{settings.hero.title}</h1>
            <p className="lead">{settings.hero.copy}</p>
            <div className="button-row">
              <a className="button" href="#shop">Explore products <Icon name="arrow"/></a>
              <a className="text-link" href={wa('Hello Fins & Wings, I’d like to know more about your products.')} target="_blank" rel="noreferrer">Chat on WhatsApp <Icon name="arrow"/></a>
            </div>
            <div className="trust">
              {settings.hero.trust.map(t => <span key={t}>{t}</span>)}
            </div>
          </div>
          <div className="hero-visual">
            <div className="lime-orb"/>
            <SmartImage sources={imageSources('site', settings.hero.image, 'hero')} alt="Lush planted freshwater aquarium with tropical fish"/>
            <div className="floating-note"><small>THE JOY OF AQUATIC LIFE</small><strong>Small things,<br/>big joy.</strong></div>
            <span className="image-index">01 / AQUARIUM</span>
          </div>
        </section>

        <OfferBanners banners={settings.banners ?? []}/>

        <section className="usp" id="usp" aria-labelledby="usp-title">
          <div className="shell">
            <div className="usp-head"><div><p className="eyebrow light">{settings.usp.eyebrow}</p><h2 id="usp-title">{settings.usp.title.split('\n').map((l, i) => <span key={i}>{i > 0 && <br/>}{i ? <em>{l}</em> : l}</span>)}</h2></div><p>{settings.usp.copy}</p></div>
            <div className="usp-grid">{settings.usp.items.map((u, i) => <div className="usp-card" key={u.title}><b>{String(i + 1).padStart(2, '0')}</b><h3>{u.title}</h3><p>{u.text}</p></div>)}</div>
            <a className="button lime" href="#delivery-check">{settings.usp.cta} <Icon name="arrow"/></a>
          </div>
        </section>

        <section className="offer" id="offers">
          <div className="shell offer-inner">
            <SmartImage sources={imageSources('site', settings.promotion.image, 'promo')} alt="Fish food promotion"/>
            <div><p className="eyebrow light">{settings.promotion.eyebrow}</p><h2>{settings.promotion.title}</h2><p>{settings.promotion.copy}</p><small>{settings.promotion.conditions} · {settings.promotion.expiry}</small></div>
            <a className="circle-link" href="#shop" aria-label="Check offer"><Icon name="arrow"/></a>
          </div>
        </section>

        <section className="categories shell section" id="categories">
          <div className="section-head"><div><p className="eyebrow">BROWSE BY NEED</p><h2>Everything they need,<br/><em>thoughtfully chosen.</em></h2></div><p>From everyday care to a beautiful new setup, find essentials for aquatic and companion pets.</p></div>
          <CategoryScroller categories={data.categories} onPick={id => { setCategory(id); document.querySelector('#shop')?.scrollIntoView({ behavior: 'smooth' }) }}/>
        </section>

        <section className="catalogue section" id="shop">
          <div className="shell">
            <div className="section-head catalogue-head"><div><p className="eyebrow">SHOP THE COLLECTION</p><h2>Care starts with<br/><em>the right essentials.</em></h2></div><p>Prices and stock are indicative. We’ll confirm everything personally on WhatsApp before your order.</p></div>
            <div className="controls">
              <label className="search-box"><Icon name="search"/><span className="sr-only">Search products</span><input id="product-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search food, filters, tanks…" autoComplete="off"/></label>
              <label><span className="sr-only">Filter category</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{data.categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
              <label><span className="sr-only">Sort products</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Featured first</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label>
            </div>
            {products.length ? <div className="product-grid">{products.map(p => (
              <article className="product-card" key={p.id}>
                <div className="product-image"><SmartImage sources={p.images} alt={p.name} loading="lazy"/>{p.badge && <span className="badge">{p.badge}</span>}{p.live && <span className="visit-only">Visit Shop Only</span>}</div>
                <div className="product-info"><p className="product-category">{data.categories.find(c => c.id === p.category)?.name}</p><h3>{p.name}</h3><p className="description">{p.description}</p><div className="price-row"><strong>{money(getOpt(p).price)}</strong>{getOpt(p).originalPrice && <s>{money(getOpt(p).originalPrice!)}</s>}<span>{p.stock}</span></div>
                {!p.live && (p.options.length > 1 || p.options[0].label) && <label className="opt-row"><span>{p.optionName}</span>
                  <select value={Math.min(optIdx[p.id] ?? 0, p.options.length - 1)} onChange={e => setOptIdx(c => ({ ...c, [p.id]: Number(e.target.value) }))} aria-label={`${p.optionName} for ${p.name}`}>
                    {p.options.map((o, i) => <option key={o.label + i} value={i}>{o.label}{p.options.length > 1 ? ` — ${money(o.price)}` : ''}</option>)}</select></label>}
                {!p.live && <div className="qty-row"><span id={`qty-l-${p.id}`}>Quantity</span>
                  <div className="qty" role="group" aria-labelledby={`qty-l-${p.id}`}>
                    <button type="button" onClick={() => setQuantity(p.id, getQty(p.id) - 1)} disabled={getQty(p.id) <= 1} aria-label={`Decrease quantity of ${p.name}`}>−</button>
                    <input type="number" inputMode="numeric" min={1} max={MAX_QTY} value={getQty(p.id)} onChange={e => setQuantity(p.id, Number(e.target.value))} aria-label={`Quantity of ${p.name}`}/>
                    <button type="button" onClick={() => setQuantity(p.id, getQty(p.id) + 1)} disabled={getQty(p.id) >= MAX_QTY} aria-label={`Increase quantity of ${p.name}`}>+</button>
                  </div>
                  <strong className="qty-total" aria-live="polite">{money(getOpt(p).price * getQty(p.id))}</strong></div>}
                <div className="product-actions">
                  {!p.live && <a className="product-action" href={productWa(p)} target="_blank" rel="noreferrer">Order on WhatsApp <Icon name="arrow"/></a>}
                  <button className="product-enquire" type="button" onClick={() => enquireAbout(p)}>{p.live ? 'Enquire at Shop' : 'Enquire Now'} <Icon name="arrow"/></button>
                </div></div>
              </article>))}</div> : <div className="empty"><h3>No little wonders found.</h3><p>Try another search or browse all categories.</p><button type="button" onClick={() => { setQuery(''); setCategory('all') }}>View all products</button></div>}
          </div>
        </section>

        <section className="feature shell">
          <SmartImage sources={imageSources('site', settings.feature.image, 'feature')} alt="Premium aquarium essentials" loading="lazy"/>
          <div><p className="eyebrow">AQUARIUM ESSENTIALS</p><h2>{settings.feature.title}</h2><p>{settings.feature.copy}</p><a className="button" href="#shop">{settings.feature.cta}<Icon name="arrow"/></a></div>
        </section>

        <section className="delivery section" id="delivery">
          <div className="shell delivery-grid">
            <div className="delivery-icon"><Icon name="delivery"/></div>
            <div><p className="eyebrow light">LOCAL DELIVERY</p><h2>From our shop<br/><em>to your door.</em></h2></div>
            <div className="delivery-copy"><p>{settings.delivery.terms}</p><dl><div><dt>Free delivery</dt><dd>Above {money(data.delivery.rules.freeDeliveryAbove)} · within {data.delivery.rules.freeDeliveryMaxKm ?? data.delivery.rules.maxDistanceKm} km</dd></div><div><dt>Otherwise</dt><dd>{money(data.delivery.rules.baseFee)} + {money(data.delivery.rules.perKmFee)}/km</dd></div><div><dt>Delivery area</dt><dd>Up to {data.delivery.rules.maxDistanceKm} km by road</dd></div></dl><small>Final charges depend on distance, stock, and product size and are confirmed by the shop.</small></div>
          </div>
        </section>

        <DeliveryChecker config={data.delivery} shopName={settings.shop.name} whatsapp={settings.shop.whatsapp} phone={settings.shop.phone}/>

        <section className="about shell section" id="about-us">
          <div className="about-image"><SmartImage sources={imageSources('site', settings.about.image, 'about')} alt="Aquarium shop display" loading="lazy"/><div className="emblem"><b>F<i>&amp;</i>W</b><small>SELAIYUR</small></div></div>
          <div className="about-copy"><p className="eyebrow">COME SAY HELLO</p><h2>A local shop.<br/><em>A lot of heart.</em></h2><p>{settings.about.copy}</p>
            <div className="shop-detail"><Icon name="location"/><div><strong>{settings.shop.name}</strong><p>{settings.shop.address}</p></div></div>
            <div className="detail-grid"><div><small>OPEN DAILY</small><strong>{settings.shop.hours}</strong></div><div><small>CALL US</small><a href={`tel:${settings.shop.phone}`}>{settings.shop.phone}</a></div></div>
            <div className="button-row"><a className="button" href={settings.shop.mapsUrl} target="_blank" rel="noreferrer">Get directions <Icon name="arrow"/></a><a className="text-link" href={wa('Hello Fins & Wings, I’d like to visit your shop.')} target="_blank" rel="noreferrer">WhatsApp us <Icon name="arrow"/></a></div>
          </div>
        </section>

        <section className="enquiry-section section" id="enquiry">
          <div className="shell">
            <div className="enquiry-heading">
              <div><p className="eyebrow">LET’S TALK</p><h2>Have a question?<br/><em>We’re here to help.</em></h2></div>
              <p>Looking for aquarium supplies, fish food, tanks, bird accessories, or pet products? Send us your enquiry, and our team will assist you.</p>
            </div>
            <div className="enquiry-layout">
              <aside className="enquiry-info">
                <SmartImage sources={imageSources('site', settings.enquiry.image, 'enquiry')} alt="Lush green aquatic plants in an aquarium" loading="lazy"/>
                <div className="enquiry-info-body">
                  <p className="eyebrow light">VISIT OR MESSAGE US</p>
                  <dl>
                    <div><dt>WhatsApp</dt><dd><a href={`https://wa.me/${settings.shop.whatsapp}`} target="_blank" rel="noreferrer">{settings.shop.phone}</a></dd></div>
                    <div><dt>Location</dt><dd>{settings.shop.address}</dd></div>
                    <div><dt>Business hours</dt><dd>{settings.shop.hours}</dd></div>
                  </dl>
                  <a className="button lime" href={settings.shop.mapsUrl} target="_blank" rel="noreferrer">Get Directions <Icon name="arrow"/></a>
                </div>
              </aside>
              <form className="enquiry-form" onSubmit={submitEnquiry} noValidate>
                {form.product && <div className="selected-product">Enquiring about: <strong>{form.product}</strong><button type="button" onClick={() => updateForm('product', '')} aria-label="Clear selected product">×</button></div>}
                <div className="form-grid">
                  <label>Full Name <span>*</span><input value={form.name} onChange={e => updateForm('name', e.target.value)} autoComplete="name" {...fp('name', true)}/>{fe('name')}</label>
                  <label>Mobile Number <span>*</span><input value={form.mobile} onChange={e => updateForm('mobile', e.target.value)} inputMode="tel" autoComplete="tel" placeholder="10-digit mobile number" {...fp('mobile', true)}/>{fe('mobile')}</label>
                  <label>Email Address <small>Optional</small><input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} autoComplete="email" {...fp('email')}/>{fe('email')}</label>
                  <label>Enquiry Type <span>*</span><select value={form.type} onChange={e => updateForm('type', e.target.value)} {...fp('type', true)}><option value="">Select enquiry type</option>{settings.enquiry.types.map(type => <option key={type}>{type}</option>)}</select>{fe('type')}</label>
                  <label>Product Name <small>Optional</small><input value={form.product} onChange={e => updateForm('product', e.target.value)}/></label>
                  <label>Quantity <small>Optional</small><input type="number" inputMode="numeric" min="1" value={form.quantity} onChange={e => updateForm('quantity', e.target.value)}/></label>
                </div>
                <fieldset><legend>Preferred Contact Method <span>*</span></legend><div className="radio-row">{settings.enquiry.contactMethods.map(method => <label key={method}><input type="radio" name="contact-method" value={method} checked={form.contact === method} onChange={e => updateForm('contact', e.target.value)}/><span>{method}</span></label>)}</div></fieldset>
                <label className="message-label">Message <span>*</span><textarea rows={4} value={form.message} onChange={e => updateForm('message', e.target.value)} {...fp('message', true)}/>{fe('message')}</label>
                <label className="consent"><input type="checkbox" checked={form.consent} onChange={e => updateForm('consent', e.target.checked)} {...fp('consent', true)}/><span>I agree to be contacted about this enquiry.</span></label>
                {errors.consent && <small id="err-consent" className="field-error consent-error">{errors.consent}</small>}
                <button className="button submit-button" type="submit" disabled={submitting} aria-busy={submitting}><Icon name="whatsapp"/>{submitting ? 'Preparing enquiry…' : 'Send Enquiry on WhatsApp'}</button>
                <p className="form-instruction">WhatsApp will open with your enquiry ready to send. Please tap Send to submit it to our shop.</p>
                {formStatus && <div className={formStatus.startsWith('Your') ? 'form-status success' : 'form-status'} role={formStatus.startsWith('Your') ? 'status' : 'alert'}>{formStatus}</div>}
              </form>
            </div>
          </div>
        </section>

        <section className="policies shell section" id="contact">
          <div className="section-head"><div><p className="eyebrow">GOOD TO KNOW</p><h2>Clear, simple,<br/><em>and transparent.</em></h2></div></div>
          <div className="policies-body">
            {settings.payment && <PaymentCard payment={settings.payment}/>}
            <div className="policy-list">{settings.policies.map((p, i) => <details key={p.title}><summary><span>{String(i + 1).padStart(2, '0')}</span>{p.title}<b>+</b></summary><p>{p.content}</p></details>)}</div>
          </div>
        </section>
      </main>

      <footer>
        <div className="shell footer-grid">
          <div><a className="brand footer-brand" href="#home"><span>Fins <i>&</i> Wings</span><small>{settings.shop.subtitle}</small></a><h2>Made for the little lives<br/>that make life <em>bigger.</em></h2></div>
          <div><small>EXPLORE</small>{settings.nav.map(n => <a key={n.label} href={`#${n.target}`}>{n.label}</a>)}</div>
          <div><small>VISIT</small><p>{settings.shop.address}</p><p>{settings.shop.hours}</p><a href={settings.shop.mapsUrl} target="_blank" rel="noreferrer">Open in Google Maps</a></div>
          <div><small>LET’S TALK</small><a className="footer-phone" href={`tel:${settings.shop.phone}`}>{settings.shop.phone}</a><a className="button lime" href={wa('Hello Fins & Wings, I’d like to enquire.')} target="_blank" rel="noreferrer"><Icon name="whatsapp"/>WhatsApp us</a></div>
        </div>
        <div className="shell footer-bottom"><span>© {new Date().getFullYear()} Fins & Wings. All rights reserved.</span><div><a href="#contact">Terms</a><a href="#contact">Privacy</a></div><span>Selaiyur · Chennai</span></div>
      </footer>
      <a className="mobile-wa" href={wa('Hello Fins & Wings, I’d like to enquire.')} target="_blank" rel="noreferrer" aria-label="Enquire on WhatsApp"><Icon name="whatsapp"/></a>
    </>
  )
}
