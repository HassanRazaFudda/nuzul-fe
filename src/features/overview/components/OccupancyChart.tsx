import { useState, type KeyboardEvent } from 'react';

import type { SeasonNight } from '@/features/inventory';
import { formatIsoDate, isoDate } from '@/lib/format/dates';

const WIDTH = 720;
const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 40 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

/** A round step for four gridlines: a peak of 105 gives steps of 30, up to 120. */
function niceStep(peak: number) {
  const raw = Math.max(peak, 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const factor = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= raw) ?? 10;
  return factor * magnitude;
}

interface OccupancyChartProps {
  nights: readonly SeasonNight[];
  /** "5 Zul-Hijjah" for a yyyy-mm-dd date. */
  dayLabel: (iso: string) => string;
}

/**
 * Rooms purchased and sold on each night of the season, every hotel together. Purchased is
 * the stepped line, sold the shaded area; a night with sales beyond its rooms is marked red.
 */
export function OccupancyChart({ nights, dayLabel }: OccupancyChartProps) {
  const peakIndex = nights.reduce(
    (best, night, index) => (night.sold > (nights[best]?.sold ?? -1) ? index : best),
    0,
  );
  const [active, setActive] = useState<number | null>(null);
  const shown = nights[active ?? peakIndex];
  if (!shown) return null;

  const tickStep = niceStep(Math.max(...nights.map((night) => Math.max(night.purchased, night.sold))));
  const top = tickStep * 4;
  const step = PLOT_W / nights.length;
  const x = (index: number) => PAD.left + index * step;
  const y = (value: number) => PAD.top + PLOT_H - (value / top) * PLOT_H;
  const stepped = (value: (night: SeasonNight) => number) =>
    nights
      .map(
        (night, index) =>
          `L${String(x(index))},${String(y(value(night)))} L${String(x(index + 1))},${String(y(value(night)))}`,
      )
      .join(' ');
  const baseline = y(0);
  const soldArea = `M${String(x(0))},${String(baseline)} ${stepped((night) => night.sold)} L${String(x(nights.length))},${String(baseline)} Z`;
  const purchasedLine = stepped((night) => night.purchased).replace(/^L/, 'M');
  const ticks = [0, 1, 2, 3, 4].map((index) => index * tickStep);
  const labelEvery = nights.length > 21 ? 7 : nights.length > 10 ? 2 : 1;
  const overbookedNights = nights.filter((night) => night.overbooked > 0).length;
  const shownIso = isoDate(shown.day);

  function handleKey(event: KeyboardEvent) {
    const current = active ?? peakIndex;
    if (event.key === 'ArrowRight') setActive(Math.min(nights.length - 1, current + 1));
    else if (event.key === 'ArrowLeft') setActive(Math.max(0, current - 1));
    else return;
    event.preventDefault();
  }

  return (
    <div>
      <dl
        aria-live="polite"
        className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-5 pb-3 text-[0.8125rem] tabular-nums"
      >
        <div>
          <dt className="sr-only">Night</dt>
          <dd className="text-foreground font-medium">
            {dayLabel(shownIso)} <span className="text-muted font-normal">{formatIsoDate(shownIso)}</span>
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted">Purchased</dt>
          <dd className="text-foreground">{shown.purchased}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted">Sold</dt>
          <dd className="text-foreground">{shown.sold}</dd>
        </div>
        {shown.overbooked > 0 && (
          <div className="flex gap-1.5">
            <dt className="text-muted">Overbooked</dt>
            <dd className="text-danger-strong font-medium">{shown.overbooked}</dd>
          </div>
        )}
      </dl>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
          role="img"
          aria-label={`Rooms by night over ${String(nights.length)} nights. ${overbookedNights > 0 ? `${String(overbookedNights)} nights overbooked.` : 'No night overbooked.'} Use the arrow keys to read each night.`}
          tabIndex={0}
          onKeyDown={handleKey}
          onMouseLeave={() => {
            setActive(null);
          }}
          className="block h-auto w-full min-w-[34rem] px-3 outline-offset-0"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-border"
                strokeDasharray={tick === 0 ? undefined : '2 4'}
              />
              <text
                x={PAD.left - 8}
                y={y(tick) + 4}
                textAnchor="end"
                className="fill-muted text-[11px] tabular-nums"
              >
                {tick.toLocaleString('en-GB')}
              </text>
            </g>
          ))}

          {nights.map((night, index) =>
            night.overbooked > 0 ? (
              <rect
                key={`over-${String(night.day)}`}
                x={x(index)}
                y={PAD.top}
                width={step}
                height={PLOT_H}
                className="fill-danger/[0.06]"
              />
            ) : null,
          )}

          <path d={soldArea} className="fill-secondary/15" />
          <path
            d={stepped((night) => night.sold).replace(/^L/, 'M')}
            className="stroke-secondary fill-none"
            strokeWidth={1.5}
          />
          <path
            d={purchasedLine}
            className="stroke-foreground fill-none"
            strokeWidth={2}
            strokeDasharray="5 3"
          />

          {nights.map((night, index) =>
            night.overbooked > 0 ? (
              <line
                key={`mark-${String(night.day)}`}
                x1={x(index) + 2}
                x2={x(index + 1) - 2}
                y1={y(night.sold)}
                y2={y(night.sold)}
                className="stroke-danger"
                strokeWidth={3}
                strokeLinecap="round"
              />
            ) : null,
          )}

          {active !== null && (
            <rect
              x={x(active)}
              y={PAD.top}
              width={step}
              height={PLOT_H}
              className="fill-foreground/[0.05] pointer-events-none"
            />
          )}

          {nights.map((night, index) =>
            index % labelEvery === 0 ? (
              <text
                key={`label-${String(night.day)}`}
                x={index === 0 ? x(0) : x(index) + step / 2}
                y={HEIGHT - 8}
                textAnchor={index === 0 ? 'start' : 'middle'}
                className="fill-muted text-[11px]"
              >
                {index === 0 ? dayLabel(isoDate(night.day)) : dayLabel(isoDate(night.day)).split(' ')[0]}
              </text>
            ) : null,
          )}

          {nights.map((night, index) => (
            <rect
              key={`hit-${String(night.day)}`}
              x={x(index)}
              y={PAD.top}
              width={step}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => {
                setActive(index);
              }}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
