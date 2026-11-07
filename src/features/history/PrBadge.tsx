/** "🏆 2 PRs": personal records set in a workout. */
export function PrBadge({ count }: { count: number }) {
  return (
    <span className="pr-badge">
      <span aria-hidden="true">🏆</span> {count} {count === 1 ? 'PR' : 'PRs'}
    </span>
  )
}
