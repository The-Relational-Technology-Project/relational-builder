/**
 * Which way an attached image is headed — INTO the app (a logo, a photo of
 * the block) or in front of the AI's eyes only (a screenshot of a mockup,
 * something they like the look of). The person's own words and the file's
 * name say which far more often than not; a chip in the composer used to
 * be the only way to say it, and it only showed in build mode at all. A
 * real build report showed the cost: a church logo attached with the first
 * planning message, "use the attached church logo at the top of the app",
 * rode along as reference only, and the built app shipped with a generic
 * tree icon.
 *
 * Pure text heuristics, deliberately plain. The composer shows the result
 * on the attachment and one tap still overrides it — inference sets the
 * default, it doesn't take the decision away.
 */

export type PhotoUse = 'app' | 'reference';

/** Words that say "this goes in the app" */
const APP_WORDS =
  /\b(logo|logos|headshot|portrait|hero (?:image|photo|shot)|banner|our (?:photo|picture|pic|logo|flyer|poster|mural|building|church|garden|block|street|park|team|group)|my (?:photo|picture|pic|logo|flyer|poster|dog|cat|garden|house|shop|store|art(?:work)?)|(?:photo|picture|pic|shot|image) of (?:the|our|my)|(?:in|on|into|for|inside|across|throughout) the (?:app|site|page|website|tool|header|homepage|home page|footer|nav|sidebar|hero)|put (?:this|it|these|them)|use (?:this|it|these|them|the attached)|add (?:this|it|these|them)|include (?:this|it|these|them)|show (?:this|it|these|them)|display (?:this|it|these|them)|place (?:this|it|these|them)|feature (?:this|it|these|them)|attached (?:logo|photo|picture|image|flyer|poster|artwork|icon)|as the (?:logo|icon|favicon|background|hero|header|banner|cover)|background (?:image|photo))\b/i;

/** Words that say "look at this, don't ship it" */
const REFERENCE_WORDS =
  /\b(screenshot|screen shot|screen grab|screengrab|mockup|mock-up|mock up|wireframe|wire-frame|figma|sketch|prototype|reference|inspiration|inspired by|for reference|look like this|looks like this|should look|like this one|something like|similar to|in the style of|style of|the style|the vibe|vibe of|the look of|the feel of|design(?:s|ed)? (?:it|this|these|them)?\s*(?:like|after|to match)|match (?:this|these|the)|based on (?:this|these)|modeled? (?:on|after)|copy (?:this|the) (?:layout|design|look|style)|layout like|here'?s (?:what|how) (?:it|they|things?) (?:look|should)|example of|an example|examples?)\b/i;

/** Screenshots and design exports name themselves */
const REFERENCE_FILENAME =
  /(screen ?shot|screen[-_ ]?grab|capture|mockup|mock-?up|wireframe|figma|frame[-_ ]?\d|artboard|design|export|untitled|clipboard|pasted|image\d*\.png$)/i;

/** Camera rolls and brand files name themselves too */
const APP_FILENAME =
  /(^img[-_]?\d|^pxl[-_]|^dsc[-_]?\d|^dcim|^photo|^p\d{6,}|logo|headshot|portrait|hero|banner|flyer|poster|mural|\.hei[cf]$|\.jpe?g$)/i;

/**
 * Decide where an image goes from the message text and the file name.
 * Words win over file names (a person can screenshot their own logo).
 * Without a signal either way, build mode assumes the app (what the chip
 * did before) and plan mode assumes reference — mockups and moodboards are
 * what people mostly share while shaping the idea.
 */
export function inferPhotoUse(
  text: string,
  fileName: string,
  mode: 'plan' | 'build' | string,
): PhotoUse {
  const t = text.trim();
  const appWords = APP_WORDS.test(t);
  const refWords = REFERENCE_WORDS.test(t);
  if (appWords && !refWords) return 'app';
  if (refWords && !appWords) return 'reference';
  // Both or neither: the file name breaks the tie
  const name = fileName.trim();
  const refName = REFERENCE_FILENAME.test(name);
  const appName = APP_FILENAME.test(name);
  if (appName && !refName) return 'app';
  if (refName && !appName) return 'reference';
  return mode === 'build' ? 'app' : 'reference';
}

/**
 * The bracketed line a planning message carries when its photo is for the
 * app: the model can plan around a real asset and must not ask for it
 * again, and the build that follows gets the same photo stored for real.
 */
export function heldPhotosNote(names: string[]): string {
  const list = names.map(n => `"${n}"`).join(', ');
  return names.length === 1
    ? `[The attached photo ${list} is for the app itself, not just reference — it is held and will be stored in the project as an asset when the build starts. Plan around it as a real image (say where it goes) and never ask for it to be attached again.]`
    : `[The attached photos ${list} are for the app itself, not just reference — they are held and will be stored in the project as assets when the build starts. Plan around them as real images (say where each goes) and never ask for them to be attached again.]`;
}
