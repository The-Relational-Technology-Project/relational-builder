# Tiny-Text-as-Crutch Audit — July 4, 2026

Where small muted explainer text is doing work the UI itself should do, ranked
by impact on a non-technical neighborhood builder. Produced during the July 4
overnight session alongside the global text-size pass (root font 16→17px, all
`text-[10px]`/`text-[11px]` micro-labels promoted to `text-xs`, chat body
bumped to ~16px).

Items marked ✅ were fixed in that session; the rest are recommendations —
mostly "inline state feedback beats top-level prose": show consequences where
choices are made (badges, progress, status), don't explain them in fine print.

1. **EnvPanel — public vs. secret buried in fine print** (`src/components/EnvPanel.tsx:37`)
   "Public vars are injected into the preview. Secret vars are only sent at deploy time."
   → Show the consequence per-variable, next to each row's lock toggle, not at panel top.

2. **EnvPanel — secret-var security boundary in a muted footer** (`EnvPanel.tsx:85`)
   → Put it on the lock control itself ("Secret — stays local until you deploy").

3. **PublishDialog — community hosting quota/republish rules in a callout** (`PublishDialog.tsx:215`)
   → Badge on the Community button: "1 of 3 free sites"; "Republishing updates this site" when the name matches.

4. **PublishDialog — custom-domain DNS prerequisite in a footnote** (`PublishDialog.tsx:287`)
   → Mark the field "takes extra steps"; show DNS guidance before deploy, not after.

5. **PublishDialog — secret-leak recovery path in 9pt inside the red box** (`PublishDialog.tsx:309`)
   → Bulleted actions + one-click "Ask AI to fix it" per finding.

6. ✅ **CloudPanel — zero-setup value prop as muted subtitle when signed out** (`CloudPanel.tsx:68`)
   → Copy strengthened in this session.

7. **CloudPanel — "the AI uses it automatically" vague** (`CloudPanel.tsx:181`)
   → Phrase as capability with a concrete example, not mechanism.

8. **CloudPanel — 3-backend quota only surfaces as an error** (`CloudPanel.tsx:204`)
   → "1 of 3 free backends" progress in the card header.

9. **PromptDialog — "the prompt is what travels" concept in explainer** (`PromptDialog.tsx:140`)
   → Button label carries the meaning: "Save & share this build's prompt".

10. ✅ **PreviewPanel — framework-app fallback reads like a failure** (`PreviewPanel.tsx:160`)
    → Title now says the app is fine, just not instant-previewable.

11. **DesignSystemDialog — importance buried in prose** (`DesignSystemDialog.tsx:51`)
    → Lead with the choice, tuck the why into a side note.

12. **ProjectsDialog — auto-save/sync/last-save-wins in a footnote** (`ProjectsDialog.tsx:246`)
    → Live "Saved · synced" indicator in the header; explain last-save-wins at invite time.
