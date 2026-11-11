import type { Chart, Plugin } from 'chart.js';
import { useEffect, useRef } from 'react';

import type { SeasonNight } from '@/features/inventory';
import { formatIsoDate, isoDate } from '@/lib/format/dates';

interface OccupancyChartProps {
  nights: readonly SeasonNight[];
  /** "5 Zul-Hijjah" for a yyyy-mm-dd date. */
  dayLabel: (iso: string) => string;
}

/** The token colours the chart draws with, read from swatches so they follow the theme. */
const SWATCHES = {
  sold: 'text-primary',
  overbooked: 'text-primary-active',
  purchased: 'text-faint',
  grid: 'text-border-subtle',
  axis: 'text-border',
  label: 'text-muted',
  ink: 'text-foreground',
  surface: 'text-surface',
} as const;

type Palette = Record<keyof typeof SWATCHES, string>;

function readPalette(root: HTMLElement): Palette {
  const palette = {} as Palette;
  for (const key of Object.keys(SWATCHES) as (keyof typeof SWATCHES)[]) {
    const swatch = root.querySelector<HTMLElement>(`[data-swatch="${key}"]`);
    palette[key] = swatch ? getComputedStyle(swatch).color : 'currentColor';
  }
  return palette;
}

/** The same colour at a lower opacity; computed colours arrive as rgb(r, g, b). */
function withAlpha(color: string, alpha: number) {
  return color.replace(/^rgb\((.+)\)$/, `rgba($1, ${String(alpha)})`);
}

/** A thin vertical line under the pointer, so the night being read is clear. */
function crosshair(color: string): Plugin<'line'> {
  return {
    id: 'crosshair',
    afterDatasetsDraw(chart) {
      const active = chart.tooltip?.getActiveElements()[0];
      if (!active) return;
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(active.element.x, chartArea.top);
      ctx.lineTo(active.element.x, chartArea.bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.restore();
    },
  };
}

/**
 * Rooms purchased and sold on each night of the season, every hotel together: the grey line
 * is the rooms bought, the red area the rooms sold, and a dot marks a night with rooms sold
 * that have no room behind them. Chart.js is loaded only when the chart is shown.
 */
export function OccupancyChart({ nights, dayLabel }: OccupancyChartProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overbookedNights = nights.filter((night) => night.overbooked > 0).length;
  const peak = nights.reduce((best, night) => Math.max(best, night.sold), 0);

  // Chart.js draws on a canvas outside React, so an effect creates and destroys it.
  useEffect(() => {
    const root = rootRef.current;
    const context = canvasRef.current?.getContext('2d');
    if (!root || !context) return;
    let chart: Chart<'line'> | undefined;
    let cancelled = false;

    void import('chart.js/auto').then(({ default: ChartJS }) => {
      if (cancelled) return;
      const palette = readPalette(root);
      const font = { family: getComputedStyle(root).fontFamily, size: 11 };
      const isos = nights.map((night) => isoDate(night.day));
      const fill = context.createLinearGradient(0, 0, 0, context.canvas.clientHeight || 260);
      fill.addColorStop(0, withAlpha(palette.sold, 0.22));
      fill.addColorStop(1, withAlpha(palette.sold, 0.01));

      chart = new ChartJS(context, {
        type: 'line',
        data: {
          labels: isos.map((iso) => dayLabel(iso)),
          datasets: [
            {
              label: 'Sold',
              data: nights.map((night) => night.sold),
              borderColor: palette.sold,
              backgroundColor: fill,
              fill: 'origin',
              borderWidth: 2,
              cubicInterpolationMode: 'monotone',
              pointRadius: nights.map((night) => (night.overbooked > 0 ? 3.5 : 0)),
              pointBackgroundColor: palette.overbooked,
              pointBorderColor: palette.surface,
              pointBorderWidth: 1.5,
              pointHoverRadius: 5,
              pointHoverBackgroundColor: palette.sold,
              pointHoverBorderColor: palette.surface,
              pointHoverBorderWidth: 2,
            },
            {
              label: 'Purchased',
              data: nights.map((night) => night.purchased),
              borderColor: palette.purchased,
              backgroundColor: withAlpha(palette.purchased, 0.08),
              fill: 'origin',
              borderWidth: 1.5,
              cubicInterpolationMode: 'monotone',
              pointRadius: 0,
              pointHoverRadius: 4,
              pointHoverBackgroundColor: palette.purchased,
              pointHoverBorderColor: palette.surface,
              pointHoverBorderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 500, easing: 'easeOutQuart' },
          interaction: { mode: 'index', intersect: false },
          layout: { padding: { top: 4, right: 4 } },
          scales: {
            x: {
              grid: { display: false },
              border: { color: palette.axis },
              ticks: {
                color: palette.label,
                font,
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 8,
                callback(_value, index) {
                  const label = dayLabel(isos[index] ?? '');
                  return index === 0 ? label : label.split(' ')[0];
                },
              },
            },
            y: {
              beginAtZero: true,
              grid: { color: palette.grid },
              border: { display: false },
              ticks: { color: palette.label, font, maxTicksLimit: 5, padding: 8 },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: palette.surface,
              borderColor: palette.axis,
              borderWidth: 1,
              titleColor: palette.ink,
              bodyColor: palette.label,
              footerColor: palette.overbooked,
              titleFont: { ...font, size: 12, weight: 600 },
              bodyFont: { ...font, size: 12 },
              footerFont: { ...font, size: 12, weight: 600 },
              padding: 10,
              cornerRadius: 8,
              caretSize: 0,
              boxPadding: 4,
              usePointStyle: true,
              callbacks: {
                title: (items) => {
                  const iso = isos[items[0]?.dataIndex ?? 0] ?? '';
                  return `${dayLabel(iso)} · ${formatIsoDate(iso)}`;
                },
                label: (item) => ` ${item.dataset.label ?? ''}  ${item.formattedValue}`,
                labelColor: (item) => {
                  const color = item.datasetIndex === 0 ? palette.sold : palette.purchased;
                  return { borderColor: color, backgroundColor: color };
                },
                footer: (items) => {
                  const night = nights[items[0]?.dataIndex ?? 0];
                  return night && night.overbooked > 0 ? `Overbooked by ${String(night.overbooked)}` : '';
                },
              },
            },
          },
        },
        plugins: [crosshair(palette.axis)],
      });
    });

    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [nights, dayLabel]);

  return (
    <div ref={rootRef} className="px-4">
      <div aria-hidden className="hidden">
        {Object.entries(SWATCHES).map(([key, className]) => (
          <span key={key} data-swatch={key} className={className} />
        ))}
      </div>
      <div className="relative h-64">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Rooms by night over ${String(nights.length)} nights, at most ${String(peak)} sold on one night. ${overbookedNights > 0 ? `${String(overbookedNights)} nights overbooked.` : 'No night overbooked.'}`}
        />
      </div>
    </div>
  );
}
