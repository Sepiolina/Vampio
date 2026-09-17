import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { ColumnSpec, ThemeId } from '../types';
import { 
  Activity, 
  ChevronDown, 
  ChevronRight, 
  BarChart2, 
  TrendingUp, 
  PieChart as PieIcon, 
  Grid3X3, 
  ShieldAlert, 
  SlidersHorizontal,
  Radio
} from 'lucide-react';
import { THEME_OPTIONS } from './Header';

export type VizMode = 'heatmap' | 'bar' | 'line' | 'pie' | 'health';
export type WindowSize = 30 | 60 | 100 | 'all';

interface DataHeatmapProps {
  data: Record<string, unknown>[];
  columns: ColumnSpec[];
  theme?: ThemeId;
  isStreaming?: boolean;
}

export const DataHeatmap: React.FC<DataHeatmapProps> = ({ 
  data, 
  columns, 
  theme, 
  isStreaming = false 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [vizMode, setVizMode] = useState<VizMode>('heatmap');
  const [windowSize, setWindowSize] = useState<WindowSize>(30);
  const [selectedColumn, setSelectedColumn] = useState<string>('');

  // Default selected column to the first column or first categorical/numeric column
  useEffect(() => {
    if (columns.length === 0) return;
    if (!selectedColumn || !columns.some(c => c.name === selectedColumn)) {
      // Find a good default: first enum, string, or number
      const preferred = columns.find(c => ['Set/Enum', 'Int', 'Float', 'String', 'Boolean'].includes(c.type));
      setSelectedColumn(preferred ? preferred.name : columns[0].name);
    }
  }, [columns, selectedColumn]);

  // Current active theme colors
  const currentTheme = useMemo(() => {
    return THEME_OPTIONS.find(t => t.id === theme) || THEME_OPTIONS[0];
  }, [theme]);

  // Window the data to prevent streaming/large-dataset layout blowouts and performance freezing
  const displayData = useMemo(() => {
    if (data.length === 0) return [];
    if (windowSize === 'all') {
      // If dataset is extremely large (> 150 rows), take a representative sample of 100 rows
      if (data.length > 120 && (vizMode === 'heatmap' || vizMode === 'line')) {
        const step = Math.ceil(data.length / 80);
        return data.filter((_, idx) => idx % step === 0);
      }
      return data;
    }
    // Return latest N records for real-time streaming insight
    return data.slice(-windowSize);
  }, [data, windowSize, vizMode]);

  // Selected column specification
  const currentColumnSpec = useMemo(() => {
    return columns.find(c => c.name === selectedColumn) || columns[0];
  }, [columns, selectedColumn]);

  // Render the active D3 visualization
  useEffect(() => {
    if (!isExpanded || data.length === 0 || columns.length === 0 || !containerRef.current) return;

    let animFrameId: number;

    const renderVisualization = () => {
      if (!containerRef.current) return;
      const el = containerRef.current;
      d3.select(el).selectAll('*').remove();

      const bgHex = currentTheme.bg;
      const accentHex = currentTheme.accent;
      const isLight = currentTheme.isLight;
      const textColor = isLight ? '#475569' : '#94a3b8';
      const subtleBorderColor = isLight ? '#e2e8f0' : '#1e293b';

      // =========================================================================
      // 1. DENSITY HEATMAP
      // =========================================================================
      if (vizMode === 'heatmap') {
        const margin = { top: 15, right: 20, bottom: 65, left: 45 };
        const containerWidth = el.clientWidth || 700;
        const totalHeight = 240;
        const width = Math.max(containerWidth, columns.length * 52) - margin.left - margin.right;
        const height = totalHeight - margin.top - margin.bottom;

        const svg = d3.select(el)
          .append('svg')
          .attr('width', width + margin.left + margin.right)
          .attr('height', totalHeight)
          .attr('class', 'select-none')
          .append('g')
          .attr('transform', `translate(${margin.left},${margin.top})`);

        // Theme-derived sequential color interpolator
        const themeInterpolator = d3.interpolateHsl(bgHex, accentHex);
        const colScales = new Map<string, d3.ScaleSequential<string, never>>();

        columns.forEach(col => {
          let maxVal = -Infinity;
          let minVal = Infinity;
          displayData.forEach(d => {
            let v = 0;
            const raw = d[col.name];
            if (typeof raw === 'number') v = raw;
            else if (typeof raw === 'string') v = raw.length;
            else if (typeof raw === 'boolean') v = raw ? 1 : 0;
            else if (Array.isArray(raw)) v = raw.length;
            else if (raw !== null && raw !== undefined) v = String(raw).length;

            if (v > maxVal) maxVal = v;
            if (v < minVal) minVal = v;
          });
          if (maxVal === minVal) maxVal = minVal + 1;

          colScales.set(col.name, d3.scaleSequential()
            .interpolator(themeInterpolator)
            .domain([minVal, maxVal]));
        });

        // X Scale (Columns)
        const x = d3.scaleBand()
          .range([0, width])
          .domain(columns.map(c => c.name))
          .padding(0.06);

        // Y Scale (Windowed Rows)
        const rowLabels = displayData.map((_, i) => String(i));
        const y = d3.scaleBand()
          .range([0, height])
          .domain(rowLabels)
          .padding(0.08);

        // Draw X Axis (Column Names)
        svg.append('g')
          .attr('transform', `translate(0,${height})`)
          .call(d3.axisBottom(x).tickSize(0))
          .selectAll('text')
          .attr('transform', 'translate(-10,8)rotate(-35)')
          .style('text-anchor', 'end')
          .style('font-size', '10px')
          .style('font-weight', '600')
          .style('fill', textColor)
          .style('font-family', 'monospace');

        // Draw Y Axis (Row numbers)
        const sampleStep = Math.max(1, Math.ceil(displayData.length / 8));
        const yTickValues = rowLabels.filter((_, i) => i % sampleStep === 0 || i === displayData.length - 1);
        svg.append('g')
          .call(d3.axisLeft(y).tickValues(yTickValues).tickFormat((d) => {
            const actualIndex = windowSize === 'all' 
              ? Number(d) + 1 
              : Math.max(1, data.length - displayData.length + Number(d) + 1);
            return `#${actualIndex}`;
          }).tickSize(0))
          .selectAll('text')
          .style('font-size', '9px')
          .style('fill', textColor)
          .style('font-family', 'monospace');

        // Build cell list
        const cells: Array<{
          rowIdx: number;
          actualRow: number;
          col: string;
          value: unknown;
          color: string;
          isNull: boolean;
        }> = [];

        displayData.forEach((row, rIdx) => {
          const actualRow = windowSize === 'all' 
            ? rIdx + 1 
            : Math.max(1, data.length - displayData.length + rIdx + 1);

          columns.forEach(col => {
            const raw = row[col.name];
            const isNull = raw === null || raw === undefined;
            let v = 0;
            if (typeof raw === 'number') v = raw;
            else if (typeof raw === 'string') v = raw.length;
            else if (typeof raw === 'boolean') v = raw ? 1 : 0;
            else if (Array.isArray(raw)) v = raw.length;

            const scale = colScales.get(col.name);
            const color = isNull ? (isLight ? '#f1f5f9' : '#1e293b') : (scale ? scale(v) : accentHex);

            cells.push({
              rowIdx: rIdx,
              actualRow,
              col: col.name,
              value: raw,
              color,
              isNull
            });
          });
        });

        // Draw Heatmap Rectangles
        svg.selectAll('.heatmap-cell')
          .data(cells)
          .enter()
          .append('rect')
          .attr('class', 'heatmap-cell')
          .attr('x', d => x(d.col) || 0)
          .attr('y', d => y(String(d.rowIdx)) || 0)
          .attr('width', x.bandwidth())
          .attr('height', y.bandwidth())
          .style('fill', d => d.color)
          .style('stroke', d => d.isNull ? '#f59e0b' : 'none')
          .style('stroke-dasharray', d => d.isNull ? '2,2' : 'none')
          .style('rx', 2)
          .style('ry', 2)
          .style('cursor', 'pointer')
          .on('mouseover', function(event, d) {
            d3.select(this)
              .style('stroke', '#ffffff')
              .style('stroke-width', 2);

            if (tooltipRef.current) {
              tooltipRef.current.style.opacity = '1';
              tooltipRef.current.innerHTML = `
                <div class="text-[10px] font-bold text-accent uppercase mb-0.5">Row ${d.actualRow} &bull; ${d.col}</div>
                <div class="text-xs truncate max-w-[220px] text-content font-mono bg-primary px-2 py-1 rounded border border-border-subtle shadow-xs">
                  ${d.isNull ? '<span class="text-amber-500 italic">null</span>' : String(d.value)}
                </div>
              `;
              const xPos = Math.min(window.innerWidth - 240, event.clientX + 14);
              const yPos = Math.max(10, event.clientY - 40);
              tooltipRef.current.style.left = `${xPos}px`;
              tooltipRef.current.style.top = `${yPos}px`;
            }
          })
          .on('mouseout', function(_, d) {
            d3.select(this)
              .style('stroke', d.isNull ? '#f59e0b' : 'none')
              .style('stroke-width', d.isNull ? 1 : 0);

            if (tooltipRef.current) {
              tooltipRef.current.style.opacity = '0';
            }
          });
      }

      // =========================================================================
      // 2. BAR CHART (Frequency / Distribution)
      // =========================================================================
      else if (vizMode === 'bar') {
        const margin = { top: 20, right: 30, bottom: 50, left: 55 };
        const containerWidth = el.clientWidth || 700;
        const height = 230 - margin.top - margin.bottom;
        const width = containerWidth - margin.left - margin.right;

        const svg = d3.select(el)
          .append('svg')
          .attr('width', width + margin.left + margin.right)
          .attr('height', 230)
          .append('g')
          .attr('transform', `translate(${margin.left},${margin.top})`);

        // Compute frequency map for selected column
        const freqMap = new Map<string, number>();
        displayData.forEach(row => {
          const val = row[selectedColumn];
          const key = val === null || val === undefined ? '(null)' : String(val);
          freqMap.set(key, (freqMap.get(key) || 0) + 1);
        });

        // Sort descending and take top 10 items
        const barData = Array.from(freqMap.entries())
          .map(([key, count]) => ({ key, count, pct: Math.round((count / displayData.length) * 100) }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const x = d3.scaleBand()
          .range([0, width])
          .domain(barData.map(d => d.key))
          .padding(0.25);

        const maxCount = d3.max(barData, d => d.count) || 1;
        const y = d3.scaleLinear()
          .range([height, 0])
          .domain([0, maxCount * 1.15]);

        // Grid lines
        svg.append('g')
          .attr('class', 'grid')
          .call(d3.axisLeft(y).ticks(4).tickSize(-width).tickFormat(() => ''))
          .selectAll('line')
          .style('stroke', subtleBorderColor)
          .style('stroke-opacity', 0.5)
          .style('stroke-dasharray', '2,2');

        // X Axis
        svg.append('g')
          .attr('transform', `translate(0,${height})`)
          .call(d3.axisBottom(x).tickSize(0))
          .selectAll('text')
          .attr('transform', 'translate(-10,8)rotate(-25)')
          .style('text-anchor', 'end')
          .style('font-size', '10px')
          .style('fill', textColor)
          .style('font-family', 'monospace')
          .text(d => {
            const str = String(d);
            return str.length > 14 ? str.slice(0, 12) + '…' : str;
          });

        // Y Axis
        svg.append('g')
          .call(d3.axisLeft(y).ticks(4).tickSize(0))
          .selectAll('text')
          .style('font-size', '10px')
          .style('fill', textColor)
          .style('font-family', 'monospace');

        // Bars
        svg.selectAll('.bar')
          .data(barData)
          .enter()
          .append('rect')
          .attr('class', 'bar')
          .attr('x', d => x(d.key) || 0)
          .attr('y', d => y(d.count))
          .attr('width', x.bandwidth())
          .attr('height', d => Math.max(0, height - y(d.count)))
          .style('fill', accentHex)
          .style('rx', 4)
          .style('ry', 4)
          .style('cursor', 'pointer')
          .on('mouseover', function(event, d) {
            d3.select(this).style('opacity', 0.85);
            if (tooltipRef.current) {
              tooltipRef.current.style.opacity = '1';
              tooltipRef.current.innerHTML = `
                <div class="text-[10px] font-bold text-accent uppercase mb-0.5">${selectedColumn}</div>
                <div class="text-xs font-mono text-content font-bold mb-1">${d.key}</div>
                <div class="text-[11px] text-content-muted flex items-center justify-between gap-3">
                  <span>Count: <strong class="text-content">${d.count}</strong></span>
                  <span>Share: <strong class="text-accent">${d.pct}%</strong></span>
                </div>
              `;
              const xPos = Math.min(window.innerWidth - 240, event.clientX + 14);
              const yPos = Math.max(10, event.clientY - 40);
              tooltipRef.current.style.left = `${xPos}px`;
              tooltipRef.current.style.top = `${yPos}px`;
            }
          })
          .on('mouseout', function() {
            d3.select(this).style('opacity', 1);
            if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
          });

        // Top value labels
        svg.selectAll('.bar-label')
          .data(barData)
          .enter()
          .append('text')
          .attr('x', d => (x(d.key) || 0) + x.bandwidth() / 2)
          .attr('y', d => y(d.count) - 5)
          .attr('text-anchor', 'middle')
          .style('font-size', '10px')
          .style('font-weight', 'bold')
          .style('font-family', 'monospace')
          .style('fill', accentHex)
          .text(d => d.count);
      }

      // =========================================================================
      // 3. LINE GRAPH (Sequence Trend & Numeric Drift)
      // =========================================================================
      else if (vizMode === 'line') {
        const margin = { top: 20, right: 30, bottom: 45, left: 55 };
        const containerWidth = el.clientWidth || 700;
        const height = 230 - margin.top - margin.bottom;
        const width = containerWidth - margin.left - margin.right;

        const svg = d3.select(el)
          .append('svg')
          .attr('width', width + margin.left + margin.right)
          .attr('height', 230)
          .append('g')
          .attr('transform', `translate(${margin.left},${margin.top})`);

        // Extract numeric points
        const points: Array<{ index: number; actualRow: number; value: number }> = [];
        displayData.forEach((row, idx) => {
          const raw = row[selectedColumn];
          const actualRow = windowSize === 'all' 
            ? idx + 1 
            : Math.max(1, data.length - displayData.length + idx + 1);

          if (typeof raw === 'number' && !isNaN(raw)) {
            points.push({ index: idx, actualRow, value: raw });
          } else if (typeof raw === 'boolean') {
            points.push({ index: idx, actualRow, value: raw ? 1 : 0 });
          } else if (raw !== null && raw !== undefined) {
            const parsed = parseFloat(String(raw));
            if (!isNaN(parsed)) {
              points.push({ index: idx, actualRow, value: parsed });
            } else {
              points.push({ index: idx, actualRow, value: String(raw).length });
            }
          }
        });

        if (points.length === 0) {
          svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .style('fill', textColor)
            .style('font-size', '12px')
            .text('No numeric points to plot for this column.');
          return;
        }

        const x = d3.scaleLinear()
          .range([0, width])
          .domain([0, points.length - 1]);

        const minVal = d3.min(points, d => d.value) ?? 0;
        const maxVal = d3.max(points, d => d.value) ?? 1;
        const padding = (maxVal - minVal) * 0.1 || 1;

        const y = d3.scaleLinear()
          .range([height, 0])
          .domain([minVal - padding, maxVal + padding]);

        // Background Area Gradient
        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
          .attr('id', 'area-gradient')
          .attr('x1', '0%')
          .attr('y1', '0%')
          .attr('x2', '0%')
          .attr('y2', '100%');

        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', accentHex)
          .attr('stop-opacity', 0.35);

        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', accentHex)
          .attr('stop-opacity', 0.0);

        // Grid lines
        svg.append('g')
          .call(d3.axisLeft(y).ticks(4).tickSize(-width).tickFormat(() => ''))
          .selectAll('line')
          .style('stroke', subtleBorderColor)
          .style('stroke-opacity', 0.5)
          .style('stroke-dasharray', '2,2');

        // Draw Area
        const area = d3.area<{ index: number; value: number }>()
          .x(d => x(d.index))
          .y0(height)
          .y1(d => y(d.value))
          .curve(d3.curveMonotoneX);

        svg.append('path')
          .datum(points)
          .attr('fill', 'url(#area-gradient)')
          .attr('d', area);

        // Draw Trend Line
        const line = d3.line<{ index: number; value: number }>()
          .x(d => x(d.index))
          .y(d => y(d.value))
          .curve(d3.curveMonotoneX);

        svg.append('path')
          .datum(points)
          .attr('fill', 'none')
          .attr('stroke', accentHex)
          .attr('stroke-width', 2.2)
          .attr('d', line);

        // Mean Average dashed line
        const meanVal = d3.mean(points, d => d.value) ?? 0;
        svg.append('line')
          .attr('x1', 0)
          .attr('x2', width)
          .attr('y1', y(meanVal))
          .attr('y2', y(meanVal))
          .style('stroke', '#10b981')
          .style('stroke-width', 1.5)
          .style('stroke-dasharray', '3,3');

        // Axes
        svg.append('g')
          .attr('transform', `translate(0,${height})`)
          .call(d3.axisBottom(x).ticks(Math.min(points.length, 6)).tickFormat(d => {
            const p = points[Number(d)];
            return p ? `#${p.actualRow}` : '';
          }).tickSize(0))
          .selectAll('text')
          .style('font-size', '10px')
          .style('fill', textColor)
          .style('font-family', 'monospace');

        svg.append('g')
          .call(d3.axisLeft(y).ticks(4).tickSize(0))
          .selectAll('text')
          .style('font-size', '10px')
          .style('fill', textColor)
          .style('font-family', 'monospace');

        // Hover points (capped to max 40 circles for performance)
        const pointStride = Math.max(1, Math.floor(points.length / 35));
        svg.selectAll('.point')
          .data(points.filter((_, i) => i % pointStride === 0 || i === points.length - 1))
          .enter()
          .append('circle')
          .attr('cx', d => x(d.index))
          .attr('cy', d => y(d.value))
          .attr('r', 3)
          .style('fill', accentHex)
          .style('stroke', isLight ? '#ffffff' : '#0f172a')
          .style('stroke-width', 1.5)
          .style('cursor', 'pointer')
          .on('mouseover', function(event, d) {
            d3.select(this).attr('r', 5);
            if (tooltipRef.current) {
              tooltipRef.current.style.opacity = '1';
              tooltipRef.current.innerHTML = `
                <div class="text-[10px] font-bold text-accent uppercase mb-0.5">Row #${d.actualRow} &bull; ${selectedColumn}</div>
                <div class="text-xs font-mono font-bold text-content">Value: ${d.value}</div>
                <div class="text-[10px] font-mono text-emerald-500">Mean: ${meanVal.toFixed(2)}</div>
              `;
              const xPos = Math.min(window.innerWidth - 240, event.clientX + 14);
              const yPos = Math.max(10, event.clientY - 40);
              tooltipRef.current.style.left = `${xPos}px`;
              tooltipRef.current.style.top = `${yPos}px`;
            }
          })
          .on('mouseout', function() {
            d3.select(this).attr('r', 3);
            if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
          });
      }

      // =========================================================================
      // 4. DONUT / PIE CHART (Proportions & Shares)
      // =========================================================================
      else if (vizMode === 'pie') {
        const containerWidth = el.clientWidth || 700;
        const height = 230;
        const radius = Math.min(containerWidth, height) / 2 - 25;

        const svg = d3.select(el)
          .append('svg')
          .attr('width', containerWidth)
          .attr('height', height)
          .append('g')
          .attr('transform', `translate(${containerWidth / 2 - 70},${height / 2})`);

        // Compute frequency map
        const freqMap = new Map<string, number>();
        displayData.forEach(row => {
          const val = row[selectedColumn];
          const key = val === null || val === undefined ? '(null)' : String(val);
          freqMap.set(key, (freqMap.get(key) || 0) + 1);
        });

        // Sort and take top 6 slices + "Other"
        const sorted = Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1]);
        const pieData: Array<{ label: string; count: number }> = [];
        let otherCount = 0;

        sorted.forEach(([label, count], idx) => {
          if (idx < 6) {
            pieData.push({ label, count });
          } else {
            otherCount += count;
          }
        });
        if (otherCount > 0) {
          pieData.push({ label: 'Other', count: otherCount });
        }

        const colorPalette = isLight
          ? ['#2563eb', '#0d9488', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b']
          : ['#6366f1', '#14b8a6', '#f59e0b', '#a855f7', '#f43f5e', '#06b6d4', '#94a3b8'];

        const color = d3.scaleOrdinal()
          .domain(pieData.map(d => d.label))
          .range(colorPalette);

        const pie = d3.pie<{ label: string; count: number }>()
          .value(d => d.count)
          .sort(null);

        const arc = d3.arc<d3.PieArcDatum<{ label: string; count: number }>>()
          .innerRadius(radius * 0.52)
          .outerRadius(radius)
          .cornerRadius(4)
          .padAngle(0.02);

        const arcHover = d3.arc<d3.PieArcDatum<{ label: string; count: number }>>()
          .innerRadius(radius * 0.52)
          .outerRadius(radius + 5)
          .cornerRadius(4)
          .padAngle(0.02);

        // Draw Arcs
        svg.selectAll('.arc')
          .data(pie(pieData))
          .enter()
          .append('path')
          .attr('class', 'arc')
          .attr('d', arc)
          .style('fill', (d, i) => i === 0 ? accentHex : String(color(d.data.label)))
          .style('cursor', 'pointer')
          .style('transition', 'all 0.15s ease-out')
          .on('mouseover', function(event, d) {
            d3.select(this).attr('d', arcHover);
            if (tooltipRef.current) {
              const pct = Math.round((d.data.count / displayData.length) * 100);
              tooltipRef.current.style.opacity = '1';
              tooltipRef.current.innerHTML = `
                <div class="text-[10px] font-bold text-accent uppercase mb-0.5">${selectedColumn}</div>
                <div class="text-xs font-mono font-bold text-content">${d.data.label}</div>
                <div class="text-[11px] text-content-muted mt-1">
                  Count: <strong class="text-content">${d.data.count}</strong> (${pct}%)
                </div>
              `;
              const xPos = Math.min(window.innerWidth - 240, event.clientX + 14);
              const yPos = Math.max(10, event.clientY - 40);
              tooltipRef.current.style.left = `${xPos}px`;
              tooltipRef.current.style.top = `${yPos}px`;
            }
          })
          .on('mouseout', function() {
            d3.select(this).attr('d', arc);
            if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
          });

        // Center Hole Label
        svg.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '-0.2em')
          .style('font-size', '13px')
          .style('font-weight', 'bold')
          .style('font-family', 'monospace')
          .style('fill', accentHex)
          .text(`${displayData.length}`);

        svg.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '1.2em')
          .style('font-size', '9px')
          .style('font-weight', '600')
          .style('text-transform', 'uppercase')
          .style('fill', textColor)
          .text('Total Rows');

        // Legend on the Right Side
        const legendX = radius + 30;
        const legend = svg.append('g')
          .attr('transform', `translate(${legendX},${-radius + 10})`);

        pieData.forEach((item, idx) => {
          const itemColor = idx === 0 ? accentHex : String(color(item.label));
          const pct = Math.round((item.count / displayData.length) * 100);
          const g = legend.append('g')
            .attr('transform', `translate(0, ${idx * 22})`);

          g.append('rect')
            .attr('width', 10)
            .attr('height', 10)
            .attr('rx', 2)
            .style('fill', itemColor);

          g.append('text')
            .attr('x', 16)
            .attr('y', 9)
            .style('font-size', '10px')
            .style('font-family', 'monospace')
            .style('fill', textColor)
            .text(`${item.label.length > 12 ? item.label.slice(0, 10) + '…' : item.label} (${pct}%)`);
        });
      }
    };

    animFrameId = requestAnimationFrame(renderVisualization);

    // Responsive redraw
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(animFrameId);
      animFrameId = requestAnimationFrame(renderVisualization);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
    };
  }, [
    displayData, 
    columns, 
    isExpanded, 
    theme, 
    vizMode, 
    selectedColumn, 
    currentTheme, 
    data.length, 
    windowSize
  ]);

  // Quick statistics for the column health view
  const columnHealthMetrics = useMemo(() => {
    return columns.map(col => {
      let nullCount = 0;
      const distinctSet = new Set<unknown>();
      let numericSum = 0;
      let numericCount = 0;
      let minVal = Infinity;
      let maxVal = -Infinity;

      displayData.forEach(row => {
        const val = row[col.name];
        if (val === null || val === undefined) {
          nullCount++;
        } else {
          distinctSet.add(val);
          if (typeof val === 'number') {
            numericSum += val;
            numericCount++;
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
          }
        }
      });

      const fillRate = Math.round(((displayData.length - nullCount) / (displayData.length || 1)) * 100);

      return {
        name: col.name,
        type: col.type,
        fillRate,
        nullCount,
        distinctCount: distinctSet.size,
        avg: numericCount > 0 ? (numericSum / numericCount).toFixed(2) : null,
        min: minVal !== Infinity ? minVal : null,
        max: maxVal !== -Infinity ? maxVal : null,
      };
    });
  }, [columns, displayData]);

  return (
    <div id="vampio-viz-panel" className="bg-primary border-b border-border-subtle flex flex-col flex-shrink-0">
      {/* Visual Analytics Bar Header */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-primary hover:bg-tertiary/40 transition-colors border-b border-transparent">
        <button 
          type="button"
          id="toggle-viz-panel-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs font-bold text-content hover:text-accent transition-colors"
        >
          <Activity size={14} className="text-accent flex-shrink-0" />
          <span>Visual Analytics & Distribution</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-secondary border border-border-subtle text-content-muted font-normal">
            {data.length} rows &bull; {columns.length} cols
          </span>
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              STREAMING
            </span>
          )}
          {isExpanded ? (
            <ChevronDown size={14} className="text-content-muted ml-1" />
          ) : (
            <ChevronRight size={14} className="text-content-muted ml-1" />
          )}
        </button>

        {/* Controls when expanded */}
        {isExpanded && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Chart Mode Selector */}
            <div className="flex bg-secondary p-0.5 rounded-lg border border-border-subtle">
              <button
                type="button"
                id="viz-mode-heatmap"
                onClick={() => setVizMode('heatmap')}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  vizMode === 'heatmap' ? 'bg-accent text-white shadow-xs' : 'text-content-muted hover:text-content'
                }`}
                title="Density Matrix Heatmap"
              >
                <Grid3X3 size={12} />
                <span className="hidden sm:inline">Heatmap</span>
              </button>
              <button
                type="button"
                id="viz-mode-bar"
                onClick={() => setVizMode('bar')}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  vizMode === 'bar' ? 'bg-accent text-white shadow-xs' : 'text-content-muted hover:text-content'
                }`}
                title="Frequency Distribution Bar Graph"
              >
                <BarChart2 size={12} />
                <span className="hidden sm:inline">Bars</span>
              </button>
              <button
                type="button"
                id="viz-mode-line"
                onClick={() => setVizMode('line')}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  vizMode === 'line' ? 'bg-accent text-white shadow-xs' : 'text-content-muted hover:text-content'
                }`}
                title="Sequential Trend Line Graph"
              >
                <TrendingUp size={12} />
                <span className="hidden sm:inline">Trend</span>
              </button>
              <button
                type="button"
                id="viz-mode-pie"
                onClick={() => setVizMode('pie')}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  vizMode === 'pie' ? 'bg-accent text-white shadow-xs' : 'text-content-muted hover:text-content'
                }`}
                title="Proportion Donut Chart"
              >
                <PieIcon size={12} />
                <span className="hidden sm:inline">Donut</span>
              </button>
              <button
                type="button"
                id="viz-mode-health"
                onClick={() => setVizMode('health')}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  vizMode === 'health' ? 'bg-accent text-white shadow-xs' : 'text-content-muted hover:text-content'
                }`}
                title="Column Quality & Nullability Matrix"
              >
                <ShieldAlert size={12} />
                <span className="hidden sm:inline">Health</span>
              </button>
            </div>

            {/* Column Selector for Bar / Line / Donut */}
            {(vizMode === 'bar' || vizMode === 'line' || vizMode === 'pie') && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-content-muted uppercase">Field:</span>
                <select
                  id="viz-field-select"
                  value={selectedColumn}
                  onChange={(e) => setSelectedColumn(e.target.value)}
                  className="px-2 py-1 text-[11px] bg-secondary border border-border-subtle rounded-md text-content font-mono focus:outline-none focus:border-accent"
                >
                  {columns.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Window Sampling Limit (Crucial during streaming!) */}
            {(vizMode === 'heatmap' || vizMode === 'line') && (
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal size={11} className="text-content-muted" />
                <select
                  id="viz-window-select"
                  value={String(windowSize)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWindowSize(val === 'all' ? 'all' : Number(val) as WindowSize);
                  }}
                  className="px-2 py-1 text-[11px] bg-secondary border border-border-subtle rounded-md text-content-muted font-mono focus:outline-none"
                  title="Limit sampling buffer size to maintain high frame rate during continuous streaming"
                >
                  <option value="30">Last 30 rows</option>
                  <option value="60">Last 60 rows</option>
                  <option value="100">Last 100 rows</option>
                  <option value="all">All ({data.length})</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Expanded Chart Area */}
      {isExpanded && (
        <div className="relative p-3 bg-secondary overflow-x-auto shadow-inner border-t border-border-subtle">
           {data.length === 0 ? (
             <div className="text-xs text-content-muted text-center py-8 font-mono">
               No data available to visualize. Generate or stream rows to activate analytics.
             </div>
           ) : vizMode === 'health' ? (
             /* Mode 5: Column Health & Quality Cards */
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 py-1">
               {columnHealthMetrics.map(metric => (
                 <div 
                   key={metric.name}
                   className="bg-primary border border-border-subtle rounded-lg p-2.5 shadow-xs flex flex-col justify-between"
                 >
                   <div>
                     <div className="flex items-center justify-between gap-1 mb-1">
                       <span className="text-xs font-bold text-content truncate font-mono" title={metric.name}>
                         {metric.name}
                       </span>
                       <span className="text-[9px] px-1 py-0.2 rounded bg-secondary text-content-muted font-mono flex-shrink-0">
                         {metric.type}
                       </span>
                     </div>
                     
                     {/* Fill Rate Progress Bar */}
                     <div className="mt-1.5">
                       <div className="flex justify-between text-[10px] text-content-muted font-mono mb-1">
                         <span>Populated</span>
                         <span className={metric.fillRate < 80 ? 'text-amber-500 font-bold' : 'text-emerald-500 font-bold'}>
                           {metric.fillRate}%
                         </span>
                       </div>
                       <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                         <div 
                           className={`h-full rounded-full transition-all duration-300 ${
                             metric.fillRate < 80 ? 'bg-amber-500' : 'bg-accent'
                           }`}
                           style={{ width: `${metric.fillRate}%` }}
                         />
                       </div>
                     </div>
                   </div>

                   <div className="mt-2.5 pt-2 border-t border-border-subtle/50 text-[10px] font-mono text-content-muted flex items-center justify-between">
                     <span>Distinct: <strong className="text-content">{metric.distinctCount}</strong></span>
                     {metric.nullCount > 0 && (
                       <span className="text-amber-500 font-semibold">{metric.nullCount} null</span>
                     )}
                   </div>
                 </div>
               ))}
             </div>
           ) : (
             /* Modes 1-4: D3 SVG Rendering Container */
             <div ref={containerRef} className="w-full min-h-[220px] max-h-[260px] flex items-center justify-center" />
           )}
           
           {/* Custom Tooltip */}
           <div 
             ref={tooltipRef}
             className="fixed pointer-events-none opacity-0 bg-secondary border border-border-subtle shadow-lg rounded-lg p-2.5 z-50 transition-opacity duration-100 ease-in-out font-sans backdrop-blur-md"
           ></div>
        </div>
      )}
    </div>
  );
};
