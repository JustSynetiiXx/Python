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
          style={{
            color: 'var(--magenta)',
            fontFamily: 'var(--font-code)',
            display: 'inline-block',
            transition: 'transform 0.2s ease',
            transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
          }}
        >
          {'\u25B8'}
        </span>
        <span
          className="text-xs font-semibold tracking-wide uppercase"
          style={{ fontFamily: 'var(--font-hud)', color: 'var(--magenta)' }}
        >
          MISSION
        </span>
        <span className="text-sm flex-1 truncate">{challenge.title}</span>
      </div>

      <div
        className={`mission-body ${collapsed ? 'collapsed' : 'expanded'}`}
      >
        <div
          className="mt-2 text-sm whitespace-pre-line leading-relaxed"
          style={{ fontFamily: 'var(--font-story)' }}
        >
          {challenge.description}
        </div>
      </div>
    </div>
  );
}
