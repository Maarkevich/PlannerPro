import {
  getAll,
  saveItem,
  deleteItem,
  setSetting,
  getSetting
} from './db.js';

import {
  generateId
} from './utils.js';

/* =========================
   GLOBAL STATE
========================= */

export const state = {

  tasks: [],
  notes: [],
  projects: [],

  currentView: 'dashboard',

  currentTaskTab: 'all',

  calendarDate: new Date(),

  settings: {
    theme: 'dark',
    accent: 'ocean'
  }

};

/* =========================
   LOAD
========================= */

export async function loadState() {

  const [
    tasks,
    notes,
    projects,
    theme,
    accent
  ] = await Promise.all([

    getAll('tasks'),
    getAll('notes'),
    getAll('projects'),

    getSetting('theme'),
    getSetting('accent')

  ]);

  state.tasks =
    sortByUpdated(tasks);

  state.notes =
    sortByUpdated(notes);

  state.projects =
    sortByUpdated(projects);

  if (theme?.value) {
    state.settings.theme =
      theme.value;
  }

  if (accent?.value) {
    state.settings.accent =
      accent.value;
  }

}

/* =========================
   SORT
========================= */

function sortByUpdated(items) {

  return [...items].sort(
    (a, b) =>
      (b.updatedAt || 0)
      -
      (a.updatedAt || 0)
  );

}

/* =========================
   TASKS
========================= */

export async function createTask(
  data
) {

  const task = {
    id: generateId(),

    title:
      data.title || '',

    description:
      data.description || '',

    completed: false,

    priority:
      data.priority || 'medium',

    dueDate:
      data.dueDate || null,

    projectId:
      data.projectId || null,

    subtasks:
      data.subtasks || []
  };

  const saved =
    await saveItem(
      'tasks',
      task
    );

  state.tasks.unshift(saved);

  return saved;

}

export async function updateTask(
  id,
  updates
) {

  const task =
    state.tasks.find(
      (item) => item.id === id
    );

  if (!task) {
    return null;
  }

  Object.assign(task, updates);

  await saveItem(
    'tasks',
    task
  );

  return task;

}

export async function toggleTask(
  id
) {

  const task =
    state.tasks.find(
      (item) => item.id === id
    );

  if (!task) {
    return;
  }

  task.completed =
    !task.completed;

  task.completedAt =
    task.completed
      ? Date.now()
      : null;

  await saveItem(
    'tasks',
    task
  );

}

export async function removeTask(
  id
) {

  state.tasks =
    state.tasks.filter(
      (item) => item.id !== id
    );

  await deleteItem(
    'tasks',
    id
  );

}

/* =========================
   NOTES
========================= */

export async function createNote(
  data
) {

  const note = {
    id: generateId(),

    title:
      data.title || '',

    content:
      data.content || '',

    pinned:
      !!data.pinned
  };

  const saved =
    await saveItem(
      'notes',
      note
    );

  state.notes.unshift(saved);

  return saved;

}

export async function updateNote(
  id,
  updates
) {

  const note =
    state.notes.find(
      (item) => item.id === id
    );

  if (!note) {
    return null;
  }

  Object.assign(note, updates);

  await saveItem(
    'notes',
    note
  );

  return note;

}

export async function removeNote(
  id
) {

  state.notes =
    state.notes.filter(
      (item) => item.id !== id
    );

  await deleteItem(
    'notes',
    id
  );

}

/* =========================
   PROJECTS
========================= */

export async function createProject(
  data
) {

  const project = {
    id: generateId(),

    title:
      data.title || '',

    description:
      data.description || ''
  };

  const saved =
    await saveItem(
      'projects',
      project
    );

  state.projects.unshift(saved);

  return saved;

}

export async function updateProject(
  id,
  updates
) {

  const project =
    state.projects.find(
      (item) => item.id === id
    );

  if (!project) {
    return null;
  }

  Object.assign(project, updates);

  await saveItem(
    'projects',
    project
  );

  return project;

}

export async function removeProject(
  id
) {

  state.projects =
    state.projects.filter(
      (item) => item.id !== id
    );

  await deleteItem(
    'projects',
    id
  );

}

/* =========================
   SETTINGS
========================= */

export async function updateTheme(
  theme
) {

  state.settings.theme =
    theme;

  document.body.dataset.theme =
    theme;

  await setSetting(
    'theme',
    theme
  );

}

export async function updateAccent(
  accent
) {

  state.settings.accent =
    accent;

  document.body.dataset.accent =
    accent;

  await setSetting(
    'accent',
    accent
  );

}

/* =========================
   FILTERS
========================= */

export function getTodayTasks() {

  const today =
    new Date();

  return state.tasks.filter(
    (task) => {

      if (
        !task.dueDate
      ) {
        return false;
      }

      const due =
        new Date(task.dueDate);

      return (
        due.getFullYear()
        ===
        today.getFullYear()

        &&

        due.getMonth()
        ===
        today.getMonth()

        &&

        due.getDate()
        ===
        today.getDate()
      );

    }
  );

}

export function getCompletedTasks() {

  return state.tasks.filter(
    (task) => task.completed
  );

}

export function getPendingTasks() {

  return state.tasks.filter(
    (task) => !task.completed
  );

}