import type { BundleSuccess } from './bundle';
import { TAILWIND_BROWSER_URL } from './versions';
import { applyRegionToHtml, type RegionMode } from '@/regions/regions';

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
  /** Regional mode rewrites on the finished document (EU: Google Fonts →
   *  Bunny Fonts). Preview and publish pass the same value, so the preview
   *  stays an honest rehearsal of what ships. */
  regionMode?: RegionMode;
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

/**
 * Pull remote stylesheet imports (web fonts, mostly) out of a CSS chunk.
 * Tailwind's browser JIT treats any `@import url(...)` in a
 * `text/tailwindcss` style as something to resolve itself, cannot, and then
 * compiles NO utilities at all: the app opens as unstyled HTML. Checked in
 * Chromium on Nov 6, 2026 (padding 32px without the import, 0px with it).
 * A Google Fonts import is the normal way to load a font, so builds from
 * every model, Opus included, were losing their whole design to it. The
 * imports become `<link rel="stylesheet">` tags instead; the rest of the
 * chunk goes to the JIT unchanged.
 */
export function splitRemoteCssImports(css: string): { urls: string[]; rest: string } {
  const urls: string[] = [];
  const rest = css.replace(
    // Quotes are matched loosely: a model that opens with ' and closes with "
    // (gemma, Nov 7) still meant the URL, and the stray quote otherwise
    // reaches Tailwind as an unterminated string and blanks the page
    /@import\s+(?:url\(\s*(['"]?)(https?:\/\/[^'")\s]+)['"]?\s*\)|(['"])(https?:\/\/[^'"]+)['"])[^;\n]*;?/g,
    (_m, _q1, u1, _q2, u2) => {
      const url = (u1 ?? u2) as string;
      if (!urls.includes(url)) urls.push(url);
      return '';
    },
  );
  return { urls, rest };
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export function buildShellHtml(options: ShellOptions): string {
  const { bundle, headExtra = [], bodyExtra = [] } = options;
  let html = options.indexHtml ? stripModuleEntry(options.indexHtml) : DEFAULT_SHELL;

  const headBits = [
    `<script type="importmap">\n${bundle.importMap}\n</script>`,
    `<script src="${TAILWIND_BROWSER_URL}"></script>`,
    ...(() => {
      const split = bundle.css.map(splitRemoteCssImports);
      const urls = [...new Set(split.flatMap(x => x.urls))];
      return [
        ...urls.map(u => `<link rel="stylesheet" href="${escapeAttr(u)}">`),
        ...split.map(x => `<style type="text/tailwindcss">\n${x.rest}\n</style>`),
      ];
    })(),
    ...headExtra,
  ].join('\n');

  const bodyBits = [
    // An end tag inside the bundle would terminate the inline script early.
    // The parser ends it at `</script` followed by whitespace, `/` or `>` —
    // matching only the exact `</script>` left `</script >` as a way out.
    `<script type="module">\n${bundle.js.replace(/<\/script(?=[\s/>])/gi, '<\\/script')}\n</script>`,
    ...bodyExtra,
  ].join('\n');

  // Both replacements pass a FUNCTION, never a string. A string replacement
  // interprets `$&`, `$\``, `$'` and `$$` — and the bundle is arbitrary
  // compiled JS, so an ordinary `.replace(re, '$&')` in someone's app used to
  // splice `</body>` (or the whole document prefix) into the script body.
  html = /<\/head>/i.test(html)
    ? html.replace(/<\/head>/i, () => `${headBits}\n</head>`)
    : headBits + html;
  html = /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, () => `${bodyBits}\n</body>`)
    : html + bodyBits;

  // Last, over the whole document: the project's own <head> (font links)
  // and any @import in collected CSS both get the regional rewrite
  return applyRegionToHtml(html, options.regionMode ?? 'global');
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

/**
 * Script injected into live previews (never published): gives the preview a
 * Referer where one is required, and notices pictures that did not load.
 *
 * The preview document is a blob: URL, and a browser sends NO Referer from
 * one. OpenStreetMap's tile servers refuse requests without it, so every
 * Leaflet map came up as a wall of "Access blocked" tiles in the preview
 * while the same app published fine (a real page has a Referer). Here the
 * preview fetches those tiles itself, naming the Builder's own origin (the
 * one thing a blob: document may claim, and the truth about where the app
 * is running), and hands the image to the element as an object URL.
 *
 * It covers what a map library does: `img.src = url`, `setAttribute('src')`,
 * and `fetch()`. An `<img>` written in static HTML is not relayed.
 *
 * The same script counts image requests that failed (a refused tile, a dead
 * link) and tells the Builder, so the preview and the build report stop
 * calling a page of broken pictures "working". A refusal can arrive as a
 * perfectly valid picture (OSM's 403 is one), which is why the relay reads
 * the status instead of waiting for an error event.
 */
export const RESOURCE_RELAY = `<script>
(function () {
  var NEEDS_REFERER = /(^|\\.)(openstreetmap\\.org|osm\\.org)$/i;
  var referrer = self.origin && self.origin !== 'null' ? self.origin + '/' : '';
  function hostOf(url) {
    try {
      var u = new URL(String(url), location.href);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.hostname : '';
    } catch (e) { return ''; }
  }
  function needsReferer(url) { return referrer !== '' && NEEDS_REFERER.test(hostOf(url)); }

  // Failures by host, sent as running totals a moment after the last one
  var failed = {};
  var timer = null;
  function note(host, status) {
    if (!host) return;
    var f = failed[host] || (failed[host] = { host: host, count: 0, status: 0 });
    f.count++;
    if (status) f.status = status;
    clearTimeout(timer);
    timer = setTimeout(function () {
      var items = Object.keys(failed).map(function (k) { return failed[k]; });
      try { parent.postMessage({ type: 'rb-resource-failures', items: items }, '*'); } catch (e) {}
    }, 1200);
  }

  var origFetch = window.fetch;
  if (!origFetch) return;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
    if (needsReferer(url) && !(init && init.referrer)) {
      init = Object.assign({}, init, { referrer: referrer });
    }
    return origFetch.call(this, input, init);
  };

  var proto = HTMLImageElement.prototype;
  var desc = Object.getOwnPropertyDescriptor(proto, 'src');
  if (!desc || !desc.set || !desc.get) return;
  // The newest request for an element wins; a map re-uses and aborts tiles
  var current = new WeakMap();
  function relay(img, url) {
    var entry = { url: url };
    current.set(img, entry);
    origFetch.call(window, url, { referrer: referrer })
      .then(function (res) {
        if (!res.ok) note(hostOf(url), res.status);
        return res.blob();
      })
      .then(function (blob) {
        if (current.get(img) !== entry) return;
        var obj = URL.createObjectURL(blob);
        var done = function () {
          URL.revokeObjectURL(obj);
          img.removeEventListener('load', done);
          img.removeEventListener('error', done);
        };
        img.addEventListener('load', done);
        img.addEventListener('error', done);
        desc.set.call(img, obj);
      })
      .catch(function () {
        // The relay could not reach it; let the element try the plain way
        if (current.get(img) === entry) desc.set.call(img, url);
      });
  }
  function setSrc(img, value) {
    if (needsReferer(value)) relay(img, new URL(String(value), location.href).href);
    else { current.delete(img); desc.set.call(img, value); }
  }
  Object.defineProperty(proto, 'src', {
    configurable: true,
    enumerable: desc.enumerable,
    // The app reads back the address it set, not the object URL behind it
    get: function () { var e = current.get(this); return e ? e.url : desc.get.call(this); },
    set: function (value) { setSrc(this, value); },
  });
  var setAttr = proto.setAttribute;
  proto.setAttribute = function (name, value) {
    if (String(name).toLowerCase() === 'src' && needsReferer(value)) setSrc(this, value);
    else setAttr.call(this, name, value);
  };

  // Pictures that failed outright. Resource errors do not bubble, so capture.
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG') return;
    // A relayed picture was already counted by its status
    if (current.get(t)) return;
    note(hostOf(t.currentSrc || desc.get.call(t)), 0);
  }, true);
})();
</script>`;
