import { useEffect, useRef, useState } from 'react'
import { imageSources } from './images'
import type { Settings } from './content'

type Payment = NonNullable<Settings['payment']>

/** "Scan to pay" card. Shows the shop's own UPI QR picture (public/images/payment/), a bigger view for easy
 *  scanning, a copy-UPI-ID button and – on phones – a button that opens the customer's UPI app. */
export default function PaymentCard({ payment }: { payment: Payment }) {
  const sources = imageSources('payment', payment.qrImage, 'payment-qr').slice(0, -1) // no placeholder: a missing QR shows a message instead
  const [k, setK] = useState(0)
  const [missing, setMissing] = useState(false)
  const [copied, setCopied] = useState<'' | 'ok' | 'fail'>('')
  const dialog = useRef<HTMLDialogElement>(null)
  const timer = useRef<number>(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const upi = payment.upiId.trim()
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const upiLink = upi ? `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(payment.payeeName)}&cu=INR` : ''
  const src = sources[Math.min(k, sources.length - 1)]

  async function copy() {
    try { await navigator.clipboard.writeText(upi); setCopied('ok') } catch { setCopied('fail') }
    window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setCopied(''), 2500)
  }

  return (
    <aside className="pay-card" aria-labelledby="pay-title">
      <p className="eyebrow light">{payment.eyebrow}</p>
      <h3 id="pay-title">{payment.title}</h3>
      <p>{payment.copy}</p>

      {!missing
        ? <button type="button" className="pay-qr" onClick={() => dialog.current?.showModal()} aria-label="Enlarge payment QR code">
            <img src={src} alt={`UPI payment QR code for ${payment.payeeName}`}
              onError={() => (k < sources.length - 1 ? setK(k + 1) : setMissing(true))} />
          </button>
        : <div className="pay-qr-empty" role="status">The payment QR code is coming soon. Please pay at the shop or ask us on WhatsApp.</div>}

      {(payment.payeeName || upi) && <div className="pay-meta">
        {payment.payeeName && <div><small>Pay to</small><strong>{payment.payeeName}</strong></div>}
        {upi && <div><small>UPI ID</small><strong>{upi}</strong></div>}
      </div>}

      <div className="pay-actions">
        {upi && <button type="button" className="button lime" onClick={copy}>{copied === 'ok' ? '✓ Copied' : 'Copy UPI ID'}</button>}
        {upi && touch && <a className="button pay-ghost" href={upiLink}>Open UPI app</a>}
        {!missing && <a className="button pay-ghost" href={src} download="fins-and-wings-payment-qr">Save QR</a>}
      </div>
      <p className="pay-note" aria-live="polite">{copied === 'fail' ? 'Could not copy. Please type the UPI ID shown above.' : payment.note}</p>

      <dialog ref={dialog} className="pay-dialog" aria-label="Payment QR code"
        onClick={e => { if (e.target === dialog.current) dialog.current?.close() }}>
        {!missing && <img src={src} alt={`Large UPI payment QR code for ${payment.payeeName}`} />}
        <p>Open any UPI app, tap Scan, and point your camera here.</p>
        <button type="button" className="button" onClick={() => dialog.current?.close()}>Close</button>
      </dialog>
    </aside>
  )
}
