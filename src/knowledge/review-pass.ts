import { registry } from '@/providers/registry';
import { useProviderStore } from '@/store/provider-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useCommunityStore } from '@/store/community-store';

/**
 * The quality review pass — the second agent in the build loop.
 *
 * The bounded auto-fix catches builds that THROW. This catches builds that
 * merely don't work: dead buttons, handlers never attached, broken
 * references, unreadable contrast. After a normal build settles, a fast
 * cheap model (Haiku) reads the files against the person's request; if it
 * finds concrete defects, ONE fix request is queued through the same
 * no-loop machinery as auto-fix (fix sends are never themselves reviewed).
 *
 * Deliberately not full multi-agent orchestration: one extra cheap call,
 * one bounded correction, silence when the build is solid.
 */

const REVIEW_MODEL = 'claude-haiku-4-5';
const REVIEW_DELAY_MS = 4000; // let a thrown preview error win the race — auto-fix handles those
const MAX_FILE_CHARS = 6000;
const MAX_TOTAL_CHARS = 30000;

const REVIEW_SYSTEM_PROMPT = [
  'You are a strict, terse quality reviewer for small community web apps.',
  'You receive the person\'s request and the complete generated files.',
  'List at most 3 concrete, high-confidence DEFECTS that would affect someone actually using the app:',
  '- references to files, ids, classes, or functions that don\'t exist',
  '- buttons, forms, or links that do nothing (handlers never attached, wrong selectors)',
  '- data written but never read back (or vice versa) so the feature can\'t work',
  '- text that fails basic contrast against its background',
  '- a core piece of the person\'s request that is simply missing',
  '',
  'Rules:',
  '- Only report defects you are CONFIDENT are real. Style preferences, refactors, and nice-to-haves are never defects.',
  '- If the app looks solid, reply with exactly: NONE',
  '- Otherwise reply with only a short bullet list of the defects, each naming the file and what\'s broken. No preamble, no code.',
].join('\n');

function buildReviewUserMessage(ask: string, files: { path: string; content: string }[]): string {
  const parts = [`The person asked for: "${ask.slice(0, 600)}"`, '', 'The generated files:', ''];
  let budget = MAX_TOTAL_CHARS;
  for (const f of files) {
    if (/^\/?assets\//.test(f.path)) continue; // photo assets are opaque blobs
    if (budget <= 0) {
      parts.push(`--- ${f.path} (omitted for length) ---`);
      continue;
    }
    const body = f.content.length > MAX_FILE_CHARS ? f.content.slice(0, MAX_FILE_CHARS) + '\n…(truncated)' : f.content;
    budget -= body.length;
    parts.push(`--- ${f.path} ---`, body, '');
  }
  return parts.join('\n');
}

/** Message contains extractable files — pure prose answers aren't reviewed */
export function messageProducedFiles(content: string): boolean {
  return /```(\w+)?\s+filename=|```edit\s+filename=/.test(content);
}

/**
 * Run one background review. Fire-and-forget: every exit path is silent
 * except a confident finding, which queues a single fix send.
 */
export function runQualityReview(userAsk: string): void {
  const { activeProviderId, apiKeys } = useProviderStore.getState();
  // Reviews ride the Claude provider (community tier covers Haiku); other
  // providers skip the pass rather than guess at a cheap model
  if (activeProviderId !== 'claude') return;
  if (!apiKeys['claude'] && !useCommunityStore.getState().active) return;

  const provider = registry.getProvider('claude');
  if (!provider) return;

  const files = useProjectStore.getState().getAllFiles();
  if (files.length === 0) return;
  const versionAtStart = useProjectStore.getState().version;

  setTimeout(async () => {
    // A thrown error already triggered auto-fix, or the person moved on
    const chat = useChatStore.getState();
    if (chat.isGenerating || chat.pendingFixSend || chat.queuedMessage) return;
    if (useProjectStore.getState().version !== versionAtStart) return;

    useChatStore.setState({ reviewing: true });
    let reply = '';
    try {
      await new Promise<void>((resolve, reject) => {
        provider.chat(
          [
            { role: 'system', content: REVIEW_SYSTEM_PROMPT },
            { role: 'user', content: buildReviewUserMessage(userAsk, files) },
          ],
          REVIEW_MODEL,
          {
            onToken: t => { reply += t; },
            onComplete: () => resolve(),
            onError: err => reject(err),
          },
          new AbortController().signal,
        );
      });
    } catch {
      return; // reviews never surface their own errors
    } finally {
      useChatStore.setState({ reviewing: false });
    }

    const verdict = reply.trim();
    if (!verdict || /^NONE\b/i.test(verdict)) return;

    // Re-check the world before acting on a stale review
    const after = useChatStore.getState();
    if (after.isGenerating || after.pendingFixSend || after.queuedMessage) return;
    if (useProjectStore.getState().version !== versionAtStart) return;

    after.queueFix(
      [
        'A quick quality review of that build found real issues:',
        '',
        verdict.slice(0, 1500),
        '',
        'Fix these. Use targeted edit blocks where possible and change nothing else.',
      ].join('\n'),
      'Quality review',
    );
  }, REVIEW_DELAY_MS);
}
