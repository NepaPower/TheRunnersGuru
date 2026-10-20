import React from 'react';

/** The header every main screen opens with: a dark band carrying a small
 * section label and the page title (plus an optional action button), over a
 * light body with an optional plain-English "insight" line ("3 races on your
 * calendar") and a short subtitle. Styled in styles.css (.rg-ph-*). */
export function PageHeader({
  eyebrow,
  title,
  insight,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: React.ReactNode;
  insight?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="rg-ph">
      <div className="rg-ph-band">
        <div className="rg-ph-heading">
          <div className="rg-ph-eyebrow">{eyebrow}</div>
          <h2 className="rg-ph-title">{title}</h2>
        </div>
        {action && <div className="rg-ph-action">{action}</div>}
      </div>
      {(insight || subtitle) && (
        <div className="rg-ph-body">
          {insight && <div className="rg-ph-insight">{insight}</div>}
          {subtitle && <p className="rg-ph-subtitle">{subtitle}</p>}
        </div>
      )}
    </header>
  );
}

/** A page's "nothing here yet" state: one headline, one sentence, one
 * action — never a dead end. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rg-ph-empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** A section heading inside a page: bold title, a thin rule running out to a
 * tiny right-aligned status ("LAST 7 DAYS", "3 ROUTES"), and an optional
 * action (a toggle or button) at the far end. */
export function SectionHeader({
  title,
  status,
  action,
}: {
  title: string;
  status?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rg-sh">
      <h3 className="rg-sh-title">{title}</h3>
      <span className="rg-sh-rule" aria-hidden="true" />
      {status && <span className="rg-sh-status">{status}</span>}
      {action && <div className="rg-sh-action">{action}</div>}
    </div>
  );
}
