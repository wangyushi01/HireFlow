export interface Job {
  id: number;
  title: string;
  department: string | null;
  status: string;
  location: string | null;
  salary_range: string | null;
  requirements: JobRequirements | null;
  created_at: string;
}

export interface JobRequirements {
  required_skills?: string[];
  preferred_skills?: string[];
  min_experience?: number;
  education?: string;
  description?: string;
  responsibilities?: string;
}

export interface Candidate {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  job_id: number | null;
  status: string;
  years_of_experience: number | null;
  current_company: string | null;
  highest_degree: string | null;
  school: string | null;
  skills: string[];
  expected_salary: string | null;
  availability: string | null;
  work_history: WorkHistoryItem[];
  project_experience: ProjectItem[];
  research_experience: ResearchItem[];
  resume_filename: string | null;
  resume_saved_name: string | null;
  parse_status: string;
  ai_score: number | null;
  ai_summary: string | null;
  ai_recommendation: string | null;
  ai_match_details: AiMatchDetails | null;
  job_title: string | null;
  stage_entered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkHistoryItem {
  company: string;
  position: string;
  duration: string;
  summary: string;
}

export interface ProjectItem {
  name: string;
  role: string;
  duration: string;
  description: string;
}

export interface ResearchItem {
  topic: string;
  role: string;
  duration: string;
  achievement: string;
}

export interface Event {
  id: number;
  candidate_id: number;
  event_type: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface ParseResult {
  candidate_id: number;
  parse_status: string;
  parsed_data: Candidate | null;
  error: string | null;
}

export interface FunnelStage {
  stage: string;
  label: string;
  count: number;
}

export interface ChannelStats {
  source: string;
  count: number;
}

export interface JobStats {
  job_title: string;
  count: number;
}

export interface DashboardStats {
  total_candidates: number;
  funnel: FunnelStage[];
  channels: ChannelStats[];
  jobs: JobStats[];
}

export const STATUS_LABELS: Record<string, string> = {
  resume_received: "已投递",
  screening: "筛选中",
  interview: "面试中",
  offer: "Offer",
  hired: "已入职",
  rejected: "已拒绝",
  talent_pool: "人才库",
};

export const STATUS_COLORS: Record<string, string> = {
  resume_received: "default",
  screening: "processing",
  interview: "warning",
  offer: "success",
  hired: "success",
  rejected: "error",
  talent_pool: "default",
};

export const SOURCE_LABELS: Record<string, string> = {
  boss: "Boss直聘",
  lagou: "拉勾",
  referral: "内推",
  official: "官网",
  other: "其他",
};

export interface AiMatchDetails {
  skills_match?: string[];
  skills_missing?: string[];
  experience_assessment?: string;
  education_match?: boolean;
  strengths?: string[];
  concerns?: string[];
}

export interface ScoreResult {
  candidate_id: number;
  score: number;
  summary: string;
  recommendation: string;
  match_details: AiMatchDetails | null;
}

export interface BatchTaskStatus {
  task_id: string;
  total: number;
  completed: number;
  failed: number;
  results: ParseResult[];
}

export const RECOMMENDATION_COLORS: Record<string, string> = {
  "强烈推荐": "success",
  "推荐面试": "processing",
  "可以考虑": "warning",
  "不推荐": "error",
};

// ---- Workflow ----

export interface WorkflowRule {
  id: number;
  name: string;
  job_id: number | null;
  trigger_type: string;
  trigger_config: Record<string, unknown> | null;
  action_type: string;
  action_config: Record<string, unknown> | null;
  is_active: number;
  created_at: string;
}

export interface WorkflowAlert {
  rule_id: number;
  rule_name: string;
  candidate_id: number;
  candidate_name: string;
  action: string;
  trigger: string;
}

export const TRIGGER_TYPE_LABELS: Record<string, string> = {
  score_threshold: "评分阈值",
  time_in_stage: "阶段停留时间",
};

export const ACTION_TYPE_LABELS: Record<string, string> = {
  auto_advance: "自动推进",
  auto_reject: "自动拒绝",
  to_talent_pool: "归档人才库",
  alert: "预警提醒",
};

// ---- Dashboard Extended ----

export interface ConversionRate {
  from_stage: string;
  to: string;
  rate: number;
}

export interface WeeklyTrend {
  week: string;
  new_count: number;
  hired_count: number;
}

export interface SourceConversion {
  source: string;
  conversion_rate: number;
}

export interface ExtendedDashboardStats extends DashboardStats {
  time_to_hire: number | null;
  this_week_new: number;
  overall_conversion: number | null;
  conversion_rates: ConversionRate[];
  weekly_trend: WeeklyTrend[];
  source_conversion: SourceConversion[];
}

export interface AiInsight {
  severity: "info" | "warning" | "error" | "success";
  title: string;
  content: string;
}
