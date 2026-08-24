/* ============================================================
   Planner Pro — Бизнес-логика / сервисы  (v1.0.0)
   Tasks, Notes, Projects, Tags, Stats
   ============================================================ */

(function () {
  'use strict';

  const DB = window.PlannerDB;
  const U = window.PlannerUtils;
  const Store = window.PlannerStore;
  const Toast = window.PlannerToast;

  /* ==================== Projects ==================== */

  const PROJECT_COLORS = ['#667eea', '#fa709a', '#11998e', '#b721ff', '#f59e0b', '#0ea5e9', '#ef4444', '#8b5cf6'];

  const ProjectService = {
    async loadAll() {
      const projects = await DB.getAll(DB.STORES.PROJECTS);
      Store.state.projects = projects.filter((p) => !p.isArchived);
      return Store.state.projects;
    },

    async create({ name, color }) {
      const project = {
        id: U.uuid(),
        name: name.trim(),
        color: color || PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
        isArchived: false,
        createdAt: Date.now()
      };
      await DB.put(DB.STORES.PROJECTS, project);
      await this.loadAll();
      return project;
    },

    async update(id, patch) {
      const project = await DB.get(DB.STORES.PROJECTS, id);
      if (!project) return null;
      Object.assign(project, patch);
      await DB.put(DB.STORES.PROJECTS, project);
      await this.loadAll();
      return project;
    },

    async archive(id) {
      return this.update(id, { isArchived: true });
    }
  };

  /* ==================== Tags ==================== */

  const TagService = {
    async loadAll() {
      Store.state.tags = await DB.getAll(DB.STORES.TAGS);
      return Store.state.tags;
    },

    async ensure(name) {
      const clean = name.trim().toLowerCase().replace(/^#/, '');
      if (!clean) return null;
      let tag = Store.state.tags.find((t) => t.name === clean);
      if (tag) { tag.count = (tag.count || 0) + 1; }
      else {
        tag = { id: U.uuid(), name: clean, count: 1 };
        Store.state.tags.push(tag);
      }
      await DB.put(DB.STORES.TAGS, tag);
      return clean;
    },

    async release(name) {
      const clean = String(name).toLowerCase();
      const tag = Store.state.tags.find((t) => t.name === clean);
      if (tag && --tag.count <= 0) {
        await DB.remove(DB.STORES.TAGS, tag.id);
        Store.state.tags = Store.state.tags.filter((t) => t !== tag);
      } else if (tag) {
        await DB.put(DB.STORES.TAGS, tag);
      }
    }
  };

  /* ==================== Tasks ==================== */

  const TaskService = {
    async loadAll() {
      Store.state.tasks = await DB.getAll(DB.STORES.TASKS);
      return Store.state.tasks;
    },

    async create(data) {
      const task = {
        id: U.uuid(),
        title: data.title.trim(),
        notes: data.notes || '',
        status: 'active',            // active | completed | archived | deleted
        priority: data.priority || 'medium',
        projectId: data.projectId || null,
        dueDate: data.dueDate || null,
        startTime: data.startTime || '',
        endTime: data.endTime || '',
        repeat: data.repeat || 'none', // none | daily | weekly | monthly | weekdays
        subtasks: data.subtasks || [],
        tags: [],
        completedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null
      };

      for (const raw of (data.tags || [])) {
        const name = await TagService.ensure(raw);
        if (name) task.tags.push(name);
      }

      await DB.put(DB.STORES.TASKS, task);
      await this.loadAll();
      return task;
    },

    async update(id, patch) {
      const task = await DB.get(DB.STORES.TASKS, id);
      if (!task) return null;

      // Синхронизация тегов
      if (patch.tags) {
        for (const old of task.tags) {
          if (!patch.tags.includes(old)) await TagService.release(old);
        }
        const newTags = [];
        for (const raw of patch.tags) {
          newTags.push(Store.state.tags.some((t) => t.name === raw)
            ? raw
            : (await TagService.ensure(raw)));
        }
        patch.tags = newTags.filter(Boolean);
      }

      Object.assign(task, patch, { updatedAt: Date.now() });
      await DB.put(DB.STORES.TASKS, task);
      await this.loadAll();
      return task;
    },

    async toggleComplete(id) {
      const task = await DB.get(DB.STORES.TASKS, id);
      if (!task) return;

      if (task.status === 'completed') {
        await this.update(id, { status: 'active', completedAt: null });
        return;
      }

      // Повторяющаяся задача → создаём следующий экземпляр
      if (task.repeat && task.repeat !== 'none' && task.dueDate) {
        const nextDue = this.nextOccurrence(task.dueDate, task.repeat);
        if (nextDue) {
          await this.create({
            title: task.title, notes: task.notes, priority: task.priority,
            projectId: task.projectId, dueDate: nextDue,
            startTime: task.startTime, endTime: task.endTime,
            repeat: task.repeat, subtasks: task.subtasks.map((s) => ({ ...s, completed: false })),
            tags: [...task.tags]
          });
          await this.update(id, { status: 'completed', completedAt: Date.now() });
          Toast.success('Задача выполнена, создан следующий повтор');
          return;
        }
      }

      await this.update(id, { status: 'completed', completedAt: Date.now() });
      U.haptic(15);

      // Конфетти если все задачи дня выполнены
      const todayTasks = Store.state.tasks.filter(
        (t) => t.status === 'active' && t.dueDate === U.todayISO()
      );
      if (todayTasks.length === 0) {
        const hadToday = Store.state.tasks.some(
          (t) => t.status === 'completed' && t.completedAt &&
                 U.toISODate(new Date(t.completedAt)) === U.todayISO()
        );
        if (hadToday) { U.confetti(); Toast.success('Все задачи на сегодня выполнены! 🎉'); }
      }
    },

    nextOccurrence(iso, repeat) {
      const d = U.fromISODate(iso);
      switch (repeat) {
        case 'daily': return U.toISODate(U.addDays(d, 1));
        case 'weekly': return U.toISODate(U.addDays(d, 7));
        case 'monthly': {
          const n = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
          return U.toISODate(n);
        }
        case 'weekdays': {
          let next = U.addDays(d, 1);
          while ([0, 6].includes(next.getDay())) next = U.addDays(next, 1);
          return U.toISODate(next);
        }
        default: return null;
      }
    },

    // Мягкое удаление → корзина (30 дней)
    async softDelete(id) {
      await this.update(id, { status: 'deleted', deletedAt: Date.now() });
    },

    async restore(id) {
      await this.update(id, { status: 'active', deletedAt: null });
    },

    async purgeExpired() {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const expired = Store.state.tasks.filter(
        (t) => t.status === 'deleted' && t.deletedAt && t.deletedAt < cutoff
      );
      for (const t of expired) await DB.remove(DB.STORES.TASKS, t.id);
      if (expired.length) await this.loadAll();
      return expired.length;
    },

    bulkAction(ids, action) {
      return Promise.all(ids.map((id) => {
        if (action === 'complete') return this.toggleComplete(id);
        if (action === 'delete') return this.softDelete(id);
        if (action === 'archive') return this.update(id, { status: 'archived' });
        return Promise.resolve();
      }));
    },

    /* ---------- Фильтрация ---------- */

    filtered() {
      const { tab, projectId, priority, tag, search } = Store.state.taskFilter;
      const today = U.todayISO();
      let list = Store.state.tasks.filter((t) => t.status === 'active');

      if (tab === 'today') list = list.filter((t) => !t.dueDate || t.dueDate <= today);
      else if (tab === 'upcoming') list = list.filter((t) => t.dueDate && t.dueDate > today);
      else if (tab === 'someday') list = list.filter((t) => !t.dueDate);

      if (projectId) list = list.filter((t) => t.projectId === projectId);
      if (priority) list = list.filter((t) => t.priority === priority);
      if (tag) list = list.filter((t) => (t.tags || []).includes(tag));
      if (search) {
        const q = search.toLowerCase();
        list = list.filter((t) =>
          t.title.toLowerCase().includes(q) ||
          (t.notes || '').toLowerCase().includes(q)
        );
      }

      const prioOrder = { high: 0, medium: 1, low: 2 };
      return list.sort((a, b) => {
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return prioOrder[a.priority] - prioOrder[b.priority];
      });
    },

    byDate(iso) {
      return Store.state.tasks.filter(
        (t) => t.status === 'active' && t.dueDate === iso
      );
    }
  };

  /* ==================== Notes ==================== */

  const NoteService = {
    async loadAll() {
      Store.state.notes = await DB.getAll(DB.STORES.NOTES);
      return Store.state.notes;
    },

    async create(data = {}) {
      const note = {
        id: U.uuid(),
        title: data.title || '',
        content: data.content || '',
        projectId: data.projectId || null,
        tags: [],
        isPinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await DB.put(DB.STORES.NOTES, note);
      await this.loadAll();
      return note;
    },

    async update(id, patch) {
      const note = await DB.get(DB.STORES.NOTES, id);
      if (!note) return null;
      Object.assign(note, patch, { updatedAt: Date.now() });
      await DB.put(DB.STORES.NOTES, note);
      await this.loadAll();
      return note;
    },

    async togglePin(id) {
      const note = await DB.get(DB.STORES.NOTES, id);
      if (!note) return;
      await this.update(id, { isPinned: !note.isPinned });
    },

    async softDelete(id) {
      const note = await DB.get(DB.STORES.NOTES, id);
      if (!note) return;
      note.status = 'deleted';
      note.deletedAt = Date.now();
      await DB.put(DB.STORES.NOTES, note);
      await this.loadAll();
    },

    async restore(id) {
      return this.update(id, { status: 'active', deletedAt: null });
    },

    async purgeExpired() {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const expired = Store.state.notes.filter(
        (n) => n.status === 'deleted' && n.deletedAt && n.deletedAt < cutoff
      );
      for (const n of expired) await DB.remove(DB.STORES.NOTES, n.id);
      if (expired.length) await this.loadAll();
      return expired.length;
    },

    search(query) {
      const q = query.toLowerCase();
      const active = Store.state.notes.filter((n) => n.status !== 'deleted');
      if (!q) {
        return active.sort((a, b) =>
          Number(b.isPinned) - Number(a.isPinned) || b.updatedAt - a.updatedAt
        );
      }
      return active.filter((n) =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q)
      );
    }
  };

  /* ==================== Stats ==================== */

  const StatsService = {
    compute(period = 'week') {
      const now = new Date();
      let start;
      switch (period) {
        case 'today': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
        case 'week': start = U.addDays(now, -6); break;
        case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'quarter': start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
        case 'year': start = new Date(now.getFullYear(), 0, 1); break;
        default: start = new Date(0);
      }
      const startTs = start.getTime();

      const inPeriod = (ts) => ts >= startTs;
      const completed = Store.state.tasks.filter(
        (t) => t.status === 'completed' && t.completedAt && inPeriod(t.completedAt)
      );
      const created = Store.state.tasks.filter((t) => inPeriod(t.createdAt));

      // По дням (для графика)
      const byDay = {};
      completed.forEach((t) => {
        const iso = U.toISODate(new Date(t.completedAt));
        byDay[iso] = (byDay[iso] || 0) + 1;
      });

      // По приоритетам
      const byPriority = { high: 0, medium: 0, low: 0 };
      completed.forEach((t) => { byPriority[t.priority]++; });

      // По проектам
      const byProject = {};
      completed.forEach((t) => {
        const key = t.projectId || '_none';
        byProject[key] = (byProject[key] || 0) + 1;
      });

      // Активные сейчас
      const activeNow = Store.state.tasks.filter((t) => t.status === 'active');
      const overdue = activeNow.filter((t) => t.dueDate && t.dueDate < U.todayISO());
      const dueToday = activeNow.filter((t) => t.dueDate === U.todayISO());

      // Completion rate за период
      const total = created.length;
      const rate = total ? Math.round((completed.length / total) * 100) : 0;

      // Heatmap: последние 26 недель
      const heatmap = {};
      Store.state.tasks.filter((t) => t.completedAt).forEach((t) => {
        const iso = U.toISODate(new Date(t.completedAt));
        heatmap[iso] = (heatmap[iso] || 0) + 1;
      });

      return {
        completedCount: completed.length,
        createdCount: total,
        rate,
        byDay, byPriority, byProject,
        activeCount: activeNow.length,
        overdueCount: overdue.length,
        dueTodayCount: dueToday.length,
        notesCount: Store.state.notes.filter((n) => n.status !== 'deleted').length,
        heatmap
      };
    }
  };

  /* ==================== Backup / Restore ==================== */

  const BackupService = {
    export() {
      return DB.exportAll().then((data) => {
        const payload = { app: 'PlannerPro', version: window.APP_VERSION, exportedAt: new Date().toISOString(), ...data };
        U.downloadFile(`planner-backup-${U.todayISO()}.json`, JSON.stringify(payload, null, 2));
        Toast.success('Резервная копия сохранена');
      }).catch(() => Toast.error('Ошибка экспорта'));
    },

    import(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const data = JSON.parse(reader.result);
            if (data.app !== 'PlannerPro') throw new Error('Неверный формат файла');
            await DB.createBackup(); // авто-бэкап перед импортом
            await DB.importAll(data);
            await Promise.all([
              TaskService.loadAll(), NoteService.loadAll(),
              ProjectService.loadAll(), TagService.loadAll()
            ]);
            Toast.success('Данные восстановлены');
            resolve(true);
          } catch (err) {
            Toast.error(err.message || 'Ошибка импорта');
            reject(err);
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
    },

    wipe() {
      return DB.wipeAll().then(async () => {
        await Promise.all([
          TaskService.loadAll(), NoteService.loadAll(),
          ProjectService.loadAll(), TagService.loadAll()
        ]);
        Toast.success('Все данные удалены');
      });
    }
  };

  /* ==================== Public API ==================== */

  window.PlannerServices = {
    ProjectService, TagService, TaskService, NoteService,
    StatsService, BackupService, PROJECT_COLORS
  };
})();
