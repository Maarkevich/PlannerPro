/* ============================================================
   Planner Pro — Экраны приложения  (v1.0.0)
   Dashboard, Tasks, Calendar, Notes, NoteEditor, Projects,
   Stats, Settings, Trash
   ============================================================ */

(function () {
  'use strict';

  const U = window.PlannerUtils;
  const I = window.PlannerIcons;
  const C = window.PlannerComponents;
  const S = window.PlannerServices;
  const Store = window.PlannerStore;
  const Toast = window.PlannerToast;
  const esc = U.escapeHTML;

  const Views = {};

  /* ==================== Общие хелперы ==================== */

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function fieldRow(labelText, inputHTML) {
    return `<div class="field"><label>esc(labelText)</label>{esc(labelText)}</label>esc(labelText)</label>{inputHTML}</div>`;
  }

  /* ==================== Task form (модалка) ==================== */

  function openTaskModal(taskId = null, defaults = {}) {
    const task = taskId ? Store.state.tasks.find((t) => t.id === taskId) : null;
    const projects = Store.state.projects;

    const content = `
      ${fieldRow('Название', `<input class="input" id="tf-title" placeholder="Что нужно сделать?" maxlength="200">`)}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${fieldRow('Дата', `<input class="input" type="date" id="tf-date">`)}
        ${fieldRow('Проект', `<select class="input" id="tf-project">
          <option value="">Без проекта</option>
          {projects.map((p) => `<option value="{p.id}">${esc(p.name)}</option>`).join('')}
        </select>`)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${fieldRow('Начало', `<input class="input" type="time" id="tf-start">`)}
        ${fieldRow('Конец', `<input class="input" type="time" id="tf-end">`)}
      </div>
      ${fieldRow('Приоритет', `<div class="segmented" id="tf-priority">
        <button data-v="low">Низкий</button><button data-v="medium">Средний</button><button data-v="high">Высокий</button>
      </div>`)}
      ${fieldRow('Повтор', `<select class="input" id="tf-repeat">
        <option value="none">Не повторять</option><option value="daily">Каждый день</option>
        <option value="weekdays">По будням</option><option value="weekly">Каждую неделю</option>
        <option value="monthly">Каждый месяц</option>
      </select>`)}
      ${fieldRow('Заметки', `<textarea class="input" id="tf-notes" placeholder="Детали…"></textarea>`)}
      {task ? `<button class="btn btn-danger btn-block" id="tf-delete">{I.get('trash', 18)} Удалить</button>` : ''}
    `;

    C.Modal.open({
      title: task ? 'Редактировать задачу' : 'Новая задача',
      content,
      onMount(sheet, close) {
        const $ = (id) => sheet.querySelector(id);
        if (task || defaults.dueDate) $('##tf-date'.slice(1)).value = task?.dueDate || defaults.dueDate || '';
        $('#tf-title').value = task?.title || '';
        $('#tf-notes').value = task?.notes || '';
        $('#tf-start').value = task?.startTime || '';
        $('#tf-end').value = task?.endTime || '';
        $('#tf-repeat').value = task?.repeat || 'none';
        if (task?.projectId) $('#tf-project').value = task.projectId;

        let priority = task?.priority || 'medium';
        const seg = $('#tf-priority');
        seg.querySelectorAll('button').forEach((b) => {
          if (b.dataset.v === priority) b.classList.add('active');
          b.addEventListener('click', () => {
            seg.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
            b.classList.add('active');
            priority = b.dataset.v;
          });
        });

        async function save() {
          const title = $('#tf-title').value.trim();
          if (!title) { Toast.error('Введите название задачи'); return; }
          const data = {
            title,
            notes: $('#tf-notes').value.trim(),
            dueDate: $('#tf-date').value || null,
            projectId: $('#tf-project').value || null,
            startTime: $('#tf-start').value,
            endTime: $('#tf-end').value,
            repeat: $('#tf-repeat').value,
            priority
          };
          if (task) await S.TaskService.update(task.id, data);
          else await S.TaskService.create(data);
          U.haptic(10);
          Toast.success(task ? 'Задача обновлена' : 'Задача создана');
          close();
        }

        sheet.querySelector('.modal-close')?.closest('.modal-sheet')
          .querySelectorAll('input').forEach((inp) =>
            inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && inp.type !== 'date' && inp.type !== 'time') save(); })
          );

        // Кнопка сохранения — добавим в конец body модалки
        const saveBtn = el(`<button class="btn btn-primary btn-block" style="margin-top:8px">Сохранить</button>`);
        saveBtn.addEventListener('click', save);
        sheet.querySelector('.modal-body').appendChild(saveBtn);

        const delBtn = sheet.querySelector('#tf-delete');
        delBtn?.addEventListener('click', async () => {
          await S.TaskService.softDelete(task.id);
          Toast.info('Задача перемещена в корзину');
          close();
        });
      }
    });
  }

  /* ==================== Dashboard ==================== */

  Views.dashboard = function (container) {
    const stats = S.StatsService.compute('today');
    const todayTasks = S.TaskService.byDate(U.todayISO());
    const upcoming = Store.state.tasks
      .filter((t) => t.status === 'active' && t.dueDate && t.dueDate > U.todayISO())
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 3);

    container.innerHTML = `
      <h1 class="greeting">${U.greeting()} 👋</h1>
      <p class="date-line">${U.formatFullDate(new Date())}</p>

      <section class="dashboard-hero">
        <div data-ring></div>
        <div>
          <div style="font-size:14px;opacity:.85">Сегодня выполнено</div>
          <div style="font-size:32px;font-weight:800;line-height:1.2">
            stats.byDay[U.todayISO()]∣∣0/{stats.byDay[U.todayISO()] || 0} /stats.byDay[U.todayISO()]∣∣0/{todayTasks.length + (stats.byDay[U.todayISO()] || 0)}
          </div>
          <div style="font-size:13px;opacity:.85;margin-top:4px">
            {stats.overdueCount ? `{stats.overdueCount} просрочено ⚠️` : 'Всё под контролем ✨'}
          </div>
        </div>
      </section>

      <div class="quick-actions">
        <button class="quick-action" data-qa="task">${I.get('plus', 22)}<span>Задача</span></button>
        <button class="quick-action" data-qa="note">${I.get('note', 22)}<span>Заметка</span></button>
        <button class="quick-action" data-qa="calendar">${I.get('calendar', 22)}<span>Календарь</span></button>
      </div>

      <h2 class="section-title">На сегодня</h2>
      <div data-today-list></div>

      <h2 class="section-title">Скоро</h2>
      <div data-upcoming-list></div>
    `;

    container.querySelector('[data-ring]').appendChild(C.progressRing(
      todayTasks.length + (stats.byDay[U.todayISO()] || 0)
        ? Math.round(((stats.byDay[U.todayISO()] || 0) / (todayTasks.length + (stats.byDay[U.todayISO()] || 0))) * 100)
        : 0
    ));

    const todayList = container.querySelector('[data-today-list]');
    if (!todayTasks.length) {
      todayList.appendChild(C.emptyState('check-square', 'На сегодня задач нет — отличный момент отдохнуть'));
    } else {
      todayTasks.forEach((t) => todayList.appendChild(C.taskItem(t, {
        projects: Store.state.projects,
        onToggle: (task) => S.TaskService.toggleComplete(task.id),
        onOpen: (task) => openTaskModal(task.id),
        onDelete: (task) => S.TaskService.softDelete(task.id)
      })));
    }

    const upList = container.querySelector('[data-upcoming-list]');
    if (!upcoming.length) {
      upList.appendChild(C.emptyState('calendar', 'Ближайших задач нет'));
    } else {
      upcoming.forEach((t) => upList.appendChild(C.taskItem(t, {
        projects: Store.state.projects,
        onToggle: (task) => S.TaskService.toggleComplete(task.id),
        onOpen: (task) => openTaskModal(task.id),
        onDelete: (task) => S.TaskService.softDelete(task.id)
      })));
    }

    container.querySelector('[data-qa="task"]').addEventListener('click', () => openTaskModal());
    container.querySelector('[data-qa="note"]').addEventListener('click', () => openNoteEditor());
    container.querySelector('[data-qa="calendar"]').addEventListener('click', () => Store.navigate('calendar'));

    U.attachPullToRefresh(container.parentElement, async () => {
      await Promise.all([S.TaskService.loadAll(), S.NoteService.loadAll()]);
      Toast.success('Обновлено');
    });
  };

  /* ==================== Tasks ==================== */

  Views.tasks = function (container) {
    container.innerHTML = `
      <h1 class="greeting">Задачи</h1>
      <div data-search style="margin-bottom:12px"></div>
      <div class="tabs" role="tablist">
        <button data-tab="inbox">Все</button>
        <button data-tab="today">Сегодня</button>
        <button data-tab="upcoming">Предстоящие</button>
        <button data-tab="someday">Когда-нибудь</button>
      </div>
      <div data-chips style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"></div>
      <div data-list></div>
    `;

    const searchWrap = container.querySelector('[data-search]');
    searchWrap.appendChild(C.searchBar({
      value: Store.state.taskFilter.search,
      placeholder: 'Поиск по задачам…',
      onInput: U.debounce((v) => { Store.state.taskFilter.search = v; renderList(); }, 250)
    }));

    const tabsEl = container.querySelector('.tabs');
    tabsEl.querySelectorAll('button').forEach((btn) => {
      if (btn.dataset.tab === Store.state.taskFilter.tab) btn.classList.add('active');
      btn.addEventListener('click', () => {
        tabsEl.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        Store.state.taskFilter.tab = btn.dataset.tab;
        renderList();
      });
    });

    function renderChips() {
      const chips = container.querySelector('[data-chips]');
      chips.innerHTML = '';
      const prio = I.PRIORITY;
      Object.entries(prio).forEach(([key, p]) => {
        const active = Store.state.taskFilter.priority === key;
        const chip = el(`<button class="chip active?′active′:′′"><spanclass="project−dot"style="background:{active ? 'active' : ''}"><span class="project-dot" style="background:active?′active′:′′"><spanclass="project−dot"style="background:{p.color}"></span>${p.label}</button>`);
        chip.addEventListener('click', () => {
          Store.state.taskFilter.priority = active ? null : key;
          renderChips(); renderList();
        });
        chips.appendChild(chip);
      });
      Store.state.projects.forEach((pr) => {
        const active = Store.state.taskFilter.projectId === pr.id;
        const chip = el(`<button class="chip active?′active′:′′"><spanclass="project−dot"style="background:{active ? 'active' : ''}"><span class="project-dot" style="background:active?′active′:′′"><spanclass="project−dot"style="background:{esc(pr.color)}"></span>${esc(pr.name)}</button>`);
        chip.addEventListener('click', () => {
          Store.state.taskFilter.projectId = active ? null : pr.id;
          renderChips(); renderList();
        });
        chips.appendChild(chip);
      });
    }

    function renderList() {
      const list = container.querySelector('[data-list]');
      list.innerHTML = '';
      const tasks = S.TaskService.filtered();
      if (!tasks.length) {
        list.appendChild(C.emptyState('check-square', 'Задач не найдено', '+ Новая задача', () => openTaskModal()));
        return;
      }
      tasks.forEach((t) => list.appendChild(C.taskItem(t, {
        projects: Store.state.projects,
        onToggle: (task) => S.TaskService.toggleComplete(task.id),
        onOpen: (task) => openTaskModal(task.id),
        onDelete: (task) => S.TaskService.softDelete(task.id)
      })));
    }

    renderChips();
    renderList();
  };

  /* ==================== Calendar ==================== */

  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();

  Views.calendar = function (container) {
    container.innerHTML = `<div data-cal></div><div data-day style="margin-top:20px"></div>`;
    renderCal();

    function renderCal() {
      const calWrap = container.querySelector('[data-cal]');
      calWrap.innerHTML = '';
      const tasksByDate = {};
      Store.state.tasks.filter((t) => t.status === 'active' && t.dueDate).forEach((t) => {
        (tasksByDate[t.dueDate] ||= []).push(t);
      });
      calWrap.appendChild(C.calendarGrid(calYear, calMonth, {
        selectedISO: Store.state.selectedDate,
        tasksByDate,
        onSelectDay: (iso) => { Store.state.selectedDate = iso; renderCal(); renderDay(); },
        onPrevMonth: () => { const d = U.addMonths(new Date(calYear, calMonth, 1), -1); calYear = d.getFullYear(); calMonth = d.getMonth(); renderCal(); },
        onNextMonth: () => { const d = U.addMonths(new Date(calYear, calMonth, 1), 1); calYear = d.getFullYear(); calMonth = d.getMonth(); renderCal(); }
      }));
    }

    function renderDay() {
      const dayWrap = container.querySelector('[data-day]');
      dayWrap.innerHTML = '';
      const iso = Store.state.selectedDate || U.todayISO();
      const date = U.fromISODate(iso);

      const header = el(`
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <h2 class="section-title" style="margin:0">${iso === U.todayISO() ? 'Сегодня' : U.formatFullDate(date)}</h2>
          <button class="btn btn-icon btn-ghost" aria-label="Добавить задачу на этот день">${I.get('plus', 20)}</button>
        </div>`);
      header.querySelector('button').addEventListener('click', () => openTaskModal(null, { dueDate: iso }));
      dayWrap.appendChild(header);

      const withTime = S.TaskService.byDate(iso).filter((t) => t.startTime);
      const withoutTime = S.TaskService.byDate(iso).filter((t) => !t.startTime);

      if (withTime.length) {
        dayWrap.appendChild(C.timeline(withTime, iso, { onOpenTask: (t) => openTaskModal(t.id) }));
      }
      const list = el('<div style="margin-top:16px"></div>');
      if (!withTime.length && !withoutTime.length) {
        list.appendChild(C.emptyState('calendar', 'На этот день задач нет', '+ Добавить', () => openTaskModal(null, { dueDate: iso })));
      } else {
        withoutTime.forEach((t) => list.appendChild(C.taskItem(t, {
          projects: Store.state.projects,
          onToggle: (task) => S.TaskService.toggleComplete(task.id),
          onOpen: (task) => openTaskModal(task.id),
          onDelete: (task) => S.TaskService.softDelete(task.id)
        })));
      }
      dayWrap.appendChild(list);
    }

    renderDay();
  };

  /* ==================== Notes ==================== */

  Views.notes = function (container) {
    container.innerHTML = `
      <h1 class="greeting">Заметки</h1>
      <div data-search style="margin-bottom:16px"></div>
      <div class="notes-grid" data-grid></div>
    `;

    container.querySelector('[data-search]').appendChild(C.searchBar({
      value: Store.state.notesView.search,
      placeholder: 'Поиск по заметкам…',
      onInput: U.debounce((v) => { Store.state.notesView.search = v; renderGrid(); }, 250)
    }));

    function renderGrid() {
      const grid = container.querySelector('[data-grid]');
      grid.innerHTML = '';
      const notes = S.NoteService.search(Store.state.notesView.search);
      if (!notes.length) {
        grid.appendChild(C.emptyState('note', 'Заметок пока нет', '+ Создать заметку', () => openNoteEditor()));
        return;
      }
      notes.forEach((n) => grid.appendChild(C.noteCard(n, {
        projects: Store.state.projects,
        onOpen: (note) => openNoteEditor(note.id),
        onTogglePin: (note) => S.NoteService.togglePin(note.id)
      })));
    }

    renderGrid();
  };

  /* ==================== Note Editor ==================== */

  function openNoteEditor(noteId = null) {
    const note = noteId ? Store.state.notes.find((n) => n.id === noteId) : null;
    const content = `
      <input class="input" id="ne-title" placeholder="Заголовок" style="font-weight:700;font-size:18px;border:none;background:transparent;padding-left:0">
      <div class="editor-toolbar" data-toolbar></div>
      <div class="editor-content" contenteditable="true" id="ne-content" data-placeholder="Начните писать…"></div>
    `;
    C.Modal.open({
      title: '',
      content,
      onClose() { saveNote(true); },
      onMount(sheet, close) {
        const titleInput = sheet.querySelector('#ne-title');
        const editor = sheet.querySelector('#ne-content');
        titleInput.value = note?.title || '';
        editor.innerHTML = note?.content || '';

        const tools = [
          ['bold', () => document.execCommand('bold')],
          ['italic', () => document.execCommand('italic')],
          ['strikethrough', () => document.execCommand('strikeThrough')],
          ['heading', () => document.execCommand('formatBlock', false, 'H2')],
          ['quote', () => document.execCommand('formatBlock', false, 'BLOCKQUOTE')],
          ['listUl', () => document.execCommand('insertUnorderedList')],
          ['listOl', () => document.execCommand('insertOrderedList')],
          ['code', () => document.execCommand('formatBlock', false, 'PRE')],
          ['minus', () => document.execCommand('insertHorizontalRule')]
        ];
        const toolbar = sheet.querySelector('[data-toolbar]');
        tools.forEach(([icon, cmd]) => {
          const btn = el(`<button type="button" aria-label="icon">{icon}">icon">{I.get(icon, 18)}</button>`);
          btn.addEventListener('mousedown', (e) => e.preventDefault()); // не терять фокус
          btn.addEventListener('click', cmd);
          toolbar.appendChild(btn);
        });

        let saved = false;
        async function saveNote(silent = false) {
          if (saved) return;
          saved = true;
          const title = titleInput.value.trim();
          const body = editor.innerHTML.trim();
          if (!title && !body.replace(/<br\s*\/?>/i, '')) return; // пустую не сохраняем
          if (note) await S.NoteService.update(note.id, { title, content: body });
          else await S.NoteService.create({ title, content: body });
          if (!silent) Toast.success('Заметка сохранена');
        }
        sheet._saveNote = saveNote;
        sheet.querySelector('.modal-close').addEventListener('click', () => saveNote(true));
      }
    });
  }

  /* ==================== Projects ==================== */

  Views.projects = function (container) {
    container.innerHTML = `
      <h1 class="greeting">Проекты</h1>
      <div data-list></div>
    `;
    render();

    function render() {
      const list = container.querySelector('[data-list]');
      list.innerHTML = '';
      if (!Store.state.projects.length) {
        list.appendChild(C.emptyState('folder', 'Проектов нет', '+ Новый проект', createProject));
        return;
      }
      Store.state.projects.forEach((p) => {
        const tasks = Store.state.tasks.filter((t) => t.projectId === p.id && t.status === 'active');
        const done = Store.state.tasks.filter((t) => t.projectId === p.id && t.status === 'completed');
        const total = tasks.length + done.length;
        const pct = total ? Math.round((done.length / total) * 100) : 0;
        const item = el(`
          <div class="project-item">
            <span class="project-dot" style="width:12px;height:12px;background:${esc(p.color)}"></span>
            <div style="flex:1;min-width:0">
              <strong style="font-size:15px">${esc(p.name)}</strong>
              <div class="project-progress" style="margin-top:6px"><div class="project-progress-bar" style="width:${pct}%"></div></div>
              <small style="color:var(--text-tertiary);font-size:11px">done.length/{done.length}/done.length/{total} · ${pct}%</small>
            </div>
            <button class="btn btn-icon btn-ghost" aria-label="Фильтр по проекту">${I.get('chevronRight', 18)}</button>
          </div>`);
        item.addEventListener('click', () => {
          Store.navigate('tasks');
          Store.state.taskFilter.projectId = p.id;
        });
        list.appendChild(item);
      });
      const addBtn = el('<button class="btn btn-ghost btn-block" style="margin-top:12px">+ Новый проект</button>');
      addBtn.addEventListener('click', createProject);
      list.appendChild(addBtn);
    }

    function createProject() {
      C.Modal.open({
        title: 'Новый проект',
        content: `${fieldRow('Название', '<input class="input" id="pf-name" placeholder="Например: Работа">')}
          ${fieldRow('Цвет', '<div style="display:flex;gap:8px;flex-wrap:wrap" data-colors></div>')}`,
        onMount(sheet, close) {
          let color = S.PROJECT_COLORS[0];
          const colorsWrap = sheet.querySelector('[data-colors]');
          S.PROJECT_COLORS.forEach((c, i) => {
            const sw = el(`<button style="width:36px;height:36px;border-radius:50%;background:c;outline:3pxsolidtransparent;outline−offset:2px"aria−label="{c};outline:3px solid transparent;outline-offset:2px" aria-label="c;outline:3pxsolidtransparent;outline−offset:2px"aria−label="{c}"></button>`);
            if (i === 0) sw.style.outlineColor = c;
            sw.addEventListener('click', () => {
              color = c;
              colorsWrap.querySelectorAll('button').forEach((b) => (b.style.outlineColor = 'transparent'));
              sw.style.outlineColor = c;
            });
            colorsWrap.appendChild(sw);
          });
          const input = sheet.querySelector('#pf-name');
          input.focus();
          async function save() {
            const name = input.value.trim();
            if (!name) return;
            await S.ProjectService.create({ name, color });
            Toast.success('Проект создан');
            close(); render();
          }
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
          const btn = el('<button class="btn btn-primary btn-block" style="margin-top:8px">Создать</button>');
          btn.addEventListener('click', save);
          sheet.querySelector('.modal-body').appendChild(btn);
        }
      });
    }
  };

  /* ==================== Stats ==================== */

  Views.stats = function (container) {
    container.innerHTML = `
      <h1 class="greeting">Статистика</h1>
      <div class="tabs" data-period>
        <button data-p="today">День</button><button data-p="week">Неделя</button>
        <button data-p="month">Месяц</button><button data-p="all">Всё время</button>
      </div>
      <div data-body></div>
    `;
    const periodTabs = container.querySelector('[data-period]');
    periodTabs.querySelectorAll('button').forEach((b) => {
      if (b.dataset.p === Store.state.statsPeriod) b.classList.add('active');
      b.addEventListener('click', () => {
        periodTabs.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        Store.state.statsPeriod = b.dataset.p;
        renderBody();
      });
    });

    function renderBody() {
      const s = S.StatsService.compute(Store.state.statsPeriod);
      const body = container.querySelector('[data-body]');
      body.innerHTML = `
        <div class="stats-cards">
          <div class="card stat-card"><span class="stat-value">${s.completedCount}</span><span class="stat-label">выполнено</span></div>
          <div class="card stat-card"><span class="stat-value">${s.createdCount}</span><span class="stat-label">создано</span></div>
          <div class="card stat-card"><span class="stat-value">${s.activeCount}</span><span class="stat-label">активных</span></div>
          <div class="card stat-card"><span class="stat-value">${s.rate}%</span><span class="stat-label">успешность</span></div>
        </div>
        <h2 class="section-title">Активность</h2>
        <div class="card"><div class="heatmap" data-heatmap></div></div>
        <h2 class="section-title">По приоритетам</h2>
        <div class="card"><div class="legend">
          ${Object.entries(I.PRIORITY).map(([k, p]) =>
            `<div class="legend-item"><span class="legend-dot" style="background:p.color"></span>{p.color}"></span>p.color"></span>{p.label}: <strong>${s.byPriority[k]}</strong></div>`
          ).join('')}
        </div></div>
        <h2 class="section-title">Заметки</h2>
        <div class="card stat-card"><span class="stat-value">${s.notesCount}</span><span class="stat-label">всего заметок</span></div>
      `;
      // Heatmap: последние 182 дня
      const hm = body.querySelector('[data-heatmap]');
      for (let i = 181; i >= 0; i--) {
        const iso = U.toISODate(U.addDays(new Date(), -i));
        const count = s.heatmap[iso] || 0;
        const cell = el(`<div class="heatmap-cell lvlcount===0?0:count<2?1:count<4?2:count<7?3:4"title="{count === 0 ? 0 : count < 2 ? 1 : count < 4 ? 2 : count < 7 ? 3 : 4}" title="count===0?0:count<2?1:count<4?2:count<7?3:4"title="{iso}: ${count}"></div>`);
        hm.appendChild(cell);
      }
    }

    renderBody();
  };

  /* ==================== Settings ==================== */

  Views.settings = function (container) {
    const st = Store.state.settings;
    container.innerHTML = `
      <h1 class="greeting">Настройки</h1>

      <div class="settings-group">
        <h2>Оформление</h2>
        <div class="theme-swatches" data-themes></div>
        <div class="theme-mode-toggle" style="margin-top:8px">
          <span style="display:inline-flex;align-items:center;gap:8px">${I.get(st.mode === 'dark' ? 'moon' : 'sun', 18)} Тёмная тема</span>
          <label class="switch"><input type="checkbox" data-mode ${st.mode === 'dark' ? 'checked' : ''}><span class="switch-track"></span><span class="switch-thumb"></span></label>
        </div>
      </div>

      <div class="settings-group">
        <h2>Данные</h2>
        <button class="settings-item" data-act="export">I.get(′download′,20)Экспортданных{I.get('download', 20)} Экспорт данныхI.get(′download′,20)Экспортданных{I.get('chevronRight', 16, 1.5).replace('<svg', '<svg class="chevron"')}</button>
        <button class="settings-item" data-act="import">I.get(′upload′,20)Импортизфайла{I.get('upload', 20)} Импорт из файлаI.get(′upload′,20)Импортизфайла{I.get('chevronRight', 16, 1.5).replace('<svg', '<svg class="chevron"')}</button>
        <button class="settings-item" data-act="trash">I.get(′trash′,20)Корзина{I.get('trash', 20)} КорзинаI.get(′trash′,20)Корзина{I.get('chevronRight', 16, 1.5).replace('<svg', '<svg class="chevron"')}</button>
        <button class="settings-item" data-act="wipe" style="color:#ef4444">${I.get('alertCircle', 20)} Удалить все данные</button>
      </div>

      <div class="settings-group">
        <h2>Установка</h2>
        <button class="settings-item" data-act="install" ${Store.state.installPromptEvent ? '' : 'disabled style="opacity:.5"'}>
          ${I.get('smartphone', 20)} Установить приложение
        </button>
      </div>

      <p style="text-align:center;color:var(--text-tertiary);font-size:12px;padding:24px 0">
        Planner Pro v${window.APP_VERSION}<br>Данные хранятся локально на устройстве
      </p>
      <input type="file" accept=".json,application/json" hidden data-file>
    `;

    // Темы
    const themesWrap = container.querySelector('[data-themes]');
    const themeMeta = [
      ['ocean', 'linear-gradient(135deg,#667eea,#764ba2)', 'Океан'],
      ['sunset', 'linear-gradient(135deg,#fa709a,#fee140)', 'Закат'],
      ['forest', 'linear-gradient(135deg,#11998e,#38ef7d)', 'Лес'],
      ['neon', 'linear-gradient(135deg,#b721ff,#21d4fd)', 'Неон']
    ];
    themeMeta.forEach(([key, grad, label]) => {
      const sw = el(`<button class="theme-swatch ${st.theme === key ? 'active' : ''}">
        <span class="theme-swatch-preview" style="background:grad"></span><span>{grad}"></span><span>grad"></span><span>{label}</span></button>`);
      sw.addEventListener('click', () => {
        Store.updateSettings({ theme: key });
        U.applyTheme(key, Store.state.settings.mode);
        themesWrap.querySelectorAll('.theme-swatch').forEach((x) => x.classList.remove('active'));
        sw.classList.add('active');
      });
      themesWrap.appendChild(sw);
    });

    container.querySelector('[data-mode]').addEventListener('change', (e) => {
      const mode = e.target.checked ? 'dark' : 'light';
      Store.updateSettings({ mode });
      U.applyTheme(Store.state.settings.theme, mode);
    });

    container.querySelector('[data-act="export"]').addEventListener('click', () => S.BackupService.export());

    container.querySelector('[data-act="import"]').addEventListener('click', () => {
      const fileInput = container.querySelector('[data-file]');
      fileInput.onchange = () => {
        if (fileInput.files[0]) S.BackupService.import(fileInput.files[0]);
        fileInput.value = '';
      };
      fileInput.click();
    });

    container.querySelector('[data-act="trash"]').addEventListener('click', () => Store.navigate('trash'));

    container.querySelector('[data-act="wipe"]').addEventListener('click', () => {
      C.Modal.open({
        title: 'Удалить все данные?',
        content: '<p style="color:var(--text-secondary)">Это действие необратимо. Все задачи, заметки и проекты будут удалены.</p>',
        onMount(sheet, close) {
          const btn = el('<button class="btn btn-danger btn-block" style="margin-top:16px">Да, удалить всё</button>');
          btn.addEventListener('click', async () => { await S.BackupService.wipe(); close(); });
          sheet.querySelector('.modal-body').appendChild(btn);
        }
      });
    });

    container.querySelector('[data-act="install"]').addEventListener('click', async () => {
      const ev = Store.state.installPromptEvent;
      if (!ev) return;
      ev.prompt();
      await ev.userChoice;
      Store.state.installPromptEvent = null;
    });
  };

  /* ==================== Trash ==================== */

  Views.trash = function (container) {
    container.innerHTML = `<h1 class="greeting">Корзина</h1><div data-list></div>`;
    render();

    function render() {
      const list = container.querySelector('[data-list]');
      list.innerHTML = '';
      const deleted = [
        ...Store.state.tasks.filter((t) => t.status === 'deleted'),
        ...Store.state.notes.filter((n) => n.status === 'deleted')
      ].sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

      if (!deleted.length) {
        list.appendChild(C.emptyState('trash', 'Корзина пуста'));
        return;
      }

      deleted.forEach((item) => {
        const isTask = !!item.title && 'priority' in item;
        const daysLeft = 30 - Math.floor((Date.now() - (item.deletedAt || 0)) / 86400000);
        const row = el(`
          <div class="project-item">
            <div style="flex:1;min-width:0">
              <strong style="font-size:14px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                isTask?I.get(′check−square′,14):I.get(′note′,14){isTask ? I.get('check-square', 14) : I.get('note', 14)}isTask?I.get(′check−square′,14):I.get(′note′,14){esc(item.title || 'Без названия')}
              </strong>
              <small class="trash-expire">удалится через daysLeft{daysLeft}daysLeft{U.plural(daysLeft, ['день', 'дня', 'дней'])}</small>
            </div>
            <button class="btn btn-icon btn-ghost" aria-label="Восстановить">${I.get('restore', 18)}</button>
          </div>`);
        row.querySelector('button').addEventListener('click', async () => {
          if (isTask) await S.TaskService.restore(item.id);
          else await S.NoteService.restore(item.id);
          Toast.success('Восстановлено');
          render();
        });
        list.appendChild(row);
      });
    }
  };

  /* ==================== Public API ==================== */

  window.PlannerViews = { Views, openTaskModal, openNoteEditor };
})();
