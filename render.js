import {
  state,
  getTodayTasks,
  getPendingTasks,
  getCompletedTasks
} from './state.js';

import {
  formatDate,
  isToday
} from './utils.js';

/* =========================
   ROOTS
========================= */

const views =
  document.querySelectorAll(
    '.view'
  );

const navButtons =
  document.querySelectorAll(
    '.bottom-nav-btn'
  );

/* =========================
   VIEW
========================= */

export function renderView(
  viewName
) {

  state.currentView =
    viewName;

  views.forEach((view) => {

    view.classList.toggle(
      'active',
      view.id === `view-${viewName}`
    );

  });

  navButtons.forEach((button) => {

    button.classList.toggle(
      'active',
      button.dataset.view === viewName
    );

  });

}

/* =========================
   DASHBOARD
========================= */

export function renderDashboard() {

  renderUpcomingTasks();
  renderProjectsPreview();
  renderPinnedNotes();
  renderDayProgress();

}

/* =========================
   PROGRESS
========================= */

export function renderDayProgress() {

  const total =
    state.tasks.length;

  const completed =
    getCompletedTasks().length;

  const percent =
    total
      ? Math.round(
          completed / total * 100
        )
      : 0;

  const value =
    document.getElementById(
      'day-progress-value'
    );

  const fill =
    document.getElementById(
      'day-progress-fill'
    );

  const count =
    document.getElementById(
      'today-count'
    );

  if (value) {
    value.textContent =
      `${percent}%`;
  }

  if (fill) {
    fill.style.width =
      `${percent}%`;
  }

  if (count) {
    count.textContent =
      `${total} задач`;
  }

}

/* =========================
   UPCOMING TASKS
========================= */

export function renderUpcomingTasks() {

  const root =
    document.getElementById(
      'dashboard-upcoming-tasks'
    );

  const empty =
    document.getElementById(
      'dashboard-empty'
    );

  if (!root) {
    return;
  }

  const tasks =
    getPendingTasks()
      .slice(0, 5);

  root.innerHTML = '';

  if (!tasks.length) {

    empty?.classList.remove(
      'hidden'
    );

    return;

  }

  empty?.classList.add(
    'hidden'
  );

  tasks.forEach((task) => {
    root.appendChild(
      createTaskCard(task)
    );
  });

}

/* =========================
   TASK CARD
========================= */

export function createTaskCard(
  task
) {

  const card =
    document.createElement('article');

  card.className =
    `
      task-card
      priority-${task.priority}
      ${task.completed ? 'completed' : ''}
    `;

  card.dataset.id =
    task.id;

  card.innerHTML = `
    <div class="task-top">

      <div class="task-left">

        <button
          class="
            task-checkbox
            ${task.completed ? 'checked' : ''}
          "
          data-action="toggle-task"
          data-id="${task.id}"
        >
          ${task.completed ? '✓' : ''}
        </button>

        <div class="task-content">

          <div class="task-title">
            ${escapeHtml(task.title)}
          </div>

          ${
            task.description
              ? `
                <div class="task-description">
                  ${escapeHtml(task.description)}
                </div>
              `
              : ''
          }

          <div class="task-meta">

            ${
              task.dueDate
                ? `
                  <div class="task-chip">
                    📅 ${formatDate(
                      task.dueDate,
                      {
                        day: 'numeric',
                        month: 'short'
                      }
                    )}
                  </div>
                `
                : ''
            }

            <div
              class="
                task-chip
                task-priority-${task.priority}
              "
            >
              ${
                getPriorityLabel(
                  task.priority
                )
              }
            </div>

          </div>

        </div>

      </div>

      <div class="task-actions">

        <button
          class="task-action-btn"
          data-action="edit-task"
          data-id="${task.id}"
        >
          ✏️
        </button>

        <button
          class="task-action-btn"
          data-action="delete-task"
          data-id="${task.id}"
        >
          🗑️
        </button>

      </div>

    </div>
  `;

  return card;

}

/* =========================
   TASKS VIEW
========================= */

export function renderTasks() {

  const root =
    document.getElementById(
      'tasks-list'
    );

  const empty =
    document.getElementById(
      'tasks-empty'
    );

  if (!root) {
    return;
  }

  root.innerHTML = '';

  const tasks =
    filterTasksByTab();

  if (!tasks.length) {

    empty?.classList.remove(
      'hidden'
    );

    return;

  }

  empty?.classList.add(
    'hidden'
  );

  tasks.forEach((task) => {
    root.appendChild(
      createTaskCard(task)
    );
  });

}

/* =========================
   FILTER TASKS
========================= */

function filterTasksByTab() {

  switch (
    state.currentTaskTab
  ) {

    case 'today':
      return getTodayTasks();

    case 'completed':
      return getCompletedTasks();

    case 'upcoming':
      return getPendingTasks()
        .filter(
          (task) =>
            task.dueDate
            &&
            !isToday(task.dueDate)
        );

    case 'all':
    default:
      return state.tasks;

  }

}

/* =========================
   PROJECTS
========================= */

export function renderProjects() {

  const root =
    document.getElementById(
      'projects-list'
    );

  if (!root) {
    return;
  }

  root.innerHTML = '';

  if (!state.projects.length) {

    root.innerHTML = `
      <div class="empty-state">
        Нет проектов
      </div>
    `;

    return;

  }

  state.projects.forEach(
    (project) => {

      root.appendChild(
        createProjectCard(
          project
        )
      );

    }
  );

}

export function renderProjectsPreview() {

  const root =
    document.getElementById(
      'dashboard-projects'
    );

  if (!root) {
    return;
  }

  root.innerHTML = '';

  state.projects
    .slice(0, 6)
    .forEach((project) => {

      root.appendChild(
        createProjectCard(
          project
        )
      );

    });

}

function createProjectCard(
  project
) {

  const card =
    document.createElement('article');

  const tasks =
    state.tasks.filter(
      (task) =>
        task.projectId
        ===
        project.id
    );

  const completed =
    tasks.filter(
      (task) => task.completed
    ).length;

  const progress =
    tasks.length
      ? Math.round(
          completed
          /
          tasks.length
          * 100
        )
      : 0;

  card.className =
    'project-card';

  card.dataset.id =
    project.id;

  card.innerHTML = `
    <div class="project-title">
      ${escapeHtml(
        project.title
      )}
    </div>

    ${
      project.description
        ? `
          <div class="project-description">
            ${escapeHtml(
              project.description
            )}
          </div>
        `
        : ''
    }

    <div
      class="project-progress-wrap"
    >

      <div
        class="project-progress-top"
      >

        <div
          class="project-progress-label"
        >
          Прогресс
        </div>

        <div
          class="project-progress-value"
        >
          ${progress}%
        </div>

      </div>

      <div class="progress-bar">
        <div
          class="progress-fill"
          style="
            width:${progress}%
          "
        ></div>
      </div>

    </div>

    <div class="project-stats">

      <div class="project-stat">
        📋 ${tasks.length}
      </div>

      <div class="project-stat">
        ✅ ${completed}
      </div>

    </div>
  `;

  return card;

}

/* =========================
   NOTES
========================= */

export function renderNotes() {

  const root =
    document.getElementById(
      'notes-list'
    );

  if (!root) {
    return;
  }

  root.innerHTML = '';

  if (!state.notes.length) {

    root.innerHTML = `
      <div class="empty-state">
        Нет заметок
      </div>
    `;

    return;

  }

  state.notes.forEach((note) => {

    root.appendChild(
      createNoteCard(note)
    );

  });

}

export function renderPinnedNotes() {

  const root =
    document.getElementById(
      'dashboard-notes'
    );

  if (!root) {
    return;
  }

  root.innerHTML = '';

  state.notes
    .filter(
      (note) => note.pinned
    )
    .slice(0, 4)
    .forEach((note) => {

      root.appendChild(
        createNoteCard(note)
      );

    });

}

function createNoteCard(
  note
) {

  const card =
    document.createElement('article');

  card.className =
    'note-card';

  card.dataset.id =
    note.id;

  card.innerHTML = `
    <div class="note-title">
      ${
        note.pinned
          ? '📌 '
          : ''
      }
      ${escapeHtml(note.title)}
    </div>

    <div class="note-preview">
      ${escapeHtml(note.content)}
    </div>
  `;

  return card;

}

/* =========================
   CALENDAR
========================= */

export function renderCalendar() {

  const root =
    document.getElementById(
      'calendar-grid'
    );

  const title =
    document.getElementById(
      'calendar-title'
    );

  if (!root || !title) {
    return;
  }

  root.innerHTML = '';

  const current =
    state.calendarDate;

  const year =
    current.getFullYear();

  const month =
    current.getMonth();

  title.textContent =
    new Intl.DateTimeFormat(
      'ru-RU',
      {
        month: 'long',
        year: 'numeric'
      }
    ).format(current);

  const weekdays = [
    'Пн',
    'Вт',
    'Ср',
    'Чт',
    'Пт',
    'Сб',
    'Вс'
  ];

  weekdays.forEach((day) => {

    const el =
      document.createElement('div');

    el.className =
      'calendar-weekday';

    el.textContent = day;

    root.appendChild(el);

  });

  const firstDay =
    new Date(
      year,
      month,
      1
    );

  let startDay =
    firstDay.getDay();

  startDay =
    startDay === 0
      ? 6
      : startDay - 1;

  const daysInMonth =
    new Date(
      year,
      month + 1,
      0
    ).getDate();

  for (
    let i = 0;
    i < startDay;
    i++
  ) {

    const empty =
      document.createElement('div');

    empty.className =
      'calendar-day empty';

    root.appendChild(empty);

  }
 
 for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const date =
      new Date(
        year,
        month,
        day
      );

    const cell =
      document.createElement('button');

    cell.className =
      'calendar-day';

    const hasTasks =
      state.tasks.some((task) => {

        if (!task.dueDate) {
          return false;
        }

        const due =
          new Date(task.dueDate);

        return (
          due.getFullYear()
          ===
          year

          &&

          due.getMonth()
          ===
          month

          &&

          due.getDate()
          ===
          day
        );

      });

    const today =
      new Date();

    if (
      today.getFullYear()
      === year

      &&

      today.getMonth()
      === month

      &&

      today.getDate()
      === day
    ) {
      cell.classList.add(
        'today'
      );
    }

    if (hasTasks) {
      cell.classList.add(
        'has-tasks'
      );
    }

    cell.textContent =
      day;

    cell.dataset.date =
      date.getTime();

    root.appendChild(cell);

  }

}

/* =========================
   HEADER
========================= */

export function renderHeader() {

  const greeting =
    document.getElementById(
      'welcome-greeting'
    );

  const date =
    document.getElementById(
      'welcome-date'
    );

  if (greeting) {

    const hour =
      new Date().getHours();

    let text =
      'Добрый вечер';

    if (hour < 5) {
      text = 'Доброй ночи';
    } else if (hour < 12) {
      text = 'Доброе утро';
    } else if (hour < 18) {
      text = 'Добрый день';
    }

    greeting.textContent =
      text;

  }

  if (date) {

    date.textContent =
      formatDate(
        Date.now(),
        {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        }
      );

  }

}

/* =========================
   SEARCH
========================= */

export function searchAll(
  query
) {

  const normalized =
    query
      .trim()
      .toLowerCase();

  if (!normalized) {
    return [];
  }

  const tasks =
    state.tasks.map((task) => ({
      type: 'task',
      title: task.title,
      text: task.description,
      id: task.id
    }));

  const notes =
    state.notes.map((note) => ({
      type: 'note',
      title: note.title,
      text: note.content,
      id: note.id
    }));

  const projects =
    state.projects.map((project) => ({
      type: 'project',
      title: project.title,
      text: project.description,
      id: project.id
    }));

  return [
    ...tasks,
    ...notes,
    ...projects
  ].filter((item) => {

    return (
      item.title
        ?.toLowerCase()
        .includes(normalized)

      ||

      item.text
        ?.toLowerCase()
        .includes(normalized)
    );

  });

}

export function renderSearchResults(
  results
) {

  const root =
    document.getElementById(
      'search-results'
    );

  if (!root) {
    return;
  }

  root.innerHTML = '';

  if (!results.length) {

    root.innerHTML = `
      <div class="empty-state">
        Ничего не найдено
      </div>
    `;

    return;

  }

  results.forEach((item) => {

    const el =
      document.createElement('div');

    el.className =
      'search-result';

    el.innerHTML = `
      <div class="search-result-title">
        ${escapeHtml(item.title)}
      </div>

      <div class="search-result-text">
        ${
          escapeHtml(
            item.text || ''
          )
        }
      </div>
    `;

    root.appendChild(el);

  });

}

/* =========================
   HELPERS
========================= */

function getPriorityLabel(
  priority
) {

  switch (priority) {

    case 'high':
      return 'Высокий';

    case 'low':
      return 'Низкий';

    case 'medium':
    default:
      return 'Средний';

  }

}

function escapeHtml(
  value = ''
) {

  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

}

