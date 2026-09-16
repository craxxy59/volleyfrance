export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div className="skeleton" key={i} style={{ height: 88 + (i % 2) * 12 }} />
      ))}
    </>
  )
}

export function EmptyState({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="empty">
      <div style={{ fontSize: 36, marginBottom: 8 }}>🏐</div>
      <h3>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-box">
      <h3>Oups</h3>
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          className="chip active"
          style={{ marginTop: 14 }}
          onClick={onRetry}
        >
          Réessayer
        </button>
      )}
    </div>
  )
}
