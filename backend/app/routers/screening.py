import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Candidate, Job
from ..schemas import ScoreRequest, BatchScoreRequest, ScoreResult, CompareRequest
from ..ai import score_candidate as ai_score, compare_candidates as ai_compare

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/screening", tags=["screening"])


def _candidate_info(c: Candidate) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "years_of_experience": c.years_of_experience,
        "current_company": c.current_company,
        "highest_degree": c.highest_degree,
        "school": c.school,
        "skills": c.get_skills(),
        "expected_salary": c.expected_salary,
        "availability": c.availability,
        "work_history": c.get_work_history(),
        "project_experience": c.get_project_experience(),
        "ai_summary": c.ai_summary,
    }


def _save_score(candidate: Candidate, result: dict, db: Session):
    candidate.ai_score = result.get("score", 0)
    candidate.ai_summary = result.get("summary")
    candidate.ai_recommendation = result.get("recommendation")
    match_details = result.get("match_details")
    if match_details:
        candidate.set_ai_match_details(match_details)
    db.commit()


@router.post("/score/{candidate_id}", response_model=ScoreResult)
def score_single(candidate_id: int, data: ScoreRequest, db: Session = Depends(get_db)):
    c = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not c:
        raise HTTPException(404, "候选人不存在")

    job = db.query(Job).filter(Job.id == data.job_id).first()
    if not job:
        raise HTTPException(404, "岗位不存在")

    try:
        result = ai_score(_candidate_info(c), job.get_requirements())
        _save_score(c, result, db)
        return ScoreResult(
            candidate_id=c.id,
            score=result.get("score", 0),
            summary=result.get("summary", ""),
            recommendation=result.get("recommendation", ""),
            match_details=result.get("match_details"),
        )
    except Exception as e:
        logger.exception("AI 评分失败")
        raise HTTPException(500, f"AI 评分失败: {e}")


@router.post("/batch-score", response_model=list[ScoreResult])
def batch_score(data: BatchScoreRequest, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == data.job_id).first()
    if not job:
        raise HTTPException(404, "岗位不存在")

    q = db.query(Candidate).options(joinedload(Candidate.job))
    if data.candidate_ids:
        q = q.filter(Candidate.id.in_(data.candidate_ids))
    else:
        q = q.filter(Candidate.job_id == data.job_id)
    candidates = q.all()

    if not candidates:
        return []

    results = []
    job_reqs = job.get_requirements()
    for c in candidates:
        try:
            r = ai_score(_candidate_info(c), job_reqs)
            _save_score(c, r, db)
            results.append(ScoreResult(
                candidate_id=c.id,
                score=r.get("score", 0),
                summary=r.get("summary", ""),
                recommendation=r.get("recommendation", ""),
                match_details=r.get("match_details"),
            ))
        except Exception as e:
            logger.error("候选人 %s 评分失败: %s", c.id, e)
            results.append(ScoreResult(
                candidate_id=c.id,
                score=0,
                summary=f"评分失败: {e}",
                recommendation="不推荐",
            ))
    return results


@router.post("/compare")
def compare(data: CompareRequest, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == data.job_id).first()
    if not job:
        raise HTTPException(404, "岗位不存在")

    candidates = (
        db.query(Candidate)
        .filter(Candidate.id.in_(data.candidate_ids))
        .all()
    )
    if not candidates:
        raise HTTPException(400, "未找到指定候选人")

    try:
        result = ai_compare(
            [_candidate_info(c) for c in candidates],
            job.title,
            job.get_requirements(),
        )
        return result
    except Exception as e:
        logger.exception("AI 对比失败")
        raise HTTPException(500, f"AI 对比失败: {e}")
