import axios from "axios";
import type {
  Job,
  Candidate,
  Event,
  ParseResult,
  DashboardStats,
  ExtendedDashboardStats,
  AiInsight,
  ScoreResult,
  BatchTaskStatus,
  WorkflowRule,
  WorkflowAlert,
} from "./types";

const api = axios.create({
  baseURL: "",
  timeout: 60000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 by redirecting to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ---- Jobs ----

export async function fetchJobs(): Promise<Job[]> {
  const res = await api.get("/api/jobs");
  return res.data;
}

export async function createJob(data: {
  title: string;
  department?: string;
  location?: string;
  salary_range?: string;
  requirements?: Record<string, unknown>;
}): Promise<Job> {
  const res = await api.post("/api/jobs", data);
  return res.data;
}

export async function deleteJob(id: number): Promise<void> {
  await api.delete(`/api/jobs/${id}`);
}

export async function updateJob(
  id: number,
  data: {
    title?: string;
    department?: string;
    status?: string;
    location?: string;
    salary_range?: string;
    requirements?: Record<string, unknown>;
  }
): Promise<Job> {
  const res = await api.patch(`/api/jobs/${id}`, data);
  return res.data;
}

// ---- Candidates ----

export async function fetchCandidates(params?: {
  status?: string;
  job_id?: number;
  source?: string;
  keyword?: string;
}): Promise<Candidate[]> {
  const res = await api.get("/api/candidates", { params });
  return res.data;
}

export async function fetchCandidate(id: number): Promise<Candidate> {
  const res = await api.get(`/api/candidates/${id}`);
  return res.data;
}

export async function createCandidate(data: {
  name: string;
  phone?: string;
  email?: string;
  source?: string;
  job_id?: number;
}): Promise<Candidate> {
  const res = await api.post("/api/candidates", data);
  return res.data;
}

export async function updateCandidate(
  id: number,
  data: Record<string, unknown>
): Promise<Candidate> {
  const res = await api.patch(`/api/candidates/${id}`, data);
  return res.data;
}

export async function changeStatus(
  id: number,
  status: string
): Promise<Candidate> {
  const res = await api.post(`/api/candidates/${id}/status`, { status });
  return res.data;
}

export async function deleteCandidate(id: number): Promise<void> {
  await api.delete(`/api/candidates/${id}`);
}

export async function fetchEvents(candidateId: number): Promise<Event[]> {
  const res = await api.get(`/api/candidates/${candidateId}/events`);
  return res.data;
}

// ---- Resumes ----

export async function uploadResume(
  file: File,
  jobId: number,
  onUploadProgress?: (percent: number) => void,
): Promise<ParseResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("job_id", String(jobId));
  const res = await api.post("/api/resumes/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000,
    onUploadProgress: onUploadProgress
      ? (e) => {
          if (e.total) {
            onUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        }
      : undefined,
  });
  return res.data;
}

export async function fetchParseStatus(
  candidateId: number
): Promise<ParseResult> {
  const res = await api.get(`/api/resumes/${candidateId}/status`);
  return res.data;
}

// ---- Dashboard ----

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await api.get("/api/dashboard/stats");
  return res.data;
}

// ---- Screening / AI Scoring ----

export async function scoreCandidate(
  candidateId: number,
  jobId: number
): Promise<ScoreResult> {
  const res = await api.post(`/api/screening/score/${candidateId}`, {
    job_id: jobId,
  });
  return res.data;
}

export async function batchScoreCandidates(
  jobId: number,
  candidateIds?: number[]
): Promise<ScoreResult[]> {
  const res = await api.post("/api/screening/batch-score", {
    job_id: jobId,
    candidate_ids: candidateIds,
  });
  return res.data;
}

export async function compareCandidates(
  jobId: number,
  candidateIds: number[]
): Promise<Record<string, unknown>> {
  const res = await api.post("/api/screening/compare", {
    job_id: jobId,
    candidate_ids: candidateIds,
  });
  return res.data;
}

// ---- Batch Upload ----

export async function batchUploadResumes(
  files: File[],
  jobId?: number | null
): Promise<{ task_id: string; total: number }> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  if (jobId) form.append("job_id", String(jobId));
  const res = await api.post("/api/resumes/batch-upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 300000,
  });
  return res.data;
}

export async function fetchBatchStatus(
  taskId: string
): Promise<BatchTaskStatus> {
  const res = await api.get(`/api/resumes/batch-status/${taskId}`);
  return res.data;
}

// ---- Workflow ----

export async function fetchWorkflowRules(params?: {
  job_id?: number;
}): Promise<WorkflowRule[]> {
  const res = await api.get("/api/workflow/rules", { params });
  return res.data;
}

export async function createWorkflowRule(data: {
  name: string;
  job_id?: number | null;
  trigger_type: string;
  trigger_config?: Record<string, unknown>;
  action_type: string;
  action_config?: Record<string, unknown>;
  is_active?: number;
}): Promise<WorkflowRule> {
  const res = await api.post("/api/workflow/rules", data);
  return res.data;
}

export async function updateWorkflowRule(
  id: number,
  data: Record<string, unknown>
): Promise<WorkflowRule> {
  const res = await api.patch(`/api/workflow/rules/${id}`, data);
  return res.data;
}

export async function deleteWorkflowRule(id: number): Promise<void> {
  await api.delete(`/api/workflow/rules/${id}`);
}

export async function executeWorkflow(): Promise<{
  executed: boolean;
  alerts: WorkflowAlert[];
}> {
  const res = await api.post("/api/workflow/execute");
  return res.data;
}

export async function fetchWorkflowAlerts(): Promise<WorkflowAlert[]> {
  const res = await api.get("/api/workflow/alerts");
  return res.data;
}

// ---- Dashboard Extended ----

export async function fetchExtendedDashboardStats(): Promise<ExtendedDashboardStats> {
  const res = await api.get("/api/dashboard/stats");
  return res.data;
}

export async function fetchAiInsights(force = false): Promise<AiInsight[]> {
  const res = await api.get("/api/dashboard/ai-insights", { params: force ? { force: true } : {} });
  return res.data;
}

export async function fetchTrend(days?: number): Promise<{
  weekly_trend: { week: string; new_count: number; hired_count: number }[];
}> {
  const res = await api.get("/api/dashboard/trend", { params: { days } });
  return res.data;
}

// ---- Export ----

export async function exportCandidates(params?: {
  status?: string;
  job_id?: number;
  source?: string;
}): Promise<void> {
  const res = await api.get("/api/export/candidates", {
    params,
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = `candidates_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export async function fetchAiSummary(period?: string): Promise<{
  period: string;
  title: string;
  summary: string;
  generated_at: string;
}> {
  const res = await api.get("/api/export/ai-summary", { params: { period } });
  return res.data;
}

export async function downloadAiSummary(period?: string): Promise<void> {
  const res = await api.get("/api/export/ai-summary/download", {
    params: { period },
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = `招聘${period === "month" ? "月报" : "周报"}_${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  window.URL.revokeObjectURL(url);
}
