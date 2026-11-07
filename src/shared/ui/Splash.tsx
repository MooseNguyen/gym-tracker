/**
 * The start-up screen from index.html (same markup, styled by the <style> in
 * its <head>), so the hand-over from the static splash to React is seamless.
 */
export function Splash() {
  return (
    <div className="splash" role="status" aria-label="Loading">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
      </svg>
      <div className="splash-bar" />
    </div>
  )
}
