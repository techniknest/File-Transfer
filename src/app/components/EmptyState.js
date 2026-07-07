'use client';

import { Inbox } from 'lucide-react';

export default function EmptyState({
  icon = <Inbox size={48} className="text-gray-400" />,
  title = 'No data available',
  description = 'There is nothing to show here yet.',
  actionText = '',
  onAction = null,
}) {
  return (
    <div className="glass-card flex flex-col items-center justify-center text-center p-12 max-w-lg mx-auto my-8 animate-fade-up">
      <div className="mb-4 select-none animate-float">{icon}</div>
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
