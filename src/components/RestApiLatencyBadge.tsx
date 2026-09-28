import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Zap, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Activity, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { 
  parseRestApiConfig, 
  RestApiColumnConfig, 
  useRestApiLatency, 
  pingRestApiEndpoint 
} from '../utils/restApiManager';
import { useI18n } from '../i18n';

interface RestApiLatencyBadgeProps {
  columnId?: string;
  rule?: string;
  config?: RestApiColumnConfig;
  compact?: boolean;
  className?: string;
}

export const RestApiLatencyBadge: React.FC<RestApiLatencyBadgeProps> = ({
  columnId,
  rule,
  config,
  compact = true,
  className = ''
}) => {
  const { t } = useI18n();
  const [isHovered, setIsHovered] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const hasAutoPingedRef = useRef(false);

  const parsedConfig = useMemo(() => {
    if (config) return config;
    return parseRestApiConfig(rule || '');
  }, [config, rule]);

  const stats = useRestApiLatency(columnId, parsedConfig.url);

  // Auto-ping once on mount if no latency stats exist yet and a valid URL is present
  useEffect(() => {
    if (!stats && parsedConfig.url && !hasAutoPingedRef.current) {
      hasAutoPingedRef.current = true;
      pingRestApiEndpoint(parsedConfig, columnId).catch(() => {});
    }
  }, [columnId, parsedConfig.url, stats]);

  const handleRePing = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isPinging || !parsedConfig.url) return;
    setIsPinging(true);
    try {
      await pingRestApiEndpoint(parsedConfig, columnId);
    } catch {
    } finally {
      setIsPinging(false);
    }
  };

  const isPrefetching = stats?.isPrefetching || isPinging;

  // Determine latency rating and styling
  const latencyRating = useMemo(() => {
    if (!stats || isPrefetching) return 'loading';
    if (!stats.success) return 'error';
    const avg = stats.avgLatencyMs;
    if (avg <= 250) return 'fast';
    if (avg <= 750) return 'moderate';
    return 'slow';
  }, [stats, isPrefetching]);

  const colorStyles = useMemo(() => {
    switch (latencyRating) {
      case 'fast':
        return {
          badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15',
          sparkStroke: '#10b981',
          sparkFill: 'rgba(16, 185, 129, 0.18)',
          dot: '#34d399',
          label: t('schema.restApiFast') || 'Fast',
          icon: Zap
        };
      case 'moderate':
        return {
          badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/15',
          sparkStroke: '#f59e0b',
          sparkFill: 'rgba(245, 158, 11, 0.18)',
          dot: '#fbbf24',
          label: t('schema.restApiModerate') || 'Good',
          icon: Clock
        };
      case 'slow':
        return {
          badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/15',
          sparkStroke: '#f43f5e',
          sparkFill: 'rgba(244, 63, 94, 0.18)',
          dot: '#fb7185',
          label: t('schema.restApiSlow') || 'Slow',
          icon: Clock
        };
      case 'error':
        return {
          badge: 'bg-rose-500/15 text-rose-400 border-rose-500/40 hover:bg-rose-500/20',
          sparkStroke: '#f43f5e',
          sparkFill: 'rgba(244, 63, 94, 0.2)',
          dot: '#f43f5e',
          label: 'Error',
          icon: AlertCircle
        };
      default:
        return {
          badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
          sparkStroke: '#38bdf8',
          sparkFill: 'rgba(56, 189, 248, 0.15)',
          dot: '#38bdf8',
          label: t('schema.restApiPrefetching') || 'Prefetching...',
          icon: RefreshCw
        };
    }
  }, [latencyRating, t]);

  const IconComponent = colorStyles.icon;

  // Render SVG sparkline
  const renderSparkline = (width = 38, height = 15) => {
    const history = stats?.history || [];
    if (history.length === 0) {
      return (
        <svg width={width} height={height} className="overflow-visible opacity-50">
          <line
            x1="2"
            y1={height / 2}
            x2={width - 2}
            y2={height / 2}
            stroke={colorStyles.sparkStroke}
            strokeWidth="1.2"
            strokeDasharray="2 2"
          />
        </svg>
      );
    }

    if (history.length === 1) {
      const cy = height / 2;
      return (
        <svg width={width} height={height} className="overflow-visible">
          <line
            x1="2"
            y1={cy}
            x2={width - 2}
            y2={cy}
            stroke={colorStyles.sparkStroke}
            strokeWidth="1.2"
            strokeOpacity="0.4"
          />
          <circle cx={width / 2} cy={cy} r="2.5" fill={colorStyles.dot} />
        </svg>
      );
    }

    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;

    const points = history.map((val, idx) => {
      const x = 2 + (idx / (history.length - 1)) * (width - 4);
      // Invert y: lower latency is higher on the graph (better performance)
      const normalized = (val - min) / range;
      const y = height - 3 - (1 - normalized) * (height - 6);
      return { x, y, val };
    });

    const pathD = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
    const lastPoint = points[points.length - 1];

    return (
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={`grad-${columnId || 'api'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorStyles.sparkStroke} stopOpacity="0.3" />
            <stop offset="100%" stopColor={colorStyles.sparkStroke} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#grad-${columnId || 'api'})`} />
        <path
          d={pathD}
          fill="none"
          stroke={colorStyles.sparkStroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={lastPoint.x} cy={lastPoint.y} r="2" fill={colorStyles.dot} />
      </svg>
    );
  };

  // Human readable time ago
  const timeAgo = useMemo(() => {
    if (!stats?.lastPrefetchedAt) return null;
    const diffSec = Math.round((Date.now() - stats.lastPrefetchedAt) / 1000);
    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.round(diffSec / 60);
    return `${diffMin}m ago`;
  }, [stats?.lastPrefetchedAt]);

  // If currently prefetching with no history yet
  if (isPrefetching && (!stats || stats.history.length === 0)) {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono border transition-all select-none ${colorStyles.badge} ${className}`}
        title="Prefetching REST API live latency..."
      >
        <RefreshCw size={11} className="animate-spin text-sky-400" />
        <span className="text-[10px] font-semibold tracking-tight">Prefetching...</span>
      </div>
    );
  }

  return (
    <div 
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Compact Column Header Latency Pill & Sparkline */}
      <button
        type="button"
        onClick={handleRePing}
        disabled={isPinging}
        className={`group flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono border transition-all cursor-pointer shadow-2xs select-none ${colorStyles.badge}`}
        title={`Click to re-test latency: ${stats ? `${stats.avgLatencyMs}ms avg (${stats.sampleCount} batch samples)` : 'Test endpoint'}`}
      >
        <IconComponent 
          size={11} 
          className={`flex-shrink-0 ${isPinging ? 'animate-spin' : ''}`} 
        />
        
        {stats ? (
          <span className="font-bold tracking-tight">
            {stats.success ? `${stats.avgLatencyMs}ms` : 'Error'}
          </span>
        ) : (
          <span className="font-semibold text-[10px]">Ping</span>
        )}

        {/* Small Sparkline */}
        <div className="flex items-center pl-0.5 pr-0.5 py-0.5">
          {renderSparkline(34, 13)}
        </div>
      </button>

      {/* Rich Interactive Tooltip / Popover on Hover */}
      {isHovered && stats && (
        <div 
          className="absolute left-0 top-full mt-1.5 z-50 w-64 p-3 bg-secondary border border-border-subtle rounded-xl shadow-xl backdrop-blur-md text-content text-xs animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <div className="flex items-center gap-1.5 font-semibold text-accent">
              <Activity size={13} className="text-accent" />
              <span>{t('schema.restApiBatchPrefetch') || 'Batch Prefetch Latency'}</span>
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${colorStyles.badge}`}>
              {colorStyles.label}
            </span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 my-2.5">
            <div className="bg-primary/80 p-2 rounded-lg border border-border-subtle">
              <span className="text-[10px] text-content-muted block uppercase tracking-wider font-semibold">
                {t('schema.restApiAvgLatency') || 'Avg Response'}
              </span>
              <span className="text-base font-mono font-bold text-accent">
                {stats.avgLatencyMs} <span className="text-[10px] text-content-muted font-normal">ms</span>
              </span>
            </div>

            <div className="bg-primary/80 p-2 rounded-lg border border-border-subtle">
              <span className="text-[10px] text-content-muted block uppercase tracking-wider font-semibold">
                Last Request
              </span>
              <span className="text-base font-mono font-bold text-content">
                {stats.lastLatencyMs} <span className="text-[10px] text-content-muted font-normal">ms</span>
              </span>
            </div>
          </div>

          {/* Trend & History */}
          <div className="bg-primary/50 p-2 rounded-lg border border-border-subtle mb-2.5">
            <div className="flex items-center justify-between mb-1 text-[10px] text-content-muted font-mono">
              <span>Min: {stats.minLatencyMs}ms</span>
              <span>History ({stats.history.length} samples)</span>
              <span>Max: {stats.maxLatencyMs}ms</span>
            </div>
            <div className="flex justify-center py-1">
              {renderSparkline(180, 26)}
            </div>
          </div>

          {/* Meta & Status */}
          <div className="flex flex-col gap-1 text-[11px] text-content-muted mb-3 font-mono">
            <div className="flex items-center justify-between">
              <span>Status:</span>
              <span className={`font-semibold ${stats.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.success ? `HTTP ${stats.status || 200} OK` : stats.error || 'Fetch failed'}
              </span>
            </div>
            {timeAgo && (
              <div className="flex items-center justify-between">
                <span>Last prefetch:</span>
                <span className="text-content">{timeAgo}</span>
              </div>
            )}
            <div className="flex items-center justify-between truncate" title={parsedConfig.url}>
              <span>Endpoint:</span>
              <span className="text-content truncate max-w-[140px]">{parsedConfig.url}</span>
            </div>
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={handleRePing}
            disabled={isPinging}
            className="w-full py-1.5 px-2 bg-primary hover:bg-tertiary border border-border-subtle hover:border-accent/40 rounded-lg text-accent font-semibold flex items-center justify-center gap-1.5 transition text-xs cursor-pointer active:scale-98"
          >
            <RefreshCw size={12} className={isPinging ? 'animate-spin text-accent' : ''} />
            <span>{isPinging ? 'Testing connection...' : (t('schema.restApiRePing') || 'Re-test Latency Ping')}</span>
          </button>
        </div>
      )}
    </div>
  );
};
