'use client';

export default function EmptyState({
  icon = '📭',
  title = 'No records found',
  description = 'There is no data to display right now.',
  actionText = '',
  onAction = null,
}) {
  return (
    <div className="glass-card flex flex-col items-center justify-center text-center p-12 max-w-lg mx-auto my-8 animate-fade-up">
      <div className="text-5xl mb-4 select-none animate-float">{icon}</div>
      <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm leading-relaxed">{description}</p>
      {actionText && onAction && (
        <button onClick={onAction} className="btn btn-primary btn-md">
          {actionText}
        </button>
      )}
    </div>
  );
}
