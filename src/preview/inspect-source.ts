/**
 * The preview inspector — "point at what you want to change."
 *
 * Injected into the Sandpack preview (as /rb-inspect.js for static
 * templates, and served from public/inspect.js for bundled templates).
 * Inert until the builder toggles select mode; then it highlights elements
 * on hover and posts a descriptor of the clicked element to the top window,
 * where the chat turns it into a prefilled message.
 *
 * It also owns the inline text editor: when the parent replies with
 * rb-edit-text, the clicked element becomes contenteditable right in the
 * page, and Save posts the retyped wording back (rb-edit-save) for the
 * parent to land in source — no model call.
 *
 * Twin: public/inspect.js — keep the logic in sync.
 */

export const INSPECT_SOURCE = `(function () {
  if (window.__rbInspectLoaded) return; window.__rbInspectLoaded = true;
  var on = false;
  var box = null, label = null;
  var lastEl = null, lastPoint = null;
  var editing = null; // { el, originalHtml, originalText }
  var chip = null;

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
    var raw = (el.innerText || el.value || '').trim();
    var isImg = el.tagName === 'IMG';
    return {
      tag: tagOf(el),
      text: raw.slice(0, 80),
      fullText: raw.slice(0, 400),
      // A "copy" element: readable text without much structure under it —
      // the chat offers a rewrite-this-text prefill instead of a generic one
      isCopy: raw.length > 0 && raw.length <= 400 && el.childElementCount <= 2,
      // No element children at all: safe to retype in place as plain text
      plain: el.childElementCount === 0,
      // Where this element lives in source — framework previews stamp
      // data-rb-source="file:line:col" on every element they render
      source: el.getAttribute('data-rb-source') || '',
      // Images carry enough to be swapped without a model call
      img: isImg ? {
        src: el.getAttribute('src') || '',
        current: (el.currentSrc || '').slice(0, 1000000),
        asset: el.getAttribute('data-asset') || '',
        alt: el.getAttribute('alt') || ''
      } : null,
      path: cssPath(el),
      html: (el.outerHTML || '').slice(0, 500)
    };
  }

  // --- Inline text editing: the pointed-at copy becomes editable right in
  // --- the page; Save posts {original, edited} for the parent to land in
  // --- source. The parent only asks for this when the wording maps to one
  // --- place in the code.

  function ensureChip() {
    if (chip) return;
    chip = document.createElement('div');
    chip.style.cssText = 'position:fixed;z-index:2147483647;display:none;align-items:center;gap:2px;background:#1f2937;color:#fff;border-radius:8px;padding:4px;box-shadow:0 4px 12px rgba(0,0,0,.3);';
    var save = document.createElement('button');
    save.textContent = 'Save';
    save.style.cssText = 'font:600 12px/1 system-ui,sans-serif;background:#6366f1;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer;';
    var cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.cssText = 'font:12px/1 system-ui,sans-serif;background:transparent;color:#d1d5db;border:0;border-radius:6px;padding:6px 10px;cursor:pointer;';
    var hint = document.createElement('span');
    hint.textContent = 'Enter saves · Esc cancels';
    hint.style.cssText = 'font:11px/1 system-ui,sans-serif;color:#9ca3af;padding:0 8px 0 4px;';
    // Keep focus (and the caret) in the edited element while clicking the chip
    chip.addEventListener('mousedown', function (e) { e.preventDefault(); });
    save.addEventListener('click', function () { finishEdit(true); });
    cancel.addEventListener('click', function () { finishEdit(false); });
    chip.appendChild(save); chip.appendChild(cancel); chip.appendChild(hint);
    document.documentElement.appendChild(chip);
  }

  function placeChip(el) {
    if (!chip) return;
    var r = el.getBoundingClientRect();
    chip.style.display = 'flex';
    var top = r.bottom + 8;
    if (top > window.innerHeight - 48) top = Math.max(8, r.top - 44);
    chip.style.top = top + 'px';
    chip.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 250)) + 'px';
  }

  function onEditKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); finishEdit(true); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finishEdit(false); }
  }
  function onEditInput() { if (editing) placeChip(editing.el); }
  function onEditBlur() {
    // Clicking away saves — forgiving beats losing the retype, and every
    // save is checkpointed; unchanged text quietly restores instead
    setTimeout(function () { if (editing) finishEdit(true); }, 0);
  }

  function startEdit() {
    if (editing || !lastEl || !document.contains(lastEl)) return;
    var el = lastEl;
    editing = { el: el, originalHtml: el.innerHTML, originalText: (el.innerText || '').trim() };
    try {
      el.setAttribute('contenteditable', 'plaintext-only');
      if (!el.isContentEditable) el.setAttribute('contenteditable', 'true');
    } catch (err) { el.setAttribute('contenteditable', 'true'); }
    el.style.outline = '2px solid #6366f1';
    el.style.outlineOffset = '2px';
    el.focus();
    // Put the caret where they clicked, not at the start
    if (lastPoint) {
      try {
        var range = null;
        if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(lastPoint.x, lastPoint.y);
        else if (document.caretPositionFromPoint) {
          var pos = document.caretPositionFromPoint(lastPoint.x, lastPoint.y);
          if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); }
        }
        if (range) {
          range.collapse(true);
          var sel = window.getSelection();
          sel.removeAllRanges(); sel.addRange(range);
        }
      } catch (err) {}
    }
    ensureChip();
    placeChip(el);
    el.addEventListener('keydown', onEditKey, true);
    el.addEventListener('input', onEditInput);
    el.addEventListener('blur', onEditBlur);
  }

  function finishEdit(save) {
    if (!editing) return;
    var el = editing.el, originalHtml = editing.originalHtml, originalText = editing.originalText;
    var edited = (el.innerText || '').trim();
    editing = null;
    el.removeEventListener('keydown', onEditKey, true);
    el.removeEventListener('input', onEditInput);
    el.removeEventListener('blur', onEditBlur);
    el.removeAttribute('contenteditable');
    el.style.outline = ''; el.style.outlineOffset = '';
    if (chip) chip.style.display = 'none';
    if (save && edited && edited !== originalText) {
      // Leave the new text showing — the rebuild re-renders it from source
      try { window.top.postMessage({ type: 'rb-edit-save', original: originalText, edited: edited }, '*'); } catch (err) {}
    } else {
      el.innerHTML = originalHtml;
    }
    try { el.blur(); } catch (err) {}
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d) return;
    if (d.type === 'rb-inspect') {
      // Arming select mode ends any edit in progress. Disarming must NOT:
      // the parent disarms right after asking for an edit, and that
      // message arriving second would cancel the edit it just started.
      if (editing && d.on) finishEdit(false);
      on = !!d.on;
      if (!on) hide();
    }
    if (d.type === 'rb-edit-text') startEdit();
  });

  document.addEventListener('mousemove', function (e) {
    if (!on) return;
    highlight(e.target);
  }, true);

  document.addEventListener('click', function (e) {
    if (editing) return; // while editing, clicks blur (which saves) on their own
    if (!on) return;
    e.preventDefault(); e.stopPropagation();
    lastEl = e.target; lastPoint = { x: e.clientX, y: e.clientY };
    try { window.top.postMessage({ type: 'rb-selected', el: describe(e.target) }, '*'); } catch (err) {}
    on = false; hide();
  }, true);
})();
`;
