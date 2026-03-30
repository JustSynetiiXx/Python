export default function HUD({ player, onMenuClick }) {
  if (!player) return null;

  const hpPct = Math.max(0, Math.min(100, player.hp));
  const xpPct = player.xp_to_next_level > 0
    ? Math.min(100, (player.xp / player.xp_to_next_level) * 100)
    : 0;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2"
      style={{
        background: 'var(--panel)',
        borderBottom: '1px solid var(--panel-border)',
        fontFamily: 'var(--font-hud)',
        paddingTop: 'max(8px, env(safe-area-inset-top, 8px))',
      }}
    >
      {/* Hamburger */}
      <button
        onClick={onMenuClick}
        className="text-lg p-1"
        style={{ color: 'var(--cyan)' }}
        aria-label="Menu"
      >
        &#9776;
      </button>

      {/* HP bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-[10px] glow-red">HP</span>
          <div className="bar-track flex-1">
            <div className="bar-fill bar-hp" style={{ width: `${hpPct}%` }} />
          </div>
        </div>

        {/* XP bar */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] glow-cyan">XP</span>
          <div className="bar-track flex-1">
            <div className="bar-fill bar-xp" style={{ width: `${xpPct}%` }} />
          </div>
        </div>
      </div>

      {/* Level */}
      <div className="text-center px-1">
        <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>LV</div>
        <div className="text-sm font-bold glow-cyan">{player.level}</div>
      </div>

      {/* Streak */}
      {player.streak > 0 && (
        <div className="text-center px-1">
          <div className="text-sm glow-magenta">
            <span className="text-[10px] streak-flame">&#x1F525;</span>{player.streak}
          </div>
        </div>
      )}
    </div>
  );
}
