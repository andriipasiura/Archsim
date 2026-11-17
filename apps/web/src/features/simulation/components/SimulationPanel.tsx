import { useId, useMemo } from 'react';
import { SCENARIO_LIMITS } from '@sds/shared';
import { Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useSignedIn } from '@/features/account';
import { SERVER_MODE_NEEDS_SIGN_IN } from '../messages';
import { useSimulation, type ChartPoint } from '../store';
import type { SimulationMode } from '../transport';
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
  const storedMode = useSimulation((s) => s.mode);
  const signedIn = useSignedIn();
  const { start, stop, setScenario, setMode } = useSimulation.getState();
  const running = status === 'running';
  const mode = signedIn ? storedMode : 'local';

  return (
    <div className="flex w-60 shrink-0 flex-col gap-2">
      <ModeToggle
        mode={mode}
        disabled={running}
        serverAvailable={signedIn}
        onChange={setMode}
      />
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
          onClick={running ? stop : () => start(mode)}
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

const MODES: { value: SimulationMode; label: string }[] = [
  { value: 'local', label: 'Browser' },
  { value: 'server', label: 'Server' },
];

interface ModeToggleProps {
  mode: SimulationMode;
  disabled: boolean;
  serverAvailable: boolean;
  onChange: (mode: SimulationMode) => void;
}

function ModeToggle({
  mode,
  disabled,
  serverAvailable,
  onChange,
}: ModeToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium">Run in</span>
      <div role="radiogroup" aria-label="Run in" className="flex gap-1">
        {MODES.map(({ value, label }) => {
          const locked = value === 'server' && !serverAvailable;
          return (
            <Button
              key={value}
              size="xs"
              role="radio"
              aria-checked={mode === value}
              variant={mode === value ? 'secondary' : 'ghost'}
              disabled={disabled || locked}
              title={locked ? SERVER_MODE_NEEDS_SIGN_IN : undefined}
              onClick={() => onChange(value)}
            >
              {label}
            </Button>
          );
        })}
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
