import { Pause, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The strip that sits at the top of the screen while Dream Recorder is
 * listening. Its job is social, not technical: everyone at the table can
 * see that the phone is recording, see that it's hearing them, and reach
 * Pause without asking whose phone it is.
 */
export function RecordingBanner({
  elapsed,
  paused,
  level,
  onPause,
  onResume,
  onStop,
}: {
  elapsed: string;
  paused: boolean;
  level: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-20 border-b backdrop-blur px-4 py-2.5 ${
        paused ? 'bg-muted/90' : 'bg-destructive/10 border-destructive/30'
      }`}
    >
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <span className="relative flex size-3 shrink-0" aria-hidden>
          {!paused && (
            <span
              className="absolute inline-flex size-full rounded-full bg-destructive opacity-60"
              style={{ transform: `scale(${1 + level * 1.6})`, transition: 'transform 120ms linear' }}
            />
          )}
          <span
            className={`relative inline-flex size-3 rounded-full ${paused ? 'bg-muted-foreground' : 'bg-destructive'}`}
          />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-sm font-medium tabular-nums">
            {paused ? 'Paused' : 'Recording'} · {elapsed}
          </div>
          <div className="text-[11px] text-muted-foreground leading-snug">
            Anyone at the table can pause. Nothing leaves this device until someone presses Distill.
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full h-9 px-3"
          onClick={paused ? onResume : onPause}
          aria-label={paused ? 'Resume recording' : 'Pause recording'}
        >
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          <span className="hidden sm:inline">{paused ? 'Resume' : 'Pause'}</span>
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="rounded-full h-9 px-3"
          onClick={onStop}
          aria-label="Stop recording"
        >
          <Square className="size-4" />
          <span className="hidden sm:inline">Stop</span>
        </Button>
      </div>
    </div>
  );
}
