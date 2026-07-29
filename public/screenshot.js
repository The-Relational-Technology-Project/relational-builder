// Twin of SCREENSHOT_SOURCE in src/preview/screenshot.ts — keep in sync.
(function () {
  if (window.__rbShotLoaded) return; window.__rbShotLoaded = true;
  var libPromise = null;
  function lib() {
    if (!libPromise) libPromise = import('https://esm.sh/html-to-image@1.11.13');
    return libPromise;
  }
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.type !== 'rb-screenshot' || !d.id) return;
    function reply(msg) {
      msg.type = 'rb-screenshot-done'; msg.id = d.id;
      try { parent.postMessage(msg, '*'); } catch (err) {}
    }
    lib().then(function (mod) {
      var opts = {
        backgroundColor: '#ffffff',
        pixelRatio: 1,
        quality: 0.92,
        // A broken or CORS-refusing remote image must not sink the capture
        imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
      };
      return mod.toJpeg(document.body, opts).catch(function () {
        // Cross-origin stylesheets can poison font inlining — retry without
        var bare = {}; for (var k in opts) bare[k] = opts[k]; bare.skipFonts = true;
        return mod.toJpeg(document.body, bare);
      });
    }).then(function (dataUrl) {
      reply({ dataUrl: dataUrl });
    }).catch(function (err) {
      reply({ error: String((err && err.message) || err) });
    });
  });
})();
