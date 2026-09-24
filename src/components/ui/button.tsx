import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'accent' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'subtle';
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-sm';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', disabled, children, ...props }, ref) => {
    const variantClasses = {
      default: 'bg-primary text-content border border-border-subtle hover:bg-tertiary shadow-xs',
      accent: 'bg-accent text-white hover:bg-accent-hover shadow-sm font-semibold border border-accent/20',
      secondary: 'bg-secondary text-content border border-border-subtle hover:bg-tertiary hover:border-accent/40',
      outline: 'bg-transparent border border-border-subtle text-content hover:bg-tertiary/60',
      ghost: 'bg-transparent text-content-muted hover:text-content hover:bg-tertiary/50',
      destructive: 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs border border-rose-700/30',
      subtle: 'bg-accent/15 text-accent hover:bg-accent/25 border border-accent/30 font-semibold',
    }[variant];

    const sizeClasses = {
      default: 'h-9 px-4 py-2 text-xs font-medium',
      xs: 'h-7 px-2.5 text-[11px] font-medium',
      sm: 'h-8 px-3 text-xs font-medium',
      lg: 'h-10 px-5 text-sm font-semibold',
      icon: 'h-8 w-8 p-0 flex items-center justify-center',
      'icon-sm': 'h-7 w-7 p-0 flex items-center justify-center text-xs',
    }[size];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-lg transition-all duration-150 cursor-pointer select-none font-sans',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]',
          variantClasses,
          sizeClasses,
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
