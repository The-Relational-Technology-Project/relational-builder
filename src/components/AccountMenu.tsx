import { useEffect, useState } from 'react';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CircleUser, MailCheck, LogOut, MapPin, Palette, HeartHandshake, Sun, Moon, SlidersHorizontal, DoorOpen, KeyRound } from 'lucide-react';
import { useUIStore } from '@/store/ui-store';
import { useCloudStore, readCloudAttachment } from '@/store/cloud-store';
import { useChatStore } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';
import { useEnvStore } from '@/store/env-store';
import { stashAndStartFresh } from '@/project/local-projects';
import { useConnectionsStore } from '@/store/connections-store';
import { isSuperAdmin } from '@/cloud/account-requests';
import { useStudioStore, adminMemberships } from '@/store/studio-store';
import { DesignSystemDialog } from '@/components/DesignSystemDialog';
import { ProviderSettings } from '@/components/ProviderSettings';
import { getThemeMode, setThemeMode, type ThemeMode } from '@/theme';

/**
 * Account: signed out it's a magic-link sign-in dialog (no passwords);
 * signed in it's a compact menu — who you are, where you build, and the
 * doors into profile, style, and connections.
 */
export function AccountMenu() {
  const user = useAuthStore(s => s.user);
  const profile = useAuthStore(s => s.profile);
  const signOut = useAuthStore(s => s.signOut);

  const [editingStyle, setEditingStyle] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const setView = useUIStore(st => st.setView);
  const [themeMode, setThemeState] = useState<ThemeMode>(getThemeMode);

  // Studio Admins get their console in the menu — a role the steward grants
  const memberships = useStudioStore(s => s.memberships);
  const isStudioAdmin = adminMemberships(memberships).length > 0;

  // The friendly signal that something's waiting on the Connections page —
  // a warm dot on your name, never a red alarm
  const inboxCount = useConnectionsStore(s => s.inbox.length);
  const refreshInbox = useConnectionsStore(s => s.refreshInbox);
  useEffect(() => {
    if (user) refreshInbox();
  }, [user, refreshInbox]);

  function toggleTheme() {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    setThemeState(next);
  }

  if (!cloudEnabled) return null;

  if (!user) return <SignInButton />;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' h-7 gap-1 text-xs relative'}
          title={inboxCount > 0 ? `${user.email} — connection requests waiting` : user.email}
        >
          <CircleUser className="size-3.5 shrink-0" />
          {/* A display name someone chose for themselves can be any length —
              bounded so it can't push the rest of the header off the edge */}
          <span className="max-w-[8rem] truncate">
            {profile?.display_name?.trim() || user.email.split('@')[0]}
          </span>
          {inboxCount > 0 && (
            <>
              <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary" aria-hidden />
              <span className="sr-only">
                {inboxCount} connection request{inboxCount === 1 ? '' : 's'} waiting
              </span>
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium truncate">{user.email}</p>
            {profile?.neighborhood && (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                <MapPin className="size-3" />
                {profile.neighborhood.replace(/\bSan Francisco\b/gi, 'SF')}
              </p>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* An editable page, not a re-run of the onboarding wizard */}
          <DropdownMenuItem onClick={() => setView('profile')} className="gap-2 text-xs">
            <MapPin className="size-3.5 text-muted-foreground" />
            Builder profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditingStyle(true)} className="gap-2 text-xs">
            <Palette className="size-3.5 text-muted-foreground" />
            Your style
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setView('connections')} className="gap-2 text-xs">
            <HeartHandshake className="size-3.5 text-muted-foreground" />
            Connections
            {inboxCount > 0 && (
              <span className="ml-auto rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                {inboxCount}
              </span>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={toggleTheme} className="gap-2 text-xs">
            {themeMode === 'dark' ? (
              <Sun className="size-3.5 text-muted-foreground" />
            ) : (
              <Moon className="size-3.5 text-muted-foreground" />
            )}
            {themeMode === 'dark' ? 'Light mode' : 'Dark mode'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="gap-2 text-xs">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            Models & API keys
          </DropdownMenuItem>
          {isStudioAdmin && (
            <DropdownMenuItem onClick={() => setView('studio-admin')} className="gap-2 text-xs">
              <KeyRound className="size-3.5 text-muted-foreground" />
              Studio admin
            </DropdownMenuItem>
          )}
          {isSuperAdmin(user.email) && (
            <DropdownMenuItem onClick={() => setView('steward')} className="gap-2 text-xs">
              <DoorOpen className="size-3.5 text-muted-foreground" />
              Steward
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              // Signing out closes the desk, not the account: a cloud
              // project stays on the account (final edits flushed, then
              // detached) — never copied onto the device, which is how
              // duplicate projects used to be born. Only work that never
              // reached the account is kept on the device shelf.
              const cloud = useCloudStore.getState();
              if (cloud.currentProjectId || readCloudAttachment()) {
                cloud.closeProject();
              } else {
                stashAndStartFresh();
              }
              useChatStore.getState().clearMessages();
              useProjectStore.getState().clearProject();
              useEnvStore.getState().clearAll();
              setView('builder'); // an empty builder greets the welcome hero
              signOut();
            }}
            className="gap-2 text-xs"
          >
            <LogOut className="size-3.5 text-muted-foreground" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editingStyle && <DesignSystemDialog open={editingStyle} onOpenChange={setEditingStyle} />}
      {settingsOpen && <ProviderSettings open={settingsOpen} onOpenChange={setSettingsOpen} hideTrigger />}
    </>
  );
}

/**
 * The header's "Sign in" — a trigger, not the dialog.
 *
 * AccountMenu is mounted twice (the desktop header and the mobile sheet, one
 * of them CSS-hidden), and a Radix dialog portals to the body regardless of
 * whether its parent is hidden. So a self-contained dialog here opened twice,
 * stacked, and the close button only dismissed the copy on top — the second
 * one sat there looking like the X had done nothing. The dialog itself is a
 * singleton now (SignInDialogHost, mounted once in App); every trigger just
 * asks the store to open it.
 */
function SignInButton() {
  return (
    <button
      className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' h-7 gap-1 text-xs'}
      title="Sign in"
      onClick={() => useAuthStore.getState().promptSignIn()}
    >
      <CircleUser className="size-3.5" />
      Sign in
    </button>
  );
}

/**
 * The one sign-in dialog. Mounted once, opened from anywhere by
 * `promptSignIn()` — which can carry the address to prefill (an invite link
 * knows exactly which one, and asking someone to retype it is a step they can
 * only get wrong).
 */
export function SignInDialogHost() {
  const signIn = useAuthStore(s => s.signIn);
  const user = useAuthStore(s => s.user);
  const signInPromptCount = useAuthStore(s => s.signInPromptCount);
  const signInPromptEmail = useAuthStore(s => s.signInPromptEmail);
  // Why the dialog opened on its own — e.g. the magic link came back spent
  const notice = useAuthStore(s => s.signInPromptNotice);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Anywhere in the app can ask for the sign-in dialog (e.g. the home
  // hero's "sign in to start building" hint)
  useEffect(() => {
    if (signInPromptCount === 0) return;
    // An invite knows exactly which address it was sent to — asking the person
    // to retype it (correctly) is a step they can only get wrong
    if (signInPromptEmail) setEmail(signInPromptEmail);
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire on prompt, not on email edits
  }, [signInPromptCount]);

  async function handleSignIn() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    const { error: err } = await signIn(trimmed);
    setSending(false);
    if (err) setError(err);
    else {
      setSent(true);
      // A fresh email is on its way — the notice about the old one is done
      useAuthStore.getState().clearSignInNotice();
    }
  }

  // The magic link can open in the mail app's own browser (especially on
  // phones), stranding the session away from this tab — the 6-digit code
  // from the same email signs in right here instead.
  async function handleVerifyCode() {
    const trimmed = code.trim();
    if (trimmed.length < 6) return;
    setVerifying(true);
    setError(null);
    const { error: err } = await useAuthStore.getState().verifyCode(email.trim(), trimmed);
    setVerifying(false);
    if (err) setError(err);
    else setOpen(false);
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setSent(false);
      setError(null);
      setCode('');
      useAuthStore.getState().clearSignInNotice();
    }
  }

  // Signing in is the end of this dialog's job
  useEffect(() => {
    if (user) setOpen(false);
  }, [user]);

  if (!cloudEnabled) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MailCheck className="size-4 text-green-600" />
              Check your email
            </div>
            <p className="text-xs text-muted-foreground">
              We sent a 6-digit code to <strong>{email}</strong> — type it
              here to sign in. No password needed.
            </p>
            <div className="flex gap-2">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={e => { setCode(e.target.value); setError(null); }}
                onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
                placeholder="6-digit code"
                className="text-center tracking-[0.3em] placeholder:tracking-normal"
              />
              <Button
                size="sm"
                className="h-9"
                onClick={handleVerifyCode}
                disabled={verifying || code.trim().length < 6}
              >
                {verifying ? 'Checking…' : 'Sign in'}
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              The email has a sign-in link too, but the typed code is the sure
              path — some inboxes (especially work ones) scan links and use
              them up.
            </p>
            <p className="text-xs text-muted-foreground">
              Not seeing the email? Check your spam or junk folder — look for
              &ldquo;Relational Builder&rdquo;.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notice && (
              <p className="text-xs rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-amber-700 dark:text-amber-400">
                {notice}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Sign in to save projects to the cloud, work across devices, and
              invite collaborators. We'll email you a 6-digit code and a
              sign-in link.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="auth-email" className="text-xs">Email</Label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                placeholder="you@example.org"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button size="sm" onClick={handleSignIn} disabled={sending || !email.trim()}>
              {sending ? 'Sending...' : 'Send sign-in link'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
