import { useEffect, useState } from 'react';
import { useAuthStore, type BuilderProfile } from '@/store/auth-store';
import {
  checkStudioImport,
  claimStudioImport,
  declineStudioImport,
  type StudioImportCheck,
} from '@/cloud/studio-import';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RBMark } from '@/components/RBMark';
import { ReferralCard } from '@/components/ReferralCard';
import { Loader2, ArrowRight, ArrowLeft, MapPin, User, Cpu, Sparkles, Shield, Package, Users, Gift } from 'lucide-react';

type Step = 'welcome' | 'studio' | 'about' | 'dreams' | 'tech' | 'connect' | 'consent' | 'share';
const STEPS: Step[] = ['welcome', 'about', 'dreams', 'tech', 'connect', 'consent', 'share'];

const textareaClass =
  'w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring';

/**
 * First-sign-in onboarding, adapted from RT Studio's builder profile flow.
 * Grounds the builder in a place — that place (and their dreams for it)
 * becomes context for every build chat. Lands on the builder home.
 */
export function BuilderOnboarding({ onDone }: { onDone?: () => void }) {
  const profile = useAuthStore(s => s.profile);
  const saveProfile = useAuthStore(s => s.saveProfile);

  const [step, setStep] = useState<Step>('welcome');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [neighborhood, setNeighborhood] = useState(profile?.neighborhood ?? '');
  const [neighborhoodDescription, setNeighborhoodDescription] = useState(profile?.neighborhood_description ?? '');
  const [dreams, setDreams] = useState(profile?.dreams ?? '');
  const [techFamiliarity, setTechFamiliarity] = useState(profile?.tech_familiarity ?? '');
  const [aiCodingExperience, setAiCodingExperience] = useState(profile?.ai_coding_experience ?? '');
  const [emailOptIn, setEmailOptIn] = useState<'yes' | 'no' | ''>(
    profile?.email_opt_in === true ? 'yes' : profile?.email_opt_in === false ? 'no' : '',
  );
  const [openToConnecting, setOpenToConnecting] = useState(profile?.open_to_connecting ?? false);
  const [connectNote, setConnectNote] = useState(profile?.connect_note ?? '');
  const [allowRequests, setAllowRequests] = useState(profile?.allow_requests ?? false);
  const [agreedToTerms, setAgreedToTerms] = useState(!!profile?.terms_accepted_at);

  // Known Studio member? Their staged history waits for a yes — the check is
  // server-side, keyed on the verified session email, and quiet on failure.
  const [studio, setStudio] = useState<StudioImportCheck | null>(null);
  const [studioBusy, setStudioBusy] = useState<'claim' | 'decline' | null>(null);
  const [studioImported, setStudioImported] = useState<number | null>(null);
  useEffect(() => {
    checkStudioImport()
      .then(r => { if (r.available) setStudio(r); })
      .catch(() => {});
  }, []);

  const steps: Step[] = studio
    ? ['welcome', 'studio', 'about', 'dreams', 'tech', 'connect', 'consent', 'share']
    : STEPS;
  const index = steps.indexOf(step);
  const goNext = () => setStep(steps[Math.min(index + 1, steps.length - 1)]);
  const goBack = () => setStep(steps[Math.max(index - 1, 0)]);

  async function handleStudioChoice(bring: boolean) {
    setStudioBusy(bring ? 'claim' : 'decline');
    setError(null);
    try {
      if (bring) {
        const r = await claimStudioImport();
        const p = r.profile;
        // Prefill without clobbering anything already typed or saved
        if (p.full_name && !fullName.trim()) setFullName(p.full_name);
        if (p.display_name && !displayName.trim()) setDisplayName(p.display_name);
        if (p.neighborhood && !neighborhood.trim()) setNeighborhood(p.neighborhood);
        if (p.neighborhood_description && !neighborhoodDescription.trim()) {
          setNeighborhoodDescription(p.neighborhood_description);
        }
        if (p.dreams && !dreams.trim()) setDreams(p.dreams);
        if (p.tech_familiarity && !techFamiliarity) setTechFamiliarity(p.tech_familiarity);
        if (p.ai_coding_experience && !aiCodingExperience) setAiCodingExperience(p.ai_coding_experience);
        setStudioImported(r.imported_prompts);
      } else {
        await declineStudioImport();
        goNext();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — try again?');
    } finally {
      setStudioBusy(null);
    }
  }

  async function handleComplete() {
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
      email_opt_in: emailOptIn === 'yes',
      open_to_connecting: openToConnecting,
      connect_note: connectNote.trim() || null,
      allow_requests: openToConnecting ? allowRequests : false,
      // Keep the original agreement timestamp when re-editing a profile
      terms_accepted_at: profile?.terms_accepted_at ?? new Date().toISOString(),
      profile_completed: true,
    };
    const r = await saveProfile(fields);
    setSaving(false);
    if (r.error) setError(r.error);
    // Close on your invite code, not a door slam — unless there isn't one
    // (cloud off / migration not yet applied), then just land in the app
    else if (useAuthStore.getState().profile?.referral_code) setStep('share');
    else onDone?.();
  }

  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground overflow-y-auto">
      {/* Editing an existing profile can be dismissed; first-run completes the flow */}
      {profile?.profile_completed && onDone && (
        <button
          onClick={onDone}
          title="Close"
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-xl leading-none"
        >
          ×
        </button>
      )}
      <div className="min-h-full flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="flex gap-2 mb-8 justify-center">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 w-10 rounded-full transition-colors ${i <= index ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>

          {step === 'welcome' && (
            <div className="text-center space-y-6">
              <RBMark className="size-12 mx-auto" />
              <div className="space-y-3">
                <h1 className="text-2xl font-semibold">Welcome, builder</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Before you start building, tell us a little about you and the
                  place you're building for. Your answers become context for
                  every build — so the tools you make fit where you live.
                </p>
              </div>
              <Button onClick={goNext} className="w-full">
                Get started
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          )}

          {step === 'studio' && studio && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit">
                  <Package className="size-6 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">
                  Welcome back{studio.display_name ? `, ${studio.display_name}` : ''}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  You were part of RT Studio — the Studio has moved into
                  Relational Builder, and we kept your things for you.
                </p>
              </div>

              {studioImported === null ? (
                <>
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground leading-relaxed">
                    Bring over your Studio profile
                    {studio.plan_count > 0 && (
                      <>
                        {' '}and your{' '}
                        <span className="font-medium text-foreground">
                          {studio.plan_count} build plan{studio.plan_count === 1 ? '' : 's'}
                        </span>
                      </>
                    )}
                    ? Your profile answers will prefill the next steps
                    {studio.plan_count > 0 && ', and your build plans will be waiting in your prompt library, ready to build from'}.
                  </div>
                  <div className="space-y-2">
                    <Button
                      onClick={() => handleStudioChoice(true)}
                      disabled={studioBusy !== null}
                      className="w-full"
                    >
                      {studioBusy === 'claim' ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Bringing it over...
                        </>
                      ) : (
                        <>
                          Yes, bring my Studio info over
                          <ArrowRight className="ml-2 size-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleStudioChoice(false)}
                      disabled={studioBusy !== null}
                      className="w-full"
                    >
                      {studioBusy === 'decline' ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        'No thanks, start fresh'
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      "Start fresh" deletes the Studio info we saved for you.
                      Either way, you choose what your Builder profile says next.
                    </p>
                  </div>
                  {error && <p className="text-xs text-destructive text-center">{error}</p>}
                </>
              ) : (
                <>
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed">
                    Done! Your profile answers are filled in — review them in the
                    next steps.
                    {studioImported > 0 && (
                      <>
                        {' '}Your {studioImported} build plan{studioImported === 1 ? '' : 's'} are in
                        your prompt library (Projects → Your prompts), ready to
                        build from.
                      </>
                    )}
                  </div>
                  <Button onClick={goNext} className="w-full">
                    Continue
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </>
              )}
            </div>
          )}

          {step === 'about' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit">
                  <User className="size-6 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">About you</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ob-fullName">Your full name</Label>
                  <Input id="ob-fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="First and last name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ob-displayName">What should we call you?</Label>
                  <Input id="ob-displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Nickname or preferred name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ob-neighborhood" className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    Your neighborhood or place
                  </Label>
                  <Input id="ob-neighborhood" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="e.g., Outer Sunset, San Francisco" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ob-place">Tell us a bit about it (optional)</Label>
                  <textarea
                    id="ob-place"
                    value={neighborhoodDescription}
                    onChange={e => setNeighborhoodDescription(e.target.value)}
                    placeholder="What makes your neighborhood special?"
                    rows={3}
                    className={textareaClass}
                  />
                </div>
              </div>
              <StepNav onBack={goBack} onNext={goNext} />
            </div>
          )}

          {step === 'dreams' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit">
                  <Sparkles className="size-6 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Your dreams</h2>
                <p className="text-muted-foreground text-sm">
                  What are you hoping to build or create for your community?
                </p>
              </div>
              <textarea
                value={dreams}
                onChange={e => setDreams(e.target.value)}
                placeholder="A tool for neighbors to share meals, a website for our community garden, a way to organize block parties..."
                rows={5}
                className={textareaClass}
              />
              <StepNav onBack={goBack} onNext={goNext} />
            </div>
          )}

          {step === 'tech' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit">
                  <Cpu className="size-6 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Tech comfort level</h2>
              </div>
              <div className="space-y-3">
                <Label>How familiar are you with technology?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'new', label: 'New to tech' },
                    { value: 'learning', label: 'Learning' },
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'experienced', label: 'Experienced' },
                  ].map(o => (
                    <Button
                      key={o.value}
                      type="button"
                      variant={techFamiliarity === o.value ? 'default' : 'outline'}
                      className="justify-start"
                      onClick={() => setTechFamiliarity(o.value)}
                    >
                      {o.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Label>Experience with AI coding tools?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'never', label: 'Never tried' },
                    { value: 'a_little', label: 'A little' },
                    { value: 'regular', label: 'Regular use' },
                    { value: 'daily', label: 'Daily' },
                  ].map(o => (
                    <Button
                      key={o.value}
                      type="button"
                      variant={aiCodingExperience === o.value ? 'default' : 'outline'}
                      className="justify-start"
                      onClick={() => setAiCodingExperience(o.value)}
                    >
                      {o.label}
                    </Button>
                  ))}
                </div>
              </div>
              <StepNav onBack={goBack} onNext={goNext} />
            </div>
          )}

          {step === 'connect' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit">
                  <Users className="size-6 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Connect with other builders</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Builders who opt in appear in a directory that only signed-in
                  builders can see. Totally optional — your email is never shown,
                  and you can change this any time on the Connections page.
                </p>
              </div>
              <div className="space-y-4">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={openToConnecting}
                    onChange={e => setOpenToConnecting(e.target.checked)}
                    className="mt-0.5 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="text-sm font-medium block">Show me to other builders</span>
                    <span className="text-xs text-muted-foreground">
                      Your name, neighborhood, and the note below appear in the
                      builders directory.
                    </span>
                  </span>
                </label>
                {openToConnecting && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="ob-connectNote">What you're up for (shown in the directory)</Label>
                      <Input
                        id="ob-connectNote"
                        value={connectNote}
                        onChange={e => setConnectNote(e.target.value)}
                        maxLength={140}
                        placeholder="Happy to talk tool libraries, phone trees, and first builds"
                      />
                    </div>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowRequests}
                        onChange={e => setAllowRequests(e.target.checked)}
                        className="mt-0.5 accent-[var(--primary)]"
                      />
                      <span>
                        <span className="text-sm font-medium block">Allow intro requests</span>
                        <span className="text-xs text-muted-foreground">
                          Builders can send you a short note by email. You get
                          accept/decline links; only if you accept do you both
                          receive an intro email with each other's addresses.
                          Declining is silent.
                        </span>
                      </span>
                    </label>
                  </>
                )}
              </div>
              <StepNav onBack={goBack} onNext={goNext} />
            </div>
          )}

          {step === 'consent' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit">
                  <Shield className="size-6 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Privacy &amp; staying in touch</h2>
                <p className="text-muted-foreground text-sm">
                  Your profile stays private to you and RTP — it's context for
                  your builds, never shared without asking.
                </p>
              </div>
              <div className="space-y-3">
                <Label>
                  Can we be in touch by email with updates, invitations, and
                  messages of encouragement?
                </Label>
                <p className="text-xs text-muted-foreground">
                  You can change your mind any time by emailing us.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={emailOptIn === 'yes' ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => setEmailOptIn('yes')}
                  >
                    Yes, keep me posted
                  </Button>
                  <Button
                    type="button"
                    variant={emailOptIn === 'no' ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => setEmailOptIn('no')}
                  >
                    No, opt me out
                  </Button>
                </div>
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border bg-muted/30 p-3">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={e => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 accent-[var(--primary)]"
                />
                <span className="text-sm">
                  I agree to the{' '}
                  <a
                    href="#privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-primary"
                  >
                    Privacy &amp; Terms
                  </a>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    The short version: we only collect what you share, we never
                    sell it, and you own what you build. The link opens in a new
                    tab so you don't lose your answers.
                  </span>
                </span>
              </label>
              {error && <p className="text-xs text-destructive text-center">{error}</p>}
              <div className="flex gap-3">
                <Button variant="outline" onClick={goBack} className="flex-1">
                  <ArrowLeft className="mr-2 size-4" />
                  Back
                </Button>
                <Button onClick={handleComplete} disabled={saving || emailOptIn === '' || !agreedToTerms} className="flex-1">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Start building
                      <ArrowRight className="ml-2 size-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 'share' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit">
                  <Gift className="size-6 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">You're in — and you hold a key</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Every builder gets a personal invite code. A friend or
                  neighbor who signs up with yours walks straight in — no
                  waiting for approval.
                </p>
              </div>
              <ReferralCard />
              <Button onClick={() => onDone?.()} className="w-full">
                Start building
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepNav({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex gap-3">
      <Button variant="outline" onClick={onBack} className="flex-1">
        <ArrowLeft className="mr-2 size-4" />
        Back
      </Button>
      <Button onClick={onNext} className="flex-1">
        Next
        <ArrowRight className="ml-2 size-4" />
      </Button>
    </div>
  );
}
