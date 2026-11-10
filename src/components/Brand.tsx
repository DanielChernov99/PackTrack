export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" dir="ltr">
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <rect width="44" height="44" rx="14" fill="currentColor" />
        <path
          d="M9 21a13 13 0 0 1 26 0M9 21q4-5 8 0 5-5 10 0 4-5 8 0M9 21l13 13 13-13M17 21l5 13 5-13"
          fill="none"
          stroke="#d4f487"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!compact && (
        <span>
          Pack<span className="brand-light">Track</span>
          <small>כל קיפול נחשב.</small>
        </span>
      )}
    </div>
  );
}
