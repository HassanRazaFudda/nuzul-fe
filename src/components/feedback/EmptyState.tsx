import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="text-faint mb-3">{icon}</div>}
      <p className="text-foreground text-sm font-medium">{title}</p>
      {hint && <p className="text-muted mt-1 max-w-sm text-[0.8125rem]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
