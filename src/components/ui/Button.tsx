import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
}

export function Button({ variant = 'secondary', block = false, className = '', ...rest }: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, block ? 'btn-block' : '', className].filter(Boolean).join(' ');
  return <button className={classes} {...rest} />;
}
