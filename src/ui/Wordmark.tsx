/** Podium wordmark: a lectern glyph lit by a single limelight dot. */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return <span className="wordmark">
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M5 9.5h14l-1.6 2.2H6.6z" fill="currentColor"/>
      <path d="M8.2 12.6h7.6L15 21H9z" fill="currentColor" opacity=".55"/>
      <circle cx="12" cy="4.6" r="2.1" fill="var(--lime)"/>
    </svg>
    {!compact && <span>podium</span>}
  </span>;
}
