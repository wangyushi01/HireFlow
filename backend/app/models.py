import json
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, Integer, Boolean, Float, String, Text, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship
from .database import Base

BJ_TZ = timezone(timedelta(hours=8))


def beijing_now():
    return datetime.now(BJ_TZ).replace(tzinfo=None)


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(Text, nullable=False)
    department = Column(Text)
    status = Column(Text, default="open")
    location = Column(Text)
    salary_range = Column(Text)
    requirements = Column(Text)  # JSON: {required_skills, min_experience, education, description}
    created_at = Column(DateTime, default=beijing_now)

    candidates = relationship("Candidate", back_populates="job")

    def get_requirements(self) -> dict:
        if self.requirements:
            try:
                return json.loads(self.requirements)
            except (json.JSONDecodeError, TypeError):
                return {}
        return {}

    def set_requirements(self, val: dict):
        self.requirements = json.dumps(val, ensure_ascii=False) if val else None


class Candidate(Base):
    __tablename__ = "candidates"
    __table_args__ = (
        Index("ix_candidates_status", "status"),
        Index("ix_candidates_source", "source"),
        Index("ix_candidates_created_at", "created_at"),
        Index("ix_candidates_job_id", "job_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False)
    phone = Column(Text)
    email = Column(Text)
    source = Column(Text)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True)
    status = Column(Text, default="resume_received")

    years_of_experience = Column(Integer, nullable=True)
    current_company = Column(Text)
    highest_degree = Column(Text)
    school = Column(Text)
    skills = Column(Text)  # JSON array string: '["React","Python"]'
    expected_salary = Column(Text)
    availability = Column(Text)
    work_history = Column(Text)  # JSON array string
    project_experience = Column(Text)  # JSON array string
    research_experience = Column(Text)  # JSON array string

    raw_resume_text = Column(Text)
    resume_filename = Column(Text)
    resume_saved_name = Column(Text)
    parse_status = Column(Text, default="pending")  # pending / parsing / done / failed
    parse_error = Column(Text)

    ai_score = Column(Float, nullable=True)
    ai_summary = Column(Text)
    ai_recommendation = Column(Text)
    ai_match_details = Column(Text)  # JSON

    stage_entered_at = Column(DateTime, default=beijing_now)

    created_at = Column(DateTime, default=beijing_now)
    updated_at = Column(DateTime, default=beijing_now, onupdate=beijing_now)

    job = relationship("Job", back_populates="candidates")
    events = relationship("Event", back_populates="candidate", order_by="Event.created_at.desc()")

    def get_skills(self) -> list[str]:
        if self.skills:
            try:
                return json.loads(self.skills)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    def set_skills(self, val: list[str]):
        self.skills = json.dumps(val, ensure_ascii=False) if val else None

    def get_work_history(self) -> list[dict]:
        if self.work_history:
            try:
                return json.loads(self.work_history)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    def set_work_history(self, val: list[dict]):
        self.work_history = json.dumps(val, ensure_ascii=False) if val else None

    def _get_json_list(self, field: str) -> list[dict]:
        val = getattr(self, field)
        if val:
            try:
                return json.loads(val)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    def _set_json_list(self, field: str, val: list[dict]):
        setattr(self, field, json.dumps(val, ensure_ascii=False) if val else None)

    def get_project_experience(self) -> list[dict]:
        return self._get_json_list("project_experience")

    def set_project_experience(self, val: list[dict]):
        self._set_json_list("project_experience", val)

    def get_research_experience(self) -> list[dict]:
        return self._get_json_list("research_experience")

    def set_research_experience(self, val: list[dict]):
        self._set_json_list("research_experience", val)

    def get_ai_match_details(self) -> dict:
        if self.ai_match_details:
            try:
                return json.loads(self.ai_match_details)
            except (json.JSONDecodeError, TypeError):
                return {}
        return {}

    def set_ai_match_details(self, val: dict):
        self.ai_match_details = json.dumps(val, ensure_ascii=False) if val else None


class WorkflowRule(Base):
    __tablename__ = "workflow_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True)
    trigger_type = Column(Text, nullable=False)  # score_threshold / time_in_stage
    trigger_config = Column(Text)  # JSON
    action_type = Column(Text, nullable=False)  # auto_advance / auto_reject / to_talent_pool / alert
    action_config = Column(Text)  # JSON
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=beijing_now)

    def get_trigger_config(self) -> dict:
        if self.trigger_config:
            try:
                return json.loads(self.trigger_config)
            except (json.JSONDecodeError, TypeError):
                return {}
        return {}

    def set_trigger_config(self, val: dict):
        self.trigger_config = json.dumps(val, ensure_ascii=False) if val else None

    def get_action_config(self) -> dict:
        if self.action_config:
            try:
                return json.loads(self.action_config)
            except (json.JSONDecodeError, TypeError):
                return {}
        return {}

    def set_action_config(self, val: dict):
        self.action_config = json.dumps(val, ensure_ascii=False) if val else None


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(Text, unique=True, nullable=False)
    hashed_password = Column(Text, nullable=False)
    display_name = Column(Text)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=beijing_now)


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    event_type = Column(Text, nullable=False)
    detail = Column(Text)  # JSON string
    created_at = Column(DateTime, default=beijing_now)

    candidate = relationship("Candidate", back_populates="events")

    def get_detail(self) -> dict:
        if self.detail:
            try:
                return json.loads(self.detail)
            except (json.JSONDecodeError, TypeError):
                return {}
        return {}

    def set_detail(self, val: dict):
        self.detail = json.dumps(val, ensure_ascii=False) if val else None


class AiCache(Base):
    __tablename__ = "ai_cache"

    key = Column(Text, primary_key=True)
    data = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=beijing_now, onupdate=beijing_now)
