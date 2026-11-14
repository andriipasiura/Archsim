import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { FIELD_KEYS } from '../constants';
import { MESSAGES } from '../messages';

function useSyncedDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  return [draft, setDraft] as const;
}

function draftInputProps(
  draft: string,
  setDraft: (v: string) => void,
  commit: () => void,
  revert: () => void,
) {
  return {
    value: draft,
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      setDraft(event.target.value),
    onBlur: commit,
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === FIELD_KEYS.commit) commit();
      if (event.key === FIELD_KEYS.revert) revert();
    },
  };
}

export function useTextDraft({
  value,
  commit,
}: {
  value: string;
  commit: (value: string) => void;
}) {
  const [draft, setDraft] = useSyncedDraft(value);
  return draftInputProps(
    draft,
    setDraft,
    () => commit(draft.trim()),
    () => setDraft(value),
  );
}

export interface NumberRules {
  min: number;
  max: number | undefined;
  integer: boolean;
}

export function validateNumber(
  text: string,
  { min, max, integer }: NumberRules,
): string | null {
  const n = Number(text);
  if (text.trim() === '' || !Number.isFinite(n)) return MESSAGES.numberRequired;
  if (integer && !Number.isInteger(n)) return MESSAGES.integerRequired;
  if (n < min) return MESSAGES.minimum(min);
  if (max !== undefined && n > max) return MESSAGES.maximum(max);
  return null;
}

export function useNumberDraft({
  value,
  commit,
  ...rules
}: NumberRules & { value: number; commit: (value: number) => void }) {
  const [draft, setDraft] = useSyncedDraft(String(value));
  const [error, setError] = useState<string | null>(null);

  const inputProps = draftInputProps(
    draft,
    setDraft,
    () => {
      const problem = validateNumber(draft, rules);
      setError(problem);
      if (problem === null) commit(Number(draft));
    },
    () => {
      setDraft(String(value));
      setError(null);
    },
  );
  return { inputProps, error };
}
