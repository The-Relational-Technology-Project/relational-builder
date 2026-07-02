import { useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Palette } from 'lucide-react';

const PLACEHOLDER = `Describe your style in your own words — colors, type, feel, the place it comes from. For example:

Palette: sand #EFE7DA, deep kelp green #1F4D3A, sunset coral #E86F4E for actions.
Type: big friendly headings, roomy line spacing.
Feel: like a hand-painted sign at the beach — warm, a little weathered, never corporate.
Always: rounded corners, real photos of the neighborhood, Spanish + English labels.`;

/**
 * A builder's personal mini design system — their palette, type, and feel,
 * in their own words. Once saved, every new build follows it, so a
 * builder's tools carry their place's aesthetic instead of a platform look.
 */
export function DesignSystemDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const profile = useAuthStore(s => s.profile);
  const saveProfile = useAuthStore(s => s.saveProfile);

  const [text, setText] = useState(profile?.design_system ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const r = await saveProfile({ design_system: text.trim() || null });
    setSaving(false);
    if (r.error) setError(r.error);
    else onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="size-4" />
            Your design system
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your style, in your words — colors, type, feel, sense of place.
            Every new app you build will follow it, so your tools look like
            they come from you and your neighborhood. Leave it empty and each
            build finds its own feel instead.
          </p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={10}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-xs leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : 'Save my style'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
