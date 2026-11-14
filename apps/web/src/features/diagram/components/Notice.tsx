import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TriangleAlert, X } from 'lucide-react';
import { useNotice } from '../hooks/use-notice';

export function Notice() {
  const { notice, dismiss } = useNotice();
  if (!notice) return null;
  return (
    <Alert role="status">
      <TriangleAlert aria-hidden />
      <AlertDescription className="max-h-32 overflow-auto whitespace-pre-line">
        {notice}
      </AlertDescription>
      <AlertAction>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={dismiss}
          aria-label="Dismiss message"
        >
          <X aria-hidden />
        </Button>
      </AlertAction>
    </Alert>
  );
}
