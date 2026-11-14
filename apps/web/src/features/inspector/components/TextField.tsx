import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useId } from 'react';
import { useTextDraft } from '../hooks/use-draft-field';

interface TextFieldProps {
  label: string;
  value: string;
  maxLength: number;
  commit: (value: string) => void;
}

export function TextField({ label, value, maxLength, commit }: TextFieldProps) {
  const id = useId();
  const inputProps = useTextDraft({ value, commit });
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="text" maxLength={maxLength} {...inputProps} />
    </div>
  );
}
