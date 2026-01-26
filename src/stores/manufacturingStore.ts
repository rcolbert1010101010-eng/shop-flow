import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

type ActionResult = {
  success: boolean;
  error?: string;
};

export type ManufacturingTemplate = {
  id: string;
  name?: string;
  description?: string | null;
  status?: string;
  current_version_id?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type ManufacturingJob = {
  id: string;
  name?: string;
  status?: string;
  template_version_id?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type ManufacturingJobDetail = ManufacturingJob & {
  lines?: unknown[];
  materials?: unknown[];
  notes?: string | null;
  [key: string]: unknown;
};

type ManufacturingState = {
  templates: ManufacturingTemplate[];
  jobs: ManufacturingJob[];
  jobDetails: Record<string, ManufacturingJobDetail>;
  isSavingTemplate: boolean;
  isSavingTemplateDraft: Record<string, boolean>;
  isSavingTemplateVersion: Record<string, boolean>;
  isSavingJobCreate: Record<string, boolean>;
  isSavingJobStatus: Record<string, boolean>;
  isFetchingTemplates: boolean;
  isFetchingJobs: boolean;
  isFetchingJobDetail: Record<string, boolean>;
  createTemplate: (payload: Record<string, unknown>) => Promise<ActionResult>;
  saveTemplateDraft: (templateId: string, payload: Record<string, unknown>) => Promise<ActionResult>;
  saveTemplateVersion: (templateId: string) => Promise<ActionResult>;
  fetchTemplates: () => Promise<ActionResult>;
  createJobFromTemplate: (templateVersionId: string, jobName: string) => Promise<ActionResult>;
  fetchJobs: () => Promise<ActionResult>;
  fetchJobDetail: (jobId: string) => Promise<ActionResult>;
  updateJobStatus: (jobId: string, status: string) => Promise<ActionResult>;
};

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const upsertById = <T extends { id: string }>(items: T[], next: T) => {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) return [...items, next];
  const updated = items.slice();
  updated[index] = next;
  return updated;
};

export const useManufacturingStore = create<ManufacturingState>((set, get) => ({
  templates: [],
  jobs: [],
  jobDetails: {},
  isSavingTemplate: false,
  isSavingTemplateDraft: {},
  isSavingTemplateVersion: {},
  isSavingJobCreate: {},
  isSavingJobStatus: {},
  isFetchingTemplates: false,
  isFetchingJobs: false,
  isFetchingJobDetail: {},

  createTemplate: async (payload) => {
    if (get().isSavingTemplate) {
      return { success: false, error: 'Request already in progress' };
    }

    set({ isSavingTemplate: true });
    try {
      if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
      }
      const { data, error } = await supabase
        .from('manufacturing_templates')
        .insert(payload)
        .select('*')
        .single();
      if (error) {
        return { success: false, error: error.message };
      }
      if (data) {
        set((state) => ({ templates: upsertById(state.templates, data as ManufacturingTemplate) }));
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    } finally {
      set({ isSavingTemplate: false });
    }
  },

  saveTemplateDraft: async (templateId, payload) => {
    if (get().isSavingTemplateDraft[templateId]) {
      return { success: false, error: 'Request already in progress' };
    }

    set((state) => ({
      isSavingTemplateDraft: { ...state.isSavingTemplateDraft, [templateId]: true },
    }));
    try {
      if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
      }
      const record = payload ?? {};
      const materialSpec =
        record.materialSpec && typeof record.materialSpec === 'object' && !Array.isArray(record.materialSpec)
          ? record.materialSpec
          : {
              name: (record as any).name ?? null,
              description: (record as any).description ?? null,
              is_active: (record as any).is_active ?? (record as any).isActive ?? true,
            };
      const materialGroups = Array.isArray((record as any).material_groups)
        ? (record as any).material_groups
        : Array.isArray((record as any).materialGroups)
          ? (record as any).materialGroups
          : [];
      const operationsSource = Array.isArray((record as any).fabrication_operations)
        ? (record as any).fabrication_operations
        : Array.isArray((record as any).operations)
          ? (record as any).operations
          : [];
      const operations = operationsSource.map((op: any) => ({
        name: op?.name ?? op?.operation_type ?? op?.operationType ?? '',
        estimated_hours: Number(op?.estimated_hours ?? op?.estimatedHours ?? 0),
        skill_type: op?.skill_type ?? op?.skillType ?? '',
        machine_type: op?.machine_type ?? op?.machineType ?? '',
      }));

      const { error } = await supabase.functions.invoke('manufacturing-template-draft', {
        method: 'PUT',
        body: {
          templateId,
          materialSpec,
          materialGroups,
          operations,
        },
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    } finally {
      set((state) => ({
        isSavingTemplateDraft: { ...state.isSavingTemplateDraft, [templateId]: false },
      }));
    }
  },

  saveTemplateVersion: async (templateId) => {
    if (get().isSavingTemplateVersion[templateId]) {
      return { success: false, error: 'Request already in progress' };
    }

    set((state) => ({
      isSavingTemplateVersion: { ...state.isSavingTemplateVersion, [templateId]: true },
    }));
    try {
      if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
      }
      const { error } = await supabase.functions.invoke('manufacturing-template-version', {
        method: 'POST',
        body: { template_id: templateId },
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    } finally {
      set((state) => ({
        isSavingTemplateVersion: { ...state.isSavingTemplateVersion, [templateId]: false },
      }));
    }
  },

  fetchTemplates: async () => {
    if (get().isFetchingTemplates) {
      return { success: false, error: 'Request already in progress' };
    }

    set({ isFetchingTemplates: true });
    try {
      if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
      }
      const { data, error } = await supabase.functions.invoke('manufacturing-templates', {
        method: 'GET',
      });
      if (error) {
        return { success: false, error: error.message };
      }
      const templates = Array.isArray(data) ? (data as ManufacturingTemplate[]) : [];
      set({ templates });
      return { success: true };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    } finally {
      set({ isFetchingTemplates: false });
    }
  },

  createJobFromTemplate: async (templateVersionId, jobName) => {
    if (get().isSavingJobCreate[templateVersionId]) {
      return { success: false, error: 'Request already in progress' };
    }

    set((state) => ({
      isSavingJobCreate: { ...state.isSavingJobCreate, [templateVersionId]: true },
    }));
    try {
      if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
      }
      const { data, error } = await supabase
        .from('manufacturing_jobs')
        .insert({
          source_template_version_id: templateVersionId,
          job_name: jobName,
          status: 'draft',
          calculated_cost: 0,
          cost_breakdown_json: { rate_source: 'stubbed_default_v1' },
        })
        .select('*')
        .single();
      if (error) {
        return { success: false, error: error.message };
      }
      if (data) {
        const mapped: ManufacturingJob = {
          ...(data as Record<string, unknown>),
          id: data.id,
          name: (data as any).job_name ?? jobName,
          status: (data as any).status ?? 'draft',
          template_version_id: (data as any).source_template_version_id ?? templateVersionId,
        };
        set((state) => ({ jobs: upsertById(state.jobs, mapped) }));
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    } finally {
      set((state) => ({
        isSavingJobCreate: { ...state.isSavingJobCreate, [templateVersionId]: false },
      }));
    }
  },

  fetchJobs: async () => {
    if (get().isFetchingJobs) {
      return { success: false, error: 'Request already in progress' };
    }

    set({ isFetchingJobs: true });
    try {
      if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
      }
      const { data, error } = await supabase
        .from('manufacturing_jobs')
        .select('id, job_name, status, source_template_version_id, calculated_cost, created_at')
        .order('created_at', { ascending: false });
      if (error) {
        return { success: false, error: error.message };
      }
      const jobs = (data ?? []).map((row: any) => ({
        ...row,
        name: row.job_name,
        template_version_id: row.source_template_version_id,
      })) as ManufacturingJob[];
      set({ jobs });
      return { success: true };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    } finally {
      set({ isFetchingJobs: false });
    }
  },

  fetchJobDetail: async (jobId) => {
    if (get().isFetchingJobDetail[jobId]) {
      return { success: false, error: 'Request already in progress' };
    }

    set((state) => ({
      isFetchingJobDetail: { ...state.isFetchingJobDetail, [jobId]: true },
    }));
    try {
      if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
      }
      const { data: job, error: jobError } = await supabase
        .from('manufacturing_jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();
      if (jobError) {
        return { success: false, error: jobError.message };
      }
      const { data: operations, error: opsError } = await supabase
        .from('manufacturing_job_operations')
        .select('*')
        .eq('manufacturing_job_id', jobId);
      if (opsError) {
        return { success: false, error: opsError.message };
      }
      const detail: ManufacturingJobDetail = {
        ...(job as Record<string, unknown>),
        id: (job as any)?.id ?? jobId,
        name: (job as any)?.job_name ?? '',
        status: (job as any)?.status ?? '',
        template_version_id: (job as any)?.source_template_version_id ?? null,
        operations: operations ?? [],
      };
      set((state) => ({
        jobDetails: { ...state.jobDetails, [jobId]: detail },
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    } finally {
      set((state) => ({
        isFetchingJobDetail: { ...state.isFetchingJobDetail, [jobId]: false },
      }));
    }
  },

  updateJobStatus: async (jobId, status) => {
    if (get().isSavingJobStatus[jobId]) {
      return { success: false, error: 'Request already in progress' };
    }

    set((state) => ({
      isSavingJobStatus: { ...state.isSavingJobStatus, [jobId]: true },
    }));
    try {
      if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
      }
      const normalizedStatus = status.toLowerCase();
      const { data, error } = await supabase
        .from('manufacturing_jobs')
        .update({ status: normalizedStatus })
        .eq('id', jobId)
        .select('*')
        .maybeSingle();
      if (error) {
        return { success: false, error: error.message };
      }
      if (data) {
        const mapped: ManufacturingJob = {
          ...(data as Record<string, unknown>),
          id: data.id,
          name: (data as any).job_name ?? '',
          status: (data as any).status ?? normalizedStatus,
          template_version_id: (data as any).source_template_version_id ?? null,
        };
        set((state) => ({
          jobs: upsertById(state.jobs, mapped),
          jobDetails: state.jobDetails[jobId]
            ? { ...state.jobDetails, [jobId]: { ...state.jobDetails[jobId], ...mapped } }
            : state.jobDetails,
        }));
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    } finally {
      set((state) => ({
        isSavingJobStatus: { ...state.isSavingJobStatus, [jobId]: false },
      }));
    }
  },
}));
