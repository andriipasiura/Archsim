import { useId, useMemo } from 'react';
import { Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SCENARIO_LIMITS } from '../constants';
import { useSimulation, type ChartPoint } from '../store';
import { MetricChart } from './MetricChart';

const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const formatMs = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
const formatPercent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

export function SimulationPanel() {
  return (
    <section
      className="flex h-full gap-3 bg-sidebar p-3 text-sidebar-foreground"
      aria-label="Simulation"
    >
      <ScenarioForm />
      <Charts />
    </section>
  );
}

function ScenarioForm() {
  const status = useSimulation((s) => s.status);
  const scenario = useSimulation((s) => s.scenario);
  const timeSec = useSimulation((s) => s.latest?.timeSec ?? 0);
  const { start, stop, setScenario } = useSimulation.getState();
  const running = status === 'running';

  return (
    <div className="flex w-60 shrink-0 flex-col gap-2">
      <Slider
        label="Load"
        value={scenario.rps}
        display={`${compact.format(scenario.rps)} rps`}
        {...SCENARIO_LIMITS.rps}
        onChange={(rps) => setScenario({ rps })}
      />
      <Slider
        label="Reads"
        value={scenario.readRatio}
        display={`${Math.round(scenario.readRatio * 100)}%`}
        {...SCENARIO_LIMITS.readRatio}
        onChange={(readRatio) => setScenario({ readRatio })}
      />
      <Slider
        label="Duration"
        value={scenario.durationSec}
        display={`${scenario.durationSec} s`}
        {...SCENARIO_LIMITS.durationSec}
        onChange={(durationSec) => setScenario({ durationSec })}
      />
      <div className="mt-auto flex items-center gap-2">
        <Button
          size="sm"
          variant={running ? 'secondary' : 'default'}
          onClick={running ? stop : start}
        >
          {running ? <Square aria-hidden /> : <Play aria-hidden />}
          {running ? 'Stop' : 'Run'}
        </Button>
        <span
          className="text-xs text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {status === 'idle' ? 'Idle' : `${timeSec.toFixed(1)} s`}
          {status === 'finished' && ' · finished'}
        </span>
      </div>
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function Slider({ label, value, display, onChange, ...range }: SliderProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {display}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="accent-primary"
        value={value}
        aria-valuetext={display}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        {...range}
      />
    </div>
  );
}

function column(history: readonly ChartPoint[], key: keyof ChartPoint) {
  return history.map((p) => p[key]);
}

function Charts() {
  const history = useSimulation((s) => s.history);
  const charts = useMemo(
    () => ({
      latency: [
        {
          label: 'p95',
          color: 'var(--chart-1)',
          values: column(history, 'p95Ms'),
        },
        {
          label: 'p99',
          color: 'var(--chart-2)',
          values: column(history, 'p99Ms'),
        },
      ],
      rps: [
        {
          label: 'offered',
          color: 'var(--muted-foreground)',
          values: column(history, 'offeredRps'),
        },
        {
          label: 'ok',
          color: 'var(--status-ok)',
          values: column(history, 'throughputRps'),
        },
      ],
      errors: [
        {
          label: 'errors',
          color: 'var(--status-critical)',
          values: column(history, 'errorRate'),
        },
      ],
    }),
    [history],
  );

  return (
    <div className="grid min-w-0 flex-1 grid-cols-3 gap-3">
      <MetricChart
        title="Latency"
        series={charts.latency}
        format={formatMs}
        minMax={50}
      />
      <MetricChart
        title="Throughput"
        series={charts.rps}
        format={(v) => `${compact.format(v)} rps`}
        minMax={100}
      />
      <MetricChart
        title="Error rate"
        series={charts.errors}
        format={formatPercent}
        minMax={0.01}
      />
    </div>
  );
}
