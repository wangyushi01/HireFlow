import os
import uuid
import logging
import asyncio
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from ..database import get_db, SessionLocal
from ..models import Candidate, Event, Job
from ..schemas import CandidateOut, ParseResult, BatchUploadResult, BatchTaskStatus
from ..services.resume_parser import extract_text, is_supported_file
from ..ai import parse_resume, score_candidate as ai_score
from ..services.workflow import execute_workflow

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resumes", tags=["resumes"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


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


def _auto_score_candidate(db: Session, candidate: Candidate) -> bool:
    """对候选人进行 AI 自动评分。返回是否成功评分。"""
    if candidate.ai_score is not None:
        return True

    job = db.query(Job).filter(Job.id == candidate.job_id).first()
    requirements = job.get_requirements() if job else {}

    try:
        info = {
            "name": candidate.name,
            "years_of_experience": candidate.years_of_experience,
            "current_company": candidate.current_company,
            "highest_degree": candidate.highest_degree,
            "school": candidate.school,
            "skills": candidate.get_skills(),
            "expected_salary": candidate.expected_salary,
            "work_history": candidate.get_work_history(),
            "project_experience": candidate.get_project_experience(),
        }
        score_result = ai_score(info, requirements if requirements else {})
        candidate.ai_score = score_result.get("score", 0)
        candidate.ai_summary = score_result.get("summary")
        candidate.ai_recommendation = score_result.get("recommendation")
        match_details = score_result.get("match_details")
        if match_details:
            candidate.set_ai_match_details(match_details)
        db.commit()

        # 评分后立即触发工作流，实现"上传即决策"
        try:
            execute_workflow(db)
        except Exception:
            pass

        return True
    except Exception as e:
        logger.warning("自动评分失败 candidate=%s: %s", candidate.id, e)
        return False


@router.post("/upload", response_model=ParseResult)
async def upload_resume(
    file: UploadFile = File(...),
    job_id: int = Form(...),
    db: Session = Depends(get_db),
):
    if not is_supported_file(file.filename):
        raise HTTPException(400, "不支持的文件格式，请上传 PDF 或 Word 文件")

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(400, "请选择有效的应聘岗位")

    ext = Path(file.filename).suffix.lower()
    saved_name = f"{uuid.uuid4().hex}{ext}"
    saved_path = UPLOAD_DIR / saved_name

    content = await file.read()
    with open(saved_path, "wb") as f:
        f.write(content)

    candidate = Candidate(
        name="解析中...",
        resume_filename=file.filename,
        resume_saved_name=saved_name,
        parse_status="parsing",
        job_id=job_id,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    # Rename file with candidate_id prefix for traceability
    final_name = f"{candidate.id}_{saved_name}"
    final_path = UPLOAD_DIR / final_name
    saved_path.rename(final_path)
    saved_path = final_path
    candidate.resume_saved_name = final_name
    db.commit()

    try:
        text = extract_text(str(saved_path))
        candidate.raw_resume_text = text
        db.commit()

        parsed = parse_resume(text)

        candidate.name = parsed.get("name") or "未知"
        candidate.phone = parsed.get("phone")
        candidate.email = parsed.get("email")
        candidate.years_of_experience = parsed.get("years_of_experience")
        candidate.current_company = parsed.get("current_company")
        candidate.highest_degree = parsed.get("highest_degree")
        candidate.school = parsed.get("school")
        candidate.set_skills(parsed.get("skills", []))
        candidate.expected_salary = parsed.get("expected_salary")
        candidate.availability = parsed.get("availability")
        candidate.set_work_history(parsed.get("work_history", []))
        candidate.set_project_experience(parsed.get("project_experience", []))
        candidate.set_research_experience(parsed.get("research_experience", []))
        candidate.parse_status = "done"

        event = Event(
            candidate_id=candidate.id,
            event_type="resume_parsed",
        )
        event.set_detail({"filename": file.filename})
        db.add(event)

        db.commit()
        db.refresh(candidate)

        # AI 自动评分 + 立即触发工作流决策
        _auto_score_candidate(db, candidate)
        db.refresh(candidate)

        return ParseResult(
            candidate_id=candidate.id,
            parse_status="done",
            parsed_data=_candidate_to_out(candidate),
        )

    except Exception as e:
        logger.exception("简历解析失败")
        candidate.parse_status = "failed"
        candidate.parse_error = str(e)
        candidate.name = file.filename
        db.commit()

        return ParseResult(
            candidate_id=candidate.id,
            parse_status="failed",
            error=str(e),
        )


@router.get("/{candidate_id}/download")
def download_resume(candidate_id: int, db: Session = Depends(get_db)):
    c = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not c:
        raise HTTPException(404, "候选人不存在")
    if not c.resume_saved_name:
        raise HTTPException(404, "简历文件不存在")
    file_path = UPLOAD_DIR / c.resume_saved_name
    if not file_path.exists():
        raise HTTPException(404, "简历文件已丢失")
    return FileResponse(
        path=str(file_path),
        filename=c.resume_filename or c.resume_saved_name,
        media_type="application/octet-stream",
    )


@router.get("/{candidate_id}/status", response_model=ParseResult)
def get_parse_status(candidate_id: int, db: Session = Depends(get_db)):
    c = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not c:
        raise HTTPException(404, "候选人不存在")

    return ParseResult(
        candidate_id=c.id,
        parse_status=c.parse_status,
        parsed_data=_candidate_to_out(c) if c.parse_status == "done" else None,
        error=c.parse_error,
    )


# --- Batch upload ---

_batch_tasks: dict[str, dict] = {}


def _process_batch_file(task_id: str, file_path: Path, filename: str, candidate_id: int, job_id: Optional[int]):
    db = SessionLocal()
    try:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            return

        text = extract_text(str(file_path))
        candidate.raw_resume_text = text
        db.commit()

        parsed = parse_resume(text)

        candidate.name = parsed.get("name") or "未知"
        candidate.phone = parsed.get("phone")
        candidate.email = parsed.get("email")
        candidate.years_of_experience = parsed.get("years_of_experience")
        candidate.current_company = parsed.get("current_company")
        candidate.highest_degree = parsed.get("highest_degree")
        candidate.school = parsed.get("school")
        candidate.set_skills(parsed.get("skills", []))
        candidate.expected_salary = parsed.get("expected_salary")
        candidate.availability = parsed.get("availability")
        candidate.set_work_history(parsed.get("work_history", []))
        candidate.set_project_experience(parsed.get("project_experience", []))
        candidate.set_research_experience(parsed.get("research_experience", []))
        candidate.parse_status = "done"

        event = Event(candidate_id=candidate.id, event_type="resume_parsed")
        event.set_detail({"filename": filename})
        db.add(event)
        db.commit()
        db.refresh(candidate)

        # AI 自动评分 + 立即触发工作流决策
        _auto_score_candidate(db, candidate)

        _batch_tasks[task_id]["completed"] += 1
        _batch_tasks[task_id]["results"].append(ParseResult(
            candidate_id=candidate.id,
            parse_status="done",
            parsed_data=_candidate_to_out(candidate),
        ))
    except Exception as e:
        logger.exception("批量解析失败: %s", filename)
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if candidate:
            candidate.parse_status = "failed"
            candidate.parse_error = str(e)
            candidate.name = filename
            db.commit()
        _batch_tasks[task_id]["failed"] += 1
        _batch_tasks[task_id]["results"].append(ParseResult(
            candidate_id=candidate_id,
            parse_status="failed",
            error=str(e),
        ))
    finally:
        db.close()


@router.post("/batch-upload", response_model=BatchUploadResult)
async def batch_upload(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    job_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    if job_id:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(400, "请选择有效的应聘岗位")

    task_id = uuid.uuid4().hex[:12]
    _batch_tasks[task_id] = {
        "total": len(files),
        "completed": 0,
        "failed": 0,
        "results": [],
    }

    for file in files:
        if not is_supported_file(file.filename):
            _batch_tasks[task_id]["failed"] += 1
            _batch_tasks[task_id]["results"].append(ParseResult(
                candidate_id=0,
                parse_status="failed",
                error=f"不支持的文件格式: {file.filename}",
            ))
            continue

        ext = Path(file.filename).suffix.lower()
        saved_name = f"{uuid.uuid4().hex}{ext}"
        saved_path = UPLOAD_DIR / saved_name

        content = await file.read()
        with open(saved_path, "wb") as f:
            f.write(content)

        candidate = Candidate(
            name="解析中...",
            resume_filename=file.filename,
            resume_saved_name=saved_name,
            parse_status="parsing",
            job_id=job_id,
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

        final_name = f"{candidate.id}_{saved_name}"
        final_path = UPLOAD_DIR / final_name
        saved_path.rename(final_path)
        candidate.resume_saved_name = final_name
        db.commit()

        background_tasks.add_task(
            _process_batch_file,
            task_id, final_path, file.filename, candidate.id, job_id,
        )

    return BatchUploadResult(task_id=task_id, total=len(files))


@router.get("/batch-status/{task_id}", response_model=BatchTaskStatus)
def get_batch_status(task_id: str):
    task = _batch_tasks.get(task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    return BatchTaskStatus(
        task_id=task_id,
        total=task["total"],
        completed=task["completed"],
        failed=task["failed"],
        results=task["results"],
    )
