import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PROVIDER_LABELS } from '../constants';
import { useAccount } from '../store';

export function SignInDialog() {
  const prompt = useAccount((s) => s.signInPrompt);
  const providers = useAccount((s) => s.providers);
  const { signIn, closeSignInPrompt } = useAccount.getState();

  return (
    <Dialog
      open={prompt !== null}
      onOpenChange={(open) => !open && closeSignInPrompt()}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>
            {prompt?.saveAfter
              ? 'Sign in to save this diagram to your account. It stays on this page while you sign in.'
              : 'Sign in to save diagrams and open them on any device.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {providers.map((provider) => (
            <Button
              key={provider}
              variant="outline"
              onClick={() => signIn(provider, prompt?.saveAfter ?? false)}
            >
              <LogIn aria-hidden /> Continue with {PROVIDER_LABELS[provider]}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
