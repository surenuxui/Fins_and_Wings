import { useCallback, useEffect, useRef, useState } from 'react'
import SmartImage from './SmartImage'
import type { Category } from './content'

const Arrow = () => <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5" /></svg>

/** Category cards with previous/next buttons (the row scrolls sideways when there are many categories). */
export default function CategoryScroller({ categories, onPick }: { categories: Category[]; onPick: (id: string) => void }) {
  const row = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ start: true, end: false })
  const update = useCallback(() => {
    const el = row.current; if (!el) return
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 })
  }, [])
  useEffect(() => { update(); window.addEventListener('resize', update); return () => window.removeEventListener('resize', update) }, [update, categories.length])
  const go = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.8, behavior: 'smooth' })
  const scrollable = !(edge.start && edge.end)
  return (
    <>
      {scrollable && <div className="cat-controls">
        <button type="button" className="flip" onClick={() => go(-1)} disabled={edge.start} aria-label="Previous categories"><Arrow /></button>
        <button type="button" onClick={() => go(1)} disabled={edge.end} aria-label="Next categories"><Arrow /></button>
      </div>}
      <div className="category-scroll" ref={row} onScroll={update}>
        {categories.map((c, i) =>
          <button type="button" className="category-card" key={c.id} onClick={() => onPick(c.id)} aria-label={`Show ${c.name}`}>
            <SmartImage sources={c.images} alt="" loading="lazy" /><span><b>{String(i + 1).padStart(2, '0')}</b>{c.name}</span>
          </button>)}
      </div>
    </>
  )
}
