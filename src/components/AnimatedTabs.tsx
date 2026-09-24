import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
  title?: string;
}

export interface AnimatedTabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  layoutId?: string;
  variant?: 'pill' | 'chip' | 'underline' | 'segmented';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  fullWidth?: boolean;
}

export function AnimatedTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  layoutId,
  variant = 'pill',
  size = 'sm',
  className = '',
  fullWidth = false,
}: AnimatedTabsProps<T>) {
  const autoId = React.useId();
  const activeLayoutId = layoutId || `tabs-${variant}-${autoId}`;

  const sizeClasses = {
    xs: 'px-2.5 py-1 text-[11px] gap-1.5',
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-xs sm:text-sm gap-2',
    lg: 'px-4 py-2.5 text-sm gap-2.5',
  }[size];

  // Underline variant
  if (variant === 'underline') {
    return (
      <div
        role="tablist"
        className={cn('flex items-center gap-4 border-b border-border-subtle', className)}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <motion.button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && onChange(tab.id)}
              whileTap={!tab.disabled ? { scale: 0.96 } : undefined}
              whileHover={!tab.disabled && !isActive ? { opacity: 0.9 } : undefined}
              title={tab.title}
              className={cn(
                'relative pb-2 font-semibold flex items-center transition-colors cursor-pointer select-none',
                sizeClasses,
                tab.disabled
                  ? 'opacity-40 cursor-not-allowed text-content-muted'
                  : isActive
                  ? 'text-accent font-bold'
                  : 'text-content-muted hover:text-content'
              )}
            >
              {tab.icon && <span className="flex-shrink-0 relative z-10">{tab.icon}</span>}
              <span className="relative z-10">{tab.label}</span>
              {tab.badge !== undefined && (
                <motion.span
                  key={String(tab.badge)}
                  initial={{ scale: 0.85 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className={cn(
                    'relative z-10 text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors font-bold',
                    isActive ? 'bg-accent text-white' : 'bg-primary text-content-muted border border-border-subtle/50'
                  )}
                >
                  {tab.badge}
                </motion.span>
              )}
              {isActive && (
                <motion.div
                  layoutId={activeLayoutId}
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full shadow-xs"
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 35,
                    mass: 0.7,
                  }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    );
  }

  // Chip variant
  if (variant === 'chip') {
    return (
      <div
        role="tablist"
        className={cn('flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5', className)}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <motion.button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && onChange(tab.id)}
              whileTap={!tab.disabled ? { scale: 0.95 } : undefined}
              whileHover={!tab.disabled && !isActive ? { scale: 1.02 } : undefined}
              title={tab.title}
              className={cn(
                'relative rounded-lg font-semibold flex items-center transition-colors cursor-pointer select-none whitespace-nowrap border',
                sizeClasses,
                tab.disabled
                  ? 'opacity-40 cursor-not-allowed border-transparent text-content-muted'
                  : isActive
                  ? 'text-white border-accent shadow-sm font-bold'
                  : 'text-content-muted hover:text-content hover:bg-tertiary/70 border-border-subtle bg-primary/70'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId={activeLayoutId}
                  className="absolute inset-0 bg-accent rounded-lg z-0 shadow-sm"
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 35,
                    mass: 0.7,
                  }}
                />
              )}
              {tab.icon && <span className="flex-shrink-0 relative z-10">{tab.icon}</span>}
              <span className="relative z-10">{tab.label}</span>
              {tab.badge !== undefined && (
                <motion.span
                  key={String(tab.badge)}
                  initial={{ scale: 0.85 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className={cn(
                    'relative z-10 text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors font-bold',
                    isActive ? 'bg-black/20 text-white' : 'bg-secondary text-content-muted border border-border-subtle/40'
                  )}
                >
                  {tab.badge}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    );
  }

  // Pill / Segmented variant
  return (
    <div
      role="tablist"
      className={cn(
        'relative flex items-center bg-primary/95 border border-border-subtle p-1 rounded-xl gap-1 shadow-inner backdrop-blur-xs transition-colors duration-200',
        fullWidth && 'w-full',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <motion.button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            whileTap={!tab.disabled ? { scale: 0.95 } : undefined}
            whileHover={!tab.disabled && !isActive ? { scale: 1.02 } : undefined}
            transition={{ duration: 0.12 }}
            title={tab.title}
            className={cn(
              'relative flex items-center justify-center font-semibold rounded-lg transition-colors cursor-pointer select-none whitespace-nowrap',
              fullWidth && 'flex-1',
              sizeClasses,
              tab.disabled
                ? 'opacity-40 cursor-not-allowed text-content-muted'
                : isActive
                ? 'text-white font-bold'
                : 'text-content-muted hover:text-content hover:bg-tertiary/50'
            )}
          >
            {isActive && (
              <motion.div
                layoutId={activeLayoutId}
                className="absolute inset-0 bg-accent rounded-lg shadow-sm z-0"
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 35,
                  mass: 0.7,
                }}
              />
            )}
            {tab.icon && <span className="relative z-10 flex-shrink-0">{tab.icon}</span>}
            <span className="relative z-10">{tab.label}</span>
            {tab.badge !== undefined && (
              <motion.span
                key={String(tab.badge)}
                initial={{ scale: 0.85 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={cn(
                  'relative z-10 text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors font-bold',
                  isActive ? 'bg-black/20 text-white' : 'bg-secondary text-content-muted border border-border-subtle/50'
                )}
              >
                {tab.badge}
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
