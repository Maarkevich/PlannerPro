/* ============================================================
   Planner Pro — Утилиты  (v1.0.0)
   UUID, даты, жесты, анимации, тема, sanitize, haptics
   ============================================================ */

(function () {
  'use strict';

  /* ---------- UUID ---------- */
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /* ---------- Debounce / throttle ---------- */
  function debounce(fn, ms = 300) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function throttle(fn, ms = 100) {
    let last = 0, timer;
    return function (...args) {
      const now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn.apply(this, args);
      } else {
        clearTimeout(timer);
        timer = setTimeout(() => { last = Date.now(); fn.apply(this, args); }, ms - (now - last));
      }
    };
  }

  /* ---------- Dates ---------- */
  const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const MONTHS_NOM = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  const MONTHS_GEN = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  function toISODate(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `y−{y}-y−{m}-${day}`;
  }

  function fromISODate(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function addMonths(date, n) {
    const d = new Date(date.getFullYear(), date.getMonth() + n, 1);
    return d;
  }

  function isSameDay(a, b) {
    return toISODate(a) === toISODate(b);
  }

  function isToday(date) {
    return isSameDay(date, new Date());
  }

  function isPast(date) {
    const today = todayISO();
    return !!date && date < today;
  }

  function formatFullDate(date) {
    const d = new Date(date);
    return `d.getDate(){d.getDate()}d.getDate(){MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatShortDate(date) {
    const d = new Date(date);
    return `d.getDate(){d.getDate()}d.getDate(){MONTHS_GEN[d.getMonth()].slice(0, 3)}`;
  }

  function formatTime(hhmm) {
    return hhmm || '';
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return 'Доброй ночи';
    if (h < 12) return 'Доброе утро';
    if (h < 18) return 'Добрый день';
    return 'Добрый вечер';
  }

  // Матрица календаря месяца (6 недель × 7 дней), неделя с Пн
  function monthMatrix(year, month) {
    const first = new Date(year, month, 1);
    let startOffset = (first.getDay() + 6) % 7; // Пн=0
    const cells = [];
    const start = addDays(first, -startOffset);
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      cells.push({
        date: d,
        iso: toISODate(d),
        inMonth: d.getMonth() === month,
        isToday: isToday(d)
      });
    }
    return cells;
  }

  /* ---------- Sanitize (лёгкая замена DOMPurify для офлайна) ---------- */
  const ALLOWED_TAGS = new Set([
    'P','BR','B','STRONG','I','EM','U','S','DEL','H1','H2','H3','H4',
    'UL','OL','LI','BLOCKQUOTE','PRE','CODE','HR','A','DIV','SPAN'
  ]);
  const ALLOWED_ATTRS = new Set(['href', 'class', 'data-checked']);

  function sanitizeHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    walk(template.content);
    return template.innerHTML;

    function walk(node) {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (!ALLOWED_TAGS.has(child.tagName)) {
            // Заменяем запрещённый тег на span/текст
            if (['SCRIPT','STYLE','IFRAME','OBJECT','EMBED'].includes(child.tagName)) {
              child.remove();
              return;
            }
            const span = document.createElement('span');
            [...child.childNodes].forEach((c) => span.appendChild(c));
            child.replaceWith(span);
            walk(span);
            return;
          }
          [...child.attributes].forEach((attr) => {
            const name = attr.name.toLowerCase();
            const val = attr.value.trim().toLowerCase();
            if (!ALLOWED_ATTRS.has(name)) { child.removeAttribute(attr.name); return; }
            if (name === 'href' && (val.startsWith('javascript:') || val.startsWith('data:'))) {
              child.removeAttribute(attr.name);
            }
          });
          walk(child);
        } else if (child.nodeType === Node.COMMENT_NODE) {
          child.remove();
        }
      });
    }
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }

  /* ---------- Theme ---------- */
  function applyTheme(theme, mode) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-mode', mode);
    const metaLight = document.querySelector('meta[name="theme-color"][media*="light"]');
    const metaDark = document.querySelector('meta[name="theme-color"][media*="dark"]');
    const colors = {
      ocean: ['#667eea', '#1a1a2e'],
      sunset: ['#fa709a', '#2d1b1b'],
      forest: ['#11998e', '#0d1f0d'],
      neon: ['#b721ff', '#1a0a1a']
    };
    const [light, dark] = colors[theme] || colors.ocean;
    if (metaLight) metaLight.content = light;
    if (metaDark) metaDark.content = dark;
  }

  /* ---------- Haptics ---------- */
  function haptic(pattern = 10) {
    try {
      if ('vibrate' in navigator && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        navigator.vibrate(pattern);
      }
    } catch (_) { /* ignore */ }
  }

  /* ---------- Gestures ---------- */

  // Свайп по элементу: влево → onDelete, вправо → onComplete
  function attachSwipe(el, { onComplete, onDelete, threshold = 80 }) {
    let startX = 0, startY = 0, dx = 0, tracking = false;

    el.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = 0;
      tracking = true;
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (!tracking) return;
      const mx = e.touches[0].clientX - startX;
      const my = e.touches[0].clientY - startY;
      if (Math.abs(my) > Math.abs(mx)) { tracking = false; el.style.transform = ''; return; }
      dx = mx;
      // Сопротивление за порогом
      const limited = Math.sign(dx) * Math.min(Math.abs(dx), threshold + 40);
      el.style.transition = 'none';
      el.style.transform = `translateX(${limited}px)`;
    }, { passive: true });

    el.addEventListener('touchend', () => {
      if (!tracking) return;
      tracking = false;
      el.style.transition = '';
      el.style.transform = '';
      if (dx > threshold && onComplete) { haptic(15); onComplete(); }
      else if (dx < -threshold && onDelete) { haptic([10, 30, 10]); onDelete(); }
      dx = 0;
    }, { passive: true });
  }

  // Long press → onLongPress
  function attachLongPress(el, onLongPress, ms = 500) {
    let timer = null, moved = false;
    el.addEventListener('touchstart', (e) => {
      moved = false;
      timer = setTimeout(() => {
        if (!moved) { haptic(20); onLongPress(e); }
      }, ms);
    }, { passive: true });
    ['touchmove', 'touchend', 'touchcancel'].forEach((ev) =>
      el.addEventListener(ev, () => { clearTimeout(timer); }, { passive: true })
    );
    el.addEventListener('touchmove', () => { moved = true; }, { passive: true });
  }

  // Pull-to-refresh на контейнере
  function attachPullToRefresh(container, onRefresh) {
    let startY = 0, pulling = false;
    const indicator = container.querySelector('.ptr-indicator');

    container.addEventListener('touchstart', (e) => {
      if (container.scrollTop <= 0) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0 && container.scrollTop <= 0 && indicator) {
        indicator.classList.toggle('visible', dy > 60);
      }
    }, { passive: true });

    container.addEventListener('touchend', async (e) => {
      if (!pulling) return;
      pulling = false;
      const dy = e.changedTouches[0].clientY - startY;
      if (dy > 60 && indicator) {
        indicator.classList.add('visible');
        await onRefresh?.();
        setTimeout(() => indicator.classList.remove('visible'), 400);
      }
    }, { passive: true });
  }

  /* ---------- Ripple effect ---------- */
  function attachRipple(el) {
    el.addEventListener('pointerdown', (e) => {
      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 550);
    });
  }

  /* ---------- Confetti ---------- */
  function confetti(count = 60) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#667eea', '#764ba2', '#4facfe', '#fa709a', '#fee140', '#38ef7d', '#21d4fd'];
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = colors[(Math.random() * colors.length) | 0];
      piece.style.animationDuration = `${1.5 + Math.random()}s`;
      piece.style.animationDelay = `${Math.random() * .3}s`;
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 3000);
    }
  }

  /* ---------- Number count-up animation ---------- */
  function animateNumber(el, target, duration = 800) {
    const start = performance.now();
    const from = parseInt(el.textContent, 10) || 0;
    function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      el.textContent = Math.round(from + (target - from) * eased);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Misc helpers ---------- */
  function plural(n, forms) { // forms: [one, few, many]
    const abs = Math.abs(n) % 100;
    const n1 = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (n1 > 1 && n1 < 5) return forms[1];
    if (n1 === 1) return forms[0];
    return forms[2];
  }

  function downloadFile(filename, content, mime = 'application/json') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  window.PlannerUtils = {
    uuid, debounce, throttle,
    WEEKDAYS_SHORT, MONTHS_NOM, MONTHS_GEN,
    toISODate, fromISODate, todayISO, addDays, addMonths,
    isSameDay, isToday, isPast,
    formatFullDate, formatShortDate, formatTime, greeting, monthMatrix,
    sanitizeHTML, escapeHTML,
    applyTheme, haptic,
    attachSwipe, attachLongPress, attachPullToRefresh, attachRipple,
    confetti, animateNumber, plural, downloadFile
  };
})();
