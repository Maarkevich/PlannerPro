import {
  loadState,
  state,

  createTask,
  toggleTask,
  removeTask,

  createNote,
  createProject,

  updateTheme,
  updateAccent
} from './state.js';

import {

  renderView,

  renderDashboard,
  renderTasks,
  renderProjects,
  renderNotes,
  renderCalendar,

  renderHeader,

  searchAll,
  renderSearchResults

} from './render.js';

import {

  showToast,
  debounce,

  initKeyboardDetection,
  registerSW,

  vibrate

} from './utils.js';

/* =========================
   INIT
========================= */

document.addEventListener(
  'DOMContentLoaded',
  initApp
);

async function initApp() {

  try {

    await loadState();

    applySettings();

    renderAll();

    bindNavigation();
    bindTabs();
    bindActions();

    bindCalendar();

    bindSearch();
    bindFab();

    initKeyboardDetection();

    registerSW();

    showToast(
      'Planner Pro готов к работе',
      'success'
    );

  } catch (error) {

    console.error(error);

    showToast(
      'Ошибка загрузки приложения',
      'error'
    );

  }

}

/* =========================
   SETTINGS
========================= */

function applySettings() {

  document.body.dataset.theme =
    state.settings.theme;

  document.body.dataset.accent =
    state.settings.accent;

}

/* =========================
   RENDER
========================= */

function renderAll() {

  renderHeader();

  renderDashboard();

  renderTasks();

  renderProjects();

  renderNotes();

  renderCalendar();

}

/* =========================
   NAVIGATION
========================= */

function bindNavigation() {

  document
    .querySelectorAll(
      '.bottom-nav-btn'
    )
    .forEach((button) => {

      button.addEventListener(
        'click',
        () => {

          const view =
            button.dataset.view;

          renderView(view);

          vibrate(8);

        }
      );

    });

  document
    .querySelectorAll(
      '[data-view-link]'
    )
    .forEach((button) => {

      button.addEventListener(
        'click',
        () => {

          const view =
            button.dataset.viewLink;

          renderView(view);

          vibrate(8);

        }
      );

    });

}

/* =========================
   TASK TABS
========================= */

function bindTabs() {

  const tabs =
    document.querySelectorAll(
      '.tab-btn'
    );

  tabs.forEach((tab) => {

    tab.addEventListener(
      'click',
      () => {

        tabs.forEach((item) => {
          item.classList.remove(
            'active'
          );
        });

        tab.classList.add(
          'active'
        );

        state.currentTaskTab =
          tab.dataset.tab;

        renderTasks();

        vibrate(6);

      }
    );

  });

}

/* =========================
   ACTIONS
========================= */

function bindActions() {

  document.addEventListener(
    'click',
    async (event) => {

      const action =
        event.target.dataset.action;

      const id =
        event.target.dataset.id;

      if (!action) {
        return;
      }

      switch (action) {

        case 'toggle-task':

          await toggleTask(id);

          renderAll();

          vibrate([10, 30, 10]);

          break;

        case 'delete-task':

          if (
            confirm(
              'Удалить задачу?'
            )
          ) {

            await removeTask(id);

            renderAll();

            showToast(
              'Задача удалена'
            );

            vibrate(12);

          }

          break;

        case 'edit-task':

          showToast(
            'Редактор будет подключён далее'
          );

          break;

      }

    }
  );

}

/* =========================
   CALENDAR
========================= */

function bindCalendar() {

  const prev =
    document.getElementById(
      'calendar-prev'
    );

  const next =
    document.getElementById(
      'calendar-next'
    );

  prev?.addEventListener(
    'click',
    () => {

      state.calendarDate =
        new Date(
          state.calendarDate.getFullYear(),
          state.calendarDate.getMonth() - 1,
          1
        );

      renderCalendar();

      vibrate(6);

    }
  );

  next?.addEventListener(
    'click',
    () => {

      state.calendarDate =
        new Date(
          state.calendarDate.getFullYear(),
          state.calendarDate.getMonth() + 1,
          1
        );

      renderCalendar();

      vibrate(6);

    }
  );

}

/* =========================
   SEARCH
========================= */

function bindSearch() {

  createSearchOverlay();

  const openBtn =
    document.getElementById(
      'search-open-btn'
    );

  const overlay =
    document.getElementById(
      'search-overlay'
    );

  const input =
    document.getElementById(
      'search-input'
    );

  openBtn?.addEventListener(
    'click',
    () => {

      overlay.classList.add(
        'active'
      );

      setTimeout(() => {
        input?.focus();
      }, 120);

    }
  );

  overlay?.addEventListener(
    'click',
    (event) => {

      if (
        event.target === overlay
      ) {

        overlay.classList.remove(
          'active'
        );

      }

    }
  );

  input?.addEventListener(
    'input',
    debounce((event) => {

      const results =
        searchAll(
          event.target.value
        );

      renderSearchResults(
        results
      );

    }, 200)
  );

}

function createSearchOverlay() {

  const overlay =
    document.createElement('div');

  overlay.className =
    'search-overlay';

  overlay.id =
    'search-overlay';

  overlay.innerHTML = `
    <div class="search-panel">

      <div
        class="search-input-wrap"
      >

        <input
          id="search-input"
          class="glass-input"
          type="search"
          placeholder="Поиск..."
          autocomplete="off"
        >

      </div>

      <div
        id="search-results"
        class="search-results"
      ></div>

    </div>
  `;

  document.body.appendChild(
    overlay
  );

}

/* =========================
   FAB
========================= */

function bindFab() {

  const fab =
    document.getElementById(
      'fab'
    );

  fab?.addEventListener(
    'click',
    openCreateMenu
  );

}

function openCreateMenu() {

  const overlay =
    document.createElement('div');

  overlay.className =
    'modal-overlay active';

  overlay.innerHTML = `
    <div class="modal-sheet">

      <div class="modal-handle"></div>

      <div class="section-title-row">
        <h2>Создать</h2>
      </div>

      <div class="task-list">

        <button
          class="primary-btn"
          data-create="task"
        >
          ✅ Новая задача
        </button>

        <button
          class="secondary-btn"
          data-create="note"
        >
          📝 Новая заметка
        </button>

        <button
          class="secondary-btn"
          data-create="project"
        >
          📁 Новый проект
        </button>

      </div>

    </div>
  `;

  document.body.appendChild(
    overlay
  );

  overlay.addEventListener(
    'click',
    async (event) => {

      if (
        event.target === overlay
      ) {

        overlay.remove();

        return;

      }

      const type =
        event.target.dataset.create;

      if (!type) {
        return;
      }

      overlay.remove();

      switch (type) {

        case 'task':
          openTaskModal();
          break;

        case 'note':
          openNoteModal();
          break;

        case 'project':
          openProjectModal();
          break;

      }

    }
  );

}

/* =========================
   TASK MODAL
========================= */

function openTaskModal() {

  const overlay =
    createModal(`
      <div class="section-title-row">
        <h2>Новая задача</h2>
      </div>

      <form id="task-form">

        <div class="form-group">

          <label class="form-label">
            Название
          </label>

          <input
            required
            id="task-title"
            class="glass-input"
            type="text"
            maxlength="120"
            placeholder="Введите задачу"
          >

        </div>

        <div class="form-group">

          <label class="form-label">
            Описание
          </label>

          <textarea
            id="task-description"
            class="
              glass-input
              form-textarea
            "
            placeholder="Описание задачи"
          ></textarea>

        </div>

        <div class="form-row">

          <div class="form-group">

            <label class="form-label">
              Приоритет
            </label>

            <div class="select-wrap">

              <select
                id="task-priority"
                class="form-select"
              >
                <option value="low">
                  Низкий
                </option>

                <option
                  value="medium"
                  selected
                >
                  Средний
                </option>

                <option value="high">
                  Высокий
                </option>

              </select>

            </div>

          </div>

          <div class="form-group">

            <label class="form-label">
              Дата
            </label>

            <input
              id="task-date"
              class="glass-input"
              type="date"
            >

          </div>

        </div>

        <div class="form-actions">

          <button
            type="button"
            class="secondary-btn"
            id="task-cancel"
          >
            Отмена
          </button>

          <button
            type="submit"
            class="primary-btn"
          >
            Создать
          </button>

        </div>

      </form>
    `);

  const form =
    overlay.querySelector(
      '#task-form'
    );

  const cancel =
    overlay.querySelector(
      '#task-cancel'
    );

  cancel?.addEventListener(
    'click',
    () => {
      closeModal(overlay);
    }
  );

  form?.addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();

      const title =
        form.querySelector(
          '#task-title'
        ).value.trim();

      const description =
        form.querySelector(
          '#task-description'
        ).value.trim();

      const priority =
        form.querySelector(
          '#task-priority'
        ).value;

      const date =
        form.querySelector(
          '#task-date'
        ).value;

      if (!title) {
        return;
      }

      await createTask({

        title,
        description,
        priority,

        dueDate:
          date
            ? new Date(date).getTime()
            : null

      });

      renderAll();

      closeModal(overlay);

      showToast(
        'Задача создана',
        'success'
      );

      vibrate([12, 40, 12]);

    }
  );

}

/* =========================
   NOTE MODAL
========================= */

function openNoteModal() {

  const overlay =
    createModal(`
      <div class="section-title-row">
        <h2>Новая заметка</h2>
      </div>

      <form id="note-form">

        <div class="form-group">

          <label class="form-label">
            Заголовок
          </label>

          <input
            required
            id="note-title"
            class="glass-input"
            type="text"
            maxlength="120"
            placeholder="Название заметки"
          >

        </div>

        <div class="form-group">

          <label class="form-label">
            Текст
          </label>

          <textarea
            id="note-content"
            class="
              glass-input
              form-textarea
            "
            placeholder="Введите текст заметки"
          ></textarea>

        </div>

        <div class="form-actions">

          <button
            type="button"
            class="secondary-btn"
            id="note-cancel"
          >
            Отмена
          </button>

          <button
            type="submit"
            class="primary-btn"
          >
            Создать
          </button>

        </div>

      </form>
    `);

  const form =
    overlay.querySelector(
      '#note-form'
    );

  overlay
    .querySelector(
      '#note-cancel'
    )
    ?.addEventListener(
      'click',
      () => {
        closeModal(overlay);
      }
    );

  form?.addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();

      const title =
        form.querySelector(
          '#note-title'
        ).value.trim();

      const content =
        form.querySelector(
          '#note-content'
        ).value.trim();

      if (!title) {
        return;
      }

      await createNote({
        title,
        content
      });

      renderAll();

      closeModal(overlay);

      showToast(
        'Заметка создана',
        'success'
      );

    }
  );

}

/* =========================
   PROJECT MODAL
========================= */

function openProjectModal() {

  const overlay =
    createModal(`
      <div class="section-title-row">
        <h2>Новый проект</h2>
      </div>

      <form id="project-form">

        <div class="form-group">

          <label class="form-label">
            Название
          </label>

          <input
            required
            id="project-title"
            class="glass-input"
            type="text"
            maxlength="120"
            placeholder="Название проекта"
          >

        </div>

        <div class="form-group">

          <label class="form-label">
            Описание
          </label>

          <textarea
            id="project-description"
            class="
              glass-input
              form-textarea
            "
            placeholder="Описание проекта"
          ></textarea>

        </div>

        <div class="form-actions">

          <button
            type="button"
            class="secondary-btn"
            id="project-cancel"
          >
            Отмена
          </button>

          <button
            type="submit"
            class="primary-btn"
          >
            Создать
          </button>

        </div>

      </form>
    `);

  const form =
    overlay.querySelector(
      '#project-form'
    );

  overlay
    .querySelector(
      '#project-cancel'
    )
    ?.addEventListener(
      'click',
      () => {
        closeModal(overlay);
      }
    );

  form?.addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();

      const title =
        form.querySelector(
          '#project-title'
        ).value.trim();

      const description =
        form.querySelector(
          '#project-description'
        ).value.trim();

      if (!title) {
        return;
      }

      await createProject({
        title,
        description
      });

      renderAll();

      closeModal(overlay);

      showToast(
        'Проект создан',
        'success'
      );

      vibrate(12);

    }
  );

}

/* =========================
   MODAL HELPERS
========================= */

function createModal(
  content
) {

  const overlay =
    document.createElement('div');

  overlay.className =
    'modal-overlay active';

  overlay.innerHTML = `
    <div class="modal-sheet">

      <div class="modal-handle"></div>

      ${content}

    </div>
  `;

  overlay.addEventListener(
    'click',
    (event) => {

      if (
        event.target === overlay
      ) {

        closeModal(overlay);

      }

    }
  );

  document.body.appendChild(
    overlay
  );

  return overlay;

}

function closeModal(
  overlay
) {

  overlay.classList.remove(
    'active'
  );

  setTimeout(() => {
    overlay.remove();
  }, 220);

}

/* =========================
   SETTINGS PANEL
========================= */

createSettingsPanel();

function createSettingsPanel() {

  const settingsBtn =
    document.getElementById(
      'settings-open-btn'
    );

  if (!settingsBtn) {
    return;
  }

  settingsBtn.addEventListener(
    'click',
    () => {

      const overlay =
        createModal(`
          <div class="section-title-row">
            <h2>Настройки</h2>
          </div>

          <div class="settings-group">

            <div class="settings-title">
              Оформление
            </div>

            <div class="settings-list">

              <div class="settings-item">

                <div
                  class="settings-item-left"
                >

                  <div
                    class="settings-item-title"
                  >
                    Светлая тема
                  </div>

                  <div
                    class="
                      settings-item-subtitle
                    "
                  >
                    Переключение темы
                  </div>

                </div>

                <label class="switch">

                  <input
                    id="theme-switch"
                    type="checkbox"
                    ${
                      state.settings.theme
                      === 'light'
                        ? 'checked'
                        : ''
                    }
                  >

                  <span
                    class="switch-slider"
                  ></span>

                </label>

              </div>

              <div class="settings-item">

                <div
                  class="settings-item-left"
                >

                  <div
                    class="settings-item-title"
                  >
                    Accent
                  </div>

                  <div
                    class="
                      settings-item-subtitle
                    "
                  >
                    Цвет интерфейса
                  </div>

                </div>

                <div class="select-wrap">

                  <select
                    id="accent-select"
                    class="form-select"
                  >

                    <option value="ocean">
                      Ocean
                    </option>

                    <option value="sunset">
                      Sunset
                    </option>

                    <option value="forest">
                      Forest
                    </option>

                    <option value="neon">
                      Neon
                    </option>

                  </select>

                </div>

              </div>

            </div>

          </div>
        `);

      const themeSwitch =
        overlay.querySelector(
          '#theme-switch'
        );

      const accentSelect =
        overlay.querySelector(
          '#accent-select'
        );

      accentSelect.value =
        state.settings.accent;

      themeSwitch?.addEventListener(
        'change',
        async () => {

          await updateTheme(
            themeSwitch.checked
              ? 'light'
              : 'dark'
          );

        }
      );

      accentSelect?.addEventListener(
        'change',
        async () => {

          await updateAccent(
            accentSelect.value
          );

        }
      );

    }
  );

}