/**
 * Loading and empty states.
 *
 * DESIGN.md treats these as first-class: the previous build shipped a bare
 * "Loading cases…" string and a dashed empty box, which are exactly the moments
 * a judge sees when they click faster than the data arrives. Skeletons shimmer
 * in brand tones and empty states name the surface and the next action.
 */

export function SkeletonCard({ className = '' }) {
  return <div className={`skeleton skeleton-card ${className}`} aria-hidden="true" />;
}

export function SkeletonList({ rows = 4 }) {
  return (
    <div role="status" aria-label="Loading Cases">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonBlock({ lines = 3 }) {
  const widths = ['w-70', 'w-40', 'w-70', 'w-40'];
  return (
    <div role="status" aria-label="Loading content">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`skeleton skeleton-line ${widths[i % widths.length]}`} aria-hidden="true" />
      ))}
    </div>
  );
}

export function EmptyState({ icon = '◌', title, hint, children }) {
  return (
    <div className="empty">
      <div style={{ fontSize: 22, marginBottom: 8, opacity: 0.6 }} aria-hidden="true">
        {icon}
      </div>
      {title && (
        <div style={{ color: 'var(--text-mid)', fontWeight: 650, marginBottom: 4 }}>{title}</div>
      )}
      {hint && <div style={{ fontSize: 'var(--t-label)' }}>{hint}</div>}
      {children}
    </div>
  );
}

export default SkeletonList;
