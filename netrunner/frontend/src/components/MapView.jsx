import { useState, useEffect } from 'react';
import { api } from '../utils/api';

const ALL_DISTRICTS = [
  { id: 'boot_sequence', name: 'Boot Sequence', icon: '\u26A1' },
  { id: 'lower_grid', name: 'Lower Grid', icon: '\u2302' },
  { id: 'neon_bazaar', name: 'Neon Bazaar', icon: '\u2605' },
  { id: 'the_loop', name: 'The Loop', icon: '\u21BB' },
  { id: 'data_haven', name: 'Data Haven', icon: '\u2318' },
  { id: 'function_forge', name: 'Function Forge', icon: '\u2692' },
  { id: 'ghost_sector', name: 'Ghost Sector', icon: '\u2620' },
  { id: 'tower', name: 'Tower', icon: '\u25B2' },
  { id: 'core', name: 'Core', icon: '\u2B22' },
];

export default function MapView() {
  const [unlocked, setUnlocked] = useState([]);

  useEffect(() => {
    api.getMap().then(data => {
      setUnlocked((data.districts || []).map(d => d.district_id));
    });
  }, []);

  return (
    <div className="p-4">
      <h2
        className="text-lg font-bold tracking-wider mb-4 glow-cyan"
        style={{ fontFamily: 'var(--font-hud)' }}
      >
        NEXUS CITY
      </h2>

      <div className="space-y-2">
        {ALL_DISTRICTS.map((district) => {
          const isUnlocked = unlocked.includes(district.id);
          return (
            <div
              key={district.id}
              className="panel px-3 py-2 flex items-center gap-3"
              style={{
                opacity: isUnlocked ? 1 : 0.3,
                borderColor: isUnlocked ? 'var(--panel-border)' : '#ffffff10',
              }}
            >
              <span className="text-lg">{district.icon}</span>
              <div>
                <div
                  className="text-sm font-semibold"
                  style={{
                    fontFamily: 'var(--font-code)',
                    color: isUnlocked ? 'var(--cyan)' : 'var(--text-dim)',
                  }}
                >
                  {district.name}
                </div>
                {!isUnlocked && (
                  <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    [GESPERRT]
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
