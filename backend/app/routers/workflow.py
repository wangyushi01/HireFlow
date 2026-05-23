import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import WorkflowRule
from ..schemas import (
    WorkflowRuleCreate,
    WorkflowRuleOut,
    WorkflowRuleUpdate,
    WorkflowAlert,
)
from ..services.workflow import execute_workflow

router = APIRouter(prefix="/api/workflow", tags=["workflow"])


def _serialize_rule(data: dict) -> dict:
    """将 trigger_config / action_config 的 dict 转为 JSON 字符串"""
    for field in ("trigger_config", "action_config"):
        if field in data and isinstance(data[field], dict):
            data[field] = json.dumps(data[field], ensure_ascii=False)
    return data


def _rule_to_out(rule: WorkflowRule) -> dict:
    return {
        "id": rule.id,
        "name": rule.name,
        "job_id": rule.job_id,
        "trigger_type": rule.trigger_type,
        "trigger_config": rule.get_trigger_config(),
        "action_type": rule.action_type,
        "action_config": rule.get_action_config(),
        "is_active": rule.is_active,
        "created_at": rule.created_at,
    }


@router.get("/rules", response_model=list[WorkflowRuleOut])
def list_rules(job_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(WorkflowRule)
    if job_id is not None:
        q = q.filter(WorkflowRule.job_id == job_id)
    return [_rule_to_out(r) for r in q.all()]


@router.post("/rules", response_model=WorkflowRuleOut, status_code=201)
def create_rule(data: WorkflowRuleCreate, db: Session = Depends(get_db)):
    payload = _serialize_rule(data.model_dump())
    rule = WorkflowRule(**payload)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _rule_to_out(rule)


@router.patch("/rules/{rule_id}", response_model=WorkflowRuleOut)
def update_rule(rule_id: int, data: WorkflowRuleUpdate, db: Session = Depends(get_db)):
    rule = db.query(WorkflowRule).filter(WorkflowRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "规则不存在")
    update_data = _serialize_rule(data.model_dump(exclude_unset=True))
    for key, val in update_data.items():
        setattr(rule, key, val)
    db.commit()
    db.refresh(rule)
    return _rule_to_out(rule)


@router.delete("/rules/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(WorkflowRule).filter(WorkflowRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "规则不存在")
    db.delete(rule)
    db.commit()
    return {"ok": True}


@router.post("/execute")
def trigger_workflow(db: Session = Depends(get_db)):
    alerts = execute_workflow(db)
    return {"executed": True, "alerts": alerts}


@router.get("/alerts", response_model=list[WorkflowAlert])
def get_alerts(db: Session = Depends(get_db)):
    return []
