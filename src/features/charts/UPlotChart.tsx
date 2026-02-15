import { CSSProperties, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import uPlot, { Options } from 'uplot';
import 'uplot/dist/uPlot.min.css';

export type ChartKind = 'time-series' | 'distribution';

export interface UPlotSeries {
  label: string;
  color: string;
  width?: number;
  fill?: string;
  dash?: number[];
}

type ChartData = Array<Array<number | null>>;

interface XAxisConfig {
  isTimeScale?: boolean;
  values?: (u: uPlot, ticks: number[]) => string[];
}

interface UPlotChartProps {
  data: ChartData;
  series: UPlotSeries[];
  kind: ChartKind;
  ariaLabel: string;
  reducedMotion: boolean;
  className?: string;
  onScrubIndex?: (index: number) => void;
  onTogglePin?: (index: number) => void;
  xAxisConfig?: XAxisConfig;
}

const CHART_HEIGHT = 240;

function buildOptions(kind: ChartKind, series: UPlotSeries[], width: number, xAxisConfig?: XAxisConfig): Options {
  const isDistribution = kind === 'distribution';

  return {
    width,
    height: CHART_HEIGHT,
    legend: { show: true },
    cursor: { drag: { x: !isDistribution, y: false } },
    scales: {
      x: { time: xAxisConfig?.isTimeScale ?? !isDistribution },
      y: { auto: true }
    },
    axes: [
      { stroke: '#7d88a8', grid: { stroke: '#242f45' }, values: xAxisConfig?.values },
      { stroke: '#7d88a8', grid: { stroke: '#242f45' } }
    ],
    series: [
      { label: 'x' },
      ...series.map((entry) => ({
        label: entry.label,
        stroke: entry.color,
        width: entry.width ?? 2,
        fill: entry.fill,
        dash: entry.dash,
        points: { show: false }
      }))
    ],
    class: 'cc-uplot'
  };
}

export function UPlotChart({ data, series, kind, ariaLabel, reducedMotion, className, onScrubIndex, onTogglePin, xAxisConfig }: UPlotChartProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<uPlot | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastIndexRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const isScrubbingRef = useRef(false);

  const chartKey = useMemo(
    () => `${kind}|${reducedMotion ? 'reduced' : 'full'}|${series.map((item) => `${item.label}:${item.color}`).join('|')}`,
    [kind, reducedMotion, series]
  );

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = Math.max(280, Math.floor(host.getBoundingClientRect().width || 320));
    const options = buildOptions(kind, series, width, xAxisConfig);
    const chart = new uPlot(options, data as unknown as uPlot.AlignedData, host);
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = Math.max(280, Math.floor(entries[0].contentRect.width));
      chart.setSize({ width: nextWidth, height: CHART_HEIGHT });
    });
    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
      chart.destroy();
      chartRef.current = null;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [chartKey, xAxisConfig, kind, series, data]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.setData(data as unknown as uPlot.AlignedData);
  }, [data]);


  const updateIndex = (nextIndex: number) => {
    const chart = chartRef.current;
    if (!chart || !onScrubIndex) return;
    if (lastIndexRef.current === nextIndex) return;
    lastIndexRef.current = nextIndex;
    onScrubIndex(nextIndex);
  };

  const pushIndex = (nextIndex: number) => {
    if (reducedMotion) {
      updateIndex(nextIndex);
      return;
    }
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      updateIndex(nextIndex);
    });
  };

  const indexFromEvent = (event: { clientX: number }): number | null => {
    const chart = chartRef.current;
    const overlay = overlayRef.current;
    if (!chart || !overlay) return null;
    const bounds = overlay.getBoundingClientRect();
    const left = event.clientX - bounds.left;
    const plotLeft = left - chart.bbox.left;
    if (plotLeft < 0 || plotLeft > chart.bbox.width) return null;
    const idx = chart.posToIdx(plotLeft);
    if (!Number.isFinite(idx) || idx < 0) return null;
    return Math.min((data[0]?.length ?? 1) - 1, idx);
  };

  const chartStyle: CSSProperties = {
    width: '100%',
    minHeight: CHART_HEIGHT
  };

  return (
    <div className={[className, reducedMotion ? 'reduce-motion' : '', 'uplot-touch-wrap'].filter(Boolean).join(' ')}>
      <div ref={hostRef} style={chartStyle} role="img" aria-label={ariaLabel} />
      <div
        ref={overlayRef}
        className="uplot-touch-overlay"
        onPointerDown={(event) => {
          pointerStartRef.current = { x: event.clientX, y: event.clientY };
          isScrubbingRef.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
          const idx = indexFromEvent(event);
          if (idx != null) pushIndex(idx);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const start = pointerStartRef.current;
          if (start) {
            const deltaX = Math.abs(event.clientX - start.x);
            const deltaY = Math.abs(event.clientY - start.y);
            if (deltaX > 6 && deltaX > deltaY) {
              isScrubbingRef.current = true;
              event.preventDefault();
            }
          }
          const idx = indexFromEvent(event);
          if (idx != null) pushIndex(idx);
        }}
        onPointerUp={(event) => {
          const idx = indexFromEvent(event);
          if (idx != null) {
            if (!isScrubbingRef.current && onTogglePin) onTogglePin(idx);
            pushIndex(idx);
          }
          isScrubbingRef.current = false;
          pointerStartRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      />
    </div>
  );
}
