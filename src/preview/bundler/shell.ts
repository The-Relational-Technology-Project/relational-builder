import type { BundleSuccess } from './bundle';
import { TAILWIND_BROWSER_URL } from './versions';

/**
 * Assemble the final HTML document around a bundle — used verbatim as the
 * preview iframe's srcdoc AND as the published index.html, so the preview
 * is always an honest rehearsal of the deployed site.
 *
 * The project's own index.html is the base shell (title, meta, fonts, the
 * #root div all survive); we swap its module-script entry for the compiled
 * bundle and inject, in order:
 *   1. the import map (must precede any module script),
 *   2. Tailwind's browser JIT,
 *   3. collected CSS as `text/tailwindcss` (JIT compiles @theme + utilities,
 *      passes plain CSS through),
 *   4. the bundled app, inline,
 *   5. optional extras (inspector, error relay) for the live preview only.
 */

export interface ShellOptions {
  bundle: BundleSuccess;
  /** The project's own index.html, if it has one */
  indexHtml?: string;
  /** Extra <head>/<body> snippets — preview-only scripts, env module, etc. */
  headExtra?: string[];
  bodyExtra?: string[];
}

const DEFAULT_SHELL = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="UTF-8" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '</head>',
  '<body>',
  '<div id="root"></div>',
  '</body>',
  '</html>',
].join('\n');

/** Strip the module-script entry tag(s) a Vite-style index.html carries. */
function stripModuleEntry(html: string): string {
  return html.replace(
    /<script[^>]*type=["']module["'][^>]*src=["'][^"']+["'][^>]*>\s*<\/script>/gi,
    '',
  );
}

export function buildShellHtml(options: ShellOptions): string {
  const { bundle, headExtra = [], bodyExtra = [] } = options;
  let html = options.indexHtml ? stripModuleEntry(options.indexHtml) : DEFAULT_SHELL;

  const headBits = [
    `<script type="importmap">\n${bundle.importMap}\n</script>`,
    `<script src="${TAILWIND_BROWSER_URL}"></script>`,
    ...bundle.css.map(
      css => `<style type="text/tailwindcss">\n${css}\n</style>`,
    ),
    ...headExtra,
  ].join('\n');

  const bodyBits = [
    // </script> inside the bundle would terminate the inline tag early
    `<script type="module">\n${bundle.js.replace(/<\/script>/gi, '<\\/script>')}\n</script>`,
    ...bodyExtra,
  ].join('\n');

  html = /<\/head>/i.test(html)
    ? html.replace(/<\/head>/i, `${headBits}\n</head>`)
    : headBits + html;
  html = /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${bodyBits}\n</body>`)
    : html + bodyBits;

  return html;
}

/**
 * Script injected into live previews (never published): the builder's
 * navigation bridge. Lets the preview toolbar drive the app's hash routes
 * and keeps the toolbar's page dropdown in sync when the app navigates
 * itself.
 */
export const NAV_BRIDGE = `<script>
(function () {
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.type === 'rb-navigate' && typeof d.hash === 'string') {
      location.hash = d.hash;
    }
  });
  window.addEventListener('hashchange', function () {
    try { parent.postMessage({ type: 'rb-hash', hash: location.hash }, '*'); } catch (err) {}
  });
})();
</script>`;

/**
 * Script injected into live previews (never published): forwards runtime
 * errors to the builder so the error banner and the error→AI-fix loop work
 * exactly like they do on the Sandpack path.
 */
export const ERROR_RELAY = `<script>
(function () {
  function send(message) {
    try { parent.postMessage({ type: 'rb-runtime-error', message: message }, '*'); } catch (e) {}
  }
  window.addEventListener('error', function (e) {
    send(e.message + (e.filename ? ' (' + e.filename + ':' + e.lineno + ')' : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    send('Unhandled promise rejection: ' + (r && r.stack ? r.message : String(r)));
  });
})();
</script>`;
