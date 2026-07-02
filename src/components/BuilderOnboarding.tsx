import { useState } from 'react';
import { useAuthStore, type BuilderProfile } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RBMark } from '@/components/PasscodeGate';
import { Loader2, ArrowRight, ArrowLeft, MapPin, User, Cpu, Sparkles, Shield } from 'lucide-react';

type Step = 'welcome' | 'about' | 'dreams' | 'tech' | 'consent';
const STEPS: Step[] = ['welcome', 'about', 'dreams', 'tech', 'consent'];

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

  const index = STEPS.indexOf(step);
  const goNext = () => setStep(STEPS[Math.min(index + 1, STEPS.length - 1)]);
  const goBack = () => setStep(STEPS[Math.max(index - 1, 0)]);

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
      profile_completed: true,
    };
    const r = await saveProfile(fields);
    setSaving(false);
    if (r.error) setError(r.error);
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
            {STEPS.map((s, i) => (
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
              {error && <p className="text-xs text-destructive text-center">{error}</p>}
              <div className="flex gap-3">
                <Button variant="outline" onClick={goBack} className="flex-1">
                  <ArrowLeft className="mr-2 size-4" />
                  Back
                </Button>
                <Button onClick={handleComplete} disabled={saving || emailOptIn === ''} className="flex-1">
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
