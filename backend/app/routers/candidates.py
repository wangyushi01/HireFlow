from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Candidate, Event
from ..schemas import (
    CandidateCreate,
    CandidateOut,
    CandidateUpdate,
    EventOut,
    StatusChange,
)

router = APIRouter(prefix="/api/candidates", tags=["candidates"])


def _candidate_to_out(c: Candidate) -> dict:
    job_title = c.job.title if c.job else None
    return {
        "id": c.id,
        "name": c.name,
        "phone": c.phone,
        "email": c.email,
        "source": c.source,
        "job_id": c.job_id,
        "status": c.status,
        "years_of_experience": c.years_of_experience,
        "current_company": c.current_company,
        "highest_degree": c.highest_degree,
        "school": c.school,
        "skills": c.get_skills(),
        "expected_salary": c.expected_salary,
        "availability": c.availability,
        "work_history": c.get_work_history(),
        "project_experience": c.get_project_experience(),
        "research_experience": c.get_research_experience(),
        "resume_filename": c.resume_filename,
        "resume_saved_name": c.resume_saved_name,
        "parse_status": c.parse_status,
        "ai_score": c.ai_score,
        "ai_summary": c.ai_summary,
        "ai_recommendation": c.ai_recommendation,
        "ai_match_details": c.get_ai_match_details() if c.ai_match_details else None,
        "job_title": job_title,
        "stage_entered_at": c.stage_entered_at,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


@router.get("", response_model=list[CandidateOut])
def list_candidates(
    status: str = Query(None),
    job_id: int = Query(None),
    source: str = Query(None),
    keyword: str = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Candidate).options(joinedload(Candidate.job))
    if status:
        q = q.filter(Candidate.status == status)
    if job_id:
        q = q.filter(Candidate.job_id == job_id)
    if source:
        q = q.filter(Candidate.source == source)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(
            (Candidate.name.like(like))
            | (Candidate.phone.like(like))
            | (Candidate.email.like(like))
            | (Candidate.current_company.like(like))
        )
    q = q.order_by(Candidate.created_at.desc())
    return [_candidate_to_out(c) for c in q.all()]


@router.get("/{candidate_id}", response_model=CandidateOut)
def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
    c = db.query(Candidate).options(joinedload(Candidate.job)).filter(
        Candidate.id == candidate_id
    ).first()
    if not c:
        raise HTTPException(404, "候选人不存在")
    return _candidate_to_out(c)


@router.post("", response_model=CandidateOut, status_code=201)
def create_candidate(data: CandidateCreate, db: Session = Depends(get_db)):
    c = Candidate(
        name=data.name,
        phone=data.phone,
        email=data.email,
        source=data.source,
        job_id=data.job_id,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _candidate_to_out(c)


@router.patch("/{candidate_id}", response_model=CandidateOut)
def update_candidate(
    candidate_id: int, data: CandidateUpdate, db: Session = Depends(get_db)
):
    c = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not c:
        raise HTTPException(404, "候选人不存在")

    update_data = data.model_dump(exclude_unset=True)

    if "skills" in update_data:
        c.set_skills(update_data.pop("skills"))
    if "work_history" in update_data:
        c.set_work_history(update_data.pop("work_history"))
    if "project_experience" in update_data:
        c.set_project_experience(update_data.pop("project_experience"))
    if "research_experience" in update_data:
        c.set_research_experience(update_data.pop("research_experience"))

    for field, value in update_data.items():
        setattr(c, field, value)

    db.commit()
    db.refresh(c)
    return _candidate_to_out(c)


@router.post("/{candidate_id}/status", response_model=CandidateOut)
def change_status(
    candidate_id: int, data: StatusChange, db: Session = Depends(get_db)
):
    c = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not c:
        raise HTTPException(404, "候选人不存在")

    from ..models import beijing_now

    old_status = c.status
    c.status = data.status
    c.stage_entered_at = beijing_now()

    event = Event(
        candidate_id=c.id,
        event_type="status_changed",
    )
    event.set_detail({"from": old_status, "to": data.status})
    db.add(event)

    db.commit()
    db.refresh(c)
    return _candidate_to_out(c)


@router.delete("/{candidate_id}", status_code=204)
def delete_candidate(candidate_id: int, db: Session = Depends(get_db)):
    c = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not c:
        raise HTTPException(404, "候选人不存在")
    db.query(Event).filter(Event.candidate_id == candidate_id).delete()
    db.delete(c)
    db.commit()


@router.get("/{candidate_id}/events", response_model=list[EventOut])
def list_events(candidate_id: int, db: Session = Depends(get_db)):
    events = (
        db.query(Event)
        .filter(Event.candidate_id == candidate_id)
        .order_by(Event.created_at.desc())
        .all()
    )
    result = []
    for e in events:
        result.append({
            "id": e.id,
            "candidate_id": e.candidate_id,
            "event_type": e.event_type,
            "detail": e.get_detail(),
            "created_at": e.created_at,
        })
    return result
