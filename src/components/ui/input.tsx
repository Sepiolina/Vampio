import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, ...props }, ref) => {
    if (icon) {
      return (
        <div className="relative flex items-center w-full">
          <span className="absolute left-2.5 text-content-muted pointer-events-none flex items-center justify-center">
            {icon}
          </span>
          <input
            type={type}
            className={cn(
              'flex h-8 w-full rounded-lg border border-border-subtle bg-primary pl-8 pr-3 py-1.5 text-xs text-content shadow-xs transition-colors',
              'placeholder:text-content-muted/60 focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent',
              'disabled:cursor-not-allowed disabled:opacity-50',
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          'flex h-8 w-full rounded-lg border border-border-subtle bg-primary px-3 py-1.5 text-xs text-content shadow-xs transition-colors',
          'placeholder:text-content-muted/60 focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
