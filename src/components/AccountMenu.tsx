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
import { CircleUser, MailCheck, LogOut, MapPin, Palette, HeartHandshake } from 'lucide-react';
import { BuilderOnboarding } from '@/components/BuilderOnboarding';
import { DesignSystemDialog } from '@/components/DesignSystemDialog';
import { ConnectionsDialog } from '@/components/ConnectionsDialog';

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
  const [editingConnections, setEditingConnections] = useState(false);

  if (!cloudEnabled) return null;

  if (!user) return <SignInDialog />;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' h-7 gap-1 text-xs'}
          title={user.email}
        >
          <CircleUser className="size-3.5" />
          {profile?.display_name?.trim() || user.email.split('@')[0]}
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
          <DropdownMenuItem onClick={() => setEditingConnections(true)} className="gap-2 text-xs">
            <HeartHandshake className="size-3.5 text-muted-foreground" />
            Connections
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()} className="gap-2 text-xs">
            <LogOut className="size-3.5 text-muted-foreground" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editingProfile && <BuilderOnboarding onDone={() => setEditingProfile(false)} />}
      {editingStyle && <DesignSystemDialog open={editingStyle} onOpenChange={setEditingStyle} />}
      {editingConnections && <ConnectionsDialog open={editingConnections} onOpenChange={setEditingConnections} />}
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

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setSent(false);
      setError(null);
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
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MailCheck className="size-4 text-green-600" />
              Check your email
            </div>
            <p className="text-xs text-muted-foreground">
              We sent a sign-in link to <strong>{email}</strong>. Open it in this
              browser and you'll be signed in — no password needed.
            </p>
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
