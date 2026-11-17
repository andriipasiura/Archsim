import { DIAGRAM_NAME_MAX_LENGTH } from '@sds/shared';
import { LogIn, LogOut, Save } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/IconButton';
import { PROVIDER_LABELS } from '../constants';
import { useAccount } from '../store';
import { DiagramsDialog } from './DiagramsDialog';
import { HistoryDialog } from './HistoryDialog';
import { SignInDialog } from './SignInDialog';

export function AccountBar() {
  const { status, user, name, link, busy, providers } = useAccount(
    useShallow(({ status, user, name, link, busy, providers }) => ({
      status,
      user,
      name,
      link,
      busy,
      providers,
    })),
  );
  const { setName, save, requestSignIn, signOut } = useAccount.getState();
  const [onlyProvider] = providers;
  const signInLabel =
    providers.length === 1 && onlyProvider
      ? `Sign in with ${PROVIDER_LABELS[onlyProvider]}`
      : 'Sign in';

  if (status === 'loading') return null;

  return (
    <div className="ml-auto flex items-center gap-2">
      {user && (
        <>
          <Input
            aria-label="Diagram name"
            className="h-8 w-48"
            value={name}
            maxLength={DIAGRAM_NAME_MAX_LENGTH}
            onChange={(e) => setName(e.target.value)}
          />
          {link && (
            <span className="text-xs text-muted-foreground tabular-nums">
              v{link.version}
            </span>
          )}
        </>
      )}
      <IconButton
        label="Save"
        {...(!user &&
          providers.length > 0 && { hint: '(asks you to sign in)' })}
        variant="default"
        disabled={busy}
        onClick={() => void save()}
      >
        <Save />
      </IconButton>
      {user ? (
        <>
          <DiagramsDialog />
          {link && <HistoryDialog link={link} />}
          <span className="flex items-center gap-1.5 text-sm">
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt=""
                className="size-6 rounded-full"
              />
            )}
            {user.login}
          </span>
          <IconButton label="Sign out" onClick={() => void signOut()}>
            <LogOut />
          </IconButton>
        </>
      ) : (
        providers.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => requestSignIn(false)}
          >
            <LogIn aria-hidden /> {signInLabel}
          </Button>
        )
      )}
      <SignInDialog />
    </div>
  );
}
