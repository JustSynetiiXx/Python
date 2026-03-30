export default function IntrusionAlert({ alert, reviewIndex, totalReviews }) {
  if (!alert) return null;

  return (
    <div className="panel-alert intrusion-alert p-3">
      {/* Alert header */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="alert-icon glow-red text-base"
          style={{ animation: 'alert-icon-pulse 1.5s ease-in-out infinite' }}
        >
          {alert.title?.startsWith('\u26a1') ? '\u26a1' : '\u26a0'}
        </div>
        <div
          className="glow-red text-sm tracking-wider flex-1"
          style={{ fontFamily: 'var(--font-hud)' }}
        >
          {alert.title || 'INTRUSION ALERT'}
        </div>
        {totalReviews > 1 && (
          <span
            className="text-[10px] tracking-wider"
            style={{ fontFamily: 'var(--font-hud)', color: 'var(--text-dim)' }}
          >
            {reviewIndex + 1}/{totalReviews}
          </span>
        )}
      </div>

      {/* Alert message */}
      <p
        className="text-xs mb-2"
        style={{ color: 'var(--red)', opacity: 0.9 }}
      >
        {alert.message}
      </p>

      {/* ECHO prefix / context */}
      {alert.prefix && (
        <p
          className="text-xs"
          style={{
            color: 'var(--text)',
            borderLeft: '2px solid var(--red)',
            paddingLeft: '8px',
            opacity: 0.7,
          }}
        >
          ECHO: {alert.prefix}
        </p>
      )}

      {/* Progress bar */}
      {totalReviews > 1 && (
        <div className="flex gap-1 mt-3">
          {Array.from({ length: totalReviews }).map((_, i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full"
              style={{
                background: i < reviewIndex ? 'var(--success)'
                  : i === reviewIndex ? 'var(--red)' : '#ffffff15',
                boxShadow: i < reviewIndex ? '0 0 4px #00ff8844'
                  : i === reviewIndex ? '0 0 4px #ff004044' : 'none',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
