import { useEffect, useState } from 'react';
import { useAuthStore, type BuilderProfile } from '@/store/auth-store';
import { useStudioStore, approvedMemberships } from '@/store/studio-store';
import type { StudioContext } from '@/knowledge/studio-context';
import { useUIStore } from '@/store/ui-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  CircleUser,
  MapPin,
  Sparkles,
  Cpu,
  Shield,
  Check,
  Loader2,
  HeartHandshake,
  Landmark,
} from 'lucide-react';

const textareaClass =
  'w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring';

/**
 * The builder's profile as a page — read it, edit it, save it. Identity
 * lives here: who you are, the place you build for, and which studio frames
 * your building. The onboarding wizard is a one-time on-ramp that fills
 * this page in; editing never means re-walking that flow.
 */
export function ProfilePage() {
  const user = useAuthStore(s => s.user);
  const profile = useAuthStore(s => s.profile);
  const saveProfile = useAuthStore(s => s.saveProfile);
  const setView = useUIStore(s => s.setView);

  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [neighborhoodDescription, setNeighborhoodDescription] = useState('');
  const [dreams, setDreams] = useState('');
  const [techFamiliarity, setTechFamiliarity] = useState('');
  const [aiCodingExperience, setAiCodingExperience] = useState('');
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate once from the loaded profile (not on every remote refresh —
  // mid-edit clobbering would be worse than a stale field)
  useEffect(() => {
    if (!profile || hydrated) return;
    setFullName(profile.full_name ?? '');
    setDisplayName(profile.display_name ?? '');
    setNeighborhood(profile.neighborhood ?? '');
    setNeighborhoodDescription(profile.neighborhood_description ?? '');
    setDreams(profile.dreams ?? '');
    setTechFamiliarity(profile.tech_familiarity ?? '');
    setAiCodingExperience(profile.ai_coding_experience ?? '');
    setEmailOptIn(profile.email_opt_in === true);
    setHydrated(true);
  }, [profile, hydrated]);

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 text-center">
        <div className="space-y-3">
          <CircleUser className="size-8 mx-auto text-muted-foreground/70" />
          <p className="text-sm text-muted-foreground">
            Sign in (top right) to see and edit your builder profile.
          </p>
        </div>
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const fields: Partial<BuilderProfile> = {
      full_name: fullName.trim() || null,
      display_name: displayName.trim() || null,
      neighborhood: neighborhood.trim() || null,
      neighborhood_description: neighborhoodDescription.trim() || null,
      dreams: dreams.trim() || null,
      tech_familiarity: techFamiliarity || null,
      ai_coding_experience: aiCodingExperience || null,
      email_opt_in: emailOptIn,
      profile_completed: true,
    };
    const r = await saveProfile(fields);
    setSaving(false);
    if (r.error) {
      setError(r.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-10">
        <div className="flex items-center gap-2.5">
          <CircleUser className="size-6 text-primary shrink-0" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Builder profile</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
          </div>
        </div>

        {/* About you */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            <MapPin className="size-3.5" />
            You &amp; your place
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pf-fullName" className="text-xs">Full name</Label>
              <Input id="pf-fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="First and last name" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-displayName" className="text-xs">What should we call you?</Label>
              <Input id="pf-displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Nickname or preferred name" className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-neighborhood" className="text-xs">Your neighborhood or place</Label>
            <Input id="pf-neighborhood" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="e.g., Outer Sunset, San Francisco" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-place" className="text-xs">A bit about it (optional)</Label>
            <textarea
              id="pf-place"
              value={neighborhoodDescription}
              onChange={e => setNeighborhoodDescription(e.target.value)}
              placeholder="What makes your neighborhood special?"
              rows={2}
              className={textareaClass}
            />
          </div>
        </section>

        {/* Dreams */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            <Sparkles className="size-3.5" />
            Your dreams
          </h2>
          <p className="text-xs text-muted-foreground">
            What you're hoping to build or create for your community — this
            becomes context for every build chat.
          </p>
          <textarea
            value={dreams}
            onChange={e => setDreams(e.target.value)}
            placeholder="A tool for neighbors to share meals, a website for our community garden, a way to organize block parties..."
            rows={3}
            className={textareaClass}
          />
        </section>

        {/* Tech comfort */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            <Cpu className="size-3.5" />
            Tech comfort
          </h2>
          <div className="space-y-2">
            <Label className="text-xs">How familiar are you with technology?</Label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 'new', label: 'New to tech' },
                { value: 'learning', label: 'Learning' },
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'experienced', label: 'Experienced' },
              ].map(o => (
                <Button
                  key={o.value}
                  type="button"
                  size="sm"
                  variant={techFamiliarity === o.value ? 'default' : 'outline'}
                  className="h-8 text-xs"
                  onClick={() => setTechFamiliarity(o.value)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Experience with AI coding tools?</Label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 'never', label: 'Never tried' },
                { value: 'a_little', label: 'A little' },
                { value: 'regular', label: 'Regular use' },
                { value: 'daily', label: 'Daily' },
              ].map(o => (
                <Button
                  key={o.value}
                  type="button"
                  size="sm"
                  variant={aiCodingExperience === o.value ? 'default' : 'outline'}
                  className="h-8 text-xs"
                  onClick={() => setAiCodingExperience(o.value)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Email + privacy */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            <Shield className="size-3.5" />
            Privacy &amp; staying in touch
          </h2>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={emailOptIn}
              onChange={e => setEmailOptIn(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>
              Email me updates, invitations, and messages of encouragement
              <span className="block text-xs text-muted-foreground">
                Your profile stays private to you and RTP — it's context for
                your builds, never shared without asking.
              </span>
            </span>
          </label>
        </section>

        {/* Save */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : saved ? <Check className="size-3.5" /> : null}
            {saved ? 'Saved' : 'Save profile'}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <StudioSection />

        {/* Where the rest lives */}
        <section className="space-y-2 border-t pt-6">
          <button
            onClick={() => setView('connections')}
            className="flex items-center gap-1.5 text-sm underline underline-offset-2 text-muted-foreground hover:text-foreground"
          >
            <HeartHandshake className="size-3.5" />
            Connection settings — whether other builders can find and reach you
          </button>
        </section>
      </div>
    </div>
  );
}

/**
 * Studio affiliation, owned by the profile page — the studio frame is part
 * of who a builder is, not a nav-bar mode. Most builders live in the default
 * Relational Tech Studio and never think about it; those invited into a
 * studio (via its invite link) switch or join here.
 */
function StudioSection() {
  const activeStudio = useStudioStore(s => s.activeStudio);
  const studios = useStudioStore(s => s.studios);
  const memberships = useStudioStore(s => s.memberships);
  const setStudio = useStudioStore(s => s.setStudio);
  const joinStudio = useStudioStore(s => s.joinStudio);
  const [busy, setBusy] = useState<string | null>(null);

  // A deep-linked studio that isn't publicly listed still shows for its members
  const options: StudioContext[] =
    activeStudio && !studios.some(s => s.slug === activeStudio.slug)
      ? [activeStudio, ...studios]
      : studios;

  if (options.length === 0) return null;

  const approved = new Set(approvedMemberships(memberships).map(m => m.studio_slug));
  const pending = new Set(
    memberships.filter(m => m.status === 'pending').map(m => m.studio_slug),
  );

  async function activate(studio: StudioContext) {
    setBusy(studio.slug);
    // Belonging and building-in go together: activating a studio you're not
    // yet part of also files the join (instant for open studios, a request
    // for gated ones)
    if (!approved.has(studio.slug) && !pending.has(studio.slug)) {
      await joinStudio(studio);
    }
    setStudio(studio);
    setBusy(null);
  }

  return (
    <section className="space-y-3 border-t pt-6">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground uppercase tracking-wide">
        <Landmark className="size-3.5" />
        Your studio
      </h2>
      <p className="text-xs text-muted-foreground max-w-prose">
        Every project builds inside a studio frame — its principles and
        lineage travel with your work, with the global commons underneath.
        Invited to a studio? Its invite link brings it here automatically.
      </p>
      <div className="space-y-2">
        {options.map(studio => {
          const isActive = activeStudio?.slug === studio.slug;
          const isPending = pending.has(studio.slug);
          return (
            <div
              key={studio.slug}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 ${
                isActive ? 'border-primary/50 bg-primary/5' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ background: studio.color ?? 'hsl(var(--muted-foreground))' }}
                />
                <span className="text-sm font-medium truncate">{studio.label}</span>
                {isPending && (
                  <Badge variant="outline" className="text-xs">request pending</Badge>
                )}
              </div>
              {isActive ? (
                <Badge variant="secondary" className="text-xs shrink-0">Building here</Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  disabled={busy !== null}
                  onClick={() => activate(studio)}
                >
                  {busy === studio.slug ? <Loader2 className="size-3 animate-spin" /> : 'Build here'}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground/70">More studios on the way.</p>
    </section>
  );
}
