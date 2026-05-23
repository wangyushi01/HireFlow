import json
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import WorkflowRule, Candidate, Job, Event, beijing_now

logger = logging.getLogger(__name__)

BJ_TZ = timezone(timedelta(hours=8))


def execute_workflow(db: Session) -> list[dict]:
    """执行所有启用的工作流规则，返回产生的操作记录。"""
    alerts = []

    rules = db.query(WorkflowRule).filter(WorkflowRule.is_active == True).all()

    for rule in rules:
        try:
            config = _parse_config(rule.trigger_config)
        except Exception:
            continue

        if rule.trigger_type == "score_threshold":
            result = _handle_score_threshold(db, rule, config)
        elif rule.trigger_type == "time_in_stage":
            result = _handle_time_in_stage(db, rule, config)
        else:
            continue

        if result:
            alerts.extend(result)

    db.commit()
    return alerts


def _parse_config(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        return json.loads(raw)
    return {}


def _handle_score_threshold(db: Session, rule: WorkflowRule, config: dict) -> list[dict]:
    min_score = config.get("min_score", 70)
    source_status = config.get("source_status", "resume_received")
    target_status = config.get("target_status", "screening")

    candidates = (
        db.query(Candidate)
        .filter(
            Candidate.status == source_status,
            Candidate.ai_score >= min_score,
        )
        .all()
    )

    if rule.job_id:
        candidates = [c for c in candidates if c.job_id == rule.job_id]

    alerts = []
    for c in candidates:
        old_status = c.status
        _apply_action(db, rule, c, rule.action_type, rule.action_config)
        alerts.append({
            "rule_id": rule.id,
            "rule_name": rule.name,
            "candidate_id": c.id,
            "candidate_name": c.name,
            "action": f"状态变更：{old_status} → {c.status}",
            "trigger": f"AI评分 {c.ai_score} ≥ {min_score}",
        })

    return alerts


def _handle_time_in_stage(db: Session, rule: WorkflowRule, config: dict) -> list[dict]:
    stage = config.get("stage", "screening")
    max_days = config.get("max_days", 7)

    now = beijing_now()
    cutoff = now - timedelta(days=max_days)

    candidates = (
        db.query(Candidate)
        .filter(
            Candidate.status == stage,
            Candidate.stage_entered_at != None,
            Candidate.stage_entered_at <= cutoff,
        )
        .all()
    )

    if rule.job_id:
        candidates = [c for c in candidates if c.job_id == rule.job_id]

    alerts = []
    for c in candidates:
        days_in_stage = (now - c.stage_entered_at).days
        _apply_action(db, rule, c, rule.action_type, rule.action_config)
        alerts.append({
            "rule_id": rule.id,
            "rule_name": rule.name,
            "candidate_id": c.id,
            "candidate_name": c.name,
            "action": f"{rule.action_type}（停留 {days_in_stage} 天）",
            "trigger": f"阶段「{stage}」停留超过 {max_days} 天",
        })

    return alerts


def _apply_action(db: Session, rule: WorkflowRule, candidate: Candidate, action_type: str, action_config):
    config = _parse_config(action_config)

    if action_type == "auto_advance":
        target = config.get("target_status", "screening")
        _change_status(db, candidate, target, f"工作流自动推进，规则：{rule.name}")

    elif action_type == "auto_reject":
        _change_status(db, candidate, "rejected", f"工作流自动拒绝，规则：{rule.name}")

    elif action_type == "to_talent_pool":
        _change_status(db, candidate, "talent_pool", f"工作流自动归档人才库，规则：{rule.name}")

    elif action_type == "alert":
        pass


def _change_status(db: Session, candidate: Candidate, new_status: str, detail: str):
    old_status = candidate.status
    candidate.status = new_status
    candidate.stage_entered_at = beijing_now()
    candidate.updated_at = beijing_now()

    event = Event(
        candidate_id=candidate.id,
        event_type="status_changed",
        detail=json.dumps({"from": old_status, "to": new_status, "by": "workflow"}, ensure_ascii=False),
    )
    db.add(event)


def run_workflow_engine():
    """独立的定时任务入口，在后台线程中运行。"""
    db = SessionLocal()
    try:
        result = execute_workflow(db)
        if result:
            logger.info("工作流引擎执行完成，产生 %d 条操作", len(result))
            for r in result:
                logger.info("  - [%s] %s: %s", r["rule_name"], r["candidate_name"], r["action"])
    except Exception:
        logger.exception("工作流引擎执行失败")
    finally:
        db.close()
