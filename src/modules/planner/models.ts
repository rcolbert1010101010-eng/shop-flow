export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'Open' | 'Done';

export type PlannerTask = {
  id: string;
  title: string;
  notes?: string | null;
  due_date?: string | null;
  priority: TaskPriority;
  tags: string[];
  status: TaskStatus;
  created_at: string;
};

export type PlannerEvent = {
  id: string;
  title: string;
  notes?: string | null;
  start_date: string;
  end_date?: string | null;
  all_day: boolean;
  created_at: string;
};

export type PlannerData = {
  tasks: PlannerTask[];
  events: PlannerEvent[];
};
