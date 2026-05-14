// ===== PLANNER PRO v1.1 - MAIN APPLICATION =====

const APP_VERSION = '1.1';
const DB_NAME = 'planner_db';
const DB_VERSION = 1;

// ===== Constants =====
const ACCENT_COLORS = {
  blue: { name: 'Океан', value: '#667eea' },
  purple: { name: 'Закат', value: '#fa709a' },
  green: { name: 'Лес', value: '#11998e' },
  rose: { name: 'Неон', value: '#b721ff' }
};

const PROJECT_COLORS = [
  '#667eea', '#fa709a', '#11998e', '#b721ff',
  '#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1'
];

// ===== UUID Generator =====
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ===== Date Utilities =====
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

function formatTime(time) {
  if (!time) return '';
  return time.substring(0, 5);
}

function isOverdue(d) {
  if (!d) return false;
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date < new Date();
}

function isToday(d) {
  if (!d) return false;
  const date = new Date(d);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function isTomorrow(d) {
  if (!d) return false;
  const date = new Date(d);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.toDateString() === tomorrow.toDateString();
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

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

// ===== String Utilities =====
function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function stripHTML(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function truncate(str, len) {
  if (str.length <= len) return str;
  return str.substring(0, len) + '...';
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

// ===== Store (Event-based state management) =====
class Store {
  constructor() {
    this.state = {
      tasks: [],
      notes: [],
      projects: [],
      tags: [],
      currentView: 'dashboard',
      currentEditTask: null,
      currentEditNote: null,
      currentEditProject: null
    };
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
    request.onsuccess = () => { 
      db = request.result; 
      resolve(db); 
    };
    
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
        notesStore.createIndex('by_isFavorite', 'isFavorite', { unique: false });
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

// ===== DB CRUD Operations =====
function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGet(storeName, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbAdd(storeName, item) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbPut(storeName, item) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbDelete(storeName, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbClear(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ===== Settings =====
async function getSetting(key, defaultValue) {
  try {
    const setting = await dbGet('settings', key);
    return setting ? setting.value : defaultValue;
  } catch (err) {
    console.error('Error getting setting:', err);
    return defaultValue;
  }
}

async function setSetting(key, value) {
  try {
    await dbPut('settings', { key, value });
  } catch (err) {
    console.error('Error setting:', err);
  }
}

// ===== Load Data =====
async function loadTasks() {
  try {
    const tasks = await dbGetAll('tasks');
    store.set('tasks', tasks);
    return tasks;
  } catch (err) {
    console.error('Error loading tasks:', err);
    return [];
  }
}

async function loadNotes() {
  try {
    const notes = await dbGetAll('notes');
    store.set('notes', notes);
    return notes;
  } catch (err) {
    console.error('Error loading notes:', err);
    return [];
  }
}

async function loadProjects() {
  try {
    const projects = await dbGetAll('projects');
    store.set('projects', projects);
    return projects;
  } catch (err) {
    console.error('Error loading projects:', err);
    return [];
  }
}

async function loadTags() {
  try {
    const tags = await dbGetAll('tags');
    store.set('tags', tags);
    return tags;
  } catch (err) {
    console.error('Error loading tags:', err);
    return [];
  }
}

async function loadAllData() {
  await Promise.all([
    loadTasks(),
    loadNotes(),
    loadProjects(),
    loadTags()
  ]);
}

// ===== Task Operations =====
async function saveTask(task) {
  try {
    if (!task.id) {
      task.id = uuid();
      task.createdAt = new Date().toISOString();
    }
    task.updatedAt = new Date().toISOString();
    
    await dbPut('tasks', task);
    await loadTasks();
    store.emit('task-saved', task);
    return task;
  } catch (err) {
    console.error('Error saving task:', err);
    showToast('Ошибка сохранения задачи', 'error');
    throw err;
  }
}

async function deleteTask(id) {
  try {
    await dbDelete('tasks', id);
    await loadTasks();
    store.emit('task-deleted', id);
  } catch (err) {
    console.error('Error deleting task:', err);
    showToast('Ошибка удаления задачи', 'error');
  }
}

async function toggleTaskComplete(id) {
  try {
    const task = await dbGet('tasks', id);
    if (!task) return;
    
    task.status = task.status === 'completed' ? 'active' : 'completed';
    task.completedAt = task.status === 'completed' ? new Date().toISOString() : null;
    
    // Handle recurring tasks
    if (task.status === 'completed' && task.repeat && task.repeat !== 'none' && task.dueDate) {
      const newTask = clone(task);
      newTask.id = uuid();
      newTask.status = 'active';
      newTask.completedAt = null;
      newTask.createdAt = new Date().toISOString();
      
      // Calculate next due date
      switch (task.repeat) {
        case 'daily':
          newTask.dueDate = addDays(task.dueDate, 1);
          break;
        case 'weekly':
          newTask.dueDate = addDays(task.dueDate, 7);
          break;
        case 'monthly':
          newTask.dueDate = addMonths(task.dueDate, 1);
          break;
      }
      
      await dbPut('tasks', newTask);
    }
    
    await dbPut('tasks', task);
    await loadTasks();
    store.emit('task-toggled', task);
  } catch (err) {
    console.error('Error toggling task:', err);
    showToast('Ошибка изменения статуса', 'error');
  }
}

// ===== Note Operations =====
async function saveNote(note) {
  try {
    if (!note.id) {
      note.id = uuid();
      note.createdAt = new Date().toISOString();
    }
    note.updatedAt = new Date().toISOString();
    
    await dbPut('notes', note);
    await loadNotes();
    store.emit('note-saved', note);
    return note;
  } catch (err) {
    console.error('Error saving note:', err);
    showToast('Ошибка сохранения заметки', 'error');
    throw err;
  }
}

async function deleteNote(id) {
  try {
    await dbDelete('notes', id);
    await loadNotes();
    store.emit('note-deleted', id);
  } catch (err) {
    console.error('Error deleting note:', err);
    showToast('Ошибка удаления заметки', 'error');
  }
}

// ===== Project Operations =====
async function saveProject(project) {
  try {
    if (!project.id) {
      project.id = uuid();
      project.createdAt = new Date().toISOString();
    }
    project.updatedAt = new Date().toISOString();
    
    await dbPut('projects', project);
    await loadProjects();
    store.emit('project-saved', project);
    return project;
  } catch (err) {
    console.error('Error saving project:', err);
    showToast('Ошибка сохранения проекта', 'error');
    throw err;
  }
}

async function deleteProject(id) {
  try {
    // Don't delete tasks/notes, just remove project reference
    const tasks = store.get('tasks').filter(t => t.projectId === id);
    const notes = store.get('notes').filter(n => n.projectId === id);
    
    for (const task of tasks) {
      task.projectId = null;
      await dbPut('tasks', task);
    }
    
    for (const note of notes) {
      note.projectId = null;
      await dbPut('notes', note);
    }
    
    await dbDelete('projects', id);
    await Promise.all([loadProjects(), loadTasks(), loadNotes()]);
    store.emit('project-deleted', id);
  } catch (err) {
    console.error('Error deleting project:', err);
    showToast('Ошибка удаления проекта', 'error');
  }
}
// ===== Toast Notifications =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ===== Navigation =====
async function navigateTo(viewName) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  
  // Show target view
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.add('active');
  }
  
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const activeNavItem = document.querySelector(`[data-view="${viewName}"]`);
  if (activeNavItem) {
    activeNavItem.classList.add('active');
  }
  
  // Update header title
  const titles = {
    dashboard: 'Главная',
    tasks: 'Задачи',
    calendar: 'Календарь',
    notes: 'Заметки',
    projects: 'Проекты',
    stats: 'Статистика',
    archive: 'Архив',
    settings: 'Настройки',
    search: 'Поиск'
  };
  
  document.getElementById('page-title').textContent = titles[viewName] || 'Planner Pro';
  
  store.set('currentView', viewName);
  
  // Render view content
  await renderView(viewName);
  
  // Close menu if open
  closeMenuPanel();
}

async function renderView(viewName) {
  switch(viewName) {
    case 'dashboard':
      await renderDashboard();
      break;
    case 'tasks':
      renderTasks();
      break;
    case 'calendar':
      renderCalendar();
      break;
    case 'notes':
      renderNotes();
      break;
    case 'projects':
      renderProjects();
      break;
    case 'stats':
      renderStats();
      break;
    case 'archive':
      renderArchive();
      break;
    case 'settings':
      await renderSettings();
      break;
  }
}

// ===== Dashboard Rendering =====
async function renderDashboard() {
  const tasks = store.get('tasks');
  const notes = store.get('notes');
  const projects = store.get('projects');
  
  // Greeting
  const now = new Date();
  const hour = now.getHours();
  let greeting = 'Добрый день!';
  if (hour < 6) greeting = 'Доброй ночи!';
  else if (hour < 12) greeting = 'Доброе утро!';
  else if (hour < 18) greeting = 'Добрый день!';
  else greeting = 'Добрый вечер!';
  
  document.getElementById('welcome-greeting').textContent = greeting;
  document.getElementById('welcome-date').textContent = formatDate(now);
  
  // Day progress
  const todayTasks = tasks.filter(t => t.status !== 'deleted' && isToday(t.dueDate));
  const completedToday = todayTasks.filter(t => t.status === 'completed').length;
  const progress = todayTasks.length > 0 ? Math.round((completedToday / todayTasks.length) * 100) : 0;
  
  document.getElementById('day-progress-value').textContent = `${progress}%`;
  document.getElementById('day-progress-fill').style.width = `${progress}%`;
  
  // Upcoming tasks (next N days)
  const upcomingDays = parseInt(await getSetting('upcomingDays', 3));
  const upcoming = tasks.filter(t => {
    if (t.status === 'deleted' || t.status === 'completed' || !t.dueDate) return false;
    const dueDate = new Date(t.dueDate);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + upcomingDays);
    return dueDate >= new Date() && dueDate <= maxDate;
  }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  
  renderTaskList(upcoming, 'dashboard-upcoming-tasks', 'dashboard-upcoming-empty');
  document.getElementById('upcoming-days-count').textContent = upcoming.length;
  
  // Overdue tasks
  const overdue = tasks.filter(t => t.status === 'active' && isOverdue(t.dueDate));
  
  if (overdue.length > 0) {
    document.getElementById('dashboard-overdue-section').classList.remove('hidden');
    document.getElementById('overdue-count').textContent = overdue.length;
    renderTaskList(overdue, 'dashboard-overdue-tasks');
  } else {
    document.getElementById('dashboard-overdue-section').classList.add('hidden');
  }
  
  // Recent projects
  const recentProjects = projects.slice(0, 5);
  renderProjectCards(recentProjects, 'dashboard-recent-projects', 'dashboard-projects-empty');
  
  // Pinned notes
  const pinnedNotes = notes.filter(n => n.isPinned).slice(0, 6);
  renderNoteCards(pinnedNotes, 'dashboard-pinned-notes', 'dashboard-pinned-empty');
}

// ===== Task Rendering =====
function renderTasks() {
  const tasks = store.get('tasks');
  const activeTab = document.querySelector('#tasks-tabs .tab.active')?.dataset.tab || 'all';
  
  let filtered = [];
  
  switch(activeTab) {
    case 'all':
      filtered = tasks.filter(t => t.status === 'active');
      break;
    case 'today':
      filtered = tasks.filter(t => t.status === 'active' && isToday(t.dueDate));
      break;
    case 'upcoming':
      filtered = tasks.filter(t => {
        if (t.status !== 'active' || !t.dueDate) return false;
        const dueDate = new Date(t.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return dueDate > today;
      });
      break;
    case 'someday':
      filtered = tasks.filter(t => t.status === 'active' && !t.dueDate);
      break;
  }
  
  filtered.sort((a, b) => {
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
  
  renderTaskList(filtered, `${activeTab}-tasks`, `${activeTab}-empty`);
}

function renderTaskList(tasks, containerId, emptyId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (tasks.length === 0) {
    if (emptyId) {
      document.getElementById(emptyId)?.classList.remove('hidden');
    }
    return;
  }
  
  if (emptyId) {
    document.getElementById(emptyId)?.classList.add('hidden');
  }
  
  tasks.forEach(task => {
    const item = createTaskElement(task);
    container.appendChild(item);
  });
}

function createTaskElement(task) {
  const item = document.createElement('div');
  item.className = 'task-item';
  if (task.status === 'completed') item.classList.add('completed');
  if (isOverdue(task.dueDate) && task.status !== 'completed') item.classList.add('overdue');
  
  const projects = store.get('projects');
  const project = projects.find(p => p.id === task.projectId);
  
  let metaHTML = '';
  
  if (task.dueDate) {
    const dateClass = isOverdue(task.dueDate) && task.status !== 'completed' ? 'overdue' : '';
    metaHTML += `
      <div class="task-date ${dateClass}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        ${formatDate(task.dueDate)}
      </div>
    `;
  }
  
  if (task.startTime || task.endTime) {
    metaHTML += `
      <div class="task-meta-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        ${formatTime(task.startTime)}${task.endTime ? ' - ' + formatTime(task.endTime) : ''}
      </div>
    `;
  }
  
  if (project) {
    metaHTML += `<span class="task-project-tag" style="background:${project.color}22;border-color:${project.color};color:${project.color}">${project.icon || '📁'} ${project.name}</span>`;
  }
  
  if (task.subtasks && task.subtasks.length > 0) {
    const completed = task.subtasks.filter(st => st.completed).length;
    const total = task.subtasks.length;
    const percent = Math.round((completed / total) * 100);
    
    metaHTML += `
      <div class="task-subtasks-progress">
        <span>${completed}/${total}</span>
        <div class="task-subtasks-bar">
          <div class="task-subtasks-fill" style="width:${percent}%"></div>
        </div>
      </div>
    `;
  }
  
  item.innerHTML = `
    <div class="task-header">
      <div class="task-checkbox">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div class="task-content">
        <div class="task-title">${sanitizeHTML(task.title)}</div>
        ${task.description ? `<div class="task-desc">${sanitizeHTML(task.description)}</div>` : ''}
        ${metaHTML ? `<div class="task-meta">${metaHTML}</div>` : ''}
      </div>
      <span class="task-priority priority-${task.priority || 'medium'}"></span>
    </div>
  `;
  
  // Event listeners
  const checkbox = item.querySelector('.task-checkbox');
  checkbox.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTaskComplete(task.id);
  });
  
  item.addEventListener('click', () => {
    openTaskModal(task);
  });
  
  return item;
}

// ===== Calendar Rendering =====
let currentCalendarMonth = new Date().getMonth();
let currentCalendarYear = new Date().getFullYear();

function renderCalendar() {
  document.getElementById('cal-month-year').textContent = getMonthName(currentCalendarYear, currentCalendarMonth);
  
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';
  
  // Day labels
  const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  dayLabels.forEach(label => {
    const cell = document.createElement('div');
    cell.className = 'cal-day-label';
    cell.textContent = label;
    grid.appendChild(cell);
  });
  
  // Days
  const firstDay = getFirstDayOfMonth(currentCalendarYear, currentCalendarMonth);
  const daysInMonth = getDaysInMonth(currentCalendarYear, currentCalendarMonth);
  const daysInPrevMonth = getDaysInMonth(currentCalendarYear, currentCalendarMonth - 1);
  
  const tasks = store.get('tasks');
  const today = new Date();
  
  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const cell = createCalendarDayCell(day, currentCalendarMonth - 1, currentCalendarYear, true);
    grid.appendChild(cell);
  }
  
  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = createCalendarDayCell(day, currentCalendarMonth, currentCalendarYear, false);
    
    // Check if today
    if (day === today.getDate() && 
        currentCalendarMonth === today.getMonth() && 
        currentCalendarYear === today.getFullYear()) {
      cell.classList.add('today');
    }
    
    // Check if has tasks
    const dateStr = formatDateISO(new Date(currentCalendarYear, currentCalendarMonth, day));
    const dayTasks = tasks.filter(t => t.status !== 'deleted' && t.dueDate === dateStr);
    
    if (dayTasks.length > 0) {
      cell.classList.add('has-tasks');
    }
    
    grid.appendChild(cell);
  }
  
  // Next month days
  const totalCells = firstDay + daysInMonth;
  const remainingCells = 42 - totalCells; // 6 rows * 7 days
  
  for (let day = 1; day <= remainingCells; day++) {
    const cell = createCalendarDayCell(day, currentCalendarMonth + 1, currentCalendarYear, true);
    grid.appendChild(cell);
  }
}

function createCalendarDayCell(day, month, year, isOtherMonth) {
  const cell = document.createElement('div');
  cell.className = 'cal-day';
  if (isOtherMonth) cell.classList.add('other-month');
  cell.textContent = day;
  
  cell.addEventListener('click', () => {
    openDaySheet(new Date(year, month, day));
  });
  
  return cell;
}

// ===== Notes Rendering =====
function renderNotes() {
  const notes = store.get('notes');
  const searchQuery = document.getElementById('notes-search-input').value.toLowerCase();
  
  let filtered = notes;
  
  if (searchQuery) {
    filtered = notes.filter(n => 
      n.title.toLowerCase().includes(searchQuery) ||
      stripHTML(n.content).toLowerCase().includes(searchQuery)
    );
  }
  
  filtered.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  
  renderNoteCards(filtered, 'notes-grid', 'notes-empty');
}

function renderNoteCards(notes, containerId, emptyId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (notes.length === 0) {
    if (emptyId) {
      document.getElementById(emptyId)?.classList.remove('hidden');
    }
    return;
  }
  
  if (emptyId) {
    document.getElementById(emptyId)?.classList.add('hidden');
  }
  
  notes.forEach(note => {
    const card = createNoteElement(note);
    container.appendChild(card);
  });
}

function createNoteElement(note) {
  const card = document.createElement('div');
  card.className = 'note-card';
  if (note.isPinned) card.classList.add('pinned');
  
  const preview = stripHTML(note.content);
  const projects = store.get('projects');
  const project = projects.find(p => p.id === note.projectId);
  
  card.innerHTML = `
    <div class="note-title">${sanitizeHTML(note.title || 'Без названия')}</div>
    <div class="note-preview">${truncate(preview, 120)}</div>
    <div class="note-footer">
      <span>${formatDate(note.updatedAt)}</span>
      ${project ? `<span style="color:${project.color}">${project.icon || '📁'}</span>` : ''}
    </div>
  `;
  
  card.addEventListener('click', () => {
    openNoteModal(note);
  });
  
  return card;
}

// ===== Projects Rendering =====
function renderProjects() {
  const projects = store.get('projects');
  renderProjectCards(projects, 'projects-list', 'projects-empty');
}

function renderProjectCards(projects, containerId, emptyId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (projects.length === 0) {
    if (emptyId) {
      document.getElementById(emptyId)?.classList.remove('hidden');
    }
    return;
  }
  
  if (emptyId) {
    document.getElementById(emptyId)?.classList.add('hidden');
  }
  
  const tasks = store.get('tasks');
  const notes = store.get('notes');
  
  projects.forEach(project => {
    const card = createProjectElement(project, tasks, notes);
    container.appendChild(card);
  });
}

function createProjectElement(project, tasks, notes) {
  const card = document.createElement('div');
  card.className = 'project-card';
  
  const projectTasks = tasks.filter(t => t.projectId === project.id && t.status !== 'deleted');
  const projectNotes = notes.filter(n => n.projectId === project.id);
  const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
  
  card.innerHTML = `
    <div class="project-icon" style="background:${project.color}22;border-color:${project.color};color:${project.color}">
      ${project.icon || '📁'}
    </div>
    <div class="project-info">
      <div class="project-name">${sanitizeHTML(project.name)}</div>
      ${project.description ? `<div class="project-desc">${sanitizeHTML(project.description)}</div>` : ''}
      <div class="project-stats">
        <span>${projectTasks.length} задач</span>
        <span>${projectNotes.length} заметок</span>
      </div>
    </div>
  `;
  
  card.addEventListener('click', () => {
    openProjectModal(project);
  });
  
  return card;
}
// ===== Stats Rendering =====
function renderStats() {
  const tasks = store.get('tasks');
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  
  const weekStart = getWeekStart(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Completed today
  const completedToday = tasks.filter(t => 
    t.status === 'completed' && 
    t.completedAt &&
    new Date(t.completedAt) >= todayStart
  ).length;
  
  document.getElementById('stat-completed-today').textContent = completedToday;
  
  // Completed this week
  const completedWeek = tasks.filter(t => 
    t.status === 'completed' && 
    t.completedAt &&
    new Date(t.completedAt) >= weekStart
  ).length;
  
  document.getElementById('stat-completed-week').textContent = completedWeek;
  
  // Completed this month
  const completedMonth = tasks.filter(t => 
    t.status === 'completed' && 
    t.completedAt &&
    new Date(t.completedAt) >= monthStart
  ).length;
  
  document.getElementById('stat-completed-month').textContent = completedMonth;
  
  // Active tasks
  const activeTasks = tasks.filter(t => t.status === 'active').length;
  document.getElementById('stat-total-active').textContent = activeTasks;
  
  // Heatmap (last 30 days)
  renderHeatmap(tasks);
  
  // By projects
  renderProjectsChart(tasks);
  
  // By priority
  renderPriorityChart(tasks);
}

function renderHeatmap(tasks) {
  const container = document.getElementById('stats-heatmap');
  container.innerHTML = '';
  
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = formatDateISO(date);
    
    const completed = tasks.filter(t => 
      t.status === 'completed' && 
      t.completedAt &&
      formatDateISO(new Date(t.completedAt)) === dateStr
    ).length;
    
    const level = completed === 0 ? 0 : Math.min(Math.ceil(completed / 2), 5);
    
    const day = document.createElement('div');
    day.className = 'heatmap-day';
    day.dataset.level = level;
    day.title = `${formatDate(date)}: ${completed} задач`;
    container.appendChild(day);
  }
}

function renderProjectsChart(tasks) {
  const container = document.getElementById('stats-projects-chart');
  container.innerHTML = '';
  
  const projects = store.get('projects');
  const projectStats = {};
  
  projects.forEach(p => {
    const completed = tasks.filter(t => t.projectId === p.id && t.status === 'completed').length;
    if (completed > 0) {
      projectStats[p.id] = { name: p.name, count: completed, color: p.color };
    }
  });
  
  // No project
  const noProject = tasks.filter(t => !t.projectId && t.status === 'completed').length;
  if (noProject > 0) {
    projectStats['none'] = { name: 'Без проекта', count: noProject, color: '#94a3b8' };
  }
  
  const maxCount = Math.max(...Object.values(projectStats).map(s => s.count), 1);
  
  Object.values(projectStats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .forEach(stat => {
      const item = document.createElement('div');
      item.className = 'chart-bar-item';
      
      const percent = (stat.count / maxCount) * 100;
      
      item.innerHTML = `
        <div class="chart-bar-label" style="color:${stat.color}">${stat.name}</div>
        <div class="chart-bar">
          <div class="chart-bar-fill" style="width:${percent}%;background:${stat.color}">
            <span class="chart-bar-value">${stat.count}</span>
          </div>
        </div>
      `;
      
      container.appendChild(item);
    });
}

function renderPriorityChart(tasks) {
  const container = document.getElementById('stats-priority-chart');
  container.innerHTML = '';
  
  const priorities = {
    high: { name: 'Высокий', count: 0, color: '#ef4444' },
    medium: { name: 'Средний', count: 0, color: '#f59e0b' },
    low: { name: 'Низкий', count: 0, color: '#10b981' }
  };
  
  tasks.filter(t => t.status === 'completed').forEach(t => {
    const priority = t.priority || 'medium';
    if (priorities[priority]) {
      priorities[priority].count++;
    }
  });
  
  const maxCount = Math.max(...Object.values(priorities).map(p => p.count), 1);
  
  Object.values(priorities).forEach(priority => {
    if (priority.count === 0) return;
    
    const item = document.createElement('div');
    item.className = 'chart-bar-item';
    
    const percent = (priority.count / maxCount) * 100;
    
    item.innerHTML = `
      <div class="chart-bar-label">${priority.name}</div>
      <div class="chart-bar">
        <div class="chart-bar-fill" style="width:${percent}%;background:${priority.color}">
          <span class="chart-bar-value">${priority.count}</span>
        </div>
      </div>
    `;
    
    container.appendChild(item);
  });
}

// ===== Archive Rendering =====
function renderArchive() {
  const tasks = store.get('tasks');
  
  // Completed tasks
  const completed = tasks.filter(t => t.status === 'completed');
  renderTaskList(completed, 'completed-tasks', 'completed-empty');
  
  // Deleted tasks
  const deleted = tasks.filter(t => t.status === 'deleted');
  renderTaskList(deleted, 'trash-tasks', 'trash-empty');
  
  const clearBtn = document.getElementById('clear-trash-btn');
  if (deleted.length > 0) {
    clearBtn.classList.remove('hidden');
  } else {
    clearBtn.classList.add('hidden');
  }
}

// ===== Settings Rendering =====
async function renderSettings() {
  const theme = await getSetting('theme', 'dark');
  const accent = await getSetting('accent', 'blue');
  const upcomingDays = await getSetting('upcomingDays', 3);
  
  document.getElementById('setting-theme').value = theme;
  document.getElementById('setting-accent').value = accent;
  document.getElementById('setting-upcoming-days').value = upcomingDays;
  document.getElementById('app-version').textContent = `v${APP_VERSION}`;
}

// ===== Task Modal =====
function openTaskModal(task = null) {
  const modal = document.getElementById('task-modal');
  const title = document.getElementById('task-modal-title');
  const titleInput = document.getElementById('task-title');
  const descInput = document.getElementById('task-desc');
  const projectSelect = document.getElementById('task-project');
  const dateInput = document.getElementById('task-date');
  const startTimeInput = document.getElementById('task-start-time');
  const endTimeInput = document.getElementById('task-end-time');
  const repeatSelect = document.getElementById('task-repeat');
  const deleteBtn = document.getElementById('task-delete-btn');
  
  // Reset form
  titleInput.value = '';
  descInput.value = '';
  projectSelect.value = '';
  dateInput.value = '';
  startTimeInput.value = '';
  endTimeInput.value = '';
  repeatSelect.value = 'none';
  
  // Clear subtasks and tags
  document.getElementById('task-subtasks-list').innerHTML = '';
  document.getElementById('task-tags-list').innerHTML = '';
  document.getElementById('task-subtask-input').value = '';
  document.getElementById('task-tag-input').value = '';
  
  // Reset priority buttons
  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.priority === 'medium') {
      btn.classList.add('active');
    }
  });
  
  // Populate projects
  const projects = store.get('projects');
  projectSelect.innerHTML = '<option value="">Без проекта</option>';
  projects.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = `${p.icon || '📁'} ${p.name}`;
    projectSelect.appendChild(option);
  });
  
  if (task) {
    title.textContent = 'Редактировать задачу';
    titleInput.value = task.title || '';
    descInput.value = task.description || '';
    projectSelect.value = task.projectId || '';
    dateInput.value = task.dueDate || '';
    startTimeInput.value = task.startTime || '';
    endTimeInput.value = task.endTime || '';
    repeatSelect.value = task.repeat || 'none';
    
    // Priority
    document.querySelectorAll('.priority-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.priority === (task.priority || 'medium')) {
        btn.classList.add('active');
      }
    });
    
    // Subtasks
    if (task.subtasks) {
      task.subtasks.forEach(st => {
        addSubtaskToList(st);
      });
    }
    
    // Tags
    if (task.tags) {
      task.tags.forEach(tag => {
        addTagToList(tag, 'task');
      });
    }
    
    deleteBtn.classList.remove('hidden');
    store.set('currentEditTask', task);
  } else {
    title.textContent = 'Новая задача';
    deleteBtn.classList.add('hidden');
    store.set('currentEditTask', null);
  }
  
  modal.classList.add('active');
}

function closeTaskModal() {
  document.getElementById('task-modal').classList.remove('active');
  store.set('currentEditTask', null);
}

async function saveTaskFromModal() {
  const title = document.getElementById('task-title').value.trim();
  
  if (!title) {
    showToast('Введите название задачи', 'error');
    return;
  }
  
  const currentTask = store.get('currentEditTask');
  
  const task = currentTask ? clone(currentTask) : {
    id: null,
    status: 'active',
    createdAt: null
  };
  
  task.title = title;
  task.description = document.getElementById('task-desc').value.trim();
  task.projectId = document.getElementById('task-project').value || null;
  task.dueDate = document.getElementById('task-date').value || null;
  task.startTime = document.getElementById('task-start-time').value || null;
  task.endTime = document.getElementById('task-end-time').value || null;
  task.repeat = document.getElementById('task-repeat').value || 'none';
  
  // Priority
  const activePriority = document.querySelector('.priority-btn.active');
  task.priority = activePriority ? activePriority.dataset.priority : 'medium';
  
  // Subtasks
  task.subtasks = [];
  document.querySelectorAll('#task-subtasks-list .subtask-item').forEach(item => {
    const checkbox = item.querySelector('.subtask-checkbox');
    const text = item.querySelector('.subtask-text').textContent;
    task.subtasks.push({
      id: uuid(),
      title: text,
      completed: checkbox.checked
    });
  });
  
  // Tags
  task.tags = [];
  document.querySelectorAll('#task-tags-list .tag').forEach(tag => {
    task.tags.push(tag.textContent.replace('×', '').trim());
  });
  
  await saveTask(task);
  closeTaskModal();
  showToast(currentTask ? 'Задача обновлена' : 'Задача создана', 'success');
  await renderView(store.get('currentView'));
}

async function deleteTaskFromModal() {
  const task = store.get('currentEditTask');
  if (!task) return;
  
  const confirmed = await showConfirm('Удалить задачу?');
  if (!confirmed) return;
  
  task.status = 'deleted';
  task.deletedAt = new Date().toISOString();
  await saveTask(task);
  
  closeTaskModal();
  showToast('Задача удалена', 'info');
  await renderView(store.get('currentView'));
}

// ===== Note Modal =====
function openNoteModal(note = null) {
  const modal = document.getElementById('note-modal');
  const title = document.getElementById('note-modal-title');
  const titleInput = document.getElementById('note-title');
  const editor = document.getElementById('note-editor');
  const projectSelect = document.getElementById('note-project');
  const pinnedCheckbox = document.getElementById('note-pinned');
  const favoriteCheckbox = document.getElementById('note-favorite');
  const deleteBtn = document.getElementById('note-delete-btn');
  
  // Reset
  titleInput.value = '';
  editor.innerHTML = '';
  projectSelect.value = '';
  pinnedCheckbox.checked = false;
  favoriteCheckbox.checked = false;
  document.getElementById('note-tags-list').innerHTML = '';
  document.getElementById('note-tag-input').value = '';
  
  // Populate projects
  const projects = store.get('projects');
  projectSelect.innerHTML = '<option value="">Без проекта</option>';
  projects.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = `${p.icon || '📁'} ${p.name}`;
    projectSelect.appendChild(option);
  });
  
  if (note) {
    title.textContent = 'Редактировать заметку';
    titleInput.value = note.title || '';
    editor.innerHTML = note.content || '';
    projectSelect.value = note.projectId || '';
    pinnedCheckbox.checked = note.isPinned || false;
    favoriteCheckbox.checked = note.isFavorite || false;
    
    if (note.tags) {
      note.tags.forEach(tag => {
        addTagToList(tag, 'note');
      });
    }
    
    deleteBtn.classList.remove('hidden');
    store.set('currentEditNote', note);
  } else {
    title.textContent = 'Новая заметка';
    deleteBtn.classList.add('hidden');
    store.set('currentEditNote', null);
  }
  
  modal.classList.add('active');
  editor.focus();
}

function closeNoteModal() {
  document.getElementById('note-modal').classList.remove('active');
  store.set('currentEditNote', null);
}

async function saveNoteFromModal() {
  const title = document.getElementById('note-title').value.trim();
  const content = document.getElementById('note-editor').innerHTML.trim();
  
  if (!title && !content) {
    showToast('Заполните заголовок или содержимое', 'error');
    return;
  }
  
  const currentNote = store.get('currentEditNote');
  
  const note = currentNote ? clone(currentNote) : {
    id: null,
    createdAt: null
  };
  
  note.title = title;
  note.content = content;
  note.projectId = document.getElementById('note-project').value || null;
  note.isPinned = document.getElementById('note-pinned').checked;
  note.isFavorite = document.getElementById('note-favorite').checked;
  
  // Tags
  note.tags = [];
  document.querySelectorAll('#note-tags-list .tag').forEach(tag => {
    note.tags.push(tag.textContent.replace('×', '').trim());
  });
  
  await saveNote(note);
  closeNoteModal();
  showToast(currentNote ? 'Заметка обновлена' : 'Заметка создана', 'success');
  await renderView(store.get('currentView'));
}

async function deleteNoteFromModal() {
  const note = store.get('currentEditNote');
  if (!note) return;
  
  const confirmed = await showConfirm('Удалить заметку?');
  if (!confirmed) return;
  
  await deleteNote(note.id);
  closeNoteModal();
  showToast('Заметка удалена', 'info');
  await renderView(store.get('currentView'));
}

// ===== Project Modal =====
function openProjectModal(project = null) {
  const modal = document.getElementById('project-modal');
  const title = document.getElementById('project-modal-title');
  const nameInput = document.getElementById('project-name');
  const descInput = document.getElementById('project-desc');
  const iconInput = document.getElementById('project-icon');
  const deleteBtn = document.getElementById('project-delete-btn');
  
  // Reset
  nameInput.value = '';
  descInput.value = '';
  iconInput.value = '';
  
  // Reset color picker
  document.querySelectorAll('.color-option').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector('.color-option').classList.add('active');
  
  if (project) {
    title.textContent = 'Редактировать проект';
    nameInput.value = project.name || '';
    descInput.value = project.description || '';
    iconInput.value = project.icon || '';
    
    // Select color
    document.querySelectorAll('.color-option').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.color === project.color) {
        btn.classList.add('active');
      }
    });
    
    deleteBtn.classList.remove('hidden');
    store.set('currentEditProject', project);
  } else {
    title.textContent = 'Новый проект';
    deleteBtn.classList.add('hidden');
    store.set('currentEditProject', null);
  }
  
  modal.classList.add('active');
}

function closeProjectModal() {
  document.getElementById('project-modal').classList.remove('active');
  store.set('currentEditProject', null);
}

async function saveProjectFromModal() {
  const name = document.getElementById('project-name').value.trim();
  
  if (!name) {
    showToast('Введите название проекта', 'error');
    return;
  }
  
  const currentProject = store.get('currentEditProject');
  
  const project = currentProject ? clone(currentProject) : {
    id: null,
    createdAt: null
  };
  
  project.name = name;
  project.description = document.getElementById('project-desc').value.trim();
  project.icon = document.getElementById('project-icon').value.trim() || '📁';
  
  const activeColor = document.querySelector('.color-option.active');
  project.color = activeColor ? activeColor.dataset.color : PROJECT_COLORS[0];
  
  await saveProject(project);
  closeProjectModal();
  showToast(currentProject ? 'Проект обновлён' : 'Проект создан', 'success');
  await renderView(store.get('currentView'));
}

async function deleteProjectFromModal() {
  const project = store.get('currentEditProject');
  if (!project) return;
  
  const confirmed = await showConfirm('Удалить проект? Задачи и заметки останутся.');
  if (!confirmed) return;
  
  await deleteProject(project.id);
  closeProjectModal();
  showToast('Проект удалён', 'info');
  await renderView(store.get('currentView'));
}

// ===== Day Sheet =====
function openDaySheet(date) {
  const sheet = document.getElementById('day-sheet');
  const title = document.getElementById('day-sheet-title');
  const container = document.getElementById('day-sheet-tasks');
  const emptyState = document.getElementById('day-sheet-empty');
  
  title.textContent = formatDate(date);
  
  const tasks = store.get('tasks');
  const dateStr = formatDateISO(date);
  const dayTasks = tasks.filter(t => t.status !== 'deleted' && t.dueDate === dateStr);
  
  container.innerHTML = '';
  
  if (dayTasks.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    dayTasks.forEach(task => {
      const item = createTaskElement(task);
      container.appendChild(item);
    });
  }
  
  sheet.classList.add('active');
  
  // Store selected date for "Add task" button
  sheet.dataset.selectedDate = dateStr;
}

function closeDaySheet() {
  document.getElementById('day-sheet').classList.remove('active');
}

// ===== Confirm Dialog =====
function showConfirm(message) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirm-dialog');
    const messageEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    
    messageEl.textContent = message;
    dialog.classList.add('active');
    
    const handleOk = () => {
      cleanup();
      resolve(true);
    };
    
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };
    
    const cleanup = () => {
      dialog.classList.remove('active');
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
    };
    
    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

// ===== Helper Functions =====
function addSubtaskToList(subtask) {
  const list = document.getElementById('task-subtasks-list');
  const item = document.createElement('div');
  item.className = 'subtask-item';
  
  item.innerHTML = `
    <input type="checkbox" class="subtask-checkbox" ${subtask.completed ? 'checked' : ''}>
    <span class="subtask-text">${sanitizeHTML(subtask.title)}</span>
    <button class="subtask-remove">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;
  
  item.querySelector('.subtask-remove').addEventListener('click', () => {
    item.remove();
  });
  
  list.appendChild(item);
}

function addTagToList(tagText, type) {
  const list = document.getElementById(`${type}-tags-list`);
  const tag = document.createElement('div');
  tag.className = 'tag';
  
  tag.innerHTML = `
    ${sanitizeHTML(tagText)}
    <button class="tag-remove">×</button>
  `;
  
  tag.querySelector('.tag-remove').addEventListener('click', () => {
    tag.remove();
  });
  
  list.appendChild(tag);
}
// ===== FAB Menu =====
function toggleFabMenu() {
  const menu = document.getElementById('fab-menu');
  const fab = document.getElementById('fab-btn');
  
  if (menu.classList.contains('active')) {
    menu.classList.remove('active');
    fab.classList.remove('active');
    // Возвращаем hidden через небольшую задержку для анимации
    setTimeout(() => {
      if (!menu.classList.contains('active')) {
        menu.classList.add('hidden');
      }
    }, 300);
  } else {
    menu.classList.remove('hidden');
    // Даём время браузеру для применения display
    setTimeout(() => {
      menu.classList.add('active');
      fab.classList.add('active');
    }, 10);
  }
}

function closeFabMenu() {
  const menu = document.getElementById('fab-menu');
  const fab = document.getElementById('fab-btn');
  menu.classList.remove('active');
  fab.classList.remove('active');
  setTimeout(() => {
    if (!menu.classList.contains('active')) {
      menu.classList.add('hidden');
    }
  }, 300);
}

// ===== Menu Panel =====
function toggleMenuPanel() {
  const panel = document.getElementById('menu-panel');
  
  if (panel.classList.contains('active')) {
    panel.classList.remove('active');
  } else {
    panel.classList.add('active');
  }
}

function closeMenuPanel() {
  document.getElementById('menu-panel').classList.remove('active');
}

// ===== Search =====
async function openSearch() {
  await navigateTo('search');
  setTimeout(() => {
    document.getElementById('search-input').focus();
  }, 100);
}

async function closeSearch() {
  await navigateTo('dashboard');
}

const performSearch = debounce(() => {
  const query = document.getElementById('search-input').value.toLowerCase().trim();
  const filter = document.querySelector('.filter-chip.active').dataset.filter;
  const container = document.getElementById('search-results');
  
  if (!query) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>Введите запрос для поиска</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  const tasks = store.get('tasks');
  const notes = store.get('notes');
  const projects = store.get('projects');
  
  let results = [];
  
  if (filter === 'all' || filter === 'tasks') {
    const matchingTasks = tasks.filter(t => 
      t.status !== 'deleted' &&
      (t.title.toLowerCase().includes(query) || 
       (t.description && t.description.toLowerCase().includes(query)))
    );
    
    matchingTasks.forEach(task => {
      const item = createTaskElement(task);
      container.appendChild(item);
      results.push(task);
    });
  }
  
  if (filter === 'all' || filter === 'notes') {
    const matchingNotes = notes.filter(n => 
      n.title.toLowerCase().includes(query) || 
      stripHTML(n.content).toLowerCase().includes(query)
    );
    
    matchingNotes.forEach(note => {
      const card = createNoteElement(note);
      container.appendChild(card);
      results.push(note);
    });
  }
  
  if (filter === 'all' || filter === 'projects') {
    const matchingProjects = projects.filter(p => 
      p.name.toLowerCase().includes(query) || 
      (p.description && p.description.toLowerCase().includes(query))
    );
    
    matchingProjects.forEach(project => {
      const tasks = store.get('tasks');
      const notes = store.get('notes');
      const card = createProjectElement(project, tasks, notes);
      container.appendChild(card);
      results.push(project);
    });
  }
  
  if (results.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>Ничего не найдено</p>
      </div>
    `;
  }
}, 300);

// ===== Data Export/Import =====
async function exportData() {
  try {
    const data = {
      version: APP_VERSION,
      exportDate: new Date().toISOString(),
      tasks: store.get('tasks'),
      notes: store.get('notes'),
      projects: store.get('projects'),
      tags: store.get('tags')
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `planner-backup-${formatDateISO(new Date())}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('Данные экспортированы', 'success');
  } catch (err) {
    console.error('Export error:', err);
    showToast('Ошибка экспорта', 'error');
  }
}

async function importData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!data.tasks || !data.notes || !data.projects) {
      throw new Error('Invalid backup file');
    }
    
    const confirmed = await showConfirm('Импортировать данные? Текущие данные будут заменены.');
    if (!confirmed) return;
    
    // Clear existing data
    await dbClear('tasks');
    await dbClear('notes');
    await dbClear('projects');
    await dbClear('tags');
    
    // Import new data
    for (const task of data.tasks) {
      await dbPut('tasks', task);
    }
    
    for (const note of data.notes) {
      await dbPut('notes', note);
    }
    
    for (const project of data.projects) {
      await dbPut('projects', project);
    }
    
    if (data.tags) {
      for (const tag of data.tags) {
        await dbPut('tags', tag);
      }
    }
    
    await loadAllData();
    await renderView(store.get('currentView'));
    showToast('Данные импортированы', 'success');
  } catch (err) {
    console.error('Import error:', err);
    showToast('Ошибка импорта', 'error');
  }
}

async function clearAllData() {
  const confirmed = await showConfirm('Удалить ВСЕ данные? Это действие необратимо!');
  if (!confirmed) return;
  
  try {
    await dbClear('tasks');
    await dbClear('notes');
    await dbClear('projects');
    await dbClear('tags');
    
    await loadAllData();
    await renderView(store.get('currentView'));
    showToast('Все данные удалены', 'info');
  } catch (err) {
    console.error('Clear error:', err);
    showToast('Ошибка очистки данных', 'error');
  }
}

async function clearTrash() {
  const confirmed = await showConfirm('Очистить корзину?');
  if (!confirmed) return;
  
  try {
    const tasks = store.get('tasks');
    const deleted = tasks.filter(t => t.status === 'deleted');
    
    for (const task of deleted) {
      await dbDelete('tasks', task.id);
    }
    
    await loadTasks();
    renderArchive();
    showToast('Корзина очищена', 'info');
  } catch (err) {
    console.error('Clear trash error:', err);
    showToast('Ошибка очистки корзины', 'error');
  }
}

// ===== Theme Management =====
async function applyTheme() {
  const theme = await getSetting('theme', 'dark');
  const accent = await getSetting('accent', 'blue');
  
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-accent', accent);
}

async function setTheme(theme) {
  await setSetting('theme', theme);
  await applyTheme();
}

async function setAccent(accent) {
  await setSetting('accent', accent);
  await applyTheme();
}

// ===== Note Editor Formatting =====
function formatNoteText(format) {
  const editor = document.getElementById('note-editor');
  editor.focus();
  
  switch(format) {
    case 'h1':
      document.execCommand('formatBlock', false, '<h1>');
      break;
    case 'h2':
      document.execCommand('formatBlock', false, '<h2>');
      break;
    case 'bold':
      document.execCommand('bold');
      break;
    case 'italic':
      document.execCommand('italic');
      break;
    case 'strike':
      document.execCommand('strikeThrough');
      break;
    case 'ul':
      document.execCommand('insertUnorderedList');
      break;
    case 'ol':
      document.execCommand('insertOrderedList');
      break;
    case 'checkbox':
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      document.execCommand('insertHTML', false, checkbox.outerHTML + ' ');
      break;
  }
}

// ===== PWA Install =====
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  const banner = document.getElementById('install-banner');
  banner.classList.remove('hidden');
});

async function installApp() {
  if (!deferredPrompt) return;
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    showToast('Приложение установлено!', 'success');
  }
  
  deferredPrompt = null;
  document.getElementById('install-banner').classList.add('hidden');
}

function dismissInstallBanner() {
  document.getElementById('install-banner').classList.add('hidden');
}

// ===== Service Worker =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => {
        console.log('Service Worker registered:', reg);
        
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              const updateToast = document.getElementById('update-toast');
              updateToast.classList.remove('hidden');
              
              document.getElementById('update-btn').addEventListener('click', () => {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              });
            }
          });
        });
      })
      .catch(err => console.error('Service Worker registration failed:', err));
  });
  
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// ===== Event Listeners Setup =====
function setupEventListeners() {
  // Bottom nav
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.view);
    });
  });
  
  // FAB
  document.getElementById('fab-btn').addEventListener('click', toggleFabMenu);
  document.querySelector('#fab-menu .fab-overlay').addEventListener('click', closeFabMenu);
  
  document.querySelectorAll('.fab-action').forEach(action => {
    action.addEventListener('click', () => {
      closeFabMenu();
      const type = action.dataset.action;
      
      if (type === 'task') openTaskModal();
      else if (type === 'note') openNoteModal();
      else if (type === 'project') openProjectModal();
    });
  });
  
  // Menu panel
  document.getElementById('menu-btn').addEventListener('click', toggleMenuPanel);
  document.querySelector('#menu-panel .menu-overlay').addEventListener('click', closeMenuPanel);
  document.querySelector('#menu-panel .menu-close').addEventListener('click', closeMenuPanel);
  
  document.querySelectorAll('.menu-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.view);
    });
  });
  
  // Search
  document.getElementById('header-search-btn').addEventListener('click', openSearch);
  document.getElementById('search-close-btn').addEventListener('click', closeSearch);
  document.getElementById('search-input').addEventListener('input', performSearch);
  
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      performSearch();
    });
  });
  
  // Task modal
  document.querySelectorAll('#task-modal .modal-close, #task-modal .modal-overlay').forEach(el => {
    el.addEventListener('click', closeTaskModal);
  });
  
  document.getElementById('task-save-btn').addEventListener('click', saveTaskFromModal);
  document.getElementById('task-delete-btn').addEventListener('click', deleteTaskFromModal);
  
  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  document.getElementById('task-subtask-add-btn').addEventListener('click', () => {
    const input = document.getElementById('task-subtask-input');
    const text = input.value.trim();
    if (text) {
      addSubtaskToList({ title: text, completed: false });
      input.value = '';
    }
  });
  
  document.getElementById('task-tag-add-btn').addEventListener('click', () => {
    const input = document.getElementById('task-tag-input');
    const text = input.value.trim();
    if (text) {
      addTagToList(text, 'task');
      input.value = '';
    }
  });
  
  // Note modal
  document.querySelectorAll('#note-modal .modal-close, #note-modal .modal-overlay').forEach(el => {
    el.addEventListener('click', closeNoteModal);
  });
  
  document.getElementById('note-save-btn').addEventListener('click', saveNoteFromModal);
  document.getElementById('note-delete-btn').addEventListener('click', deleteNoteFromModal);
  
  document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      formatNoteText(btn.dataset.format);
    });
  });
  
  document.getElementById('note-tag-add-btn').addEventListener('click', () => {
    const input = document.getElementById('note-tag-input');
    const text = input.value.trim();
    if (text) {
      addTagToList(text, 'note');
      input.value = '';
    }
  });
  
  // Project modal
  document.querySelectorAll('#project-modal .modal-close, #project-modal .modal-overlay').forEach(el => {
    el.addEventListener('click', closeProjectModal);
  });
  
  document.getElementById('project-save-btn').addEventListener('click', saveProjectFromModal);
  document.getElementById('project-delete-btn').addEventListener('click', deleteProjectFromModal);
  
  document.querySelectorAll('.color-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  // Day sheet
  document.querySelectorAll('#day-sheet .sheet-overlay, #day-sheet .sheet-close').forEach(el => {
    el.addEventListener('click', closeDaySheet);
  });
  
  document.getElementById('day-sheet-add-btn').addEventListener('click', () => {
    const sheet = document.getElementById('day-sheet');
    const selectedDate = sheet.dataset.selectedDate;
    closeDaySheet();
    
    openTaskModal();
    if (selectedDate) {
      setTimeout(() => {
        document.getElementById('task-date').value = selectedDate;
      }, 100);
    }
  });
  
  // Tasks tabs
  document.querySelectorAll('#tasks-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#tasks-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      document.querySelectorAll('#view-tasks .tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      
      renderTasks();
    });
  });
  
  // Archive tabs
  document.querySelectorAll('#view-archive .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#view-archive .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      document.querySelectorAll('#view-archive .tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
  
  document.getElementById('clear-trash-btn').addEventListener('click', clearTrash);
  
  // Calendar
  document.getElementById('cal-prev').addEventListener('click', () => {
    currentCalendarMonth--;
    if (currentCalendarMonth < 0) {
      currentCalendarMonth = 11;
      currentCalendarYear--;
    }
    renderCalendar();
  });
  
  document.getElementById('cal-next').addEventListener('click', () => {
    currentCalendarMonth++;
    if (currentCalendarMonth > 11) {
      currentCalendarMonth = 0;
      currentCalendarYear++;
    }
    renderCalendar();
  });
  
  document.getElementById('cal-today').addEventListener('click', () => {
    const today = new Date();
    currentCalendarMonth = today.getMonth();
    currentCalendarYear = today.getFullYear();
    renderCalendar();
  });
  
  // Notes search
  document.getElementById('notes-search-input').addEventListener('input', debounce(() => {
    renderNotes();
  }, 300));
  
  // Settings
  document.getElementById('setting-theme').addEventListener('change', (e) => {
    setTheme(e.target.value);
  });
  
  document.getElementById('setting-accent').addEventListener('change', (e) => {
    setAccent(e.target.value);
  });
  
  document.getElementById('setting-upcoming-days').addEventListener('change', async (e) => {
    await setSetting('upcomingDays', parseInt(e.target.value));
    if (store.get('currentView') === 'dashboard') {
      await renderDashboard();
    }
  });
  
  document.getElementById('export-data-btn').addEventListener('click', exportData);
  
  document.getElementById('import-data-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });
  
  document.getElementById('import-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importData(file);
      e.target.value = '';
    }
  });
  
  document.getElementById('clear-data-btn').addEventListener('click', clearAllData);
  
  // Install banner
  document.getElementById('install-btn').addEventListener('click', installApp);
  document.getElementById('install-dismiss').addEventListener('click', dismissInstallBanner);
  
  // Prevent modal body clicks from closing modals
  document.querySelectorAll('.modal-content, .sheet-content, .menu-content').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });
}

// ===== Initialization =====
async function init() {
  try {
    // Open database
    await openDB();
    
    // Load data
    await loadAllData();
    
    // Apply theme
    await applyTheme();
    
    // Setup event listeners
    setupEventListeners();
    
    // Render initial view
    await navigateTo('dashboard');
    
    // Hide splash screen
    setTimeout(() => {
      document.getElementById('splash-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
    }, 2000);
    
    console.log('Planner Pro initialized successfully');
  } catch (err) {
    console.error('Initialization error:', err);
    showToast('Ошибка инициализации приложения', 'error');
  }
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
