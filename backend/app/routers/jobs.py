from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Job
from ..schemas import JobCreate, JobOut, JobUpdate

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _job_to_out(job: Job) -> dict:
    return {
        "id": job.id,
        "title": job.title,
        "department": job.department,
        "status": job.status,
        "location": job.location,
        "salary_range": job.salary_range,
        "requirements": job.get_requirements() if job.requirements else None,
        "created_at": job.created_at,
    }


@router.get("", response_model=list[JobOut])
def list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(Job).order_by(Job.created_at.desc()).all()
    return [_job_to_out(j) for j in jobs]


@router.post("", response_model=JobOut, status_code=201)
def create_job(data: JobCreate, db: Session = Depends(get_db)):
    job = Job(
        title=data.title,
        department=data.department,
        location=data.location,
        salary_range=data.salary_range,
    )
    if data.requirements:
        job.set_requirements(data.requirements)
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_to_out(job)


@router.patch("/{job_id}", response_model=JobOut)
def update_job(job_id: int, data: JobUpdate, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "岗位不存在")
    update_data = data.model_dump(exclude_unset=True)
    if "requirements" in update_data:
        req = update_data.pop("requirements")
        job.set_requirements(req)
    for field, value in update_data.items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    return _job_to_out(job)


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "岗位不存在")
    db.delete(job)
    db.commit()
