import React, { createContext, useContext, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
  variant: 'pill' | 'chip' | 'underline' | 'segmented';
  size: 'xs' | 'sm' | 'md' | 'lg';
  tabsId: string;
}

const TabsContext = createContext<TabsContextType | null>(null);

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  defaultValue?: string;
  variant?: 'pill' | 'chip' | 'underline' | 'segmented';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
  id?: string;
}

export function Tabs({
  value,
  onValueChange,
  variant = 'pill',
  size = 'sm',
  className,
  children,
  id,
}: TabsProps) {
  const generatedId = useId();
  const tabsId = id || generatedId;

  return (
    <TabsContext.Provider value={{ value, onValueChange, variant, size, tabsId }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps {
  className?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}

export function TabsList({ className, children, fullWidth = false }: TabsListProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabsList must be used within Tabs');

  const variantClasses = {
    pill: 'bg-primary/95 border border-border-subtle p-1 rounded-xl gap-1 shadow-inner',
    segmented: 'bg-tertiary/70 border border-border-subtle p-1 rounded-xl gap-1',
    chip: 'bg-transparent gap-1.5 overflow-x-auto no-scrollbar py-0.5',
    underline: 'bg-transparent border-b border-border-subtle gap-4 px-1',
  }[ctx.variant];

  return (
    <div
      role="tablist"
      className={cn(
        'relative inline-flex items-center',
        fullWidth && 'w-full',
        variantClasses,
        className
      )}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps {
  value: string;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
  badge?: string | number;
  title?: string;
  children: React.ReactNode;
}

export function TabsTrigger({
  value,
  disabled = false,
  className,
  icon,
  badge,
  title,
  children,
}: TabsTriggerProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabsTrigger must be used within Tabs');

  const isActive = ctx.value === value;

  const sizeClasses = {
    xs: 'px-2.5 py-1 text-[11px] gap-1.5',
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-xs sm:text-sm gap-2',
    lg: 'px-4 py-2.5 text-sm gap-2.5',
  }[ctx.size];

  if (ctx.variant === 'underline') {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        disabled={disabled}
        onClick={() => !disabled && ctx.onValueChange(value)}
        title={title}
        className={cn(
          'relative pb-2 font-semibold flex items-center transition-colors cursor-pointer select-none',
          sizeClasses,
          disabled
            ? 'opacity-40 cursor-not-allowed text-content-muted'
            : isActive
            ? 'text-accent font-bold'
            : 'text-content-muted hover:text-content',
          className
        )}
      >
        {icon && <span className="flex-shrink-0 relative z-10">{icon}</span>}
        <span className="relative z-10">{children}</span>
        {badge !== undefined && (
          <span
            className={cn(
              'relative z-10 text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors font-bold',
              isActive
                ? 'bg-accent text-white'
                : 'bg-primary text-content-muted border border-border-subtle/60'
            )}
          >
            {badge}
          </span>
        )}
        {isActive && (
          <motion.div
            layoutId={`${ctx.tabsId}-underline`}
            className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full shadow-xs"
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
          />
        )}
      </button>
    );
  }

  if (ctx.variant === 'chip') {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        disabled={disabled}
        onClick={() => !disabled && ctx.onValueChange(value)}
        title={title}
        className={cn(
          'relative rounded-lg font-semibold flex items-center transition-colors cursor-pointer select-none whitespace-nowrap border',
          sizeClasses,
          disabled
            ? 'opacity-40 cursor-not-allowed border-transparent text-content-muted'
            : isActive
            ? 'text-white border-accent shadow-sm font-bold'
            : 'text-content-muted hover:text-content hover:bg-tertiary/70 border-border-subtle bg-primary/70',
          className
        )}
      >
        {isActive && (
          <motion.div
            layoutId={`${ctx.tabsId}-chip-indicator`}
            className="absolute inset-0 bg-accent rounded-lg z-0 shadow-sm"
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
          />
        )}
        {icon && <span className="relative z-10 flex-shrink-0">{icon}</span>}
        <span className="relative z-10">{children}</span>
        {badge !== undefined && (
          <span
            className={cn(
              'relative z-10 text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors font-bold',
              isActive ? 'bg-black/20 text-white' : 'bg-secondary text-content-muted border border-border-subtle/40'
            )}
          >
            {badge}
          </span>
        )}
      </button>
    );
  }

  // 'pill' & 'segmented'
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => !disabled && ctx.onValueChange(value)}
      title={title}
      className={cn(
        'relative flex items-center justify-center font-semibold rounded-lg transition-colors cursor-pointer select-none whitespace-nowrap',
        sizeClasses,
        disabled
          ? 'opacity-40 cursor-not-allowed text-content-muted'
          : isActive
          ? 'text-white font-bold'
          : 'text-content-muted hover:text-content hover:bg-tertiary/40',
        className
      )}
    >
      {isActive && (
        <motion.div
          layoutId={`${ctx.tabsId}-pill-indicator`}
          className="absolute inset-0 bg-accent rounded-lg z-0 shadow-sm"
          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
        />
      )}
      {icon && <span className="relative z-10 flex-shrink-0">{icon}</span>}
      <span className="relative z-10">{children}</span>
      {badge !== undefined && (
        <span
          className={cn(
            'relative z-10 text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors font-bold',
            isActive
              ? 'bg-black/20 text-white'
              : 'bg-secondary text-content-muted border border-border-subtle/50'
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export interface TabsContentProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export function TabsContent({ value, className, children }: TabsContentProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabsContent must be used within Tabs');

  if (ctx.value !== value) return null;

  return (
    <div role="tabpanel" tabIndex={0} className={cn('focus-visible:outline-none', className)}>
      {children}
    </div>
  );
}
