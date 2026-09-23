import { useEffect, useState } from 'react';
import {
  fetchDirectoryCached,
  suggestConnection,
  explainMatch,
  type DirectoryBuilder,
} from '@/knowledge/connections';
import { useAuthStore } from '@/store/auth-store';
import { useDeskStore } from '@/store/desk-store';
import { useLocalProjects } from '@/project/local-projects';
import { useCloudStore } from '@/store/cloud-store';
import { ConnectionActions } from './ConnectionActions';
import { HeartHandshake, MapPin, X, NotebookPen } from 'lucide-react';

const MEMORY_KEY = 'rb-connection-suggestions';

/**
 * How many times we'll ever raise the same person, unprompted.
 *
 * An introduction you didn't ask for is worth making once, maybe twice — a
 * conversation about mutual aid will keep matching the same builder's note
 * forever, and a suggestion that returns on every reload stops reading as an
 * offer and starts reading as a nag. Two is the whole budget, for good.
 */
const MAX_OFFERS_PER_BUILDER = 2;

interface BuilderMemory {
  /** Times this builder's card has actually been put in front of this person */
  offers: number;
  /** They waved it off by hand — a stronger signal than simply not acting */
  dismissed?: boolean;
}

type Memory = Record<string, BuilderMemory>;

/**
 * localStorage, not sessionStorage: dismissal used to die with the tab, so
 * every reload resurrected someone the person had already declined — which is
 * exactly the "I've x'ed this out a few times" complaint. Saying no once has
 * to still mean no tomorrow.
 */
function readMemory(): Memory {
  try {
    const raw = JSON.parse(localStorage.getItem(MEMORY_KEY) ?? '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Memory) : {};
  } catch {
    return {};
  }
}

function writeMemory(memory: Memory): void {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // A full or blocked localStorage shouldn't take the chat down with it
  }
}

/** Builders we've said our piece about: waved off, or already offered twice */
function retiredIds(memory: Memory): Set<string> {
  return new Set(
    Object.entries(memory)
      .filter(([, m]) => m.dismissed || m.offers >= MAX_OFFERS_PER_BUILDER)
      .map(([id]) => id),
  );
}

/** An explicit "not this person" — permanent, and it means it */
function retire(id: string): void {
  const memory = readMemory();
  memory[id] = { offers: memory[id]?.offers ?? 0, dismissed: true };
  writeMemory(memory);
}

/**
 * Spending one of a builder's two offers. Module-level rather than per-mount
 * so that re-renders, a re-run effect as the conversation grows, and React's
 * double-invoked effects in development all count as the one showing they
 * really are.
 */
const countedThisSession = new Set<string>();

function countOffer(id: string): void {
  if (countedThisSession.has(id)) return;
  countedThisSession.add(id);
  const memory = readMemory();
  memory[id] = { ...memory[id], offers: (memory[id]?.offers ?? 0) + 1 };
  writeMemory(memory);
}

/**
 * When a conversation overlaps with what another opted-in builder is up
 * for, offer the connection right in the chat — their directory card
 * inline, with the same consent-first actions (book via their shared cal
 * link, or a double-opt-in intro request). Appears only on a genuine
 * topical match, one builder at a time, and at most twice per builder ever —
 * dismissing, acting on, or saving one to the Notepad desk retires them for
 * good (a saved offer lives on the desk from then on, still actionable).
 */
export function ConnectionSuggestion({ conversationText }: { conversationText: string }) {
  const user = useAuthStore(s => s.user);
  const eventCode = useAuthStore(s => s.profile?.event_code ?? null);
  const [suggestion, setSuggestion] = useState<{ builder: DirectoryBuilder; matched: string[]; sameEvent: boolean } | null>(null);
  const [sent, setSent] = useState(false);
  const [saved, setSaved] = useState(false);

  // Nothing to match against — render nothing (a stale suggestion can't
  // show, and the effect below has nothing to do)
  const active = !!user && conversationText.trim().length > 0;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetchDirectoryCached().then(builders => {
      if (cancelled) return;
      const next = suggestConnection(conversationText, builders, retiredIds(readMemory()), eventCode);
      // Showing it is what spends an offer — a match we never render (because
      // this builder is already retired) costs nothing.
      if (next) countOffer(next.builder.id);
      setSuggestion(next);
    });
    return () => { cancelled = true; };
  }, [active, conversationText, eventCode]);

  if (!active || !suggestion) return null;
  const { builder, matched, sameEvent } = suggestion;
  const reason = explainMatch(builder, matched, sameEvent);

  function onRequested() {
    // The introduction has been made — there is nothing left to suggest
    retire(builder.id);
    setSent(true);
  }

  /** Keep the offer on the Notepad desk: it stays open there, with the
   *  reason and where it came from, so the person can act on it later */
  function saveToDesk() {
    const projectName =
      useCloudStore.getState().currentProjectName.trim() ||
      useLocalProjects.getState().currentName.trim() ||
      null;
    useDeskStore.getState().saveIntro({
      builder,
      reason,
      context: { projectName, sameEvent },
      ...(sent ? { requestedAt: Date.now() } : {}),
    });
    // The desk is its home now — the pop-up never needs to return
    retire(builder.id);
    setSaved(true);
  }

  return (
    <div className="max-w-[85%] border border-dashed border-primary/40 rounded-xl p-3 space-y-1.5 bg-primary/5">
      <div className="flex items-center gap-1.5">
        <HeartHandshake className="size-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium truncate">
          {suggestion.sameEvent
            ? `${builder.name} is at your event — go find them`
            : `${builder.name} might be good to talk to`}
        </span>
        {builder.neighborhood && (
          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
            <MapPin className="size-2.5" />
            {builder.neighborhood}
          </span>
        )}
        <button
          onClick={() => { retire(builder.id); setSuggestion(null); }}
          className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
          title={`Don't suggest ${builder.name} again`}
        >
          <X className="size-3" />
        </button>
      </div>
      <p className="text-xs text-foreground/80">{reason}</p>
      {builder.note && (
        <p className="text-xs text-muted-foreground">"{builder.note}"</p>
      )}
      <ConnectionActions builder={builder} sent={sent} onRequested={onRequested} />
      <div className="pt-0.5">
        {saved ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <NotebookPen className="size-3" />
            Saved to your Notepad desk — it stays open there
          </span>
        ) : (
          <button
            onClick={saveToDesk}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Keep this offer on your Notepad desk, across projects, to act on later"
          >
            <NotebookPen className="size-3" />
            Save to Notepad
          </button>
        )}
      </div>
    </div>
  );
}
