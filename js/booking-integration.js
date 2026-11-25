'use strict';

(() => {
  const frame = document.getElementById('booking-frame');
  if (!frame) return;
  let observer;
  document.querySelectorAll('[data-booking-quote]').forEach(button => {
    button.addEventListener('click', () => {
      frame.contentWindow.dispatchEvent(new Event('noble-open-quote'));
      frame.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const connect = () => {
    observer?.disconnect();
    const doc = frame.contentDocument;
    if (!doc?.body) return;
    const resize = () => {
      const height = Math.ceil(Math.max(doc.body.scrollHeight, doc.body.getBoundingClientRect().height));
      frame.style.height = `${height}px`;
    };
    observer = new ResizeObserver(resize);
    observer.observe(doc.body);
    resize();
    doc.fonts?.ready.then(resize);
  };

  frame.addEventListener('load', connect);
  if (frame.contentDocument?.readyState === 'complete') connect();
})();
