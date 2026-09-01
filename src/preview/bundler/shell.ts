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

/**
 * Strip the module-script entry tag(s) a Vite-style index.html carries.
 * Attribute order varies (findFrameworkEntry accepts both), so test the
 * attributes rather than their sequence — a tag left behind here ships a
 * 404ing script into the published site.
 */
function stripModuleEntry(html: string): string {
  return html.replace(/<script\b[^>]*>\s*<\/script>/gi, tag =>
    /type=["']module["']/i.test(tag) && /\bsrc=["'][^"']+["']/i.test(tag) ? '' : tag,
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

  // Function replacers: a plain-string replacement interprets $-patterns
  // ($&, $', $1…), so a bundle containing e.g. the regex-escape idiom
  // "\\$&" would have it expanded into the matched tag — shipping a
  // corrupted app that no diff of the sources would ever show.
  html = /<\/head>/i.test(html)
    ? html.replace(/<\/head>/i, () => `${headBits}\n</head>`)
    : headBits + html;
  html = /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, () => `${bodyBits}\n</body>`)
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
  // Dev React logs "The above error occurred in the <X> component" (with a
  // component stack) around the throw — capture it so the fix loop knows
  // WHICH component crashed, not just that something did.
  var componentNote = '';
  var origError = console.error;
  console.error = function () {
    try {
      var first = arguments[0];
      if (typeof first === 'string' && first.indexOf('The above error occurred') !== -1) {
        componentNote = first.split('\\n').slice(0, 12).join('\\n');
      }
    } catch (err) {}
    return origError.apply(console, arguments);
  };
  function send(message) {
    try { parent.postMessage({ type: 'rb-runtime-error', message: message.slice(0, 4000) }, '*'); } catch (e) {}
  }
  window.addEventListener('error', function (e) {
    var message = e.message + (e.filename ? ' (' + e.filename + ':' + e.lineno + ')' : '');
    var stack = e.error && e.error.stack ? String(e.error.stack).split('\\n').slice(0, 10).join('\\n') : '';
    // Give React's component-stack log a moment to land, then send one
    // message carrying everything we know.
    setTimeout(function () {
      send(
        message +
        (stack ? '\\n\\nStack:\\n' + stack : '') +
        (componentNote ? '\\n\\n' + componentNote : '')
      );
      componentNote = '';
    }, 80);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    var detail = r && r.stack
      ? r.message + '\\n' + String(r.stack).split('\\n').slice(0, 8).join('\\n')
      : String(r);
    send('Unhandled promise rejection: ' + detail);
  });
})();
</script>`;

/**
 * Script injected into live previews (never published): notices the one
 * failure the error relay can't — an app that loads cleanly and renders
 * NOTHING. No exception, empty console, blank iframe; two real debugging
 * sessions burned on exactly this. If the mount point is still empty a
 * moment after load (and no error was thrown), tell the builder so the
 * preview can say "empty page" instead of silently showing one.
 */
export const EMPTY_RENDER_SENTRY = `<script>
(function () {
  var errored = false;
  window.addEventListener('error', function () { errored = true; });
  window.addEventListener('load', function () {
    setTimeout(function () {
      if (errored) return;
      var root = document.getElementById('root') || document.body;
      if (!root) return;
      var hasContent =
        root.childElementCount > 0 &&
        (root.innerText.trim() !== '' || root.querySelector('img,svg,canvas,video,iframe,input,textarea,button'));
      if (!hasContent) {
        try { parent.postMessage({ type: 'rb-empty-render' }, '*'); } catch (e) {}
        // Content can still arrive (slow data, late navigation) — clear the
        // notice the moment something real shows up, then stand down.
        var mo = new MutationObserver(function () {
          if (root.childElementCount > 0 && (root.innerText.trim() !== '' || root.querySelector('img,svg,canvas,video,iframe,input,textarea,button'))) {
            try { parent.postMessage({ type: 'rb-empty-render-clear' }, '*'); } catch (e) {}
            mo.disconnect();
          }
        });
        mo.observe(root, { childList: true, subtree: true, characterData: true });
      }
    }, 2500);
  });
})();
</script>`;

/**
 * Applies the builder's photo assets (window.ASSETS, set by assets/<name>.js
 * modules) to every `<img data-asset="...">` — including ones React renders
 * after load, via a MutationObserver. This is what makes the documented
 * `data-asset` pattern work in framework apps, where a static script's
 * DOMContentLoaded pass runs before React has mounted anything.
 * Ships in preview AND publish, so both behave the same.
 */
export const ASSET_APPLIER = `<script>
(function () {
  function apply() {
    if (!window.ASSETS) return;
    document.querySelectorAll('img[data-asset]').forEach(function (img) {
      var src = window.ASSETS[img.getAttribute('data-asset')];
      if (src && img.getAttribute('src') !== src) img.setAttribute('src', src);
    });
  }
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
</script>`;
