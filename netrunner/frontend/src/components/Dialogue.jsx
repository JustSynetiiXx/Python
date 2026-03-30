export default function Dialogue({ message, type = 'info' }) {
  if (!message) return null;

  const colorClass = {
    success: 'glow-success',
    error: 'glow-red',
    hint: 'glow-cyan',
    info: 'glow-cyan',
  }[type] || 'glow-cyan';

  const borderColor = {
    success: '#00ff8844',
    error: '#ff004044',
    hint: 'var(--panel-border)',
    info: 'var(--panel-border)',
  }[type] || 'var(--panel-border)';

  return (
    <div
      key={message}
      className="panel dialogue-enter px-3 py-2 text-sm"
      style={{
        fontFamily: 'var(--font-story)',
        borderColor,
      }}
    >
      <span className={`font-semibold ${colorClass}`}>ECHO: </span>
      <span>{message}</span>
    </div>
  );
}
