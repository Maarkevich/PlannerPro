/* ============================================================
   Planner Pro — Переиспользуемые компоненты  (v1.0.0)
   Modal/BottomSheet, Toast, TaskItem, NoteCard, CalendarGrid,
   Timeline, EmptyState, SearchBar, ProgressRing, FAB-меню
   ============================================================ */

(function () {
  'use strict';

  const U = window.PlannerUtils;
  const I = window.PlannerIcons;
  const esc = U.escapeHTML;

  /* ==================== Modal / BottomSheet ==================== */

  const Modal = {
    open({ title = '', content = '', onClose = null, onMount = null }) {
      const root = document.getElementById('modal-root');
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="modal-grabber"></div>
          <div class="modal-header">
            <h2 class="modal-title">${esc(title)}</h2>
            <button class="modal-close" aria-label="Закрыть">${I.get('x', 20)}</button>
          </div>
          <div class="modal-body">${content}</div>
        </div>`;
      root.appendChild(backdrop);

      let closed = false;
      function close() {
        if (closed) return;
        closed = true;
        backdrop.classList.remove('visible');
        setTimeout(() => backdrop.remove(), 350);
        document.removeEventListener('keydown', onKey);
        onClose?.();
      }
      function onKey(e) {
        if (e.key === 'Escape') close();
        // Focus trap
        if (e.key === 'Tab') {
          const focusables = backdrop.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
          if (!focusables.length) return;
          const first = focusables[0], last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
          else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
        }
      }

      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
      backdrop.querySelector('.modal-close').addEventListener('click', close);
      document.addEventListener('keydown', onKey);

      requestAnimationFrame(() => requestAnimationFrame(() => {
        backdrop.classList.add('visible');
        const firstInput = backdrop.querySelector('input, textarea, select');
        firstInput?.focus();
      }));

      onMount?.(backdrop.querySelector('.modal-sheet'), close);
      return { el: backdrop, close };
    }
  };

  /* ==================== Toast ==================== */

  const Toast = (() => {
    function ensureRoot() {
      let root = document.getElementById('toast-root');
      if (!root || !root.classList.contains('toast-root')) {
        if (!root) { root = document.createElement('div'); root.id = 'toast-root'; document.body.appendChild(root); }
        root.classList.add('toast-root');
      }
      return root;
    }

    function show({ message, type = 'info', actionLabel = '', onAction = null, duration = 3000 }) {
      const root = ensureRoot();
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.setAttribute('role', 'status');
      const iconName = type === 'success' ? 'check' : type === 'error' ? 'alertCircle' : 'info';
      toast.innerHTML = `I.get(iconName,20)<span>{I.get(iconName, 20)}<span>I.get(iconName,20)<span>{esc(message)}</span>`;
      if (actionLabel) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.textContent = actionLabel;
        btn.addEventListener('click', () => { dismiss(); onAction?.(); });
        toast.appendChild(btn);
      }
      root.appendChild(toast);
      let timer = setTimeout(dismiss, duration);
      function dismiss() {
        clearTimeout(timer);
        toast.classList.add('leaving');
        setTimeout(() => toast.remove(), 260);
      }
      return dismiss;
    }

    return {
      show,
      success: (m, d) => show({ message: m, type: 'success', duration: d }),
      error: (m, d) => show({ message: m, type: 'error', duration: d }),
      info: (m, d) => show({ message: m, type: 'info', duration: d }),
      update: ({ message, actionLabel, onAction }) =>
        show({ message, type: 'info', actionLabel, onAction, duration: 0 })
    };
  })();
  window.PlannerToast = Toast;

  /* ==================== EmptyState ==================== */

  function emptyState(icon, text, actionLabel = '', onAction = null) {
    const wrap = document.createElement('div');
    wrap.className = 'empty-state';
    wrap.innerHTML = `I.get(icon,48)<p>{I.get(icon, 48)}<p>I.get(icon,48)<p>{esc(text)}</p>`;
    if (actionLabel) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = actionLabel;
      btn.addEventListener('click', onAction);
      wrap.appendChild(btn);
    }
    return wrap;
  }

  /* ==================== PriorityBadge / ProjectDot ==================== */

  function priorityDot(priority) {
    const p = I.PRIORITY[priority] || I.PRIORITY.low;
    return `<span class="project-dot" style="background:p.color"title="{p.color}" title="p.color"title="{p.label}"></span>`;
  }

  function projectDot(projectId, projects) {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return '';
    return `<span class="project-dot" style="background:esc(project.color)"title="{esc(project.color)}" title="esc(project.color)"title="{esc(project.name)}"></span><span>${esc(project.name)}</span>`;
  }

  /* ==================== TaskItem ==================== */

  function taskItem(task, { projects = [], onToggle, onOpen, onDelete } = {}) {
    const el = document.createElement('article');
    el.className = `task-item priority-task.priority{task.priority}task.priority{task.status === 'completed' ? ' completed' : ''}`;
    el.dataset.id = task.id;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');

    const metaParts = [];
    if (task.dueDate) {
      metaParts.push(`<span style="display:inline-flex;align-items:center;gap:4px">I.get(′calendar′,12){I.get('calendar', 12)}I.get(′calendar′,12){U.formatShortDate(U.fromISODate(task.dueDate))}</span>`);
    }
    if (task.startTime) {
      metaParts.push(`<span style="display:inline-flex;align-items:center;gap:4px">I.get(′clock′,12){I.get('clock', 12)}I.get(′clock′,12){esc(task.startTime)}${task.endTime ? '–' + esc(task.endTime) : ''}</span>`);
    }
    if (task.projectId) metaParts.push(projectDot(task.projectId, projects));
    if (task.repeat && task.repeat !== 'none') {
      metaParts.push(`<span style="display:inline-flex;align-items:center;gap:4px">${I.get('repeat', 12)}</span>`);
    }
    if (task.subtasks?.length) {
      const done = task.subtasks.filter((s) => s.completed).length;
      metaParts.push(`<span>done/{done}/done/{task.subtasks.length}</span>`);
    }
    (task.tags || []).forEach((t) => {
      metaParts.push(`<span class="chip" style="padding:2px 8px;font-size:11px">#${esc(t)}</span>`);
    });

    el.innerHTML = `
      <button class="task-check" aria-label="${task.status === 'completed' ? 'Вернуть в работу' : 'Выполнить'}">
        ${I.get('check', 14)}
      </button>
      <div class="task-body">
        <div class="task-title">${esc(task.title)}</div>
        {metaParts.length ? `<div class="task-meta">{metaParts.join('')}</div>` : ''}
      </div>`;

    el.querySelector('.task-check').addEventListener('click', (e) => {
      e.stopPropagation();
      onToggle?.(task);
    });
    el.addEventListener('click', () => onOpen?.(task));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(task); }
    });

    U.attachSwipe(el, {
      onComplete: () => onToggle?.(task),
      onDelete: () => onDelete?.(task)
    });

    return el;
  }

  /* ==================== NoteCard ==================== */

  function noteCard(note, { projects = [], onOpen, onTogglePin } = {}) {
    const el = document.createElement('article');
    el.className = 'card note-card pressable';
    el.dataset.id = note.id;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');

    const tmp = document.createElement('div');
    tmp.innerHTML = note.content || '';
    const preview = (tmp.textContent || '').trim().slice(0, 140);

    const project = projects.find((p) => p.id === note.projectId);

    el.innerHTML = `
      <button class="note-pin-btn note.isPinned?′pinned′:′′"aria−label="{note.isPinned ? 'pinned' : ''}" aria-label="note.isPinned?′pinned′:′′"aria−label="{note.isPinned ? 'Открепить' : 'Закрепить'}">${I.get('pin', 16)}</button>
      <h3>${esc(note.title || 'Без названия')}</h3>
      {preview ? `<div class="note-preview">{esc(preview)}</div>` : ''}
      <div class="note-footer">
        {project ? `<span class="project-dot" style="background:{esc(project.color)}"></span><span>${esc(project.name)}</span>` : ''}
        <span style="margin-left:auto">${U.formatShortDate(new Date(note.updatedAt))}</span>
      </div>`;

    el.addEventListener('click', () => onOpen?.(note));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(note); }
    });
    el.querySelector('.note-pin-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      onTogglePin?.(note);
    });
    return el;
  }

  /* ==================== CalendarGrid ==================== */

  function calendarGrid(year, month, { selectedISO = null, tasksByDate = {}, onSelectDay, onPrevMonth, onNextMonth } = {}) {
    const wrap = document.createElement('section');
    wrap.className = 'calendar-view';

    const label = `U.MONTHSNOM[month]{U.MONTHS_NOM[month]}U.MONTHSN​OM[month]{year}`;

    wrap.innerHTML = `
      <div class="calendar-header">
        <button class="btn btn-icon btn-ghost" data-nav="prev" aria-label="Предыдущий месяц">${I.get('chevronLeft', 20)}</button>
        <h2 class="calendar-month-label">${label}</h2>
        <button class="btn btn-icon btn-ghost" data-nav="next" aria-label="Следующий месяц">${I.get('chevronRight', 20)}</button>
      </div>
      <div class="calendar-weekdays">{U.WEEKDAYS_SHORT.map((d) => `<span>{d}</span>`).join('')}</div>
      <div class="calendar-grid"></div>`;

    const grid = wrap.querySelector('.calendar-grid');
    U.monthMatrix(year, month).forEach((cell) => {
      const btn = document.createElement('button');
      btn.className = 'cal-day';
      if (!cell.inMonth) btn.classList.add('other-month');
      if (cell.isToday) btn.classList.add('today');
      if (selectedISO === cell.iso) btn.classList.add('selected');
      if ((tasksByDate[cell.iso] || []).length) btn.classList.add('has-tasks');
      btn.textContent = cell.date.getDate();
      btn.setAttribute('aria-label', `cell.date.getDate(){cell.date.getDate()}cell.date.getDate(){U.MONTHS_GEN[cell.date.getMonth()]}`);
      btn.addEventListener('click', () => onSelectDay?.(cell.iso));
      grid.appendChild(btn);
    });

    wrap.querySelector('[data-nav="prev"]').addEventListener('click', onPrevMonth);
    wrap.querySelector('[data-nav="next"]').addEventListener('click', onNextMonth);
    return wrap;
  }

  /* ==================== Timeline (день) ==================== */

  function timeline(tasksWithTime, dateISO, { onOpenTask } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'timeline';

    for (let h = 0; h < 24; h++) {
      const row = document.createElement('div');
      row.className = 'timeline-hour-row';
      row.innerHTML = `<div class="timeline-hour-label">${String(h).padStart(2, '0')}:00</div><div class="timeline-hours"></div>`;
      wrap.appendChild(row);
    }

    tasksWithTime.forEach((task) => {
      if (!task.startTime) return;
      const [sh] = task.startTime.split(':').map(Number);
      const [eh] = (task.endTime || task.startTime).split(':').map(Number);
      const top = sh * 56 + ((parseInt(task.startTime.split(':')[1], 10) || 0) / 60) * 56;
      const height = Math.max(((eh - sh) || 0.5) * 56 - 4, 28);
      const hoursCol = wrap.children[sh]?.querySelector('.timeline-hours');
      if (!hoursCol) return;
      const ev = document.createElement('button');
      ev.className = 'timeline-event';
      ev.style.top = `${top % 56}px`;
      ev.style.height = `${height}px`;
      ev.innerHTML = `<strong>esc(task.title)</strong><small>{esc(task.title)}</strong><small>esc(task.title)</strong><small>{esc(task.startTime)}${task.endTime ? '–' + esc(task.endTime) : ''}</small>`;
      ev.addEventListener('click', () => onOpenTask?.(task));
      hoursCol.appendChild(ev);
    });

    return wrap;
  }

  /* ==================== SearchBar ==================== */

  function searchBar({ placeholder = 'Поиск…', value = '', onInput, onClear }) {
    const wrap = document.createElement('div');
    wrap.className = 'search-bar';
    wrap.innerHTML = `
      ${I.get('search', 20)}
      <input type="search" placeholder="esc(placeholder)"value="{esc(placeholder)}" value="esc(placeholder)"value="{esc(value)}" aria-label="Поиск">
      <button class="btn-icon" style="width:32px;height:32px;display:none;color:var(--text-tertiary)" aria-label="Очистить">${I.get('x', 18)}</button>`;
    const input = wrap.querySelector('input');
    const clearBtn = wrap.querySelector('button');
    input.addEventListener('input', () => {
      clearBtn.style.display = input.value ? 'flex' : 'none';
      onInput?.(input.value.trim());
    });
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      input.focus();
      onClear?.();
    });
    return wrap;
  }

  /* ==================== ProgressRing ==================== */

  function progressRing(percent = 0) {
    const r = 36, c = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(100, percent));
    const wrap = document.createElement('div');
    wrap.className = 'progress-ring';
    wrap.innerHTML = `
      <svg width="88" height="88" viewBox="0 0 88 88">
        <defs><linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#667eea"/><stop offset="100%" stop-color="#764ba2"/>
        </linearGradient></defs>
        <circle class="track" cx="44" cy="44" r="${r}" fill="none" stroke-width="8"/>
        <circle class="bar" cx="44" cy="44" r="${r}" fill="none" stroke-width="8"
          stroke-dasharray="c"stroke−dashoffset="{c}" stroke-dashoffset="c"stroke−dashoffset="{c}"/>
      </svg>
      <div class="progress-ring-label">0%</div>`;
    requestAnimationFrame(() => setTimeout(() => {
      wrap.querySelector('.bar').style.strokeDashoffset = String(c * (1 - clamped / 100));
      U.animateNumber(wrap.querySelector('.progress-ring-label'), Math.round(clamped));
      wrap.querySelector('.progress-ring-label').textContent = Math.round(clamped) + '%';
    }, 100));
    return wrap;
  }

  /* ==================== Segmented control ==================== */

  function segmented(options, activeValue, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'segmented';
    options.forEach(({ value, label }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      if (value === activeValue) btn.classList.add('active');
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        onChange?.(value);
      });
      wrap.appendChild(btn);
    });
    return wrap;
  }

  /* ==================== Bulk bar ==================== */

  function bulkBar(count, actions) {
    const bar = document.createElement('div');
    bar.className = 'bulk-bar';
    bar.innerHTML = `<strong style="font-size:14px;padding:0 6px">${count}</strong>`;
    actions.forEach(({ icon, label, onClick, danger }) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-icon btn-ghost';
      btn.title = label;
      btn.setAttribute('aria-label', label);
      btn.innerHTML = I.get(icon, 20);
      if (danger) btn.style.color = '#ef4444';
      btn.addEventListener('click', onClick);
      bar.appendChild(btn);
    });
    return bar;
  }

  /* ==================== Public API ==================== */

  window.PlannerComponents = {
    Modal, Toast,
    emptyState, priorityDot, projectDot,
    taskItem, noteCard, calendarGrid, timeline,
    searchBar, progressRing, segmented, bulkBar
  };
})();
