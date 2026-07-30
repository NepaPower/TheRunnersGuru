import React from 'react';

export function Field({
  label,
  required,
  optional,
  hint,
  children,
  style,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="field" style={style}>
      <label>
        {label} {required && <span style={{ color: 'var(--color-accent-700)' }}>*</span>}
        {optional && <span className="text-muted">(optional)</span>}
      </label>
      {children}
      {hint && (
        <div className="text-muted" style={{ marginTop: 6, fontSize: 13 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...rest }, ref) => <input ref={ref} className={`input ${className}`} {...rest} />,
);
Input.displayName = 'Input';

export function Select({
  className = '',
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`input ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function TextArea({ className = '', ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input ${className}`} {...rest} />;
}

export function RadioOption({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
}) {
  return (
    <label className="radio">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span className="dot" />
      <span>{label}</span>
    </label>
  );
}

export function SegOption({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
}) {
  return (
    <label className="seg-opt">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

export function Tag({ children, kind = 'neutral' }: { children: React.ReactNode; kind?: 'accent' | 'accent-2' | 'neutral' | 'outline' }) {
  return <span className={`tag tag-${kind}`}>{children}</span>;
}
