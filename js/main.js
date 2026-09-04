/**
 * NOBLE DETAILING — CLEAN INTERACTION CONTROLLER
 * Mobile Navigation Drawer | Headlight Reveal | Minimal Hotspots | Calculator Engine | Draggable Slider
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initHeroHeadlightReveal();
  initCleanHotspots();
  initCleanSlider();
  initCleanCalculator();
  initCleanFaq();
  initCleanModal();
  initSmoothScroll();
  initScrollReveal();
});

/* ==========================================================================
   0. LUXURY MOBILE NAVIGATION DRAWER
   ========================================================================== */
function initMobileNav() {
  const toggleBtn = document.querySelector('.nav-toggle-btn');
  const mobileDrawer = document.querySelector('.nav-mobile-drawer');
  if (!toggleBtn || !mobileDrawer) return;

  function openMenu() {
    toggleBtn.classList.add('active');
    toggleBtn.setAttribute('aria-expanded', 'true');
    mobileDrawer.classList.add('active');
    document.body.classList.add('menu-open');
  }

  function closeMenu() {
    toggleBtn.classList.remove('active');
    toggleBtn.setAttribute('aria-expanded', 'false');
    mobileDrawer.classList.remove('active');
    document.body.classList.remove('menu-open');
  }

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = mobileDrawer.classList.contains('active');
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Close when tapping links or quote button in mobile menu
  const drawerLinks = mobileDrawer.querySelectorAll('a, button');
  drawerLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeMenu();
    });
  });

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileDrawer.classList.contains('active')) {
      closeMenu();
    }
  });

  // Auto-close on resize to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 860 && mobileDrawer.classList.contains('active')) {
      closeMenu();
    }
  });
}

/* ==========================================================================
   1. HERO HEADLIGHT SYNC & REVEAL
   ========================================================================== */
function initHeroHeadlightReveal() {
  const hero = document.getElementById('hero');
  const video = document.getElementById('heroVideo');
  if (!hero || !video) return;

  let hasRevealed = false;

  function revealHeroUI() {
    if (hasRevealed) return;
    hasRevealed = true;
    hero.classList.add('hero-revealed');
  }

  video.muted = true;
  video.playsInline = true;

  // When headlights ignite near the end of the video
  video.addEventListener('timeupdate', () => {
    if (video.duration && video.currentTime >= video.duration * 0.65) {
      revealHeroUI();
    }
  });

  // When video holds on the final frame
  video.addEventListener('ended', () => {
    video.pause();
    revealHeroUI();
  });

  // Play attempt
  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // If autoplay was paused by browser policy, reveal after brief delay
      setTimeout(revealHeroUI, 1200);
    });
  }

  // Guaranteed fallback timer in case timeupdate is delayed
  setTimeout(revealHeroUI, 2800);
}

/* ==========================================================================
   2. MINIMAL SERVICE HOTSPOT POINTERS
   ========================================================================== */
function initCleanHotspots() {
  const hotspots = document.querySelectorAll('.hotspot-clean');
  
  hotspots.forEach(hotspot => {
    hotspot.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = hotspot.classList.contains('active');
      hotspots.forEach(h => h.classList.remove('active'));
      if (!isActive) {
        hotspot.classList.add('active');
      }
    });
  });

  document.addEventListener('click', () => {
    hotspots.forEach(h => h.classList.remove('active'));
  });
}

/* ==========================================================================
   3. BEFORE & AFTER DRAGGABLE SLIDER
   ========================================================================== */
function initCleanSlider() {
  const container = document.getElementById('sliderStage');
  const beforeWrap = document.getElementById('sliderBeforeWrap');
  const divider = document.getElementById('sliderDivider');
  const beforeImg = beforeWrap ? beforeWrap.querySelector('img') : null;

  if (!container || !beforeWrap || !divider || !beforeImg) return;

  let isDragging = false;

  function updateImgSize() {
    const rect = container.getBoundingClientRect();
    if (beforeImg && rect.width > 0) {
      beforeImg.style.width = `${rect.width}px`;
    }
  }

  function setSliderPos(clientX) {
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    let offsetX = clientX - rect.left;
    if (offsetX < 0) offsetX = 0;
    if (offsetX > rect.width) offsetX = rect.width;

    const pct = (offsetX / rect.width) * 100;
    beforeWrap.style.width = `${pct}%`;
    divider.style.left = `${pct}%`;
    beforeImg.style.width = `${rect.width}px`;
  }

  updateImgSize();
  window.addEventListener('resize', updateImgSize);

  // Mouse controls
  divider.addEventListener('mousedown', (e) => {
    isDragging = true;
    e.preventDefault();
  });
  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    setSliderPos(e.clientX);
  });
  window.addEventListener('mouseup', () => { isDragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (isDragging) setSliderPos(e.clientX);
  });

  // Touch controls
  divider.addEventListener('touchstart', (e) => {
    isDragging = true;
  }, { passive: true });

  container.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches[0]) {
      const rect = container.getBoundingClientRect();
      const touchX = e.touches[0].clientX;
      if (touchX >= rect.left && touchX <= rect.right) {
        setSliderPos(touchX);
      }
    }
  }, { passive: true });

  window.addEventListener('touchend', () => { isDragging = false; });
  window.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches && e.touches[0]) {
      setSliderPos(e.touches[0].clientX);
    }
  }, { passive: true });
}

/* ==========================================================================
   4. INSTANT PRICE CALCULATOR
   ========================================================================== */
function initCleanCalculator() {
  const vehicleBtns = document.querySelectorAll('.vehicle-btn');
  const tierRadios = document.querySelectorAll('input[name="clean_tier"]');
  const addonInputs = document.querySelectorAll('.calc-addon-input');
  
  const vehicleDisplay = document.getElementById('summaryVehicle');
  const tierDisplay = document.getElementById('summaryTier');
  const totalDisplay = document.getElementById('summaryTotal');
  const bookBtn = document.getElementById('calcBookTrigger');

  const multipliers = { sedan: 1.0, suv: 1.2, truck: 1.35, exotic: 1.5 };
  const vehicleLabels = {
    sedan: 'Sedan / Coupe',
    suv: 'SUV / Crossover',
    truck: 'Truck / Large Van',
    exotic: 'Exotic / Supercar'
  };

  let currentVehicle = 'sedan';
  let currentTierPrice = 179;
  let currentTierTitle = 'Interior & Exterior Detail';

  vehicleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      vehicleBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      currentVehicle = btn.getAttribute('data-vehicle');
      recalc();
    });
  });

  tierRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.tier-item-radio').forEach(lbl => lbl.classList.remove('selected'));
      const parent = radio.closest('.tier-item-radio');
      if (parent) parent.classList.add('selected');

      currentTierPrice = parseFloat(radio.getAttribute('data-price')) || 179;
      currentTierTitle = radio.getAttribute('data-name') || 'Detailing Tier';
      recalc();
    });
  });

  addonInputs.forEach(input => {
    input.addEventListener('change', recalc);
  });

  function recalc() {
    const mult = multipliers[currentVehicle] || 1.0;
    const baseVehiclePrice = Math.round(currentTierPrice * mult);
    
    let addonsTotal = 0;
    addonInputs.forEach(chk => {
      if (chk.checked) {
        addonsTotal += parseFloat(chk.getAttribute('data-cost')) || 0;
      }
    });

    const total = baseVehiclePrice + addonsTotal;

    if (vehicleDisplay) vehicleDisplay.textContent = vehicleLabels[currentVehicle];
    if (tierDisplay) tierDisplay.textContent = `${currentTierTitle} (CA$${baseVehiclePrice})`;
    if (totalDisplay) totalDisplay.textContent = `CA$${total}.00`;
  }

  if (bookBtn) {
    bookBtn.addEventListener('click', () => {
      openModalWithService(`Quote for ${vehicleLabels[currentVehicle]} — ${currentTierTitle}`);
    });
  }

  recalc();
}

/* ==========================================================================
   5. MINIMAL FAQ ACCORDION
   ========================================================================== */
function initCleanFaq() {
  const rows = document.querySelectorAll('.faq-row');
  rows.forEach(row => {
    const trigger = row.querySelector('.faq-trigger');
    if (!trigger) return;

    trigger.addEventListener('click', () => {
      const isActive = row.classList.contains('active');
      rows.forEach(r => r.classList.remove('active'));
      if (!isActive) row.classList.add('active');
    });
  });
}

/* ==========================================================================
   6. MODAL & TOAST
   ========================================================================== */
function initCleanModal() {
  const modal = document.getElementById('quoteModal');
  const closeBtn = document.getElementById('modalCloseBtn');
  const form = document.getElementById('bookingForm');

  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const service = btn.getAttribute('data-service') || 'General Inquiry';
      openModalWithService(service);
    });
  });

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  // Escape key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      modal.classList.remove('active');
    }
  });

  if (form) {
    form.addEventListener('submit', (e) => handleFormSubmit(e, form, {
      successMessage: 'Booking request received. A Noble concierge specialist will contact you shortly.',
      onSuccess: () => { if (modal) modal.classList.remove('active'); },
    }));
  }

  const contactPageForm = document.getElementById('contactPageForm');
  if (contactPageForm) {
    contactPageForm.addEventListener('submit', (e) => handleFormSubmit(e, contactPageForm, {
      successMessage: 'Reservation request received! Our concierge team will reach out shortly.',
    }));
  }
}

async function submitNetlifyForm(form) {
  const response = await fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(new FormData(form)).toString(),
  });
  if (!response.ok) throw new Error('Form submission failed');
}

async function handleFormSubmit(event, form, { successMessage, onSuccess }) {
  event.preventDefault();
  const submitBtn = form.querySelector('[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    await submitNetlifyForm(form);
    if (onSuccess) onSuccess();
    form.reset();
    showCleanToast(successMessage);
  } catch {
    showCleanToast('Could not send your request. Please call +1 (613) 879-9461.');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function openModalWithService(serviceText) {
  const modal = document.getElementById('quoteModal');
  const input = document.getElementById('serviceField');
  if (input && serviceText) input.value = serviceText;
  if (modal) modal.classList.add('active');
}

function showCleanToast(msg) {
  let toast = document.getElementById('cleanToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cleanToast';
    toast.style.cssText = `
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      max-width: calc(100vw - 3rem);
      background: #18181f;
      color: #ffffff;
      border: 1px solid rgba(197, 160, 89, 0.4);
      padding: 0.9rem 1.4rem;
      border-radius: 8px;
      font-size: 0.85rem;
      z-index: 2100;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 4000);
}

/* ==========================================================================
   7. SMOOTH SCROLLING
   ========================================================================== */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const el = document.querySelector(targetId);
      if (el) {
        e.preventDefault();
        const offset = 80;
        const pos = el.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: pos, behavior: 'smooth' });
      }
    });
  });
}

/* ==========================================================================
   8. SCROLL FLOW-IN REVEAL (Intersection Observer)
   ========================================================================== */
function initScrollReveal() {
  const autoTargets = [
    '.section-header-clean',
    '.subpage-hero-title',
    '.subpage-hero-desc',
    '.eyebrow',
    '.bento-card',
    '.package-item',
    '.pillar-card',
    '.review-item-clean',
    '.faq-row',
    '.channel-item',
    '.story-img-wrap',
    '.story-text',
    '.calc-card-clean',
    '.contact-form-box',
    '.contact-info-card',
    '.slider-stage-clean',
    '.footer-service-area',
  ];

  autoTargets.forEach(selector => {
    document.querySelectorAll(selector).forEach((el, i) => {
      if (
        el.classList.contains('reveal') ||
        el.classList.contains('reveal-left') ||
        el.classList.contains('reveal-right')
      ) return;

      el.classList.add('reveal');

      const staggerIndex = i % 5;
      if (staggerIndex > 0) {
        el.classList.add(`reveal-delay-${staggerIndex}`);
      }
    });
  });

  const storyImg = document.querySelector('.story-img-wrap');
  const storyTxt = document.querySelector('.story-text');
  if (storyImg) {
    storyImg.classList.remove('reveal');
    storyImg.classList.add('reveal-left');
  }
  if (storyTxt) {
    storyTxt.classList.remove('reveal');
    storyTxt.classList.add('reveal-right');
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
    observer.observe(el);
  });
}
