from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ---- Job ----

class JobCreate(BaseModel):
    title: str
    department: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    requirements: Optional[dict] = None


class JobOut(BaseModel):
    id: int
    title: str
    department: Optional[str]
    status: str
    location: Optional[str] = None
    salary_range: Optional[str] = None
    requirements: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class JobUpdate(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    requirements: Optional[dict] = None


# ---- Candidate ----

class CandidateCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    source: Optional[str] = None
    job_id: Optional[int] = None


class CandidateUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    source: Optional[str] = None
    job_id: Optional[int] = None
    status: Optional[str] = None
    years_of_experience: Optional[int] = None
    current_company: Optional[str] = None
    highest_degree: Optional[str] = None
    school: Optional[str] = None
    skills: Optional[list[str]] = None
    expected_salary: Optional[str] = None
    availability: Optional[str] = None
    work_history: Optional[list[dict]] = None
    project_experience: Optional[list[dict]] = None
    research_experience: Optional[list[dict]] = None


class CandidateOut(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    email: Optional[str]
    source: Optional[str]
    job_id: Optional[int]
    status: str
    years_of_experience: Optional[int]
    current_company: Optional[str]
    highest_degree: Optional[str]
    school: Optional[str]
    skills: list[str] = []
    expected_salary: Optional[str]
    availability: Optional[str]
    work_history: list[dict] = []
    project_experience: list[dict] = []
    research_experience: list[dict] = []
    resume_filename: Optional[str]
    resume_saved_name: Optional[str] = None
    parse_status: str
    ai_score: Optional[float] = None
    ai_summary: Optional[str] = None
    ai_recommendation: Optional[str] = None
    ai_match_details: Optional[dict] = None
    job_title: Optional[str] = None
    stage_entered_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StatusChange(BaseModel):
    status: str


# ---- Event ----

class EventOut(BaseModel):
    id: int
    candidate_id: int
    event_type: str
    detail: dict = {}
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Dashboard ----

class FunnelStage(BaseModel):
    stage: str
    label: str
    count: int


class ChannelStats(BaseModel):
    source: str
    count: int


class JobStats(BaseModel):
    job_title: str
    count: int


class ConversionRate(BaseModel):
    from_stage: str = ""
    to: str = ""
    rate: float = 0.0


class WeeklyTrend(BaseModel):
    week: str
    new_count: int
    hired_count: int


class SourceConversionRate(BaseModel):
    source: str
    conversion_rate: float


class DashboardStats(BaseModel):
    total_candidates: int
    funnel: list[FunnelStage]
    channels: list[ChannelStats]
    jobs: list[JobStats]
    time_to_hire: Optional[float] = None
    this_week_new: int = 0
    overall_conversion: Optional[float] = None
    conversion_rates: list[ConversionRate] = []
    weekly_trend: list[WeeklyTrend] = []
    source_conversion: list[SourceConversionRate] = []


# ---- Resume ----

class ParseResult(BaseModel):
    candidate_id: int
    parse_status: str
    parsed_data: Optional[CandidateOut] = None
    error: Optional[str] = None


# ---- Screening / AI Scoring ----

class ScoreRequest(BaseModel):
    job_id: int


class BatchScoreRequest(BaseModel):
    job_id: int
    candidate_ids: Optional[list[int]] = None


class ScoreResult(BaseModel):
    candidate_id: int
    score: float
    summary: str
    recommendation: str
    match_details: Optional[dict] = None


class CompareRequest(BaseModel):
    job_id: int
    candidate_ids: list[int]


class BatchUploadResult(BaseModel):
    task_id: str
    total: int


class BatchTaskStatus(BaseModel):
    task_id: str
    total: int
    completed: int
    failed: int
    results: list[ParseResult]


# ---- Workflow ----

class WorkflowRuleCreate(BaseModel):
    name: str
    job_id: Optional[int] = None
    trigger_type: str
    trigger_config: Optional[dict] = None
    action_type: str
    action_config: Optional[dict] = None
    is_active: int = 1


class WorkflowRuleUpdate(BaseModel):
    name: Optional[str] = None
    job_id: Optional[int] = None
    trigger_type: Optional[str] = None
    trigger_config: Optional[dict] = None
    action_type: Optional[str] = None
    action_config: Optional[dict] = None
    is_active: Optional[int] = None


class WorkflowRuleOut(BaseModel):
    id: int
    name: str
    job_id: Optional[int] = None
    trigger_type: str
    trigger_config: Optional[dict] = None
    action_type: str
    action_config: Optional[dict] = None
    is_active: int
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkflowAlert(BaseModel):
    rule_id: int
    rule_name: str
    candidate_id: int
    candidate_name: str
    action: str
    trigger: str
