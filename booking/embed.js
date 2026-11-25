'use strict';

// Keep the source configuration intact and adapt only this embedded entry point.
window.NOBLE_CONFIG.websiteUrl = '../index.html';

// Booking steps normally scroll their own page. Scroll the website instead.
if (window.parent !== window) {
  window.scrollTo = () => {
    const frame = window.frameElement;
    if (!frame) return;
    const top = frame.getBoundingClientRect().top + window.parent.scrollY - 110;
    window.parent.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
  };
}
