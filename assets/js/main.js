/* ============================================================================
   COLBIOS — landing page behaviour

   This page does not process payments. Its most important job is to hand the
   student off to the COLBIOS payment platform, whose URL comes from
   assets/js/config.js and from nowhere else.

   No animation library, no continuously running animation, no third-party
   requests. Scroll work is one IntersectionObserver and one passive listener.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.__COLBIOS_CONFIG__ || {};
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var txt = function (v) { return typeof v === 'string' ? v.trim() : ''; };

  /* Only http(s) destinations are accepted, so a malformed or unsafe value in
     config can never turn a Pay Now button into a script URL. */
  function safeUrl(value) {
    var raw = txt(value);
    if (!raw) return '';
    try {
      var u = new URL(raw, window.location.href);
      return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
    } catch (e) { return ''; }
  }

  var PAYMENT_PLATFORM_URL = safeUrl(CFG.PAYMENT_PLATFORM_URL);
  var NEW_TAB = CFG.OPEN_IN_NEW_TAB === true;
  var DELAY = REDUCED ? 0 : Math.max(0, parseInt(CFG.REDIRECT_DELAY_MS, 10) || 0);

  /* ======================================================= configured copy == */
  $$('[data-institution-short]').forEach(function (el) {
    el.textContent = txt(CFG.INSTITUTION_SHORT) || 'FUNAAB';
  });
  $$('[data-institution-name]').forEach(function (el) {
    el.textContent = txt(CFG.INSTITUTION_NAME) || 'Federal University of Agriculture, Abeokuta';
  });

  // Only stated if the deployment configured it. Never asserted by default.
  var rel = txt(CFG.INSTITUTION_RELATIONSHIP);
  var relEl = $('[data-institution-relationship]');
  if (relEl && rel) relEl.textContent = rel;

  var yearEl = $('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Optional footer links: a link with no URL becomes plain, non-focusable text.
  $$('[data-optional-link]').forEach(function (a) {
    var url = safeUrl(CFG[a.dataset.urlKey]);
    if (url) a.setAttribute('href', url);
    else a.removeAttribute('href');
  });

  /* Support details, shown only when configured. */
  (function support() {
    var email = txt(CFG.SUPPORT_EMAIL), phone = txt(CFG.SUPPORT_PHONE), hours = txt(CFG.SUPPORT_HOURS);
    if (!email && !phone && !hours) return;

    var block = $('[data-support-block]');
    if (block) {
      var parts = [];
      if (email) parts.push('<p class="site-foot__support"><a href="mailto:' + email + '">' + email + '</a></p>');
      if (phone) parts.push('<p class="site-foot__support"><a href="tel:' + phone.replace(/\s+/g, '') + '">' + phone + '</a></p>');
      if (hours) parts.push('<p class="site-foot__support-note">' + hours + '</p>');
      block.innerHTML = parts.join('');
    }

    var answer = $('[data-support-answer]');
    if (answer) {
      var line = 'You can also reach COLBIOS support directly'
        + (email ? ' by email at ' + email : '')
        + (email && phone ? ',' : '')
        + (phone ? ' on ' + phone : '')
        + (hours ? ' (' + hours + ')' : '') + '.';
      answer.textContent = answer.textContent.trim() + ' ' + line;
    }
  })();

  /* Keep canonical / og:url in step with the deployed address. Both are also
     set in the markup for crawlers that do not run JavaScript. */
  var siteUrl = safeUrl(CFG.SITE_URL);
  if (siteUrl) {
    var canon = $('link[rel="canonical"]');
    if (canon) canon.setAttribute('href', siteUrl);
    var og = $('meta[property="og:url"]');
    if (og) og.setAttribute('content', siteUrl);
  }

  /* ================================================= handoff to the platform */
  var overlay = $('[data-handoff]');
  var overlayTitle = $('[data-handoff-title]');
  var overlayNote = $('[data-handoff-note]');
  var overlayClose = $('[data-handoff-close]');
  var lastFocus = null;

  function showOverlay(blocked) {
    if (!overlay) return;
    lastFocus = document.activeElement;
    overlay.classList.toggle('is-blocked', !!blocked);
    overlay.style.setProperty('--handoff-ms', DELAY + 'ms');

    if (blocked) {
      overlayTitle.textContent = 'Payment platform not configured';
      overlayNote.textContent = 'This site has no payment platform address set yet, so there is '
        + 'nowhere to send you. Whoever deploys the site sets PAYMENT_PLATFORM_URL in '
        + 'assets/js/config.js.';
      overlayClose.hidden = false;
    }
    overlay.hidden = false;
    var target = blocked ? overlayClose : overlay.querySelector('.handoff__box');
    if (target && target.focus) target.focus();
  }

  function hideOverlay() {
    if (!overlay) return;
    overlay.hidden = true;
    overlay.classList.remove('is-blocked');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  if (overlayClose) overlayClose.addEventListener('click', hideOverlay);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay && !overlay.hidden && overlay.classList.contains('is-blocked')) hideOverlay();
  });

  // Every Pay Now on the page, wired from the one configured destination.
  $$('[data-pay]').forEach(function (link) {
    if (PAYMENT_PLATFORM_URL) {
      link.setAttribute('href', PAYMENT_PLATFORM_URL);
      if (NEW_TAB) { link.setAttribute('target', '_blank'); link.setAttribute('rel', 'noopener'); }
    } else {
      // Not aria-disabled: the control still does something useful when
      // activated (it explains that the destination is unset), and a disabled
      // control would tell assistive tech the opposite.
      link.setAttribute('href', '#');
      link.setAttribute('data-unconfigured', 'true');
    }

    link.addEventListener('click', function (e) {
      if (!PAYMENT_PLATFORM_URL) { e.preventDefault(); showOverlay(true); return; }
      // A new tab must open inside the user's own gesture, so let the browser
      // do it; only the same-tab path gets the interstitial.
      if (NEW_TAB) return;
      // Respect open-in-new-tab intent (ctrl/cmd/shift/middle click).
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      e.preventDefault();
      showOverlay(false);
      window.setTimeout(function () { window.location.href = PAYMENT_PLATFORM_URL; }, DELAY);
    });
  });

  /* ================================================================ header == */
  var head = $('[data-head]');
  var menuBtn = $('[data-menu-toggle]');
  var menu = $('[data-menu]');
  var menuLabel = $('[data-menu-label]');

  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () {
      var open = menuBtn.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', String(!open));
      menu.hidden = open;
      if (menuLabel) menuLabel.textContent = open ? 'Open menu' : 'Close menu';
    });
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () {
        menuBtn.setAttribute('aria-expanded', 'false');
        menu.hidden = true;
        if (menuLabel) menuLabel.textContent = 'Open menu';
      });
    });
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      if (head) head.classList.toggle('is-stuck', window.scrollY > 8);
    });
  }, { passive: true });

  /* ======================================================== scroll reveals == */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

    $$('[data-reveal]').forEach(function (el) {
      var sibs = Array.prototype.filter.call(el.parentNode.children, function (n) {
        return n.hasAttribute && n.hasAttribute('data-reveal');
      });
      el.style.setProperty('--rd', (sibs.indexOf(el) * 70) + 'ms');
      io.observe(el);
    });
  } else {
    $$('[data-reveal]').forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ================================================================== faq == */
  $$('.faq__q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq__item');
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      var open = btn.getAttribute('aria-expanded') === 'true';

      if (open) {
        btn.setAttribute('aria-expanded', 'false');
        item.classList.remove('is-open');
        // Leave it in the DOM until the collapse finishes, then hide it from
        // assistive technology too.
        window.setTimeout(function () {
          if (btn.getAttribute('aria-expanded') === 'false') panel.hidden = true;
        }, 340);
      } else {
        panel.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        window.requestAnimationFrame(function () { item.classList.add('is-open'); });
      }
    });
  });

})();
