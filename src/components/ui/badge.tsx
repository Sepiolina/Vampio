import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'accent' | 'success' | 'warning' | 'destructive' | 'muted';
  size?: 'xs' | 'sm' | 'default';
  className?: string;
  children?: React.ReactNode;
}

export function Badge({
  className,
  variant = 'default',
  size = 'default',
  children,
  ...props
}: BadgeProps) {
  const variantClasses = {
    default: 'bg-primary text-content border border-border-subtle',
    secondary: 'bg-secondary text-content-muted border border-border-subtle/50',
    outline: 'bg-transparent text-content-muted border border-border-subtle',
    accent: 'bg-accent text-white font-semibold shadow-xs',
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-medium',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-medium',
    destructive: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-medium',
    muted: 'bg-tertiary text-content-muted border border-border-subtle/40',
  }[variant];

  const sizeClasses = {
    xs: 'px-1.5 py-0.2 text-[10px] rounded-md font-mono',
    sm: 'px-2 py-0.5 text-[11px] rounded-md',
    default: 'px-2.5 py-0.5 text-xs rounded-lg',
  }[size];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-sans transition-colors select-none font-medium',
        variantClasses,
        sizeClasses,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
