import { useEffect, useState } from 'react';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { CircleUser, MailCheck, LogOut, MapPin, Palette, HeartHandshake, Sun, Moon, SlidersHorizontal, DoorOpen } from 'lucide-react';
import { BuilderOnboarding } from '@/components/BuilderOnboarding';
import { useUIStore } from '@/store/ui-store';
import { useConnectionsStore } from '@/store/connections-store';
import { isSuperAdmin } from '@/cloud/account-requests';
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

  const [editingProfile, setEditingProfile] = useState(false);
  const [editingStyle, setEditingStyle] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const setStewardOpen = useUIStore(st => st.setStewardOpen);
  const setConnectionsOpen = useUIStore(st => st.setConnectionsOpen);
  const [themeMode, setThemeState] = useState<ThemeMode>(getThemeMode);

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

  if (!user) return <SignInDialog />;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' h-7 gap-1 text-xs relative'}
          title={inboxCount > 0 ? `${user.email} — connection requests waiting` : user.email}
        >
          <CircleUser className="size-3.5" />
          {profile?.display_name?.trim() || user.email.split('@')[0]}
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
                Building in {profile.neighborhood}
              </p>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditingProfile(true)} className="gap-2 text-xs">
            <MapPin className="size-3.5 text-muted-foreground" />
            Builder profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditingStyle(true)} className="gap-2 text-xs">
            <Palette className="size-3.5 text-muted-foreground" />
            Your style
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setConnectionsOpen(true)} className="gap-2 text-xs">
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
          {isSuperAdmin(user.email) && (
            <DropdownMenuItem onClick={() => setStewardOpen(true)} className="gap-2 text-xs">
              <DoorOpen className="size-3.5 text-muted-foreground" />
              Steward
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()} className="gap-2 text-xs">
            <LogOut className="size-3.5 text-muted-foreground" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editingProfile && <BuilderOnboarding onDone={() => setEditingProfile(false)} />}
      {editingStyle && <DesignSystemDialog open={editingStyle} onOpenChange={setEditingStyle} />}
      {settingsOpen && <ProviderSettings open={settingsOpen} onOpenChange={setSettingsOpen} hideTrigger />}
    </>
  );
}

function SignInDialog() {
  const signIn = useAuthStore(s => s.signIn);
  const signInPromptCount = useAuthStore(s => s.signInPromptCount);

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
    if (signInPromptCount > 0) setOpen(true);
  }, [signInPromptCount]);

  async function handleSignIn() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    const { error: err } = await signIn(trimmed);
    setSending(false);
    if (err) setError(err);
    else setSent(true);
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
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' h-7 gap-1 text-xs'}
        title="Sign in"
      >
        <CircleUser className="size-3.5" />
        Sign in
      </DialogTrigger>
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
              We sent a sign-in link to <strong>{email}</strong> — tap it, or
              type the 6-digit code from that email here. No password needed.
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
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Sign in to save projects to the cloud, work across devices, and
              invite collaborators. We'll email you a sign-in link.
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
