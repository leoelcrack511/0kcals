(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Blob parallax (all sections) ───────────────────────────────────── */
  function initBlobParallax() {
    var allBlobs = document.querySelectorAll('[data-parallax-blob]');
    if (!allBlobs.length) return;

    var seen = [];
    var zones = [];
    allBlobs.forEach(function (blob) {
      var zone = blob.closest('[data-section], footer') || blob.parentElement;
      var idx = seen.indexOf(zone);
      if (idx === -1) {
        seen.push(zone);
        zones.push({ el: zone, blobs: [], bg: null });
        idx = zones.length - 1;
      }
      zones[idx].blobs.push(blob);
    });

    zones.forEach(function (zone) {
      zone.bg = zone.el.querySelector('[data-parallax-bg]');
    });

    zones.forEach(function (zone) {
      zone.el.addEventListener('mousemove', function (e) {
        var rect = zone.el.getBoundingClientRect();
        var x = (e.clientX - rect.left - rect.width / 2) / rect.width;
        var y = (e.clientY - rect.top - rect.height / 2) / rect.height;
        if (zone.bg) {
          zone.bg.style.transform = 'translate(' + (x * 70) + 'px,' + (y * 70) + 'px)';
        }
        zone.blobs.forEach(function (blob, i) {
          var f = (i + 1) * 220;
          blob.style.transform = 'translate(' + (x * f) + 'px,' + (y * f) + 'px)';
        });
      });
      zone.el.addEventListener('mouseleave', function () {
        if (zone.bg) zone.bg.style.transform = '';
        zone.blobs.forEach(function (blob) { blob.style.transform = ''; });
      });
    });
  }

  /* ── Ticker behavior ─────────────────────────────────────────────────── */
  function initTickerBehavior() {
    var strip = document.querySelector('[data-section="brand-strip"]');
    if (!strip) return;
    var tracks = strip.querySelectorAll('.ticker-track');
    if (!('IntersectionObserver' in window)) {
      /* fallback: set normal speed immediately */
      tracks.forEach(function (t) { t.style.animationDuration = '28s'; });
      return;
    }

    /* Slow start on scroll enter */
    new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        tracks.forEach(function (t) { t.style.animationDuration = '80s'; });
        setTimeout(function () {
          tracks.forEach(function (t) { t.style.animationDuration = '28s'; });
        }, 1200);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.5 }).observe(strip);

    /* Hover acceleration — continues from current position */
    function setTickerSpeed(track, durationSecs) {
      var anim = track.getAnimations && track.getAnimations()[0];
      if (anim) {
        var oldDuration = parseFloat(getComputedStyle(track).animationDuration) * 1000;
        var progress = (anim.currentTime % oldDuration) / oldDuration;
        track.style.animationDuration = durationSecs + 's';
        track.style.animationDelay = -(progress * durationSecs * 1000) + 'ms';
      } else {
        track.style.animationDuration = durationSecs + 's';
      }
    }

    strip.addEventListener('mouseenter', function () {
      tracks.forEach(function (t) { setTickerSpeed(t, 14); });
    });
    strip.addEventListener('mouseleave', function () {
      tracks.forEach(function (t) { setTickerSpeed(t, 28); });
    });

    /* Item mint flash */
    strip.querySelectorAll('[data-ticker-item]').forEach(function (item) {
      item.addEventListener('mouseenter', function () { item.style.color = 'var(--mint-500)'; });
      item.addEventListener('mouseleave', function () { item.style.color = ''; });
    });
  }

  /* ── Header dynamic island ───────────────────────────────────────────── */
  function initHeaderScroll() {
    var header = document.getElementById('site-header');
    if (!header) return;
    var lastScrollY = window.scrollY;
    var ticking = false;

    function update() {
      var currentY = window.scrollY;
      if (currentY > 80) {
        if (currentY > lastScrollY) {
          header.classList.add('header--island');
        } else {
          header.classList.remove('header--island');
        }
      } else {
        header.classList.remove('header--island');
      }
      lastScrollY = currentY;
      ticking = false;
    }

    update();
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
  }

  /* ── Scroll progress bar ─────────────────────────────────────────────── */
  function initScrollProgress() {
    var bar = document.getElementById('scroll-progress');
    if (!bar) return;
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
        ticking = false;
      });
    }, { passive: true });
  }

  /* ── Cursor dot ──────────────────────────────────────────────────────── */
  function initCursorDot() {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    var dot = document.getElementById('cursor-dot');
    if (!dot) return;

    var mx = 0, my = 0, dx = 0, dy = 0;

    document.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; });

    (function loop() {
      dx += (mx - dx) * 0.15;
      dy += (my - dy) * 0.15;
      var half = dot.offsetWidth / 2;
      dot.style.transform = 'translate(' + (dx - half) + 'px,' + (dy - half) + 'px)';
      requestAnimationFrame(loop);
    })();

    document.querySelectorAll('.btn, .prod-card, .nav-link, a[href]').forEach(function (el) {
      el.addEventListener('mouseenter', function () { dot.classList.add('cursor-dot--large'); });
      el.addEventListener('mouseleave', function () { dot.classList.remove('cursor-dot--large'); });
    });
  }

  /* ── Boot ────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initBlobParallax();
    initTickerBehavior();
    initHeaderScroll();
    initScrollProgress();
    initCursorDot();
  });

})();
