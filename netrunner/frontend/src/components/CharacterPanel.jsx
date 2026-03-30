export default function CharacterPanel({ player }) {
  if (!player) return null;

  return (
    <div className="p-4">
      <h2
        className="text-lg font-bold tracking-wider mb-4 glow-cyan"
        style={{ fontFamily: 'var(--font-hud)' }}
      >
        {player.handle}
      </h2>

      <div className="text-xs mb-3" style={{ color: 'var(--magenta)', fontFamily: 'var(--font-hud)' }}>
        {player.title}
      </div>

      <div className="space-y-3 text-sm" style={{ fontFamily: 'var(--font-code)' }}>
        <div>
          <div className="flex justify-between mb-1">
            <span>Level</span>
            <span className="glow-cyan">{player.level}</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span>HP</span>
            <span className="glow-red">{player.hp}/100</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill bar-hp" style={{ width: `${player.hp}%` }} />
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span>XP</span>
            <span className="glow-cyan">{player.xp}/{player.xp_to_next_level}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill bar-xp"
              style={{ width: `${(player.xp / player.xp_to_next_level) * 100}%` }}
            />
          </div>
        </div>

        <div className="pt-2 border-t" style={{ borderColor: 'var(--panel-border)' }}>
          <div className="text-xs mb-2 uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
            Stats
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>LOGIC</span>
              <span className="glow-cyan">{player.stats.logic}</span>
            </div>
            <div className="flex justify-between">
              <span>MEMORY</span>
              <span className="glow-cyan">{player.stats.memory}</span>
            </div>
            <div className="flex justify-between">
              <span>STEALTH</span>
              <span className="glow-cyan">{player.stats.stealth}</span>
            </div>
          </div>
        </div>

        {player.streak > 0 && (
          <div className="pt-2 border-t" style={{ borderColor: 'var(--panel-border)' }}>
            <div className="flex justify-between">
              <span>Streak</span>
              <span className="glow-magenta">{player.streak} Tage</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
