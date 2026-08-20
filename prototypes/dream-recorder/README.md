# Dream Recorder (prototype)

> **This graduated.** Dream Recorder now lives inside Relational Builder at `/dream` —
> with an on-device Whisper engine, Zoom tab-audio capture, room/call attribution, and a
> "Plant it in the Builder" handoff that seeds the composer directly. It runs on the same
> provider layer as the chat (community access included), so no separate API key is needed.
> This standalone file remains as the original spike and still works on its own.

A standalone, single-file prototype testing an idea: **the front door of a Relational Builder
project might be a conversation, not a text box.**

A group at a build-a-thon table (or a Zoom breakout, or one person at a laptop) talks through
what they want to make. Dream Recorder listens locally, builds a timestamped transcript, and —
only when asked — sends that transcript to Claude with instructions to **follow the arc of the
conversation**: integrate ideas as they merge, honor the cuts and re-prioritizations, and center
the description on where the group *landed* (late-conversation energy outweighs early
brainstorming). The output is a Project Description ready to paste into Relational Builder.

Software is not assumed to be the entry point. "I want to organize with neighbors to plant
trees" should come back as a flyer + a first-gathering plan + maybe a one-page site — whatever
actually serves the first step.

## Try it

1. Open `index.html` in Chrome or Edge (double-click works — no build, no server).
2. Open **Setup**, paste a Claude API key (stored only in `localStorage`).
3. Press **Start recording** and talk — alone or as a group. The transcript builds live with
   `[m:ss]` timestamps. Or paste a transcript from Zoom/Otter/anywhere into the box.
4. Press **Distill the dream**. Optionally add a nudge first ("go with the tree idea").
5. Copy or download the result; refine it conversationally ("shorter", "we named it Root Party").

A good test of the core hypothesis: brainstorm three ideas out loud, then spend the last minute
getting excited about one of them. The description should be built around that one, with the
others in "Set aside for now".

## What's local, what isn't

- **Audio** never leaves the device. A `MediaRecorder` backup of the raw audio is offered as a
  download after you stop.
- **Live transcription** uses the browser's Web Speech API. In Chrome that's processed by the
  browser vendor's speech service — stated plainly in the footer. A fully-local Whisper mode
  (transformers.js) is the obvious next step for sensitive conversations; pasting a transcript
  from a trusted tool is the workaround today.
- **The transcript** goes to the Claude API only when you press Distill, using the browser CORS
  header (`anthropic-dangerous-direct-browser-access`) with the user's own key.

## Post-prototype path

- Flow the output straight into RB's home screen / `/new` as the seed prompt.
- Local Whisper transcription option for privacy-critical settings.
- Tab/system-audio capture (`getDisplayMedia`) so a laptop can record a Zoom call cleanly.
- Speaker attribution, and a "live dream board" view the group can watch during the meeting.
