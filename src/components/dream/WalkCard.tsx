import { Footprints } from 'lucide-react';

/**
 * The pre-walk card: how to record a team conversation on a neighborhood
 * walk so that the distill has something to land on, and how to get the
 * file from a phone into Dream Recorder afterward. Plain instructions, no
 * app to install.
 */
export function WalkCard() {
  return (
    <details className="group rounded-lg border bg-muted/20 text-sm">
      <summary className="cursor-pointer list-none px-3.5 py-2.5 flex items-center gap-2 font-medium select-none">
        <Footprints className="size-4 text-primary shrink-0" />
        Recording on a walk? Read this before you head out
        <span className="ml-auto text-xs text-muted-foreground group-open:hidden">show</span>
        <span className="ml-auto text-xs text-muted-foreground hidden group-open:inline">hide</span>
      </summary>
      <div className="px-3.5 pb-3.5 space-y-3 text-[13px] leading-relaxed">
        <div>
          <p className="font-medium mb-1">Before you head out</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>
              Your phone's voice memo app keeps recording in a pocket with the screen off. This page
              can't, so record the walk there and bring the file here after.
            </li>
            <li>Start by saying everyone's names and the one question you're walking with.</li>
            <li>
              Talk the way you'd talk. Tangents are fine. The description gets built around where you
              end up, not where you started.
            </li>
            <li>
              Before you turn back, do a closing round: "So where did we land?" Give everyone a
              sentence. That last stretch carries the most weight.
            </li>
          </ul>
        </div>
        <div>
          <p className="font-medium mb-1">Getting it here</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>
              iPhone: in Voice Memos, open the recording, tap Share, then Save to Files. Come back
              here and tap Add a recording. On iOS 18 or later you can also open Transcript, copy
              it, and paste it into the box above.
            </li>
            <li>
              Android: in Recorder (Pixel) or Voice Recorder (Samsung), share the audio file to
              Files, or copy the transcript and paste it above.
            </li>
            <li>
              Something else recorded it (Zoom, Otter, Granola)? Add the transcript file instead.
              Caption files (VTT, SRT) work too.
            </li>
            <li>
              Wrote on a napkin or a whiteboard? Add a photo of it. The notes get read alongside the
              conversation.
            </li>
          </ul>
        </div>
      </div>
    </details>
  );
}
