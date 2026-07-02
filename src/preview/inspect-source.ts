/**
 * The preview inspector — "point at what you want to change."
 *
 * Injected into the Sandpack preview (as /rb-inspect.js for static
 * templates, and served from public/inspect.js for bundled templates).
 * Inert until the builder toggles select mode; then it highlights elements
 * on hover and posts a descriptor of the clicked element to the top window,
 * where the chat turns it into a prefilled message.
 *
 * Twin: public/inspect.js — keep the logic in sync.
 */

export const INSPECT_SOURCE = `(function () {
  if (window.__rbInspectLoaded) return; window.__rbInspectLoaded = true;
  var on = false;
  var box = null, label = null;

  function ensureOverlay() {
    if (box) return;
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #6366f1;background:rgba(99,102,241,.12);border-radius:3px;display:none;';
    label = document.createElement('div');
    label.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;background:#6366f1;color:#fff;font:11px/1.6 system-ui,sans-serif;padding:0 6px;border-radius:3px;display:none;';
    document.documentElement.appendChild(box);
    document.documentElement.appendChild(label);
  }

  function hide() {
    if (box) { box.style.display = 'none'; label.style.display = 'none'; }
  }

  function highlight(el) {
    if (!el || el === document.body || el === document.documentElement) return hide();
    ensureOverlay();
    var r = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = r.left + 'px'; box.style.top = r.top + 'px';
    box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
    label.style.display = 'block';
    label.textContent = tagOf(el);
    label.style.left = r.left + 'px';
    label.style.top = (r.top > 20 ? r.top - 18 : r.bottom + 2) + 'px';
  }

  function tagOf(el) {
    var t = el.tagName.toLowerCase();
    if (el.id) t += '#' + el.id;
    else if (typeof el.className === 'string' && el.className.trim()) {
      t += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.');
    }
    return t;
  }

  function cssPath(el) {
    var parts = [];
    var node = el;
    while (node && node.tagName && parts.length < 4 && node !== document.body) {
      parts.unshift(tagOf(node));
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function describe(el) {
    return {
      tag: tagOf(el),
      text: (el.innerText || el.value || '').trim().slice(0, 80),
      path: cssPath(el),
      html: (el.outerHTML || '').slice(0, 500)
    };
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.type !== 'rb-inspect') return;
    on = !!d.on;
    if (!on) hide();
  });

  document.addEventListener('mousemove', function (e) {
    if (!on) return;
    highlight(e.target);
  }, true);

  document.addEventListener('click', function (e) {
    if (!on) return;
    e.preventDefault(); e.stopPropagation();
    try { window.top.postMessage({ type: 'rb-selected', el: describe(e.target) }, '*'); } catch (err) {}
    on = false; hide();
  }, true);
})();
`;
