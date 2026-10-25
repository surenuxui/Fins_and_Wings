import { useState } from 'react'

/** Shows the first image that loads from `sources`; the last entry is always the built-in placeholder. */
export default function SmartImage({ sources, alt, loading }: { sources: string[]; alt: string; loading?: 'lazy' | 'eager' }) {
  const key = sources.join('|')
  const [state, setState] = useState({ key, i: 0 })
  const i = state.key === key ? state.i : 0
  return <img src={sources[Math.min(i, sources.length - 1)]} alt={alt} loading={loading}
    onError={() => { if (i < sources.length - 1) setState({ key, i: i + 1 }) }} />
}
