# Design your Studio — a network partner's journey in the Builder

*Written 2026-10-22.*

Relational Builder helps a network partner **design the Studio** they want
inside the Builder and leave with the two things that start one: a **Studio
Brief** (the document RTP's stewards set the studio up from) and a
**one-page site in the studio's own brand** for their people. When they are
ready, a card in the chat sends both to Josh (josh@relationaltechproject.org).
The public page is `/studios`; the Builder's door is `/studiobrief`, the
same shape as `/buildtogether` → `/buildday` (see `BUILD-DAY-JOURNEY.md`).

## Where it lives

| Piece | File |
|---|---|
| The frame, the four-stage plan conversation, the start card, the ask regex | `src/knowledge/studio-brief.ts` |
| Frame registration, detection from the ask, frame conferred by the card | `src/knowledge/frames.ts` |
| Plan-instruction swap while the project has no files | `src/knowledge/context-builder.ts` |
| The `/studiobrief` address | `src/router.ts`, `src/store/ui-store.ts`, `src/project/start-studio-brief.ts` |
| The opening message the composer is seeded with | `src/project/start-from-commons.ts` |
| The card's detail when the commons has no row for it | `src/knowledge/commons-items.ts` |
| The opt-in share: payload, brief reader, per-project status | `src/report/studio-brief-share.ts` |
| The card in the chat, and the Share menu entry that brings it back | `src/components/Chat/StudioBriefShareCard.tsx`, `src/components/ShareMenu.tsx` |
| The edge function that emails Josh and keeps the record | `supabase/functions/studio-brief-share/` |
| The public page's CTAs and "Design it in the Builder" section | `src/components/StudiosPage.tsx` |

## The journey

**The conversation.** Four stages, each with one-tap answers and a
suggested default: *who builds here* (what they hold in common, who they
are, the name and tagline, the first stewards) · *your frame* (three to
five principles in their words, practices and guardrails) · *what the
Builder should know* (contexts, sources, the first shelf, the door: open or
gated) · *your brand and your page* (what they already have, three
directions with hex values and fonts, what to make now, the contact). The
plan ends in a **Studio brief** block of bold-labelled lines (Studio name,
Tagline, What we hold in common, Who builds here, Stewards, Door,
Principles, Practices & guardrails, Contexts, Sources, First shelf, Brand,
Public page, Contact, Next step) and a `PROJECT-NAME:` line.

**The build.** Two files: `studio/brief.md` (the Studio Brief, with the
same bold-labelled block, written to be set up from) and `index.html` (the
standalone one-page site in the studio's brand: hero and door, what we hold
in common, principles, how we build, what we know, what we'll make first,
stewards and the door, a one-line Relational Builder credit). The page
previews on the simple-tool engine and publishes as-is from Share →
Publish; the brief reads from the page and the page from the brief.

**Sharing with RTP.** Opt-in only, unlike the build day notice: the brief
names the partner's stewards and their emails. Once `studio/brief.md`
exists on a project whose lineage carries the `studio-brief` frame, the
`StudioBriefShareCard` appears under the chat with the builder's name and
email filled from their profile, an optional note, a box to include the
one-page site (and its live address when published), and "See exactly what
we'd send" (the brief itself). Pressing **Send to Josh at RTP** posts to
`studio-brief-share`, which inserts a `contact_messages` row (topic
`studio-brief`, the durable record) and emails Josh with the brief inline
and attached as `studio-brief.md`, the page as `studio-page.html`, and the
partner's email as reply-to. Closing the card puts it away for that project;
Share → **Send to Josh at RTP** brings it back. Status is kept per project
key in `rb-studio-brief-share` (localStorage), the same keying as live
sites.

## Detection

The frame is stamped by the start card (`source_studio_slug: 'studio-brief'`,
which `/studiobrief` and the `/studios` buttons use) or by the ask itself
(`STUDIO_BRIEF_ASK`: "studio brief", "a Relational Builder studio",
"studio for Relational Builder", "our studio's principles/stewards/door",
"a studio for my network/community/fellows"). Deliberately narrow: "studio"
alone names yoga studios, RT Studio, and the Thread Studio. Never from
retrieval alone.

## Deploy

```
curl -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -F 'metadata={"name":"studio-brief-share","entrypoint_path":"index.ts","verify_jwt":false};type=application/json' \
  -F 'file=@supabase/functions/studio-brief-share/index.ts;type=application/typescript' \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/functions/deploy?slug=studio-brief-share"
```

Secrets: `RESEND_API_KEY` (shared), optional `STUDIO_BRIEF_EMAILS`
(comma-separated; default josh@relationaltechproject.org).
