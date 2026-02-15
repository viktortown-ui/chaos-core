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

interface UPlotChartProps {
  data: ChartData;
  series: UPlotSeries[];
  kind: ChartKind;
  ariaLabel: string;
  reducedMotion: boolean;
  className?: string;
  onScrubIndex?: (index: number) => void;
}

const CHART_HEIGHT = 240;

function buildOptions(kind: ChartKind, series: UPlotSeries[], width: number, onScrubIndex?: (index: number) => void): Options {
  const isDistribution = kind === 'distribution';

  return {
    width,
    height: CHART_HEIGHT,
    legend: { show: true },
    cursor: { drag: { x: !isDistribution, y: false } },
    hooks: onScrubIndex ? {
      setCursor: [
        (u) => {
          if (typeof u.cursor.idx === 'number' && u.cursor.idx >= 0) onScrubIndex(u.cursor.idx);
        }
      ]
    } : undefined,
    scales: {
      x: { time: !isDistribution },
      y: { auto: true }
    },
    axes: [
      { stroke: '#7d88a8', grid: { stroke: '#242f45' } },
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

export function UPlotChart({ data, series, kind, ariaLabel, reducedMotion, className, onScrubIndex }: UPlotChartProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<uPlot | null>(null);

  const chartKey = useMemo(
    () => `${kind}|${reducedMotion ? 'reduced' : 'full'}|${series.map((item) => `${item.label}:${item.color}`).join('|')}`,
    [kind, reducedMotion, series]
  );

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = Math.max(280, Math.floor(host.getBoundingClientRect().width || 320));
    const options = buildOptions(kind, series, width, onScrubIndex);
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
    };
  }, [chartKey, onScrubIndex]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.setData(data as unknown as uPlot.AlignedData);
  }, [data]);

  const chartStyle: CSSProperties = {
    width: '100%',
    minHeight: CHART_HEIGHT
  };

  return <div ref={hostRef} style={chartStyle} className={[className, reducedMotion ? 'reduce-motion' : ''].filter(Boolean).join(' ')} role="img" aria-label={ariaLabel} />;
}
