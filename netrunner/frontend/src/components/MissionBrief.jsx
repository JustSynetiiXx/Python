import { useState } from 'react';

export default function MissionBrief({ challenge }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!challenge) return null;

  return (
    <div
      className="panel px-3 py-2 cursor-pointer"
      onClick={() => setCollapsed(!collapsed)}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-xs"
          style={{ color: 'var(--magenta)', fontFamily: 'var(--font-code)' }}
        >
          {collapsed ? '\u25B8' : '\u25BE'}
        </span>
        <span
          className="text-xs font-semibold tracking-wide uppercase"
          style={{ fontFamily: 'var(--font-hud)', color: 'var(--magenta)' }}
        >
          MISSION
        </span>
        <span className="text-sm flex-1 truncate">{challenge.title}</span>
      </div>

      {!collapsed && (
        <div className="mt-2 text-sm whitespace-pre-line leading-relaxed"
          style={{ fontFamily: 'var(--font-story)' }}
        >
          {challenge.description}
        </div>
      )}
    </div>
  );
}
