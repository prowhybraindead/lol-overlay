// animations.js — GSAP animations for overlay elements
// Requires GSAP to be loaded via CDN in the HTML

(function () {
  'use strict';

  // Wait for GSAP to be available
  function waitForGSAP(callback) {
    if (typeof gsap !== 'undefined') {
      callback();
    } else {
      setTimeout(() => waitForGSAP(callback), 100);
    }
  }

  waitForGSAP(() => {

    // ─── Timer Fade-In Animation ───────────────────────────────
    window.animateTimerFadeIn = function (element) {
      if (!element) return;
      gsap.fromTo(element,
        { opacity: 0, scale: 0.8, y: -10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.7)' }
      );
    };

    // ─── Kill Notification Slide-In ────────────────────────────
    window.animateKillNotification = function (element) {
      if (!element) return;
      gsap.fromTo(element,
        { opacity: 0, x: -40, scale: 0.95 },
        { opacity: 1, x: 0, scale: 1, duration: 0.4, ease: 'power2.out' }
      );
      // Auto-fade out after 5 seconds
      gsap.to(element, {
        opacity: 0, x: -30, duration: 0.5, delay: 5, ease: 'power2.in',
        onComplete: () => { if (element.parentNode) element.parentNode.removeChild(element); }
      });
    };

    // ─── Score Number Transition ───────────────────────────────
    window.animateScoreChange = function (element, newValue) {
      if (!element) return;
      gsap.to(element, {
        scale: 1.3,
        duration: 0.15,
        ease: 'power2.out',
        onComplete: () => {
          element.textContent = newValue;
          gsap.to(element, { scale: 1, duration: 0.3, ease: 'elastic.out(1, 0.5)' });
        }
      });
    };

    // ─── Panel Slide-Up Entry ──────────────────────────────────
    window.animatePanelEntry = function (element, delay = 0) {
      if (!element) return;
      gsap.fromTo(element,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6, delay, ease: 'power3.out' }
      );
    };

    // ─── Gold Value Pulse ──────────────────────────────────────
    window.animateGoldPulse = function (element) {
      if (!element) return;
      gsap.fromTo(element,
        { color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.5)' },
        {
          color: '#ffffff', textShadow: '0 0 0px rgba(255,215,0,0)',
          duration: 1, ease: 'power2.out'
        }
      );
    };

    // ─── Pick/Ban Champion Reveal ──────────────────────────────
    window.animateChampionReveal = function (element) {
      if (!element) return;
      gsap.fromTo(element,
        { opacity: 0, scale: 1.2, filter: 'brightness(2)' },
        { opacity: 1, scale: 1, filter: 'brightness(1)', duration: 0.5, ease: 'power2.out' }
      );
    };

    // ─── Stagger Children ──────────────────────────────────────
    window.animateStaggerChildren = function (parent, childSelector, stagger = 0.08) {
      if (!parent) return;
      const children = parent.querySelectorAll(childSelector);
      gsap.fromTo(children,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger, ease: 'power2.out' }
      );
    };

    // ─── Progress Bar Fill ─────────────────────────────────────
    window.animateProgressBar = function (element, percentage) {
      if (!element) return;
      gsap.to(element, { width: `${percentage}%`, duration: 0.8, ease: 'power2.out' });
    };

    console.log('[Animations] GSAP animations loaded');
  });

})();
