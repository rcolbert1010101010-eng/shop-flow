import { create } from 'zustand';
import { apiClient } from '@/api/client';

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
      const created = await apiClient.post<ManufacturingTemplate, Record<string, unknown>>(
        '/manufacturing/templates',
        payload
      );
      set((state) => ({ templates: upsertById(state.templates, created) }));
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
      const updated = await apiClient.put<ManufacturingTemplate, Record<string, unknown>>(
        `/manufacturing/templates/${templateId}/draft`,
        payload
      );
      set((state) => ({ templates: upsertById(state.templates, updated) }));
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
      const updated = await apiClient.post<ManufacturingTemplate, Record<string, unknown>>(
        `/manufacturing/templates/${templateId}/versions`,
        {}
      );
      if (updated?.id === templateId) {
        set((state) => ({ templates: upsertById(state.templates, updated) }));
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
      const templates = await apiClient.get<ManufacturingTemplate[]>('/manufacturing/templates');
      set({ templates: templates ?? [] });
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
      const created = await apiClient.post<ManufacturingJob, Record<string, unknown>>(
        '/manufacturing/jobs',
        { template_version_id: templateVersionId, name: jobName }
      );
      set((state) => ({ jobs: upsertById(state.jobs, created) }));
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
      const jobs = await apiClient.get<ManufacturingJob[]>('/manufacturing/jobs');
      set({ jobs: jobs ?? [] });
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
      const detail = await apiClient.get<ManufacturingJobDetail>(`/manufacturing/jobs/${jobId}`);
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
      const updated = await apiClient.put<ManufacturingJob, Record<string, unknown>>(
        `/manufacturing/jobs/${jobId}/status`,
        { status }
      );
      set((state) => ({
        jobs: upsertById(state.jobs, updated),
        jobDetails: state.jobDetails[jobId]
          ? { ...state.jobDetails, [jobId]: { ...state.jobDetails[jobId], ...updated } }
          : state.jobDetails,
      }));
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
