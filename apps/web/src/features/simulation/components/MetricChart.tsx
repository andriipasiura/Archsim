import { HISTORY_POINTS } from '../constants';

export interface ChartSeries {
  label: string;
  color: string;
  values: readonly number[];
}

interface MetricChartProps {
  title: string;
  series: readonly ChartSeries[];
  format: (value: number) => string;
  minMax: number;
}

const HEIGHT = 100;

function niceCeil(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

function points(values: readonly number[], yMax: number): string {
  return values
    .map((v, i) => `${i},${(HEIGHT - (v / yMax) * HEIGHT).toFixed(2)}`)
    .join(' ');
}

export function MetricChart({
  title,
  series,
  format,
  minMax,
}: MetricChartProps) {
  const peak = Math.max(minMax, ...series.flatMap((s) => s.values));
  const yMax = niceCeil(peak);
  const current = series.map((s) => ({ ...s, value: s.values.at(-1) }));
  const summary = current
    .map(
      (s) =>
        `${s.label} ${s.value === undefined ? 'no data' : format(s.value)}`,
    )
    .join(', ');

  return (
    <figure className="flex min-w-0 flex-col gap-1 rounded-lg border bg-card p-2">
      <figcaption className="flex items-start justify-between gap-2 text-xs">
        <span className="font-semibold">{title}</span>
        <span className="flex flex-wrap justify-end gap-x-2 tabular-nums">
          {current.map((s) => (
            <span
              key={s.label}
              className="whitespace-nowrap"
              style={{ color: s.color }}
            >
              {s.label} {s.value === undefined ? '—' : format(s.value)}
            </span>
          ))}
        </span>
      </figcaption>
      <div className="relative min-h-0 flex-1">
        <span className="absolute top-0 left-0 text-[10px] text-muted-foreground tabular-nums">
          {format(yMax)}
        </span>
        <svg
          viewBox={`0 0 ${HISTORY_POINTS - 1} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="size-full overflow-visible border-b border-l"
          role="img"
          aria-label={`${title}: ${summary}`}
        >
          {series.map((s) => (
            <polyline
              key={s.label}
              points={points(s.values, yMax)}
              fill="none"
              stroke={s.color}
              strokeWidth={1.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
    </figure>
  );
}
