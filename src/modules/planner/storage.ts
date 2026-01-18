import type { PlannerData, PlannerEvent, PlannerTask, TaskStatus } from './models';

const STORAGE_KEY = 'planner-data-v1';
const STORAGE_VERSION = 1;

const getFallbackData = (): PlannerData => ({
  tasks: [],
  events: [],
});

const getSafeStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function loadPlannerData(): PlannerData {
  const storage = getSafeStorage();
  if (!storage) return getFallbackData();

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return getFallbackData();

  try {
    const parsed = JSON.parse(raw);

    // New schema: { version: 1, data: PlannerData }
    if (parsed && typeof parsed === 'object' && 'version' in parsed) {
      if (parsed.version === 1 && parsed.data) {
        const data = parsed.data as PlannerData;
        return {
          tasks: data.tasks ?? [],
          events: data.events ?? [],
        };
      }
    }

    // Legacy schema: PlannerData directly
    const legacy = parsed as PlannerData;
    return {
      tasks: legacy.tasks ?? [],
      events: legacy.events ?? [],
    };
  } catch {
    return getFallbackData();
  }
}

export function savePlannerData(data: PlannerData): void {
  const storage = getSafeStorage();
  if (!storage) return;
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: STORAGE_VERSION,
      data,
    })
  );
}

export function upsertTask(input: Partial<PlannerTask> & Pick<PlannerTask, 'title'>): PlannerTask {
  const existing = loadPlannerData();
  const now = new Date().toISOString();
  const id = input.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `task_${Date.now()}`);

  const task: PlannerTask = {
    id,
    title: input.title,
    notes: input.notes ?? null,
    due_date: input.due_date ?? null,
    priority: input.priority ?? 'Medium',
    tags: input.tags ?? [],
    status: input.status ?? 'Open',
    created_at: input.created_at ?? now,
  };

  const updatedTasks = existing.tasks.filter((t) => t.id !== id);
  updatedTasks.push(task);

  const next: PlannerData = { ...existing, tasks: updatedTasks };
  savePlannerData(next);
  return task;
}

export function upsertEvent(input: Partial<PlannerEvent> & Pick<PlannerEvent, 'title' | 'start_date'>): PlannerEvent {
  const existing = loadPlannerData();
  const now = new Date().toISOString();
  const id = input.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `event_${Date.now()}`);

  const event: PlannerEvent = {
    id,
    title: input.title,
    notes: input.notes ?? null,
    start_date: input.start_date,
    end_date: input.end_date ?? null,
    all_day: input.all_day ?? true,
    created_at: input.created_at ?? now,
  };

  const updatedEvents = existing.events.filter((e) => e.id !== id);
  updatedEvents.push(event);

  const next: PlannerData = { ...existing, events: updatedEvents };
  savePlannerData(next);
  return event;
}

export function setTaskStatus(taskId: string, status: TaskStatus): PlannerTask | null {
  const data = loadPlannerData();
  const found = data.tasks.find((t) => t.id === taskId);
  if (!found) return null;

  const updated = { ...found, status };
  const next: PlannerData = {
    ...data,
    tasks: data.tasks.map((t) => (t.id === taskId ? updated : t)),
  };
  savePlannerData(next);
  return updated;
}

export function deleteTask(taskId: string): void {
  const data = loadPlannerData();
  savePlannerData({ ...data, tasks: data.tasks.filter((t) => t.id !== taskId) });
}

export function deleteEvent(eventId: string): void {
  const data = loadPlannerData();
  savePlannerData({ ...data, events: data.events.filter((e) => e.id !== eventId) });
}

export function exportPlannerData(): { version: number; exportedAt: string; data: PlannerData } {
  const data = loadPlannerData();
  return {
    version: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function importPlannerData(payload: unknown): PlannerData | null {
  try {
    if (!payload || typeof payload !== 'object') return null;

    // New schema
    if ('version' in payload && 'data' in (payload as any)) {
      const parsed = payload as { version: number; data: PlannerData };
      const data = parsed.data ?? getFallbackData();
      savePlannerData({
        tasks: data.tasks ?? [],
        events: data.events ?? [],
      });
      return data;
    }

    // Legacy schema
    const legacy = payload as PlannerData;
    if (!legacy.tasks && !legacy.events) return null;
    savePlannerData({
      tasks: legacy.tasks ?? [],
      events: legacy.events ?? [],
    });
    return legacy;
  } catch {
    return null;
  }
}

export function resetPlannerData(): PlannerData {
  const data = getFallbackData();
  savePlannerData(data);
  return data;
}
