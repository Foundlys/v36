'use strict';
// Installation is progressive enhancement. Updates wait for the normal browser
// lifecycle so a newly downloaded worker never interrupts an unfinished form.
(() => {
  if (!globalThis.isSecureContext || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/foundly-sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
    // The online application remains usable if the browser rejects installation.
  });
})();
