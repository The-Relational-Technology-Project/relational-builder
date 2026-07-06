/**
 * One browser notification, for one moment: the first build of a project
 * finishing while the person is in another tab. Builds can take minutes on
 * slow connections — nobody should have to babysit a spinner.
 *
 * Deliberately narrow: no other notifications, ever. Permission is asked
 * only when a first build starts (a moment when "tell me when it's done"
 * makes obvious sense), and the notification only fires if the tab is
 * actually hidden.
 */

function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Ask (once, contextually) as the first build kicks off. Safe to call anytime. */
export function requestBuildNotifyPermission(): void {
  if (!supported()) return;
  try {
    if (Notification.permission === 'default') {
      // Fire-and-forget — the build proceeds regardless of the answer
      void Notification.requestPermission();
    }
  } catch {
    // Some browsers (older Safari) throw on the promise form — never block a build
  }
}

/** True when a "we'll let you know" hint is honest to show */
export function buildNotifyGranted(): boolean {
  return supported() && Notification.permission === 'granted';
}

/** Fire the build-ready notification — only if the person is elsewhere */
export function notifyBuildReady(projectName?: string): void {
  if (!supported() || Notification.permission !== 'granted') return;
  if (!document.hidden) return; // they're watching — the preview says it better
  try {
    const n = new Notification('Your build is ready', {
      body: projectName
        ? `${projectName} is running in the preview. Come take a look.`
        : 'Your app is running in the preview. Come take a look.',
      tag: 'rb-build-ready', // replaces, never stacks
      icon: '/favicon.svg',
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Notification constructor can throw (e.g. Android Chrome requires SW) — never break a build
  }
}
