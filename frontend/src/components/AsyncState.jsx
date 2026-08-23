import GlassCard from './GlassCard';

export function ErrorState({ message, onRetry, className = '' }) {
  return (
    <GlassCard className={`p-6 text-center ${className}`}>
      <p className="text-sm text-red-200">{message}</p>
      {onRetry ? (
        <button onClick={onRetry} className="sg-button-secondary mt-4 px-4 py-2">
          Retry
        </button>
      ) : null}
    </GlassCard>
  );
}

export function EmptyState({ message, className = '' }) {
  return (
    <GlassCard className={`p-8 text-center text-sm text-muted ${className}`}>
      {message}
    </GlassCard>
  );
}
