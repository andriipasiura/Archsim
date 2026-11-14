import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useId } from 'react';
import { useNumberDraft, type NumberRules } from '../hooks/use-draft-field';

interface NumberFieldProps extends NumberRules {
  label: string;
  unit: string;
  value: number;
  commit: (value: number) => void;
}

export function NumberField({
  label,
  unit,
  value,
  min,
  max,
  integer,
  commit,
}: NumberFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const { inputProps, error } = useNumberDraft({
    value,
    min,
    max,
    integer,
    commit,
  });

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {unit && (
          <span className="font-normal text-muted-foreground">({unit})</span>
        )}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode={integer ? 'numeric' : 'decimal'}
        min={min}
        max={max}
        step={integer ? 1 : 'any'}
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
