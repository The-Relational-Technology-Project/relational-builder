import { useState } from 'react';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CircleUser, MailCheck, LogOut, MapPin, Palette } from 'lucide-react';
import { BuilderOnboarding } from '@/components/BuilderOnboarding';
import { DesignSystemDialog } from '@/components/DesignSystemDialog';

/**
 * Sign in / account dialog. Magic-link email auth — no passwords.
 * Hidden entirely when cloud features aren't configured.
 */
export function AccountMenu() {
  const user = useAuthStore(s => s.user);
  const signIn = useAuthStore(s => s.signIn);
  const signOut = useAuthStore(s => s.signOut);

  const profile = useAuthStore(s => s.profile);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingStyle, setEditingStyle] = useState(false);

  if (!cloudEnabled) return null;

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
        title={user ? user.email : 'Sign in'}
      >
        <CircleUser className="size-3.5" />
        {user ? user.email.split('@')[0] : 'Sign in'}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{user ? 'Account' : 'Sign in'}</DialogTitle>
        </DialogHeader>

        {user ? (
          <div className="space-y-3">
            <p className="text-sm">
              Signed in as <span className="font-medium">{user.email}</span>
            </p>
            {profile?.neighborhood && (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <MapPin className="size-3" />
                Building in {profile.neighborhood}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Your projects save to the cloud and sync with anyone you invite.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setOpen(false);
                  setEditingProfile(true);
                }}
              >
                <MapPin className="size-3.5" />
                Builder profile
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setOpen(false);
                  setEditingStyle(true);
                }}
              >
                <Palette className="size-3.5" />
                Your style
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={async () => {
                  await signOut();
                  setOpen(false);
                }}
              >
                <LogOut className="size-3.5" />
                Sign out
              </Button>
            </div>
          </div>
        ) : sent ? (
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
      {editingProfile && <BuilderOnboarding onDone={() => setEditingProfile(false)} />}
      {editingStyle && <DesignSystemDialog open={editingStyle} onOpenChange={setEditingStyle} />}
    </Dialog>
  );
}
