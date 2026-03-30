import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Inventory() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.getInventory().then(data => setItems(data.items || []));
  }, []);

  return (
    <div className="p-4">
      <h2
        className="text-lg font-bold tracking-wider mb-4 glow-cyan"
        style={{ fontFamily: 'var(--font-hud)' }}
      >
        INVENTAR
      </h2>

      {items.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-code)' }}>
          Keine Scripts gesammelt.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.item_id}
              className="panel p-3"
            >
              <div className="text-sm font-semibold glow-cyan" style={{ fontFamily: 'var(--font-code)' }}>
                {item.name}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                {item.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
