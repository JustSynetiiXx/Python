export default function Dialogue({ message, type = 'info' }) {
  if (!message) return null;

  const colorClass = {
    success: 'glow-success',
    error: 'glow-red',
    hint: 'glow-cyan',
    info: 'glow-cyan',
  }[type] || 'glow-cyan';

  return (
    <div
      className="panel px-3 py-2 text-sm"
      style={{ fontFamily: 'var(--font-story)' }}
    >
      <span className={`font-semibold ${colorClass}`}>ECHO: </span>
      <span>{message}</span>
    </div>
  );
}
