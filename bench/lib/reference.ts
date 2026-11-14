import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ChatMessage } from '../../src/providers/types';
import { pickReferenceScreen, referenceNote, referenceTextNote } from '../../src/human-scale/reference-screens';
import { acceptsImages } from '../../src/human-scale/builder-model';

/**
 * The reference experiment (Nov 11, 2026): does an open model build closer
 * to a strong design when it is shown one or told one in detail? Fixtures
 * in bench/reference/ were drawn from Opus builds of the same prompts.
 *
 *   BENCH_REFERENCE=same   the Opus screenshot of this prompt
 *   BENCH_REFERENCE=spec   the written UI spec for this prompt
 *   BENCH_REFERENCE=both   screenshot and spec
 *   BENCH_REFERENCE=other  the Opus screenshot of a DIFFERENT prompt
 *   BENCH_REFERENCE=library  the Builder's own pick from its reference
 *                            library (src/human-scale/reference-screens.ts),
 *                            with the Builder's wording: the product path
 *   BENCH_REFERENCE=library-words  the same image plus its layout in words
 *                            (Nov 14: does naming the layout move desktop?)
 *
 * The screenshot wording follows the Builder's gallery remix path
 * (src/project/start-from-commons.ts). Unset, the message is the bare
 * prompt, exactly as before.
 */
export type ReferenceArm = 'same' | 'spec' | 'both' | 'other' | 'library' | 'library-words';

export const REFERENCE_DIR = path.resolve(import.meta.dirname ?? __dirname, '..', 'reference');

/** For `other`: each prompt is shown a different subject's screen */
export const OTHER_REFERENCE: Record<string, string> = {
  'hs-community-fridge': 'hs-ballot-guide',
  'hs-listening-wall': 'remix-street-stories',
  'remix-income-sharing': 'hs-skill-swap',
  'hs-ballot-guide': 'hs-community-fridge',
  'remix-street-stories': 'hs-listening-wall',
  'hs-skill-swap': 'remix-income-sharing',
};

export const SAME_NOTE =
  'The attached screenshot shows a finished version of this app. Use it as the visual reference: ' +
  'keep its layout, hierarchy, palette, type and how specific its content is, and build every ' +
  'screen the prompt asks for in the same spirit.';
export const OTHER_NOTE =
  'The attached screenshot shows a different neighborhood app, built well. Use it as the reference ' +
  'for quality, not subject: match its layout density, hierarchy, type, how it uses color and how ' +
  'specific its content is, while building this app for its own place and people. Do not copy its subject.';

export function referenceArm(): ReferenceArm | null {
  const v = process.env.BENCH_REFERENCE?.trim();
  return v === 'same' || v === 'spec' || v === 'both' || v === 'other' || v === 'library' || v === 'library-words' ? v : null;
}

function imagePart(taskId: string, dir: string) {
  const file = path.join(dir, `${taskId}.png`);
  if (!existsSync(file)) throw new Error(`No reference screenshot for ${taskId} (${file})`);
  return { type: 'image_url' as const, image_url: { url: `data:image/png;base64,${readFileSync(file).toString('base64')}` } };
}

function spec(taskId: string, dir: string): string {
  const file = path.join(dir, `${taskId}.md`);
  if (!existsSync(file)) throw new Error(`No UI spec for ${taskId} (${file})`);
  return readFileSync(file, 'utf8').trim();
}

/** The first user message for a build, with the arm's reference attached */
export function userContent(taskId: string, prompt: string, arm = referenceArm(), dir = REFERENCE_DIR, modelId?: string): ChatMessage['content'] {
  if (!arm) return prompt;
  if (arm === 'library' || arm === 'library-words') {
    const screen = pickReferenceScreen(prompt);
    // As in the Builder: a text-only model gets the screen in words
    if (modelId && !acceptsImages(modelId)) return `${prompt}\n\n${referenceTextNote(screen)}`;
    const file = path.resolve(dir, '..', '..', 'public', 'human-scale', 'references', screen.file);
    return [
      { type: 'text', text: `${prompt}\n\n${referenceNote(screen)}${arm === 'library-words' ? `\n\nThe screen, described: ${screen.layout}` : ''}` },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${readFileSync(file).toString('base64')}` } },
    ];
  }
  const withSpec = arm === 'spec' || arm === 'both'
    ? `${prompt}\n\n## UI spec (follow it closely)\n\n${spec(taskId, dir)}`
    : prompt;
  if (arm === 'spec') return withSpec;
  if (arm === 'other') {
    const other = OTHER_REFERENCE[taskId];
    if (!other) throw new Error(`No "other" reference mapped for ${taskId}`);
    return [{ type: 'text', text: `${prompt}\n\n${OTHER_NOTE}` }, imagePart(other, dir)];
  }
  return [{ type: 'text', text: `${withSpec}\n\n${SAME_NOTE}` }, imagePart(taskId, dir)];
}
