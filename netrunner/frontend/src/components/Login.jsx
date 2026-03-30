import { useState } from 'react';
import { api, setToken } from '../utils/api';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await api.login(password);
      setToken(token);
      onLogin();
    } catch (err) {
      setError('Zugang verweigert.');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4">
      <div className="panel p-6 w-full max-w-sm text-center">
        {/* Logo */}
        <h1
          className="text-3xl font-black tracking-widest mb-1 glow-cyan"
          style={{ fontFamily: 'var(--font-hud)' }}
        >
          NETRUNNER
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>
          JACK IN TO THE NET
        </p>

        {/* Terminal-style prompt */}
        <div className="text-left mb-4 text-sm" style={{ fontFamily: 'var(--font-code)' }}>
          <span style={{ color: 'var(--cyan)' }}>SYSTEM&gt;</span>{' '}
          <span>Authentifizierung erforderlich</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: 'var(--cyan)', fontFamily: 'var(--font-code)' }}
            >
              &gt;
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort eingeben..."
              autoFocus
              className="w-full pl-8 pr-4 py-3 rounded text-base outline-none"
              style={{
                background: '#0d0d18',
                border: '1px solid var(--panel-border)',
                color: 'var(--cyan)',
                fontFamily: 'var(--font-code)',
                caretColor: 'var(--cyan)',
              }}
            />
          </div>

          {error && (
            <p className="text-sm mb-3 glow-red">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="btn-neon w-full disabled:opacity-30"
          >
            {loading ? 'VERBINDE...' : 'JACK IN'}
          </button>
        </form>

        {/* Decorative lines */}
        <div className="mt-6 flex items-center gap-2 justify-center">
          <div className="h-px flex-1" style={{ background: 'var(--panel-border)' }} />
          <span className="text-xs" style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-code)' }}>
            NEXUS CITY // 2087
          </span>
          <div className="h-px flex-1" style={{ background: 'var(--panel-border)' }} />
        </div>
      </div>
    </div>
  );
}
