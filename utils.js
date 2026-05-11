/* =========================
   ID
========================= */

export function generateId() {

  return (
    crypto.randomUUID?.()
    || `${Date.now()}-${Math.random()}`
  );

}

/* =========================
   DATE
========================= */

export function formatDate(
  timestamp,
  options = {}
) {

  if (!timestamp) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      ...options
    }
  ).format(
    new Date(timestamp)
  );

}

export function formatTime(
  timestamp
) {

  if (!timestamp) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(
    new Date(timestamp)
  );

}

export function isToday(
  timestamp
) {

  const date = new Date(timestamp);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear()
    &&
    date.getMonth() === now.getMonth()
    &&
    date.getDate() === now.getDate()
  );

}

export function isSameDay(
  dateA,
  dateB
) {

  const a = new Date(dateA);
  const b = new Date(dateB);

  return (
    a.getFullYear() === b.getFullYear()
    &&
    a.getMonth() === b.getMonth()
    &&
    a.getDate() === b.getDate()
  );

}

export function startOfDay(
  timestamp = Date.now()
) {

  const date = new Date(timestamp);

  date.setHours(0,0,0,0);

  return date.getTime();

}

export function endOfDay(
  timestamp = Date.now()
) {

  const date = new Date(timestamp);

  date.setHours(23,59,59,999);

  return date.getTime();

}

/* =========================
   GREETING
========================= */

export function getGreeting() {

  const hour = new Date().getHours();

  if (hour < 5) {
    return 'Доброй ночи';
  }

  if (hour < 12) {
    return 'Доброе утро';
  }

  if (hour < 18) {
    return 'Добрый день';
  }

  return 'Добрый вечер';

}

/* =========================
   STORAGE
========================= */

export function safeJsonParse(
  value,
  fallback = null
) {

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }

}

/* =========================
   DEBOUNCE
========================= */

export function debounce(
  callback,
  delay = 300
) {

  let timeout;

  return (...args) => {

    clearTimeout(timeout);

    timeout = setTimeout(() => {
      callback(...args);
    }, delay);

  };

}

/* =========================
   CLAMP
========================= */

export function clamp(
  value,
  min,
  max
) {

  return Math.min(
    Math.max(value, min),
    max
  );

}

/* =========================
   TOAST
========================= */

export function showToast(
  message,
  type = 'default'
) {

  const container =
    document.getElementById(
      'toast-container'
    );

  if (!container) {
    return;
  }

  const toast =
    document.createElement('div');

  toast.className =
    `toast ${type}`;

  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {

    toast.style.opacity = '0';
    toast.style.transform =
      'translateY(10px)';

    setTimeout(() => {
      toast.remove();
    }, 180);

  }, 2600);

}

/* =========================
   HAPTIC
========================= */

export function vibrate(
  pattern = 10
) {

  if (
    'vibrate' in navigator
  ) {
    navigator.vibrate(pattern);
  }

}

/* =========================
   KEYBOARD
========================= */

export function initKeyboardDetection() {

  const body = document.body;

  let initialHeight =
    window.innerHeight;

  window.addEventListener(
    'resize',
    () => {

      const currentHeight =
        window.innerHeight;

      const diff =
        initialHeight - currentHeight;

      if (diff > 160) {
        body.classList.add(
          'keyboard-open'
        );
      } else {
        body.classList.remove(
          'keyboard-open'
        );
      }

    }
  );

}

/* =========================
   PWA
========================= */

export async function registerSW() {

  if (
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  try {

    await navigator
      .serviceWorker
      .register('./sw.js');

  } catch (error) {

    console.error(
      'SW registration error',
      error
    );

  }

}