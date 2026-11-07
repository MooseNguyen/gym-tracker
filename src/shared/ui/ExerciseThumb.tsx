import { useState } from 'react'
import { exerciseImageUrl } from './exerciseImage'

interface Props {
  imagePath: string | null | undefined
  name: string
  size?: number
  /** Next to the exercise name (e.g. inside a button): empty alt, so it is not read twice. */
  decorative?: boolean
}

/**
 * Exercise photo with a fixed box (width/height set up front, so nothing shifts
 * when it loads) and lazy loading. Custom exercises have no image, and a missing
 * file falls back to the same placeholder instead of a broken-image icon.
 */
export function ExerciseThumb({ imagePath, name, size = 48, decorative = false }: Props) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size }

  if (!imagePath || failed) {
    return (
      <span className="thumb placeholder" style={style} aria-hidden="true">
        {/* Dumbbell glyph */}
        <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="currentColor">
          <rect x="1" y="10" width="2" height="4" rx="1" />
          <rect x="3.5" y="7" width="3" height="10" rx="1" />
          <rect x="6.5" y="11" width="11" height="2" />
          <rect x="17.5" y="7" width="3" height="10" rx="1" />
          <rect x="21" y="10" width="2" height="4" rx="1" />
        </svg>
      </span>
    )
  }

  return (
    <img
      className="thumb"
      src={exerciseImageUrl(imagePath)}
      alt={decorative ? '' : `${name} demonstration`}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
