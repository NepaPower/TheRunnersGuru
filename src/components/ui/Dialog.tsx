import React from 'react';

export function Dialog({
  title,
  children,
  actions,
  onDismiss,
}: {
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      className="dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss?.();
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-title">{title}</div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  );
}
