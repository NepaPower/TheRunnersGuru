import React from 'react';

interface BlueprintProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
}

/** The Industry system's signature "wireframe object" card: square corners,
 * hairline border, `+` corner registration marks drawn just outside the box.
 * Use for any card-like surface (`.blueprint-card` in app.css adds the
 * standard padding on top of this). */
export function Blueprint({ children, className = '', style, ...rest }: BlueprintProps) {
  return (
    <div className={`blueprint ${className}`} style={style} {...rest}>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      {children}
    </div>
  );
}
