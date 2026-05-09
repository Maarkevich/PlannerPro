// Planner Pro — Main Application

const APP_VERSION = '1.0';
const DB_NAME = 'planner_db';
const DB_VERSION = 1;

// ===== Color Schemes =====
const SCHEMES = {
  ocean:   { start: '#667eea', end: '#764ba2', accent: '#4facfe' },
  sunset:  { start: '#fa709a', end: '#fee140', accent: '#ff6b6b' },
  forest:  { start: '#11998e', end: '#38ef7d', accent: '#00d9a5' },
  neon:    { start: '#b721ff', end: '#21d4fd', accent: '#e94560' }
};

const PROJECT_COLORS = ['#667eea','#fa709a','#11998e','#b721ff','#ff6b6b','#feca57','#48dbfb','#1dd1a1'];

// ===== UUID Generator =====
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ===== Date Utils =====
function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const opts = { day: 'numeric', month: 'long' };
  if (date.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString('ru-RU', opts);
}

function formatDateISO(d) {
  const date = new Date(d);
  return date.toISOString().split('T')[0];
}

function isOverdue(d) {
  if (!d) return false;
  const date = new Date(d);
  date.setHours(23,59,59,999);
  return date < new Date();
}

function isToday(d) {
  if (!d) return false;
  const date = new Date(d);
  const now = new Date();
  return date.toDateString() === now.toDateString();
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

// ===== Sanitization =====
function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== Deep Clone =====
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ===== Debounce =====
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ===== Store (Event-based state) =====
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

// ===== IndexedDB =====
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
      
      // Sync Meta
      if (!database.objectStoreNames.contains('sync_meta')) {
        database.createObjectStore('sync_meta', { keyPath: 'key' });
      }
    };
  });
}

// Generic CRUD operations
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

function dbGetByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const idx = store.index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ===== Settings =====
async function getSetting(key, defaultValue = null) {
  const result = await dbGet('settings', key);
  return result ? result.value : defaultValue;
}

async function setSetting(key, value) {
  await dbPut('settings', { key, value });
}

// ===== Demo Data =====
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
    { id: uuid(), title: 'Завершить отчёт', description: 'Подготовить еженедельный отчёт', projectId: projects[0].id, priority: 'high', dueDate: today, startTime: '09:00', endTime: '11:00', repeat: 'none', repeatConfig: null, subtasks: [{id: uuid(), title: 'Собрать данные', completed: true}, {id: uuid(), title: 'Составить графики', completed: false}], tags: ['работа','важно'], status: 'active', createdAt: new Date().toISOString(), completedAt: null, updatedAt: new Date().toISOString() },
    { id: uuid(), title: 'Купить продукты', description: 'Молоко, хлеб, яйца', projectId: projects[1].id, priority: 'medium', dueDate: today, startTime: null, endTime: null, repeat: 'weekly', repeatConfig: null, subtasks: [], tags: ['личное'], status: 'active', createdAt: new Date().toISOString(), completedAt: null, updatedAt: new Date().toISOString() },
    { id: uuid(), title: 'Прочитать главу книги', description: 'Глава 5 по JavaScript', projectId: projects[2].id, priority: 'low', dueDate: addDays(today, 2), startTime: null, endTime: null, repeat: 'none', repeatConfig: null, subtasks: [], tags: ['учёба'], status: 'active', createdAt: new Date().toISOString(), completedAt: null, updatedAt: new Date().toISOString() },
    { id: uuid(), title: 'Позвонить маме', description: '', projectId: null, priority: 'medium', dueDate: null, startTime: null, endTime: null, repeat: 'none', repeatConfig: null, subtasks: [], tags: [], status: 'active', createdAt: new Date().toISOString(), completedAt: null, updatedAt: new Date().toISOString() }
  ];
  
  for (const t of tasks) await dbAdd('tasks', t);
  
  // Notes
  const notes = [
    { id: uuid(), title: 'Идеи для проекта', content: '<h1>Новые идеи</h1><p>1. Добавить тёмную тему</p><p>2. Улучшить производительность</p><ul><li>Оптимизировать рендеринг</li><li>Добавить виртуализацию списков</li></ul>', projectId: projects[0].id, tags: ['идеи'], isPinned: true, isFavorite: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: uuid(), title: 'Рецепт пасты', content: '<p><b>Ингредиенты:</b></p><ul><li>Спагетти 400г</li><li>Помидоры 500г</li><li>Чеснок 3 зубчика</li></ul><p><i>Приготовить соус, сварить пасту...</i></p>', projectId: projects[1].id, tags: ['рецепты'], isPinned: false, isFavorite: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
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

// ===== Toast =====
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  
  toast.innerHTML = `${icons[type]}<span>${sanitizeHTML(message)}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// ===== Confirm Dialog =====
function showConfirm(message, onConfirm, onCancel) {
  const dialog = document.getElementById('confirm-dialog');
  const msgEl = document.getElementById('confirm-message');
  const okBtn = document.getElementById('confirm-ok');
  const cancelBtn = document.getElementById('confirm-cancel');
  
  msgEl.textContent = message;
  dialog.classList.add('active');
  
  const cleanup = () => {
    dialog.classList.remove('active');
    okBtn.onclick = null;
    cancelBtn.onclick = null;
  };
  
  okBtn.onclick = () => { cleanup(); onConfirm?.(); };
  cancelBtn.onclick = () => { cleanup(); onCancel?.(); };
}

// ===== Modal Management =====
let currentModal = null;

function openModal(id) {
  closeAllModals();
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    currentModal = modal;
    document.body.style.overflow = 'hidden';
    
    // Focus first input
    const input = modal.querySelector('input, textarea, [contenteditable]');
    if (input) setTimeout(() => input.focus(), 100);
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
    if (currentModal === modal) {
      currentModal = null;
      document.body.style.overflow = '';
    }
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal.active, .bottom-sheet.active').forEach(m => {
    m.classList.remove('active');
  });
  currentModal = null;
  document.body.style.overflow = '';
}

// Close on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('sheet-overlay')) {
    closeAllModals();
  }
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllModals();
});

// ===== Navigation =====
let currentView = 'dashboard';

function navigateTo(view) {
  // Update hash
  window.location.hash = view;
  
  // Update views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById(`view-${view}`);
  if (targetView) targetView.classList.add('active');
  
  // Update nav items
  document.querySelectorAll('.nav-item, .side-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });
  
  // Update page title
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
  document.getElementById('page-title').textContent = titles[view] || 'Planner Pro';
  
  // Show/hide FAB
  const fab = document.getElementById('fab');
  const showFab = ['dashboard', 'tasks', 'notes', 'projects'].includes(view);
  fab.style.display = showFab ? 'flex' : 'none';
  
  currentView = view;
  
  // Refresh view data
  if (view === 'dashboard') renderDashboard();
  if (view === 'tasks') renderTasks();
  if (view === 'calendar') renderCalendar();
  if (view === 'notes') renderNotes();
  if (view === 'projects') renderProjects();
  if (view === 'stats') renderStats();
  if (view === 'archive') renderArchive();
  
  // Scroll to top
  document.getElementById('main-content').scrollTop = 0;
}

// Hash change handler
window.addEventListener('hashchange', () => {
  const view = window.location.hash.slice(1) || 'dashboard';
  navigateTo(view);
});

// Nav click handlers
document.querySelectorAll('.nav-item, .side-nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const view = item.dataset.view;
    if (view) navigateTo(view);
  });
});

// ===== Dashboard =====
async function renderDashboard() {
  const today = formatDateISO(new Date());
  const tasks = await dbGetAll('tasks');
  const notes = await dbGetAll('notes');
  const projects = await dbGetAll('projects');
  
  // Welcome
  const hour = new Date().getHours();
  let greeting = 'Добрый вечер!';
  if (hour < 12) greeting = 'Доброе утро!';
  else if (hour < 18) greeting = 'Добрый день!';
  document.getElementById('welcome-greeting').textContent = greeting;
  document.getElementById('welcome-date').textContent = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  
  // Progress
  const todayTasks = tasks.filter(t => t.dueDate === today && t.status === 'active');
  const completedToday = todayTasks.filter(t => t.status === 'completed').length;
  const progress = todayTasks.length > 0 ? Math.round((completedToday / todayTasks.length) * 100) : 0;
  document.getElementById('day-progress-value').textContent = `${progress}%`;
  document.getElementById('day-progress-fill').style.width = `${progress}%`;
  
  // Today tasks
  const todayContainer = document.getElementById('dashboard-today-tasks');
  const todayEmpty = document.getElementById('dashboard-today-empty');
  const todayCount = document.getElementById('today-count');
  
  const activeToday = todayTasks.filter(t => t.status === 'active').slice(0, 5);
  todayCount.textContent = activeToday.length;
  
  if (activeToday.length === 0) {
    todayContainer.innerHTML = '';
    todayEmpty.classList.remove('hidden');
  } else {
    todayEmpty.classList.add('hidden');
    todayContainer.innerHTML = activeToday.map(t => renderTaskItem(t, projects)).join('');
    attachTaskListeners(todayContainer);
  }
  
  // Overdue
  const overdue = tasks.filter(t => t.dueDate && isOverdue(t.dueDate) && t.status === 'active');
  const overdueSection = document.getElementById('dashboard-overdue-section');
  const overdueContainer = document.getElementById('dashboard-overdue-tasks');
  const overdueCount = document.getElementById('overdue-count');
  
  if (overdue.length > 0) {
    overdueSection.classList.remove('hidden');
    overdueCount.textContent = overdue.length;
    overdueContainer.innerHTML = overdue.slice(0, 3).map(t => renderTaskItem(t, projects)).join('');
    attachTaskListeners(overdueContainer);
  } else {
    overdueSection.classList.add('hidden');
  }
  
  // Pinned notes
  const pinned = notes.filter(n => n.isPinned).slice(0, 4);
  const pinnedContainer = document.getElementById('dashboard-pinned-notes');
  const pinnedEmpty = document.getElementById('dashboard-pinned-empty');
  
  if (pinned.length === 0) {
    pinnedContainer.innerHTML = '';
    pinnedEmpty.classList.remove('hidden');
  } else {
    pinnedEmpty.classList.add('hidden');
    pinnedContainer.innerHTML = pinned.map(n => renderNoteCard(n)).join('');
    attachNoteListeners(pinnedContainer);
  }
  
  // Recent projects
  const activeProjects = projects.filter(p => !p.isArchived).slice(0, 3);
  const projectsContainer = document.getElementById('dashboard-recent-projects');
  const projectsEmpty = document.getElementById('dashboard-projects-empty');
  
  if (activeProjects.length === 0) {
    projectsContainer.innerHTML = '';
    projectsEmpty.classList.remove('hidden');
  } else {
    projectsEmpty.classList.add('hidden');
    projectsContainer.innerHTML = activeProjects.map(p => renderProjectCard(p, tasks)).join('');
    attachProjectListeners(projectsContainer);
  }
}

// ===== Task Rendering =====
function renderTaskItem(task, projects = []) {
  const project = projects.find(p => p.id === task.projectId);
  const priorityClass = task.priority || 'medium';
  const isOverdueTask = task.dueDate && isOverdue(task.dueDate) && task.status === 'active';
  
  let timeStr = '';
  if (task.startTime) {
    timeStr = task.endTime ? `${task.startTime}–${task.endTime}` : task.startTime;
  }
  
  let dateStr = '';
  if (task.dueDate) {
    dateStr = isToday(task.dueDate) ? 'Сегодня' : formatDate(task.dueDate);
    if (isOverdueTask) dateStr = `<span class="overdue">${dateStr}</span>`;
  }
  
  const metaItems = [];
  if (dateStr) metaItems.push(dateStr);
  if (timeStr) metaItems.push(`<span class="task-time">${timeStr}</span>`);
  if (task.repeat !== 'none') metaItems.push('<span class="task-repeat">↻</span>');
  
  const subtaskCount = task.subtasks?.length || 0;
  const subtaskDone = task.subtasks?.filter(s => s.completed).length || 0;
  
  return `
    <div class="task-item priority-${priorityClass}" data-id="${task.id}" data-status="${task.status}">
      <div class="task-swipe-bg complete">Выполнить</div>
      <div class="task-swipe-bg delete">Удалить</div>
      <div class="task-checkbox ${task.status === 'completed' ? 'checked' : ''}" data-action="toggle"></div>
      <div class="task-info">
        <div class="task-title">${sanitizeHTML(task.title)}</div>
        ${task.description ? `<div class="task-desc-preview">${sanitizeHTML(task.description)}</div>` : ''}
        <div class="task-meta">
          <span class="task-priority ${priorityClass}"></span>
          ${metaItems.join(' • ')}
          ${project ? `<span class="task-project-badge" style="color:${project.color}">${project.icon} ${sanitizeHTML(project.name)}</span>` : ''}
          ${subtaskCount > 0 ? `<span class="subtask-counter">${subtaskDone}/${subtaskCount}</span>` : ''}
        </div>
        ${task.tags?.length ? `<div class="task-tags">${task.tags.map(tag => `<span class="task-tag">${sanitizeHTML(tag)}</span>`).join('')}</div>` : ''}
      </div>
    </div>
  `;
}

function renderNoteCard(note) {
  const plainText = note.content.replace(/<[^>]+>/g, ' ').trim();
  const preview = plainText.slice(0, 120) + (plainText.length > 120 ? '...' : '');
  
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

function renderProjectCard(project, tasks = []) {
  const projectTasks = tasks.filter(t => t.projectId === project.id && t.status === 'active');
  const completedTasks = tasks.filter(t => t.projectId === project.id && t.status === 'completed');
  const total = projectTasks.length + completedTasks.length;
  const progress = total > 0 ? Math.round((completedTasks.length / total) * 100) : 0;
  
  return `
    <div class="project-card ${project.isArchived ? 'archived' : ''}" data-id="${project.id}">
      <div class="project-icon" style="background:${project.color}20;color:${project.color}">${project.icon || '📁'}</div>
      <div class="project-info">
        <div class="project-name">${sanitizeHTML(project.name)}</div>
        <div class="project-desc">${sanitizeHTML(project.description || '')}</div>
      </div>
      <div class="project-progress">
        <div class="project-progress-bar">
          <div class="project-progress-fill" style="width:${progress}%;background:${project.color}"></div>
        </div>
        <div class="project-progress-text">${progress}%</div>
      </div>
    </div>
  `;
}

// ===== Task List Rendering =====
async function renderTasks() {
  const tasks = await dbGetAll('tasks');
  const projects = await dbGetAll('projects');
  const today = formatDateISO(new Date());
  
  const tabs = {
    inbox: tasks.filter(t => !t.dueDate && t.status === 'active'),
    today: tasks.filter(t => t.dueDate === today && t.status === 'active'),
    upcoming: tasks.filter(t => t.dueDate > today && t.status === 'active'),
    someday: tasks.filter(t => !t.dueDate && t.status === 'active')
  };
  
  // Fix: inbox = no date, someday = no date (same filter per TZ)
  tabs.inbox = tasks.filter(t => !t.dueDate && t.status === 'active');
  
  for (const [tab, items] of Object.entries(tabs)) {
    const container = document.getElementById(`${tab}-tasks`);
    const empty = document.getElementById(`${tab}-empty`);
    
    if (items.length === 0) {
      container.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      container.innerHTML = items.map(t => renderTaskItem(t, projects)).join('');
      attachTaskListeners(container);
    }
  }
}

// ===== Calendar =====
let calCurrentDate = new Date();

async function renderCalendar() {
  const year = calCurrentDate.getFullYear();
  const month = calCurrentDate.getMonth();
  
  document.getElementById('cal-month-year').textContent = getMonthName(year, month);
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = (firstDay.getDay() + 6) % 7; // Monday start
  
  const tasks = await dbGetAll('tasks');
  const grid = document.getElementById('calendar-grid');
  
  let html = '';
  
  // Day headers
  const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  dayNames.forEach(d => html += `<div class="cal-day-header">${d}</div>`);
  
  // Padding
  for (let i = 0; i < startPadding; i++) {
    html += `<div class="cal-day other-month"></div>`;
  }
  
  // Days
  const today = new Date();
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = formatDateISO(new Date(year, month, day));
    const isToday = today.toDateString() === new Date(year, month, day).toDateString();
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
  
  // Attach click handlers
  grid.querySelectorAll('.cal-day[data-date]').forEach(day => {
    day.addEventListener('click', () => openDaySheet(day.dataset.date));
  });
}

document.getElementById('cal-prev').addEventListener('click', () => {
  calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById('cal-next').addEventListener('click', () => {
  calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
  renderCalendar();
});

document.getElementById('cal-today').addEventListener('click', () => {
  calCurrentDate = new Date();
  renderCalendar();
});

// ===== Day Sheet =====
async function openDaySheet(date) {
  const tasks = await dbGetAll('tasks');
  const projects = await dbGetAll('projects');
  const dayTasks = tasks.filter(t => t.dueDate === date && t.status === 'active');
  
  document.getElementById('day-sheet-title').textContent = formatDate(date);
  const container = document.getElementById('day-sheet-tasks');
  const empty = document.getElementById('day-sheet-empty');
  
  if (dayTasks.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    container.innerHTML = dayTasks.map(t => renderTaskItem(t, projects)).join('');
    attachTaskListeners(container);
  }
  
  document.getElementById('day-sheet-add-btn').onclick = () => {
    closeModal('day-sheet');
    openTaskModal(null, { dueDate: date });
  };
  
  document.getElementById('day-sheet').classList.add('active');
}

document.querySelector('#day-sheet .sheet-close').addEventListener('click', () => {
  document.getElementById('day-sheet').classList.remove('active');
});

// ===== Notes =====
async function renderNotes() {
  const notes = await dbGetAll('notes');
  const searchTerm = document.getElementById('notes-search-input').value.toLowerCase();
  
  let filtered = notes;
  if (searchTerm) {
    filtered = notes.filter(n => 
      (n.title || '').toLowerCase().includes(searchTerm) ||
      (n.content || '').toLowerCase().includes(searchTerm) ||
      (n.tags || []).some(t => t.toLowerCase().includes(searchTerm))
    );
  }
  
  // Sort: pinned first, then by updated
  filtered.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  
  const container = document.getElementById('notes-grid');
  const empty = document.getElementById('notes-empty');
  
  if (filtered.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    container.innerHTML = filtered.map(n => renderNoteCard(n)).join('');
    attachNoteListeners(container);
  }
}

document.getElementById('notes-search-input').addEventListener('input', debounce(() => renderNotes(), 300));

// ===== Projects =====
async function renderProjects() {
  const projects = await dbGetAll('projects');
  const tasks = await dbGetAll('tasks');
  
  const active = projects.filter(p => !p.isArchived);
  const archived = projects.filter(p => p.isArchived);
  
  const container = document.getElementById('projects-list');
  const empty = document.getElementById('projects-empty');
  
  if (active.length === 0 && archived.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  let html = active.map(p => renderProjectCard(p, tasks)).join('');
  
  if (archived.length > 0) {
    html += `<h3 class="section-title" style="margin-top:24px;opacity:0.6;">Архивные</h3>`;
    html += archived.map(p => renderProjectCard(p, tasks)).join('');
  }
  
  container.innerHTML = html;
  attachProjectListeners(container);
}

// ===== Archive =====
async function renderArchive() {
  const tasks = await dbGetAll('tasks');
  const projects = await dbGetAll('projects');
  
  const completed = tasks.filter(t => t.status === 'completed');
  const trash = tasks.filter(t => t.status === 'deleted');
  
  // Completed
  const compContainer = document.getElementById('completed-tasks');
  const compEmpty = document.getElementById('completed-empty');
  
  if (completed.length === 0) {
    compContainer.innerHTML = '';
    compEmpty.classList.remove('hidden');
  } else {
    compEmpty.classList.add('hidden');
    compContainer.innerHTML = completed.map(t => renderTaskItem(t, projects)).join('');
    attachTaskListeners(compContainer);
  }
  
  // Trash
  const trashContainer = document.getElementById('trash-tasks');
  const trashEmpty = document.getElementById('trash-empty');
  
  if (trash.length === 0) {
    trashContainer.innerHTML = '';
    trashEmpty.classList.remove('hidden');
  } else {
    trashEmpty.classList.add('hidden');
    trashContainer.innerHTML = trash.map(t => renderTaskItem(t, projects)).join('');
    attachTaskListeners(trashContainer);
  }
}

document.getElementById('clear-trash-btn').addEventListener('click', () => {
  showConfirm('Очистить корзину? Удалённые задачи будут безвозвратно удалены.', async () => {
    const tasks = await dbGetAll('tasks');
    for (const t of tasks.filter(t => t.status === 'deleted')) {
      await dbDelete('tasks', t.id);
    }
    renderArchive();
    showToast('Корзина очищена', 'success');
  });
});

// ===== Current editing state =====
let editingTask = null;
let editingNote = null;
let editingProject = null;
let currentSubtasks = [];
let currentTags = [];
let currentNoteTags = [];

// ===== Task Modal =====
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
  
  // Priority
  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.priority === (task?.priority || 'medium'));
  });
  
  // Project select
  populateProjectSelect('task-project', task?.projectId);
  
  // Subtasks
  renderSubtasks();
  
  // Tags
  renderTaskTags();
  
  // Delete button
  document.getElementById('task-delete-btn').classList.toggle('hidden', !task);
  
  openModal('task-modal');
}

async function populateProjectSelect(selectId, selectedId) {
  const projects = await dbGetAll('projects');
  const select = document.getElementById(selectId);
  select.innerHTML = '<option value="">Без проекта</option>' + 
    projects.filter(p => !p.isArchived).map(p => 
      `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${sanitizeHTML(p.name)}</option>`
    ).join('');
}

function renderSubtasks() {
  const container = document.getElementById('task-subtasks');
  container.innerHTML = currentSubtasks.map((s, i) => `
    <div class="subtask-item" data-index="${i}">
      <div class="subtask-check ${s.completed ? 'checked' : ''}" data-index="${i}"></div>
      <span class="subtask-title ${s.completed ? 'completed' : ''}">${sanitizeHTML(s.title)}</span>
      <span class="subtask-delete" data-index="${i}">✕</span>
    </div>
  `).join('');
  
  container.querySelectorAll('.subtask-check').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      currentSubtasks[idx].completed = !currentSubtasks[idx].completed;
      renderSubtasks();
    });
  });
  
  container.querySelectorAll('.subtask-delete').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      currentSubtasks.splice(idx, 1);
      renderSubtasks();
    });
  });
}

function renderTaskTags() {
  const container = document.getElementById('task-tags');
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

// Subtask add
document.getElementById('subtask-add-btn').addEventListener('click', () => {
  const input = document.getElementById('subtask-input');
  const title = input.value.trim();
  if (!title) return;
  currentSubtasks.push({ id: uuid(), title, completed: false });
  input.value = '';
  renderSubtasks();
});

document.getElementById('subtask-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('subtask-add-btn').click();
});

// Tag add
document.getElementById('tag-add-btn').addEventListener('click', async () => {
  const input = document.getElementById('tag-input');
  const name = input.value.trim();
  if (!name) return;
  if (currentTags.includes(name)) {
    showToast('Тег уже добавлен', 'error');
    return;
  }
  currentTags.push(name);
  
  // Add to global tags if new
  const allTags = await dbGetAll('tags');
  if (!allTags.find(t => t.name.toLowerCase() === name.toLowerCase())) {
    await dbAdd('tags', { 
      id: uuid(), 
      name, 
      color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)], 
      usageCount: 1 
    });
  }
  
  input.value = '';
  renderTaskTags();
});

document.getElementById('tag-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('tag-add-btn').click();
});

// Priority selection
document.querySelectorAll('.priority-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Save task
document.getElementById('task-save-btn').addEventListener('click', async () => {
  const title = document.getElementById('task-title').value.trim();
  if (!title) {
    showToast('Введите название задачи', 'error');
    return;
  }
  
  const priority = document.querySelector('.priority-btn.active')?.dataset.priority || 'medium';
  const now = new Date().toISOString();
  
  const taskData = {
    id: editingTask?.id || uuid(),
    title,
    description: document.getElementById('task-desc').value.trim(),
    projectId: document.getElementById('task-project').value || null,
    priority,
    dueDate: document.getElementById('task-date').value || null,
    startTime: document.getElementById('task-start-time').value || null,
    endTime: document.getElementById('task-end-time').value || null,
    repeat: document.getElementById('task-repeat').value,
    repeatConfig: null,
    subtasks: currentSubtasks,
    tags: currentTags,
    status: editingTask?.status || 'active',
    createdAt: editingTask?.createdAt || now,
    completedAt: editingTask?.completedAt || null,
    updatedAt: now
  };
  
  await dbPut('tasks', taskData);
  closeModal('task-modal');
  showToast(editingTask ? 'Задача обновлена' : 'Задача создана', 'success');
  
  // Refresh current view
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'tasks') renderTasks();
  if (currentView === 'calendar') renderCalendar();
  if (currentView === 'archive') renderArchive();
});

// Delete task
document.getElementById('task-delete-btn').addEventListener('click', () => {
  if (!editingTask) return;
  showConfirm('Удалить задачу?', async () => {
    editingTask.status = 'deleted';
    editingTask.updatedAt = new Date().toISOString();
    await dbPut('tasks', editingTask);
    closeModal('task-modal');
    showToast('Задача удалена', 'info');
    renderTasks();
    renderDashboard();
  });
});

// ===== Note Modal =====
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

// Note tag add
document.getElementById('note-tag-add-btn').addEventListener('click', async () => {
  const input = document.getElementById('note-tag-input');
  const name = input.value.trim();
  if (!name) return;
  if (currentNoteTags.includes(name)) {
    showToast('Тег уже добавлен', 'error');
    return;
  }
  currentNoteTags.push(name);
  
  const allTags = await dbGetAll('tags');
  if (!allTags.find(t => t.name.toLowerCase() === name.toLowerCase())) {
    await dbAdd('tags', { 
      id: uuid(), 
      name, 
      color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)], 
      usageCount: 1 
    });
  }
  
  input.value = '';
  renderNoteTags();
});

document.getElementById('note-tag-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('note-tag-add-btn').click();
});

// Pin/Fav toggles
document.getElementById('note-pin-btn').addEventListener('click', function() {
  this.classList.toggle('active');
});

document.getElementById('note-fav-btn').addEventListener('click', function() {
  this.classList.toggle('active');
});

// Rich Editor Toolbar
document.querySelectorAll('.toolbar-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.dataset.cmd;
    const editor = document.getElementById('note-editor');
    editor.focus();
    
    switch(cmd) {
      case 'h1': insertHeading(editor, 'h1'); break;
      case 'h2': insertHeading(editor, 'h2'); break;
      case 'bold': toggleFormat(editor, 'b'); break;
      case 'italic': toggleFormat(editor, 'i'); break;
      case 'strike': toggleFormat(editor, 's'); break;
      case 'ul': insertList(editor, 'ul'); break;
      case 'ol': insertList(editor, 'ol'); break;
      case 'check': insertCheckbox(editor); break;
      case 'quote': insertQuote(editor); break;
      case 'hr': insertHR(editor); break;
    }
  });
});

function insertHeading(editor, tag) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  const range = selection.getRangeAt(0);
  const selectedText = range.toString();
  const heading = document.createElement(tag);
  heading.textContent = selectedText || 'Заголовок';
  
  range.deleteContents();
  range.insertNode(heading);
  
  // Add br after
  const br = document.createElement('br');
  heading.after(br);
  
  // Move cursor after
  const newRange = document.createRange();
  newRange.setStartAfter(br);
  newRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(newRange);
}

function toggleFormat(editor, tag) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  const range = selection.getRangeAt(0);
  const selectedText = range.toString();
  
  // Check if already wrapped
  let parent = range.commonAncestorContainer;
  if (parent.nodeType === 3) parent = parent.parentElement;
  
  const existing = parent.closest(tag);
  if (existing) {
    // Unwrap
    const text = document.createTextNode(existing.textContent);
    existing.replaceWith(text);
  } else {
    // Wrap
    const el = document.createElement(tag);
    el.textContent = selectedText || 'текст';
    range.deleteContents();
    range.insertNode(el);
  }
}

function insertList(editor, type) {
  const selection = window.getSelection();
  const list = document.createElement(type);
  const li = document.createElement('li');
  li.textContent = 'Пункт';
  list.appendChild(li);
  
  if (selection.rangeCount) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(list);
  } else {
    editor.appendChild(list);
  }
}

function insertCheckbox(editor) {
  const selection = window.getSelection();
  const div = document.createElement('div');
  div.innerHTML = '<input type="checkbox"> <span>Задача</span>';
  
  if (selection.rangeCount) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(div);
  } else {
    editor.appendChild(div);
  }
}

function insertQuote(editor) {
  const selection = window.getSelection();
  const blockquote = document.createElement('blockquote');
  blockquote.textContent = 'Цитата';
  
  if (selection.rangeCount) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(blockquote);
  } else {
    editor.appendChild(blockquote);
  }
}

function insertHR(editor) {
  const hr = document.createElement('hr');
  editor.appendChild(hr);
}

// Save note
document.getElementById('note-save-btn').addEventListener('click', async () => {
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
  
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'notes') renderNotes();
});

// Delete note
document.getElementById('note-delete-btn').addEventListener('click', () => {
  if (!editingNote) return;
  showConfirm('Удалить заметку?', async () => {
    await dbDelete('notes', editingNote.id);
    closeModal('note-modal');
    showToast('Заметка удалена', 'info');
    renderNotes();
    renderDashboard();
  });
});

// ===== Project Modal =====
function openProjectModal(project = null) {
  editingProject = project;
  
  document.getElementById('project-modal-title').textContent = project ? 'Редактировать проект' : 'Новый проект';
  document.getElementById('project-name').value = project?.name || '';
  document.getElementById('project-desc').value = project?.description || '';
  document.getElementById('project-icon').value = project?.icon || '';
  
  // Color
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

// Save project
document.getElementById('project-save-btn').addEventListener('click', async () => {
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
  
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'projects') renderProjects();
  if (currentView === 'tasks') renderTasks();
});

// Delete project
document.getElementById('project-delete-btn').addEventListener('click', () => {
  if (!editingProject) return;
  showConfirm('Удалить проект? Все связанные задачи останутся без проекта.', async () => {
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
    renderProjects();
    renderDashboard();
  });
});

// ===== Modal close buttons =====
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    const modal = btn.closest('.modal');
    if (modal) modal.classList.remove('active');
  });
});

// ===== Swipe Gestures =====
function attachTaskListeners(container) {
  container.querySelectorAll('.task-item').forEach(item => {
    // Toggle complete
    const checkbox = item.querySelector('.task-checkbox');
    if (checkbox) {
      checkbox.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = item.dataset.id;
        const task = await dbGet('tasks', id);
        if (!task) return;
        
        if (task.status === 'completed') {
          task.status = 'active';
          task.completedAt = null;
        } else {
          task.status = 'completed';
          task.completedAt = new Date().toISOString();
          
          // Handle repeat
          if (task.repeat !== 'none') {
            await createRepeatedTask(task);
          }
        }
        task.updatedAt = new Date().toISOString();
        await dbPut('tasks', task);
        
        showToast(task.status === 'completed' ? 'Задача выполнена!' : 'Задача активна', 'success');
        
        if (currentView === 'dashboard') renderDashboard();
        if (currentView === 'tasks') renderTasks();
        if (currentView === 'calendar') renderCalendar();
        if (currentView === 'archive') renderArchive();
      });
    }
    
    // Open edit
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.task-checkbox') || e.target.closest('.task-swipe-bg')) return;
      const id = item.dataset.id;
      const task = await dbGet('tasks', id);
      if (task) openTaskModal(task);
    });
    
    // Swipe
    let startX = 0;
    let currentX = 0;
    let isSwiping = false;
    
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
      
      // Limit swipe distance
      const limitedDiff = Math.max(-120, Math.min(120, diff));
      item.style.transform = `translateX(${limitedDiff}px)`;
      
      if (diff > 50) item.classList.add('swiping-right');
      else item.classList.remove('swiping-right');
      
      if (diff < -50) item.classList.add('swiping-left');
      else item.classList.remove('swiping-left');
    }, { passive: true });
    
    item.addEventListener('touchend', async () => {
      if (!isSwiping) return;
      isSwiping = false;
      item.classList.remove('swiping');
      const diff = currentX - startX;
      
      if (diff > 100) {
        // Swipe right = complete
        const id = item.dataset.id;
        const task = await dbGet('tasks', id);
        if (task && task.status === 'active') {
          task.status = 'completed';
          task.completedAt = new Date().toISOString();
          if (task.repeat !== 'none') await createRepeatedTask(task);
          task.updatedAt = new Date().toISOString();
          await dbPut('tasks', task);
          showToast('Задача выполнена!', 'success');
          renderCurrentView();
        }
      } else if (diff < -100) {
        // Swipe left = delete
        const id = item.dataset.id;
        const task = await dbGet('tasks', id);
        if (task) {
          task.status = 'deleted';
          task.updatedAt = new Date().toISOString();
          await dbPut('tasks', task);
          showToast('Задача удалена', 'info');
          renderCurrentView();
        }
      }
      
      item.style.transform = '';
      item.classList.remove('swiping-right', 'swiping-left');
    });
  });
}

async function createRepeatedTask(originalTask) {
  const now = new Date().toISOString();
  let newDate = originalTask.dueDate;
  
  if (originalTask.repeat === 'daily') newDate = addDays(originalTask.dueDate, 1);
  else if (originalTask.repeat === 'weekly') newDate = addDays(originalTask.dueDate, 7);
  else if (originalTask.repeat === 'monthly') newDate = addMonths(originalTask.dueDate, 1);
  
  const newTask = {
    ...clone(originalTask),
    id: uuid(),
    status: 'active',
    dueDate: newDate,
    completedAt: null,
    createdAt: now,
    updatedAt: now
  };
  
  await dbAdd('tasks', newTask);
  showToast('Создана повторяющаяся задача', 'info');
}

function renderCurrentView() {
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'tasks') renderTasks();
  if (currentView === 'calendar') renderCalendar();
  if (currentView === 'archive') renderArchive();
}

// ===== Note Listeners =====
function attachNoteListeners(container) {
  container.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('click', async () => {
      const id = card.dataset.id;
      const note = await dbGet('notes', id);
      if (note) openNoteModal(note);
    });
  });
}

// ===== Project Listeners =====
function attachProjectListeners(container) {
  container.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', async () => {
      const id = card.dataset.id;
      const project = await dbGet('projects', id);
      if (project) openProjectModal(project);
    });
  });
}

// ===== FAB =====
const fab = document.getElementById('fab');
const fabMenu = document.getElementById('fab-menu');

fab.addEventListener('click', () => {
  fab.classList.toggle('active');
  fabMenu.classList.toggle('hidden');
});

fabMenu.querySelectorAll('.fab-menu-item').forEach(item => {
  item.addEventListener('click', () => {
    const action = item.dataset.action;
    fab.classList.remove('active');
    fabMenu.classList.add('hidden');
    
    if (action === 'task') openTaskModal();
    if (action === 'note') openNoteModal();
    if (action === 'project') openProjectModal();
  });
});

// Close FAB menu on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('#fab') && !e.target.closest('#fab-menu')) {
    fab.classList.remove('active');
    fabMenu.classList.add('hidden');
  }
});

// ===== Search =====
document.getElementById('header-search-btn').addEventListener('click', () => {
  navigateTo('search');
  setTimeout(() => document.getElementById('search-input').focus(), 100);
});

document.getElementById('search-close').addEventListener('click', () => {
  navigateTo('dashboard');
});

let searchHistory = JSON.parse(localStorage.getItem('planner_search_history') || '[]');

function renderSearchHistory() {
  const container = document.getElementById('search-history-list');
  if (searchHistory.length === 0) {
    container.innerHTML = '<p style="color:var(--text-3);font-size:13px;">История пуста</p>';
    return;
  }
  container.innerHTML = searchHistory.slice(0, 10).map(q => `
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
  if (!query) return;
  
  // Save to history
  if (!searchHistory.includes(query)) {
    searchHistory.unshift(query);
    if (searchHistory.length > 20) searchHistory.pop();
    localStorage.setItem('planner_search_history', JSON.stringify(searchHistory));
    renderSearchHistory();
  }
  
  const filterTasks = document.getElementById('filter-tasks').checked;
  const filterNotes = document.getElementById('filter-notes').checked;
  const filterProjects = document.getElementById('filter-projects').checked;
  
  const results = [];
  
  if (filterTasks) {
    const tasks = await dbGetAll('tasks');
    const matched = tasks.filter(t => 
      t.title.toLowerCase().includes(query) ||
      (t.description || '').toLowerCase().includes(query) ||
      (t.tags || []).some(tag => tag.toLowerCase().includes(query))
    );
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
    const matched = projects.filter(p => 
      p.name.toLowerCase().includes(query) ||
      (p.description || '').toLowerCase().includes(query)
    );
    if (matched.length) results.push({ type: 'projects', items: matched });
  }
  
  renderSearchResults(results, query);
}

function renderSearchResults(results, query) {
  const container = document.getElementById('search-results');
  const historyEl = document.getElementById('search-history');
  
  historyEl.classList.add('hidden');
  
  if (results.length === 0) {
    container.innerHTML = `
      <div class="search-no-results">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p>Ничего не найдено по запросу "${sanitizeHTML(query)}"</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = results.map(group => {
    const typeNames = { tasks: 'Задачи', notes: 'Заметки', projects: 'Проекты' };
    return `
      <div class="search-result-group">
        <div class="search-result-group-title">${typeNames[group.type]}</div>
        ${group.items.map(item => renderSearchResultItem(item, group.type)).join('')}
      </div>
    `;
  }).join('');
  
  // Attach click handlers
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

function renderSearchResultItem(item, type) {
  let icon = '';
  let title = '';
  let subtitle = '';
  
  if (type === 'tasks') {
    icon = '✓';
    title = item.title;
    subtitle = item.dueDate ? formatDate(item.dueDate) : 'Без даты';
  } else if (type === 'notes') {
    icon = '📝';
    title = item.title || 'Без названия';
    subtitle = formatDate(item.updatedAt);
  } else if (type === 'projects') {
    icon = item.icon || '📁';
    title = item.name;
    subtitle = item.description || '';
  }
  
  return `
    <div class="search-result-item" data-type="${type}" data-id="${item.id}">
      <div class="search-result-icon">${icon}</div>
      <div class="search-result-info">
        <div class="search-result-title">${sanitizeHTML(title)}</div>
        <div class="search-result-subtitle">${sanitizeHTML(subtitle)}</div>
      </div>
    </div>
  `;
}

document.getElementById('search-input').addEventListener('input', debounce(() => performSearch(), 300));
document.getElementById('search-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') performSearch();
});

// Filter change handlers
document.querySelectorAll('#view-search input[type="checkbox"]').forEach(cb => {
  cb.addEventListener('change', () => {
    const query = document.getElementById('search-input').value.trim();
    if (query) performSearch();
  });
});

// ===== Statistics =====
async function renderStats() {
  const tasks = await dbGetAll('tasks');
  const projects = await dbGetAll('projects');
  const today = formatDateISO(new Date());
  const weekStart = formatDateISO(getWeekStart(new Date()));
  
  // Completed counts
  const todayCompleted = tasks.filter(t => t.status === 'completed' && t.completedAt?.startsWith(today)).length;
  const weekCompleted = tasks.filter(t => {
    if (t.status !== 'completed' || !t.completedAt) return false;
    return t.completedAt >= weekStart;
  }).length;
  const monthCompleted = tasks.filter(t => {
    if (t.status !== 'completed' || !t.completedAt) return false;
    const d = new Date(t.completedAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const totalActive = tasks.filter(t => t.status === 'active').length;
  
  document.getElementById('stat-completed-today').textContent = todayCompleted;
  document.getElementById('stat-completed-week').textContent = weekCompleted;
  document.getElementById('stat-completed-month').textContent = monthCompleted;
  document.getElementById('stat-total-active').textContent = totalActive;
  
  // Heatmap (last 30 days)
  const heatmap = document.getElementById('stats-heatmap');
  const heatmapData = {};
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = formatDateISO(d);
    heatmapData[dateStr] = tasks.filter(t => t.status === 'completed' && t.completedAt?.startsWith(dateStr)).length;
  }
  
  const maxCount = Math.max(...Object.values(heatmapData), 1);
  
  heatmap.innerHTML = Object.entries(heatmapData).map(([date, count]) => {
    const level = Math.min(5, Math.ceil((count / maxCount) * 5));
    return `<div class="heatmap-cell l${level}" title="${formatDate(date)}: ${count} задач"></div>`;
  }).join('');
  
  // Projects chart
  const projectsChart = document.getElementById('stats-projects-chart');
  const projectStats = projects.filter(p => !p.isArchived).map(p => {
    const pTasks = tasks.filter(t => t.projectId === p.id);
    const completed = pTasks.filter(t => t.status === 'completed').length;
    return { ...p, total: pTasks.length, completed };
  }).filter(p => p.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);
  
  const maxProject = Math.max(...projectStats.map(p => p.total), 1);
  
  projectsChart.innerHTML = projectStats.map(p => `
    <div class="chart-bar">
      <div class="chart-bar-label">${p.icon} ${sanitizeHTML(p.name)}</div>
      <div class="chart-bar-track">
        <div class="chart-bar-fill project" style="width:${(p.total / maxProject) * 100}%">
          <span class="chart-bar-value">${p.completed}/${p.total}</span>
        </div>
      </div>
    </div>
  `).join('');
  
  // Priority chart
  const priorityChart = document.getElementById('stats-priority-chart');
  const priorities = ['high', 'medium', 'low'];
  const priorityNames = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
  const priorityColors = { high: 'var(--priority-high)', medium: 'var(--priority-medium)', low: 'var(--priority-low)' };
  
  const priorityStats = priorities.map(p => ({
    priority: p,
    count: tasks.filter(t => t.priority === p && t.status === 'active').length
  }));
  
  const maxPriority = Math.max(...priorityStats.map(p => p.count), 1);
  
  priorityChart.innerHTML = priorityStats.map(p => `
    <div class="chart-bar">
      <div class="chart-bar-label">${priorityNames[p.priority]}</div>
      <div class="chart-bar-track">
        <div class="chart-bar-fill ${p.priority}" style="width:${(p.count / maxPriority) * 100}%;background:${priorityColors[p.priority]}">
          <span class="chart-bar-value">${p.count}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// ===== Settings =====
async function initSettings() {
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
  
  // Version
  document.getElementById('app-version-display').textContent = `v${APP_VERSION}`;
}

// Theme toggle
document.querySelectorAll('.segment[data-theme]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const theme = btn.dataset.theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.segment[data-theme]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    await setSetting('theme', theme);
    
    // Update meta theme-color
    const metaTheme = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: light)"]');
    if (metaTheme) metaTheme.content = theme === 'dark' ? '#1a1a2e' : '#667eea';
  });
});

// Scheme toggle
document.querySelectorAll('.theme-option[data-scheme]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const scheme = btn.dataset.scheme;
    document.documentElement.setAttribute('data-scheme', scheme);
    document.querySelectorAll('.theme-option[data-scheme]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    await setSetting('scheme', scheme);
  });
});

// Export
document.getElementById('export-btn').addEventListener('click', async () => {
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
  a.download = `planner-pro-backup-${formatDateISO(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('Данные экспортированы', 'success');
});

// Import
document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  // Offer backup first
  showConfirm('Создать резервную копию текущих данных перед импортом?', async () => {
    // Export current data first
    const currentData = {
      version: APP_VERSION,
      exportDate: new Date().toISOString(),
      tasks: await dbGetAll('tasks'),
      notes: await dbGetAll('notes'),
      projects: await dbGetAll('projects'),
      tags: await dbGetAll('tags'),
      settings: await dbGetAll('settings')
    };
    
    const blob = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planner-pro-auto-backup-${formatDateISO(new Date())}.json`;
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
    
    // Clear existing data
    const stores = ['tasks', 'notes', 'projects', 'tags', 'settings'];
    for (const storeName of stores) {
      const all = await dbGetAll(storeName);
      for (const item of all) {
        await dbDelete(storeName, item.id || item.key);
      }
    }
    
    // Import new data
    if (data.tasks) for (const item of data.tasks) await dbAdd('tasks', item);
    if (data.notes) for (const item of data.notes) await dbAdd('notes', item);
    if (data.projects) for (const item of data.projects) await dbAdd('projects', item);
    if (data.tags) for (const item of data.tags) await dbAdd('tags', item);
    if (data.settings) for (const item of data.settings) await dbAdd('settings', item);
    
    showToast('Данные импортированы', 'success');
    renderDashboard();
  } catch (err) {
    showToast('Ошибка импорта: ' + err.message, 'error');
  }
  
  document.getElementById('import-file').value = '';
}

// Clear all data
document.getElementById('clear-data-btn').addEventListener('click', () => {
  showConfirm('Удалить ВСЕ данные? Это действие необратимо!', async () => {
    // Backup first
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
    a.download = `planner-pro-final-backup-${formatDateISO(new Date())}.json`;
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
    showToast('Данные очищены, созданы демо-данные', 'info');
    renderDashboard();
  });
});

// ===== Service Worker Registration =====
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.register('sw.js');
    
    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateToast();
        }
      });
    });
    
    // Listen for messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'UPDATE_AVAILABLE') {
        showUpdateToast();
      }
    });
  } catch (err) {
    console.error('SW registration failed:', err);
  }
}

function showUpdateToast() {
  const toast = document.getElementById('update-toast');
  toast.classList.remove('hidden');
}

document.getElementById('update-btn').addEventListener('click', () => {
  window.location.reload();
});

// ===== Install Prompt =====
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Show after 30s or 2nd visit
  const visits = parseInt(localStorage.getItem('planner_visits') || '0');
  localStorage.setItem('planner_visits', visits + 1);
  
  const dismissed = localStorage.getItem('planner_install_dismissed');
  if (dismissed || visits < 1) return;
  
  setTimeout(() => {
    if (deferredPrompt) {
      document.getElementById('install-banner').classList.remove('hidden');
    }
  }, 30000);
});

document.getElementById('install-btn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    localStorage.setItem('planner_install_dismissed', 'true');
    document.getElementById('install-banner').classList.add('hidden');
  }
  deferredPrompt = null;
});

document.getElementById('install-dismiss').addEventListener('click', () => {
  localStorage.setItem('planner_install_dismissed', 'true');
  document.getElementById('install-banner').classList.add('hidden');
});

// ===== Online/Offline =====
function updateOnlineStatus() {
  const indicator = document.querySelector('.offline-indicator');
  if (!navigator.onLine) {
    if (!indicator) {
      const div = document.createElement('div');
      div.className = 'offline-indicator show';
      document.body.appendChild(div);
    } else {
      indicator.classList.add('show');
    }
  } else {
    if (indicator) indicator.classList.remove('show');
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ===== Before Unload Warning =====
window.addEventListener('beforeunload', (e) => {
  const modals = document.querySelectorAll('.modal.active');
  if (modals.length > 0) {
    e.preventDefault();
    e.returnValue = 'У вас есть несохранённые изменения. Покинуть страницу?';
    return e.returnValue;
  }
});

// ===== Tabs in Tasks View =====
document.querySelectorAll('#view-tasks .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll('#view-tasks .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('#view-tasks .tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
  });
});

// ===== Tabs in Archive View =====
document.querySelectorAll('#view-archive .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll('#view-archive .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('#view-archive .tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
  });
});

// ===== Internal Notifications on Open =====
async function checkNotifications() {
  const today = formatDateISO(new Date());
  const tasks = await dbGetAll('tasks');
  
  // Overdue tasks
  const overdue = tasks.filter(t => t.dueDate && isOverdue(t.dueDate) && t.status === 'active');
  if (overdue.length > 0) {
    showToast(`Просрочено задач: ${overdue.length}`, 'error', 5000);
  }
  
  // High priority today
  const highPriorityToday = tasks.filter(t => t.dueDate === today && t.priority === 'high' && t.status === 'active');
  if (highPriorityToday.length > 0) {
    showToast(`Важных задач на сегодня: ${highPriorityToday.length}`, 'info', 5000);
  }
}

// ===== Initialization =====
async function init() {
  try {
    // Open DB
    await openDB();
    
    // Seed demo data if empty
    await seedDemoData();
    
    // Init settings
    await initSettings();
    
    // Register SW
    await registerSW();
    
    // Check for hash route
    const hash = window.location.hash.slice(1);
    if (hash && document.getElementById(`view-${hash}`)) {
      navigateTo(hash);
    } else {
      navigateTo('dashboard');
    }
    
    // Render initial view
    renderDashboard();
    
    // Check notifications
    setTimeout(checkNotifications, 1000);
    
    // Hide splash screen
    const splash = document.getElementById('splash-screen');
    splash.classList.add('hidden');
    
    // Show app
    document.getElementById('app').classList.remove('hidden');
    
    console.log(`Planner Pro v${APP_VERSION} initialized`);
  } catch (err) {
    console.error('Init error:', err);
    showToast('Ошибка инициализации приложения', 'error');
  }
}

// Start when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
