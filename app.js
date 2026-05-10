/* =========================================
   1. CONSTANTS & CONFIG
   ========================================= */
const APP_VERSION = '2.1';
const DB_NAME = 'planner_db';
const DB_VERSION = 1;

const SCHEMES = {
  ocean:   { start: '#667eea', end: '#764ba2', accent: '#4facfe' },
  sunset:  { start: '#fa709a', end: '#fee140', accent: '#ff6b6b' },
  forest:  { start: '#11998e', end: '#38ef7d', accent: '#00d9a5' },
  neon:    { start: '#b721ff', end: '#21d4fd', accent: '#e94560' }
};

const PROJECT_COLORS = ['#667eea','#fa709a','#11998e','#b721ff','#ff6b6b','#feca57','#48dbfb','#1dd1a1'];

/* =========================================
   2. UTILITIES
   ========================================= */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Форматирование для отображения (DD Month YYYY)
function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const opts = { day: 'numeric', month: 'long' };
  if (date.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString('ru-RU', opts);
}

// Форматирование для хранения (YYYY-MM-DD) - без сдвига часовых поясов
function formatDateISO(d) {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isOverdue(d) {
  if (!d) return false;
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date < new Date();
}

function isToday(d) {
  if (!d) return false;
  return formatDateISO(new Date(d)) === formatDateISO(new Date());
}

function addDays(d, days) {
  const date = new Date(d);
  date.setDate(date.getDate() + days);
  return formatDateISO(date);
}

function addMonths(d, months) {
  const date = new Date(d);
  date.setMonth(date.getMonth() + months);
  return formatDateISO(date);
}

function getWeekStart(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function getMonthName(year, month) {
  return new Date(year, month).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function sanitizeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* =========================================
   3. STORE (Event-based State)
   ========================================= */
class Store {
  constructor() {
    this.state = {};
    this.listeners = {};
  }
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
    return () => this.off(event, cb);
  }
  off(event, cb) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== cb);
  }
  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(data));
  }
  set(key, value) {
    this.state[key] = value;
    this.emit(key, value);
  }
  get(key) {
    return this.state[key];
  }
}
const store = new Store();

/* =========================================
   4. INDEXED DB
   ========================================= */
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onblocked = () => {
      showToast('Пожалуйста, закройте другие вкладки приложения', 'error');
    };
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      // Tasks
      if (!database.objectStoreNames.contains('tasks')) {
        const tasksStore = database.createObjectStore('tasks', { keyPath: 'id' });
        tasksStore.createIndex('by_project', 'projectId', { unique: false });
        tasksStore.createIndex('by_dueDate', 'dueDate', { unique: false });
        tasksStore.createIndex('by_status', 'status', { unique: false });
        tasksStore.createIndex('by_priority', 'priority', { unique: false });
        tasksStore.createIndex('by_createdAt', 'createdAt', { unique: false });
      }
      // Notes
      if (!database.objectStoreNames.contains('notes')) {
        const notesStore = database.createObjectStore('notes', { keyPath: 'id' });
        notesStore.createIndex('by_project', 'projectId', { unique: false });
        notesStore.createIndex('by_isPinned', 'isPinned', { unique: false });
        notesStore.createIndex('by_createdAt', 'createdAt', { unique: false });
      }
      // Projects
      if (!database.objectStoreNames.contains('projects')) {
        database.createObjectStore('projects', { keyPath: 'id' });
      }
      // Tags
      if (!database.objectStoreNames.contains('tags')) {
        database.createObjectStore('tags', { keyPath: 'id' });
      }
      // Settings
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

function dbAdd(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.add(data);
    req.onsuccess = () => resolve(data);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(data);
    req.onsuccess = () => resolve(data);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/* =========================================
   5. SETTINGS & SEED
   ========================================= */
async function getSetting(key, defaultValue = null) {
  const result = await dbGet('settings', key);
  return result ? result.value : defaultValue;
}

async function setSetting(key, value) {
  await dbPut('settings', { key, value });
}

async function seedDemoData() {
  const existing = await dbGetAll('projects');
  if (existing.length > 0) return;

  const today = formatDateISO(new Date());
  
  // Projects
  const projects = [
    { id: uuid(), name: 'Работа', description: 'Рабочие задачи', color: '#667eea', icon: '💼', isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: uuid(), name: 'Личное', description: 'Личные дела', color: '#11998e', icon: '🏠', isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: uuid(), name: 'Учёба', description: 'Обучение и курсы', color: '#b721ff', icon: '📚', isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ];
  for (const p of projects) await dbAdd('projects', p);

  // Tasks
  const tasks = [
    { 
      id: uuid(), 
      title: 'Завершить отчёт', 
      description: 'Подготовить еженедельный отчёт', 
      projectId: projects[0].id, 
      priority: 'high', 
      dueDate: today, 
      startTime: '09:00', 
      endTime: '11:00', 
      repeat: 'none', 
      repeatConfig: null, 
      subtasks: [
        {id: uuid(), title: 'Собрать данные', completed: true}, 
        {id: uuid(), title: 'Составить графики', completed: false}
      ], 
      tags: ['работа','важно'], 
      status: 'active', 
      createdAt: new Date().toISOString(), 
      completedAt: null, 
      updatedAt: new Date().toISOString() 
    },
    { 
      id: uuid(), 
      title: 'Купить продукты', 
      description: 'Молоко, хлеб, яйца', 
      projectId: projects[1].id, 
      priority: 'medium', 
      dueDate: today, 
      startTime: null, 
      endTime: null, 
      repeat: 'weekly', 
      repeatConfig: null, 
      subtasks: [], 
      tags: ['личное'], 
      status: 'active', 
      createdAt: new Date().toISOString(), 
      completedAt: null, 
      updatedAt: new Date().toISOString() 
    },
    { 
      id: uuid(), 
      title: 'Прочитать главу книги', 
      description: 'Глава 5 по JavaScript', 
      projectId: projects[2].id, 
      priority: 'low', 
      dueDate: addDays(today, 2), 
      startTime: null, 
      endTime: null, 
      repeat: 'none', 
      repeatConfig: null, 
      subtasks: [], 
      tags: ['учёба'], 
      status: 'active', 
      createdAt: new Date().toISOString(), 
      completedAt: null, 
      updatedAt: new Date().toISOString() 
    },
    { 
      id: uuid(), 
      title: 'Позвонить маме', 
      description: '', 
      projectId: null, 
      priority: 'medium', 
      dueDate: null, 
      startTime: null, 
      endTime: null, 
      repeat: 'none', 
      repeatConfig: null, 
      subtasks: [], 
      tags: [], 
      status: 'active', 
      createdAt: new Date().toISOString(), 
      completedAt: null, 
      updatedAt: new Date().toISOString() 
    }
  ];
  for (const t of tasks) await dbAdd('tasks', t);

  // Notes
  const notes = [
    { 
      id: uuid(), 
      title: 'Идеи для проекта', 
      content: '<h1>Новые идеи</h1><p>1. Добавить тёмную тему</p><p>2. Улучшить производительность</p><ul><li>Оптимизировать рендеринг</li><li>Добавить виртуализацию списков</li></ul>', 
      projectId: projects[0].id, 
      tags: ['идеи'], 
      isPinned: true, 
      isFavorite: true, 
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString() 
    },
    { 
      id: uuid(), 
      title: 'Рецепт пасты', 
      content: '<p><b>Ингредиенты:</b></p><ul><li>Спагетти 400г</li><li>Помидоры 500г</li><li>Чеснок 3 зубчика</li></ul><p><i>Приготовить соус, сварить пасту...</i></p>', 
      projectId: projects[1].id, 
      tags: ['рецепты'], 
      isPinned: false, 
      isFavorite: false, 
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString() 
    }
  ];
  for (const n of notes) await dbAdd('notes', n);

  // Tags
  const tags = [
    { id: uuid(), name: 'работа', color: '#667eea', usageCount: 1 },
    { id: uuid(), name: 'важно', color: '#ef4444', usageCount: 1 },
    { id: uuid(), name: 'личное', color: '#11998e', usageCount: 1 },
    { id: uuid(), name: 'учёба', color: '#b721ff', usageCount: 1 },
    { id: uuid(), name: 'идеи', color: '#feca57', usageCount: 1 },
    { id: uuid(), name: 'рецепты', color: '#48dbfb', usageCount: 1 }
  ];
  for (const t of tags) await dbAdd('tags', t);
}

/* =========================================
   6. UI RENDER HELPERS
   ========================================= */

// Рендер одной задачи (HTML-строка)
function renderTaskItem(task, projects = []) {
  const project = projects.find(p => p.id === task.projectId);
  const priorityClass = task.priority || 'medium';
  const isOverdueTask = task.dueDate && isOverdue(task.dueDate) && task.status === 'active';
  
  // Время
  let timeStr = '';
  if (task.startTime) {
    timeStr = task.endTime ? `${task.startTime}–${task.endTime}` : task.startTime;
  }
  
  // Дата
  let dateStr = '';
  if (task.dueDate) {
    dateStr = isToday(task.dueDate) ? 'Сегодня' : formatDate(task.dueDate);
    if (isOverdueTask) dateStr = `<span class="overdue">${dateStr}</span>`;
  }

  // Мета-данные
  const metaItems = [];
  if (dateStr) metaItems.push(dateStr);
  if (timeStr) metaItems.push(`<span class="task-time">${timeStr}</span>`);
  if (task.repeat !== 'none') metaItems.push('<span class="task-repeat">↻</span>');

  // Подзадачи
  const subtaskCount = task.subtasks?.length || 0;
  const subtaskDone = task.subtasks?.filter(s => s.completed).length || 0;

  return `
  <div class="task-item priority-${priorityClass}" data-id="${task.id}" data-status="${task.status}">
    <!-- Swipe Backgrounds -->
    <div class="task-swipe-bg complete">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      <span>Выполнить</span>
    </div>
    <div class="task-swipe-bg delete">
      <span>Удалить</span>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
    </div>
    
    <!-- Checkbox -->
    <div class="task-checkbox ${task.status === 'completed' ? 'checked' : ''}" data-action="toggle"></div>
    
    <!-- Info -->
    <div class="task-info">
      <div class="task-title">${sanitizeHTML(task.title)}</div>
      ${task.description ? `<div class="task-desc-preview">${sanitizeHTML(task.description)}</div>` : ''}
      
      <div class="task-meta">
        <span class="task-priority ${priorityClass}"></span>
        ${metaItems.join(' • ')}
        ${project ? `<span class="task-project-badge" style="color:${project.color}">${project.icon} ${sanitizeHTML(project.name)}</span>` : ''}
        ${subtaskCount > 0 ? `<span class="subtask-counter" data-action="subtasks" data-id="${task.id}">${subtaskDone}/${subtaskCount}</span>` : ''}
      </div>
      
      ${task.tags?.length ? `<div class="task-tags">${task.tags.map(t => `<span class="task-tag">${sanitizeHTML(t)}</span>`).join('')}</div>` : ''}
      
      <!-- Subtasks Container (Hidden by default) -->
      ${subtaskCount > 0 ? `<div class="subtasks-list hidden" id="sub-${task.id}"></div>` : ''}
    </div>
  </div>
  `;
}

// Рендер карточки заметки
function renderNoteCard(note) {
  const plain = note.content.replace(/<[^>]+>/g, ' ').trim();
  const preview = plain.slice(0, 120) + (plain.length > 120 ? '...' : '');
  
  return `
  <div class="note-card ${note.isPinned ? 'pinned' : ''}" data-id="${note.id}">
    <div class="note-card-header">
      <div class="note-card-title">${sanitizeHTML(note.title || 'Без названия')}</div>
      ${note.isFavorite ? '<span class="note-card-fav">★</span>' : ''}
    </div>
    <div class="note-card-preview">${sanitizeHTML(preview)}</div>
    <div class="note-card-meta">
      <span>${formatDate(note.updatedAt)}</span>
      ${note.tags?.length ? note.tags.map(t => `<span class="tag">${sanitizeHTML(t)}</span>`).join('') : ''}
    </div>
  </div>
  `;
}

// Рендер карточки проекта (с корректным прогрессом)
function renderProjectCard(project, tasks = []) {
  const pTasks = tasks.filter(t => t.projectId === project.id && t.status !== 'deleted');
  const completed = pTasks.filter(t => t.status === 'completed').length;
  const active = pTasks.filter(t => t.status === 'active').length;
  // Прогресс: выполненные / (выполненные + активные)
  const progress = calculateProgress(completed, active);
  
  return `
  <div class="project-card ${project.isArchived ? 'archived' : ''}" data-id="${project.id}">
    <div class="project-icon" style="background:${project.color}20;color:${project.color}">${project.icon || '📁'}</div>
    <div class="project-info">
      <div class="project-name">${sanitizeHTML(project.name)}</div>
      <div class="project-desc">${sanitizeHTML(project.description || '')}</div>
    </div>
    <div class="project-progress">
      <div class="project-progress-bar"><div class="project-progress-fill" style="width:${progress}%;background:${project.color}"></div></div>
      <div class="project-progress-text">${progress}%</div>
    </div>
  </div>
  `;
}

// Утилита расчёта прогресса (выполненные / (выполненные + активные))
function calculateProgress(completed, active) {
  const total = completed + active;
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

/* =========================================
   7. DASHBOARD (Главный экран)
   ========================================= */

async function renderDashboard() {
  const today = formatDateISO(new Date());
  const tasks = await dbGetAll('tasks');
  const notes = await dbGetAll('notes');
  const projects = await dbGetAll('projects');
  
  // 1. Приветствие (временные рамки по ТЗ)
  const h = new Date().getHours();
  let greeting = 'Доброй ночи!';
  if (h >= 3 && h < 9) greeting = 'Доброе утро!';
  else if (h >= 9 && h < 17) greeting = 'Добрый день!';
  else if (h >= 17 && h < 22) greeting = 'Добрый вечер!';
  
  const greetingEl = document.getElementById('welcome-greeting');
  if (greetingEl) greetingEl.textContent = greeting;
  
  const dateEl = document.getElementById('welcome-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  // 2. Прогресс дня (корректный расчёт)
  const todayTasks = tasks.filter(t => t.dueDate === today && t.status !== 'deleted');
  const todayCompleted = todayTasks.filter(t => t.status === 'completed').length;
  const todayActive = todayTasks.filter(t => t.status === 'active').length;
  const dayProgress = calculateProgress(todayCompleted, todayActive);
  
  const progVal = document.getElementById('day-progress-value');
  const progFill = document.getElementById('day-progress-fill');
  if (progVal) progVal.textContent = `${dayProgress}%`;
  if (progFill) progFill.style.width = `${dayProgress}%`;

  // 3. Задачи на ближайшие N дней (настраивается, по умолчанию 2)
  const daysToShow = parseInt(await getSetting('dashboardDays', '2')) || 2;
  const upcomingTasks = tasks.filter(t => {
    if (!t.dueDate || t.status === 'deleted' || t.status === 'completed') return false;
    const taskDate = new Date(t.dueDate);
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() + daysToShow - 1);
    return taskDate >= new Date(today) && taskDate <= limitDate;
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 10);
  
  const upContainer = document.getElementById('dashboard-today-tasks'); // Используем тот же контейнер для простоты
  const upEmpty = document.getElementById('dashboard-today-empty');
  const upCount = document.getElementById('today-count');
  
  if (upContainer) {
    if (upcomingTasks.length === 0) {
      upContainer.innerHTML = '';
      if (upEmpty) upEmpty.classList.remove('hidden');
    } else {
      if (upEmpty) upEmpty.classList.add('hidden');
      upContainer.innerHTML = upcomingTasks.map(t => renderTaskItem(t, projects)).join('');
    }
    if (upCount) upCount.textContent = upcomingTasks.length;
  }

  // 4. Просроченные задачи
  const overdue = tasks.filter(t => t.dueDate && isOverdue(t.dueDate) && t.status === 'active');
  const overdueSection = document.getElementById('dashboard-overdue-section');
  const overdueContainer = document.getElementById('dashboard-overdue-tasks');
  const overdueCount = document.getElementById('overdue-count');
  
  if (overdueSection) {
    if (overdue.length > 0) {
      overdueSection.classList.remove('hidden');
      if (overdueContainer) overdueContainer.innerHTML = overdue.slice(0, 3).map(t => renderTaskItem(t, projects)).join('');
      if (overdueCount) overdueCount.textContent = overdue.length;
    } else {
      overdueSection.classList.add('hidden');
    }
  }

  // 5. Закреплённые заметки
  const pinned = notes.filter(n => n.isPinned).slice(0, 4);
  const pinnedContainer = document.getElementById('dashboard-pinned-notes');
  const pinnedEmpty = document.getElementById('dashboard-pinned-empty');
  
  if (pinnedContainer) {
    if (pinned.length === 0) {
      pinnedContainer.innerHTML = '';
      if (pinnedEmpty) pinnedEmpty.classList.remove('hidden');
    } else {
      if (pinnedEmpty) pinnedEmpty.classList.add('hidden');
      pinnedContainer.innerHTML = pinned.map(n => renderNoteCard(n)).join('');
    }
  }

  // 6. Недавние проекты (горизонтальный скролл)
  const activeProjects = projects.filter(p => !p.isArchived).slice(0, 8);
  const projContainer = document.getElementById('dashboard-recent-projects');
  const projEmpty = document.getElementById('dashboard-projects-empty');
  
  if (projContainer) {
    if (activeProjects.length === 0) {
      projContainer.innerHTML = '';
      if (projEmpty) projEmpty.classList.remove('hidden');
    } else {
      if (projEmpty) projEmpty.classList.add('hidden');
      projContainer.innerHTML = activeProjects.map(p => renderProjectCard(p, tasks)).join('');
    }
  }
  
  // Перепривязка событий для динамического контента
  attachDashboardListeners();
}

// Привязка событий для элементов Dashboard (открытие задач, заметок, проектов)
function attachDashboardListeners() {
  // Задачи
  document.querySelectorAll('#dashboard-today-tasks .task-item, #dashboard-overdue-tasks .task-item').forEach(el => {
    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-action]')) return; // Игнорируем клики по кнопкам действий
      const task = await dbGet('tasks', el.dataset.id);
      if (task) openTaskModal(task);
    });
  });
  
  // Заметки
  document.querySelectorAll('#dashboard-pinned-notes .note-card').forEach(el => {
    el.addEventListener('click', async () => {
      const note = await dbGet('notes', el.dataset.id);
      if (note) openNoteModal(note);
    });
  });
  
  // Проекты
  document.querySelectorAll('#dashboard-recent-projects .project-card').forEach(el => {
    el.addEventListener('click', async () => {
      const project = await dbGet('projects', el.dataset.id);
      if (project) openProjectModal(project);
    });
  });
}

/* =========================================
   8. NAVIGATION & ROUTING
   ========================================= */

let currentView = 'dashboard';
let previousView = null; // Для анимаций или возврата

function navigateTo(view, saveHistory = true) {
    if (currentView === view) return;
    
    // Сохраняем предыдущее состояние
    previousView = currentView;
    currentView = view;
    
    // Обновляем URL
    if (saveHistory) {
        window.location.hash = view;
    }

    // Скрываем текущий view
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    
    // Показываем новый view
    const targetView = document.getElementById(`view-${view}`);
    if (targetView) {
        targetView.classList.add('active');
        
        // Специфичная логика для каждого экрана при открытии
        switch(view) {
            case 'dashboard': renderDashboard(); break;
            case 'tasks': renderTasks(); break;
            case 'calendar': renderCalendar(); break;
            case 'notes': renderNotes(); break;
            case 'projects': renderProjects(); break;
            case 'stats': renderStats(); break;
            case 'archive': renderArchive(); break;
            case 'search': renderSearch(); break; // Рендер начального состояния поиска
        }
    }

    // Обновляем заголовок
    updateHeaderTitle(view);

    // Обновляем активный пункт меню (Bottom Nav и Side Nav)
    document.querySelectorAll('.nav-item, .side-nav-item').forEach(item => {
        const itemView = item.getAttribute('data-view');
        if (itemView === view) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Скролл вверх
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.scrollTop = 0;

    // Скрываем FAB на экранах, где он не нужен (например, настройки, архив)
    updateFabVisibility(view);
}

function updateHeaderTitle(view) {
    const titles = {
        dashboard: 'Главная',
        tasks: 'Задачи',
        calendar: 'Календарь',
        notes: 'Заметки',
        projects: 'Проекты',
        stats: 'Статистика',
        archive: 'Архив',
        search: 'Поиск',
        settings: 'Настройки'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[view] || 'Planner Pro';
}

function updateFabVisibility(view) {
    const fab = document.getElementById('fab');
    // FAB нужен на: Главная, Задачи, Заметки, Проекты
    const showFab = ['dashboard', 'tasks', 'notes', 'projects'].includes(view);
    if (fab) {
        if (showFab) {
            fab.style.display = 'flex';
        } else {
            fab.style.display = 'none';
            // Также закрываем меню FAB, если оно открыто
            closeFabMenu();
        }
    }
}

// Обработчик изменения Hash (кнопка "Назад" в браузере)
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1);
    if (hash) {
        navigateTo(hash, false);
    }
});

// Инициализация навигации по кликам
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item, .side-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            if (view) navigateTo(view);
        });
    });

    // Обработка кнопки поиска в хедере
    const searchBtn = document.getElementById('header-search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            navigateTo('search');
            // Фокус на поле ввода после перехода
            setTimeout(() => {
                const input = document.getElementById('search-input');
                if (input) input.focus();
            }, 300);
        });
    }
});

/* =========================================
   9. MODALS & OVERLAYS
   ========================================= */

// Открытие модального окна
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Блокируем скролл фона
    }
}

// Закрытие модального окна
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Разблокируем скролл
    }
}

// Закрытие при клике на оверлей (фон)
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.closest('.modal').classList.remove('active');
        document.body.style.overflow = '';
    }
    if (e.target.classList.contains('sheet-overlay')) {
        e.target.closest('.bottom-sheet').classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Закрытие по кнопке "Закрыть" внутри модалки
document.querySelectorAll('.modal-close, .sheet-close').forEach(btn => {
    btn.addEventListener('click', () => {
        const modal = btn.closest('.modal') || btn.closest('.bottom-sheet');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
});

/* =========================================
   10. FAB MENU (Floating Action Button)
   ========================================= */

const fab = document.getElementById('fab');
const fabMenu = document.getElementById('fab-menu');
let isFabOpen = false;

function toggleFabMenu() {
    isFabOpen = !isFabOpen;
    if (fab) fab.classList.toggle('active', isFabOpen);
    if (fabMenu) {
        fabMenu.classList.toggle('active', isFabOpen);
        fabMenu.classList.toggle('hidden', !isFabOpen);
    }
}

function closeFabMenu() {
    isFabOpen = false;
    if (fab) fab.classList.remove('active');
    if (fabMenu) {
        fabMenu.classList.remove('active');
        fabMenu.classList.add('hidden');
    }
}

if (fab) {
    fab.addEventListener('click', (e) => {
        e.stopPropagation(); // Чтобы не сработал глобальный клик
        toggleFabMenu();
    });
}

// Обработка пунктов FAB-меню
document.querySelectorAll('.fab-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.getAttribute('data-action');
        
        closeFabMenu();

        if (action === 'task') openTaskModal();
        else if (action === 'note') openNoteModal();
        else if (action === 'project') openProjectModal();
    });
});

// Закрытие FAB-меню при клике в любом другом месте
document.addEventListener('click', (e) => {
    if (isFabOpen && !e.target.closest('#fab') && !e.target.closest('#fab-menu')) {
        closeFabMenu();
    }
});

/* =========================================
   11. TABS & SWIPE LOGIC (Tasks View)
   ========================================= */

// Переключение табов по клику
function setupTabs(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const tabs = container.querySelectorAll('.tab');
    const contents = container.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            
            // Обновляем UI табов
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Обновляем контент
            contents.forEach(c => c.classList.remove('active'));
            const activeContent = document.getElementById(`tab-${tabName}`);
            if (activeContent) activeContent.classList.add('active');
            
            // Триггерим событие для перерисовки контента, если нужно
            container.dispatchEvent(new CustomEvent('tabchange', { detail: { tabName } }));
        });
    });

    // Свайпы по вкладкам
    let touchStartX = 0;
    let touchEndX = 0;
    const minSwipeDistance = 50;

    container.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const distance = touchEndX - touchStartX;
        if (Math.abs(distance) < minSwipeDistance) return;

        const currentTab = container.querySelector('.tab.active');
        if (!currentTab) return;
        
        const tabName = currentTab.getAttribute('data-tab');
        const tabList = ['inbox', 'today', 'upcoming', 'someday']; // Порядок табов
        const currentIndex = tabList.indexOf(tabName);

        if (distance < 0) {
            // Свайп влево -> следующий таб
            const nextIndex = (currentIndex + 1) % tabList.length;
            const nextTabEl = container.querySelector(`.tab[data-tab="${tabList[nextIndex]}"]`);
            if (nextTabEl) nextTabEl.click();
        } else {
            // Свайп вправо -> предыдущий таб
            const prevIndex = (currentIndex - 1 + tabList.length) % tabList.length;
            const prevTabEl = container.querySelector(`.tab[data-tab="${tabList[prevIndex]}"]`);
            if (prevTabEl) prevTabEl.click();
        }
    }
}

// Инициализация табов после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    setupTabs('#view-tasks');
    setupTabs('#view-archive');
});

/* =========================================
   12. TASK MODAL & EDITOR LOGIC
   ========================================= */

let editingTask = null;
let currentSubtasks = [];
let currentTags = [];

function openTaskModal(task = null, defaults = {}) {
    editingTask = task;
    currentSubtasks = task ? clone(task.subtasks || []) : [];
    currentTags = task ? clone(task.tags || []) : [];

    document.getElementById('task-modal-title').textContent = task ? 'Редактировать задачу' : 'Новая задача';
    document.getElementById('task-title').value = task?.title || '';
    document.getElementById('task-desc').value = task?.description || '';
    document.getElementById('task-date').value = task?.dueDate || defaults.dueDate || '';
    document.getElementById('task-start-time').value = task?.startTime || '';
    document.getElementById('task-end-time').value = task?.endTime || '';
    document.getElementById('task-repeat').value = task?.repeat || 'none';

    // Priority buttons state
    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.priority === (task?.priority || 'medium'));
    });

    // Populate project select
    populateProjectSelect('task-project', task?.projectId);

    // Render dynamic lists
    renderSubtasks();
    renderTaskTags();

    // Show/hide delete button
    const deleteBtn = document.getElementById('task-delete-btn');
    deleteBtn.classList.toggle('hidden', !task);

    openModal('task-modal');
}

function renderSubtasks() {
    const container = document.getElementById('task-subtasks');
    if (!container) return;
    
    container.innerHTML = currentSubtasks.map((s, i) => `
        <div class="subtask-item" data-index="${i}">
            <div class="subtask-check ${s.completed ? 'checked' : ''}" data-action="subcheck" data-index="${i}"></div>
            <span class="subtask-title ${s.completed ? 'completed' : ''}">${sanitizeHTML(s.title)}</span>
            <span class="subtask-delete" data-action="subdelete" data-index="${i}">✕</span>
        </div>
    `).join('');

    // Bind subtask events
    container.querySelectorAll('[data-action="subcheck"]').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.index);
            currentSubtasks[idx].completed = !currentSubtasks[idx].completed;
            renderSubtasks();
        });
    });
    container.querySelectorAll('[data-action="subdelete"]').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.index);
            currentSubtasks.splice(idx, 1);
            renderSubtasks();
        });
    });
}

function renderTaskTags() {
    const container = document.getElementById('task-tags');
    if (!container) return;

    container.innerHTML = currentTags.map((tag, i) => `
        <span class="tag">${sanitizeHTML(tag)}<span class="tag-remove" data-index="${i}">✕</span></span>
    `).join('');

    container.querySelectorAll('.tag-remove').forEach(el => {
        el.addEventListener('click', () => {
            currentTags.splice(parseInt(el.dataset.index), 1);
            renderTaskTags();
        });
    });
}

// Add Subtask
document.getElementById('subtask-add-btn')?.addEventListener('click', () => {
    const input = document.getElementById('subtask-input');
    const title = input.value.trim();
    if (!title) return;
    currentSubtasks.push({ id: uuid(), title, completed: false });
    input.value = '';
    renderSubtasks();
    input.focus();
});

// Add Tag
document.getElementById('tag-add-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('tag-input');
    const name = input.value.trim();
    if (!name || currentTags.includes(name)) return;

    currentTags.push(name);
    input.value = '';
    renderTaskTags();

    // Save to global tags store if new
    const allTags = await dbGetAll('tags');
    if (!allTags.find(t => t.name.toLowerCase() === name.toLowerCase())) {
        await dbAdd('tags', {
            id: uuid(),
            name,
            color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
            usageCount: 1
        });
    }
});

// Save Task
document.getElementById('task-save-btn')?.addEventListener('click', async () => {
    const title = document.getElementById('task-title').value.trim();
    if (!title) {
        showToast('Введите название задачи', 'error');
        return;
    }

    const priorityBtn = document.querySelector('.priority-btn.active');
    const now = new Date().toISOString();

    const taskData = {
        id: editingTask?.id || uuid(),
        title,
        description: document.getElementById('task-desc').value.trim(),
        projectId: document.getElementById('task-project').value || null,
        priority: priorityBtn?.dataset.priority || 'medium',
        dueDate: document.getElementById('task-date').value || null,
        startTime: document.getElementById('task-start-time').value || null,
        endTime: document.getElementById('task-end-time').value || null,
        repeat: document.getElementById('task-repeat').value,
        repeatConfig: null,
        subtasks: currentSubtasks,
        tags: currentTags,
        status: editingTask?.status || 'active',
        createdAt: editingTask?.createdAt || now,
        completedAt: editingTask?.status === 'completed' ? editingTask.completedAt : null,
        updatedAt: now
    };

    await dbPut('tasks', taskData);
    closeModal('task-modal');
    showToast(editingTask ? 'Задача обновлена' : 'Задача создана', 'success');
    renderCurrentView();
});

// Delete Task
document.getElementById('task-delete-btn')?.addEventListener('click', () => {
    if (!editingTask) return;
    showConfirm('Удалить задачу? Она будет перемещена в корзину.', async () => {
        editingTask.status = 'deleted';
        editingTask.updatedAt = new Date().toISOString();
        await dbPut('tasks', editingTask);
        closeModal('task-modal');
        showToast('Задача удалена', 'info');
        renderCurrentView();
    });
});

/* =========================================
   13. NOTE MODAL & RICH EDITOR
   ========================================= */

let editingNote = null;
let currentNoteTags = [];

function openNoteModal(note = null) {
    editingNote = note;
    currentNoteTags = note ? clone(note.tags || []) : [];

    document.getElementById('note-modal-title').textContent = note ? 'Редактировать заметку' : 'Новая заметка';
    document.getElementById('note-title').value = note?.title || '';
    document.getElementById('note-editor').innerHTML = note?.content || '';

    // Pin/Fav states
    document.getElementById('note-pin-btn').classList.toggle('active', note?.isPinned);
    document.getElementById('note-fav-btn').classList.toggle('active', note?.isFavorite);

    populateProjectSelect('note-project', note?.projectId);
    renderNoteTags();

    document.getElementById('note-delete-btn').classList.toggle('hidden', !note);
    openModal('note-modal');
}

function renderNoteTags() {
    const container = document.getElementById('note-tags');
    if (!container) return;

    container.innerHTML = currentNoteTags.map((tag, i) => `
        <span class="tag">${sanitizeHTML(tag)}<span class="tag-remove" data-index="${i}">✕</span></span>
    `).join('');

    container.querySelectorAll('.tag-remove').forEach(el => {
        el.addEventListener('click', () => {
            currentNoteTags.splice(parseInt(el.dataset.index), 1);
            renderNoteTags();
        });
    });
}

// Note Tag Add
document.getElementById('note-tag-add-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('note-tag-input');
    const name = input.value.trim();
    if (!name || currentNoteTags.includes(name)) return;

    currentNoteTags.push(name);
    input.value = '';
    renderNoteTags();

    const allTags = await dbGetAll('tags');
    if (!allTags.find(t => t.name.toLowerCase() === name.toLowerCase())) {
        await dbAdd('tags', {
            id: uuid(), name,
            color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
            usageCount: 1
        });
    }
});

// Pin/Fav Toggles
document.getElementById('note-pin-btn')?.addEventListener('click', function() { this.classList.toggle('active'); });
document.getElementById('note-fav-btn')?.addEventListener('click', function() { this.classList.toggle('active'); });

// Rich Text Editor Commands (Modern wrapper)
function applyEditorCommand(command, value = null) {
    const editor = document.getElementById('note-editor');
    editor.focus();
    
    // Using execCommand for reliability in vanilla JS, wrapped safely
    // Modern browsers still support this for contentEditable
    try {
        document.execCommand(command, false, value);
    } catch (e) {
        console.warn('Editor command failed:', e);
    }
}

// Toolbar bindings
document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        switch(cmd) {
            case 'h1': applyEditorCommand('formatBlock', '<h1>'); break;
            case 'h2': applyEditorCommand('formatBlock', '<h2>'); break;
            case 'bold': applyEditorCommand('bold'); break;
            case 'italic': applyEditorCommand('italic'); break;
            case 'strike': applyEditorCommand('strikeThrough'); break;
            case 'ul': applyEditorCommand('insertUnorderedList'); break;
            case 'ol': applyEditorCommand('insertOrderedList'); break;
            case 'check': applyEditorCommand('insertHTML', '<div><input type="checkbox"> <span>Задача</span></div><br>'); break;
            case 'quote': applyEditorCommand('formatBlock', '<blockquote>'); break;
            case 'hr': applyEditorCommand('insertHorizontalRule'); break;
        }
    });
});

// Save Note
document.getElementById('note-save-btn')?.addEventListener('click', async () => {
    const title = document.getElementById('note-title').value.trim();
    if (!title) {
        showToast('Введите заголовок заметки', 'error');
        return;
    }

    const now = new Date().toISOString();
    const noteData = {
        id: editingNote?.id || uuid(),
        title,
        content: document.getElementById('note-editor').innerHTML,
        projectId: document.getElementById('note-project').value || null,
        tags: currentNoteTags,
        isPinned: document.getElementById('note-pin-btn').classList.contains('active'),
        isFavorite: document.getElementById('note-fav-btn').classList.contains('active'),
        createdAt: editingNote?.createdAt || now,
        updatedAt: now
    };

    await dbPut('notes', noteData);
    closeModal('note-modal');
    showToast(editingNote ? 'Заметка обновлена' : 'Заметка создана', 'success');
    renderCurrentView();
});

// Delete Note
document.getElementById('note-delete-btn')?.addEventListener('click', () => {
    if (!editingNote) return;
    showConfirm('Удалить заметку?', async () => {
        await dbDelete('notes', editingNote.id);
        closeModal('note-modal');
        showToast('Заметка удалена', 'info');
        renderCurrentView();
    });
});

/* =========================================
   14. PROJECT MODAL & EDITOR
   ========================================= */

let editingProject = null;

function openProjectModal(project = null) {
    editingProject = project;
    document.getElementById('project-modal-title').textContent = project ? 'Редактировать проект' : 'Новый проект';
    document.getElementById('project-name').value = project?.name || '';
    document.getElementById('project-desc').value = project?.description || '';
    document.getElementById('project-icon').value = project?.icon || '';

    // Color selection state
    document.querySelectorAll('.color-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === (project?.color || '#667eea'));
    });

    document.getElementById('project-delete-btn').classList.toggle('hidden', !project);
    openModal('project-modal');
}

// Color selection
document.querySelectorAll('.color-option').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Save Project
document.getElementById('project-save-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('project-name').value.trim();
    if (!name) {
        showToast('Введите название проекта', 'error');
        return;
    }

    const colorBtn = document.querySelector('.color-option.active');
    const now = new Date().toISOString();

    const projectData = {
        id: editingProject?.id || uuid(),
        name,
        description: document.getElementById('project-desc').value.trim(),
        color: colorBtn?.dataset.color || '#667eea',
        icon: document.getElementById('project-icon').value.trim() || '📁',
        isArchived: editingProject?.isArchived || false,
        createdAt: editingProject?.createdAt || now,
        updatedAt: now
    };

    await dbPut('projects', projectData);
    closeModal('project-modal');
    showToast(editingProject ? 'Проект обновлён' : 'Проект создан', 'success');
    renderCurrentView();
});

// Delete Project
document.getElementById('project-delete-btn')?.addEventListener('click', () => {
    if (!editingProject) return;
    showConfirm('Удалить проект? Задачи останутся без привязки.', async () => {
        // Unlink tasks
        const tasks = await dbGetAll('tasks');
        for (const t of tasks.filter(t => t.projectId === editingProject.id)) {
            t.projectId = null;
            t.updatedAt = new Date().toISOString();
            await dbPut('tasks', t);
        }
        await dbDelete('projects', editingProject.id);
        closeModal('project-modal');
        showToast('Проект удалён', 'info');
        renderCurrentView();
    });
});

/* =========================================
   15. TASK LIST RENDERING & TABS
   ========================================= */

// Вспомогательная функция для получения "сегодняшней" даты в формате YYYY-MM-DD (БЕЗ UTC сдвигов)
function getLocalTodayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function renderTasks() {
    const tasks = await dbGetAll('tasks');
    const projects = await dbGetAll('projects');
    const todayStr = getLocalTodayISO();

    // 1. ALL (Все задачи)
    const allTasks = tasks.filter(t => t.status === 'active');
    // Сортировка: Просроченные -> Сегодня -> Будущие -> Без даты
    allTasks.sort((a, b) => {
        const aOverdue = a.dueDate && a.dueDate < todayStr;
        const bOverdue = b.dueDate && b.dueDate < todayStr;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return 0;
    });
    renderTaskList('tab-all', allTasks, projects);

    // 2. TODAY (Сегодня)
    const todayTasks = tasks.filter(t => t.status === 'active' && t.dueDate === todayStr);
    renderTaskList('tab-today', todayTasks, projects);

    // 3. UPCOMING (Предстоящие - ближайшие N дней)
    const daysToShow = parseInt(await getSetting('upcomingDays', '7')) || 7;
    const upcomingTasks = tasks.filter(t => {
        if (!t.dueDate || t.status !== 'active') return false;
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() + daysToShow);
        const limitStr = getLocalTodayISO(limitDate); // Helper needed or simple logic
        // Простая логика сравнения строк YYYY-MM-DD работает корректно
        const limitDateStr = `${limitDate.getFullYear()}-${String(limitDate.getMonth()+1).padStart(2,'0')}-${String(limitDate.getDate()).padStart(2,'0')}`;
        return t.dueDate > todayStr && t.dueDate <= limitDateStr;
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    renderTaskList('tab-upcoming', upcomingTasks, projects);

    // 4. SOMEDAY (Когда-нибудь / Без даты)
    const somedayTasks = tasks.filter(t => t.status === 'active' && !t.dueDate);
    renderTaskList('tab-someday', somedayTasks, projects);
}

function renderTaskList(containerId, tasks, projects) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const emptyState = container.parentElement.querySelector('.empty-state');
    
    if (tasks.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        container.innerHTML = tasks.map(t => renderTaskItem(t, projects)).join('');
        
        // Attach listeners for new items
        attachTaskInteraction(container);
    }
}

/* =========================================
   16. INLINE SUBTASKS (EXPAND ON TAP)
   ========================================= */

async function toggleSubtasks(taskId) {
    const subContainer = document.getElementById(`sub-list-${taskId}`);
    if (!subContainer) return;

    // Если уже открыт - сворачиваем
    if (subContainer.classList.contains('expanded')) {
        subContainer.classList.remove('expanded');
        subContainer.innerHTML = '';
        return;
    }

    // Загружаем задачу заново, чтобы получить свежие подзадачи
    const task = await dbGet('tasks', taskId);
    if (!task || !task.subtasks || task.subtasks.length === 0) return;

    subContainer.classList.add('expanded');
    subContainer.innerHTML = task.subtasks.map((sub, index) => `
        <div class="subtask-item" data-task-id="${taskId}" data-sub-index="${index}">
            <div class="subtask-check ${sub.completed ? 'checked' : ''}"></div>
            <span class="subtask-title ${sub.completed ? 'completed' : ''}">${sanitizeHTML(sub.title)}</span>
        </div>
    `).join('');

    // Привязываем события к новым подзадачам
    subContainer.querySelectorAll('.subtask-check').forEach(el => {
        el.addEventListener('click', async (e) => {
            e.stopPropagation(); // Не открывать/закрывать список заново
            const subIdx = parseInt(el.parentElement.dataset.subIndex);
            const taskId = el.parentElement.dataset.taskId;
            
            // Оптимизация: не перезагружаем всю задачу, а сразу обновляем
            const task = await dbGet('tasks', taskId);
            if (task && task.subtasks[subIdx]) {
                task.subtasks[subIdx].completed = !task.subtasks[subIdx].completed;
                task.updatedAt = new Date().toISOString();
                await dbPut('tasks', task);
                
                // Обновляем только UI подзадачи (быстро)
                const titleEl = el.nextElementSibling;
                el.classList.toggle('checked');
                titleEl.classList.toggle('completed');
                
                // Обновляем счетчик на родительской карточке
                updateSubtaskCounter(taskId, task.subtasks);
            }
        });
    });
}

function updateSubtaskCounter(taskId, subtasks) {
    const counterEl = document.querySelector(`.subtask-counter[data-id="${taskId}"]`);
    if (counterEl) {
        const done = subtasks.filter(s => s.completed).length;
        counterEl.textContent = `${done}/${subtasks.length}`;
    }
}

/* =========================================
   17. TASK INTERACTIONS (SWIPE & TOGGLE)
   ========================================= */

function attachTaskInteraction(container) {
    // 1. Toggle Complete (Checkbox click)
    container.querySelectorAll('.task-checkbox').forEach(el => {
        el.addEventListener('click', async (e) => {
            e.stopPropagation();
            const taskId = el.closest('.task-item').dataset.id;
            const task = await dbGet('tasks', taskId);
            if (!task) return;

            if (task.status === 'completed') {
                task.status = 'active';
                task.completedAt = null;
            } else {
                task.status = 'completed';
                task.completedAt = new Date().toISOString();
                // Handle Repeat
                if (task.repeat && task.repeat !== 'none') {
                    createRepeatedTask(task);
                }
            }
            task.updatedAt = new Date().toISOString();
            await dbPut('tasks', task);
            
            // Refresh views
            renderCurrentView();
        });
    });

    // 2. Open Edit Modal (Item Click)
    container.querySelectorAll('.task-item').forEach(el => {
        el.addEventListener('click', async (e) => {
            // Игнорируем клики по чекбоксам и подзадачам
            if (e.target.closest('.task-checkbox') || e.target.closest('.subtask-item')) return;
            
            const taskId = el.dataset.id;
            const task = await dbGet('tasks', taskId);
            if (task) openTaskModal(task);
        });
    });

    // 3. Toggle Subtasks List (Counter Click)
    container.querySelectorAll('.subtask-counter').forEach(el => {
        el.addEventListener('click', async (e) => {
            e.stopPropagation();
            const taskId = el.dataset.id;
            await toggleSubtasks(taskId);
        });
    });

    // 4. Swipe Gestures
    let startX = 0;
    let currentX = 0;
    let isSwiping = false;

    container.querySelectorAll('.task-item').forEach(item => {
        item.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            currentX = startX;
            isSwiping = true;
            item.classList.add('swiping');
        }, { passive: true });

        item.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            currentX = e.touches[0].clientX;
            const diff = currentX - startX;
            
            // Ограничиваем сдвиг
            const limitedDiff = Math.max(-150, Math.min(150, diff));
            item.style.transform = `translateX(${limitedDiff}px)`;

            if (diff > 50) {
                item.classList.add('swiping-right');
                item.classList.remove('swiping-left');
            } else if (diff < -50) {
                item.classList.add('swiping-left');
                item.classList.remove('swiping-right');
            } else {
                item.classList.remove('swiping-right', 'swiping-left');
            }
        }, { passive: true });

        item.addEventListener('touchend', async () => {
            if (!isSwiping) return;
            isSwiping = false;
            item.classList.remove('swiping');
            
            const diff = currentX - startX;
            const taskId = item.dataset.id;

            // Сброс трансформации
            item.style.transform = '';
            item.classList.remove('swiping-right', 'swiping-left');

            if (diff > 100) {
                // Swipe Right -> Complete
                const task = await dbGet('tasks', taskId);
                if (task && task.status !== 'completed') {
                    task.status = 'completed';
                    task.completedAt = new Date().toISOString();
                    if (task.repeat && task.repeat !== 'none') createRepeatedTask(task);
                    task.updatedAt = new Date().toISOString();
                    await dbPut('tasks', task);
                    showToast('Задача выполнена!', 'success');
                    renderCurrentView();
                }
            } else if (diff < -100) {
                // Swipe Left -> Delete (Move to Trash)
                const task = await dbGet('tasks', taskId);
                if (task) {
                    task.status = 'deleted';
                    task.updatedAt = new Date().toISOString();
                    await dbPut('tasks', task);
                    showToast('Задача удалена', 'info');
                    renderCurrentView();
                }
            }
        });
    });
}

/* =========================================
   18. NOTES RENDERING & SEARCH
   ========================================= */

async function renderNotes() {
    const notes = await dbGetAll('notes');
    const searchInput = document.getElementById('notes-search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let filtered = notes;
    if (query) {
        filtered = notes.filter(n => 
            (n.title || '').toLowerCase().includes(query) ||
            (n.content || '').toLowerCase().includes(query) ||
            (n.tags || []).some(t => t.toLowerCase().includes(query))
        );
    }

    // Sort: Pinned first, then by updated
    filtered.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    const container = document.getElementById('notes-grid');
    const empty = document.getElementById('notes-empty');

    if (filtered.length === 0) {
        container.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
    } else {
        if (empty) empty.classList.add('hidden');
        container.innerHTML = filtered.map(n => renderNoteCard(n)).join('');
        
        // Click listeners
        container.querySelectorAll('.note-card').forEach(el => {
            el.addEventListener('click', async () => {
                const note = await dbGet('notes', el.dataset.id);
                if (note) openNoteModal(note);
            });
        });
    }
}

// Search debounce for Notes view
const notesSearchInput = document.getElementById('notes-search-input');
if (notesSearchInput) {
    notesSearchInput.addEventListener('input', debounce(() => renderNotes(), 300));
}

/* =========================================
   19. PROJECTS RENDERING
   ========================================= */

async function renderProjects() {
    const projects = await dbGetAll('projects');
    const tasks = await dbGetAll('tasks');

    const active = projects.filter(p => !p.isArchived);
    const archived = projects.filter(p => p.isArchived);

    const container = document.getElementById('projects-list');
    const empty = document.getElementById('projects-empty');

    if (active.length === 0 && archived.length === 0) {
        container.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');

    let html = active.map(p => renderProjectCard(p, tasks)).join('');
    
    if (archived.length > 0) {
        html += `<div style="margin-top: 24px; margin-bottom: 12px; font-size: 14px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Архив</div>`;
        html += archived.map(p => renderProjectCard(p, tasks)).join('');
    }

    container.innerHTML = html;

    // Listeners
    container.querySelectorAll('.project-card').forEach(el => {
        el.addEventListener('click', async () => {
            const project = await dbGet('projects', el.dataset.id);
            if (project) openProjectModal(project);
        });
    });
}

/* =========================================
   20. ARCHIVE RENDERING
   ========================================= */

async function renderArchive() {
    const tasks = await dbGetAll('tasks');
    const projects = await dbGetAll('projects');

    const completed = tasks.filter(t => t.status === 'completed');
    const trash = tasks.filter(t => t.status === 'deleted');

    // Completed Tab
    const compContainer = document.getElementById('tab-completed');
    const compEmpty = compContainer?.querySelector('.empty-state');
    if (compContainer) {
        const listDiv = compContainer.querySelector('.task-list') || compContainer;
        // Если структура отличается, нужно найти правильный контейнер
        const target = document.getElementById('completed-tasks') || listDiv;
        
        if (completed.length === 0) {
            target.innerHTML = '';
            if (compEmpty) compEmpty.classList.remove('hidden');
        } else {
            if (compEmpty) compEmpty.classList.add('hidden');
            target.innerHTML = completed.map(t => renderTaskItem(t, projects)).join('');
            // В архиве нет свайпов, только клик для просмотра
            target.querySelectorAll('.task-item').forEach(el => {
                el.addEventListener('click', async () => {
                    const task = await dbGet('tasks', el.dataset.id);
                    if (task) openTaskModal(task);
                });
            });
        }
    }

    // Trash Tab
    const trashContainer = document.getElementById('tab-trash');
    const trashEmpty = trashContainer?.querySelector('.empty-state');
    if (trashContainer) {
        const target = document.getElementById('trash-tasks') || trashContainer;
        
        if (trash.length === 0) {
            target.innerHTML = '';
            if (trashEmpty) trashEmpty.classList.remove('hidden');
        } else {
            if (trashEmpty) trashEmpty.classList.add('hidden');
            target.innerHTML = trash.map(t => renderTaskItem(t, projects)).join('');
            // В корзине можно восстановить
            target.querySelectorAll('.task-item').forEach(el => {
                el.addEventListener('click', async () => {
                    showConfirm('Восстановить задачу?', async () => {
                        const task = await dbGet('tasks', el.dataset.id);
                        if (task) {
                            task.status = 'active';
                            task.updatedAt = new Date().toISOString();
                            await dbPut('tasks', task);
                            renderArchive();
                            showToast('Задача восстановлена', 'success');
                        }
                    });
                });
            });
        }
    }
}

// Clear Trash Button
const clearTrashBtn = document.getElementById('clear-trash-btn');
if (clearTrashBtn) {
    clearTrashBtn.addEventListener('click', () => {
        showConfirm('Удалить ВСЕ задачи из корзины навсегда?', async () => {
            const tasks = await dbGetAll('tasks');
            for (const t of tasks.filter(t => t.status === 'deleted')) {
                await dbDelete('tasks', t.id);
            }
            renderArchive();
            showToast('Корзина очищена', 'success');
        });
    });
}

/* =========================================
   21. CALENDAR RENDERING & DAY SHEET
   ========================================= */

// Вспомогательная функция: Local ISO Date (БЕЗ UTC сдвигов, исправляет баг "заметка на 13 мая отображается 14-го")
function getLocalDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

let calCurrentDate = new Date();

async function renderCalendar() {
    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();
    
    document.getElementById('cal-month-year').textContent = getMonthName(year, month);

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = (firstDay.getDay() + 6) % 7; // Monday start (0=Mon, 6=Sun)

    const tasks = await dbGetAll('tasks');
    const grid = document.getElementById('calendar-grid');
    let html = '';

    // Day headers
    const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    dayNames.forEach(d => html += `<div class="cal-day-header">${d}</div>`);

    // Padding days
    for (let i = 0; i < startPadding; i++) {
        html += `<div class="cal-day other-month"></div>`;
    }

    // Calendar days
    const todayLocal = getLocalDateISO(new Date());
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const currentDate = new Date(year, month, day);
        const dateStr = getLocalDateISO(currentDate);
        const isToday = dateStr === todayLocal;
        
        // Filter tasks for this exact local date
        const dayTasks = tasks.filter(t => t.dueDate === dateStr && t.status === 'active');
        
        const dots = dayTasks.slice(0, 3).map(t => {
            const colors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
            return `<span class="cal-dot" style="background:${colors[t.priority] || colors.medium}"></span>`;
        }).join('');

        html += `
        <div class="cal-day ${isToday ? 'today' : ''} ${dayTasks.length ? 'has-tasks' : ''}" data-date="${dateStr}">
            <span>${day}</span>
            ${dots ? `<div class="cal-day-dots">${dots}</div>` : ''}
        </div>
        `;
    }

    grid.innerHTML = html;

    // Attach click handlers for days
    grid.querySelectorAll('.cal-day[data-date]').forEach(day => {
        day.addEventListener('click', () => openDaySheet(day.dataset.date));
    });
}

// Navigation buttons
document.getElementById('cal-prev')?.addEventListener('click', () => {
    calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
    renderCalendar();
});

document.getElementById('cal-next')?.addEventListener('click', () => {
    calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
    renderCalendar();
});

document.getElementById('cal-today')?.addEventListener('click', () => {
    calCurrentDate = new Date();
    renderCalendar();
});

// Day Bottom Sheet
async function openDaySheet(date) {
    const tasks = await dbGetAll('tasks');
    const projects = await dbGetAll('projects');
    
    // Filter tasks for selected date
    const dayTasks = tasks.filter(t => t.dueDate === date && t.status === 'active');

    document.getElementById('day-sheet-title').textContent = formatDate(new Date(date));
    const container = document.getElementById('day-sheet-tasks');
    const empty = document.getElementById('day-sheet-empty');

    if (dayTasks.length === 0) {
        container.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
    } else {
        if (empty) empty.classList.add('hidden');
        container.innerHTML = dayTasks.map(t => renderTaskItem(t, projects)).join('');
        // Attach listeners for tasks inside sheet
        attachTaskInteraction(container);
    }

    // Quick add button
    document.getElementById('day-sheet-add-btn').onclick = () => {
        closeModal('day-sheet');
        openTaskModal(null, { dueDate: date });
    };

    openModal('day-sheet');
}

/* =========================================
   22. STATISTICS & CHARTS
   ========================================= */

async function renderStats() {
    const tasks = await dbGetAll('tasks');
    const projects = await dbGetAll('projects');
    const todayLocal = getLocalDateISO(new Date());
    
    // --- Counters ---
    const todayCompleted = tasks.filter(t => t.status === 'completed' && t.completedAt?.startsWith(todayLocal)).length;
    
    // Week calculation (Monday start)
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; 
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek - 1));
    weekStart.setHours(0,0,0,0);
    const weekStartStr = getLocalDateISO(weekStart);
    
    const weekCompleted = tasks.filter(t => t.status === 'completed' && t.completedAt?.startsWith(weekStartStr) || t.completedAt?.substring(0,10) >= weekStartStr).length;
    
    // Month calculation
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const monthCompleted = tasks.filter(t => t.status === 'completed' && t.completedAt?.substring(0,10) >= monthStartStr).length;
    
    const totalActive = tasks.filter(t => t.status === 'active').length;

    // Update DOM
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    setVal('stat-completed-today', todayCompleted);
    setVal('stat-completed-week', weekCompleted);
    setVal('stat-completed-month', monthCompleted);
    setVal('stat-total-active', totalActive);

    // --- Heatmap (Last 30 Days) ---
    const heatmapEl = document.getElementById('stats-heatmap');
    if (heatmapEl) {
        const heatmapData = {};
        const days = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = getLocalDateISO(d);
            days.push(dateStr);
            heatmapData[dateStr] = tasks.filter(t => t.status === 'completed' && t.completedAt?.startsWith(dateStr)).length;
        }
        
        const maxCount = Math.max(...Object.values(heatmapData), 1);
        
        heatmapEl.innerHTML = days.map(date => {
            const count = heatmapData[date];
            const level = Math.min(4, Math.floor((count / (maxCount || 1)) * 4));
            return `<div class="heatmap-cell l${level}" title="${formatDate(new Date(date))}: ${count} задач"></div>`;
        }).join('');
    }

    // --- Projects Chart ---
    const projectsChartEl = document.getElementById('stats-projects-chart');
    if (projectsChartEl) {
        const projectStats = projects.filter(p => !p.isArchived).map(p => {
            const pTasks = tasks.filter(t => t.projectId === p.id && t.status !== 'deleted');
            const completed = pTasks.filter(t => t.status === 'completed').length;
            return { ...p, total: pTasks.length, completed };
        }).filter(p => p.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

        const maxProject = Math.max(...projectStats.map(p => p.total), 1);
        
        projectsChartEl.innerHTML = projectStats.length > 0 ? projectStats.map(p => `
            <div class="chart-bar">
                <div class="chart-bar-label">${p.icon} ${sanitizeHTML(p.name)}</div>
                <div class="chart-bar-track">
                    <div class="chart-bar-fill project" style="width:${(p.completed / maxProject) * 100}%">
                        <span class="chart-bar-value">${p.completed}/${p.total}</span>
                    </div>
                </div>
            </div>
        `).join('') : '<p style="text-align:center;color:var(--text-tertiary);">Нет данных для графика</p>';
    }

    // --- Priority Chart ---
    const priorityChartEl = document.getElementById('stats-priority-chart');
    if (priorityChartEl) {
        const priorities = ['high', 'medium', 'low'];
        const priorityNames = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
        const priorityColors = { high: 'var(--prio-high)', medium: 'var(--prio-medium)', low: 'var(--prio-low)' };
        
        const priorityStats = priorities.map(p => ({
            priority: p,
            count: tasks.filter(t => t.priority === p && t.status === 'active').length
        })).filter(p => p.count > 0);

        const maxPriority = Math.max(...priorityStats.map(p => p.count), 1);

        priorityChartEl.innerHTML = priorityStats.length > 0 ? priorityStats.map(p => `
            <div class="chart-bar">
                <div class="chart-bar-label">${priorityNames[p.priority]}</div>
                <div class="chart-bar-track">
                    <div class="chart-bar-fill ${p.priority}" style="width:${(p.count / maxPriority) * 100}%;background:${priorityColors[p.priority]}">
                        <span class="chart-bar-value">${p.count}</span>
                    </div>
                </div>
            </div>
        `).join('') : '<p style="text-align:center;color:var(--text-tertiary);">Нет активных задач</p>';
    }
}

/* =========================================
   23. GLOBAL SEARCH
   ========================================= */

let searchHistory = [];

async function loadSearchHistory() {
    const saved = await getSetting('searchHistory');
    searchHistory = saved || [];
    renderSearchHistory();
}

function renderSearchHistory() {
    const container = document.getElementById('search-history-list');
    if (!container) return;
    
    if (searchHistory.length === 0) {
        container.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;text-align:center;padding:20px;">История поиска пуста</p>';
        return;
    }
    container.innerHTML = searchHistory.map((q, i) => `
        <div class="search-history-item" data-query="${sanitizeHTML(q)}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 111.13-9.36L1 10"/></svg>
            <span>${sanitizeHTML(q)}</span>
        </div>
    `).join('');

    container.querySelectorAll('.search-history-item').forEach(item => {
        item.addEventListener('click', () => {
            document.getElementById('search-input').value = item.dataset.query;
            performSearch();
        });
    });
}

async function performSearch() {
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    const historyEl = document.getElementById('search-history');
    const resultsEl = document.getElementById('search-results');

    if (!query) {
        if (historyEl) historyEl.classList.remove('hidden');
        if (resultsEl) resultsEl.innerHTML = '';
        return;
    }

    if (historyEl) historyEl.classList.add('hidden');

    // Save to history
    if (!searchHistory.includes(query)) {
        searchHistory.unshift(query);
        if (searchHistory.length > 10) searchHistory.pop();
        await setSetting('searchHistory', searchHistory);
        renderSearchHistory();
    }

    const filterTasks = document.getElementById('filter-tasks')?.checked !== false;
    const filterNotes = document.getElementById('filter-notes')?.checked !== false;
    const filterProjects = document.getElementById('filter-projects')?.checked !== false;

    const results = [];

    if (filterTasks) {
        const tasks = await dbGetAll('tasks');
        const matched = tasks.filter(t => t.status !== 'deleted' && (
            t.title.toLowerCase().includes(query) ||
            (t.description || '').toLowerCase().includes(query) ||
            (t.tags || []).some(tag => tag.toLowerCase().includes(query))
        ));
        if (matched.length) results.push({ type: 'tasks', items: matched });
    }

    if (filterNotes) {
        const notes = await dbGetAll('notes');
        const matched = notes.filter(n => 
            (n.title || '').toLowerCase().includes(query) ||
            (n.content || '').toLowerCase().includes(query) ||
            (n.tags || []).some(tag => tag.toLowerCase().includes(query))
        );
        if (matched.length) results.push({ type: 'notes', items: matched });
    }

    if (filterProjects) {
        const projects = await dbGetAll('projects');
        const matched = projects.filter(p => !p.isArchived && (
            p.name.toLowerCase().includes(query) ||
            (p.description || '').toLowerCase().includes(query)
        ));
        if (matched.length) results.push({ type: 'projects', items: matched });
    }

    renderSearchResults(results, query);
}

function renderSearchResults(results, query) {
    const container = document.getElementById('search-results');
    if (!container) return;
    
    if (results.length === 0) {
        container.innerHTML = `
            <div class="search-no-results">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <p>Ничего не найдено по запросу "${sanitizeHTML(query)}"</p>
            </div>
        `;
        return;
    }

    const typeNames = { tasks: 'Задачи', notes: 'Заметки', projects: 'Проекты' };
    const typeIcons = { tasks: '✓', notes: '📝', projects: '📁' };

    container.innerHTML = results.map(group => `
        <div class="search-result-group">
            <div class="search-result-group-title">${typeNames[group.type]}</div>
            ${group.items.map(item => `
                <div class="search-result-item" data-type="${group.type}" data-id="${item.id}">
                    <div class="search-result-icon">${typeIcons[group.type]}</div>
                    <div class="search-result-info">
                        <div class="search-result-title">${sanitizeHTML(item.title || item.name || 'Без названия')}</div>
                        <div class="search-result-subtitle">${
                            group.type === 'tasks' ? (item.dueDate ? formatDate(item.dueDate) : 'Без даты') : 
                            group.type === 'notes' ? formatDate(item.updatedAt) : 
                            sanitizeHTML(item.description || '')
                        }</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');

    // Click handlers
    container.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', async () => {
            const type = item.dataset.type;
            const id = item.dataset.id;
            if (type === 'tasks') {
                const task = await dbGet('tasks', id);
                if (task) openTaskModal(task);
            } else if (type === 'notes') {
                const note = await dbGet('notes', id);
                if (note) openNoteModal(note);
            } else if (type === 'projects') {
                const project = await dbGet('projects', id);
                if (project) openProjectModal(project);
            }
        });
    });
}

// Search Input Events
document.getElementById('search-input')?.addEventListener('input', debounce(() => performSearch(), 300));
document.getElementById('search-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

// Filter Changes
document.querySelectorAll('#view-search input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
        const query = document.getElementById('search-input').value.trim();
        if (query) performSearch();
    });
});

/* =========================================
   24. SETTINGS & DATA MANAGEMENT
   ========================================= */

async function initSettings() {
    // Load Search History
    await loadSearchHistory();

    // Theme
    const theme = await getSetting('theme', 'light');
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.segment[data-theme]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    // Scheme
    const scheme = await getSetting('scheme', 'ocean');
    document.documentElement.setAttribute('data-scheme', scheme);
    document.querySelectorAll('.theme-option[data-scheme]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.scheme === scheme);
    });
    
    // Days setting (for Dashboard & Upcoming)
    const daysVal = await getSetting('dashboardDays', '2');
    const daysInput = document.getElementById('settings-days-input');
    if (daysInput) daysInput.value = daysVal;
}

// Theme Toggle
document.querySelectorAll('.segment[data-theme]').forEach(btn => {
    btn.addEventListener('click', async () => {
        const theme = btn.dataset.theme;
        document.documentElement.setAttribute('data-theme', theme);
        document.querySelectorAll('.segment[data-theme]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        await setSetting('theme', theme);
        showToast('Тема обновлена', 'success');
    });
});

// Scheme Toggle
document.querySelectorAll('.theme-option[data-scheme]').forEach(btn => {
    btn.addEventListener('click', async () => {
        const scheme = btn.dataset.scheme;
        document.documentElement.setAttribute('data-scheme', scheme);
        document.querySelectorAll('.theme-option[data-scheme]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        await setSetting('scheme', scheme);
        showToast('Схема обновлена', 'success');
    });
});

// Days Setting Change
document.getElementById('settings-days-input')?.addEventListener('change', async (e) => {
    let val = parseInt(e.target.value);
    if (val < 2) val = 2;
    if (val > 7) val = 7;
    e.target.value = val;
    await setSetting('dashboardDays', val.toString());
    showToast('Настройка сохранена', 'success');
    renderDashboard();
});

// Export Data
document.getElementById('export-btn')?.addEventListener('click', async () => {
    const data = {
        version: APP_VERSION,
        exportDate: new Date().toISOString(),
        tasks: await dbGetAll('tasks'),
        notes: await dbGetAll('notes'),
        projects: await dbGetAll('projects'),
        tags: await dbGetAll('tags'),
        settings: await dbGetAll('settings')
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planner-backup-${getLocalDateISO(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Данные экспортированы', 'success');
});

// Import Data
document.getElementById('import-btn')?.addEventListener('click', () => {
    document.getElementById('import-file').click();
});

document.getElementById('import-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showConfirm('Импорт данных перезапишет текущие данные. Создать резервную копию перед импортом?', async () => {
        // Backup current
        const data = {
            version: APP_VERSION,
            exportDate: new Date().toISOString(),
            tasks: await dbGetAll('tasks'),
            notes: await dbGetAll('notes'),
            projects: await dbGetAll('projects'),
            tags: await dbGetAll('tags'),
            settings: await dbGetAll('settings')
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `planner-auto-backup-${getLocalDateISO(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        await processImport(file);
    }, () => processImport(file));
});

async function processImport(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.tasks || !data.notes) {
            showToast('Неверный формат файла', 'error');
            return;
        }
        
        // Clear existing
        const stores = ['tasks', 'notes', 'projects', 'tags', 'settings'];
        for (const storeName of stores) {
            const all = await dbGetAll(storeName);
            for (const item of all) {
                await dbDelete(storeName, item.id || item.key);
            }
        }
        
        // Import new
        if (data.tasks) for (const item of data.tasks) await dbAdd('tasks', item);
        if (data.notes) for (const item of data.notes) await dbAdd('notes', item);
        if (data.projects) for (const item of data.projects) await dbAdd('projects', item);
        if (data.tags) for (const item of data.tags) await dbAdd('tags', item);
        if (data.settings) for (const item of data.settings) await dbAdd('settings', item);
        
        showToast('Данные импортированы', 'success');
        await initSettings();
        navigateTo('dashboard');
    } catch (err) {
        console.error(err);
        showToast('Ошибка импорта', 'error');
    }
    document.getElementById('import-file').value = '';
}

// Clear All Data
document.getElementById('clear-data-btn')?.addEventListener('click', () => {
    showConfirm('Вы уверены? Это удалит ВСЕ данные безвозвратно.', async () => {
        // Backup first just in case
        const data = {
            version: APP_VERSION,
            exportDate: new Date().toISOString(),
            tasks: await dbGetAll('tasks'),
            notes: await dbGetAll('notes'),
            projects: await dbGetAll('projects'),
            tags: await dbGetAll('tags')
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `planner-final-backup-${getLocalDateISO(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);

        // Clear
        const stores = ['tasks', 'notes', 'projects', 'tags', 'settings', 'sync_meta'];
        for (const storeName of stores) {
            const all = await dbGetAll(storeName);
            for (const item of all) {
                await dbDelete(storeName, item.id || item.key);
            }
        }
        
        await seedDemoData();
        showToast('Данные очищены', 'info');
        navigateTo('dashboard');
    });
});

/* =========================================
   25. PWA, OFFLINE & INITIALIZATION
   ========================================= */

async function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    try {
        const registration = await navigator.serviceWorker.register('sw.js');
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    const toast = document.getElementById('update-toast');
                    if (toast) toast.classList.remove('hidden');
                }
            });
        });
    } catch (err) {
        console.error('SW registration failed:', err);
    }
}

// Update Button
document.getElementById('update-btn')?.addEventListener('click', () => {
    window.location.reload();
});

// Install Prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('install-banner');
    if (banner) banner.classList.remove('hidden');
});

document.getElementById('install-btn')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        const banner = document.getElementById('install-banner');
        if (banner) banner.classList.add('hidden');
    }
    deferredPrompt = null;
});

document.getElementById('install-dismiss')?.addEventListener('click', () => {
    const banner = document.getElementById('install-banner');
    if (banner) banner.classList.add('hidden');
});

// Online/Offline Indicator
function updateOnlineStatus() {
    const indicator = document.querySelector('.offline-indicator');
    if (!indicator) return;
    
    if (!navigator.onLine) {
        indicator.classList.add('show');
    } else {
        indicator.classList.remove('show');
    }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Before Unload Warning
window.addEventListener('beforeunload', (e) => {
    const modals = document.querySelectorAll('.modal.active');
    if (modals.length > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// ===== Initialization =====
async function init() {
    try {
        const splash = document.getElementById('splash-screen');
        
        // Open DB
        await openDB();
        
        // Seed demo data if empty
        await seedDemoData();
        
        // Init settings (Theme/Scheme)
        await initSettings();
        
        // Register SW
        await registerSW();
        
        // Setup Routes
        const hash = window.location.hash.slice(1);
        if (hash && document.getElementById(`view-${hash}`)) {
            navigateTo(hash);
        } else {
            navigateTo('dashboard');
        }
        
        // Render initial view
        renderDashboard();
        
        // Check notifications
        setTimeout(() => {
            const todayLocal = getLocalDateISO(new Date());
            const tasks = await dbGetAll('tasks');
            const overdue = tasks.filter(t => t.dueDate && t.dueDate < todayLocal && t.status === 'active');
            if (overdue.length > 0) showToast(`Просрочено задач: ${overdue.length}`, 'error', 4000);
            
            const highPriorityToday = tasks.filter(t => t.dueDate === todayLocal && t.priority === 'high' && t.status === 'active');
            if (highPriorityToday.length > 0) showToast(`Важных задач на сегодня: ${highPriorityToday.length}`, 'info', 4000);
        }, 1500);
        
        // Hide splash, show app
        if (splash) splash.classList.add('hidden');
        document.getElementById('app')?.classList.remove('hidden');
        
        console.log(`Planner Pro v${APP_VERSION} initialized`);
    } catch (err) {
        console.error('Init error:', err);
        showToast('Ошибка инициализации', 'error');
        // Force hide splash on error
        document.getElementById('splash-screen')?.classList.add('hidden');
        document.getElementById('app')?.classList.remove('hidden');
    }
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
