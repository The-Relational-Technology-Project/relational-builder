/**
 * What stage of life a project is in, and what is true at that stage.
 *
 * A builder testing the app put it plainly: "the biggest learning curve was
 * understanding how to move from the initial building mode into the editable
 * version and then into Community Cloud... a short explanation of the
 * different stages — and what changes or becomes possible at each stage —
 * would be really helpful." She was reverse-engineering this model from
 * behaviour, because the app knew it and never said it.
 *
 * The three questions each stage has to answer, in the person's terms rather
 * than the architecture's: **who can see this, where does it live, and what
 * happens if I break it.** A developer arrives already knowing the answers
 * (localStorage, an account, a deploy); the people this tool is for do not,
 * and nothing about neighbourhood organising teaches them.
 *
 * Deliberately NOT a funnel. One builder declined Community Cloud because she
 * wanted the site right before neighbours saw it — she was accountable to a
 * real association, and premature publishing carries social cost, so that was
 * good judgement and the tool should say so. `next` is an offer, never a nag:
 * no urgency, no badge, no "finish setting up".
 */
export type ProjectStage = 'sketching' | 'draft' | 'saved' | 'shared' | 'live';

export interface StageInfo {
  stage: ProjectStage;
  /** One word for the strip */
  label: string;
  /** Who can see this right now */
  visibility: string;
  /** Where the work physically lives */
  home: string;
  /** Reassurance about experimenting, in plain words */
  safety: string;
  /** The next stage, offered — never pushed. Null when there's nothing to offer. */
  next: string | null;
}

export interface StageInputs {
  fileCount: number;
  /** Signed in with an account (work can outlive this browser) */
  signedIn: boolean;
  /** Attached to a cloud project rather than this browser's storage */
  inCloud: boolean;
  /** Other named people have been invited */
  collaborators: number;
  /** Published to a real URL neighbours can open */
  publishedName: string | null;
  /** Can the person walk a change back right now */
  canUndo: boolean;
}

export function resolveStage(i: StageInputs): StageInfo {
  if (i.publishedName) {
    return {
      stage: 'live',
      label: 'Live',
      visibility: 'Anyone with the link can use it',
      home: `Published as ${i.publishedName}`,
      safety: 'Changes here only go live when you publish again.',
      next: null,
    };
  }
  if (i.collaborators > 0) {
    return {
      stage: 'shared',
      label: 'Shared',
      visibility: `You and ${i.collaborators} ${i.collaborators === 1 ? 'other person' : 'others'}`,
      home: 'Saved to your account',
      safety: 'Everything is saved as you go, and you can go back a step.',
      next: 'Publish it when you want neighbours to use it',
    };
  }
  if (i.inCloud) {
    return {
      stage: 'saved',
      label: 'Saved',
      visibility: 'Only you',
      home: 'Saved to your account — it follows you to any device',
      safety: 'Everything is saved as you go, and you can go back a step.',
      next: 'Invite someone to look when you want another pair of eyes',
    };
  }
  if (i.fileCount > 0) {
    return {
      stage: 'draft',
      label: 'Draft',
      visibility: 'Only you',
      home: i.signedIn
        ? 'On this device — save it to your account to keep it'
        : 'On this device only — sign in to keep it beyond this browser',
      safety: i.canUndo
        ? 'Kept in this browser as you go, and you can go back a step.'
        : 'Kept in this browser as you go.',
      next: 'Save it to your account so it survives this browser',
    };
  }
  return {
    stage: 'sketching',
    label: 'Sketching',
    visibility: 'Only you',
    home: 'Nothing built yet — this is just the conversation',
    safety: 'Nothing to lose yet. Say what you want and see what comes back.',
    next: null,
  };
}
